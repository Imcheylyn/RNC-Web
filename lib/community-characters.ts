import { Prisma } from "@/generated/prisma/client"
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/db"
import { communityAssetSelect, communityAssetUrl, communityAssetReferenceId } from "@/lib/community-asset-urls"
import type { CommunitySession } from "@/lib/community-auth"
import { audit } from "@/lib/community-staff"
import { characterFrameKey, characterFrameAsset } from "@/lib/community-frames"
import { assertCharacterType, canUseHumanWeaponArcana, canUseUnknownArcana, characterType, publicOwner, visibleCharacterWhere, USER_CHARACTER_TYPES } from "@/lib/community-policy"
import { countryForCode, countryForValue, isUnspecifiedNationality, employeeRequired, employeeEligible, employeeIdFor, employmentFor } from "@/lib/community-employment"
import { deleteR2Asset, isR2StorageConfigured, uploadR2Asset, type StoredR2Asset } from "@/lib/r2-storage"
import { isWardrobeAssetKind } from "@/lib/community-wardrobe-policy"
import { saveThemeSongInTransaction, serializeThemeSong } from "@/lib/community-collection"
import { CollectionError } from "@/lib/community-collection-policy"
import { deleteMediaObject } from "@/lib/r2-media-storage"


const STAT_NAMES = ["COR", "MNF", "RFX", "SCR", "DEF"] as const
const ARCANA_NAMES = new Set(["BEAST", "PLANT", "STAR", "MINERAL", "SPIRIT", "INTELLECT"])
const ENEMY_SUBTYPES = new Set(["Critter", "Arcanoid", "Magus Sacramentum"])
const SKILL_DETAIL_KEYS = ["ultimate", "arcane1", "arcane2", "arcane3"] as const
const IMAGE_LAYOUT_VIEWS = {
  galleryDesktop: { scale: 1, x: 50, y: 50 },
  galleryMobile: { scale: 1, x: 50, y: 18 },
  profile: { scale: 1, x: 50, y: 50 },
  staffCard: { scale: 1, x: 50, y: 100 },
  staffId: { scale: 1, x: 50, y: 28 },
  relationships: { scale: 1, x: 50, y: 50 },
} as const
const MAX_IMAGE_BYTES = 2 * 1024 * 1024
// Keep base64 JSON requests below Vercel's 4.5 MB function payload limit.
const MAX_TOTAL_IMAGE_BYTES = 3 * 1024 * 1024

export const COMMUNITY_CHARACTER_INCLUDE = {
  owner: { select: { id: true, displayName: true, username: true } },
  assets: { select: communityAssetSelect },
  roles: { include: { role: true } },
  themeSong: true,
} satisfies Prisma.CommunityCharacterInclude

type CharacterRecord = Prisma.CommunityCharacterGetPayload<{
  include: typeof COMMUNITY_CHARACTER_INCLUDE
}>

export class CharacterInputError extends Error {}
export class CharacterStorageError extends Error {}
export class CharacterAccessError extends Error {}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function splitLegacyMeasurements(value: unknown): { height: string; weight: string } {
  const raw = text(value, 80)
  const separator = raw.indexOf("/")
  if (separator < 0) return { height: raw, weight: "" }
  return { height: raw.slice(0, separator).trim(), weight: raw.slice(separator + 1).trim() }
}

function normalizeSkillDetails(value: unknown): Prisma.InputJsonValue {
  const source = asObject(value)
  const details: Record<string, { name: string; description: string; imageCrop: { scale: number; x: number; y: number } }> = {}
  const clampCrop = (raw: unknown, fallback: number, min: number, max: number) => {
    const number = Number(raw)
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
  }
  for (const key of SKILL_DETAIL_KEYS) {
    const skill = asObject(source[key])
    const crop = asObject(skill.imageCrop)
    details[key] = {
      name: text(skill.name, 120),
      description: text(skill.description, 5000),
      imageCrop: {
        scale: clampCrop(crop.scale, 1, 1, 3),
        x: clampCrop(crop.x, 50, 0, 100),
        y: clampCrop(crop.y, 50, 0, 100),
      },
    }
  }
  return details as Prisma.InputJsonValue
}

type HumanWeapon = {
  id: string
  name: string
  arcana: string
  description: string
  stats: Record<"COR" | "MNF" | "SCR", number>
  image: string
}

function normalizeHumanWeapons(value: unknown): HumanWeapon[] {
  if (!Array.isArray(value)) return []
  if (value.length > 2) throw new CharacterInputError("Human ถืออาวุธได้สูงสุด 2 ชิ้น")
  const ids = new Set<string>()
  return value.map((item, index) => {
    const weapon = asObject(item)
    const requestedId = text(weapon.id, 40)
    const id = /^[A-Za-z0-9_-]{1,40}$/.test(requestedId) ? requestedId : "slot-" + index
    if (ids.has(id)) throw new CharacterInputError("ข้อมูลรหัสอาวุธซ้ำกัน")
    ids.add(id)
    const name = text(weapon.name, 120)
    const description = text(weapon.description, 5000)
    const arcana = text(weapon.arcana, 32).toUpperCase()
    const image = text(weapon.image, 3_000_000)
    if (arcana && !canUseHumanWeaponArcana(arcana)) {
      throw new CharacterInputError("ธาตุอาวุธของ Human เลือกได้เฉพาะ Beast, Plant, Star, Mineral, Spirit หรือ Intellect")
    }
    if (!name) {
      if (description || arcana || image) throw new CharacterInputError("กรุณากรอกชื่ออาวุธให้ครบ")
      return null
    }
    if (!arcana) throw new CharacterInputError("กรุณาเลือกธาตุให้อาวุธทุกชิ้น")
    const rawStats = asObject(weapon.stats)
    const stats = { COR: 0, MNF: 0, SCR: 0 }
    for (const key of Object.keys(stats) as Array<keyof typeof stats>) {
      const number = Number(rawStats[key])
      stats[key] = Number.isFinite(number) ? Math.min(999, Math.max(0, Math.floor(number))) : 0
    }
    return { id, name, arcana, description, stats, image }
  }).filter((weapon): weapon is HumanWeapon => weapon !== null)
}

function normalizeImageLayout(value: unknown): Prisma.InputJsonValue {
  const source = asObject(value)
  const layout: Record<string, { scale: number; x: number; y: number }> = {}
  for (const [view, defaults] of Object.entries(IMAGE_LAYOUT_VIEWS)) {
    const requested = asObject(source[view])
    const scale = Number(requested.scale)
    const x = Number(requested.x)
    const y = Number(requested.y)
    layout[view] = {
      scale: Math.min(2, Math.max(0.5, Number.isFinite(scale) ? scale : defaults.scale)),
      x: Math.min(100, Math.max(0, Number.isFinite(x) ? x : defaults.x)),
      y: Math.min(100, Math.max(0, Number.isFinite(y) ? y : defaults.y)),
    }
  }
  return layout as Prisma.InputJsonValue
}

function rankFor(race: string, position: string): number | null {
  if (race === "Human") return 4
  if (position === "Intern") return 5
  if (["Timekeeper", "Researcher", "Medic"].includes(position)) return 6
  return null
}

type ImageValue = { kind: string; value: string }

function readImageValues(body: Record<string, unknown>, weapons: HumanWeapon[]): ImageValue[] {
  const skillImages = Array.isArray(body.skillImages) ? body.skillImages : []
  const values: ImageValue[] = [
    { kind: "portrait", value: text(body.image, 3_000_000) },
    { kind: "gallery", value: text(body.galleryImage, 3_000_000) },
    ...[0, 1, 2, 3].map(index => ({
      kind: "skill-" + index,
      value: text(skillImages[index], 3_000_000),
    })),
    ...weapons.map(weapon => ({ kind: "weapon-" + weapon.id, value: weapon.image })),
  ]
  let totalBytes = 0
  for (const item of values) {
    if (!item.value) continue
    if (item.value.startsWith("data:")) {
      const image = decodeImageData(item.value)
      totalBytes += image.data.length
      if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
        throw new CharacterInputError("The images could not be prepared for saving. Please try again.")
      }
    } else if (!communityAssetReferenceId(item.value)) {
      throw new CharacterInputError("An image reference is invalid.")
    }
  }
  return values
}

function decodeImageData(value: string): { contentType: string; data: Buffer } {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match) throw new CharacterInputError("Only PNG, JPEG, and WebP images are supported.")
  const data = Buffer.from(match[2], "base64")
  if (!data.length || data.length > MAX_IMAGE_BYTES) {
    throw new CharacterInputError("The image could not be prepared for saving. Please try again.")
  }
  return { contentType: match[1], data }
}

export function normalizeCommunityCharacter(value: unknown, staff = false) {
  const body = asObject(value)
  const name = text(body.name, 80)
  if (!name) throw new CharacterInputError("Add a character name before saving.")

  const type = characterType(body.characterType, body.race)
  try { assertCharacterType(type, staff) } catch { throw new CharacterInputError("ไม่มีสิทธิ์สร้างตัวละครประเภทนี้") }
  const race = type === "Monster" ? "" : type === "Human" ? "Human" : text(body.race, 80)
  const isHuman = race === "Human"
  if (type === "Character" && race === "Human") throw new CharacterInputError("กรุณาเลือกประเภท Human สำหรับตัวละครมนุษย์")
  const position = text(body.position, 80)
  const nationalityText = text(body.nationality, 80)
  const submittedNationalityCode = text(body.nationalityCode, 8).toUpperCase()
  const selectedCountry = countryForCode(submittedNationalityCode) || countryForValue(nationalityText)
  const nationalityCode = type === "Monster" ? "" : submittedNationalityCode || selectedCountry?.code || (isUnspecifiedNationality(nationalityText) ? "XX" : "")
  const country = countryForCode(nationalityCode)
  if (nationalityCode && !country) throw new CharacterInputError("กรุณาเลือกประเทศจากรายการ")
  if (!staff && position && !["Timekeeper", "Researcher", "Medic", "Intern"].includes(position)) throw new CharacterInputError("กรุณาเลือก Position ที่ถูกต้อง")
  if (!staff && (!["Pure blood", "The Mixed", "The Awaken", "The Cursed", "Human"].includes(race) || (race !== "Human" && !["Timekeeper", "Researcher", "Medic", "Intern"].includes(position)))) throw new CharacterInputError("เผ่าพันธุ์หรือตำแหน่งตัวละครไม่ถูกต้อง")
  const arcanaValue = text(body.arcana, 32)
  if (arcanaValue === "UNKNOWN" && !canUseUnknownArcana(type)) {
    throw new CharacterInputError("ธาตุ Unknown เลือกได้เฉพาะ President และ Magus")
  }
  const arcana = arcanaValue === "UNKNOWN" || (type === "NPC" && arcanaValue === "NATURAL")
    ? arcanaValue : type === "Monster"
    ? (arcanaValue === "NATURAL" || ARCANA_NAMES.has(arcanaValue) ? arcanaValue : "NATURAL")
    : race === "Human" ? "NATURAL" : (ARCANA_NAMES.has(arcanaValue) ? arcanaValue : "SPIRIT")
  const weaponArcanaValue = text(body.weaponArcana, 32).toUpperCase()
  if (isHuman && weaponArcanaValue && !canUseHumanWeaponArcana(weaponArcanaValue)) {
    throw new CharacterInputError("ธาตุอาวุธของ Human เลือกได้เฉพาะ Beast, Plant, Star, Mineral, Spirit หรือ Intellect")
  }
  const weapons = isHuman ? normalizeHumanWeapons(body.weapons) : []
  if (isHuman && !weapons.length && text(body.weaponName, 120) && !weaponArcanaValue) {
    throw new CharacterInputError("กรุณาเลือกธาตุให้อาวุธทุกชิ้น")
  }
  const rawEnemyData = asObject(body.enemyData)
  let enemyData: Prisma.InputJsonValue = {}
  if (type === "Monster") {
    const subtype = text(rawEnemyData.subtype, 40)
    const hp = Number(rawEnemyData.hp)
    if (!ENEMY_SUBTYPES.has(subtype)) throw new CharacterInputError("Choose an Enemy type.")
    if (!Number.isInteger(hp) || hp < 0 || hp > 999999) throw new CharacterInputError("HP must be an integer from 0 to 999999." )
    enemyData = { subtype, hp, isBoss: rawEnemyData.isBoss === true, description: text(rawEnemyData.description, 5000) } as Prisma.InputJsonValue
  }
  const rawStats = asObject(body.stats)
  const stats: Record<string, number> = {}
  for (const key of STAT_NAMES) {
    const number = Number(rawStats[key])
    stats[key] = Number.isFinite(number) ? Math.min(999, Math.max(0, Math.floor(number))) : 0
  }

  const rawCrop = asObject(body.galleryCrop)
  const galleryCrop = ["zoom", "x", "y"].every(key => Number.isFinite(Number(rawCrop[key])))
    ? {
        zoom: Math.min(3, Math.max(1, Number(rawCrop.zoom))),
        x: Math.max(-2000, Math.min(2000, Number(rawCrop.x))),
        y: Math.max(-2000, Math.min(2000, Number(rawCrop.y))),
      }
    : null

  const rawHeightChartScale = typeof body.heightChartScale === "number" ? body.heightChartScale : Number.NaN
  const rawHeightChartOffset = typeof body.heightChartOffset === "number" ? body.heightChartOffset : Number.NaN
  const rawHeightChartXOffset = typeof body.heightChartXOffset === "number" ? body.heightChartXOffset : Number.NaN
  const heightChartScale = staff
    ? Math.max(0.5, Math.min(1.5, Number.isFinite(rawHeightChartScale) ? rawHeightChartScale : 1))
    : undefined
  const heightChartOffset = staff
    ? Math.max(-60, Math.min(60, Number.isFinite(rawHeightChartOffset) ? rawHeightChartOffset : 0))
    : undefined
  const heightChartXOffset = staff
    ? Math.max(-140, Math.min(140, Number.isFinite(rawHeightChartXOffset) ? rawHeightChartXOffset : 0))
    : undefined

  const legacyId = text(body.legacyId, 80)
  if (legacyId && !/^oc-[A-Za-z0-9_-]+$/.test(legacyId)) {
    throw new CharacterInputError("The legacy character id is invalid.")
  }

  const legacyMeasurements = splitLegacyMeasurements(body.heightWeight)
  const hasSeparatedMeasurements = typeof body.height === "string" || typeof body.weight === "string"
  const height = type === "Monster" ? "" : hasSeparatedMeasurements ? text(body.height, 40) : text(legacyMeasurements.height, 40)
  const weight = type === "Monster" ? "" : hasSeparatedMeasurements ? text(body.weight, 40) : text(legacyMeasurements.weight, 40)

  return {
    legacyId: legacyId || null,
    images: readImageValues(body, weapons),
    fields: {
      name,
      byname: type === "Monster" ? "" : text(body.byname, 80),
      era: type === "Monster" ? "" : text(body.era, 4).replace(/\D/g, "").slice(0, 4),
      quote: type === "Monster" ? "" : text(body.quote, 1000),
      nickname: type === "Monster" ? "" : text(body.nickname, 60),
      age: type === "Monster" ? "" : text(body.age, 45),
      gender: type === "Monster" ? "" : text(body.gender, 60),
      nationality: type === "Monster" ? "" : country?.nationalityEn || text(body.nationality, 80),
      nationalityCode,
      employeeEnabled: type === "NPC" && body.employeeEnabled === true,
      heightWeight: type === "Monster" ? "" : [height, weight].filter(Boolean).join(" / "),
      race: type === "Monster" ? "" : race,
      arcana,
      rank: type === "Monster" ? null : staff ? (["President", "Magus"].includes(type) ? 7 : type === "Human" ? 4 : 6) : rankFor(race, position),
      characterType: type,
      position: type === "Monster" ? "" : position,
      stats: stats as Prisma.InputJsonValue,
      enemyData,
      mediumName: type === "Monster" || isHuman ? "" : text(body.mediumName, 120),
      mediumDescription: type === "Monster" || isHuman ? "" : text(body.mediumDescription, 5000),
      weaponName: isHuman ? (weapons[0]?.name || text(body.weaponName, 120)) : "",
      weaponDescription: isHuman ? (weapons[0]?.description || text(body.weaponDescription, 5000)) : "",
      weaponArcana: isHuman ? (weapons[0]?.arcana || weaponArcanaValue) : "",
      weaponData: (isHuman ? weapons.map(({ id, name: weaponName, arcana: weaponArcana, description, stats }) => ({ id, name: weaponName, arcana: weaponArcana, description, stats })) : []) as Prisma.InputJsonValue,
      abilityDescription: type === "Monster" || isHuman ? "" : text(body.abilityDescription, 5000),
      limitations: type === "Monster" || isHuman ? "" : text(body.limitations, 5000),
      skillDetails: normalizeSkillDetails(body.skillDetails),
      likes: type === "Monster" ? "" : text(body.likes, 3000),
      dislikes: type === "Monster" ? "" : text(body.dislikes, 3000),
      personality: type === "Monster" ? "" : text(body.personality, 5000),
      history: type === "Monster" ? "" : text(body.history, 12000),
      playstyle: type === "Monster" ? "" : text(body.playstyle, 80),
      status: type === "Monster" ? "" : text(body.status, 80),
      contact: type === "Monster" ? "" : text(body.contact, 160),
      discord: type === "Monster" ? "" : text(body.discord, 80),
      other: type === "Monster" ? "" : text(body.other, 7000),
      ...(staff ? { heightChartScale, heightChartOffset, heightChartXOffset } : {}),
      galleryCrop: galleryCrop
        ? galleryCrop as Prisma.InputJsonValue
        : Prisma.DbNull,
      imageLayout: normalizeImageLayout(body.imageLayout),
      archiveCategory: type === "President" ? "President" : type === "Monster" ? "Enemy" : type,
    },
  }
}

export function serializeCommunityCharacter(record: CharacterRecord, viewerId?: string, staff = false) {
  const byKind = new Map(record.assets.map(asset => [asset.kind, asset]))
  const assetUrl = (kind: string) => {
    return communityAssetUrl(byKind.get(kind), record.updatedAt)
  }
  const measurements = splitLegacyMeasurements(record.heightWeight)
  const storedWeaponData = Array.isArray(record.weaponData)
    ? record.weaponData as unknown as Array<Record<string, unknown>>
    : []
  const legacyNationalityCountry = countryForCode(record.nationalityCode) || countryForValue(record.nationality)
  const weapons = record.characterType === "Human" || record.race === "Human"
    ? (storedWeaponData.length ? storedWeaponData : record.weaponName ? [{ id: "legacy-0", name: record.weaponName, arcana: record.weaponArcana, description: record.weaponDescription, stats: {} }] : [])
      .slice(0, 2)
      .map((weapon, index) => {
        const id = typeof weapon.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(weapon.id) ? weapon.id : "slot-" + index
        return {
          id,
          name: text(weapon.name, 120),
          arcana: text(weapon.arcana, 32).toUpperCase(),
          description: text(weapon.description, 5000),
          stats: asObject(weapon.stats),
          image: assetUrl("weapon-" + id),
        }
      })
    : []
  return {
    id: record.id,
    ownerId: staff || USER_CHARACTER_TYPES.includes(record.characterType as "Character" | "Human") ? record.ownerId : null,
    owner: publicOwner(record.characterType, record.owner),
    characterType: record.characterType,
    publicationState: record.publicationState,
    reviewNote: staff || record.ownerId === viewerId ? record.reviewNote : "",
    roles: [],
    name: record.name,
    byname: record.byname,
    era: record.era,
    quote: record.quote,
    nickname: record.nickname,
    age: record.age,
    gender: record.gender,
    nationality: legacyNationalityCountry?.nationalityEn || record.nationality,
    nationalityTh: legacyNationalityCountry?.th || (record.nationality || record.nationalityCode
      ? (isUnspecifiedNationality(record.nationality) ? "ไม่ระบุ" : record.nationality)
      : ""),
    nationalityCode: record.nationalityCode || legacyNationalityCountry?.code || (isUnspecifiedNationality(record.nationality) ? "XX" : ""),
    employeeEnabled: employeeRequired(record.characterType) || (record.characterType === "NPC" && record.employeeEnabled),
    employeeNumber: record.employeeNumber,
    employeeId: employeeEligible(record.characterType) && (employeeRequired(record.characterType) || record.employeeEnabled) ? employeeIdFor(record, record.employeeNumber) : null,
    employeeCardImage: staff || record.ownerId === viewerId ? assetUrl("employee-card") : "",
    employeeCardSignature: staff || record.ownerId === viewerId || record.publicationState === "PUBLISHED" ? assetUrl("employee-signature") : "",
    employeeCardSigned: byKind.has("employee-signature"),
    height: measurements.height,
    weight: measurements.weight,
    heightWeight: record.heightWeight,
    race: record.race,
    arcana: record.arcana,
    rank: ["President", "Magus"].includes(record.characterType) ? 7 : record.rank,
    frameKey: characterFrameKey(record.characterType, record.race, record.arcana),
    frameAsset: record.characterType === "Monster" ? "" : characterFrameAsset(record.characterType, record.rank),
    position: record.position,
    stats: record.stats,
    enemyData: record.enemyData,
    mediumName: record.mediumName,
    mediumDescription: record.mediumDescription,
    weaponName: record.weaponName,
    weaponDescription: record.weaponDescription,
    weaponArcana: record.weaponArcana,
    weapons,
    abilityDescription: record.abilityDescription,
    limitations: record.limitations,
    skillDetails: record.skillDetails,
    likes: record.likes,
    dislikes: record.dislikes,
    personality: record.personality,
    history: record.history,
    playstyle: record.playstyle,
    status: record.status,
    contact: record.contact,
    discord: record.discord,
    other: record.other,
    heightChartScale: record.heightChartScale,
    heightChartOffset: record.heightChartOffset,
    heightChartXOffset: record.heightChartXOffset,
    galleryCrop: record.galleryCrop,
    imageLayout: record.imageLayout,
    archiveCategory: record.characterType === "Monster" ? "Enemy" : record.archiveCategory === "Monster" ? "Enemy" : record.archiveCategory,
    image: assetUrl("portrait"),
    galleryImage: assetUrl("gallery"),
    skillImages: [0, 1, 2, 3].map(index => assetUrl("skill-" + index)),
    themeSong: serializeThemeSong(record.themeSong),
    art: "0%",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export async function listCommunityCharacters(viewerId?: string, staff = false) {
  const records = await prisma.communityCharacter.findMany({
    where: staff ? {} : visibleCharacterWhere(viewerId),
    include: COMMUNITY_CHARACTER_INCLUDE,
    orderBy: { updatedAt: "desc" },
  })
  return records.map(record => serializeCommunityCharacter(record, viewerId, staff))
}

export async function findCommunityCharacter(id: string, viewerId?: string, staff = false) {
  const record = await prisma.communityCharacter.findFirst({
    where: { id, ...(staff ? {} : visibleCharacterWhere(viewerId)) },
    include: COMMUNITY_CHARACTER_INCLUDE,
  })
  return record ? serializeCommunityCharacter(record, viewerId, staff) : null
}

function preserveUnchangedImageReferences(body: Record<string, unknown>, current: {
  characterType: string
  race: string
  weaponData: Prisma.JsonValue
  weaponName: string
  weaponArcana: string
  weaponDescription: string
  imageLayout: Prisma.JsonValue
  assets: Array<{ id: string; kind: string }>
}) {
  const assetByKind = new Map(current.assets.map(asset => [asset.kind, asset.id]))
  const assetReference = (kind: string) => {
    const id = assetByKind.get(kind)
    return id ? "/api/community/assets/" + id : ""
  }
  const removedSkills = new Set((Array.isArray(body.skillImageRemovals) ? body.skillImageRemovals : [])
    .map(Number).filter(index => Number.isInteger(index) && index >= 0 && index < 4))
  const submittedSkills = Array.isArray(body.skillImages) ? body.skillImages : []
  const requestedType = typeof body.characterType === "string" ? text(body.characterType, 40) : current.characterType
  body.skillImages = [0, 1, 2, 3].map(index => {
    const image = text(submittedSkills[index], 3_000_000)
    return image || removedSkills.has(index) ? image : assetReference("skill-" + index)
  })

  const requestedRace = typeof body.race === "string" ? text(body.race, 80) : current.race
  if (requestedType === "Monster" || (requestedRace !== "Human" && requestedType !== "Human")) return

  const storedWeapons = Array.isArray(current.weaponData)
    ? current.weaponData as unknown[]
    : []
  const existingWeapons = storedWeapons.length ? storedWeapons : current.weaponName ? [{
    id: "legacy-0",
    name: current.weaponName,
    arcana: current.weaponArcana,
    description: current.weaponDescription,
    stats: {},
  }] : []
  const removedWeapons = new Set((Array.isArray(body.weaponImageRemovals) ? body.weaponImageRemovals : [])
    .filter((id): id is string => typeof id === "string"))

  if (!Array.isArray(body.weapons)) {
    body.weapons = existingWeapons.map((value, index) => {
      const weapon = asObject(value)
      const requestedId = text(weapon.id, 40)
      const id = /^[A-Za-z0-9_-]{1,40}$/.test(requestedId) ? requestedId : "slot-" + index
      return { ...weapon, id, image: assetReference("weapon-" + id) }
    })
    return
  }

  body.weapons = body.weapons.map((value, index) => {
    const weapon = asObject(value)
    const requestedId = text(weapon.id, 40)
    const id = /^[A-Za-z0-9_-]{1,40}$/.test(requestedId) ? requestedId : "slot-" + index
    const image = text(weapon.image, 3_000_000)
    if (image || removedWeapons.has(id)) return value
    const existingImage = assetReference("weapon-" + id)
    return existingImage ? { ...weapon, id, image: existingImage } : value
  })
}

export async function saveCommunityCharacter(actorId: string, value: unknown, targetId?: string, options: { staff?: boolean; actor?: CommunitySession } = {}) {
  const body = { ...asObject(value) }, staff = options.staff === true
  let currentForImageMerge: {
    id: string
    ownerId: string | null
    characterType: string
    publicationState: string
    updatedAt: Date
    race: string
    weaponData: Prisma.JsonValue
    weaponName: string
    weaponArcana: string
    weaponDescription: string
    imageLayout: Prisma.JsonValue
    enemyData: Prisma.JsonValue
    skillDetails: Prisma.JsonValue
    assets: Array<{ id: string; kind: string }>
  } | null = null
  if (targetId) {
    currentForImageMerge = await prisma.communityCharacter.findUnique({
      where: { id: targetId },
      select: {
        id: true, ownerId: true, characterType: true, publicationState: true, updatedAt: true,
        race: true, weaponData: true, weaponName: true, weaponArcana: true, weaponDescription: true, imageLayout: true,
        enemyData: true, skillDetails: true,
        assets: { select: { id: true, kind: true } },
      },
    })
    if (!currentForImageMerge || (!staff && (currentForImageMerge.ownerId !== actorId || !(USER_CHARACTER_TYPES as readonly string[]).includes(currentForImageMerge.characterType)))) throw new CharacterAccessError()
    if (!staff && currentForImageMerge.publicationState === "ARCHIVED") throw new CharacterInputError("ตัวละครนี้ถูกเก็บเข้าคลัง กรุณาติดต่อ Staff")
    if (typeof body.expectedUpdatedAt === "string" && body.expectedUpdatedAt !== currentForImageMerge.updatedAt.toISOString()) throw new CharacterInputError("ข้อมูลถูกแก้ไขแล้ว กรุณาโหลดใหม่ก่อนบันทึก")
    preserveUnchangedImageReferences(body, currentForImageMerge)
    if (body.characterType === "Monster" && currentForImageMerge.characterType === "Monster") {
      body.enemyData = { ...asObject(currentForImageMerge.enemyData), ...asObject(body.enemyData) }
      if (body.skillDetails === undefined) body.skillDetails = currentForImageMerge.skillDetails
    }
    if (!staff) body.imageLayout = currentForImageMerge.imageLayout
  }
  if (!staff && !targetId) delete body.imageLayout
  const normalized = normalizeCommunityCharacter(body, staff)
  const ownerId = staff ? (typeof body.ownerId === "string" && body.ownerId ? body.ownerId : null) : actorId
  if (staff && !ownerId && (USER_CHARACTER_TYPES as readonly string[]).includes(normalized.fields.characterType)) throw new CharacterInputError("กรุณาเลือกเจ้าของสำหรับ Character หรือ Human")
  if (normalized.fields.rank !== null && (!Number.isInteger(normalized.fields.rank) || normalized.fields.rank < 1 || normalized.fields.rank > 7 || (normalized.fields.rank === 7 && !["President", "Magus"].includes(normalized.fields.characterType)))) throw new CharacterInputError("กรอบ 7 ดาวใช้สำหรับ President และ Magus")
  const publicationState = "PUBLISHED"
  const reviewNote = staff && typeof body.reviewNote === "string" ? text(body.reviewNote, 2000) : undefined
  const r2Enabled = isR2StorageConfigured()
  const uploadedR2Assets: StoredR2Asset[] = []
  const uploadedR2ByKind = new Map<string, StoredR2Asset>()
  const obsoleteR2Assets: StoredR2Asset[] = []
  let uploadCharacterId = targetId || randomUUID()
  let record: CharacterRecord
  try {
    if (targetId) {
      uploadCharacterId = currentForImageMerge!.id
    }
    if (!targetId && normalized.legacyId && ownerId) {
      const legacyRecord = await prisma.communityCharacter.findUnique({
        where: { ownerId_legacyId: { ownerId, legacyId: normalized.legacyId } },
        select: { id: true },
      })
      if (legacyRecord) uploadCharacterId = legacyRecord.id
    }
    if (r2Enabled) {
      const imageUploads = normalized.images.filter(item => item.value.startsWith("data:"))
      const uploadResults = await Promise.allSettled(imageUploads.map(async item => {
        const image = decodeImageData(item.value)
        const stored = await uploadR2Asset(uploadCharacterId, item.kind, image.contentType, image.data)
        return { kind: item.kind, stored }
      }))
      for (const result of uploadResults) {
        if (result.status === "fulfilled") {
          uploadedR2Assets.push(result.value.stored)
          uploadedR2ByKind.set(result.value.kind, result.value.stored)
        }
      }
      const failedUpload = uploadResults.find(result => result.status === "rejected")
      if (failedUpload?.status === "rejected") {
        console.error("[community/assets] R2 upload failed", failedUpload.reason)
        throw new CharacterStorageError("อัปโหลดรูปไม่สำเร็จ ข้อมูลยังไม่ถูกบันทึก กรุณาลองอีกครั้ง")
      }
    }
    record = await prisma.$transaction(async transaction => {
    let existingId = targetId
    let before: CharacterRecord | null = null
    if (targetId) {
      await transaction.$queryRaw`SELECT "id" FROM "CommunityCharacter" WHERE "id" = ${targetId} FOR UPDATE`
      const existing = await transaction.communityCharacter.findUnique({
        where: { id: targetId },
        include: COMMUNITY_CHARACTER_INCLUDE,
      })
      if (!existing || (!staff && (existing.ownerId !== actorId || !(USER_CHARACTER_TYPES as readonly string[]).includes(existing.characterType)))) throw new CharacterAccessError()
      if (!staff && existing.publicationState === "ARCHIVED") throw new CharacterInputError("ตัวละครนี้ถูกเก็บเข้าคลัง กรุณาติดต่อ Staff")
      if (typeof body.expectedUpdatedAt === "string" && body.expectedUpdatedAt !== existing.updatedAt.toISOString()) throw new CharacterInputError("ข้อมูลถูกแก้ไขแล้ว กรุณาโหลดใหม่ก่อนบันทึก")
      before = existing
    } else if (normalized.legacyId) {
      if (!ownerId) throw new CharacterInputError("กรุณาเลือกเจ้าของสำหรับข้อมูลที่นำเข้า")
      const existing = await transaction.communityCharacter.findUnique({
        where: { ownerId_legacyId: { ownerId, legacyId: normalized.legacyId } },
        include: COMMUNITY_CHARACTER_INCLUDE,
      })
      existingId = existing?.id
      if (existingId) {
        await transaction.$queryRaw`SELECT "id" FROM "CommunityCharacter" WHERE "id" = ${existingId} FOR UPDATE`
        before = await transaction.communityCharacter.findUniqueOrThrow({ where: { id: existingId }, include: COMMUNITY_CHARACTER_INCLUDE })
      }
    }
    if (!existingId && !staff) {
      const settings = await transaction.communitySettings.findUnique({ where: { id: "main" } })
      if (settings && !settings.registrationOpen) throw new CharacterInputError("ขณะนี้ปิดรับตัวละครใหม่")
    }
    if (ownerId && !(await transaction.communityUser.findUnique({ where: { id: ownerId }, select: { id: true } }))) throw new CharacterInputError("ไม่พบเจ้าของตัวละคร")
    let employment: ReturnType<typeof employmentFor>
    const previousEmployment = before || (normalized.legacyId ? { employeeNumber: null, employeeEnabled: false } : null)
    try { employment = employmentFor(normalized.fields, previousEmployment) }
    catch (error) { throw new CharacterInputError(error instanceof Error ? error.message : "ข้อมูลรหัสพนักงานไม่ครบ") }
    let employeeNumber = employment.number
    if (employment.enabled && employment.ready && employeeNumber === null) {
      const allocations = await transaction.$queryRaw<Array<{ value: number }>>`
        WITH max_used AS (
          SELECT COALESCE(MAX("employeeNumber"), 0)::integer AS value
          FROM "CommunityCharacter"
        )
        INSERT INTO "CommunityEmployeeCounter" ("id", "value")
        SELECT 'main', max_used.value + 1
        FROM max_used
        WHERE max_used.value < 9999
        ON CONFLICT ("id") DO UPDATE
        SET "value" = GREATEST(
          "CommunityEmployeeCounter"."value",
          (SELECT COALESCE(MAX("employeeNumber"), 0) FROM "CommunityCharacter")
        ) + 1
        WHERE GREATEST(
          "CommunityEmployeeCounter"."value",
          (SELECT COALESCE(MAX("employeeNumber"), 0) FROM "CommunityCharacter")
        ) < 9999
        RETURNING "value"
      `
      if (!allocations.length) throw new CharacterInputError("เลขทะเบียนพนักงานครบ 9999 แล้ว กรุณาติดต่อ Staff")
      employeeNumber = allocations[0].value
    }
    const employeeId = employment.enabled && employment.ready ? employeeIdFor(normalized.fields, employeeNumber) : null
    const data = { ...normalized.fields, employeeEnabled: employment.enabled, employeeNumber, employeeId, rank: !staff && before ? before.rank : normalized.fields.rank, publicationState, ...(staff ? { ownerId, reviewedAt: new Date(), reviewedById: actorId } : {}), ...(reviewNote !== undefined ? { reviewNote } : {}) }

    const character = existingId
      ? await transaction.communityCharacter.update({
          where: { id: existingId },
          data,
        })
      : await transaction.communityCharacter.create({
          data: {
            id: uploadCharacterId,
            ...data,
            ownerId,
            createdById: actorId,
            legacyId: normalized.legacyId,
          },
        })

    if (staff && body.roleIds !== undefined) {
      if (!Array.isArray(body.roleIds) || body.roleIds.some(id => typeof id !== "string") || body.roleIds.length > 20) throw new CharacterInputError("ข้อมูล Role ไม่ถูกต้อง")
      const ids = [...new Set(body.roleIds as string[])]
      const existingRoles = await transaction.communityRole.count({ where: { id: { in: ids } } })
      if (existingRoles !== ids.length) throw new CharacterInputError("ไม่พบ Role ที่เลือก")
      await transaction.communityCharacterRole.deleteMany({ where: { characterId: character.id } })
      if (ids.length) await transaction.communityCharacterRole.createMany({ data: ids.map(roleId => ({ characterId: character.id, roleId })) })
    }

    const previousAssets = await transaction.communityCharacterAsset.findMany({
      where: { characterId: character.id },
    })
    const keepIds: string[] = []
    for (const asset of previousAssets) {
      if (["employee-card", "employee-signature"].includes(asset.kind) || isWardrobeAssetKind(asset.kind)) keepIds.push(asset.id)
    }
    for (const item of normalized.images) {
      if (!item.value) continue
      if (item.value.startsWith("data:")) {
        const image = decodeImageData(item.value)
        const existingAsset = previousAssets.find(asset => asset.kind === item.kind)
        let savedAsset
        if (r2Enabled) {
          const stored = uploadedR2ByKind.get(item.kind)
          if (!stored) throw new Error("Cloudflare R2 upload did not complete.")
          if (existingAsset?.storageBucket && existingAsset.storageKey) {
            obsoleteR2Assets.push({ bucket: existingAsset.storageBucket, key: existingAsset.storageKey })
          }
          savedAsset = existingAsset
            ? await transaction.communityCharacterAsset.update({
                where: { id: existingAsset.id },
                data: { contentType: image.contentType, data: null, storageBucket: stored.bucket, storageKey: stored.key },
              })
            : await transaction.communityCharacterAsset.create({
                data: {
                  characterId: character.id,
                  kind: item.kind,
                  contentType: image.contentType,
                  data: null,
                  storageBucket: stored.bucket,
                  storageKey: stored.key,
                },
              })
        } else {
          savedAsset = existingAsset
            ? await transaction.communityCharacterAsset.update({
                where: { id: existingAsset.id },
                data: { contentType: image.contentType, data: new Uint8Array(image.data), storageBucket: null, storageKey: null },
              })
            : await transaction.communityCharacterAsset.create({
                data: {
                  characterId: character.id,
                  kind: item.kind,
                  contentType: image.contentType,
                  data: new Uint8Array(image.data),
                  storageBucket: null,
                  storageKey: null,
                },
              })
        }
        keepIds.push(savedAsset.id)
        continue
      }

      const referenceId = communityAssetReferenceId(item.value)
      const existingAsset = previousAssets.find(asset => asset.id === referenceId && asset.kind === item.kind)
      if (!existingAsset) throw new CharacterInputError("An image does not belong to this character.")
      keepIds.push(existingAsset.id)
    }

    if (r2Enabled) {
      for (const asset of previousAssets) {
        if (!keepIds.includes(asset.id) && asset.storageBucket && asset.storageKey) {
          obsoleteR2Assets.push({ bucket: asset.storageBucket, key: asset.storageKey })
        }
      }
    }

    await transaction.communityCharacterAsset.deleteMany({
      where: {
        characterId: character.id,
        ...(keepIds.length ? { id: { notIn: keepIds } } : {}),
      },
    })

    if (Object.prototype.hasOwnProperty.call(body, "themeSong")) {
      await saveThemeSongInTransaction(transaction, character.id, body.themeSong, actorId)
    }
    const saved = await transaction.communityCharacter.findUniqueOrThrow({
      where: { id: character.id },
      include: COMMUNITY_CHARACTER_INCLUDE,
    })
    if (staff && options.actor) {
      const details = (item: CharacterRecord) => {
        const { owner: _owner, assets: _assets, roles, ...fields } = item
        return { ...fields, roles: roles.map(row => row.roleId) }
      }
      await audit(transaction, options.actor, existingId ? "UPDATE" : "CREATE", "character", saved.id, saved.name, before ? details(before) : undefined, details(saved))
    }

    return saved
    }, { maxWait: 10_000, timeout: 30_000 })
  } catch (error) {
    if (r2Enabled && uploadedR2Assets.length) {
      const cleaned = await Promise.allSettled(uploadedR2Assets.map(deleteR2Asset))
      if (cleaned.some(result => result.status === "rejected")) {
        console.error("[community/assets] failed to clean up R2 uploads after save error")
      }
    }
    if (error instanceof CollectionError) throw new CharacterInputError(error.message)
    throw error
  }
  if (r2Enabled && obsoleteR2Assets.length) {
    const removed = await Promise.allSettled(obsoleteR2Assets.map(deleteR2Asset))
    if (removed.some(result => result.status === "rejected")) {
      console.error("[community/assets] failed to remove replaced R2 objects")
    }
  }
  return serializeCommunityCharacter(record, actorId, staff)
}

export async function deleteCommunityCharacter(ownerId: string, id: string) {
  const existing = await prisma.communityCharacter.findUnique({
    where: { id },
    select: {
      ownerId: true,
      characterType: true,
      assets: { select: { storageBucket: true, storageKey: true } },
      mediaAssets: true,
    },
  })
  if (!existing || existing.ownerId !== ownerId || !(USER_CHARACTER_TYPES as readonly string[]).includes(existing.characterType)) throw new CharacterAccessError()
  await prisma.communityCharacter.delete({ where: { id } })
  await Promise.allSettled(existing.mediaAssets.map(deleteMediaObject))
  if (isR2StorageConfigured()) {
    const stored = existing.assets.filter(asset => asset.storageBucket && asset.storageKey)
    const removed = await Promise.allSettled(stored.map(asset =>
      deleteR2Asset({ bucket: asset.storageBucket!, key: asset.storageKey! }),
    ))
    if (removed.some(result => result.status === "rejected")) {
      console.error("[community/assets] failed to remove R2 objects after character deletion")
    }
  }
}
