import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const countries = JSON.parse(readFileSync(new URL("../public/community/rnc/countries.json", import.meta.url), "utf8"));
const source = readFileSync(new URL("../lib/community-employment.ts", import.meta.url), "utf8")
  .replace(/^import countries from .*$/m, "const countries = " + JSON.stringify(countries));
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const employment = await import("data:text/javascript;base64," + Buffer.from(outputText).toString("base64"));
const base = { characterType: "Character", position: "Intern", era: "1999", nationalityCode: "TH" };

test("only the agreed character types require or may opt into employee IDs", () => {
  for (const type of ["President", "Director", "Character", "Human"]) {
    assert.equal(employment.employeeRequired(type), true);
    assert.equal(employment.employmentFor({ ...base, characterType: type }, null).enabled, true);
  }
  assert.equal(employment.employeeRequired("NPC"), false);
  assert.equal(employment.employeeEligible("NPC"), true);
  for (const type of ["Magus", "Monster", "Unknown"]) {
    assert.equal(employment.employeeEligible(type), false);
    assert.equal(employment.employmentFor({ ...base, characterType: type, employeeEnabled: true }, null).enabled, false);
    assert.equal(employment.employeeIdFor({ ...base, characterType: type, employeeEnabled: true }, 42), null);
  }
});
test("each Position selects its department and uses the existing Era and selected country", () => {
  for (const [position, code] of Object.entries({ Timekeeper: "TM", Researcher: "RE", Medic: "MD", Intern: "IN" }))
    assert.equal(employment.employeeIdFor({ ...base, position }, 42), `${code} 1999 0042 TH`);
  assert.equal(employment.employeeIdFor({ ...base, nationalityCode: "JP" }, 1), "IN 1999 0001 JP");
  assert.equal(employment.employeeIdFor(base, 9999), "IN 1999 9999 TH");
});
test("new employees need a department, four-digit Era and a genuine selected country", () => {
  for (const patch of [{ position: "" }, { position: "Other" }, { era: "999" }, { era: "abcd" }, { nationalityCode: "" }, { nationalityCode: "ZZ" }]) {
    assert.throws(() => employment.employmentFor({ ...base, ...patch }, null));
    assert.equal(employment.employeeIdFor({ ...base, ...patch }, 42), null);
  }
  for (const number of [null, 0, -1, 10000, 1.5]) assert.equal(employment.employeeIdFor(base, number), null);
});
test("NPC is optional and opting in requires complete data", () => {
  assert.equal(employment.employmentFor({ ...base, characterType: "NPC", position: "" }, null).enabled, false);
  assert.equal(employment.employeeIdFor({ ...base, characterType: "NPC" }, 42), null);
  const npc = { ...base, characterType: "NPC", employeeEnabled: true };
  assert.equal(employment.employeeIdFor(npc, 42), "IN 1999 0042 TH");
  assert.throws(() => employment.employmentFor({ ...npc, nationalityCode: "" }, { employeeEnabled: false, employeeNumber: null }));
});
test("incomplete legacy employees remain editable and issued numbers are retained", () => {
  const legacy = employment.employmentFor({ ...base, nationalityCode: "" }, { employeeNumber: null, employeeEnabled: false });
  assert.deepEqual(legacy, { enabled: true, ready: false, number: null });
  const before = { employeeNumber: 42, employeeEnabled: true };
  assert.equal(employment.employmentFor({ ...base, position: "Researcher" }, before).number, 42);
  assert.throws(() => employment.employmentFor({ ...base, era: "" }, before));
  assert.equal(employment.employmentFor({ ...base, characterType: "NPC", employeeEnabled: false }, before).number, 42);
});
test("the country dataset has unique ISO alpha-2 codes and bilingual searchable names", () => {
  assert.equal(countries.length, 249);
  assert.equal(new Set(countries.map(row => row.code)).size, countries.length);
  assert.ok(countries.every(row => /^[A-Z]{2}$/.test(row.code) && row.th && row.en));
  assert.equal(employment.countryForCode("TH").en, "Thailand");
  assert.equal(employment.countryForCode("JP").en, "Japan");
  assert.equal(employment.countryForCode("ZZ"), undefined);
});
test("unspecified nationality uses XX without pretending to be an ISO country", () => {
  assert.equal(employment.countryForCode("XX").th, "ไม่ระบุ");
  assert.equal(countries.some(country => country.code === "XX"), false);
  const fields = { ...base, nationalityCode: "XX" };
  assert.equal(employment.employeeIdFor(fields, 42), "IN 1999 0042 XX");
  assert.deepEqual(employment.employmentFor(fields, null), { enabled: true, ready: true, number: null });
  for (const value of ["", "   ", "ไม่ระบุ", "Unspecified", "unknown"]) assert.equal(employment.isUnspecifiedNationality(value), true);
  for (const value of ["Thailand", "ไทย", "Unknown legacy nationality"]) assert.equal(employment.isUnspecifiedNationality(value), false);
  assert.throws(() => employment.employmentFor({ ...fields, era: "" }, null));
  assert.throws(() => employment.employmentFor({ ...fields, position: "" }, null));
});
test("President always uses PR independently of Position and retains its registration number", () => {
  for (const position of ["", "Intern", "Timekeeper", "Researcher", "Medic"]) {
    const head = { ...base, characterType: "President", position, nationalityCode: "XX" };
    assert.equal(employment.employeeIdFor(head, 42), "PR 1999 0042 XX");
    assert.equal(employment.employmentFor(head, null).ready, true);
  }
  assert.equal(employment.employeeIdFor({ ...base, characterType: "Director" }, 42), "IN 1999 0042 TH");
  assert.throws(() => employment.employmentFor({ ...base, characterType: "President", position: "", era: "" }, null));
});
