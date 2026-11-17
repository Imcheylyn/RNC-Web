import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/community-wardrobe-policy.ts",import.meta.url),"utf8");
const {outputText} = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const policy = await import("data:text/javascript;base64," + Buffer.from(outputText).toString("base64"));
const regular = {ownerId:"owner-a",characterType:"Character",publicationState:"PUBLISHED"};
const id = "b0a47f4c-c215-41a1-bf4e-b4f4087912c4";

test("only the owner of an editable regular character or unlocked staff can manage its wardrobe",() => {
  assert.equal(policy.canManageWardrobe("owner-a",false,regular),true);
  assert.equal(policy.canManageWardrobe("owner-b",false,regular),false);
  assert.equal(policy.canManageWardrobe("owner-b",true,regular),true);
  assert.equal(policy.canManageWardrobe("owner-a",false,{...regular,characterType:"NPC"}),false);
  assert.equal(policy.canManageWardrobe("owner-a",true,{...regular,characterType:"NPC"}),true);
  assert.equal(policy.canManageWardrobe("owner-a",false,{...regular,publicationState:"ARCHIVED"}),false);
  assert.equal(policy.canManageWardrobe("owner-a",false,{...regular,characterType:"Human",publicationState:"DRAFT"}),true);
});

test("wardrobe keys cannot escape their character or address another asset family",() => {
  assert.equal(policy.wardrobeAssetKind("default","image"),"portrait");
  assert.equal(policy.wardrobeAssetKind("default","chibi"),"wardrobe-default-chibi");
  assert.equal(policy.wardrobeAssetKind("default","medium"),"wardrobe-default-medium");
  assert.equal(policy.wardrobeAssetKind(id,"image"),"wardrobe-" + id + "-portrait");
  for (const invalid of ["../portrait","employee-card","skin/../portrait","","default/chibi","%2e%2e"]) assert.throws(() => policy.wardrobeSkinId(invalid));
  for (const valid of ["wardrobe-default-chibi","wardrobe-" + id + "-portrait","wardrobe-" + id + "-chibi","wardrobe-default-medium","wardrobe-" + id + "-medium"]) assert.equal(policy.isWardrobeAssetKind(valid),true);
  for (const other of ["portrait","skill-0","weapon-slot-0","employee-signature","wardrobe-invalid-chibi"]) assert.equal(policy.isWardrobeAssetKind(other),false);
});

test("a stale editor cannot overwrite or delete a newer skin version",() => {
  const updated = new Date("2026-10-29T10:00:00.000Z");
  assert.doesNotThrow(() => policy.assertWardrobeVersion(updated.toISOString(),updated));
  assert.throws(() => policy.assertWardrobeVersion("2026-10-29T09:00:00.000Z",updated),error => error.status === 409);
  assert.throws(() => policy.assertWardrobeVersion(null,updated),error => error.status === 409);
  assert.doesNotThrow(() => policy.assertWardrobeVersion("",null));
  assert.throws(() => policy.assertWardrobeVersion(updated.toISOString(),null),error => error.status === 409);
});

test("skin metadata validates required names while the original outfit keeps its identity",() => {
  assert.deepEqual(policy.wardrobeFields(id,"  Summer  ","  Lore  "),{name:"Summer",description:"Lore"});
  assert.deepEqual(policy.wardrobeFields("default","forged-name",""),{name:"Default",description:""});
  assert.throws(() => policy.wardrobeFields(id," ",""));
  assert.throws(() => policy.wardrobeFields(id,"x".repeat(81),""));
  assert.throws(() => policy.wardrobeFields(id,"Name","x".repeat(5001)));
});

test("image MIME is inferred from bytes and rejects SVG or empty uploads",() => {
  const png = new Uint8Array(24); png.set([137,80,78,71,13,10,26,10]);
  assert.equal(policy.wardrobeImageType(png),"image/png");
  const webp = new Uint8Array(16); webp.set([82,73,70,70]); webp.set([87,69,66,80],8);
  assert.equal(policy.wardrobeImageType(webp),"image/webp");
  assert.equal(policy.wardrobeImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')),null);
  assert.equal(policy.wardrobeImageType(new Uint8Array()),null);
});

test("display scale is validated separately and older clients can preserve the saved scale",() => {
  for (const value of ["50", "100", "150", "200"]) assert.equal(policy.wardrobeImageScale(value),Number(value));
  assert.equal(policy.wardrobeImageScale(null),undefined);
  assert.equal(policy.wardrobeImageScale(undefined),undefined);
  for (const value of ["", " ", "49", "201", "100.5", "NaN", "Infinity", "1e2", "100px", 150, new Blob(["image"])]) {
    assert.throws(() => policy.wardrobeImageScale(value),error => error.status === 400);
  }
});

test("horizontal artwork positions are bounded, rounded, and optional for older clients",() => {
  assert.equal(policy.wardrobeImageOffsetX(null),undefined);
  assert.equal(policy.wardrobeImageOffsetX(undefined),undefined);
  for (const value of ["-100","-12.5","0","28.25","100"]) assert.equal(policy.wardrobeImageOffsetX(value),Number(value));
  assert.equal(policy.wardrobeImageOffsetX("25.125"),25.13);
  for (const value of ["", " ", "NaN", "Infinity", "101", "-100.01", "1e2", "20px", 25, new Blob(["image"])]) assert.throws(() => policy.wardrobeImageOffsetX(value),error => error.status === 400);
});

test("vertical artwork positions are validated independently with the same safe bounds",()=>{
  assert.equal(policy.wardrobeImageOffsetY(null),undefined);
  for(const value of ["-100","-12.5","0","25.125","100"]) assert.equal(policy.wardrobeImageOffsetY(value),Math.round(Number(value)*100)/100||0);
  for(const value of ["", "Infinity", "NaN", "-101", "100.01", new Blob(["image"])]) assert.throws(()=>policy.wardrobeImageOffsetY(value),error=>error.status === 400);
});
