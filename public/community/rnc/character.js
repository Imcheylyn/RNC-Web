const iconNames = {
  NATURAL: "Neutral%20Full.png",
  UNKNOWN: "Spirit_Unknown.png",
  BEAST: "Beast%20Full.png", PLANT: "Plant%20Full.png", STAR: "Star%20Full.png",
  MINERAL: "Mineral%20Full.png", SPIRIT: "Spirit%20Full.png", INTELLECT: "Intel%20Full.png",
};
const weaponBadgeNames = {
  BEAST: "Beast.png", PLANT: "Plant.png", STAR: "Star.png",
  MINERAL: "Mineral.png", SPIRIT: "Spirit.png", INTELLECT: "Intel.png",
};
const characterParams = new URLSearchParams(location.search);
const requestedId = characterParams.get("id") || "";
const characterReturnUrl = characterParams.get("from") === "height" ? "/community/rnc/height" : "/community/rnc";
const staffContext = characterParams.get("staff") === "1" && window.RNCCharacterStore.currentUser?.isStaff === true;
if (staffContext) {
  const staffReturn = "/community/staff#characters";
  document.querySelectorAll('.scene-toolbar a[href="/community/rnc"], .enemy-back').forEach(link => { link.href = staffReturn; });
} else {
  const backLink = document.querySelector(".scene-toolbar .toolbar-left a:first-child");
  if (backLink) {
    backLink.href = characterReturnUrl;
    if (characterParams.get("from") === "height") backLink.setAttribute("aria-label", "กลับไปหน้า Height");
  }
  document.querySelectorAll(".enemy-back").forEach(link => { link.href = characterReturnUrl; });
}
const character = window.RNCCharacterStore.getById(requestedId);

function repairLegacyThai(value) {
  const text = String(value || "");
  if (!/[\u0080-\u009f]|\u0e22\u0e17/.test(text)) return text;
  try {
    const decoder = new TextDecoder("windows-874");
    const byteByCharacter = new Map();
    for (let byte = 0; byte < 256; byte++) {
      const decoded = decoder.decode(Uint8Array.of(byte));
      if (decoded.length === 1 && decoded !== "\uFFFD" && !byteByCharacter.has(decoded)) byteByCharacter.set(decoded, byte);
    }
    const bytes = [];
    for (const character of text) {
      if (!byteByCharacter.has(character)) return text;
      bytes.push(byteByCharacter.get(character));
    }
    const repaired = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
    return /[\u0e00-\u0e7f]/.test(repaired) ? repaired : text;
  } catch {
    return text;
  }
}
function setText(id, value, empty) {
  document.getElementById(id).textContent = value == null || value === "" ? (empty === undefined ? "\u2014" : empty) : String(value);
}
function appendFacts(id, fields) {
  const container = document.getElementById(id);
  fields.forEach(function(field) {
    const line = document.createElement("div");
    const label = document.createElement("dt");
    const value = document.createElement("dd");
    label.textContent = field[0];
    value.textContent = field[1] || "\u2014";
    line.append(label, value);
    container.appendChild(line);
  });
}

function renderHumanWeaponRecords(value) {
  const container = document.getElementById("humanWeaponsDisplay");
  container.replaceChildren();
  const weapons = Array.isArray(value) ? value.slice(0, 2) : [];
  if (!weapons.length) return;
  const tiles = document.createElement("div");
  tiles.className = "human-weapon-tiles";
  weapons.forEach(function(weapon, index) {
    const name = repairLegacyThai(weapon.name) || "Weapon " + (index + 1);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "human-weapon-tile";
    card.setAttribute("aria-label", "อ่านรายละเอียดอาวุธ " + name);
    card.setAttribute("aria-haspopup", "dialog");
    card.setAttribute("aria-controls", "weaponReadDialog");
    card.setAttribute("aria-expanded", "false");
    const artwork = document.createElement("span");
    artwork.className = "human-weapon-tile-art";
    const placeholder = document.createElement("span");
    placeholder.className = "human-weapon-placeholder";
    placeholder.textContent = name;
    placeholder.hidden = Boolean(weapon.image);
    artwork.append(placeholder);
    if (weapon.image) {
      const image = document.createElement("img");
      image.className = "human-weapon-tile-image";
      image.alt = "";
      image.addEventListener("load", function() { image.classList.add("is-loaded"); }, { once: true });
      image.addEventListener("error", function() { image.hidden = true; placeholder.hidden = false; });
      image.src = weapon.image;
      if (image.complete && image.naturalWidth > 0) image.classList.add("is-loaded");
      artwork.append(image);
    }
    card.append(artwork);
    card.addEventListener("click", function() { openWeaponRead(card, weapon, index); });
    tiles.append(card);
  });
  container.append(tiles);
}

function alignHumanWeaponToRace() {
  const firstWeapon = document.querySelector(".human-weapon-tile");
  const raceTag = document.getElementById("roleTags").lastElementChild;
  if (!firstWeapon) return;
  firstWeapon.style.removeProperty("--weapon-offset-x");
  if (!matchMedia("(min-width:901px)").matches || !raceTag || raceTag.textContent !== character.race) return;
  const offset = raceTag.offsetLeft + raceTag.offsetWidth / 2 - firstWeapon.offsetLeft - firstWeapon.offsetWidth / 2;
  firstWeapon.style.setProperty("--weapon-offset-x", offset + "px");
}

function showPanel(name) {
  document.querySelectorAll(".detail-pane").forEach(function(pane) {
    pane.hidden = pane.id !== "panel-" + name;
  });
  document.querySelectorAll(".panel-tabs button").forEach(function(button) {
    button.setAttribute("aria-selected", String(button.dataset.panel === name));
  });
  document.querySelector(".detail-paper").scrollTop = 0;
}

document.querySelectorAll("[data-panel]").forEach(function(button) {
  button.addEventListener("click", function() { showPanel(button.dataset.panel); });
});

const detailCrest = document.querySelector(".detail-crest");
const detailInfoPanel = document.getElementById("detailInfoPanel");
const detailInfoScroll = detailInfoPanel.querySelector(".detail-info-scroll");
const detailCards = document.querySelector(".detail-cards");
const skillReadDialog = document.getElementById("skillReadDialog");
const skillReadArtwork = document.getElementById("skillReadArtwork");
const skillReadFrame = document.getElementById("skillReadFrame");
const skillReadTitle = document.getElementById("skillReadTitle");
const skillReadKind = document.getElementById("skillReadKind");
const skillReadDescription = document.getElementById("skillReadDescription");
const weaponReadDialog = document.getElementById("weaponReadDialog");
const weaponReadArtwork = document.getElementById("weaponReadArtwork");
const weaponReadArt = document.getElementById("weaponReadArt");
let activeWeaponTrigger = null;
const SKILL_DETAIL_BY_INDEX = {
  "0": { key: "arcane1", fallbackName: "Arcane I" },
  "1": { key: "arcane2", fallbackName: "Arcane II" },
  "2": { key: "ultimate", fallbackName: "Ultimate" },
  "3": { key: "arcane3", fallbackName: "Arcane III" },
};
let activeDetailSection = "";
let activeSkillTrigger = null;

function showDetailInfo(sectionName) {
  detailInfoPanel.hidden = false;
  activeDetailSection = sectionName;
  const section = detailInfoPanel.querySelector('[data-detail-entry="' + sectionName + '"]');
  const heading = document.getElementById("mediumTooltipTitle");
  if (sectionName === "weapon") heading.textContent = character && character.weaponName || "Weapon";
  else if (sectionName === "medium") heading.textContent = character && character.mediumName || "Medium";
  else if (sectionName === "ability") heading.textContent = "Arcane Ability";
  else if (sectionName === "limitations") heading.textContent = "Limitations";
  else heading.textContent = "Skill Details";
  if (section) detailInfoScroll.scrollTop = section.offsetTop - detailInfoScroll.offsetTop;
}

function hideDetailInfo() {
  detailInfoPanel.hidden = true;
  activeDetailSection = "";
}

function openWeaponRead(card, weapon, index) {
  activeWeaponTrigger = card;
  setText("weaponReadTitle", repairLegacyThai(weapon.name), "Weapon " + (index + 1));
  setText("weaponReadDescription", repairLegacyThai(weapon.description), "ยังไม่ได้ระบุคำอธิบายอาวุธ");
  weaponReadArtwork.hidden = !weapon.image;
  weaponReadArt.hidden = !weapon.image;
  if (weapon.image) weaponReadArtwork.src = weapon.image;
  else weaponReadArtwork.removeAttribute("src");
  const arcana = String(weapon.arcana || "").toUpperCase();
  const elementIcon = document.getElementById("weaponReadElementIcon");
  const badgeName = weaponBadgeNames[arcana];
  elementIcon.hidden = !badgeName;
  if (badgeName) elementIcon.src = "/assets/RNCelement/" + badgeName;
  elementIcon.alt = badgeName ? arcana[0] + arcana.slice(1).toLowerCase() : "";
  const stats = weapon.stats && typeof weapon.stats === "object" ? weapon.stats : {};
  [["CORE", "COR"], ["MNF", "MNF"], ["SCR", "SCR"]].forEach(function(pair) {
    const number = Number(stats[pair[1]]);
    setText("weaponRead" + pair[0], Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0);
  });
  card.setAttribute("aria-expanded", "true");
  if (!weaponReadDialog.open) weaponReadDialog.showModal();
}

weaponReadArtwork.addEventListener("error", function() {
  weaponReadArtwork.hidden = true;
  weaponReadArt.hidden = true;
});
weaponReadDialog.querySelector(".skill-read-close").addEventListener("click", function() {
  weaponReadDialog.close();
});
weaponReadDialog.addEventListener("click", function(event) {
  if (event.target === weaponReadDialog) weaponReadDialog.close();
});
weaponReadDialog.addEventListener("close", function() {
  if (!activeWeaponTrigger) return;
  activeWeaponTrigger.setAttribute("aria-expanded", "false");
  activeWeaponTrigger.focus();
  activeWeaponTrigger = null;
});

function applySkillReadCrop(element, value) {
  if (window.RNCSkillCrop) window.RNCSkillCrop.apply(element, value);
}

function openSkillRead(card, definition, name, description, imageCrop) {
  const cardArtwork = card.querySelector(".skill-card-art");
  const cardFrame = card.querySelector(".skill-card-frame");
  const readWindow = document.querySelector(".skill-read-window");
  const label = card.querySelector("figcaption");
  activeSkillTrigger = card;
  readWindow.hidden = cardArtwork.hidden;
  skillReadArtwork.hidden = cardArtwork.hidden;
  if (!cardArtwork.hidden) skillReadArtwork.src = cardArtwork.currentSrc || cardArtwork.src;
  skillReadFrame.src = cardFrame.currentSrc || cardFrame.src;
  skillReadTitle.textContent = name;
  skillReadKind.textContent = label ? label.textContent : definition.fallbackName;
  skillReadDescription.textContent = description.trim() || "ยังไม่มีรายละเอียดสกิลนี้";
  skillReadDialog.dataset.skill = definition.key;
  skillReadDialog.dataset.hasArt = String(!cardArtwork.hidden);
  card.setAttribute("aria-expanded", "true");
  if (!skillReadDialog.open) skillReadDialog.showModal();
  applySkillReadCrop(readWindow, imageCrop);
}

function renderSkillCards(container, hideEmpty = false) {
  const details = character.skillDetails && typeof character.skillDetails === "object" ? character.skillDetails : {};
  let visibleCount = 0;
  container.querySelectorAll("[data-skill-card]").forEach(function(card) {
    const index = Number(card.dataset.skillCard);
    const definition = SKILL_DETAIL_BY_INDEX[String(index)];
    const detail = details[definition.key] || {};
    const image = Array.isArray(character.skillImages) ? character.skillImages[index] || "" : "";
    const name = typeof detail.name === "string" && detail.name.trim() ? detail.name.trim() : definition.fallbackName;
    const description = typeof detail.description === "string" ? detail.description : "";
    card.hidden = hideEmpty && !image && !String(detail.name || "").trim() && !description.trim();
    if (card.hidden) return;
    visibleCount += 1;
    const artwork = card.querySelector(".skill-card-art");
    const artWindow = card.querySelector(".skill-card-art-window");
    artWindow.hidden = !image;
    artwork.hidden = !image;
    if (image) artwork.src = image;
    applySkillReadCrop(artWindow, detail.imageCrop);
    card.classList.toggle("has-art", Boolean(image));
    card.setAttribute("aria-label", "อ่านสกิล " + name);
    card.removeAttribute("title");
    card.addEventListener("click", function() {
      openSkillRead(card, definition, name, description, detail.imageCrop);
    });
    card.addEventListener("keydown", function(event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openSkillRead(card, definition, name, description, detail.imageCrop);
      }
    });
  });
  return visibleCount;
}

skillReadDialog.querySelector(".skill-read-close").addEventListener("click", function() {
  skillReadDialog.close();
});
skillReadDialog.addEventListener("click", function(event) {
  if (event.target === skillReadDialog) skillReadDialog.close();
});
skillReadDialog.addEventListener("close", function() {
  if (!activeSkillTrigger) return;
  activeSkillTrigger.setAttribute("aria-expanded", "false");
  activeSkillTrigger.focus();
  activeSkillTrigger = null;
});

detailCrest.querySelectorAll("[data-detail-section]").forEach(function(button) {
  button.addEventListener("pointerenter", function(event) {
    if (event.pointerType !== "touch") showDetailInfo(button.dataset.detailSection);
  });
  button.addEventListener("focus", function() {
    if (button.matches(":focus-visible")) showDetailInfo(button.dataset.detailSection);
  });
  button.addEventListener("click", function() {
    if (!matchMedia("(hover: none)").matches) return;
    if (!detailInfoPanel.hidden && activeDetailSection === button.dataset.detailSection) hideDetailInfo();
    else showDetailInfo(button.dataset.detailSection);
  });
});
detailCrest.addEventListener("pointerleave", function(event) {
  const next = event.relatedTarget;
  if (next instanceof Node && detailCards.contains(next)) return;
  if (!detailCrest.querySelector("[data-detail-section]:focus-visible")) hideDetailInfo();
});
detailCrest.addEventListener("focusout", function(event) {
  const next = event.relatedTarget;
  if (!detailCrest.contains(next) && !detailCards.contains(next) && !detailCrest.matches(":hover")) hideDetailInfo();
});
detailCards.addEventListener("pointerleave", function(event) {
  const next = event.relatedTarget;
  if (!(next instanceof Node) || (!detailCards.contains(next) && !detailCrest.contains(next))) hideDetailInfo();
});
document.addEventListener("pointerdown", function(event) {
  if (!detailCrest.contains(event.target) && !detailCards.contains(event.target)) hideDetailInfo();
});

if (!character) {
  document.querySelector(".character-scene").replaceChildren();
  const notice = document.createElement("div");
  notice.className = "missing-character";
  notice.textContent = "ไม่พบตัวละครนี้ในคลัง";
  const link = document.createElement("a");
  link.href = staffContext ? "/community/staff#characters" : characterReturnUrl;
  link.textContent = characterParams.get("from") === "height" ? "กลับไปหน้า Height" : "กลับไปหน้าแกลเลอรี";
  notice.appendChild(link);
  document.querySelector(".character-scene").appendChild(notice);
} else if (character.characterType === "Monster") {
  document.title = character.name + " | Enemy Record · Reverse : Noir Chronicle";
  document.body.classList.add("enemy-record-page");
  document.getElementById("characterScene").hidden = true;
  document.getElementById("enemyScene").hidden = false;
  document.documentElement.classList.remove("from-gallery", "has-arrival-art", "arrival-running");
  const enemy = character.enemyData && typeof character.enemyData === "object" ? character.enemyData : {};
  const subtype = ["Critter", "Arcanoid", "Magus Sacramentum"].includes(enemy.subtype) ? enemy.subtype : (["Critter", "Arcanoid", "Magus Sacramentum"].includes(character.byname) ? character.byname : "Enemy");
  const element = ["NATURAL", "BEAST", "PLANT", "STAR", "MINERAL", "SPIRIT", "INTELLECT"].includes(character.arcana) ? character.arcana : "NATURAL";
  setText("enemySubtype", subtype);
  const nameParts = String(character.name).split("|").map(part => part.trim());
  setText("enemyName", nameParts[0]);
  setText("enemyLocalName", nameParts.slice(1).join(" | "), "");
  document.getElementById("enemyLocalName").hidden = nameParts.length < 2;
  setText("enemyHP", Number.isInteger(Number(enemy.hp)) ? Number(enemy.hp) : 0);
  setText("enemyElementLabel", element === "NATURAL" ? "Natural" : element[0] + element.slice(1).toLowerCase());
  setText("enemyTypeFact", subtype);
  setText("enemyLevel", enemy.isBoss === true ? "Boss" : "ทั่วไป");
  document.getElementById("enemyBossStamp").hidden = enemy.isBoss !== true;
  document.getElementById("enemyScene").classList.toggle("is-boss", enemy.isBoss === true);
  setText("enemyDescription", enemy.description || character.other || character.quote, "No field notes recorded.");
  const elementIcon = document.getElementById("enemyElementIcon");
  elementIcon.src = "/assets/RNCelement/" + (iconNames[element] || iconNames.NATURAL);
  elementIcon.alt = element === "NATURAL" ? "Natural" : element;
  const image = document.getElementById("enemyImage");
  const enemyArt = document.getElementById("enemyArt");
  if (character.image || character.detailImage || character.galleryImage) {
    image.src = character.image || character.detailImage || character.galleryImage;
    image.alt = character.name;
    image.hidden = false;
    window.RNCImageLayout?.apply(image, character, "profile");
    image.decode().catch(function() {
      image.hidden = !image.naturalWidth;
      enemyArt.classList.toggle("enemy-art-empty", image.hidden);
    }).then(function() {
      enemyArt.classList.add("is-ready");
    });
  } else {
    enemyArt.classList.add("enemy-art-empty", "is-ready");
  }
  const stats = character.stats && typeof character.stats === "object" ? character.stats : {};
  [["COR", "enemyCORE"], ["MNF", "enemyMNF"], ["RFX", "enemyRFX"], ["SCR", "enemySCR"], ["DEF", "enemyDEF"]].forEach(function(pair) {
    const value = Number(stats[pair[0]]);
    setText(pair[1], Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
  });
  const enemySkills = document.getElementById("enemySkills");
  enemySkills.replaceChildren(...Array.from(detailCards.querySelectorAll("[data-skill-card]"), card => card.cloneNode(true)));
  const hasEnemySkills = renderSkillCards(enemySkills, true) > 0;
  document.getElementById("enemySkillsSection").hidden = !hasEnemySkills;
  document.querySelector(".enemy-records")?.classList.toggle("has-skills", hasEnemySkills);
} else {
  document.title = character.name + " | Reverse : Noir Chronicle";
  setText("fileNumber", String(character.id).startsWith("oc-") ? "OC" : "RNC");
  setText("characterName", character.name);
  const openEmployeeCard = document.getElementById("openEmployeeCard");
  openEmployeeCard.hidden = !character.employeeId;
  if (character.employeeId) {
    const currentUser = window.RNCCharacterStore.currentUser;
    let employeeCard;
    window.RNCFeatures.bind(openEmployeeCard, "employeeCard", () => {
      employeeCard ||= window.RNCEmployeeCard.init(character, {
        canEdit: Boolean(currentUser && (currentUser.isStaff || character.ownerId === currentUser.id)),
        canEditSignature: Boolean(currentUser && character.ownerId === currentUser.id),
        repairText: repairLegacyThai,
      });
      employeeCard.open();
    });
  }
  const employeeLine = document.getElementById("characterEmployee");
  employeeLine.hidden = !(["President", "Director", "Character", "Human"].includes(character.characterType)
    || (character.characterType === "NPC" && character.employeeEnabled));
  setText("characterEmployeeId", character.employeeId || "รอออกรหัสพนักงาน");
  setText("characterByname", repairLegacyThai(character.byname), "");
  setText("characterNickname", character.nickname ? "\u0e0a\u0e37\u0e48\u0e2d\u0e40\u0e25\u0e48\u0e19 \u00b7 " + repairLegacyThai(character.nickname) : "", "");
  setText("characterEra", "ERA \u00b7 " + (character.era || "\u2014"));
  const rank = Number(character.rank);
  const hasRank = Number.isInteger(rank) && rank >= 1 && rank <= 7;
  const rankStars = document.getElementById("rankStars");
  rankStars.replaceChildren();
  if (hasRank) {
    rankStars.setAttribute("role", "img");
    rankStars.setAttribute("aria-label", rank + " ดาว");
    for (let index = 0; index < rank; index += 1) {
      const star = document.createElement("img");
      star.src = "/assets/RNCelement/Number%20Star.png";
      star.alt = "";
      star.setAttribute("aria-hidden", "true");
      rankStars.appendChild(star);
    }
  } else {
    rankStars.removeAttribute("role");
    rankStars.removeAttribute("aria-label");
  }
  const arcana = character.arcana === "UNKNOWN" && ["President", "Magus"].includes(character.characterType)
    ? "UNKNOWN" : character.race === "Human" ? "NATURAL" : character.arcana;
  setText("ownerName", character.owner);
  document.getElementById("ownerName").closest(".owner-line").hidden = !character.owner;
  if (character.publicationState !== "PUBLISHED") {
    const status = document.createElement("aside"); status.className = "character-review-banner";
    status.textContent = ({ DRAFT: "ฉบับร่าง", PENDING: "ตัวละครกำลังรอ Staff ตรวจ", CHANGES_REQUESTED: "Staff ขอให้แก้ไขข้อมูล", ARCHIVED: "เก็บเข้าคลัง" }[character.publicationState] || "") + (character.reviewNote ? " · " + character.reviewNote : "");
    document.querySelector(".character-stage").prepend(status);
  }
  setText("characterQuote", character.quote, "เรื่องราวของตัวละครกำลังรอการบันทึก");
  const isHuman = character.characterType === "Human" || character.race === "Human";
  document.body.classList.toggle("human-record-page", isHuman);
  document.querySelector(".scene-left").setAttribute("aria-label", isHuman ? "ข้อมูลตัวละครและอาวุธ" : "ข้อมูลตัวละครและค่าสถานะ");
  const legacyWeapon = character.weaponName ? [{ name: character.weaponName, arcana: character.weaponArcana, description: character.weaponDescription, stats: {}, image: "" }] : [];
  const humanWeapons = Array.isArray(character.weapons) && character.weapons.length ? character.weapons : legacyWeapon;
  document.querySelector(".stat-head").hidden = isHuman;
  document.getElementById("statGrid").hidden = isHuman;
  detailCrest.hidden = isHuman;
  const humanWeaponsDisplay = document.getElementById("humanWeaponsDisplay");
  humanWeaponsDisplay.hidden = !isHuman;
  if (isHuman) renderHumanWeaponRecords(humanWeapons);
  document.getElementById("mediumBadgeName").textContent = character.mediumName || "Medium";
  document.getElementById("mediumTooltipTitle").textContent = character.mediumName || "Medium";
  setText("mediumTooltipText", character.mediumDescription, "ยังไม่ได้ระบุรายละเอียด Medium");
  document.querySelector('[data-detail-entry="medium"]').hidden = false;
  document.querySelector('[data-detail-entry="weapon"]').hidden = true;
  setText("skillTooltipAbilityText", character.abilityDescription, "ยังไม่ได้ระบุความสามารถ");
  setText("skillTooltipLimitationsText", character.limitations, "ยังไม่ได้ระบุข้อจำกัด");
  setText("likes", character.likes);
  setText("dislikes", character.dislikes);
  setText("personality", character.personality);
  setText("history", character.history, "ยังไม่ได้บันทึกประวัติของตัวละครนี้");
  setText("other", character.other);

  renderSkillCards(detailCards);

  const icon = document.getElementById("arcanaIcon");
  icon.src = "/assets/RNCelement/" + (iconNames[arcana] || "Neutral%20Full.png");
  icon.alt = arcana === "NATURAL" ? "Natural" : (arcana || "Arcana");

  const portrait = document.getElementById("scenePortrait");
  const portraitImage = document.getElementById("scenePortraitImage");
  const fullPortrait = character.image || character.detailImage;
  if (fullPortrait) {
    portrait.style.setProperty("--portrait-ratio", "2 / 3");
    portrait.style.backgroundImage = "none";
    portraitImage.src = fullPortrait;
    portraitImage.hidden = false;
    window.RNCImageLayout?.apply(portraitImage, character, "profile");
  } else {
    portrait.classList.add("empty-portrait");
  }

  const arrival = window.RNCGalleryArrival;
  if (arrival && arrival.id === String(character.id)) {
    requestAnimationFrame(function() {
      const destination = portrait.getBoundingClientRect();
      const offsetX = destination.left + destination.width / 2 - (arrival.left + arrival.width / 2);
      const offsetY = destination.top + destination.height / 2 - (arrival.top + arrival.height / 2);
      const scale = Math.min(1.45, Math.max(1.15, destination.width / arrival.width * .46));
      const root = document.documentElement;
      root.style.setProperty("--arrival-dx", offsetX + "px");
      root.style.setProperty("--arrival-dy", offsetY + "px");
      root.style.setProperty("--arrival-scale", String(scale));
      requestAnimationFrame(function() { root.classList.add("arrival-running"); });
    });
  }

  const tags = document.getElementById("roleTags");
  [character.position, character.playstyle, character.race].filter(Boolean).forEach(function(tag) {
    const node = document.createElement("span");
    node.textContent = tag;
    tags.appendChild(node);
  });
  if (isHuman) {
    window.addEventListener("resize", alignHumanWeaponToRace, { passive: true });
    document.fonts.ready.then(function() {
      alignHumanWeaponToRace();
      const pageElapsed = performance.now() / 1000;
      humanWeaponsDisplay.querySelectorAll(".human-weapon-tile").forEach(function(tile, index) {
        const skillDelay = .45 + index * .1;
        tile.style.setProperty("--weapon-delay", Math.max(-.62, skillDelay - pageElapsed) + "s");
      });
      requestAnimationFrame(function() { humanWeaponsDisplay.classList.add("is-ready"); });
    });
  }

  const stats = character.stats || {};
  const template = window.RNCCharacterStore.template;
  const hasStats = template.stats.some(function(stat) { return stats[stat] != null; });
  const grid = document.getElementById("statGrid");
  const total = template.stats.reduce(function(sum, stat) {
    const line = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");
    label.textContent = stat;
    value.textContent = Number.isFinite(Number(stats[stat])) ? String(stats[stat]) : "\u2014";
    line.append(label, value);
    grid.appendChild(line);
    return sum + (Number(stats[stat]) || 0);
  }, 0);
  setText("statTotal", hasStats ? "TOTAL " + total : "\u2014");

  const labels = {
    name: "NAME \u2013 SURNAME", nickname: "NICKNAME", age: "AGE", gender: "GENDER",
    nationality: "NATIONALITY", height: "HEIGHT", weight: "WEIGHT", race: "RACE", position: "POSITION",
    era: "ERA", playstyle: "สายการเล่น", status: "สถานะตัวละคร", contact: "ช่องทางติดต่อ", discord: "Discord",
  };
  appendFacts("identityFacts", ["name", ...template.identity, "era"].map(function(key) {
    return [labels[key], key === "nationality" ? (character.nationalityTh || character[key]) : character[key]];
  }));
  appendFacts("contactFacts", template.contact.filter(function(key) { return key !== "other"; }).map(function(key) {
    return [labels[key], character[key]];
  }));

  if (staffContext || (window.RNCCharacterStore.currentUser && character.ownerId === window.RNCCharacterStore.currentUser.id)) {
    const edit = document.getElementById("editCharacter");
    edit.href = staffContext ? "/community/rnc/editor?staff=1&id=" + encodeURIComponent(character.id) : "/community/rnc/editor?id=" + encodeURIComponent(character.id);
    if (staffContext) edit.textContent = "แก้ไขข้อมูลตัวละคร";
    edit.hidden = false;
  }
}
