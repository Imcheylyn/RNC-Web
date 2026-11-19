import { randomUUID } from "node:crypto"
import type { Prisma, CommunityCharacterThemeSong, CommunityCharacterVoiceLine } from "@/generated/prisma/client"
import type { CommunitySession } from "@/lib/community-auth"
import { prisma } from "@/lib/db"
import { communityAssetSelect, communityAssetUrl } from "@/lib/community-asset-urls"
import { visibleCharacterWhere } from "@/lib/community-policy"
import { collectionCharacter, claimMedia } from "@/lib/community-media"
import { audit } from "@/lib/community-staff"
import { canManageCollection, CollectionError, field, isEnemyCharacterType, mediaFields, object, relationshipFields, relationshipEvidenceFields, RELATIONSHIP_TYPES, relationshipTargetTypes, version } from "@/lib/community-collection-policy"

const faceSelect = {id:true,name:true,byname:true,characterType:true,position:true,imageLayout:true,updatedAt:true,assets:{where:{kind:{in:["portrait","gallery"]}},select:communityAssetSelect}} satisfies Prisma.CommunityCharacterSelect
type Face = Prisma.CommunityCharacterGetPayload<{select:typeof faceSelect}>
function face(record:Face) {
  const image = record.assets.find(asset => asset.kind === "portrait") || record.assets[0]
  return {id:record.id,name:record.name,byname:record.byname,characterType:record.characterType,position:record.position,image:communityAssetUrl(image,record.updatedAt),imageLayout:record.imageLayout}
}
const audio = (item:{audioAssetId:string | null;sourceUrl:string | null}) => item.audioAssetId ? "/api/community/media/assets/" + item.audioAssetId : item.sourceUrl || ""
export function serializeThemeSong(item:CommunityCharacterThemeSong | null | undefined) {
  return item ? {...item,audioUrl:audio(item),coverUrl:item.coverAssetId ? "/api/community/media/assets/" + item.coverAssetId : ""} : null
}
export function serializeVoiceLine(item:CommunityCharacterVoiceLine) { return {...item,audioUrl:audio(item)} }

export async function listCharacterThemeSongs(viewerId:string) {
  const records = await prisma.communityCharacter.findMany({
    where:{AND:[visibleCharacterWhere(viewerId),{characterType:{notIn:["Monster","Enemy"]}},{themeSong:{isNot:null}}]},
    select:{id:true,name:true,byname:true,characterType:true,themeSong:true},
    orderBy:[{name:"asc"},{id:"asc"}],
  })
  return records.flatMap(record => record.themeSong ? [{
    ...serializeThemeSong(record.themeSong),
    characterId:record.id,characterName:record.byname || record.name,
    characterFullName:record.name,characterType:record.characterType,
  }] : [])
}

export async function getCharacterCollection(characterId:string,actor:CommunitySession,staff:boolean) {
  const visible = staff ? {} : visibleCharacterWhere(actor.userId)
  // Authorize and read the face in the same query before loading the collection.
  const character = await prisma.communityCharacter.findFirst({
    where:{id:characterId,...visible},
    select:{...faceSelect,ownerId:true,publicationState:true},
  })
  if (!character) throw new CollectionError("ไม่พบตัวละคร",404)
  const [relationships,voiceLines] = await Promise.all([
    prisma.communityCharacterRelationship.findMany({where:{AND:[{OR:[{sourceId:characterId,target:{is:visible}},{targetId:characterId,source:{is:visible}}]},{source:{is:{characterType:{notIn:["Monster","Enemy"]}}}},{target:{is:{characterType:{notIn:["Monster","Enemy"]}}}}]},include:{source:{select:faceSelect},target:{select:faceSelect},evidence:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}]}},orderBy:{createdAt:"asc"}}),
    prisma.communityCharacterVoiceLine.findMany({where:{characterId},orderBy:[{sortOrder:"asc"},{createdAt:"asc"}]}),
  ])
  const canHaveRelationships = !isEnemyCharacterType(character.characterType)
  const canEdit = canManageCollection(actor.userId,staff,character)
  return {character:face(character),isStaff:staff,canEdit,canEditRelationships:canEdit && canHaveRelationships,canHaveRelationships,relationshipTargetTypes:relationshipTargetTypes(character.characterType,staff),types:RELATIONSHIP_TYPES,relationships:canHaveRelationships ? relationships.map(item=>({...item,source:face(item.source),target:face(item.target),evidence:item.evidence.map(entry=>({...entry,imageUrl:entry.imageAssetId ? "/api/community/media/assets/" + entry.imageAssetId : ""}))})) : [],voiceLines:voiceLines.map(serializeVoiceLine)}
}

export async function searchCollectionCharacters(query:string,actor:CommunitySession,staff:boolean,exclude?:string,sourceId?:string) {
  const source = sourceId ? await collectionCharacter(sourceId,actor,staff) : null
  const allowedTypes = source ? relationshipTargetTypes(source.characterType,staff) : null
  if (allowedTypes?.length === 0) return {characters:[]}
  const records = await prisma.communityCharacter.findMany({where:{AND:[{characterType:{notIn:["Monster","Enemy"]}},staff ? {} : visibleCharacterWhere(actor.userId),exclude ? {id:{not:exclude}} : {},allowedTypes ? {characterType:{in:[...allowedTypes]}} : {},query ? {OR:[{name:{contains:query,mode:"insensitive"}},{byname:{contains:query,mode:"insensitive"}}]} : {}]},select:faceSelect,orderBy:[{name:"asc"},{id:"asc"}],take:25})
  return {characters:records.map(face)}
}

async function mutation<T>(characterId:string,actor:CommunitySession,staff:boolean,work:(transaction:Prisma.TransactionClient)=>Promise<T>) {
  await collectionCharacter(characterId,actor,staff,true)
  return prisma.$transaction(async transaction=>{
    await transaction.$queryRaw`SELECT "id" FROM "CommunityCharacter" WHERE "id" = ${characterId} FOR UPDATE`
    const current = await transaction.communityCharacter.findUnique({where:{id:characterId},select:{ownerId:true,publicationState:true,characterType:true}})
    if (!current || !canManageCollection(actor.userId,staff,current)) throw new CollectionError("ไม่มีสิทธิ์แก้ไขข้อมูลตัวละคร",403)
    return work(transaction)
  },{maxWait:10000,timeout:20000})
}

export async function saveRelationship(characterId:string,body:Record<string,unknown>,actor:CommunitySession,staff:boolean,remove = false) {
  const data = remove ? {targetId:field(body.targetId,100,true)} : relationshipFields(body,characterId)
  const expected = version(body.version), evidence = remove ? undefined : relationshipEvidenceFields(body.evidence)
  return mutation(characterId,actor,staff,async transaction=>{
    const current = await transaction.communityCharacter.findUnique({where:{id:characterId},select:{characterType:true}})
    if (!current) throw new CollectionError("ไม่พบตัวละคร",404)
    const allowedTypes = relationshipTargetTypes(current.characterType,staff)
    if (!remove && allowedTypes?.length === 0) throw new CollectionError("ตัวละครประเภท Enemy ไม่มีรายการความสัมพันธ์",403)
    const target = await transaction.communityCharacter.findFirst({where:{id:data.targetId,...(staff ? {} : visibleCharacterWhere(actor.userId))},select:{id:true,characterType:true}})
    if (!target) throw new CollectionError("ไม่พบตัวละครปลายทาง",404)
    if (!remove && isEnemyCharacterType(target.characterType)) throw new CollectionError("ตัวละครประเภท Enemy ไม่เปิดให้มีความสัมพันธ์",403)
    if (!remove && allowedTypes && !allowedTypes.includes(target.characterType)) throw new CollectionError("ประเภทตัวละครนี้ไม่สามารถเพิ่มความสัมพันธ์ได้",403)
    const key = {sourceId_targetId:{sourceId:characterId,targetId:data.targetId}}
    const existing = await transaction.communityCharacterRelationship.findUnique({where:key,include:{evidence:true}})
    if ((existing?.version || 0) !== expected) throw new CollectionError("ความสัมพันธ์นี้มีการแก้ไขแล้ว กรุณาโหลดรายการใหม่",409)
    const previousAssets = [...new Set((existing?.evidence || []).flatMap(item=>item.imageAssetId ? [item.imageAssetId] : []))]
    if (remove) {
      if (previousAssets.length) await transaction.communityMediaAsset.updateMany({where:{id:{in:previousAssets}},data:{updatedAt:new Date()}})
      if (existing) await transaction.communityCharacterRelationship.delete({where:{id:existing.id}})
    } else {
      const fields = relationshipFields(body,characterId)
      const relationship = await transaction.communityCharacterRelationship.upsert({where:key,create:{sourceId:characterId,...fields},update:{...fields,version:{increment:1}}})
      if (evidence !== undefined) {
        const existingIds = new Set((existing?.evidence || []).map(item=>item.id))
        const foreign = await transaction.communityRelationshipEvidence.findFirst({where:{id:{in:evidence.map(item=>item.id)},relationshipId:{not:relationship.id}},select:{id:true}})
        if (foreign) throw new CollectionError("หลักฐานไม่ได้อยู่ในสายสัมพันธ์นี้",403)
        for (const item of evidence) await claimMedia(transaction,item.imageAssetId,characterId,actor.userId,"EVIDENCE")
        await transaction.communityRelationshipEvidence.deleteMany({where:{relationshipId:relationship.id,id:{notIn:evidence.map(item=>item.id)}}})
        for (const item of evidence) {
          const {id,...fields} = item
          if (existingIds.has(id)) await transaction.communityRelationshipEvidence.update({where:{id,relationshipId:relationship.id},data:fields})
          else await transaction.communityRelationshipEvidence.create({data:{id,relationshipId:relationship.id,...fields}})
        }
        const kept = new Set(evidence.map(item=>item.imageAssetId)),released = previousAssets.filter(id=>!kept.has(id))
        if (released.length) await transaction.communityMediaAsset.updateMany({where:{id:{in:released}},data:{updatedAt:new Date()}})
      }
    }
    if (staff) await audit(transaction,actor,remove ? "DELETE" : existing ? "UPDATE" : "CREATE","relationship",existing?.id || characterId,"จัดการความสัมพันธ์ตัวละคร",existing,remove ? null : {...data,evidence})
    return {saved:true}
  })
}

export async function saveVoiceLine(characterId:string,body:Record<string,unknown>,actor:CommunitySession,staff:boolean,remove = false) {
  const id = field(body.id,100) || randomUUID(), expected = version(body.version)
  return mutation(characterId,actor,staff,async transaction=>{
    const existing = await transaction.communityCharacterVoiceLine.findUnique({where:{id}})
    if (existing && existing.characterId !== characterId) throw new CollectionError("ไม่พบ Voice Line",404)
    if ((existing?.version || 0) !== expected) throw new CollectionError("Voice Line มีการแก้ไขแล้ว กรุณาโหลดรายการใหม่",409)
    if (remove) {
      if (existing) await transaction.communityCharacterVoiceLine.delete({where:{id}})
    } else {
      const source = mediaFields(body,true)
      await claimMedia(transaction,source.audioAssetId,characterId,actor.userId,"AUDIO",source.startSeconds,source.endSeconds)
      const sortOrder = Number(body.sortOrder ?? existing?.sortOrder ?? 0)
      if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000) throw new CollectionError("ลำดับ Voice Line ไม่ถูกต้อง")
      const data = {...source,category:field(body.category,80),transcript:field(body.transcript,5000),credit:field(body.credit,160),sortOrder}
      await transaction.communityCharacterVoiceLine.upsert({where:{id},create:{id,characterId,...data},update:{...data,version:{increment:1}}})
    }
    if (staff) await audit(transaction,actor,remove ? "DELETE" : existing ? "UPDATE" : "CREATE","voiceLine",id,"จัดการ Voice Line ของตัวละคร",existing,remove ? null : {title:body.title})
    return {saved:true,id}
  })
}

export async function saveThemeSongInTransaction(transaction:Prisma.TransactionClient,characterId:string,input:unknown,actorId:string) {
  const body = object(input), expected = version(body.version)
  const existing = await transaction.communityCharacterThemeSong.findUnique({where:{characterId}})
  if ((existing?.version || 0) !== expected) throw new CollectionError("Theme Song มีการแก้ไขแล้ว กรุณาเปิดข้อมูลใหม่ก่อนบันทึก",409)
  if (body.remove === true) {
    if (existing) await transaction.communityCharacterThemeSong.delete({where:{characterId}})
    return
  }
  const source = mediaFields(body), coverAssetId = field(body.coverAssetId,100) || null
  await claimMedia(transaction,source.audioAssetId,characterId,actorId,"AUDIO",source.startSeconds,source.endSeconds)
  await claimMedia(transaction,coverAssetId,characterId,actorId,"COVER")
  const data = {...source,coverAssetId,artist:field(body.artist,160)}
  await transaction.communityCharacterThemeSong.upsert({where:{characterId},create:{characterId,...data},update:{...data,version:{increment:1}}})
}

export async function reorderVoiceLines(characterId:string,body:Record<string,unknown>,actor:CommunitySession,staff:boolean) {
  if (!Array.isArray(body.order) || body.order.length > 1000) throw new CollectionError("รายการลำดับเสียงไม่ถูกต้อง")
  const order = body.order.map(value=>{const item=object(value);return {id:field(item.id,100,true),version:version(item.version)}})
  if (new Set(order.map(item=>item.id)).size !== order.length) throw new CollectionError("รายการเสียงซ้ำกัน")
  return mutation(characterId,actor,staff,async transaction=>{
    const current = await transaction.communityCharacterVoiceLine.findMany({where:{characterId},select:{id:true,version:true}})
    if (current.length !== order.length || order.some(item=>!current.some(record=>record.id===item.id && record.version===item.version))) throw new CollectionError("รายการเสียงมีการแก้ไขแล้ว กรุณาโหลดใหม่ก่อนเรียงลำดับ",409)
    for (let index=0;index<order.length;index++) await transaction.communityCharacterVoiceLine.update({where:{id:order[index].id},data:{sortOrder:index,version:{increment:1}}})
    if (staff) await audit(transaction,actor,"UPDATE","voiceLine",characterId,"เรียงลำดับ Voice Lines",current,order)
    return {saved:true}
  })
}

export async function saveThemeSong(characterId:string,body:Record<string,unknown>,actor:CommunitySession,staff:boolean) {
  return mutation(characterId,actor,staff,async transaction=>{
    await saveThemeSongInTransaction(transaction,characterId,body,actor.userId)
    return {saved:true,themeSong:serializeThemeSong(await transaction.communityCharacterThemeSong.findUnique({where:{characterId}}))}
  })
}
