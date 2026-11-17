import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const {outputText}=ts.transpileModule(readFileSync(new URL('../lib/community-collection-policy.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const p=await import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));
test('owner or unlocked staff can manage a collection; visitors and archived owners cannot',()=>{
 for(const type of ['Human','Character','NPC']){const c={ownerId:'owner',publicationState:'PUBLISHED',characterType:type};assert.equal(p.canManageCollection('owner',false,c),true);assert.equal(p.canManageCollection('visitor',false,c),false);assert.equal(p.canManageCollection('visitor',true,c),true);}
 assert.equal(p.canManageCollection('owner',false,{ownerId:'owner',publicationState:'ARCHIVED'}),false);
});
test('clip timestamps keep milliseconds and reject invalid times or reversed bounds',()=>{
 assert.equal(p.parseTime('01:24.125'),84.125);assert.equal(p.parseTime('1:02:03.2'),3723.2);assert.equal(p.parseTime('',true),null);
 for(const time of ['-1','1:60','1:2:65','abc',Infinity])assert.throws(()=>p.parseTime(time));
 assert.throws(()=>p.mediaFields({title:'Test',sourceType:'YOUTUBE',youtubeId:'dQw4w9WgXcQ',startSeconds:20,endSeconds:10}));
});
test('YouTube parsing accepts supported URLs without accepting lookalike domains',()=>{
 for(const url of ['https://youtu.be/dQw4w9WgXcQ?t=10','https://www.youtube.com/watch?v=dQw4w9WgXcQ','https://youtube.com/shorts/dQw4w9WgXcQ'])assert.equal(p.youtubeId(url),'dQw4w9WgXcQ');
 for(const url of ['https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ','javascript:alert(1)','https://evil.test/dQw4w9WgXcQ'])assert.throws(()=>p.youtubeId(url));
});
test('switching source clears inactive audio references',()=>{
 const item=p.mediaFields({title:' Theme ',sourceType:'YOUTUBE',youtubeId:'dQw4w9WgXcQ',audioAssetId:'old-file',sourceUrl:'https://example.test/old.mp3'});assert.equal(item.title,'Theme');assert.equal(item.audioAssetId,null);assert.equal(item.sourceUrl,null);
 assert.throws(()=>p.audioUrl('http://example.test/sound.mp3'));assert.throws(()=>p.audioUrl('https://example.test/index.html'));assert.throws(()=>p.mediaFields({title:'File',sourceType:'UPLOAD'}));
});
test('directed relationship input rejects self-relations, unknown types and stale version formats',()=>{
 assert.deepEqual(p.relationshipFields({targetId:'B',type:'friend',label:' Ally ',note:' Story '},'A'),{targetId:'B',type:'friend',label:'Ally',note:'Story'});
 assert.throws(()=>p.relationshipFields({targetId:'A',type:'friend'},'A'));assert.throws(()=>p.relationshipFields({targetId:'B',type:'bogus'},'A'));
 for(const v of [undefined,-1,'1',1.5])assert.throws(()=>p.version(v),e=>e.status===409);
});
test('file headers are validated independently of the supplied MIME type',()=>{
 const b=s=>new TextEncoder().encode(s);assert.equal(p.sniffMedia(b('ID3audio'),'AUDIO'),'audio/mpeg');assert.equal(p.sniffMedia(b('RIFF0000WAVE'),'AUDIO'),'audio/wav');assert.equal(p.sniffMedia(b('RIFF0000WEBP'),'COVER'),'image/webp');assert.equal(p.sniffMedia(b('<svg onload="alert(1)">'),'COVER'),null);assert.equal(p.sniffMedia(new Uint8Array(),'AUDIO'),null);
});

test('evidence accepts independent notes or photos, preserves omitted data, and rejects duplicate or empty records',()=>{
 assert.equal(p.relationshipEvidenceFields(undefined),undefined);
 assert.deepEqual(p.relationshipEvidenceFields([{id:'note-1',title:' Letter ',text:' Story '},{id:'photo-2',imageAssetId:'photo'}]),[
  {id:'note-1',title:'Letter',text:'Story',imageAssetId:null,sortOrder:0},{id:'photo-2',title:'',text:'',imageAssetId:'photo',sortOrder:1}
 ]);
 for(const value of [null,{},[{id:'empty'}],[{id:'same',text:'A'},{id:'same',text:'B'}],[{id:'bad/id',text:'A'}]])assert.throws(()=>p.relationshipEvidenceFields(value));
 assert.equal(p.sniffMedia(new TextEncoder().encode('RIFF0000WEBP'),'EVIDENCE'),'image/webp');
 assert.equal(p.sniffMedia(new TextEncoder().encode('ID3audio'),'EVIDENCE'),null);
});


test('voice lines can omit audio without making theme audio optional',()=>{
 const body={title:'Transcript only',sourceType:'NONE',audioAssetId:'old',youtubeId:'dQw4w9WgXcQ',startSeconds:15,endSeconds:20};
 const voice=p.mediaFields(body,true);assert.equal(voice.sourceType,'NONE');assert.equal(voice.startSeconds,0);assert.equal(voice.endSeconds,null);assert.equal(voice.audioAssetId,null);assert.equal(voice.youtubeId,null);assert.equal(voice.sourceUrl,null);assert.throws(()=>p.mediaFields(body));
});
