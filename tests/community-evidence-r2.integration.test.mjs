import '../scripts/community-module-loader.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';import dotenv from 'dotenv';
const local=dotenv.parse(readFileSync(new URL('../.env.local',import.meta.url)));if(!['127.0.0.1','localhost','[::1]'].includes(new URL(local.DATABASE_URL).hostname))throw Error('Local database required');Object.assign(process.env,local);
const {prisma}=await import('../lib/db.ts'),media=await import('../lib/community-media.ts'),storage=await import('../lib/r2-media-storage.ts'),collection=await import('../lib/community-collection.ts');
test('R2 evidence photograph uploads, verifies, attaches, reads back and preserves captions',async()=>{
 let user,asset;const characters=[];
 try{
  user=await prisma.communityUser.create({data:{discordId:'evidence-r2-'+randomUUID(),username:'evidence-fixture',displayName:'Evidence fixture'}});const actor={userId:user.id,isStaff:false};
  for(const name of ['A','B'])characters.push(await prisma.communityCharacter.create({data:{name:'Evidence fixture '+name,ownerId:user.id,characterType:'Human',publicationState:'PUBLISHED'}}));
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4N8AAAAASUVORK5CYII=','base64');
  const ticket=await media.beginMediaUpload({characterId:characters[0].id,purpose:'EVIDENCE',contentType:'image/png',byteSize:bytes.length,originalName:'generated-evidence-fixture.png'},actor,false);
  asset=await prisma.communityMediaAsset.findUnique({where:{id:ticket.id}});
  const put=await fetch(ticket.uploadUrl,{method:'PUT',headers:ticket.headers,body:bytes});assert.ok(put.ok,'Evidence R2 PUT status '+put.status);
  const complete=await media.completeMediaUpload({id:ticket.id},actor);assert.equal(complete.contentType,'image/png');
  const preflight=await fetch(ticket.uploadUrl,{method:'OPTIONS',headers:{Origin:'http://localhost:3002','Access-Control-Request-Method':'PUT','Access-Control-Request-Headers':'content-type,if-none-match'}});assert.equal(preflight.headers.get('access-control-allow-origin'),'http://localhost:3002');
  await collection.saveRelationship(characters[0].id,{targetId:characters[1].id,type:'friend',version:0,evidence:[{id:randomUUID(),title:'Evidence photograph',text:'Caption remains after upload',imageAssetId:asset.id},{id:randomUUID(),text:'Second independent note'}]},actor,false);
  const saved=(await collection.getCharacterCollection(characters[0].id,actor,false)).relationships[0];assert.equal(saved.evidence.length,2);assert.equal(saved.evidence[0].text,'Caption remains after upload');assert.equal(saved.evidence[0].imageAssetId,asset.id);
  assert.equal((await media.discardMediaUpload(asset.id,actor)).deleted,false);
  const readable=await media.readableMedia(asset.id,actor,false),response=await fetch(storage.mediaSignedUrl(readable,'GET'));assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
 }finally{
  if(asset)await storage.deleteMediaObject(asset);
  await prisma.communityCharacter.deleteMany({where:{id:{in:characters.map(c=>c.id)}}});
  if(asset)await prisma.communityMediaAsset.deleteMany({where:{id:asset.id}});
  if(user)await prisma.communityUser.delete({where:{id:user.id}});await prisma.$disconnect();
 }
});
