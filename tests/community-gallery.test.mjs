import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, createHmac, randomUUID } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import assetUrls from "./helpers/community-asset-urls.mjs";

function compile(file) {
  return ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
function load(file, dependencies, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(compile(file), {
    module, exports: module.exports, require: name => {
      assert.ok(dependencies[name], "Missing dependency " + name);
      return dependencies[name];
    }, ...globals,
  });
  return module.exports;
}
const policy = load("../lib/community-policy.ts", {});
const frames = load("../lib/community-frames.ts", {});
const plain = value => JSON.parse(JSON.stringify(value));
const example = {
  id: "hero", ownerId: "owner", owner: { displayName: "Creator", username: "creator" },
  name: "Arcanist", byname: "The Witness", characterType: "Character",
  publicationState: "PUBLISHED", race: "Pure blood", arcana: "STAR", rank: 6,
  position: "Researcher", archiveCategory: "Character", updatedAt: new Date("2026-11-17"),
  imageLayout: { galleryDesktop: { scale: 1.1, x: 40, y: 60 }, galleryMobile: { scale: 1, x: 30, y: 20 } },
  enemyData: null, history: "Private backstory ".repeat(3000), skillDetails: { ultimate: { description: "Long description" } },
  assets: [
    { id: "portrait", kind: "portrait", contentType: "image/png", storageBucket: "published", storageKey: "hero/portrait/11111111-1111-4111-8111-111111111111.png" },
    { id: "gallery", kind: "gallery", contentType: "image/png", storageBucket: "published", storageKey: "hero/gallery/22222222-2222-4222-8222-222222222222.png" },
  ],
};

test("Gallery selects card data and the same viewer visibility without loading biographies or media relations", async () => {
  let query;
  const api = load("../lib/community-gallery.ts", {
    "@/lib/db": { prisma: { communityCharacter: { findMany: async input => { query = input; return [example]; } } } },
    "@/lib/community-asset-urls": assetUrls,
    "@/lib/community-frames": frames,
    "@/lib/community-policy": policy,
  });
  const [card] = await api.listCommunityGallery("owner");
  assert.deepEqual(plain(query.where), plain(policy.visibleCharacterWhere("owner")));
  assert.deepEqual(plain(query.orderBy), { updatedAt: "desc" });
  assert.equal(query.include, undefined);
  for (const field of ["history", "stats", "skillDetails", "themeSong", "roles", "contact", "reviewNote"]) {
    assert.equal(query.select[field], undefined, field);
    assert.equal(card[field], undefined, field);
  }
  assert.deepEqual(plain(query.select.assets.where), { kind: { in: ["portrait", "gallery"] } });
  assert.equal(query.select.assets.select.data, undefined);
  assert.equal(card.image, assetUrls.communityAssetUrl(example.assets[0], example.updatedAt));
  assert.equal(card.galleryImage, assetUrls.communityAssetUrl(example.assets[1], example.updatedAt));
  assert.equal(card.cardImage, card.galleryImage + "&display=1");
  assert.equal(card.owner, "Creator");
  assert.equal(card.ownerId, "owner");
  assert.deepEqual(plain(card.imageLayout), example.imageLayout);
  assert.equal(card.rank, example.rank);
});

test("Gallery retains Enemy artwork, boss filtering, staff frames and legacy image fallback", async () => {
  const records = [
    { ...example, characterType: "Monster", enemyData: { subtype: "Critter", hp: 120, isBoss: true, notes: "Not used by cards" } },
    { ...example, characterType: "President", archiveCategory: "President" },
    { ...example, assets: [{ ...example.assets[0], storageBucket: null, storageKey: null }] },
  ];
  const api = load("../lib/community-gallery.ts", {
    "@/lib/db": { prisma: { communityCharacter: { findMany: async () => records } } },
    "@/lib/community-asset-urls": assetUrls, "@/lib/community-frames": frames, "@/lib/community-policy": policy,
  });
  const [enemy, president, legacy] = await api.listCommunityGallery("owner");
  assert.ok(enemy.cardImage.includes("/portrait?"));
  assert.deepEqual(plain(enemy.enemyData), { subtype: "Critter", hp: 120, isBoss: true });
  assert.equal(enemy.archiveCategory, "Enemy");
  assert.equal(enemy.frameAsset, "");
  assert.equal(enemy.owner, "");
  assert.equal(enemy.ownerId, null);
  assert.equal(president.rank, 7);
  assert.equal(president.frameKey, frames.characterFrameKey("President", example.race, example.arcana));
  assert.equal(legacy.cardImage, legacy.image);
  assert.ok(!legacy.cardImage.includes("display=1"));
});

function imageApi(asset = {}) {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const stored = {
    ...example.assets[1], character: { ownerId: "owner", publicationState: "PUBLISHED" }, ...asset,
  };
  const queries = [], signed = [];
  let session = { userId: "owner", isStaff: false }, bytesRead = 0;
  const api = load("../app/api/community/assets/[id]/route.ts", {
    "next/server": { NextResponse: { json: (value, init) => new Response(JSON.stringify(value), init) } },
    "node:crypto": { createHash },
    "@/lib/community-auth": { getCommunitySession: async () => ({ session }), hasStaffUnlock: () => false },
    "@/lib/community-policy": policy, "@/lib/community-asset-urls": assetUrls,
    "@/lib/db": { prisma: { communityCharacterAsset: { findFirst: async query => {
      queries.push(query);
      if (query.select.data && !query.select.contentType) return { data: png };
      return stored;
    } } } },
    "@/lib/r2-storage": {
      signedR2ImageUrl: (bucket, key) => { signed.push({ bucket, key }); return "https://r2.example.test/read?expires=900"; },
      readR2Asset: async () => { bytesRead++; return png; },
    },
  }, { Response, Headers, Blob, Uint8Array, console });
  const get = query => api.GET({
    nextUrl: new URL("https://rnc.test/api/community/assets/gallery" + query), headers: new Headers(),
  }, { params: Promise.resolve({ id: "gallery" }) });
  return { get, stored, queries, signed, bytesRead: () => bytesRead, signOut: () => { session = null; } };
}

test("display requests authorize and return a private redirect without reading image bytes from R2 or the database", async () => {
  const h = imageApi();
  const result = await h.get("?v=" + assetUrls.communityAssetVersion(h.stored) + "&display=1");
  assert.equal(result.status, 307);
  assert.equal(result.headers.get("location"), "https://r2.example.test/read?expires=900");
  assert.equal(result.headers.get("cache-control"), "private, max-age=60");
  assert.equal(result.headers.get("vary"), "Cookie");
  assert.equal((await result.arrayBuffer()).byteLength, 0);
  assert.equal(h.queries[0].select.data, false);
  assert.equal(h.bytesRead(), 0);
  assert.equal(h.signed.length, 1);
  h.signOut();
  assert.equal((await h.get("?display=1")).status, 401);
  assert.equal(h.queries.length, 1);
});

test("normal image reads, private signatures, drafts and inline artwork retain the authorized proxy", async () => {
  const normal = imageApi();
  assert.equal((await normal.get("")).status, 200);
  assert.equal(normal.bytesRead(), 1);
  assert.equal(normal.signed.length, 0);
  const draft = imageApi({ character: { ownerId: "owner", publicationState: "DRAFT" } });
  assert.equal((await draft.get("?display=1")).status, 200);
  assert.equal(draft.bytesRead(), 1);
  assert.equal(draft.signed.length, 0);
  const signature = imageApi({ kind: "employee-signature" });
  assert.equal((await signature.get("?display=1")).status, 200);
  assert.equal(signature.signed.length, 0);
  const anotherOwner = imageApi({ kind: "employee-card", character: { ownerId: "someone-else", publicationState: "PUBLISHED" } });
  assert.equal((await anotherOwner.get("?display=1")).status, 404);
  assert.equal(anotherOwner.signed.length, 0);
  const inline = imageApi({ storageBucket: null, storageKey: null });
  assert.equal((await inline.get("?display=1")).status, 200);
  assert.equal(inline.queries.length, 2);
  assert.equal(inline.signed.length, 0);
});

test("signed R2 image delivery has a short GET expiry and excludes private buckets and private asset families", () => {
  const storage = load("../lib/r2-storage.ts", {
    "node:crypto": { createHash, createHmac, randomUUID },
  }, { URL, process: { env: {
    R2_ACCOUNT_ID: "0".repeat(32), R2_ACCESS_KEY_ID: "test-access", R2_SECRET_ACCESS_KEY: "test-secret",
    R2_PUBLIC_BUCKET: "rnc-public", R2_PRIVATE_BUCKET: "rnc-private",
  } } });
  const key = example.assets[1].storageKey;
  const url = new URL(storage.signedR2ImageUrl("rnc-public", key));
  assert.equal(url.hostname, "0".repeat(32) + ".r2.cloudflarestorage.com");
  assert.equal(url.searchParams.get("X-Amz-Expires"), "900");
  assert.equal(url.searchParams.get("X-Amz-SignedHeaders"), "host");
  assert.match(url.searchParams.get("X-Amz-Signature"), /^[a-f0-9]{64}$/);
  assert.equal(storage.signedR2ImageUrl("rnc-private", key), null);
  assert.equal(storage.signedR2ImageUrl("rnc-public", key.replace("/gallery/", "/employee-card/")), null);
  assert.throws(() => storage.signedR2ImageUrl("rnc-public", "../outside.png"));
});
