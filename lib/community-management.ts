import { prisma } from "@/lib/db"
import type { CommunitySession } from "@/lib/community-auth"
import { audit, CommunityHttpError } from "@/lib/community-staff"
import { listCommunityCharacters } from "@/lib/community-characters"
import { COMMUNITY_FRAMES, frameStylesWithDefaults } from "@/lib/community-frames"
import { deleteMediaObject } from "@/lib/r2-media-storage"

export function field(value: unknown, max: number, required = false) {
  const text = typeof value === "string" ? value.trim() : ""
  if (text.length > max || (required && !text)) throw new CommunityHttpError(required ? "กรุณากรอกข้อมูลให้ครบ และตรวจความยาวข้อความ" : "ข้อความยาวเกินกำหนด")
  return text
}
function choice(value: unknown, values: readonly string[]) {
  if (typeof value !== "string" || !values.includes(value)) throw new CommunityHttpError("ตัวเลือกไม่ถูกต้อง")
  return value
}
function date(value: unknown) {
  if (value === null || value === "" || value === undefined) return null
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new CommunityHttpError("วันเวลาไม่ถูกต้อง")
  return new Date(value)
}
function color(value: unknown) {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) throw new CommunityHttpError("สีต้องอยู่ในรูปแบบ #RRGGBB")
  return value.toLowerCase()
}
function checkVersion(current: { updatedAt: Date } | null, expected: unknown) {
  if (current && typeof expected === "string" && current.updatedAt.toISOString() !== expected) throw new CommunityHttpError("ข้อมูลถูกแก้ไขโดย Staff คนอื่นแล้ว กรุณาโหลดใหม่ก่อนบันทึก", 409)
}

export async function getCommunityContent() {
  const now = new Date()
  const [settings, announcements, frames, roles] = await Promise.all([
    prisma.communitySettings.findUnique({ where: { id: "main" }, select: { name: true, state: true, opensAt: true, registrationOpen: true, headline: true, description: true, worldUrl: true } }),
    prisma.communityAnnouncement.findMany({
      where: { state: "PUBLISHED", AND: [{ OR: [{ publishAt: null }, { publishAt: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] },
      select: { id: true, title: true, body: true, kind: true, publishAt: true, pinned: true, updatedAt: true },
      orderBy: [{ pinned: "desc" }, { publishAt: "desc" }, { createdAt: "desc" }], take: 30,
    }),
    prisma.communityFrameStyle.findMany(),
    prisma.communityRole.findMany({ where: { isActive: true }, select: { id: true, name: true, color: true, description: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ])
  return { settings, announcements, frameStyles: frameStylesWithDefaults(frames), roles }
}

export async function staffDashboard() {
  const [settings, announcements, roles, frames, characters, users, logs] = await Promise.all([
    prisma.communitySettings.findUnique({ where: { id: "main" } }),
    prisma.communityAnnouncement.findMany({ orderBy: { updatedAt: "desc" }, take: 200 }),
    prisma.communityRole.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { characters: true } } } }),
    prisma.communityFrameStyle.findMany(),
    listCommunityCharacters(undefined, true),
    prisma.communityUser.findMany({ select: { id: true, displayName: true, username: true }, orderBy: { displayName: "asc" } }),
    prisma.communityAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ])
  return { settings, announcements, roles, frameStyles: frameStylesWithDefaults(frames), characters, users, logs }
}

export async function manageCommunity(actor: CommunitySession, body: Record<string, unknown>) {
  const action = field(body.action, 40, true)
  if (action === "settings") {
    const worldUrl = field(body.worldUrl, 1000)
    if (worldUrl) { let url: URL; try { url = new URL(worldUrl) } catch { throw new CommunityHttpError("ลิงก์ World ไม่ถูกต้อง") }; if (url.protocol !== "https:") throw new CommunityHttpError("ลิงก์ World ต้องเป็น HTTPS") }
    const data = { name: field(body.name, 120, true), state: choice(body.state, ["OPEN", "CLOSED", "PAUSED"]), opensAt: date(body.opensAt), registrationOpen: body.registrationOpen === true, headline: field(body.headline, 200), description: field(body.description, 5000), worldUrl, updatedById: actor.userId }
    await prisma.$transaction(async tx => {
      const before = await tx.communitySettings.findUnique({ where: { id: "main" } }); checkVersion(before, body.expectedUpdatedAt)
      const after = await tx.communitySettings.upsert({ where: { id: "main" }, create: { id: "main", ...data }, update: data })
      await audit(tx, actor, "UPDATE", "settings", "main", "แก้ไขการตั้งค่า Community", before, after)
    }, { maxWait: 10_000, timeout: 30_000 })
  } else if (action === "announcement") {
    const id = field(body.id, 100)
    const data = { title: field(body.title, 180, true), body: field(body.body, 20000, true), kind: choice(body.kind, ["NOTICE", "STORY", "OPENING", "SETTING"]), state: choice(body.state, ["DRAFT", "PUBLISHED", "ARCHIVED"]), publishAt: date(body.publishAt), expiresAt: date(body.expiresAt), pinned: body.pinned === true, updatedById: actor.userId }
    if (data.expiresAt && data.expiresAt <= (data.publishAt || new Date()) && data.state === "PUBLISHED") throw new CommunityHttpError("เวลาหมดอายุต้องอยู่หลังเวลาเผยแพร่")
    await prisma.$transaction(async tx => {
      const before = id ? await tx.communityAnnouncement.findUnique({ where: { id } }) : null
      if (id && !before) throw new CommunityHttpError("ไม่พบประกาศ", 404)
      checkVersion(before, body.expectedUpdatedAt)
      const after = id ? await tx.communityAnnouncement.update({ where: { id }, data }) : await tx.communityAnnouncement.create({ data: { ...data, authorId: actor.userId } })
      await audit(tx, actor, id ? "UPDATE" : "CREATE", "announcement", after.id, data.title, before, after)
    }, { maxWait: 10_000, timeout: 30_000 })
  } else if (action === "role") {
    const id = field(body.id, 100)
    const sortOrder = Number(body.sortOrder)
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 999) throw new CommunityHttpError("ลำดับต้องเป็นเลข 0–999")
    const data = { name: field(body.name, 80, true), description: field(body.description, 2000), color: color(body.color), sortOrder, isActive: body.isActive === true }
    await prisma.$transaction(async tx => {
      const before = id ? await tx.communityRole.findUnique({ where: { id } }) : null
      if (id && !before) throw new CommunityHttpError("ไม่พบ Role", 404)
      checkVersion(before, body.expectedUpdatedAt)
      const after = id ? await tx.communityRole.update({ where: { id }, data }) : await tx.communityRole.create({ data })
      await audit(tx, actor, id ? "UPDATE" : "CREATE", "role", after.id, data.name, before, after)
    }, { maxWait: 10_000, timeout: 30_000 })
  } else if (action === "frameStyles") {
    if (!Array.isArray(body.styles) || body.styles.length !== COMMUNITY_FRAMES.length) throw new CommunityHttpError("กรุณาระบุสีกรอบและแสงให้ครบทุกธาตุ และกรอบ 7 ดาวทั้งสองแบบ")
    const keys = new Set<string>()
    const styles = body.styles.map(item => {
      if (!item || typeof item !== "object") throw new CommunityHttpError("ข้อมูลสีไม่ถูกต้อง")
      const value = item as Record<string, unknown>; const key = String(value.key)
      if (!COMMUNITY_FRAMES.some(frame => frame.key === key) || keys.has(key)) throw new CommunityHttpError("ชนิดกรอบไม่ถูกต้อง")
      keys.add(key)
      return { key, borderColor: color(value.borderColor), glowColor: color(value.glowColor) }
    })
    await prisma.$transaction(async tx => {
      const before = await tx.communityFrameStyle.findMany()
      for (const style of styles) {
        const current = before.find(item => item.key === style.key)
        const expected = (body.styles as Record<string, unknown>[]).find(item => item.key === style.key)?.expectedUpdatedAt
        checkVersion(current || null, expected)
        await tx.communityFrameStyle.upsert({ where: { key: style.key }, create: style, update: { borderColor: style.borderColor, glowColor: style.glowColor } })
      }
      await audit(tx, actor, "UPDATE", "frameStyles", "all", "ปรับสีกรอบและแสงตามธาตุ / กรอบ 7 ดาว", before, styles)
    }, { maxWait: 10_000, timeout: 30_000 })
  } else if (action === "deleteCharacter") {
    const id = field(body.id, 100, true)
    const media = await prisma.$transaction(async tx => {
      const before = await tx.communityCharacter.findUnique({ where: { id }, select: { id: true, name: true, characterType: true, publicationState: true, ownerId: true, mediaAssets: true } })
      if (!before) throw new CommunityHttpError("ไม่พบตัวละคร", 404)
      const {mediaAssets,...details}=before
      await tx.communityCharacter.delete({ where: { id } })
      await audit(tx, actor, "DELETE", "character", id, "ลบตัวละคร: " + before.name, details, null)
      return mediaAssets
    }, { maxWait: 10_000, timeout: 30_000 })
    await Promise.allSettled(media.map(deleteMediaObject))
  } else throw new CommunityHttpError("คำสั่งไม่ถูกต้อง")
  return { saved: true }
}
