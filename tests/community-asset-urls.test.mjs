import test from "node:test";
import assert from "node:assert/strict";
import urls from "./helpers/community-asset-urls.mjs";

test("the same stored object has one URL across callers and text edits; replacing bytes changes its version", () => {
  const asset = {id:"portrait-1",contentType:"image/png",storageBucket:"published",storageKey:"character/old-uuid.png"};
  const before = urls.communityAssetUrl(asset, new Date("2026-11-01"));
  assert.equal(urls.communityAssetUrl(asset, new Date("2026-11-17")), before);
  assert.notEqual(urls.communityAssetUrl({...asset,storageKey:"character/new-uuid.png"}), before);
  assert.notEqual(urls.communityAssetUrl({...asset,contentType:"image/webp"}), before);
  assert.ok(!before.includes(asset.storageKey), "storage keys must stay internal");
});

test("existing versioned references survive editing but foreign URLs and arbitrary query parameters are rejected", () => {
  for (const value of ["/api/community/assets/photo-1", "/api/community/assets/photo-1?v=123", "/api/community/assets/photo-1?v=abcde0123456789f"]) {
    assert.equal(urls.communityAssetReferenceId(value), "photo-1");
  }
  for (const value of ["https://other.test/api/community/assets/photo-1", "/api/community/assets/photo-1?v=1&x=2", "/api/community/assets/photo-1#x", "/api/community/assets/../photo-1", "/api/community/assets/photo-1?x=2"]) {
    assert.equal(urls.communityAssetReferenceId(value), null);
  }
});
