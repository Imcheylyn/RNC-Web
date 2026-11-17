import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const scope = { window:{} };
vm.runInNewContext(readFileSync(new URL("../public/community/rnc/employee-photo.js", import.meta.url), "utf8"), scope);
const photo = scope.window.RNCEmployeePhoto;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < .00001, actual + " ~= " + expected);

test("full-body portraits start at the head rather than the middle of the body", () => {
  const crop = photo.portraitCrop(1200, 3600, { x:300, y:200, width:600, height:3200, headX:650 });
  assert.ok(crop.y <= 200);
  assert.ok(crop.x <= 650 && crop.x + crop.width >= 650);
  assert.ok(crop.y <= 600 && crop.y + crop.height >= 600);
  assert.ok(crop.y + crop.height < 2000);
  near(crop.width / crop.height, 1047 / 1340);
});

test("transparent padding does not pull the suggested crop away from the visible head", () => {
  const crop = photo.portraitCrop(4000, 5000, { x:1400, y:1500, width:800, height:3200, headX:1800 });
  assert.ok(crop.y < 1500);
  assert.ok(crop.y + crop.height > 2000);
  assert.ok(crop.x < 1800 && crop.x + crop.width > 1800);
  assert.ok(crop.height < 1600);
});

test("a saved card crop is reused exactly when the page is reopened", () => {
  const crop = photo.suggest({ width:1047, height:1340 }, true);
  assert.equal(crop.x, 0); assert.equal(crop.y, 0);
  assert.equal(crop.width, 1047); assert.equal(crop.height, 1340);
});

test("zoom keeps the chosen center and the card photo aspect ratio", () => {
  const initial = photo.portraitCrop(1200, 3600);
  const crop = photo.zoomCrop(1200, 3600, initial, 4);
  near(crop.x + crop.width / 2, initial.x + initial.width / 2);
  near(crop.y + crop.height / 2, initial.y + initial.height / 2);
  near(crop.width / crop.height, photo.ASPECT);
});

test("dragging and extreme zoom cannot create empty areas outside the source image", () => {
  const crop = photo.clampCrop(900, 2200, { x:-1000, y:8000, width:700 });
  assert.equal(crop.x, 0);
  near(crop.y + crop.height, 2200);
  for (const zoom of [.01, 999]) {
    const next = photo.zoomCrop(900, 2200, crop, zoom);
    assert.ok(next.x >= 0 && next.y >= 0);
    assert.ok(next.x + next.width <= 900 + .00001);
    assert.ok(next.y + next.height <= 2200 + .00001);
    assert.ok(next.width >= 900 / photo.MAX_ZOOM && next.width <= 900);
  }
});
