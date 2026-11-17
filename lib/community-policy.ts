export const USER_CHARACTER_TYPES = ["Character", "Human"] as const
export const STAFF_CHARACTER_TYPES = ["Character", "Human", "President", "Director", "NPC", "Magus", "Monster"] as const
export const CHARACTER_STATES = ["DRAFT", "PENDING", "PUBLISHED", "CHANGES_REQUESTED", "ARCHIVED"] as const
export const HIDDEN_CREATOR_TYPES = new Set<string>(["President", "Director", "NPC", "Magus", "Monster"])

export function characterType(value: unknown, race?: unknown): string {
  const candidate = value === "HeadDirector" || value === "Head Director" ? "President" : value
  return typeof candidate === "string" && candidate ? candidate : race === "Human" ? "Human" : "Character"
}

export function assertCharacterType(value: string, staff: boolean) {
  const allowed: readonly string[] = staff ? STAFF_CHARACTER_TYPES : USER_CHARACTER_TYPES
  if (!allowed.includes(value)) throw new Error("ไม่มีสิทธิ์สร้างตัวละครประเภทนี้")
}

export function canUseUnknownArcana(type: string): boolean {
  return type === "President" || type === "Magus"
}

const HUMAN_WEAPON_ARCANA = new Set(["BEAST", "PLANT", "STAR", "MINERAL", "SPIRIT", "INTELLECT"])

export function canUseHumanWeaponArcana(value: string): boolean {
  return HUMAN_WEAPON_ARCANA.has(value)
}

export function publicOwner(type: string, owner: { displayName: string; username: string } | null) {
  return HIDDEN_CREATOR_TYPES.has(type) ? "" : owner?.displayName || owner?.username || ""
}

export function visibleCharacterWhere(viewerId?: string) {
  return viewerId
    ? { OR: [{ publicationState: "PUBLISHED" }, { ownerId: viewerId, characterType: { in: [...USER_CHARACTER_TYPES] } }] }
    : { publicationState: "PUBLISHED" }
}
