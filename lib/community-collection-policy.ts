export class CollectionError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}

const ENEMY_CHARACTER_TYPES = new Set(["Monster", "Enemy"])
const USER_RELATIONSHIP_TARGET_TYPES = ["Director", "Character", "Human", "NPC"] as const

export function isEnemyCharacterType(type: string) {
  return ENEMY_CHARACTER_TYPES.has(type)
}

export function relationshipTargetTypes(sourceType: string, staff: boolean): readonly string[] | null {
  if (isEnemyCharacterType(sourceType)) return []
  if (staff) return null
  if (sourceType === "Character" || sourceType === "Arcanist" || sourceType === "Acranist" || sourceType === "Human") {
    return USER_RELATIONSHIP_TARGET_TYPES
  }
  return null
}

export const RELATIONSHIP_TYPES = [
  { id: "friend", label: "เพื่อน", color: "#79b9a2" },
  { id: "family", label: "ครอบครัว", color: "#d6ad6a" },
  { id: "love", label: "คนรัก", color: "#df91ac" },
  { id: "colleague", label: "เพื่อนร่วมงาน", color: "#80a8d4" },
  { id: "rival", label: "คู่แข่ง", color: "#b299d6" },
  { id: "enemy", label: "ศัตรู", color: "#d87868" },
  { id: "other", label: "อื่น ๆ", color: "#a6a5a0" },
] as const

export function field(value: unknown, maximum: number, required = false): string {
  if (typeof value !== "string" && value !== undefined && value !== null) throw new CollectionError("ข้อมูลไม่ถูกต้อง")
  const result = typeof value === "string" ? value.trim() : ""
  if (result.length > maximum) throw new CollectionError("ข้อความยาวเกินไป")
  if (required && !result) throw new CollectionError("กรุณากรอกข้อมูลที่จำเป็น")
  return result
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CollectionError("ข้อมูลไม่ถูกต้อง")
  return value as Record<string, unknown>
}

export function canManageCollection(actorId: string, staff: boolean, character: { ownerId: string | null; publicationState: string }) {
  return staff || (character.ownerId === actorId && character.publicationState !== "ARCHIVED")
}

export function version(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 0) throw new CollectionError("กรุณาเปิดข้อมูลใหม่ก่อนบันทึก", 409)
  return Number(value)
}

export function parseTime(value: unknown, optional = false): number | null {
  if ((value === "" || value === null || value === undefined) && optional) return null
  if (typeof value === "string" && value.includes(":")) {
    const parts = value.trim().split(":")
    if (parts.length < 2 || parts.length > 3 || !parts.every(part => /^\d+(?:\.\d+)?$/.test(part))) throw new CollectionError("ระบุเวลาเป็นนาที:วินาที เช่น 01:24")
    if (parts.slice(1).some(part => Number(part) >= 60)) throw new CollectionError("จำนวนวินาทีหรือนาทีในช่วงเวลาต้องน้อยกว่า 60")
    value = parts.reduce((total, part) => total * 60 + Number(part), 0)
  }
  const result = Number(value ?? 0)
  if (!Number.isFinite(result) || result < 0 || result > 7 * 86400) throw new CollectionError("ช่วงเวลาไม่ถูกต้อง")
  return Math.round(result * 1000) / 1000
}

export function youtubeId(value: unknown): string {
  const raw = field(value, 2048, true)
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw
  let url: URL
  try { url = new URL(raw) } catch { throw new CollectionError("ลิงก์ YouTube ไม่ถูกต้อง") }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new CollectionError("ลิงก์ YouTube ไม่ถูกต้อง")
  const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "")
  const id = host === "youtu.be" ? url.pathname.split("/")[1]
    : ["youtube.com", "youtube-nocookie.com"].includes(host)
      ? url.searchParams.get("v") || (/^\/(?:embed|shorts|live)\//.test(url.pathname) ? url.pathname.split("/")[2] : "") : ""
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) throw new CollectionError("กรุณาใช้ลิงก์วิดีโอ YouTube")
  return id
}

export function audioUrl(value: unknown): string {
  let url: URL
  try { url = new URL(field(value, 2048, true)) } catch { throw new CollectionError("ลิงก์ไฟล์เสียงไม่ถูกต้อง") }
  if (url.protocol !== "https:" || url.username || url.password || !/\.(mp3|m4a|wav|ogg|webm|flac|aac)$/i.test(url.pathname)) throw new CollectionError("ใช้ลิงก์ HTTPS ที่ชี้ไปยังไฟล์เสียงโดยตรง หรือเลือก YouTube")
  return url.href
}

export function mediaFields(value: unknown, allowNoAudio = false) {
  const body = object(value)
  const title = field(body.title, 160, true)
  const sourceType = field(body.sourceType, 16, true)
  if (allowNoAudio && sourceType === "NONE") return {title,sourceType,startSeconds:0,endSeconds:null,youtubeId:null,sourceUrl:null,audioAssetId:null}
  if (!["YOUTUBE", "UPLOAD", "AUDIO_URL"].includes(sourceType)) throw new CollectionError("กรุณาเลือกแหล่งเสียง")
  const startSeconds = parseTime(body.startSeconds)!
  const endSeconds = parseTime(body.endSeconds, true)
  if (endSeconds !== null && endSeconds <= startSeconds) throw new CollectionError("เวลาจบต้องอยู่หลังเวลาเริ่ม")
  return {
    title, sourceType, startSeconds, endSeconds,
    youtubeId: sourceType === "YOUTUBE" ? youtubeId(body.youtubeId || body.sourceUrl) : null,
    sourceUrl: sourceType === "AUDIO_URL" ? audioUrl(body.sourceUrl) : null,
    audioAssetId: sourceType === "UPLOAD" ? field(body.audioAssetId, 100, true) : null,
  }
}

export function relationshipFields(value: unknown, sourceId: string) {
  const body = object(value)
  const targetId = field(body.targetId, 100, true)
  if (targetId === sourceId) throw new CollectionError("เลือกตัวละครอีกคนสำหรับความสัมพันธ์")
  const type = field(body.type, 30, true)
  if (!RELATIONSHIP_TYPES.some(item => item.id === type)) throw new CollectionError("ประเภทความสัมพันธ์ไม่ถูกต้อง")
  return { targetId, type, label: field(body.label, 80), note: field(body.note, 5000) }
}

export function relationshipEvidenceFields(value: unknown) {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length > 100) throw new CollectionError("รายการหลักฐานไม่ถูกต้อง")
  const ids = new Set<string>()
  return value.map((raw, sortOrder) => {
    const item = object(raw), id = field(item.id, 100, true)
    if (!/^[A-Za-z0-9_-]+$/.test(id) || ids.has(id)) throw new CollectionError("รหัสหลักฐานซ้ำหรือไม่ถูกต้อง")
    ids.add(id)
    const title = field(item.title, 160), text = field(item.text, 5000), imageAssetId = field(item.imageAssetId, 100) || null
    if (!title && !text && !imageAssetId) throw new CollectionError("เพิ่มข้อความหรือรูปให้หลักฐานก่อนบันทึก")
    return {id, title, text, imageAssetId, sortOrder}
  })
}

export function sniffMedia(bytes: Uint8Array, purpose: string): string | null {
  const text = (from: number, count: number) => String.fromCharCode(...bytes.slice(from, from + count))
  if (purpose === "COVER" || purpose === "EVIDENCE") {
    if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n)) return "image/png"
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg"
    if (text(0,4) === "RIFF" && text(8,4) === "WEBP") return "image/webp"
    return null
  }
  if (bytes[0] === 255 && (bytes[1] & 0xf6) === 0xf0) return "audio/aac"
  if (text(0,3) === "ID3" || (bytes[0] === 255 && (bytes[1] & 224) === 224 && (bytes[1] & 6) !== 0)) return "audio/mpeg"
  if (text(0,4) === "RIFF" && text(8,4) === "WAVE") return "audio/wav"
  if (text(4,4) === "ftyp") return "audio/mp4"
  if (text(0,4) === "OggS") return "audio/ogg"
  if (text(0,4) === "fLaC") return "audio/flac"
  if ([26,69,223,163].every((n,i) => bytes[i] === n)) return "audio/webm"
  return null
}

export const MEDIA_TYPES: Record<string, string> = {
  "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/wav": "wav", "audio/ogg": "ogg", "audio/webm": "webm", "audio/flac": "flac",
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
}
