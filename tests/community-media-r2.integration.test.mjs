import '../scripts/community-module-loader.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';import dotenv from 'dotenv';
const local=dotenv.parse(readFileSync(new URL('../.env.local',import.meta.url)));if(!['127.0.0.1','localhost','[::1]'].includes(new URL(local.DATABASE_URL).hostname))throw Error('Local database required');Object.assign(process.env,local);
const {prisma}=await import('../lib/db.ts'),media=await import('../lib/community-media.ts'),storage=await import('../lib/r2-media-storage.ts');
test('R2 real roundtrip: direct upload, verification, overwrite protection, range and CORS',async()=>{
 let user,asset;try{
  user=await prisma.communityUser.create({data:{discordId:'media-roundtrip-'+randomUUID(),username:'media-fixture',displayName:'Media upload fixture'}});const actor={userId:user.id,isStaff:false};
  const bytes=Buffer.alloc(16044);bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(8000,24);bytes.writeUInt32LE(16000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(16000,40);
  const ticket=await media.beginMediaUpload({purpose:'AUDIO',contentType:'audio/wav',byteSize:bytes.length,originalName:'rnc-test-silence.wav',durationSeconds:1},actor,false);asset=await prisma.communityMediaAsset.findUnique({where:{id:ticket.id}});
  const put=await fetch(ticket.uploadUrl,{method:'PUT',headers:ticket.headers,body:bytes});if(!put.ok){const xml=await put.text();throw Error('R2 PUT '+put.status+' '+(xml.match(/<Code>(.*?)<\/Code>/)?.[1]||''));}
  const complete=await media.completeMediaUpload({id:ticket.id},actor);assert.equal(complete.byteSize,bytes.length);
  const overwrite=await fetch(ticket.uploadUrl,{method:'PUT',headers:ticket.headers,body:bytes});assert.equal(overwrite.status,412);
  const range=await fetch(storage.mediaSignedUrl(asset,'GET'),{headers:{Range:'bytes=0-63'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,64);
  const preflight=await fetch(ticket.uploadUrl,{method:'OPTIONS',headers:{Origin:'http://localhost:3002','Access-Control-Request-Method':'PUT','Access-Control-Request-Headers':'content-type,if-none-match'}});console.log('R2 CORS preflight:',preflight.status,preflight.headers.get('access-control-allow-origin')||'missing');assert.equal(preflight.headers.get('access-control-allow-origin'),'http://localhost:3002','R2 bucket needs the provided CORS rule before browser uploads work');
 }finally{if(asset){await storage.deleteMediaObject(asset);await prisma.communityMediaAsset.deleteMany({where:{id:asset.id}});}if(user)await prisma.communityUser.delete({where:{id:user.id}});await prisma.$disconnect();}
});
