import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/db"
import { communityAssetSelect, communityAssetUrl } from "@/lib/community-asset-urls"
import type { CommunitySession } from "@/lib/community-auth"
import { visibleCharacterWhere } from "@/lib/community-policy"
import { audit } from "@/lib/community-staff"

import { deleteR2Asset, isR2StorageConfigured, uploadR2Asset, type StoredR2Asset } from "@/lib/r2-storage"
import { assertWardrobeVersion, canHaveWardrobeMedium, canManageWardrobe, WardrobeError, wardrobeAssetKind, wardrobeFields, wardrobeImageOffsetX, wardrobeImageOffsetY, wardrobeImageScale, wardrobeImageType, wardrobeProfileFraming, wardrobeSkinId } from "@/lib/community-wardrobe-policy"

const accessSelect = { id:true, ownerId:true, characterType:true, publicationState:true } as const

function assertAccess(character: { ownerId:string | null; characterType:string; publicationState:string } | null, actor: CommunitySession, staff: boolean) {
  if (!character) throw new WardrobeError("ไม่พบตัวละคร", 404)
  if (!canManageWardrobe(actor.userId, staff, character)) throw new WardrobeError("คุณไม่มีสิทธิ์แก้ไขตู้เสื้อผ้าของตัวละครนี้", 403)
}

function storedAsset(asset: { storageBucket:string | null; storageKey:string | null }): StoredR2Asset | null {
  return asset.storageBucket && asset.storageKey ? { bucket:asset.storageBucket, key:asset.storageKey } : null
}

async function cleanObjects(objects: StoredR2Asset[]) {
  const unique = [...new Map(objects.map(object => [object.bucket + "/" + object.key, object])).values()]
  const result = await Promise.allSettled(unique.map(deleteR2Asset))
  if (result.some(item => item.status === "rejected")) console.error("[community/wardrobe] R2 object cleanup failed")
}

export async function listCharacterWardrobe(characterId: string, actor: CommunitySession, staff: boolean) {
  const character = await prisma.communityCharacter.findFirst({
    where: { id:characterId, ...(staff ? {} : visibleCharacterWhere(actor.userId)) },
    select: {
      ...accessSelect, name:true, quote:true, updatedAt:true,
      assets:{select:communityAssetSelect},
      wardrobeSkins:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}]},
    },
  })
  if (!character) throw new WardrobeError("ไม่พบตัวละคร", 404)
  const base = character.wardrobeSkins.find(skin => skin.id === "default")
  const serialize = (skin: { id:string; name:string; description:string; imageScale:number; imageOffsetX:number; imageOffsetY:number; applyFramingToProfile:boolean | null; updatedAt:Date } | undefined, defaultSkin = false) => {
    const id = defaultSkin ? "default" : skin!.id
    const version = skin && skin.updatedAt > character.updatedAt ? skin.updatedAt : character.updatedAt
    const assetUrl = (kind:string) => {
      const asset = character.assets.find(item => item.kind === kind)
      return communityAssetUrl(asset, defaultSkin ? character.updatedAt : version)
    }
    return {
      id, name:defaultSkin ? "Default" : skin!.name,
      description:skin ? skin.description : character.quote,
      imageScale:skin?.imageScale ?? 100,
      imageOffsetX:skin?.imageOffsetX ?? 0,
      imageOffsetY:skin?.imageOffsetY ?? 0,
      applyFramingToProfile:skin ? (skin.applyFramingToProfile ?? null) : false,
      image:assetUrl(wardrobeAssetKind(id, "image")),
      thumbnail:assetUrl(wardrobeAssetKind(id, "image")),
      chibi:assetUrl(wardrobeAssetKind(id, "chibi")),
      medium:canHaveWardrobeMedium(character.characterType) ? assetUrl(wardrobeAssetKind(id, "medium")) : "",
      updatedAt:skin?.updatedAt.toISOString() || null,
      isDefault:defaultSkin,
    }
  }
  return {
    canEdit:canManageWardrobe(actor.userId, staff, character),
    canHaveMedium:canHaveWardrobeMedium(character.characterType),
    characterName:character.name,
    skins:[serialize(base, true), ...character.wardrobeSkins.filter(skin => skin.id !== "default").map(skin => serialize(skin))],
  }
}

export async function saveCharacterSkin(characterId: string, requestedId: string | undefined, form: FormData, actor: CommunitySession, staff: boolean) {
  const id = wardrobeSkinId(requestedId || (typeof form.get("skinId") === "string" ? String(form.get("skinId")) : randomUUID()))
  const create = !requestedId && id !== "default"
  const imageScale = wardrobeImageScale(form.get("imageScale"))
  const imageOffsetX = wardrobeImageOffsetX(form.get("imageOffsetX"))
  const imageOffsetY = wardrobeImageOffsetY(form.get("imageOffsetY"))
  const applyFramingToProfile = wardrobeProfileFraming(form.get("applyFramingToProfile"))
  const fields = {
    ...wardrobeFields(id, form.get("name"), form.get("description")),
    ...(imageScale === undefined ? {} : {imageScale}),
    ...(imageOffsetX === undefined ? {} : {imageOffsetX}),
    ...(imageOffsetY === undefined ? {} : {imageOffsetY}),
    ...(applyFramingToProfile === undefined ? {} : {applyFramingToProfile}),
  }
  const expected = form.get("expectedUpdatedAt")
  const removeChibi = form.get("removeChibi") === "1"
  const removeMedium = form.get("removeMedium") === "1"
  const changesMedium = form.has("medium") || removeMedium
  const character = await prisma.communityCharacter.findUnique({where:{id:characterId},select:accessSelect})
  assertAccess(character, actor, staff)
  if (changesMedium && !canHaveWardrobeMedium(character!.characterType)) throw new WardrobeError("เพิ่มรูป Medium ได้เฉพาะตัวละคร Arcanist")
  const initial = await prisma.communityCharacterSkin.findUnique({where:{characterId_id:{characterId,id}}})
  if (create && initial) throw new WardrobeError("สกินนี้ถูกบันทึกแล้ว กรุณาเปิดตู้เสื้อผ้าใหม่",409)
  if (!create && id !== "default" && !initial) throw new WardrobeError("ไม่พบสกินนี้",404)
  assertWardrobeVersion(expected,initial?.updatedAt || null)
  const uploads: Array<{kind:string;contentType:string;data:Buffer}> = []
  for (const slot of ["image", "chibi", "medium"] as const) {
    const file = form.get(slot)
    if (file == null) continue
    if (!(file instanceof File) || !file.size) throw new WardrobeError("ไฟล์รูปไม่ถูกต้อง กรุณาเลือกใหม่")
    if (slot === "chibi" && removeChibi) throw new WardrobeError("กรุณาเลือกว่าจะเปลี่ยนหรือลบ Chibi")
    if (slot === "medium" && removeMedium) throw new WardrobeError("กรุณาเลือกว่าจะเปลี่ยนหรือลบ Medium")
    if (file.size > (slot === "image" ? 3 : 1) * 1024 * 1024) throw new WardrobeError("เตรียมรูปสำหรับบันทึกไม่สำเร็จ กรุณาเลือกไฟล์อีกครั้ง", 413)
    const data = Buffer.from(await file.arrayBuffer())
    const contentType = wardrobeImageType(data)
    if (!contentType || (file.type && file.type !== contentType)) throw new WardrobeError("รองรับรูป PNG, JPEG และ WebP เท่านั้น")
    uploads.push({kind:wardrobeAssetKind(id, slot),contentType,data})
  }
  if (uploads.length && !isR2StorageConfigured()) throw new WardrobeError("ระบบเก็บรูปยังไม่พร้อม กรุณาติดต่อ Staff ข้อมูลเดิมยังอยู่ครบ", 503)
  const uploaded: Array<{kind:string;contentType:string;stored:StoredR2Asset}> = []
  const obsolete: StoredR2Asset[] = []
  let committed = false
  try {
    const results = await Promise.allSettled(uploads.map(async image => ({kind:image.kind,contentType:image.contentType,stored:await uploadR2Asset(characterId,image.kind,image.contentType,image.data)})))
    for (const result of results) if (result.status === "fulfilled") uploaded.push(result.value)
    if (results.some(result => result.status === "rejected")) throw new WardrobeError("อัปโหลดรูปไม่สำเร็จ ข้อมูลเดิมยังอยู่ครบ กรุณาลองอีกครั้ง", 503)
    await prisma.$transaction(async transaction => {
      await transaction.$queryRaw`SELECT "id" FROM "CommunityCharacter" WHERE "id" = ${characterId} FOR UPDATE`
      const currentCharacter = await transaction.communityCharacter.findUnique({where:{id:characterId},select:accessSelect})
      assertAccess(currentCharacter, actor, staff)
      if (changesMedium && !canHaveWardrobeMedium(currentCharacter!.characterType)) throw new WardrobeError("เพิ่มรูป Medium ได้เฉพาะตัวละคร Arcanist")
      const key = {characterId,id}
      const existing = await transaction.communityCharacterSkin.findUnique({where:{characterId_id:key}})
      if (create && existing) throw new WardrobeError("สกินนี้ถูกบันทึกแล้ว กรุณาเปิดตู้เสื้อผ้าใหม่", 409)
      if (!create && id !== "default" && !existing) throw new WardrobeError("ไม่พบสกินนี้", 404)
      assertWardrobeVersion(expected, existing?.updatedAt || null)
      const kinds = [wardrobeAssetKind(id,"image"), wardrobeAssetKind(id,"chibi"), wardrobeAssetKind(id,"medium")]
      const previous = await transaction.communityCharacterAsset.findMany({where:{characterId,kind:{in:kinds}}})
      if (!uploaded.some(item => item.kind === kinds[0]) && !previous.some(item => item.kind === kinds[0])) throw new WardrobeError("กรุณาเพิ่มรูปสกิน")
      const maximum = create ? await transaction.communityCharacterSkin.aggregate({where:{characterId},_max:{sortOrder:true}}) : null
      const skin = await transaction.communityCharacterSkin.upsert({
        where:{characterId_id:key},
        create:{...key,...fields,sortOrder:id === "default" ? 0 : (maximum?._max.sortOrder || 0) + 1},
        update:fields,
      })
      for (const image of uploaded) {
        const old = previous.find(asset => asset.kind === image.kind)
        if (old) { const object = storedAsset(old); if (object) obsolete.push(object) }
        const data = {contentType:image.contentType,data:null,storageBucket:image.stored.bucket,storageKey:image.stored.key}
        await transaction.communityCharacterAsset.upsert({where:{characterId_kind:{characterId,kind:image.kind}},create:{characterId,kind:image.kind,...data},update:data})
      }
      for (const [remove, kind] of [[removeChibi, kinds[1]], [removeMedium, kinds[2]]] as const) {
        if (!remove) continue
        const old = previous.find(asset => asset.kind === kind)
        if (old) { const object = storedAsset(old); if (object) obsolete.push(object) }
        await transaction.communityCharacterAsset.deleteMany({where:{characterId,kind}})
      }
      if (id === "default" && uploaded.some(image => image.kind === "portrait")) await transaction.communityCharacter.update({where:{id:characterId},data:{updatedAt:new Date()}})
      await audit(transaction, actor, create ? "CREATE" : "UPDATE", "character-skin", characterId + "/" + id, fields.name, existing, {id:skin.id,name:skin.name,description:skin.description,imageScale:skin.imageScale,imageOffsetX:skin.imageOffsetX,imageOffsetY:skin.imageOffsetY,applyFramingToProfile:skin.applyFramingToProfile})
    }, {maxWait:10_000,timeout:20_000})
    committed = true
  } finally {
    if (!committed) await cleanObjects(uploaded.map(image => image.stored))
  }
  await cleanObjects(obsolete)
  return {...await listCharacterWardrobe(characterId,actor,staff), savedId:id}
}

export async function deleteCharacterSkin(characterId:string, requestedId:string, expected:unknown, actor:CommunitySession, staff:boolean) {
  const id = wardrobeSkinId(requestedId)
  if (id === "default") throw new WardrobeError("ลบชุดเริ่มต้นไม่ได้", 409)
  const obsolete: StoredR2Asset[] = []
  await prisma.$transaction(async transaction => {
    await transaction.$queryRaw`SELECT "id" FROM "CommunityCharacter" WHERE "id" = ${characterId} FOR UPDATE`
    assertAccess(await transaction.communityCharacter.findUnique({where:{id:characterId},select:accessSelect}),actor,staff)
    const existing = await transaction.communityCharacterSkin.findUnique({where:{characterId_id:{characterId,id}}})
    if (!existing) throw new WardrobeError("ไม่พบสกินนี้",404)
    assertWardrobeVersion(expected,existing.updatedAt)
    const kinds = [wardrobeAssetKind(id,"image"),wardrobeAssetKind(id,"chibi"),wardrobeAssetKind(id,"medium")]
    const assets = await transaction.communityCharacterAsset.findMany({where:{characterId,kind:{in:kinds}},select:{storageBucket:true,storageKey:true}})
    for (const asset of assets) { const object = storedAsset(asset); if (object) obsolete.push(object) }
    await transaction.communityCharacterAsset.deleteMany({where:{characterId,kind:{in:kinds}}})
    await transaction.communityCharacterSkin.delete({where:{characterId_id:{characterId,id}}})
    await audit(transaction,actor,"DELETE","character-skin",characterId + "/" + id,existing.name,existing)
  },{maxWait:10_000,timeout:20_000})
  await cleanObjects(obsolete)
  return listCharacterWardrobe(characterId,actor,staff)
}
