import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"
import { communityAssetDisplayUrl, communityAssetSelect, communityAssetUrl } from "@/lib/community-asset-urls"
import { characterFrameAsset, characterFrameKey } from "@/lib/community-frames"
import { publicOwner, USER_CHARACTER_TYPES, visibleCharacterWhere } from "@/lib/community-policy"

export const COMMUNITY_GALLERY_SELECT = {
  id: true,
  ownerId: true,
  owner: { select: { displayName: true, username: true } },
  name: true,
  byname: true,
  characterType: true,
  publicationState: true,
  race: true,
  arcana: true,
  rank: true,
  position: true,
  archiveCategory: true,
  imageLayout: true,
  enemyData: true,
  updatedAt: true,
  assets: {
    where: { kind: { in: ["portrait", "gallery"] } },
    select: communityAssetSelect,
  },
} satisfies Prisma.CommunityCharacterSelect

export async function listCommunityGallery(viewerId: string) {
  const records = await prisma.communityCharacter.findMany({
    where: visibleCharacterWhere(viewerId),
    select: COMMUNITY_GALLERY_SELECT,
    orderBy: { updatedAt: "desc" },
  })
  return records.map(record => {
    const portrait = record.assets.find(asset => asset.kind === "portrait")
    const gallery = record.assets.find(asset => asset.kind === "gallery")
    const card = record.characterType === "Monster" ? portrait || gallery : gallery || portrait
    const enemy = record.enemyData && typeof record.enemyData === "object" && !Array.isArray(record.enemyData)
      ? record.enemyData : null
    return {
      id: record.id,
      ownerId: USER_CHARACTER_TYPES.includes(record.characterType as "Character" | "Human") ? record.ownerId : null,
      owner: publicOwner(record.characterType, record.owner),
      name: record.name,
      byname: record.byname,
      characterType: record.characterType,
      publicationState: record.publicationState,
      race: record.race,
      arcana: record.arcana,
      rank: ["President", "Magus"].includes(record.characterType) ? 7 : record.rank,
      position: record.position,
      archiveCategory: record.characterType === "Monster" || record.archiveCategory === "Monster" ? "Enemy" : record.archiveCategory,
      frameKey: characterFrameKey(record.characterType, record.race, record.arcana),
      frameAsset: record.characterType === "Monster" ? "" : characterFrameAsset(record.characterType, record.rank),
      imageLayout: record.imageLayout,
      enemyData: enemy ? { subtype: enemy.subtype, hp: enemy.hp, isBoss: enemy.isBoss } : null,
      image: communityAssetUrl(portrait, record.updatedAt),
      galleryImage: communityAssetUrl(gallery, record.updatedAt),
      cardImage: communityAssetDisplayUrl(card, record.updatedAt),
    }
  })
}
