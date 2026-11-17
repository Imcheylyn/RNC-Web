import { randomUUID } from "node:crypto"
import type { Prisma } from "@/generated/prisma/client"
import type { CommunitySession } from "@/lib/community-auth"
import { prisma } from "@/lib/db"
import { visibleCharacterWhere } from "@/lib/community-policy"
import { canManageCollection, CollectionError, field, MEDIA_TYPES, sniffMedia } from "@/lib/community-collection-policy"
import { inspectMediaObject, mediaBucket, mediaSignedUrl, deleteMediaObject } from "@/lib/r2-media-storage"

export async function collectionCharacter(id: string, actor: CommunitySession, staff: boolean, edit = false) {
  const character = await prisma.communityCharacter.findFirst({where:{id,...(staff ? {} : visibleCharacterWhere(actor.userId))},select:{id:true,ownerId:true,publicationState:true,name:true,characterType:true}})
  if (!character) throw new CollectionError("ไม่พบตัวละคร",404)
  if (edit && !canManageCollection(actor.userId,staff,character)) throw new CollectionError("คุณไม่มีสิทธิ์แก้ไขข้อมูลของตัวละครนี้",403)
  return character
}

export async function beginMediaUpload(body: Record<string,unknown>, actor: CommunitySession, staff: boolean) {
  const characterId = field(body.characterId,100) || null
  if (characterId) await collectionCharacter(characterId,actor,staff,true)
  const purpose = body.purpose === "COVER" ? "COVER" : body.purpose === "EVIDENCE" ? "EVIDENCE" : body.purpose === "AUDIO" ? "AUDIO" : ""
  if (!purpose) throw new CollectionError("ประเภทไฟล์ไม่ถูกต้อง")
  const aliases:Record<string,string> = {"audio/mp3":"audio/mpeg","audio/x-wav":"audio/wav","audio/wave":"audio/wav","audio/x-m4a":"audio/mp4","audio/x-aac":"audio/aac","video/mp4":"audio/mp4","video/webm":"audio/webm","application/ogg":"audio/ogg","audio/x-flac":"audio/flac"}
  const type = field(body.contentType,80,true).split(";")[0].trim().toLowerCase()
  const contentType = aliases[type] || type
  if (!MEDIA_TYPES[contentType] || (purpose !== "AUDIO") !== contentType.startsWith("image/")) throw new CollectionError(purpose !== "AUDIO" ? "ใช้รูปชนิด PNG, JPG หรือ WebP" : "ใช้ไฟล์ MP3, M4A, AAC, WAV, OGG, FLAC หรือ WebM")
  const byteSize = Number(body.byteSize)
  if (!Number.isSafeInteger(byteSize) || byteSize <= 0 || byteSize > 5 * 1024 ** 3) throw new CollectionError("ไฟล์ว่างหรือเกินขนาดที่ R2 รับในครั้งเดียว")
  const duration = body.durationSeconds == null ? null : Number(body.durationSeconds)
  if (duration !== null && (!Number.isFinite(duration) || duration <= 0)) throw new CollectionError("อ่านความยาวเสียงไม่สำเร็จ")
  const id = randomUUID(), storageBucket = mediaBucket(), storageKey = "media/" + actor.userId + "/" + id + "." + MEDIA_TYPES[contentType]
  await prisma.communityMediaAsset.create({data:{id,uploaderId:actor.userId,characterId,purpose,originalName:field(body.originalName,240,true),contentType,byteSize:BigInt(byteSize),durationSeconds:duration,storageBucket,storageKey}})
  return {id,uploadUrl:mediaSignedUrl({storageBucket,storageKey,contentType},"PUT"),headers:{"Content-Type":contentType,"If-None-Match":"*"},assetUrl:"/api/community/media/assets/" + id}
}

export async function completeMediaUpload(body:Record<string,unknown>,actor:CommunitySession) {
  const asset = await prisma.communityMediaAsset.findFirst({where:{id:field(body.id,100,true),uploaderId:actor.userId}})
  if (!asset) throw new CollectionError("ไม่พบรายการอัปโหลด",404)
  if (asset.status !== "READY") {
    const inspected = await inspectMediaObject(asset)
    const sniffed = sniffMedia(inspected.bytes,asset.purpose)
    if (!sniffed || sniffed !== asset.contentType || inspected.contentType !== asset.contentType || BigInt(inspected.byteSize) !== asset.byteSize) throw new CollectionError("ชนิดหรือขนาดไฟล์ไม่ตรงกับรายการอัปโหลด กรุณาเลือกไฟล์ใหม่")
    await prisma.communityMediaAsset.update({where:{id:asset.id},data:{status:"READY"}})
  }
  return {id:asset.id,url:"/api/community/media/assets/" + asset.id,contentType:asset.contentType,byteSize:Number(asset.byteSize),durationSeconds:asset.durationSeconds}
}

export async function discardMediaUpload(id:string,actor:CommunitySession) {
  const asset = await prisma.communityMediaAsset.findFirst({where:{id,uploaderId:actor.userId,attachedAt:null,voiceLines:{none:{}},themeAudio:{none:{}},themeCover:{none:{}},relationshipEvidence:{none:{}}}})
  if (!asset) return {deleted:false}
  const result = await prisma.communityMediaAsset.deleteMany({where:{id,uploaderId:actor.userId,attachedAt:null,voiceLines:{none:{}},themeAudio:{none:{}},themeCover:{none:{}},relationshipEvidence:{none:{}}}})
  if (result.count) await deleteMediaObject(asset)
  return {deleted:Boolean(result.count)}
}

export async function claimMedia(transaction:Prisma.TransactionClient,id:string | null,characterId:string,actorId:string,purpose:"AUDIO" | "COVER" | "EVIDENCE",start = 0,end:number | null = null) {
  if (!id) return
  await transaction.$queryRaw`SELECT "id" FROM "CommunityMediaAsset" WHERE "id" = ${id} FOR UPDATE`
  const asset = await transaction.communityMediaAsset.findUnique({where:{id}})
  if (!asset || asset.status !== "READY" || asset.purpose !== purpose || (asset.characterId !== null && asset.characterId !== characterId) || (asset.uploaderId !== actorId && !(asset.characterId === characterId && asset.attachedAt))) throw new CollectionError("ไฟล์ไม่ใช่ของตัวละครนี้ หรือยังอัปโหลดไม่เสร็จ",403)
  if (purpose === "AUDIO" && asset.durationSeconds && (start >= asset.durationSeconds || (end !== null && end > asset.durationSeconds + .5))) throw new CollectionError("ช่วงเวลาเกินความยาวไฟล์เสียง")
  await transaction.communityMediaAsset.update({where:{id},data:{characterId,attachedAt:asset.attachedAt || new Date()}})
}

export async function readableMedia(id:string,actor:CommunitySession,staff:boolean) {
  const asset = await prisma.communityMediaAsset.findUnique({where:{id}})
  if (!asset || asset.status !== "READY") throw new CollectionError("ไม่พบไฟล์",404)
  if (!asset.attachedAt) {
    if (asset.uploaderId !== actor.userId) throw new CollectionError("ไม่พบไฟล์",404)
  } else if (!asset.characterId || !await prisma.communityCharacter.findFirst({where:{id:asset.characterId,...(staff ? {} : visibleCharacterWhere(actor.userId))},select:{id:true}})) throw new CollectionError("ไม่พบไฟล์",404)
  return asset
}
