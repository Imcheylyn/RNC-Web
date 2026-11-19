import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import assetUrls from './helpers/community-asset-urls.mjs';

function load(file, dependencies) {
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  vm.runInNewContext(outputText, { module, exports: module.exports, console, require(name) {
    assert(name in dependencies, 'Unexpected dependency: ' + name);
    return dependencies[name];
  } });
  return module.exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
const policy = load('../lib/community-policy.ts', {});
const collectionPolicy = load('../lib/community-collection-policy.ts', {});
const asset = { id:'portrait', kind:'portrait', contentType:'image/webp', storageBucket:'rnc-public', storageKey:'hero/portrait/11111111-1111-4111-8111-111111111111.webp' };
const character = { id:'hero', ownerId:'owner', publicationState:'PUBLISHED', name:'Hero', byname:'Witness', characterType:'Character', position:'Intern', imageLayout:{relationships:{x:70,y:35,scale:1.5}}, updatedAt:new Date('2026-11-19'), assets:[asset] };
const partner = { ...character, id:'partner', name:'Partner', assets:[] };
const relationships = [{ id:'out', sourceId:'hero', targetId:'partner', type:'friend', label:'Friend', note:'Keep this note', version:2, source:character, target:partner, evidence:[{id:'evidence', title:'Keep evidence', imageAssetId:'photo'}] },
  { id:'in', sourceId:'partner', targetId:'hero', type:'family', label:'Family', note:'Keep their perspective', version:3, source:partner, target:character, evidence:[] }];
const voiceLines = [{id:'note', title:'Note', sourceType:'NONE', audioAssetId:null, sourceUrl:null, transcript:'Keep text'},
  {id:'audio', title:'Audio', sourceType:'UPLOAD', audioAssetId:'voice-file', sourceUrl:null}];

function collectionHarness(record = character) {
  const queries = [];
  const api = load('../lib/community-collection.ts', {
    'node:crypto':crypto, '@/lib/db':{prisma:{
      communityCharacter:{findFirst:async query => { queries.push(['character',query]); return record; }},
      communityCharacterRelationship:{findMany:async query => { queries.push(['relationships',query]); return relationships; }},
      communityCharacterVoiceLine:{findMany:async query => { queries.push(['voiceLines',query]); return voiceLines; }},
    }}, '@/lib/community-asset-urls':assetUrls, '@/lib/community-policy':policy,
    '@/lib/community-media':{collectionCharacter:() => { throw Error('Redundant character read'); }},
    '@/lib/community-staff':{audit:() => {}}, '@/lib/community-collection-policy':collectionPolicy,
  });
  return {api,queries};
}

test('collection uses one authorized face read and preserves both perspectives, crop settings, evidence and voice lines', async () => {
  const {api,queries} = collectionHarness();
  const result = plain(await api.getCharacterCollection('hero',{userId:'owner'},false));
  assert.deepEqual(queries.map(([name])=>name), ['character','relationships','voiceLines']);
  assert.deepEqual(plain(queries[0][1].where), {id:'hero',...plain(policy.visibleCharacterWhere('owner'))});
  assert.equal(queries[0][1].select.ownerId,true);
  assert.equal(queries[0][1].select.publicationState,true);
  assert.equal(queries[0][1].select.assets.select.data,undefined);
  assert.equal(result.canEditRelationships,true);
  assert.deepEqual(result.character.imageLayout,character.imageLayout);
  assert.equal(result.character.image,assetUrls.communityAssetUrl(asset,character.updatedAt));
  assert.equal(result.relationships[0].evidence[0].imageUrl,'/api/community/media/assets/photo');
  assert.equal(result.relationships[1].note,'Keep their perspective');
  assert.equal(result.voiceLines[0].transcript,'Keep text');
  assert.equal(result.voiceLines[1].audioUrl,'/api/community/media/assets/voice-file');
  assert.deepEqual(plain(queries[1][1].where.AND[0].OR[0].target.is),plain(policy.visibleCharacterWhere('owner')));
});

test('hidden or missing characters are rejected before relationship or voice queries', async () => {
  const {api,queries} = collectionHarness(null);
  await assert.rejects(api.getCharacterCollection('hidden',{userId:'visitor'},false), error => error.status===404);
  assert.deepEqual(queries.map(([name])=>name),['character']);
});

test('collection permissions still require ownership or unlocked staff, and archived owners cannot edit', async () => {
  const {api} = collectionHarness();
  assert.equal((await api.getCharacterCollection('hero',{userId:'visitor',isStaff:true},false)).canEdit,false);
  assert.equal((await api.getCharacterCollection('hero',{userId:'visitor',isStaff:true},true)).canEdit,true);
  const archived = collectionHarness({...character,publicationState:'ARCHIVED'});
  assert.equal((await archived.api.getCharacterCollection('hero',{userId:'owner'},false)).canEdit,false);
});

function overviewHarness(session, unlocked = false) {
  const queries = [];
  const api = load('../app/api/community/characters/route.ts', {
    'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200,headers:options.headers})}},
    '@/lib/community-auth':{getCommunitySession:async()=>({session}),hasStaffUnlock:()=>unlocked},
    '@/lib/db':{prisma:{
      communityCharacter:{findMany:async query => {queries.push(['characters',query]);return [character,partner];}},
      communityCharacterRelationship:{findMany:async query => {queries.push(['relationships',query]);return relationships.map(({id,sourceId,targetId,type,label})=>({id,sourceId,targetId,type,label}));}},
    }}, '@/lib/community-asset-urls':assetUrls, '@/lib/community-policy':policy,
    '@/lib/community-gallery':{}, '@/lib/community-characters':{},
  });
  return {api,queries};
}
const request = {nextUrl:new URL('https://example.test/api/community/characters?view=relationships')};

test('overview selects compact metadata and uses opt-in R2 display URLs while preserving missing-image fallback', async () => {
  const {api,queries} = overviewHarness({userId:'owner',isStaff:false});
  const response = await api.GET(request);
  assert.equal(response.status,200);
  assert.equal(response.body.characters[0].image,assetUrls.communityAssetDisplayUrl(asset,character.updatedAt));
  assert.equal(response.body.characters[1].image,'');
  assert.equal(queries[0][1].select.assets.select.data,undefined);
  assert.equal(queries[0][1].select.history,undefined);
  assert.deepEqual(plain(queries[0][1].where.AND[0]),plain(policy.visibleCharacterWhere('owner')));
  assert.deepEqual(plain(queries[0][1].where.AND[1]),{characterType:{notIn:['Monster','Enemy']}});
  assert.deepEqual(plain(queries[1][1].where),{sourceId:{in:['hero','partner']},targetId:{in:['hero','partner']}});
  assert.equal(response.headers['Cache-Control'],'no-store');
});

test('overview rejects anonymous reads and does not expand visibility for locked staff', async () => {
  const anonymous = overviewHarness(null);
  assert.equal((await anonymous.api.GET(request)).status,401);
  assert.equal(anonymous.queries.length,0);
  const locked = overviewHarness({userId:'staff',isStaff:true});
  await locked.api.GET(request);
  assert.deepEqual(plain(locked.queries[0][1].where.AND[0]),plain(policy.visibleCharacterWhere('staff')));
  const unlocked = overviewHarness({userId:'staff',isStaff:true},true);
  await unlocked.api.GET(request);
  assert.deepEqual(plain(unlocked.queries[0][1].where.AND[0]),{});
});
