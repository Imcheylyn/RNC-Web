import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import assetUrls from "./helpers/community-asset-urls.mjs";

const require = createRequire(import.meta.url);
const png = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
const response = { json:(value, init = {}) => new Response(JSON.stringify(value), { ...init, headers:{ "Content-Type":"application/json", ...init.headers } }) };
function route(path, mocks, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions:{ module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022 } });
  const exports = {};
  vm.runInNewContext(compiled.outputText, {
    exports, require:name => {
      if (name in mocks) return mocks[name];
      if (name === "@/lib/community-asset-urls") return assetUrls;
      if (name.startsWith("node:")) return require(name);
      throw new Error("Unexpected dependency: " + name);
    },
    Buffer, File, Blob, Response, Uint8Array, URL, Headers, AbortSignal, console:{ error() {} }, ...globals,
  });
  return exports;
}
function uploadHarness(options = {}) {
  const events = [];
  const session = options.session === undefined ? { userId:"owner", isStaff:false } : options.session;
  const character = options.character === undefined ? { ownerId:"owner", employeeId:"IN 1999 0042 TH" } : options.character;
  const saved = [];
  const transaction = {
    $queryRaw:async () => [],
    communityCharacter:{ findUnique:async () => character },
    communityCharacterAsset:{
      findUnique:async () => options.existing || null,
      upsert:async args => { saved.push(args); events.push("upsert"); if (options.fail) throw new Error("database failed"); return { id:"asset-1" }; },
      deleteMany:async args => { saved.push(args); events.push("delete-signature"); return { count:1 }; },
    },
  };
  const handler = route("../app/api/community/characters/[id]/employee-card/route.ts", {
    "next/server":{ NextResponse:response },
    "@/lib/community-auth":{ getCommunitySession:async () => ({ session }), hasStaffUnlock:() => Boolean(options.unlocked) },
    "@/lib/db":{ prisma:{
      communityCharacter:transaction.communityCharacter,
      $transaction:async callback => { const result = await callback(transaction); events.push("commit"); return result; },
    } },
    "@/lib/r2-storage":{
      isR2StorageConfigured:() => options.r2 !== false,
      uploadR2Asset:async (id, kind) => { events.push("upload:" + kind); return { bucket:"rnc-private", key:"new-key" }; },
      deleteR2Asset:async asset => { events.push("delete:" + asset.key); },
    },
  });
  async function put(kind = "photo", bytes = png, type = "image/png") {
    const form = new FormData();
    form.append(kind, new File([bytes], kind + ".png", { type }));
    return handler.PUT({ formData:async () => form }, { params:Promise.resolve({ id:"character-1" }) });
  }
  return { put, events, saved, remove:() => handler.DELETE({}, { params:Promise.resolve({ id:"character-1" }) }) };
}

test("card writes require a session, the owner or unlocked staff, and an employee ID", async () => {
  for (const [options, expected] of [
    [{ session:null }, 401],
    [{ session:{ userId:"other", isStaff:false } }, 403],
    [{ session:{ userId:"staff", isStaff:true }, unlocked:false }, 403],
    [{ character:{ ownerId:"owner", employeeId:null } }, 409],
  ]) {
    const h = uploadHarness(options);
    assert.equal((await h.put()).status, expected);
    assert.deepEqual(h.events, []);
  }
  assert.equal((await uploadHarness({ session:{ userId:"staff", isStaff:true }, unlocked:true }).put()).status, 200);
});

test("replacing a photo updates its existing slot and removes the old object only after commit", async () => {
  const h = uploadHarness({ existing:{ storageBucket:"rnc-private", storageKey:"old-key" } });
  const result = await h.put();
  assert.equal(result.status, 200);
  assert.equal((await result.json()).image, assetUrls.communityAssetUrl({id:"asset-1",contentType:"image/png",storageBucket:"rnc-private",storageKey:"new-key"}));
  assert.equal(h.saved[0].where.characterId_kind.kind, "employee-card");
  assert.equal(h.saved[0].update.storageKey, "new-key");
  assert.equal(h.saved[0].update.data, null);
  assert.deepEqual(h.events, ["upload:employee-card", "upsert", "commit", "delete:old-key"]);
});

test("signatures use a separate persistent slot so saving does not replace the photo", async () => {
  const h = uploadHarness();
  assert.equal((await h.put("signature")).status, 200);
  assert.equal(h.saved[0].where.characterId_kind.kind, "employee-signature");
  assert.equal(h.saved[0].create.contentType, "image/png");
  assert.deepEqual(h.events, ["upload:employee-signature", "upsert", "commit"]);
});

test("bad signatures and oversized files are rejected before storage writes", async () => {
  for (const [kind, bytes, type, status] of [
    ["signature", new Uint8Array([255,216,255,0]), "image/jpeg", 400],
    ["signature", new Uint8Array(512 * 1024 + 1), "image/png", 413],
    ["photo", new Uint8Array(5 * 1024 * 1024 + 1), "image/png", 413],
    ["photo", png, "image/jpeg", 400],
  ]) {
    const h = uploadHarness();
    assert.equal((await h.put(kind, bytes, type)).status, status);
    assert.deepEqual(h.events, []);
  }
});

test("a failed database save retains the previous image and cleans up the new R2 object", async () => {
  const h = uploadHarness({ fail:true, existing:{ storageBucket:"rnc-private", storageKey:"old-key" } });
  assert.equal((await h.put()).status, 500);
  assert.deepEqual(h.events, ["upload:employee-card", "upsert", "delete:new-key"]);
});

test("local installations without R2 retain the existing database asset fallback", async () => {
  const h = uploadHarness({ r2:false });
  assert.equal((await h.put("signature")).status, 200);
  assert.deepEqual(Array.from(h.saved[0].update.data), Array.from(png));
  assert.equal(h.saved[0].update.storageBucket, null);
});

test("photo and signature endpoints remain private to the owner and unlocked staff", async () => {
  for (const kind of ["employee-card", "employee-signature"]) for (const [userId, isStaff, unlocked, status] of [
    ["owner", false, false, 200], ["other", false, false, 404], ["staff", true, false, 404], ["staff", true, true, 200],
  ]) {
    const handler = route("../app/api/community/assets/[id]/route.ts", {
      "next/server":{ NextResponse:response },
      "@/lib/community-auth":{ getCommunitySession:async () => ({ session:{ userId, isStaff } }), hasStaffUnlock:() => unlocked },
      "@/lib/community-policy":{ visibleCharacterWhere:() => ({}) },
      "@/lib/r2-storage":{ readR2Asset:async () => null },
      "@/lib/db":{ prisma:{ communityCharacterAsset:{ findFirst:async () => ({ kind, character:{ ownerId:"owner" }, contentType:"image/png", data:png }) } } },
    });
    const request = {headers:new Headers(), nextUrl:new URL("https://rnc.test/api/community/assets/asset-1")};
    const result = await handler.GET(request, { params:Promise.resolve({ id:"asset-1" }) });
    assert.equal(result.status, status, kind + ":" + userId + ":" + unlocked);
    if (status === 200) assert.equal(result.headers.get("cache-control"), "private, no-cache");
  }
});

test("R2 places signatures in the private bucket and accepts their object keys", async () => {
  const requests = [];
  const storage = route("../lib/r2-storage.ts", {}, {
    process:{ env:{ R2_ACCOUNT_ID:"a".repeat(32), R2_ACCESS_KEY_ID:"test-key", R2_SECRET_ACCESS_KEY:"test-secret", R2_PUBLIC_BUCKET:"rnc-public", R2_PRIVATE_BUCKET:"rnc-private" } },
    fetch:async url => { requests.push(String(url)); return new Response(null, { status:200 }); },
  });
  const result = await storage.uploadR2Asset("character-1", "employee-signature", "image/png", png, "11111111-1111-4111-8111-111111111111");
  assert.equal(result.bucket, "rnc-private");
  assert.match(requests[0], /\/rnc-private\/character-1\/employee-signature\//);
});

test("signature deletion checks ownership, targets only the signature, and removes its object after commit", async () => {
  const denied = uploadHarness({ session:{ userId:"other", isStaff:false } });
  assert.equal((await denied.remove()).status, 403);
  assert.deepEqual(denied.events, []);
  const h = uploadHarness({ existing:{ storageBucket:"rnc-private", storageKey:"signature-key" } });
  assert.equal((await h.remove()).status, 200);
  assert.equal(h.saved[0].where.kind, "employee-signature");
  assert.deepEqual(h.events, ["delete-signature", "commit", "delete:signature-key"]);
  const absent = uploadHarness();
  assert.equal((await absent.remove()).status, 200);
  assert.deepEqual(absent.events, ["delete-signature", "commit"]);
});

test("editing the character preserves both the ID photo and the saved signature", async () => {
  const assets = [{ id:"photo-1", kind:"employee-card" }, { id:"signature-1", kind:"employee-signature" }, { id:"portrait-1", kind:"portrait", contentType:"image/png", storageBucket:"published", storageKey:"portrait-uuid" }];
  const before = {
    id:"character-1", ownerId:"owner", owner:{ displayName:"Owner" }, characterType:"Human", name:"Test", publicationState:"PUBLISHED",
    rank:4, employeeNumber:42, employeeEnabled:true, employeeId:"IN 1999 0042 XX", heightWeight:"170 / 60",
    assets, roles:[], weaponData:[], imageLayout:{}, createdAt:new Date(), updatedAt:new Date(),
    reviewNote:"Staff review", reviewedAt:new Date("2026-10-25"), reviewedById:"staff-reviewer",
  };
  let saved = before, deletion;
  const transaction = {
    $queryRaw:async () => [], communityUser:{ findUnique:async () => ({ id:"owner" }) },
    communityCharacter:{
      findUnique:async () => before,
      update:async args => { saved = { ...before, ...args.data }; return saved; },
      findUniqueOrThrow:async () => saved,
    },
    communityCharacterAsset:{ findMany:async () => assets, deleteMany:async args => { deletion = args; } },
  };
  const characters = route("../lib/community-characters.ts", {
    "@/generated/prisma/client":{ Prisma:{ DbNull:null } },
    "@/lib/db":{ prisma:{ communityCharacter:transaction.communityCharacter, $transaction:async callback => callback(transaction) } },
    "@/lib/community-staff":{ audit:async () => {} },
    "@/lib/community-wardrobe-policy":route("../lib/community-wardrobe-policy.ts", {}),
    "@/lib/community-frames":{ characterFrameKey:() => "arcana-natural", characterFrameAsset:() => "/frame" },
    "@/lib/community-policy":{
      assertCharacterType:() => {}, canUseHumanWeaponArcana:() => true, canUseUnknownArcana:() => false,
      characterType:value => value, publicOwner:() => "Owner", visibleCharacterWhere:() => ({}), USER_CHARACTER_TYPES:["Character", "Human"],
    },
    "@/lib/community-employment":{
      countryForCode:() => ({ th:"ไม่ระบุ" }), isUnspecifiedNationality:() => true, employeeRequired:() => true, employeeEligible:() => true,
      employeeIdFor:() => "IN 1999 0042 XX", employmentFor:() => ({ enabled:true, ready:true, number:42 }),
    },
    "@/lib/r2-storage":{ isR2StorageConfigured:() => false },
    "@/lib/community-collection":{ serializeThemeSong:() => null, saveThemeSongInTransaction:async () => {} },
    "@/lib/community-collection-policy":{ CollectionError:class extends Error {} },
    "@/lib/r2-media-storage":{ deleteMediaObject:async () => {} },
  });
  const body = { name:"Updated", characterType:"Human", race:"Human", position:"Intern", nationalityCode:"XX", era:"1999", image:assetUrls.communityAssetUrl(assets[2]) };
  const result = await characters.saveCommunityCharacter("owner", body, "character-1");
  assert.deepEqual(Array.from(deletion.where.id.notIn).sort(), ["photo-1", "portrait-1", "signature-1"]);
  assert.equal(result.image, body.image);
  assert.equal(result.employeeCardSignature, assetUrls.communityAssetUrl(assets[1], saved.updatedAt));
  assert.equal(result.employeeCardImage, assetUrls.communityAssetUrl(assets[0], saved.updatedAt));
  assert.equal(result.reviewNote, before.reviewNote);
  assert.equal(saved.reviewedAt, before.reviewedAt);
  assert.equal(saved.reviewedById, before.reviewedById);
  await assert.rejects(characters.saveCommunityCharacter("owner", {...body,image:"/api/community/assets/foreign-portrait?v=123"}, "character-1"), /does not belong/);
  await assert.rejects(characters.saveCommunityCharacter("owner", {...body,image:"/api/community/assets/signature-1?v=123"}, "character-1"), /does not belong/);
});
