import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../lib/community-policy.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const policy = await import("data:text/javascript;base64," + Buffer.from(outputText).toString("base64"));
const frameSource = readFileSync(new URL("../lib/community-frames.ts", import.meta.url), "utf8");
const frameModule = ts.transpileModule(frameSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const frames = await import("data:text/javascript;base64," + Buffer.from(frameModule.outputText).toString("base64"));
const sessionSource = readFileSync(new URL("../lib/community-session-policy.ts", import.meta.url), "utf8");
const sessionModule = ts.transpileModule(sessionSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const sessionPolicy = await import("data:text/javascript;base64," + Buffer.from(sessionModule.outputText).toString("base64"));

test("temporary Discord failures keep the last verified session; rejected credentials do not", () => {
  for (const status of [null, 429, 500, 502, 599]) assert.equal(sessionPolicy.shouldRetainCommunitySession(status), true, String(status));
  for (const status of [400, 401, 403, 404, 422]) assert.equal(sessionPolicy.shouldRetainCommunitySession(status), false, String(status));
});

test("legacy HeadDirector values normalize to President", () => {
  for (const legacy of ["HeadDirector", "Head Director"]) assert.equal(policy.characterType(legacy), "President");
  assert.doesNotThrow(() => policy.assertCharacterType(policy.characterType("HeadDirector"), true));
});

test("members can create only Character and Human, even with a forged type", () => {
  for (const type of ["Character", "Human"]) assert.doesNotThrow(() => policy.assertCharacterType(type, false));
  for (const type of ["President", "Director", "NPC", "Magus", "Monster", "Admin", ""]) assert.throws(() => policy.assertCharacterType(type, false));
});
test("staff can create every supported special type but no arbitrary type", () => {
  for (const type of policy.STAFF_CHARACTER_TYPES) assert.doesNotThrow(() => policy.assertCharacterType(type, true));
  assert.throws(() => policy.assertCharacterType("Unknown", true));
});
test("Unknown element is exclusive to President and Magus", () => {
  for (const type of policy.STAFF_CHARACTER_TYPES) {
    assert.equal(policy.canUseUnknownArcana(type), ["President", "Magus"].includes(type), type);
  }
  assert.equal(policy.canUseUnknownArcana("Admin"), false);
});
test("Human weapon elements allow only the six standard arcana", () => {
  for (const element of ["BEAST", "PLANT", "STAR", "MINERAL", "SPIRIT", "INTELLECT"]) assert.equal(policy.canUseHumanWeaponArcana(element), true, element);
  for (const element of ["", "NATURAL", "UNKNOWN", "FIRE"]) assert.equal(policy.canUseHumanWeaponArcana(element), false, element);
});
test("special character creator names never enter the public owner field", () => {
  const owner = { displayName: "Private Staff Identity", username: "staff-account" };
  for (const type of ["President", "Director", "NPC", "Magus", "Monster"]) assert.equal(policy.publicOwner(type, owner), "");
  assert.equal(policy.publicOwner("Character", owner), "Private Staff Identity");
  assert.equal(policy.publicOwner("Human", null), "");
});
test("normal visibility contains published characters and the viewer's own regular submissions", () => {
  assert.deepEqual(policy.visibleCharacterWhere(), { publicationState: "PUBLISHED" });
  const where = policy.visibleCharacterWhere("member-a");
  assert.equal(where.OR[1].ownerId, "member-a");
  assert.deepEqual(where.OR[1].characterType.in, ["Character", "Human"]);
});

test("ordinary character colours follow element independently of star artwork", () => {
  for (const type of ["Character", "Human", "NPC", "Monster", "Director"]) {
    assert.equal(frames.characterFrameKey(type, "Pure blood", "BEAST"), "arcana-beast");
    for (const rank of [4, 5, 6]) assert.equal(frames.characterFrameAsset(type, rank), "/assets/RNCelement/" + rank + "%20Star.png");
  }
  assert.equal(frames.characterFrameKey("Human", "Human", "BEAST"), "arcana-natural");
  assert.equal(frames.characterFrameKey("NPC", "", "UNKNOWN"), "arcana-natural");
});

test("only Magus and President use dedicated seven-star frame treatments", () => {
  assert.equal(frames.characterFrameKey("Magus", "Human", "PLANT"), "star7-magus");
  assert.equal(frames.characterFrameKey("President", "", "BEAST"), "star7-president");
  assert.match(frames.characterFrameAsset("Magus", 4), /7%20Star%20Magus/);
  assert.match(frames.characterFrameAsset("President", null), /7%20Star%20%E0/);
  assert.equal(frames.characterFrameAsset("NPC", 7), "");
});

test("frame and glow colours are independent and missing styles retain defaults", () => {
  const saved = [{ key: "arcana-plant", borderColor: "#112233", glowColor: "#445566", updatedAt: new Date() }];
  const styles = frames.frameStylesWithDefaults(saved);
  assert.equal(styles.length, 9);
  assert.equal(new Set(styles.map(item => item.key)).size, 9);
  const plant = styles.find(item => item.key === "arcana-plant");
  assert.equal(plant.borderColor, "#112233"); assert.equal(plant.glowColor, "#445566");
  const magus = styles.find(item => item.key === "star7-magus");
  assert.equal(magus.borderColor, magus.defaultBorder); assert.equal(magus.tint, false);
});
