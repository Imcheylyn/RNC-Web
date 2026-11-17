const SKIN_ID = /^(?:default|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i

export class WardrobeError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}

export function wardrobeSkinId(value: unknown): string {
  if (typeof value !== "string" || !SKIN_ID.test(value)) throw new WardrobeError("รหัสสกินไม่ถูกต้อง")
  return value.toLowerCase()
}

export function wardrobeAssetKind(id: string, slot: "image" | "chibi" | "medium"): string {
  const key = wardrobeSkinId(id)
  return key === "default" && slot === "image" ? "portrait" : "wardrobe-" + key + "-" + (slot === "image" ? "portrait" : slot)
}

export function isWardrobeAssetKind(kind: string): boolean {
  return /^wardrobe-(?:default|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})-(?:portrait|chibi|medium)$/i.test(kind)
}

export function canHaveWardrobeMedium(characterType: string): boolean {
  return ["Character", "Arcanist", "Acranist"].includes(characterType)
}

export function canManageWardrobe(userId: string, unlockedStaff: boolean, character: { ownerId: string | null; characterType: string; publicationState: string }): boolean {
  return unlockedStaff || (character.ownerId === userId && ["Character", "Human"].includes(character.characterType) && character.publicationState !== "ARCHIVED")
}

export function wardrobeFields(id: string, name: unknown, description: unknown) {
  const skinName = id === "default" ? "Default" : typeof name === "string" ? name.trim() : ""
  if (!skinName || skinName.length > 80) throw new WardrobeError("กรุณากรอกชื่อสกินไม่เกิน 80 ตัวอักษร")
  if (description != null && typeof description !== "string") throw new WardrobeError("รายละเอียดสกินไม่ถูกต้อง")
  const detail = typeof description === "string" ? description.trim() : ""
  if (detail.length > 5000) throw new WardrobeError("รายละเอียดสกินยาวได้ไม่เกิน 5,000 ตัวอักษร")
  return { name: skinName, description: detail }
}

export function assertWardrobeVersion(expected: unknown, updatedAt: Date | null) {
  if (updatedAt && expected !== updatedAt.toISOString()) throw new WardrobeError("สกินนี้มีการแก้ไขจากอีกหน้า กรุณาเปิดสกินใหม่ก่อนบันทึก", 409)
  if (!updatedAt && expected != null && expected !== "") throw new WardrobeError("ข้อมูลสกินเปลี่ยนแล้ว กรุณาโหลดใหม่", 409)
}

export function wardrobeImageScale(value: unknown): number | undefined {
  if (value == null) return undefined
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new WardrobeError("ขนาดภาพชุดไม่ถูกต้อง")
  const scale = Number(value)
  if (!Number.isInteger(scale) || scale < 50 || scale > 200) throw new WardrobeError("ขนาดภาพชุดต้องอยู่ระหว่าง 50–200%")
  return scale
}

export function wardrobeImageOffsetX(value: unknown): number | undefined {
  if (value == null) return undefined
  if (typeof value !== "string" || !/^-?\d+(?:\.\d+)?$/.test(value)) throw new WardrobeError("ตำแหน่งภาพชุดไม่ถูกต้อง")
  const offset = Number(value)
  if (!Number.isFinite(offset) || offset < -100 || offset > 100) throw new WardrobeError("ตำแหน่งภาพชุดเกินขอบเขตที่กำหนด")
  return Math.round(offset * 100) / 100 || 0
}

export const wardrobeImageOffsetY = wardrobeImageOffsetX

export function wardrobeProfileFraming(value: unknown): boolean | undefined {
  if (value == null) return undefined
  if (value === "true") return true
  if (value === "false") return false
  throw new WardrobeError("ตัวเลือกการจัดรูปบนหน้าตัวละครไม่ถูกต้อง")
}

export function wardrobeImageType(data: Uint8Array): string | null {
  if (data.length >= 24 && [137,80,78,71,13,10,26,10].every((byte, i) => data[i] === byte)) return "image/png"
  if (data.length >= 4 && data[0] === 255 && data[1] === 216 && data[2] === 255) return "image/jpeg"
  if (data.length >= 16 && [82,73,70,70].every((byte, i) => data[i] === byte) && [87,69,66,80].every((byte, i) => data[i + 8] === byte)) return "image/webp"
  return null
}
