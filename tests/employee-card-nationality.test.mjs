import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const scope = { window:{}, Intl };
vm.runInNewContext(readFileSync(new URL("../public/community/rnc/employee-card-nationality.js", import.meta.url), "utf8"), scope);
const format = scope.window.RNCEmployeeCardNationality.format;
const countries = [
  { code:"US", th:"สหรัฐอเมริกา", en:"United States", nationalityEn:"American" },
  { code:"TH", th:"ไทย", en:"Thailand", nationalityEn:"Thai" },
];

test("employee cards use English nationality names", () => {
  assert.equal(format({ nationalityCode:"US", nationality:"สหรัฐอเมริกา" }, countries), "American");
  assert.equal(format({ nationalityCode:"TH", nationality:"ไทย" }, countries), "Thai");
});

test("legacy Thai country names are converted and unspecified values stay English only", () => {
  assert.equal(format({ nationality:"ไทย" }, countries), "Thai");
  assert.equal(format({ nationalityCode:"XX", nationality:"ไม่ระบุ" }, countries), "XX");
  assert.equal(format({ nationality:"สัญชาติเดิมที่ไม่รู้จัก" }, countries), "XX");
  assert.equal(format({ nationality:"USA" }, countries), "American");
});
