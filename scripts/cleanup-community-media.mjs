import './community-module-loader.mjs';
import dotenv from 'dotenv';
import {readFileSync} from 'node:fs';
const args=new Set(process.argv.slice(2)),apply=args.has('--apply');
for(const arg of args)if(!['--apply','--confirm-remote'].includes(arg))throw Error('Usage: node scripts/cleanup-community-media.mjs [--apply] [--confirm-remote]');
dotenv.config({path:new URL('../.env.local',import.meta.url),override:false,quiet:true});
const hostname=new URL(process.env.DATABASE_URL).hostname;
if(apply&&!['localhost','127.0.0.1','[::1]'].includes(hostname)&&!args.has('--confirm-remote'))throw Error('Remote cleanup requires --confirm-remote');
const {prisma}=await import('../lib/db.ts'),{deleteMediaObject}=await import('../lib/r2-media-storage.ts');
const now=Date.now(),where={voiceLines:{none:{}},themeAudio:{none:{}},themeCover:{none:{}},relationshipEvidence:{none:{}},OR:[{attachedAt:null,createdAt:{lt:new Date(now-86400000)}},{attachedAt:{not:null},updatedAt:{lt:new Date(now-7*86400000)}}]};
try{const assets=await prisma.communityMediaAsset.findMany({where,take:500,orderBy:{createdAt:'asc'}});console.log('Database host: '+hostname+'; mode: '+(apply?'APPLY':'DRY RUN'));console.log('Unused media eligible: '+assets.length);let deleted=0;
 if(apply)for(const asset of assets){await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT "id" FROM "CommunityMediaAsset" WHERE "id" = ${asset.id} FOR UPDATE`;
  const current=await tx.communityMediaAsset.findFirst({where:{id:asset.id,...where}});if(!current)return;
  await deleteMediaObject(current);await tx.communityMediaAsset.delete({where:{id:current.id}});deleted++;
 },{timeout:30000});}console.log(apply?'Deleted: '+deleted:'No files or data changed.');
}finally{await prisma.$disconnect();}
