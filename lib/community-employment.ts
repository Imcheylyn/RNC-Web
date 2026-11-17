import countries from "../public/community/rnc/countries.json"

export const EMPLOYEE_DEPARTMENTS: Record<string, string> = {
  Timekeeper: "TM", Researcher: "RE", Medic: "MD", Intern: "IN",
}
const REQUIRED_TYPES = new Set(["President", "Director", "Character", "Human"])
const COUNTRY_BY_CODE = new Map(countries.map(country => [country.code, country]))
const normalizeNationalityValue = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase()
const COUNTRY_BY_VALUE = new Map<string, (typeof countries)[number]>()
for (const country of countries) {
  for (const value of [country.th, country.en, country.nationalityEn]) {
    COUNTRY_BY_VALUE.set(normalizeNationalityValue(value), country)
  }
}
const COUNTRY_VALUE_ALIASES: Record<string, string> = {
  usa: "US", "u.s.a.": "US", "united states of america": "US",
  uk: "GB", "great britain": "GB", "south korea": "KR", "north korea": "KP",
}
// XX is the application's explicit unspecified value, separate from the ISO country list.
export const UNSPECIFIED_NATIONALITY = { code: "XX", th: "ไม่ระบุ", en: "Unspecified", nationalityEn: "ไม่ระบุ" }
export const employeeRequired = (type: string) => REQUIRED_TYPES.has(type)
export const employeeEligible = (type: string) => employeeRequired(type) || type === "NPC"
export const countryForCode = (code: string) => { const normalized = code.toUpperCase(); return normalized === "XX" ? UNSPECIFIED_NATIONALITY : COUNTRY_BY_CODE.get(normalized) }
export const countryForValue = (value: string) => { const normalized = normalizeNationalityValue(value); const alias = COUNTRY_VALUE_ALIASES[normalized]; return alias ? COUNTRY_BY_CODE.get(alias) : COUNTRY_BY_VALUE.get(normalized) }
export const isUnspecifiedNationality = (value: string) => ["", "ไม่ระบุ", "unspecified", "unknown", "not specified"]
  .includes(value.normalize("NFKC").trim().toLowerCase())

type EmploymentFields = {
  characterType: string; position: string; era: string; nationalityCode: string; employeeEnabled?: boolean
}
type ExistingEmployment = { employeeNumber: number | null; employeeEnabled: boolean } | null

export const employeeDepartmentFor = (fields: Pick<EmploymentFields, "characterType" | "position">) =>
  fields.characterType === "President" ? "PR" : EMPLOYEE_DEPARTMENTS[fields.position]

export function employeeIdFor(fields: EmploymentFields, number: number | null): string | null {
  if (!employeeEligible(fields.characterType) || (fields.characterType === "NPC" && !fields.employeeEnabled)) return null
  const department = employeeDepartmentFor(fields)
  if (!department || !/^\d{4}$/.test(fields.era) || !countryForCode(fields.nationalityCode)
    || !Number.isInteger(number) || number! < 1 || number! > 9999) return null
  return [department, fields.era, String(number).padStart(4, "0"), fields.nationalityCode].join(" ")
}

export function employmentFor(fields: EmploymentFields, before: ExistingEmployment) {
  const enabled = employeeRequired(fields.characterType)
    || (fields.characterType === "NPC" && fields.employeeEnabled === true)
  const ready = Boolean(employeeDepartmentFor(fields) && /^\d{4}$/.test(fields.era)
    && countryForCode(fields.nationalityCode))
  // Old incomplete records remain editable; already issued IDs cannot silently lose their inputs.
  const requiresComplete = !before || before.employeeNumber !== null
    || (fields.characterType === "NPC" && !before.employeeEnabled)
  if (enabled && requiresComplete && !ready) {
    if (fields.characterType === "President") throw new Error("กรุณากรอก Era ให้ครบ 4 หลัก และเลือกประเทศหรือไม่ระบุก่อนออกรหัสพนักงาน")
    throw new Error("กรุณาเลือก Position กรอก Era ให้ครบ 4 หลัก และเลือกประเทศหรือไม่ระบุก่อนออกรหัสพนักงาน")
  }
  return { enabled, ready, number: before?.employeeNumber ?? null }
}
