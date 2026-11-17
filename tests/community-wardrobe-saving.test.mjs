import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash, randomUUID} from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import assetUrls from "./helpers/community-asset-urls.mjs";

const compile = file => ts.transpileModule(readFileSync(new URL(file,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const policy = {exports:{}};
vm.runInNewContext(compile("../lib/community-wardrobe-policy.ts"),{exports:policy.exports,module:policy});
const source = compile("../lib/community-wardrobe.ts");
const skinId = "b0a47f4c-c215-41a1-bf4e-b4f4087912c4";
const image = Buffer.from([137,80,78,71,13,10,26,10,...Array(24).fill(23)]);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

function fixture(id = skinId) {
  let tick = Date.parse("2026-11-03T12:00:00Z");
  const character = {id:"local-test",name:"CG fixture",quote:"Original",ownerId:"owner",characterType:"Human",race:"Human",publicationState:"PUBLISHED",updatedAt:new Date(tick)};
  const skins = [{characterId:character.id,id,name:id === "default" ? "Default" : "Original outfit",description:"Original story",imageScale:150,imageOffsetX:10.5,imageOffsetY:-8.25,sortOrder:0,createdAt:new Date(tick),updatedAt:new Date(tick)}];
  const kind = slot => policy.exports.wardrobeAssetKind(id,slot);
  const assets = [
    {id:"art",characterId:character.id,kind:kind("image"),contentType:"image/png",data:Buffer.from(image),storageBucket:null,storageKey:null},
    {id:"chibi",characterId:character.id,kind:kind("chibi"),contentType:"image/png",data:Buffer.from(image),storageBucket:null,storageKey:null},
  ];
  const uploads = [], deleted = [], audits = [];
  const prisma = {
    communityCharacter:{findUnique:async()=>character,findFirst:async()=>({...character,assets,wardrobeSkins:skins}),update:async({data})=>Object.assign(character,data)},
    communityCharacterSkin:{
      findUnique:async({where})=>skins.find(skin=>skin.id === where.characterId_id.id) || null,
      aggregate:async()=>({_max:{sortOrder:skins.length}}),
      upsert:async({where,create,update})=>{let skin=skins.find(skin=>skin.id === where.characterId_id.id);if(skin)Object.assign(skin,update);else{skin={imageScale:100,imageOffsetX:0,imageOffsetY:0,createdAt:new Date(tick),...create};skins.push(skin);}skin.updatedAt=new Date(++tick);return skin;},
      delete:async({where})=>{const index=skins.findIndex(skin=>skin.id === where.characterId_id.id);skins.splice(index,1);},
    },
    communityCharacterAsset:{
      findMany:async({where})=>assets.filter(asset=>where.kind.in.includes(asset.kind)),
      upsert:async({where,create,update})=>{let asset=assets.find(asset=>asset.kind === where.characterId_kind.kind);if(asset)Object.assign(asset,update);else assets.push({id:randomUUID(),...create});},
      deleteMany:async({where})=>{for(let i=assets.length-1;i>=0;i--)if(where.kind.in ? where.kind.in.includes(assets[i].kind) : assets[i].kind === where.kind)assets.splice(i,1);},
    },
    $queryRaw:async()=>[],
    $transaction:async action=>action(prisma),
  };
  const dependencies = {
    "@/lib/community-asset-urls":assetUrls,
    "node:crypto":{randomUUID},
    "@/lib/db":{prisma},
    "@/lib/community-policy":{visibleCharacterWhere:()=>({})},
    "@/lib/community-staff":{audit:async(...args)=>audits.push(args)},
    "@/lib/community-wardrobe-policy":policy.exports,
    "@/lib/r2-storage":{
      isR2StorageConfigured:()=>true,
      uploadR2Asset:async(characterId,kind,contentType,data)=>{uploads.push({characterId,kind,contentType,data:Buffer.from(data)});return {bucket:"test-only",key:randomUUID()};},
      deleteR2Asset:async object=>deleted.push(object),
    },
  };
  const module = {exports:{}};
  vm.runInNewContext(source,{module,exports:module.exports,require:name=>{assert.ok(dependencies[name],name);return dependencies[name];},File,Buffer,console});
  const form = (scale = "200") => {const body=new FormData();body.set("name",skins[0].name);body.set("description",skins[0].description);body.set("expectedUpdatedAt",skins[0].updatedAt.toISOString());if(scale != null)body.set("imageScale",scale);return body;};
  const save = (body,actor={userId:"owner"},staff=false) => module.exports.saveCharacterSkin(character.id,id === "default" ? undefined : id,body,actor,staff);
  const list = () => module.exports.listCharacterWardrobe(character.id,{userId:"owner"},false);
  const remove = () => module.exports.deleteCharacterSkin(character.id,id,skins[0].updatedAt.toISOString(),{userId:"owner"},false);
  return {skins,assets,uploads,deleted,audits,form,save,list,remove,id,kind,character};
}

test("resizing and resizing back retain the exact artwork and Chibi without uploading",async()=>{
  const state=fixture(),artwork=state.assets[0],chibi=state.assets[1];
  const original=hash(artwork.data);
  for(const scale of ["200","50","100"]){
    const result=await state.save(state.form(scale));
    assert.equal(result.skins.find(skin=>skin.id === state.id).imageScale,Number(scale));
    assert.equal(state.assets[0],artwork);assert.equal(hash(artwork.data),original);assert.equal(state.assets[1],chibi);
    assert.equal(state.skins[0].description,"Original story");
  }
  assert.equal(state.uploads.length,0);assert.equal(state.deleted.length,0);
});

test("editing text with an older client preserves saved display size and every image",async()=>{
  const state=fixture(),body=state.form(null);body.set("description","Updated story");
  const result=await state.save(body);
  assert.equal(result.skins.find(skin=>skin.id === state.id).imageScale,150);
  assert.equal(result.skins.find(skin=>skin.id === state.id).imageOffsetX,10.5);
  assert.equal(result.skins.find(skin=>skin.id === state.id).imageOffsetY,-8.25);
  assert.equal(state.skins[0].description,"Updated story");assert.equal(hash(state.assets[0].data),hash(image));assert.equal(state.assets.length,2);assert.equal(state.uploads.length,0);
});

test("Default stores size metadata without replacing the shared character portrait",async()=>{
  const state=fixture("default"),body=state.form("175");body.set("skinId","default");
  const result=await state.save(body);
  assert.equal(result.skins[0].imageScale,175);assert.equal(result.skins[0].isDefault,true);
  assert.equal(state.assets[0].kind,"portrait");assert.equal(hash(state.assets[0].data),hash(image));assert.equal(state.uploads.length,0);
});

test("changing the shared character portrait refreshes its Default wardrobe URL",async()=>{
  const state=fixture("default");
  const before=(await state.list()).skins.find(skin=>skin.id === "default").image;
  state.character.updatedAt=new Date(state.character.updatedAt.getTime()+1000);
  const after=(await state.list()).skins.find(skin=>skin.id === "default").image;
  assert.notEqual(after,before);
  assert.equal(new URL(after,"https://rnc.test").searchParams.get("v"),String(state.character.updatedAt.getTime()));
});

test("R2 artwork keeps the same URL after text and framing edits and matches the shared character URL",async()=>{
  const state=fixture("default"), asset=state.assets[0];
  asset.storageBucket="published";asset.storageKey="character/portrait-old.png";
  const before=(await state.list()).skins[0].image;
  assert.equal(before,assetUrls.communityAssetUrl(asset,state.character.updatedAt));
  const body=state.form("175");body.set("skinId","default");body.set("description","Updated description");
  const updated=await state.save(body);
  assert.equal(updated.skins[0].image,before);
  state.character.updatedAt=new Date(state.character.updatedAt.getTime()+1000);
  assert.equal((await state.list()).skins[0].image,before);
  asset.storageKey="character/portrait-new.png";
  assert.notEqual((await state.list()).skins[0].image,before);
});

test("replacing artwork saves its display size while retaining Chibi",async()=>{
  const state=fixture(),body=state.form("200"),chibi=state.assets[1];
  body.set("image",new File([image],"full-cg.png",{type:"image/png"}));
  await state.save(body);
  assert.equal(state.uploads.length,1);assert.equal(hash(state.uploads[0].data),hash(image));assert.equal(state.skins[0].imageScale,200);assert.equal(state.assets[1],chibi);assert.equal(state.assets.length,2);
});

test("Arcanist Medium uploads, persists for older clients, replaces and removes independently",async()=>{
  const state=fixture();state.character.characterType="Character";
  const body=state.form();body.set("medium",new File([image],"medium.png",{type:"image/png"}));
  const saved=await state.save(body);
  assert.equal(saved.canHaveMedium,true);
  assert.ok(saved.skins.find(skin=>skin.id === state.id).medium.includes("/api/community/assets/"));
  const medium=state.assets.find(asset=>asset.kind === state.kind("medium"));
  const oldKey=medium.storageKey;
  await state.save(state.form());
  assert.equal(medium.storageKey,oldKey);
  const replacement=state.form();replacement.set("medium",new File([image],"changed.png",{type:"image/png"}));
  await state.save(replacement);
  assert.notEqual(medium.storageKey,oldKey);
  assert.ok(state.deleted.some(object=>object.key === oldKey));
  const removal=state.form();removal.set("removeMedium","1");
  await state.save(removal);
  assert.equal(state.assets.length,2);
  assert.equal((await state.list()).skins.find(skin=>skin.id === state.id).medium,"");
  assert.equal(state.assets[0].id,"art");assert.equal(state.assets[1].id,"chibi");
});

test("Staff can save and reload Medium for non-Human NPCs, Presidents and Directors",async()=>{
  for (const [characterType, race] of [["NPC","The Cursed"],["President","Pure blood"],["Director","The Awaken"]]) {
    const state=fixture("default");
    Object.assign(state.character,{characterType,race});
    const body=state.form();
    body.set("skinId","default");
    body.set("medium",new File([image],"medium.png",{type:"image/png"}));
    await assert.rejects(state.save(body),error=>error.status === 403);
    assert.equal(state.uploads.length,0);
    await state.save(body,{userId:"staff"},true);
    const reloaded=await state.list();
    assert.equal(reloaded.canHaveMedium,true,characterType);
    assert.match(reloaded.skins[0].medium,/^\/api\/community\/assets\//);
    assert.equal(state.uploads.length,1);
  }
});

test("Staff cannot upload Medium for Human NPCs or NPCs without a race",async()=>{
  for (const race of ["Human",""]) {
    const state=fixture();
    Object.assign(state.character,{characterType:"NPC",race});
    const body=state.form();
    body.set("medium",new File([image],"medium.png",{type:"image/png"}));
    await assert.rejects(state.save(body,{userId:"staff"},true),error=>error.status === 400);
    assert.equal((await state.list()).canHaveMedium,false);
    assert.equal(state.uploads.length,0);
  }
});

test("Human cannot add or remove Medium and does not receive a Medium image",async()=>{
  const state=fixture();
  const body=state.form();body.set("medium",new File([image],"medium.png",{type:"image/png"}));
  await assert.rejects(state.save(body),error=>error.status === 400);
  const removal=state.form();removal.set("removeMedium","1");
  await assert.rejects(state.save(removal),error=>error.status === 400);
  assert.equal(state.uploads.length,0);
  assert.equal((await state.list()).canHaveMedium,false);
});

test("Default Medium uses its own slot and deleting an outfit removes all three asset families",async()=>{
  const base=fixture("default");base.character.characterType="Character";
  const body=base.form();body.set("skinId","default");body.set("medium",new File([image],"medium.png",{type:"image/png"}));
  await base.save(body);
  assert.ok(base.assets.some(asset=>asset.kind === "wardrobe-default-medium"));
  assert.equal(base.assets[0].kind,"portrait");
  const state=fixture();state.character.characterType="Character";
  const outfit=state.form();outfit.set("medium",new File([image],"medium.png",{type:"image/png"}));
  await state.save(outfit);
  const mediumKey=state.assets.find(asset=>asset.kind === state.kind("medium")).storageKey;
  await state.remove();
  assert.equal(state.assets.length,0);assert.equal(state.skins.length,0);
  assert.ok(state.deleted.some(object=>object.key === mediumKey));
});

test("invalid size, a stale editor, and a different owner cannot mutate artwork or size",async()=>{
  const state=fixture(),original=hash(state.assets[0].data);
  for(const scale of ["0","201","100.5"]){await assert.rejects(state.save(state.form(scale)),error=>error.status === 400);}
  const stale=state.form("200");stale.set("expectedUpdatedAt","2026-11-02T00:00:00Z");
  await assert.rejects(state.save(stale),error=>error.status === 409);
  await assert.rejects(state.save(state.form("200"),{userId:"someone-else"}),error=>error.status === 403);
  assert.equal(state.skins[0].imageScale,150);assert.equal(hash(state.assets[0].data),original);assert.equal(state.uploads.length,0);assert.equal(state.audits.length,0);
});

test("horizontal positioning persists and can be reset without replacing artwork or Chibi",async()=>{
  for(const id of [skinId,"default"]){
    const state=fixture(id),original=hash(state.assets[0].data),chibi=state.assets[1];
    for(const offset of ["25.125","-30.5","0"]){
      const body=state.form(null);body.set("imageOffsetX",offset);if(id === "default")body.set("skinId","default");
      const result=await state.save(body),saved=result.skins.find(skin=>skin.id === id);
      assert.equal(saved.imageOffsetX,Math.round(Number(offset)*100)/100||0);assert.equal(saved.imageScale,150);
      assert.equal(hash(state.assets[0].data),original);assert.equal(state.assets[1],chibi);
    }
    assert.equal(state.uploads.length,0);assert.equal(state.deleted.length,0);
    const invalid=state.form(null);invalid.set("imageOffsetX","101");if(id === "default")invalid.set("skinId","default");
    await assert.rejects(state.save(invalid),error=>error.status === 400);assert.equal(state.skins[0].imageOffsetX,0);
  }
});

test("both axes persist independently and vertical edits preserve artwork, Chibi and horizontal position",async()=>{
  for(const id of [skinId,"default"]){
    const state=fixture(id),original=hash(state.assets[0].data),chibi=state.assets[1];
    for(const offset of ["35.25","-27.125","0"]){
      const body=state.form(null);body.set("imageOffsetY",offset);if(id === "default")body.set("skinId","default");
      const result=await state.save(body),saved=result.skins.find(skin=>skin.id===id);
      assert.equal(saved.imageOffsetY,Math.round(Number(offset)*100)/100||0);assert.equal(saved.imageOffsetX,10.5);assert.equal(saved.imageScale,150);
      assert.equal(hash(state.assets[0].data),original);assert.equal(state.assets[1],chibi);
    }
    assert.equal(state.uploads.length,0);assert.equal(state.deleted.length,0);
  }
});
