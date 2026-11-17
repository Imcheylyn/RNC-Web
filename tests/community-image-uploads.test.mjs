import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import assetUrls from "./helpers/community-asset-urls.mjs";

const editor = readFileSync(new URL("../public/community/rnc/editor.js", import.meta.url), "utf8");
const wardrobe = readFileSync(new URL("../public/community/rnc/wardrobe.js", import.meta.url), "utf8");
const wardrobeScene = readFileSync(new URL("../public/community/rnc/wardrobe-scene.js", import.meta.url), "utf8");
function functionSource(source, name) {
  const parsed = ts.createSourceFile("script.js", source, ts.ScriptTarget.Latest, true);
  let match;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) match = node.getText(parsed);
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.ok(match, name);
  return match;
}
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4N8AAAAASUVORK5CYII=", "base64");

function statement(source, prefix) {
  const parsed = ts.createSourceFile("script.js", source, ts.ScriptTarget.Latest, true);
  let match;
  function visit(node) {
    if (ts.isExpressionStatement(node) && node.getText(parsed).startsWith(prefix)) match = node.getText(parsed);
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.ok(match, prefix);
  return match;
}

function element() {
  const classes = new Set();
  return {
    disabled: false, textContent: "บันทึกตัวละคร", value: "", dataset: {}, handlers: {},
    classList: {add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name)},
    addEventListener(name, handler) { this.handlers[name] = handler; },
    setAttribute() {}, removeAttribute() {},
  };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}

function editorFixture() {
  const save = element(), file = element(), remove = element(), crop = element();
  const skill = element(), removeSkill = element();
  skill.dataset.skillEditorInput = "0";
  removeSkill.dataset.skillEditorRemove = "0";
  const form = element();
  form.querySelectorAll = () => [];
  form.elements = new Proxy({}, {get: () => ({value: "", checked: false})});
  const requests = [], decodes = [], errors = [];
  const context = vm.createContext({
    Error, AbortSignal, console,
    form, fileInput: file, typeSelect: {value: "Character"},
    document: {
      getElementById: id => ({saveCharacter: save, removePortrait: remove, applyCrop: crop})[id],
      querySelectorAll: selector => selector === "[data-skill-editor-input]" ? [skill]
        : selector === "[data-skill-editor-remove]" ? [removeSkill] : [],
    },
    window: {RNCImageLayout: {normalize: () => ({})}, RNCCharacterStore: {getRank: () => 1, add() {}}, RNCNavigate() {}},
    portraitImage: "/api/community/assets/old", galleryImage: "", galleryCrop: null, imageLayout: {}, cropLoadSerial: 0,
    skillImages: ["old-skill"], skillImageCrops: [], removedSkillImages: new Set(), removedWeaponImages: new Set(),
    normalizeSkillCrop: () => ({}), updatePreview() {}, updateCropButton() {}, updateImageLayoutPreview() {}, updateSkillPreviews() {}, openCrop() {},
    setError: value => errors.push(value),
    scaleImage: selected => { const job = deferred(); decodes.push({file: selected, ...job}); return job.promise; },
    textFields: [], template: {stats: []}, staffEditorMode: false, SKILL_CROP_KEYS: [],
    existingId: "fixture", isLegacyExisting: false, existing: {id: "fixture", updatedAt: "previous"}, collectHumanWeapons: () => [],
    fetch: async (url, options) => { requests.push(JSON.parse(options.body)); return {ok: true, json: async () => ({character: {id: "fixture"}})}; },
  });
  vm.runInContext(editor.slice(editor.indexOf("const imagePreparationJobs"), editor.indexOf("let previousArcana")), context);
  for (const prefix of [
    'fileInput.addEventListener("change"',
    'document.querySelectorAll("[data-skill-editor-input]")',
    'document.querySelectorAll("[data-skill-editor-remove]")',
    'document.getElementById("removePortrait").addEventListener',
    'form.addEventListener("submit"',
  ]) vm.runInContext(statement(editor, prefix), context);
  const select = chosen => { file.files = [chosen]; return file.handlers.change(); };
  return {context, save, file, remove, skill, removeSkill, form, requests, decodes, errors, select};
}

test("saving during portrait preparation waits for the selected image, then sends the new bytes", async () => {
  const fixture = editorFixture();
  const preparing = fixture.select({name: "new.png"});
  assert.equal(fixture.save.disabled, true);
  await fixture.form.handlers.submit({preventDefault() {}});
  assert.equal(fixture.requests.length, 0);
  fixture.decodes[0].resolve("data:image/png;base64,NEW");
  await preparing;
  assert.equal(fixture.save.disabled, false);
  await fixture.form.handlers.submit({preventDefault() {}});
  assert.equal(fixture.requests[0].image, "data:image/png;base64,NEW");
});

test("choosing another portrait or removing it prevents an older decode from restoring the wrong image", async () => {
  const fixture = editorFixture();
  const first = fixture.select({name: "first.png"});
  const second = fixture.select({name: "second.png"});
  fixture.decodes[1].resolve("second-image");
  await second;
  fixture.decodes[0].resolve("first-image");
  await first;
  assert.equal(fixture.context.portraitImage, "second-image");
  const third = fixture.select({name: "removed.png"});
  fixture.remove.handlers.click();
  fixture.decodes[2].resolve("removed-image");
  await third;
  assert.equal(fixture.context.portraitImage, "");
  assert.equal(fixture.save.disabled, false);
});

test("replacing or reselecting a portrait keeps staff layout and clears the generated gallery crop", async () => {
  const fixture = editorFixture();
  const layout = { profile: { scale: 1.4, x: 28, y: 62 } };
  fixture.context.imageLayout = layout;
  fixture.context.galleryImage = "/old-gallery";
  fixture.context.galleryCrop = { zoom: 2, x: 4, y: 10 };
  const file = { name: "portrait.png" };
  fixture.file.value = file.name;
  const preparing = fixture.select(file);
  assert.equal(fixture.file.value, "");
  fixture.decodes[0].resolve("replacement-image");
  await preparing;
  assert.equal(fixture.context.imageLayout, layout);
  assert.equal(fixture.context.galleryImage, "");
  assert.equal(fixture.context.galleryCrop, null);
  fixture.remove.handlers.click();
  assert.equal(fixture.context.imageLayout, layout);
});

test("submitting an editor link whose record is missing cannot create a duplicate", async () => {
  const fixture = editorFixture();
  fixture.context.existingId = "oc-missing";
  fixture.context.existing = null;
  await fixture.form.handlers.submit({preventDefault() {}});
  assert.equal(fixture.requests.length, 0);
  assert.match(fixture.errors.at(-1), /ไม่พบตัวละคร/);
});

test("save stays disabled until every image slot finishes, and removing a pending skill cancels its result", async () => {
  const fixture = editorFixture();
  const portrait = fixture.select({name: "portrait.png"});
  fixture.skill.files = [{name: "skill.png"}];
  const skill = fixture.skill.handlers.change();
  fixture.decodes[0].resolve("new-portrait");
  await portrait;
  assert.equal(fixture.save.disabled, true);
  fixture.removeSkill.handlers.click();
  fixture.decodes[1].resolve("canceled-skill");
  await skill;
  assert.equal(fixture.context.skillImages[0], "");
  assert.equal(fixture.save.disabled, false);
});

test("a failed image preparation or save can be retried without leaving the editor locked", async () => {
  const fixture = editorFixture();
  const failed = fixture.select({name: "broken.png"});
  fixture.decodes[0].reject(new Error("Cannot decode"));
  await failed;
  assert.equal(fixture.context.portraitImage, "/api/community/assets/old");
  assert.equal(fixture.save.disabled, false);
  assert.equal(fixture.errors.at(-1), "Cannot decode");
  fixture.context.fetch = async () => { throw new Error("Connection lost"); };
  await fixture.form.handlers.submit({preventDefault() {}});
  assert.equal(fixture.form.inert, false);
  assert.equal(fixture.save.disabled, false);
  assert.equal(fixture.save.classList.contains("is-saving"), false);
});

test("weapon selection keeps the latest image even when an older file finishes later", async () => {
  const fixture = editorFixture();
  const input = element();
  const weapon = {id: "weapon-1", image: "old"};
  Object.assign(fixture.context, {file: input, weapon, humanWeapons: [weapon], renderHumanWeapons() {}});
  vm.runInContext(statement(editor, 'file.addEventListener("change"'), fixture.context);
  input.files = [{name: "first.png"}];
  const first = input.handlers.change();
  input.files = [{name: "second.png"}];
  const second = input.handlers.change();
  fixture.decodes[1].resolve("second-weapon");
  await second;
  fixture.decodes[0].resolve("first-weapon");
  await first;
  assert.equal(weapon.image, "second-weapon");
  assert.equal(fixture.save.disabled, false);
});

test("Gallery preparation blocks saving and cannot restore a crop after its portrait was removed", async () => {
  const fixture = editorFixture();
  const prepared = deferred();
  const crop = element();
  Object.assign(fixture.context, {
    drawCrop() {}, cropEnemyLayout: null, cropCanvas: {}, cropZoom: {value: "1"}, cropOffsetX: 0, cropOffsetY: 0,
    compressCanvas: () => prepared.promise, cropDialog: {close() {}},
  });
  const originalLookup = fixture.context.document.getElementById;
  fixture.context.document.getElementById = id => id === "applyCrop" ? crop : originalLookup(id);
  vm.runInContext(statement(editor, 'document.getElementById("applyCrop").addEventListener'), fixture.context);
  const pending = crop.handlers.click.call(crop);
  assert.equal(fixture.save.disabled, true);
  fixture.remove.handlers.click();
  prepared.resolve("obsolete-gallery");
  await pending;
  assert.equal(fixture.context.galleryImage, "");
  assert.equal(fixture.save.disabled, false);
});

function wardrobeFixture({fallback = false, decodeError = false} = {}) {
  let released = 0;
  const context = vm.createContext({
    Error, Uint8Array, File, Blob, setTimeout, clearTimeout,
    URL: {createObjectURL: () => "blob:fixture", revokeObjectURL: () => released++},
    Image: class {
      naturalWidth = 800;
      naturalHeight = 600;
      set src(value) { queueMicrotask(() => decodeError ? this.onerror() : this.onload()); }
    },
    createImageBitmap: fallback ? async () => { throw new Error("Bitmap decoder unavailable"); }
      : async () => ({width: 800, height: 600, close: () => released++}),
    document: {createElement: () => ({getContext: () => ({drawImage() {}}), toBlob: callback => callback(new Blob([png], {type: "image/png"}))})},
  });
  const start = wardrobe.indexOf("  async function decodeWardrobeImage(");
  const end = wardrobe.indexOf("  function syncOutfitPreview(", start);
  vm.runInContext(wardrobe.slice(start, end), context);
  return {context, released: () => released};
}

test("wardrobe accepts valid PNG bytes when the browser reports an empty or incorrect MIME type", async () => {
  const fixture = wardrobeFixture();
  for (const type of ["", "application/octet-stream", "image/png"]) {
    const file = new File([png], "portrait.png", {type});
    const result = await fixture.context.prepareImage(file, false);
    assert.equal(result.type, "image/png");
    assert.deepEqual(Buffer.from(await result.arrayBuffer()), png);
  }
  assert.equal(fixture.released(), 3);
});

test("wardrobe uses the image-element fallback for artwork and Chibi and releases temporary URLs", async () => {
  const fixture = wardrobeFixture({fallback: true});
  for (const chibi of [false, true]) {
    const result = await fixture.context.prepareImage(new File([png], "image.png"), chibi);
    assert.equal(result.type, "image/png");
  }
  assert.equal(fixture.released(), 2);
  const broken = wardrobeFixture({fallback: true, decodeError: true});
  await assert.rejects(broken.context.prepareImage(new File([png], "broken.png"), true), /เปิดรูปนี้ไม่ได้/);
  assert.equal(broken.released(), 1);
});

test("wardrobe rejects empty files and disguised non-image content", async () => {
  const fixture = wardrobeFixture();
  await assert.rejects(fixture.context.prepareImage(new File([], "empty.png", {type: "image/png"}), false));
  await assert.rejects(fixture.context.prepareImage(new File(["<svg onload='alert(1)'>"], "fake.png", {type: "image/png"}), false), /PNG, JPEG/);
});

test("the wardrobe file-picker handler accepts artwork, Chibi and Medium without a reported MIME type", async () => {
  const fixture = wardrobeFixture();
  const controls = new Map();
  Object.assign(fixture.context, {
    jobs: {image: 0, chibi: 0, medium: 0}, processing: {image: false, chibi: false, medium: false}, form: {hidden: false},
    pendingImage: null, pendingChibi: null, pendingMedium: null, canHaveMedium: true, busy: false,
    updateControls() {}, status(message, failed) { assert.ok(!failed, message); }, t: key => key,
    syncOutfitPreview() {}, preview() {},
    $: id => { if (!controls.has(id)) controls.set(id, {}); return controls.get(id); },
  });
  vm.runInContext(functionSource(wardrobe, "chooseImage"), fixture.context);
  const file = new File([png], "untyped.png");
  await fixture.context.chooseImage("image", {files: [file]});
  await fixture.context.chooseImage("chibi", {files: [file]});
  await fixture.context.chooseImage("medium", {files: [file]});
  assert.equal(fixture.context.pendingImage, file);
  assert.equal(fixture.context.pendingChibi.type, "image/png");
  assert.equal(fixture.context.pendingMedium.type, "image/png");
  assert.equal(fixture.context.processing.image, false);
  assert.equal(fixture.context.processing.chibi, false);
  assert.equal(fixture.context.processing.medium, false);
});

test("scene and wardrobe Chibi and Medium follow the selected outfit and clear missing accessories", () => {
  const image = () => ({hidden: true, src: "", removeAttribute() { this.src = ""; }});
  const context = vm.createContext({
    sceneAccessories: {hidden: true}, sceneChibi: image(), sceneMedium: image(), canHaveMedium: true,
    sceneChibiButton: element(), sceneMediumButton: element(), language: "th",
    wardrobeAccessories: {hidden: true}, wardrobeChibi: image(), wardrobeMedium: image(),
    wardrobeChibiButton: element(), wardrobeMediumButton: element(),
  });
  vm.runInContext(functionSource(wardrobeScene, "syncSkinAccessories").replace("syncSkinAccessories", "syncSceneAccessories"), context);
  vm.runInContext(functionSource(wardrobe, "syncSkinAccessories"), context);
  const sync = context.syncSkinAccessories;
  context.syncSkinAccessories = skin => { context.syncSceneAccessories(skin); sync(skin); };
  context.syncSkinAccessories({name: "Outfit A", chibi: "/a-chibi.png", medium: "/a-medium.png"});
  assert.equal(context.sceneChibi.src, "/a-chibi.png");
  assert.equal(context.sceneMedium.src, "/a-medium.png");
  assert.equal(context.sceneChibiButton.hidden, false);
  assert.equal(context.sceneMediumButton.hidden, false);
  assert.equal(context.sceneAccessories.hidden, false);
  assert.equal(context.wardrobeChibi.src, "/a-chibi.png");
  assert.equal(context.wardrobeMedium.src, "/a-medium.png");
  assert.equal(context.wardrobeChibiButton.hidden, false);
  assert.equal(context.wardrobeMediumButton.hidden, false);
  assert.equal(context.wardrobeAccessories.hidden, false);
  context.syncSkinAccessories({name: "Outfit B"});
  assert.equal(context.sceneChibi.hidden, true);
  assert.equal(context.sceneMedium.hidden, true);
  assert.equal(context.sceneChibiButton.hidden, true);
  assert.equal(context.sceneMediumButton.hidden, true);
  assert.equal(context.sceneChibi.src, "");
  assert.equal(context.sceneMedium.src, "");
  assert.equal(context.sceneAccessories.hidden, true);
  assert.equal(context.wardrobeChibi.src, "");
  assert.equal(context.wardrobeMedium.src, "");
  assert.equal(context.wardrobeChibiButton.hidden, true);
  assert.equal(context.wardrobeMediumButton.hidden, true);
  assert.equal(context.wardrobeAccessories.hidden, true);
  context.syncSkinAccessories({name: "Medium only", medium: "/medium-only.png"});
  assert.equal(context.wardrobeChibiButton.hidden, true);
  assert.equal(context.wardrobeMedium.src, "/medium-only.png");
  assert.equal(context.wardrobeMediumButton.hidden, false);
  assert.equal(context.wardrobeAccessories.hidden, false);
  context.canHaveMedium = false;
  context.syncSkinAccessories({name: "Human outfit", chibi: "/human-chibi.png", medium: "/unused.png"});
  assert.equal(context.sceneChibi.hidden, false);
  assert.equal(context.sceneMedium.hidden, true);
  assert.equal(context.sceneMedium.src, "");
  assert.equal(context.wardrobeChibi.src, "/human-chibi.png");
  assert.equal(context.wardrobeMedium.hidden, true);
  assert.equal(context.wardrobeMedium.src, "");
  assert.equal(context.wardrobeMediumButton.hidden, true);
});

test("scene artwork opens the selected outfit in the shared viewer without opening the wardrobe", () => {
  let skin = {name: "Outfit A", chibi: "/a-chibi.png", medium: "/a-medium.png"};
  const title = element();
  const context = vm.createContext({
    activeSkin: () => skin, canHaveMedium: true, opened: false,
    chibiArtwork: {}, chibiError: {hidden: false},
    chibiDialog: {open: false, showModal() { this.open = true; }},
    $: id => { assert.equal(id, "wardrobeChibiTitle"); return title; },
  });
  vm.runInContext(functionSource(wardrobeScene, "showSkinArtwork"), context);
  for (const slot of ["chibi", "medium"]) {
    context.chibiDialog.open = false;
    context.showSkinArtwork(slot);
    assert.equal(context.chibiDialog.open, true);
    assert.equal(context.chibiArtwork.src, skin[slot]);
    assert.equal(context.chibiArtwork.alt, title.textContent);
    assert.match(title.textContent, new RegExp(slot, "i"));
    assert.equal(context.chibiError.hidden, true);
    assert.equal(context.chibiArtwork.hidden, false);
  }
  context.chibiDialog.open = false;
  skin = {name: "Outfit B", chibi: "/b-chibi.png"};
  context.showSkinArtwork("chibi");
  assert.equal(context.chibiArtwork.src, "/b-chibi.png");
  context.chibiDialog.open = false;
  context.showSkinArtwork("medium");
  assert.equal(context.chibiDialog.open, false);
  context.canHaveMedium = false;
  skin.medium = "/not-for-humans.png";
  context.showSkinArtwork("medium");
  assert.equal(context.chibiDialog.open, false);
});

test("portrait compression rejects an oversized result instead of sending it to the API", async () => {
  let conversions = 0;
  const context = vm.createContext({
    document: {createElement: () => ({getContext: () => ({drawImage() {}})})},
    canvasToBlob: async () => ({size: 2 * 1024 * 1024, type: "image/png"}),
    blobToDataUrl: () => { conversions++; return "oversized"; },
  });
  vm.runInContext(editor.slice(editor.indexOf("async function compressCanvas("), editor.indexOf("async function scaleImage(")), context);
  await assert.rejects(context.compressCanvas({width: 800, height: 600}, "image/webp", .9, 300 * 1024));
  assert.equal(conversions, 0);
});

test("only the current R2 version caches privately; replacements, private images and inline images revalidate", async () => {
  const source = readFileSync(new URL("../app/api/community/assets/[id]/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  const fixture = {kind: "portrait", character: {ownerId: "owner", publicationState: "PUBLISHED"}, contentType: "image/png", data: png};
  let reads = 0;
  const dependencies = {
    "@/lib/community-asset-urls": assetUrls,
    "node:crypto": {createHash},
    "next/server": {NextResponse: {json: (value, init) => new Response(JSON.stringify(value), init)}},
    "@/lib/community-auth": {getCommunitySession: async () => ({session: {userId: "owner", isStaff: false}})},
    "@/lib/community-policy": {visibleCharacterWhere: () => ({})},
    "@/lib/r2-storage": {readR2Asset: async () => { reads++; return png; }},
    "@/lib/db": {prisma: {communityCharacterAsset: {findFirst: async () => fixture}}},
  };
  const api = {exports: {}};
  vm.runInNewContext(compiled, {exports: api.exports, require: name => dependencies[name], Headers, Response, Blob, Uint8Array, console});
  const request = suffix => ({headers: new Headers(), nextUrl: new URL("https://rnc.test/api/community/assets/photo" + suffix)});
  const context = {params: Promise.resolve({id: "photo"})};
  const first = await api.exports.GET(request(""), context);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), "private, no-cache");
  fixture.data = Buffer.concat([png, Buffer.from("new-version")]);
  const revalidate = request("");
  revalidate.headers.set("if-none-match", first.headers.get("etag"));
  const replaced = await api.exports.GET(revalidate, context);
  assert.equal(replaced.status, 200);
  assert.notEqual(replaced.headers.get("etag"), first.headers.get("etag"));
  assert.equal((await api.exports.GET(request("?v=2"), context)).headers.get("cache-control"), "private, no-cache");
  fixture.storageBucket = "published"; fixture.storageKey = "objects/current.png";
  const version = assetUrls.communityAssetVersion(fixture);
  const remote = await api.exports.GET(request("?v=" + version), context);
  assert.equal(remote.status, 200);
  assert.equal(remote.headers.get("cache-control"), "private, max-age=60");
  assert.equal(reads, 1);
  const cached = request("?v=" + version);
  cached.headers.set("if-none-match", remote.headers.get("etag"));
  assert.equal((await api.exports.GET(cached, context)).status, 304);
  assert.equal(reads, 1, "304 must not download R2 bytes");
  fixture.storageKey = "objects/replacement.png";
  const replacement = await api.exports.GET(cached, context);
  assert.equal(replacement.status, 200);
  assert.equal(replacement.headers.get("cache-control"), "private, no-cache");
  assert.notEqual(replacement.headers.get("etag"), remote.headers.get("etag"));
  fixture.kind = "employee-signature";
  assert.equal((await api.exports.GET(request("?v=" + assetUrls.communityAssetVersion(fixture)), context)).headers.get("cache-control"), "private, no-cache");
});
