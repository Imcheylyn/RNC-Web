import '../scripts/community-module-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import dotenv from 'dotenv';
const local=dotenv.parse(readFileSync(new URL('../.env.local',import.meta.url)));
if(!local.DATABASE_URL||!['127.0.0.1','localhost','[::1]'].includes(new URL(local.DATABASE_URL).hostname))throw Error('Integration tests require a localhost database');
Object.assign(process.env,local);
const {prisma}=await import('../lib/db.ts');
const api=await import('../lib/community-collection.ts');
const {saveCommunityCharacter,findCommunityCharacter}=await import('../lib/community-characters.ts');
const {readableMedia,discardMediaUpload}=await import('../lib/community-media.ts');
const prefix='collection-test-'+randomUUID(),users=[],characters=[];
const base={title:'Voice',sourceType:'YOUTUBE',youtubeId:'dQw4w9WgXcQ',startSeconds:1.25,endSeconds:8.5,version:0};
let a,b,c;
async function actor(label){const row=await prisma.communityUser.create({data:{discordId:prefix+label,username:label,displayName:label}});users.push(row.id);return {userId:row.id,discordId:row.discordId,username:label,name:label,avatarHash:null,isStaff:false};}
async function character(actor,label){const row=await prisma.communityCharacter.create({data:{name:prefix+label,ownerId:actor.userId,characterType:'Human',race:'Human',position:'Intern',publicationState:'PUBLISHED',weaponData:[{id:'slot-0',name:'Weapon',arcana:'STAR',description:'Preserve',stats:{core:1,mnf:2,scr:3}}],skillDetails:{0:{name:'Keep skill'}}}});characters.push(row.id);return row;}
async function asset(actor,characterId=null,purpose='AUDIO'){return prisma.communityMediaAsset.create({data:{uploaderId:actor.userId,characterId,purpose,status:'READY',originalName:'fixture',contentType:purpose==='AUDIO'?'audio/wav':'image/webp',byteSize:128n,durationSeconds:purpose==='AUDIO'?60:null,storageBucket:'fixture-only',storageKey:'fixture/'+randomUUID()}});}
test('collection integration: ownership, two-way relationships, media preservation and concurrent edits',async t=>{
 try{
  a=await actor('A');b=await actor('B');c=await actor('C');const ca=await character(a,'A'),cb=await character(b,'B');
  await t.test('each owner writes only their own perspective and reads both directions',async()=>{
   await api.saveRelationship(ca.id,{targetId:cb.id,type:'friend',note:'A to B',version:0},a,false);
   await api.saveRelationship(cb.id,{targetId:ca.id,type:'rival',note:'B to A',version:0},b,false);
   const result=await api.getCharacterCollection(ca.id,a,false);assert.equal(result.relationships.length,2);assert.equal(result.character.position,'Intern');assert.equal(result.relationships[0].target.position,'Intern');
   await assert.rejects(api.saveRelationship(ca.id,{targetId:cb.id,type:'enemy',version:1},b,false),e=>e.status===403);
   await api.saveRelationship(ca.id,{targetId:cb.id,version:1},a,false,true);
   assert.equal((await api.getCharacterCollection(ca.id,a,false)).relationships[0].note,'B to A');
  });
  await t.test('hidden targets do not leak into constellation search or incoming data',async()=>{
   await prisma.communityCharacter.update({where:{id:cb.id},data:{publicationState:'DRAFT'}});
   assert.equal((await api.getCharacterCollection(ca.id,a,false)).relationships.length,0);
   assert.ok(!(await api.searchCollectionCharacters(prefix,a,false)).characters.some(x=>x.id===cb.id));
   await prisma.communityCharacter.update({where:{id:cb.id},data:{publicationState:'PUBLISHED'}});
  });
  await t.test('multiple evidence notes and photos persist atomically without overwriting older clients or the other perspective',async()=>{
   const photo=await asset(a,null,'EVIDENCE'),foreign=await asset(b,null,'EVIDENCE');
   const note={id:randomUUID(),title:'Letter',text:'First independent note'},image={id:randomUUID(),title:'Photograph',text:'Keep this caption',imageAssetId:photo.id};
   await api.saveRelationship(ca.id,{targetId:cb.id,type:'friend',note:'Legacy note',version:0,evidence:[note,image]},a,false);
   const own=async()=> (await api.getCharacterCollection(ca.id,a,false)).relationships.find(r=>r.sourceId===ca.id);
   let saved=await own();assert.equal(saved.evidence.length,2);assert.equal(saved.note,'Legacy note');assert.equal(saved.evidence[1].imageUrl,'/api/community/media/assets/'+photo.id);
   await api.saveRelationship(ca.id,{targetId:cb.id,type:'friend',note:'Updated legacy note',version:1},a,false);
   saved=await own();assert.equal(saved.evidence.length,2);assert.equal(saved.version,2);
   await assert.rejects(api.saveRelationship(ca.id,{targetId:cb.id,type:'friend',version:1,evidence:[]},a,false),e=>e.status===409);
   await assert.rejects(api.saveRelationship(ca.id,{targetId:cb.id,type:'friend',note:'Must roll back',version:2,evidence:[{...image,imageAssetId:foreign.id}]},a,false),e=>e.status===403);
   assert.equal((await own()).note,'Updated legacy note');assert.equal((await own()).evidence.length,2);
   await assert.rejects(api.saveRelationship(ca.id,{targetId:cb.id,type:'friend',version:2,evidence:[]},b,false),e=>e.status===403);
   await assert.rejects(api.saveRelationship(cb.id,{targetId:ca.id,type:'rival',version:1,evidence:[note]},b,false),e=>e.status===403);
   await api.saveRelationship(ca.id,{targetId:cb.id,type:'friend',note:'Updated legacy note',version:2,evidence:[image]},a,false);
   saved=await own();assert.equal(saved.evidence.length,1);assert.equal(saved.evidence[0].text,'Keep this caption');
   await api.saveRelationship(ca.id,{targetId:cb.id,type:'friend',note:'Updated legacy note',version:3,evidence:[{...image,title:'Staff-reviewed evidence'}]},c,true);
   assert.equal((await own()).evidence[0].title,'Staff-reviewed evidence');
   assert.equal((await own()).evidence[0].imageAssetId,photo.id);
   assert.equal((await discardMediaUpload(photo.id,a)).deleted,false);
   assert.equal(await prisma.communityMediaAsset.count({where:{id:photo.id,relationshipEvidence:{none:{}}}}),0);
   assert.equal((await api.getCharacterCollection(ca.id,a,false)).relationships.find(r=>r.sourceId===cb.id).note,'B to A');
  });
  let line1,line2;
  await t.test('voice clips can reuse one uploaded file without stealing another users draft',async()=>{
   const audio=await asset(a),foreign=await asset(b);
   line1=await api.saveVoiceLine(ca.id,{...base,sourceType:'UPLOAD',audioAssetId:audio.id},a,false);
   line2=await api.saveVoiceLine(ca.id,{...base,title:'Second clip',sourceType:'UPLOAD',audioAssetId:audio.id,startSeconds:12,endSeconds:20},a,false);
   assert.equal(await prisma.communityCharacterVoiceLine.count({where:{audioAssetId:audio.id}}),2);
   await assert.rejects(api.saveVoiceLine(ca.id,{...base,sourceType:'UPLOAD',audioAssetId:foreign.id},a,false),e=>e.status===403);
   await assert.rejects(readableMedia(foreign.id,a,false),e=>e.status===404);
   await assert.rejects(api.saveVoiceLine(ca.id,{...base,sourceType:'UPLOAD',audioAssetId:audio.id,endSeconds:99},a,false));
  });
  await t.test('voice notes persist without audio and can switch between note and tape',async()=>{
   const transcript='First line\nSecond line';
   const {id}=await api.saveVoiceLine(ca.id,{...base,sourceType:'NONE',transcript},a,false);
   const read=async()=>(await api.getCharacterCollection(ca.id,a,false)).voiceLines.find(line=>line.id===id);
   const note=await read();
   assert.equal(note.sourceType,'NONE');
   assert.equal(note.transcript,transcript);
   assert.equal(note.audioUrl,'');
   assert.equal(note.startSeconds,0);
   assert.equal(note.endSeconds,null);
   await api.saveVoiceLine(ca.id,{...base,id,version:note.version,transcript},a,false);
   const tape=await read();
   assert.equal(tape.sourceType,'YOUTUBE');
   assert.equal(tape.youtubeId,base.youtubeId);
   await api.saveVoiceLine(ca.id,{...base,id,version:tape.version,sourceType:'NONE',transcript},a,false);
   const revised=await read();
   assert.equal(revised.youtubeId,null);
   assert.equal(revised.audioAssetId,null);
   assert.equal(revised.transcript,transcript);
   await api.saveVoiceLine(ca.id,{id,version:revised.version},a,false,true);
  });
  await t.test('reordering is atomic and rejects stale versions',async()=>{
   await api.reorderVoiceLines(ca.id,{order:[{id:line2.id,version:1},{id:line1.id,version:1}]},a,false);
   assert.equal((await api.getCharacterCollection(ca.id,a,false)).voiceLines[0].id,line2.id);
   await assert.rejects(api.reorderVoiceLines(ca.id,{order:[{id:line1.id,version:1},{id:line2.id,version:1}]},a,false),e=>e.status===409);
  });
  await t.test('a basic character save preserves theme, voices, weapons, skills and wardrobe images',async()=>{
   const cover=await asset(a,null,'COVER');await api.saveThemeSong(ca.id,{...base,title:'Theme',coverAssetId:cover.id},a,false);
   for(const kind of ['skill-0','weapon-slot-0','wardrobe-default-chibi'])await prisma.communityCharacterAsset.create({data:{characterId:ca.id,kind,contentType:'image/webp',data:Buffer.from('RIFF0000WEBP')}});
   await prisma.communityCharacterSkin.create({data:{characterId:ca.id,id:'default',name:'Default'}});
   const before=await findCommunityCharacter(ca.id,a.userId);
   await saveCommunityCharacter(a.userId,{name:before.name+' edited',characterType:'Human',race:'Human',position:'Intern',era:'1999',nationalityCode:'XX'},ca.id);
   const after=await prisma.communityCharacter.findUnique({where:{id:ca.id},include:{themeSong:true,voiceLines:true,assets:true,wardrobeSkins:true}});
   assert.equal(after.themeSong.title,'Theme');assert.equal(after.voiceLines.length,2);assert.equal(after.weaponData[0].name,'Weapon');assert.equal(after.assets.length,3);assert.equal(after.wardrobeSkins.length,1);assert.equal(await prisma.communityRelationshipEvidence.count({where:{relationship:{sourceId:ca.id}}}),1);
  });
  await t.test('theme failure rolls back the whole character save and retains previous data',async()=>{
   const before=await prisma.communityCharacter.findUnique({where:{id:ca.id}});
   await assert.rejects(saveCommunityCharacter(a.userId,{name:'Must roll back',characterType:'Human',race:'Human',position:'Intern',themeSong:{...base,version:0}},ca.id));
   assert.equal((await prisma.communityCharacter.findUnique({where:{id:ca.id}})).name,before.name);
  });
  await t.test('new characters and their theme commit together; unauthorized callers cannot delete voices',async()=>{
   const saved=await saveCommunityCharacter(a.userId,{name:prefix+'created-with-theme',characterType:'Human',race:'Human',position:'Intern',era:'1999',nationalityCode:'XX',themeSong:{...base,title:'First theme'}});characters.push(saved.id);
   assert.equal(saved.themeSong.title,'First theme');
   await assert.rejects(api.saveVoiceLine(ca.id,{id:line1.id,version:2},c,false,true),e=>e.status===403);
  });
  await t.test('deleting a character cascades its media references without constraint failures',async()=>{
   await prisma.communityCharacter.delete({where:{id:ca.id}});assert.equal(await prisma.communityCharacterVoiceLine.count({where:{characterId:ca.id}}),0);assert.equal(await prisma.communityMediaAsset.count({where:{characterId:ca.id}}),0);assert.equal(await prisma.communityRelationshipEvidence.count({where:{relationship:{sourceId:ca.id}}}),0);
  });
 }finally{await prisma.communityCharacter.deleteMany({where:{id:{in:characters}}});await prisma.communityMediaAsset.deleteMany({where:{uploaderId:{in:users}}});await prisma.communityUser.deleteMany({where:{id:{in:users}}});await prisma.$disconnect();}
});
