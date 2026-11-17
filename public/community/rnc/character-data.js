// Shared character schema and server-provided records for the Community archive.
(function() {
  const template = {
    header: ["name", "era", "quote"],
    identity: ["nickname", "age", "gender", "nationality", "height", "weight", "race", "position"],
    stats: ["COR", "MNF", "RFX", "SCR", "DEF"],
    medium: ["mediumName", "mediumDescription", "abilityDescription", "limitations"],
    traits: ["likes", "dislikes", "personality"],
    history: ["history"],
    contact: ["playstyle", "status", "contact", "discord", "other"],
  };
  const legacyStorageKey = "rnc-character-mockup-v1";
  const bootstrap = window.__RNC_BOOTSTRAP__ || {};
  function splitLegacyMeasurements(value) {
    const raw = String(value || "").trim();
    if (!raw) return { height: "", weight: "" };
    const separator = raw.indexOf("/");
    if (separator < 0) return { height: raw, weight: "" };
    return { height: raw.slice(0, separator).trim(), weight: raw.slice(separator + 1).trim() };
  }
  const characters = (Array.isArray(bootstrap.characters) ? bootstrap.characters.slice() : []).map(function(character) {
    const legacy = splitLegacyMeasurements(character.heightWeight);
    return {
      ...character,
      height: character.height || legacy.height,
      weight: character.weight || legacy.weight,
    };
  });

  function rankFor(character) {
    if (character.race === "Human") return 4;
    if (character.position === "Intern") return 5;
    if (["Timekeeper", "Researcher", "Medic"].includes(character.position)) return 6;
    return null;
  }

  function getAll() {
    return characters.slice();
  }

  function getById(id) {
    return characters.find(function(item) { return String(item.id) === String(id); });
  }

  function getOwned() {
    const currentUser = bootstrap.currentUser;
    if (!currentUser) return [];
    return characters
      .filter(function(item) { return item.ownerId === currentUser.id; })
      .map(function(item) { return item.id; });
  }

  function getLegacyDrafts() {
    try {
      const value = JSON.parse(localStorage.getItem(legacyStorageKey) || "[]");
      return Array.isArray(value) ? value.filter(function(item) {
        return item && typeof item === "object" && String(item.id || "").startsWith("oc-");
      }) : [];
    } catch {
      return [];
    }
  }

  function getLegacyById(id) {
    return getLegacyDrafts().find(function(item) { return String(item.id) === String(id); });
  }

  function removeLegacyDraft(id) {
    const remaining = getLegacyDrafts().filter(function(item) { return String(item.id) !== String(id); });
    try {
      localStorage.setItem(legacyStorageKey, JSON.stringify(remaining));
    } catch {}
  }

  function add(character) {
    const index = characters.findIndex(function(item) { return String(item.id) === String(character.id); });
    if (index < 0) characters.unshift(character);
    else characters[index] = character;
  }

  window.RNCCharacterStore = {
    template: template,
    currentUser: bootstrap.currentUser || null,
    getAll: getAll,
    getById: getById,
    getOwned: getOwned,
    getRank: rankFor,
    splitLegacyMeasurements: splitLegacyMeasurements,
    getLegacyDrafts: getLegacyDrafts,
    getLegacyById: getLegacyById,
    removeLegacyDraft: removeLegacyDraft,
    add: add,
  };
})();
