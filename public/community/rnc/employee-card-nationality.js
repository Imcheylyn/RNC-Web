(() => {
  "use strict";

  const COUNTRY_ALIASES = {
    "U.S.A.": "US", USA: "US", "UNITED STATES OF AMERICA": "US",
    UK: "GB", "GREAT BRITAIN": "GB", "SOUTH KOREA": "KR", "NORTH KOREA": "KP",
  };

  function findCountry(value, countries) {
    const normalized = String(value || "").trim().normalize("NFKC").toLocaleLowerCase();
    return countries.find(row => [row.code, row.th, row.en, row.nationalityEn]
      .some(candidate => String(candidate || "").trim().normalize("NFKC").toLocaleLowerCase() === normalized));
  }

  function format(character, countries = []) {
    const code = String(character?.nationalityCode || "").trim().toUpperCase();
    if (code === "XX") return "XX";
    let country = /^[A-Z]{2}$/.test(code) ? countries.find(row => row.code === code) : null;
    const value = String(character?.nationality || "").trim();
    if (!country && value) {
      const alias = COUNTRY_ALIASES[value.toUpperCase()];
      country = findCountry(alias || value, countries);
    }
    if (country) return country.nationalityEn || "XX";
    return /^[\x00-\x7F]*$/.test(value) ? value : "XX";
  }

  window.RNCEmployeeCardNationality = { format };
})();