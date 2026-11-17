const form = document.getElementById("characterForm");
const preview = document.getElementById("portraitPreviewArt");
const fileInput = document.getElementById("portraitFile");
const cropButton = document.getElementById("cropPortrait");
const cropDialog = document.getElementById("cropDialog");
const cropCanvas = document.getElementById("cropCanvas");
const cropContext = cropCanvas.getContext("2d");
const cropZoom = document.getElementById("cropZoom");
const regularArcanaOptions = Array.from(document.querySelectorAll(".arcana-option:not(.natural-option):not(.unknown-option)"));
const naturalArcanaOption = document.querySelector(".arcana-option.natural-option");
const unknownArcanaOption = document.querySelector(".arcana-option.unknown-option");
const presidentOtherArcana = document.getElementById("presidentOtherArcana");
const template = window.RNCCharacterStore.template;
const textFields = Object.entries(template).filter(function(group) { return group[0] !== "stats"; })
  .flatMap(function(group) { return group[1]; });
const existingId = new URLSearchParams(location.search).get("id");
const store = window.RNCCharacterStore;
const storedCharacter = existingId ? store.getById(existingId) : null;
const legacyCharacter = existingId && String(existingId).startsWith("oc-")
  ? store.getLegacyById(existingId) : null;
const existing = storedCharacter || legacyCharacter || null;
const isLegacyExisting = Boolean(!storedCharacter && legacyCharacter);
const staffEditorMode = window.__RNC_BOOTSTRAP__?.staffMode === true;
const imageLayoutEditor = document.querySelector(".image-layout-editor");
imageLayoutEditor.hidden = !staffEditorMode;
imageLayoutEditor.querySelectorAll("input,select,button").forEach(function(control) {
  control.disabled = !staffEditorMode;
});
let employeeEditor = null;
const managementSection = document.createElement("section");
managementSection.className = "editor-section editor-management";
managementSection.innerHTML = '<div class="section-heading"><span>✦</span><div><p>CHARACTER CLASSIFICATION</p><h2>ประเภทตัวละคร</h2></div></div><div class="form-grid"><label>ประเภท<select name="characterType"></select></label></div>';
const typeSelect = managementSection.querySelector('[name="characterType"]');
(staffEditorMode ? ["Character", "Human", "President", "Director", "NPC", "Magus", "Monster"] : ["Character", "Human"]).forEach(type => typeSelect.add(new Option(type === "Character" ? "Arcanist" : type === "Monster" ? "Enemy" : type, type)));
const requestedEnemy = staffEditorMode && new URLSearchParams(location.search).get("type") === "Monster";
typeSelect.value = existing?.characterType || (requestedEnemy ? "Monster" : existing?.race === "Human" ? "Human" : "Character");
presidentOtherArcana.checked = staffEditorMode && typeSelect.value === "President" && Boolean(existing?.arcana && existing.arcana !== "UNKNOWN");
if (staffEditorMode) {
  const fields = managementSection.querySelector(".form-grid");
  const addSelect = (labelText, name, choices, value) => {
    const label = document.createElement("label"), select = document.createElement("select"); label.textContent = labelText; select.name = name;
    choices.forEach(([key, text]) => select.add(new Option(text, key))); select.value = value == null ? "" : String(value); label.append(select); fields.append(label); return select;
  };
  const editorData = window.__RNC_BOOTSTRAP__.editorData || {};
  addSelect("เจ้าของตัวละคร", "staffOwnerId", [["", "ตัวละครของ Community / ไม่มีเจ้าของ"], ...(editorData.users || []).map(user => [user.id, user.displayName || user.username])], existing ? existing.ownerId : window.__RNC_BOOTSTRAP__.currentUser.id);

}
const enemySection = document.createElement("section");
enemySection.className = "editor-section enemy-editor-section";
enemySection.id = "enemyEditor";
enemySection.hidden = true;
enemySection.innerHTML = `
  <div class="section-heading"><span>EN</span><div><p>ENEMY RECORD</p><h2>ข้อมูล Enemy</h2></div></div>
  <div class="form-grid">
    <label class="wide">ชื่อ Enemy *<input name="enemyName" maxlength="80" required placeholder="ชื่อ Enemy"></label>
    <label>ประเภท<select name="enemySubtype" required><option value="">เลือกประเภท</option><option>Critter</option><option>Arcanoid</option><option>Magus Sacramentum</option></select></label>
    <label>HP<input name="enemyHp" type="number" min="0" max="999999" step="1" required></label>
    <label>ธาตุ<select name="enemyArcana"><option value="NATURAL">Natural</option><option value="BEAST">Beast</option><option value="PLANT">Plant</option><option value="STAR">Star</option><option value="MINERAL">Mineral</option><option value="SPIRIT">Spirit</option><option value="INTELLECT">Intellect</option></select></label>
    <label class="enemy-boss-toggle"><input name="enemyIsBoss" type="checkbox"><span>เป็น Boss</span></label>
  </div>
  <div class="enemy-stat-fields"><p>Stats</p><div class="stats-inputs">
    <label>CORE<input data-enemy-stat="COR" type="number" min="0" max="999" step="1" value="0"></label>
    <label>MNF<input data-enemy-stat="MNF" type="number" min="0" max="999" step="1" value="0"></label>
    <label>RFX<input data-enemy-stat="RFX" type="number" min="0" max="999" step="1" value="0"></label>
    <label>SCR<input data-enemy-stat="SCR" type="number" min="0" max="999" step="1" value="0"></label>
    <label>DEF<input data-enemy-stat="DEF" type="number" min="0" max="999" step="1" value="0"></label>
  </div></div>
  <label class="enemy-description-field">Field Notes<textarea name="enemyDescription" rows="6" maxlength="5000" placeholder="รายละเอียดของ Enemy"></textarea></label>
`;
if (staffEditorMode) {
  document.getElementById("identity").before(managementSection);
  managementSection.after(enemySection);
} else {
  document.getElementById("identity").before(enemySection);
}
const normalSections = ["identity", "stats", "medium", "personality", "history", "contact"].map(id => document.getElementById(id));
const normalSectionDefaults = new Map(normalSections.map(section => [section, section.hidden]));
const sectionLinks = Array.from(document.querySelectorAll(".editor-sections a"));
const sectionLinkDefaults = new Map(sectionLinks.map(link => [link, link.hidden]));
const defaultEditorHelp = document.querySelector(".editor-help").textContent;
function updateTypePresentation() {
  const isEnemy = staffEditorMode && typeSelect.value === "Monster";
  enemySection.hidden = !isEnemy;
  enemySection.querySelectorAll("input,select,textarea").forEach(control => { control.disabled = !isEnemy; });
  normalSections.forEach(section => {
    const hiddenForEnemy = isEnemy && section.id !== "medium";
    section.hidden = hiddenForEnemy || normalSectionDefaults.get(section);
    section.inert = hiddenForEnemy;
    section.querySelectorAll("input,select,textarea").forEach(control => { control.disabled = hiddenForEnemy; if (hiddenForEnemy) control.required = false; });
  });
  sectionLinks.forEach(link => { link.hidden = (isEnemy && link.getAttribute("href") !== "#medium") || sectionLinkDefaults.get(link); });
  document.querySelector(".editor-help").textContent = isEnemy ? "กรอกข้อมูล Enemy ค่าสถานะ รูป และสกิลที่ต้องการแสดงในแฟ้ม" : defaultEditorHelp;
  document.getElementById("medium").classList.toggle("enemy-editor-skills", isEnemy);
  document.querySelector("#medium .section-heading h2").textContent = isEnemy ? "สกิล Enemy" : "สกิลตัวละคร";
  imageLayoutEditor.dataset.enemy = String(isEnemy);
  cropButton.hidden = false;
  updateCropButton();
  form.elements.name.required = !isEnemy;
  form.elements.enemyName.required = isEnemy;
  form.elements.enemySubtype.required = isEnemy;
  form.elements.enemyHp.required = isEnemy;
  const humanRaceOption = Array.from(form.elements.race.options).find(option => option.value === "Human");
  if (humanRaceOption) {
    const hideHumanRace = staffEditorMode && typeSelect.value === "Character";
    humanRaceOption.hidden = hideHumanRace;
    humanRaceOption.disabled = hideHumanRace;
    if (hideHumanRace && form.elements.race.value === "Human") form.elements.race.value = "";
  }
  updateArcanaForRace();
  if (isEnemy) {
    normalSections.forEach(section => {
      if (section.id !== "medium") section.querySelectorAll("input,select,textarea").forEach(control => { control.disabled = true; });
    });
    document.querySelectorAll(".medium-fields, .ability-limitations-fields").forEach(group => {
      group.hidden = true;
      group.querySelectorAll("input,textarea").forEach(control => { control.disabled = true; });
    });
  }
  updateImageLayoutPreview();
  if (staffEditorMode) {
    form.elements.staffOwnerId.closest("label").hidden = isEnemy;
    document.querySelector(".editor-kicker").textContent = isEnemy ? "ENEMY RECORD" : "CHARACTER RECORD";
    document.getElementById("editorHeading").textContent = isEnemy ? (existing ? "Edit Enemy" : "Create Enemy") : (existing ? "Edit Character" : "Create Character");
    document.getElementById("editorMode").textContent = isEnemy ? "ENEMY RECORD" : "STAFF CHARACTER FILE";
    document.getElementById("saveCharacter").textContent = isEnemy ? "Save Enemy" : "Save Character";
  }
}
typeSelect.addEventListener("change", () => {
  if (typeSelect.value === "Human") form.elements.race.value = "Human";
  else if (typeSelect.value === "Character" && form.elements.race.value === "Human") form.elements.race.value = "";
  if (staffEditorMode && !existing) form.elements.staffOwnerId.value = ["Character", "Human"].includes(typeSelect.value) ? window.__RNC_BOOTSTRAP__.currentUser.id : "";
  updateTypePresentation();
});
form.elements.race.addEventListener("change", () => {
  if (["Character", "Human"].includes(typeSelect.value)) {
    typeSelect.value = form.elements.race.value === "Human" ? "Human" : "Character";
    updateTypePresentation();
  }
});
const skillImages = Array.from({ length: 4 }, function(_, index) {
  return existing && Array.isArray(existing.skillImages) ? existing.skillImages[index] || "" : "";
});
const SKILL_CROP_KEYS = ["arcane1", "arcane2", "ultimate", "arcane3"];
function normalizeSkillCrop(value) {
  const source = value && typeof value === "object" ? value : {};
  const clamp = (raw, fallback, min, max) => {
    const number = Number(raw);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  };
  return { scale: clamp(source.scale, 1, 1, 3), x: clamp(source.x, 50, 0, 100), y: clamp(source.y, 50, 0, 100) };
}
const skillImageCrops = SKILL_CROP_KEYS.map(key => normalizeSkillCrop(existing?.skillDetails?.[key]?.imageCrop));
const removedSkillImages = new Set();
const removedWeaponImages = new Set();
const imagePreparationJobs = new Map();
let imagePreparationSaveLabel = null;

function updateImagePreparationControls() {
  const button = document.getElementById("saveCharacter");
  if (button.classList.contains("is-saving")) return;
  const preparing = imagePreparationJobs.size > 0;
  if (preparing && imagePreparationSaveLabel === null) imagePreparationSaveLabel = button.textContent;
  button.disabled = preparing;
  button.setAttribute("aria-busy", String(preparing));
  if (preparing) button.textContent = "กำลังเตรียมรูป…";
  else if (imagePreparationSaveLabel !== null) {
    button.textContent = imagePreparationSaveLabel;
    imagePreparationSaveLabel = null;
  }
}

function beginImagePreparation(key) {
  const job = Symbol(key);
  imagePreparationJobs.set(key, job);
  updateImagePreparationControls();
  return job;
}

function finishImagePreparation(key, job) {
  if (imagePreparationJobs.get(key) !== job) return;
  imagePreparationJobs.delete(key);
  updateImagePreparationControls();
}

function cancelImagePreparation(key) {
  imagePreparationJobs.delete(key);
  updateImagePreparationControls();
}

let previousArcana = existing && existing.arcana && existing.arcana !== "NATURAL" ? existing.arcana : "SPIRIT";
let previousArcanaType = typeSelect.value;
let portraitImage = existing && existing.image ? existing.image : "";
let galleryImage = existing && existing.galleryImage ? existing.galleryImage : "";
let galleryCrop = existing && existing.galleryCrop ? existing.galleryCrop : null;
let imageLayout = window.RNCImageLayout.normalize(existing && existing.imageLayout);
let cropSource = null;
let cropOffsetX = 0;
let cropOffsetY = 0;
let cropDrag = null;
let cropEnemyLayout = null;
let cropLoadSerial = 0;
const humanWeaponsList = document.getElementById("humanWeaponsList");
const humanWeaponsEditor = document.getElementById("humanWeaponsEditor");
const humanWeaponArcana = [
  ["BEAST", "Beast", "Beast.png"], ["PLANT", "Plant", "Plant.png"], ["STAR", "Star", "Star.png"],
  ["MINERAL", "Mineral", "Mineral.png"], ["SPIRIT", "Spirit", "Spirit.png"], ["INTELLECT", "Intellect", "Intel.png"],
];
function newWeaponId() {
  return "weapon-" + (window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).slice(2, 14));
}
let humanWeapons = (existing && Array.isArray(existing.weapons) ? existing.weapons : existing?.weaponName ? [{
  id: "legacy-0", name: existing.weaponName, arcana: existing.weaponArcana || "", description: existing.weaponDescription || "", stats: {}, image: "",
}] : []).slice(0, 2).map(function(weapon) {
  const stats = weapon.stats && typeof weapon.stats === "object" ? weapon.stats : {};
  return {
    id: /^[A-Za-z0-9_-]{1,40}$/.test(String(weapon.id || "")) ? String(weapon.id) : newWeaponId(),
    name: typeof weapon.name === "string" ? weapon.name : "",
    arcana: typeof weapon.arcana === "string" ? weapon.arcana : "",
    description: typeof weapon.description === "string" ? weapon.description : "",
    stats: { COR: Number(stats.COR) || 0, MNF: Number(stats.MNF) || 0, SCR: Number(stats.SCR) || 0 },
    image: typeof weapon.image === "string" ? weapon.image : "",
  };
});

humanWeaponsList.addEventListener("input", function(event) {
  const control = event.target;
  if (!(control instanceof HTMLInputElement) && !(control instanceof HTMLTextAreaElement)) return;
  const card = control.closest("[data-human-weapon-card]");
  const weapon = card && humanWeapons.find(function(item) { return item.id === card.dataset.weaponId; });
  if (!weapon) return;
  const field = control.dataset.weaponField;
  if (field === "name" || field === "description") weapon[field] = control.value;
  else if (field === "arcana" && control.checked) weapon.arcana = control.value;
  const stat = control.dataset.weaponStat;
  if (["COR", "MNF", "SCR"].includes(stat)) {
    weapon.stats[stat] = Math.max(0, Math.min(999, Math.floor(Number(control.value) || 0)));
  }
});

function createWeaponField(labelText, control, className) {
  const label = document.createElement("label");
  label.className = className || "";
  label.append(document.createTextNode(labelText), control);
  return label;
}

function updateHumanWeaponControls() {
  const hidden = humanWeaponsEditor.hidden;
  humanWeaponsList.querySelectorAll("input,textarea,button").forEach(control => { control.disabled = hidden; });
  const addButton = document.getElementById("addHumanWeapon");
  addButton.disabled = hidden || humanWeapons.length >= 2;
  addButton.hidden = addButton.disabled;
}

function renderHumanWeapons() {
  humanWeaponsList.replaceChildren();
  humanWeapons.forEach(function(weapon, index) {
    const card = document.createElement("article");
    card.className = "human-weapon-card";
    card.dataset.humanWeaponCard = "";
    card.dataset.weaponId = weapon.id;

    const header = document.createElement("header");
    const title = document.createElement("h3");
    title.textContent = "อาวุธชิ้นที่ " + (index + 1);
    const removeWeapon = document.createElement("button");
    removeWeapon.type = "button";
    removeWeapon.className = "human-weapon-remove";
    removeWeapon.dataset.weaponRemove = "";
    removeWeapon.textContent = "นำอาวุธออก";
    removeWeapon.setAttribute("aria-label", "นำอาวุธชิ้นที่ " + (index + 1) + " ออก");
    header.append(title, removeWeapon);

    const layout = document.createElement("div");
    layout.className = "human-weapon-layout";
    const imageArea = document.createElement("div");
    imageArea.className = "human-weapon-photo-area";
    const imageButton = document.createElement("button");
    imageButton.type = "button";
    imageButton.className = "human-weapon-image-button";
    imageButton.dataset.weaponImageTrigger = "";
    imageButton.setAttribute("aria-label", "เลือกรูปอาวุธชิ้นที่ " + (index + 1));
    const image = document.createElement("img");
    image.alt = "";
    image.hidden = !weapon.image;
    if (weapon.image) image.src = weapon.image;
    const prompt = document.createElement("span");
    prompt.textContent = weapon.image ? "เปลี่ยนรูปอาวุธ" : "เพิ่มรูปอาวุธ";
    imageButton.append(image, prompt);
    const file = document.createElement("input");
    file.type = "file";
    file.accept = "image/png,image/jpeg,image/webp";
    file.hidden = true;
    file.dataset.weaponImageInput = "";
    file.setAttribute("aria-label", "ไฟล์รูปอาวุธชิ้นที่ " + (index + 1));
    imageArea.append(imageButton, file);
    if (weapon.image) {
      const removeImage = document.createElement("button");
      removeImage.type = "button";
      removeImage.className = "human-weapon-remove-image";
      removeImage.dataset.weaponRemoveImage = "";
      removeImage.textContent = "เอารูปออก";
      imageArea.append(removeImage);
    }

    const fields = document.createElement("div");
    fields.className = "human-weapon-fields-grid";
    const name = document.createElement("input");
    name.type = "text";
    name.maxLength = 120;
    name.required = true;
    name.value = weapon.name;
    name.placeholder = "ชื่ออาวุธ";
    name.dataset.weaponField = "name";
    fields.append(createWeaponField("ชื่ออาวุธ *", name, "human-weapon-name"));

    const elementGroup = document.createElement("fieldset");
    elementGroup.className = "human-weapon-element-group";
    const legend = document.createElement("legend");
    legend.textContent = "ธาตุของอาวุธ *";
    const options = document.createElement("div");
    options.className = "human-weapon-element-options";
    humanWeaponArcana.forEach(function(element) {
      const option = document.createElement("label");
      option.className = "human-weapon-element-option";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "weapon-arcana-" + weapon.id;
      radio.value = element[0];
      radio.checked = weapon.arcana === element[0];
      radio.required = true;
      radio.dataset.weaponField = "arcana";
      const icon = document.createElement("img");
      icon.src = "/assets/RNCelement/" + element[2];
      icon.alt = "";
      icon.title = element[1];
      const name = document.createElement("span");
      name.className = "human-weapon-element-name";
      name.textContent = element[1];
      option.append(radio, icon, name);
      options.append(option);
    });
    elementGroup.append(legend, options);
    fields.append(elementGroup);

    const description = document.createElement("textarea");
    description.rows = 3;
    description.maxLength = 5000;
    description.placeholder = "คำอธิบายอาวุธ";
    description.value = weapon.description;
    description.dataset.weaponField = "description";
    fields.append(createWeaponField("คำอธิบายอาวุธ", description, "human-weapon-description"));

    const stats = document.createElement("div");
    stats.className = "human-weapon-stats";
    ["COR", "MNF", "SCR"].forEach(function(key) {
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = "999";
      input.step = "1";
      input.value = String(Math.max(0, Math.min(999, Math.floor(Number(weapon.stats[key]) || 0))));
      input.dataset.weaponStat = key;
      stats.append(createWeaponField(key === "COR" ? "CORE" : key, input));
    });
    fields.append(stats);
    layout.append(imageArea, fields);
    card.append(header, layout);
    humanWeaponsList.append(card);

    imageButton.addEventListener("click", function() { file.click(); });
    file.addEventListener("change", async function() {
      const selected = file.files && file.files[0];
      if (!selected) return;
      file.value = "";
      const key = "weapon-" + weapon.id;
      const job = beginImagePreparation(key);
      try {
        const source = await scaleImage(selected, { maxWidth: 900, maxHeight: 900, quality: .75 });
        if (imagePreparationJobs.get(key) !== job) return;
        const current = humanWeapons.find(function(item) { return item.id === weapon.id; });
        if (current) {
          current.image = source;
          removedWeaponImages.delete(current.id);
        }
        renderHumanWeapons();
        setError("");
      } catch (error) {
        if (imagePreparationJobs.get(key) === job) setError(error instanceof Error ? error.message : "อ่านรูปอาวุธไม่สำเร็จ");
      } finally {
        finishImagePreparation(key, job);
      }
    });
    removeWeapon.addEventListener("click", function() {
      cancelImagePreparation("weapon-" + weapon.id);
      humanWeapons = humanWeapons.filter(function(item) { return item.id !== weapon.id; });
      renderHumanWeapons();
    });
    const removeImage = imageArea.querySelector("[data-weapon-remove-image]");
    if (removeImage) removeImage.addEventListener("click", function() {
      cancelImagePreparation("weapon-" + weapon.id);
      const current = humanWeapons.find(function(item) { return item.id === weapon.id; });
      if (current) {
        current.image = "";
        removedWeaponImages.add(current.id);
      }
      renderHumanWeapons();
    });
  });
  document.getElementById("humanWeaponCount").textContent = humanWeapons.length + " / 2 อาวุธ";
  updateHumanWeaponControls();
}

function collectHumanWeapons() {
  return Array.from(humanWeaponsList.querySelectorAll("[data-human-weapon-card]")).map(function(card) {
    const saved = humanWeapons.find(function(item) { return item.id === card.dataset.weaponId; });
    const selectedArcana = card.querySelector('[data-weapon-field="arcana"]:checked');
    const stats = {};
    card.querySelectorAll("[data-weapon-stat]").forEach(function(input) {
      stats[input.dataset.weaponStat] = Math.max(0, Math.min(999, Math.floor(Number(input.value) || 0)));
    });
    return {
      id: card.dataset.weaponId,
      name: card.querySelector('[data-weapon-field="name"]').value.trim(),
      arcana: selectedArcana ? selectedArcana.value : "",
      description: card.querySelector('[data-weapon-field="description"]').value.trim(),
      stats,
      image: saved ? saved.image : "",
    };
  });
}

document.getElementById("addHumanWeapon").addEventListener("click", function() {
  if (humanWeapons.length >= 2) return;
  humanWeapons.push({ id: newWeaponId(), name: "", arcana: "", description: "", stats: { COR: 0, MNF: 0, SCR: 0 }, image: "" });
  renderHumanWeapons();
});
renderHumanWeapons();

function setError(message) {
  const error = document.getElementById("saveError");
  error.textContent = message;
  error.hidden = !message;
}

let imageLayoutPreviewSerial = 0;
function updateImageLayoutPreview() {
  const serial = ++imageLayoutPreviewSerial;
  const view = document.getElementById("imageLayoutContext").value;
  const preview = document.getElementById("imageLayoutPreview");
  const previewImage = document.getElementById("imageLayoutPreviewImage");
  const previewEmpty = document.getElementById("imageLayoutPreviewEmpty");
  const layout = imageLayout[view];
  const enemyGallery = typeSelect.value === "Monster" && view.startsWith("gallery");
  const source = enemyGallery ? (portraitImage || galleryImage) : view.startsWith("gallery") ? (galleryImage || portraitImage) : view === "relationships" ? (portraitImage || galleryImage) : portraitImage;
  const fit = enemyGallery || view === "profile" || view === "staffCard" ? "contain" : "cover";
  const relationshipPreview = document.getElementById("relationshipImageLayoutPreview");
  const relationships = view === "relationships";
  preview.dataset.view = view;
  previewImage.hidden = !source || relationships;
  relationshipPreview.hidden = !relationships || !source;
  document.getElementById("relationshipImageLayoutHint").hidden = !relationships;
  previewEmpty.hidden = Boolean(source);
  if (source && previewImage.src !== new URL(source, location.href).href) previewImage.src = source;
  previewImage.style.objectFit = fit;
  window.RNCImageLayout.apply(previewImage, { imageLayout }, view);
  if (relationships && source) {
    window.RNCRelationshipPortrait.load(source).then(original => {
      if (serial !== imageLayoutPreviewSerial || !original) return;
      relationshipPreview.replaceChildren(window.RNCRelationshipPortrait.render(original, imageLayout.relationships));
    });
  } else relationshipPreview.replaceChildren();

  document.getElementById("imageLayoutScale").value = String(Math.round(layout.scale * 100));
  document.getElementById("imageLayoutX").value = String(Math.round(layout.x));
  document.getElementById("imageLayoutY").value = String(Math.round(layout.y));
  document.getElementById("imageLayoutScaleOutput").textContent = Math.round(layout.scale * 100) + "%";
  document.getElementById("imageLayoutXOutput").textContent = Math.round(layout.x) + "%";
  document.getElementById("imageLayoutYOutput").textContent = Math.round(layout.y) + "%";
}


function updatePreview(source) {
  if (!source) {
    preview.style.removeProperty("background-image");
    preview.style.removeProperty("background-size");
    return;
  }
  preview.style.backgroundImage = "url(" + JSON.stringify(source) + ")";
  preview.style.backgroundSize = "contain";
  preview.style.backgroundPosition = "center";
}

function applySkillCropStyle(element, crop) {
  if (window.RNCSkillCrop) window.RNCSkillCrop.apply(element, crop);
}

function updateSkillPreviews() {
  document.querySelectorAll("[data-skill-editor-art]").forEach(function(image) {
    const index = Number(image.dataset.skillEditorArt);
    const source = skillImages[index] || "";
    const cropWindow = document.querySelector('[data-skill-editor-window="' + index + '"]');
    const zoomControl = document.querySelector('[data-skill-zoom-control="' + index + '"]');
    const zoomInput = document.querySelector('[data-skill-zoom="' + index + '"]');
    const zoomOutput = document.querySelector('[data-skill-zoom-output="' + index + '"]');
    const crop = skillImageCrops[index];
    if (cropWindow) cropWindow.hidden = !source;
    if (zoomControl) zoomControl.hidden = !source;
    if (zoomInput && document.activeElement !== zoomInput) zoomInput.value = String(Math.round(crop.scale * 100));
    if (zoomOutput) zoomOutput.textContent = Math.round(crop.scale * 100) + "%";
    if (source) {
      if (image.getAttribute("src") !== source) image.src = source;
    } else {
      image.removeAttribute("src");
    }
    applySkillCropStyle(cropWindow, crop);
    const card = image.closest(".skill-upload-card");
    if (card) card.dataset.hasImage = String(Boolean(source));
  });
}

const skillPreviewDrags = new WeakMap();
document.querySelectorAll("[data-skill-upload-trigger]").forEach(function(button) {
  const index = Number(button.dataset.skillUploadTrigger);
  button.addEventListener("pointerdown", function(event) {
    if (!skillImages[index] || (event.pointerType === "mouse" && event.button !== 0)) return;
    const cropWindow = document.querySelector('[data-skill-editor-window="' + index + '"]');
    const bounds = window.RNCSkillCrop ? window.RNCSkillCrop.measure(cropWindow, skillImageCrops[index]) : { x: 0, y: 0 };
    skillPreviewDrags.set(button, {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: skillImageCrops[index].x,
      y: skillImageCrops[index].y,
      maxPanX: bounds.x,
      maxPanY: bounds.y,
      moved: false,
    });
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener("pointermove", function(event) {
    const drag = skillPreviewDrags.get(button);
    if (!drag || drag.id !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) > 4) {
      drag.moved = true;
      button.dataset.skillDragged = "true";
    }
    if (!drag.moved) return;
    const crop = skillImageCrops[index];
    const cropWindow = document.querySelector('[data-skill-editor-window="' + index + '"]');
    const bounds = window.RNCSkillCrop ? window.RNCSkillCrop.measure(cropWindow, crop) : { x: 0, y: 0 };
    const startOffsetX = (50 - drag.x) / 50 * drag.maxPanX;
    const startOffsetY = (50 - drag.y) / 50 * drag.maxPanY;
    const targetOffsetX = Math.min(bounds.x, Math.max(-bounds.x, startOffsetX + deltaX));
    const targetOffsetY = Math.min(bounds.y, Math.max(-bounds.y, startOffsetY + deltaY));
    crop.x = bounds.x > 0 ? 50 - targetOffsetX / bounds.x * 50 : 50;
    crop.y = bounds.y > 0 ? 50 - targetOffsetY / bounds.y * 50 : 50;
    updateSkillPreviews();
    event.preventDefault();
  });
  button.addEventListener("pointerup", function() { skillPreviewDrags.delete(button); });
  button.addEventListener("pointercancel", function() {
    skillPreviewDrags.delete(button);
    delete button.dataset.skillDragged;
  });
  button.addEventListener("lostpointercapture", function() { skillPreviewDrags.delete(button); });
  button.addEventListener("click", function(event) {
    if (button.dataset.skillDragged === "true") {
      delete button.dataset.skillDragged;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const input = document.querySelector('[data-skill-editor-input="' + index + '"]');
    if (input) input.click();
  });
});

function updateSkillScaleKeepingPosition(index, nextScale) {
  const cropWindow = document.querySelector('[data-skill-editor-window="' + index + '"]');
  const crop = skillImageCrops[index];
  const before = window.RNCSkillCrop ? window.RNCSkillCrop.measure(cropWindow, crop) : { x: 0, y: 0 };
  const offsetX = (50 - crop.x) / 50 * before.x;
  const offsetY = (50 - crop.y) / 50 * before.y;
  crop.scale = Math.min(3, Math.max(1, nextScale));
  const after = window.RNCSkillCrop ? window.RNCSkillCrop.measure(cropWindow, crop) : { x: 0, y: 0 };
  const preservedX = Math.min(after.x, Math.max(-after.x, offsetX));
  const preservedY = Math.min(after.y, Math.max(-after.y, offsetY));
  crop.x = after.x > 0 ? 50 - preservedX / after.x * 50 : 50;
  crop.y = after.y > 0 ? 50 - preservedY / after.y * 50 : 50;
}

document.querySelectorAll("[data-skill-zoom]").forEach(function(input) {
  input.addEventListener("input", function() {
    const index = Number(input.dataset.skillZoom);
    updateSkillScaleKeepingPosition(index, Number(input.value) / 100);
    updateSkillPreviews();
  });
});

function updateCropButton() {
  cropButton.disabled = !portraitImage;
  cropButton.textContent = typeSelect.value === "Monster"
    ? "จัดภาพ Enemy ใน Gallery"
    : galleryImage ? "ปรับภาพ Gallery อีกครั้ง" : "จัดภาพสำหรับ Gallery";
}

function canSelectUnknownArcana() {
  return staffEditorMode && ["President", "Magus"].includes(typeSelect.value);
}

function updateArcanaForRace() {
  const isHuman = typeSelect.value !== "Monster" && (typeSelect.value === "Human" || form.elements.race.value === "Human");
  const isNpc = staffEditorMode && typeSelect.value === "NPC";
  const allowUnknown = canSelectUnknownArcana();
  const isPresident = staffEditorMode && typeSelect.value === "President";
  if (previousArcanaType !== typeSelect.value) {
    presidentOtherArcana.checked = false;
    previousArcanaType = typeSelect.value;
  }
  presidentOtherArcana.closest("label").hidden = !isPresident;
  presidentOtherArcana.disabled = !isPresident;
  const unknownOnly = isPresident && !presidentOtherArcana.checked;
  form.elements.position.required = !isHuman && typeSelect.value === "Character";
  form.elements.race.required = ["Character", "Human"].includes(typeSelect.value);
  document.querySelector(".medium-fields").hidden = isHuman;
  document.querySelector(".ability-limitations-fields").hidden = isHuman;
  humanWeaponsEditor.hidden = !isHuman;
  updateHumanWeaponControls();
  document.getElementById("characterStatsFields").hidden = isHuman;
  document.getElementById("statsSectionKicker").textContent = isHuman ? "HUMAN EQUIPMENT" : "Base Stats";
  document.getElementById("statsSectionTitle").textContent = isHuman ? "รายการอาวุธ" : "ค่าสถานะ";
  document.getElementById("statsSectionDescription").textContent = isHuman
    ? "Human ถืออาวุธได้สูงสุด 2 ชิ้น ระบุธาตุ รายละเอียด รูป และค่า CORE, MNF, SCR ของแต่ละชิ้น"
    : "กรอก COR, MNF, RFX, SCR และ DEF ตามตัวละคร ยอดรวมจะคำนวณให้อัตโนมัติ";
  document.getElementById("statsSectionLink").textContent = isHuman ? "02  รายการอาวุธ" : "02  ค่าสถานะ";
  document.getElementById("skillsSectionLink").textContent = typeSelect.value === "Monster" ? "สกิล Enemy" : isHuman ? "03  สกิลและอัลติเมท" : "03  Skills & Equipment";
  if (form.elements.arcana.value !== "NATURAL" || isNpc) previousArcana = form.elements.arcana.value || previousArcana;
  if (previousArcana === "UNKNOWN" && !allowUnknown) previousArcana = "SPIRIT";
  if (previousArcana === "NATURAL" && !isNpc) previousArcana = "SPIRIT";
  if (unknownOnly) previousArcana = "UNKNOWN";
  regularArcanaOptions.forEach(function(option) {
    option.hidden = isHuman || unknownOnly;
    option.querySelector("input").disabled = isHuman || unknownOnly;
  });
  naturalArcanaOption.hidden = !(isHuman || isNpc) || unknownOnly;
  naturalArcanaOption.querySelector("input").disabled = !(isHuman || isNpc) || unknownOnly;
  unknownArcanaOption.hidden = !allowUnknown;
  unknownArcanaOption.querySelector("input").disabled = !allowUnknown;
  const selected = allowUnknown && previousArcana === "UNKNOWN" ? "UNKNOWN" : isHuman ? "NATURAL" : previousArcana;
  const inputs = Array.from(form.querySelectorAll('input[name="arcana"]'));
  inputs.forEach(function(option) { if (option.disabled) option.checked = false; });
  const input = inputs
    .find(function(option) { return option.value === selected && !option.disabled; });
  if (input) input.checked = true;
  employeeEditor?.sync();
}

function cropDimensions() {
  const areaWidth = cropCanvas.width * (cropEnemyLayout ? .84 : 1);
  const areaHeight = cropCanvas.height * (cropEnemyLayout ? .63 : 1);
  const fit = cropEnemyLayout
    ? Math.min(areaWidth / cropSource.width, areaHeight / cropSource.height)
    : Math.max(areaWidth / cropSource.width, areaHeight / cropSource.height);
  const scale = fit * Number(cropZoom.value);
  return { width: cropSource.width * scale, height: cropSource.height * scale, areaWidth, areaHeight };
}

function drawCrop() {
  if (!cropSource) return;
  const dimensions = cropDimensions();
  cropContext.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
  if (cropEnemyLayout) {
    cropEnemyLayout.scale = Number(cropZoom.value);
    // Match the gallery's artwork inset, contain fit, position and transform origin.
    cropContext.drawImage(cropSource,
      cropCanvas.width * .08 + (dimensions.areaWidth - dimensions.width) * cropEnemyLayout.x / 100,
      cropCanvas.height * .06 + (dimensions.areaHeight - dimensions.height) * cropEnemyLayout.y / 100,
      dimensions.width, dimensions.height);
    document.getElementById("cropZoomOutput").textContent = Math.round(cropEnemyLayout.scale * 100) + "%";
    return;
  }
  const maxX = (dimensions.width - cropCanvas.width) / 2;
  const maxY = (dimensions.height - cropCanvas.height) / 2;
  cropOffsetX = Math.max(-maxX, Math.min(maxX, cropOffsetX));
  cropOffsetY = Math.max(-maxY, Math.min(maxY, cropOffsetY));
  cropContext.drawImage(cropSource,
    (cropCanvas.width - dimensions.width) / 2 + cropOffsetX,
    (cropCanvas.height - dimensions.height) / 2 + cropOffsetY,
    dimensions.width, dimensions.height);
}

function openCrop() {
  if (!portraitImage || imagePreparationJobs.has("portrait")) return;
  const serial = ++cropLoadSerial;
  const isEnemy = typeSelect.value === "Monster";
  const image = new Image();
  image.onload = function() {
    if (serial !== cropLoadSerial) return;
    cropSource = image;
    cropDrag = null;
    cropEnemyLayout = isEnemy ? { ...imageLayout.galleryDesktop } : null;
    cropDialog.dataset.enemy = String(isEnemy);
    cropCanvas.width = isEnemy ? 600 : 308;
    cropCanvas.height = isEnemy ? 600 : 712;
    cropZoom.min = isEnemy ? ".5" : "1";
    cropZoom.max = isEnemy ? "2" : "3";
    cropZoom.value = isEnemy ? String(cropEnemyLayout.scale) : galleryCrop ? galleryCrop.zoom : "1";
    cropOffsetX = galleryCrop ? galleryCrop.x : 0;
    cropOffsetY = galleryCrop ? galleryCrop.y : 0;
    document.getElementById("cropTitle").textContent = isEnemy ? "จัดภาพ Enemy" : "จัดภาพสำหรับ Gallery";
    cropDialog.querySelector(".crop-header p").textContent = isEnemy ? "ENEMY GALLERY" : "GALLERY IMAGE";
    cropDialog.querySelector(".crop-help").textContent = isEnemy
      ? "ลากภาพและปรับขนาดให้พอดีกับการ์ด"
      : "ลากรูปเพื่อจัดตำแหน่ง แล้วปรับขนาดให้พอดีกับการ์ด รูปเต็มยังใช้บนหน้าตัวละคร";
    document.getElementById("cropZoomLabel").textContent = isEnemy ? "ขนาดภาพ" : "Zoom";
    document.getElementById("cropZoomOutput").hidden = !isEnemy;
    document.getElementById("resetEnemyCrop").hidden = !isEnemy;
    document.getElementById("enemyCropInfo").hidden = !isEnemy;
    if (isEnemy) {
      const nameParts = form.elements.enemyName.value.split("|").map(part => part.trim());
      document.getElementById("enemyCropName").textContent = nameParts[0] || "Enemy";
      const localName = document.getElementById("enemyCropLocalName");
      localName.textContent = nameParts.slice(1).join(" | ");
      localName.hidden = !localName.textContent;
      document.getElementById("enemyCropSubtype").textContent = form.elements.enemySubtype.value || "Enemy";
      document.getElementById("enemyCropHp").textContent = "HP: " + Math.max(0, Number(form.elements.enemyHp.value) || 0);
      document.getElementById("enemyCropBoss").hidden = !form.elements.enemyIsBoss.checked;
      const arcanaInput = document.querySelector('.arcana-option input[value="' + form.elements.enemyArcana.value + '"]');
      const arcanaIcon = arcanaInput?.closest(".arcana-option")?.querySelector("img");
      const badge = document.getElementById("enemyCropArcana");
      badge.hidden = !arcanaIcon;
      if (arcanaIcon) badge.src = arcanaIcon.src;
    }
    drawCrop();
    if (!cropDialog.open) cropDialog.showModal();
  };
  image.onerror = function() {
    if (serial === cropLoadSerial) setError("เปิดรูปเพื่อจัดภาพ Gallery ไม่สำเร็จ กรุณาลองอีกครั้ง");
  };
  image.src = portraitImage;
}

function updateTotal() {
  const total = template.stats.reduce(function(sum, key) {
    return sum + (Number(form.elements[key].value) || 0);
  }, 0);
  document.getElementById("statsTotal").textContent = "TOTAL " + total;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(function(resolve, reject) {
    canvas.toBlob(function(blob) {
      if (blob) resolve(blob);
      else reject(new Error("Image processing failed. Please try another image."));
    }, type, quality);
  });
}

function blobToDataUrl(blob) {
  return new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.onerror = function() { reject(new Error("Image processing failed. Please try again.")); };
    reader.onload = function() { resolve(String(reader.result || "")); };
    reader.readAsDataURL(blob);
  });
}

async function compressCanvas(canvas, type, quality, maxBytes) {
  const targetBytes = maxBytes || 300 * 1024;
  const lowestQuality = Math.max(.4, quality - .32);
  let scale = 1;
  let currentQuality = quality;
  for (let attempt = 0; attempt < 30; attempt++) {
    const output = document.createElement("canvas");
    output.width = Math.max(1, Math.round(canvas.width * scale));
    output.height = Math.max(1, Math.round(canvas.height * scale));
    const context = output.getContext("2d");
    if (!context) throw new Error("Image processing failed. Please try another image.");
    context.drawImage(canvas, 0, 0, output.width, output.height);
    const blob = await canvasToBlob(output, type, currentQuality);
    if (blob.size <= targetBytes) return blobToDataUrl(blob);
    if (blob.type !== "image/png" && currentQuality > lowestQuality) currentQuality = Math.max(lowestQuality, currentQuality - .08);
    else {
      scale *= .82;
      currentQuality = quality;
    }
  }
  throw new Error("Image processing failed. Please try another image.");
}

async function scaleImage(file, options) {
  const settings = options || {};
  const maxWidth = settings.maxWidth || 1000;
  const maxHeight = settings.maxHeight || 1400;
  const quality = settings.quality || .78;
  const fileType = String(file && file.type || "").toLowerCase();
  const extension = String(file && file.name || "").split(".").pop().toLowerCase();
  const supportedExtensions = ["png", "jpg", "jpeg", "webp", "heic", "heif", "avif", "gif", "bmp", "tif", "tiff"];
  if (!file || (!fileType.startsWith("image/") && !supportedExtensions.includes(extension))) {
    throw new Error("Choose an image file that your browser can open.");
  }
  let decoded;
  try {
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file);
        decoded = { source: bitmap, width: bitmap.width, height: bitmap.height, release: function() { bitmap.close(); } };
      } catch {}
    }
    if (!decoded) {
      const url = URL.createObjectURL(file);
      const image = new Image();
      let timer;
      try {
        await new Promise(function(resolve, reject) {
          timer = setTimeout(function() { reject(new Error("เปิดรูปใช้เวลานาน กรุณาลองเลือกไฟล์อีกครั้ง")); }, 20000);
          image.onload = resolve;
          image.onerror = function() { reject(new Error("This browser couldn't open the image. Try PNG, JPEG, or WebP.")); };
          image.src = url;
        });
        decoded = { source: image, width: image.naturalWidth, height: image.naturalHeight, release: function() { URL.revokeObjectURL(url); } };
      } catch (error) {
        URL.revokeObjectURL(url);
        throw error;
      } finally {
        clearTimeout(timer);
        image.onload = null;
        image.onerror = null;
      }
    }
    if (!decoded.width || !decoded.height) throw new Error("This browser couldn't open the image. Try PNG, JPEG, or WebP.");
    const scale = Math.min(1, maxWidth / decoded.width, maxHeight / decoded.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing failed. Please try another image.");
    if (["image/jpeg", "image/jpg", "image/pjpeg"].includes(fileType) || ["jpg", "jpeg"].includes(extension)) {
      context.fillStyle = "#1b1b1d";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    return await compressCanvas(canvas, ["image/jpeg", "image/jpg", "image/pjpeg"].includes(fileType) || ["jpg", "jpeg"].includes(extension) ? "image/jpeg" : "image/webp", quality, settings.maxBytes);
  } catch (error) {
    throw error instanceof Error ? error : new Error("Image processing failed. Please try another image.");
  } finally {
    decoded?.release();
  }
}

fileInput.addEventListener("change", async function() {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;
  fileInput.value = "";
  const job = beginImagePreparation("portrait");
  cancelImagePreparation("gallery");
  cropLoadSerial++;
  try {
    const prepared = await scaleImage(file);
    if (imagePreparationJobs.get("portrait") !== job) return;
    portraitImage = prepared;
    galleryImage = "";
    galleryCrop = null;
    updatePreview(portraitImage);
    updateCropButton();
    updateImageLayoutPreview();
    setError("");
    finishImagePreparation("portrait", job);
    openCrop();
  } catch (error) {
    if (imagePreparationJobs.get("portrait") === job) {
      setError(error.message);
    }
  } finally {
    finishImagePreparation("portrait", job);
  }
});

document.querySelectorAll("[data-skill-editor-input]").forEach(function(input) {
  input.addEventListener("change", async function() {
    const file = input.files && input.files[0];
    const index = Number(input.dataset.skillEditorInput);
    if (!file) return;
    input.value = "";
    const key = "skill-" + index;
    const job = beginImagePreparation(key);
    try {
      const prepared = await scaleImage(file, { maxWidth: 1000, maxHeight: 1400, quality: .78 });
      if (imagePreparationJobs.get(key) !== job) return;
      skillImages[index] = prepared;
      skillImageCrops[index] = normalizeSkillCrop(null);
      removedSkillImages.delete(index);
      updateSkillPreviews();
      setError("");
    } catch (error) {
      if (imagePreparationJobs.get(key) === job) setError(error.message);
    } finally {
      finishImagePreparation(key, job);
    }
  });
});

document.querySelectorAll("[data-skill-editor-remove]").forEach(function(button) {
  button.addEventListener("click", function() {
    const index = Number(button.dataset.skillEditorRemove);
    cancelImagePreparation("skill-" + index);
    skillImages[index] = "";
    skillImageCrops[index] = normalizeSkillCrop(null);
    removedSkillImages.add(index);
    updateSkillPreviews();
  });
});

document.getElementById("removePortrait").addEventListener("click", function() {
  cancelImagePreparation("portrait");
  cancelImagePreparation("gallery");
  cropLoadSerial++;
  portraitImage = "";
  galleryImage = "";
  galleryCrop = null;
  fileInput.value = "";
  updatePreview("");
  updateCropButton();
  updateImageLayoutPreview();
});
cropButton.addEventListener("click", openCrop);
document.getElementById("closeCrop").addEventListener("click", function() { cropDialog.close(); });
document.getElementById("cancelCrop").addEventListener("click", function() { cropDialog.close(); });
document.getElementById("applyCrop").addEventListener("click", async function() {
  drawCrop();
  const button = this;
  button.disabled = true;
  const job = beginImagePreparation("gallery");
  try {
    if (cropEnemyLayout) {
      imageLayout.galleryDesktop = { ...cropEnemyLayout };
      imageLayout.galleryMobile = { ...cropEnemyLayout };
    } else {
      const prepared = await compressCanvas(cropCanvas, "image/webp", .82, 300 * 1024);
      if (imagePreparationJobs.get("gallery") !== job) return;
      galleryImage = prepared;
      galleryCrop = { zoom: Number(cropZoom.value), x: cropOffsetX, y: cropOffsetY };
    }
    updateCropButton();
    updateImageLayoutPreview();
    cropDialog.close();
  } catch (error) {
    if (imagePreparationJobs.get("gallery") === job) setError(error instanceof Error ? error.message : "Image processing failed. Please try again.");
  } finally {
    finishImagePreparation("gallery", job);
    button.disabled = false;
  }
});

document.getElementById("imageLayoutContext").addEventListener("change", updateImageLayoutPreview);
[
  ["imageLayoutScale", "scale"],
  ["imageLayoutX", "x"],
  ["imageLayoutY", "y"],
].forEach(function([id, key]) {
  document.getElementById(id).addEventListener("input", function(event) {
    const view = document.getElementById("imageLayoutContext").value;
    const value = Number(event.currentTarget.value);
    imageLayout[view][key] = key === "scale" ? value / 100 : value;
    updateImageLayoutPreview();
  });
});
document.getElementById("imageLayoutReset").addEventListener("click", function() {
  const view = document.getElementById("imageLayoutContext").value;
  imageLayout[view] = { ...window.RNCImageLayout.defaults[view] };
  updateImageLayoutPreview();
});
cropDialog.addEventListener("close", function() {
  cropDrag = null;
  cropSource = null;
  cropEnemyLayout = null;
  cropLoadSerial++;
});
document.getElementById("resetEnemyCrop").addEventListener("click", function() {
  if (!cropEnemyLayout) return;
  cropEnemyLayout = { ...window.RNCImageLayout.defaults.galleryDesktop };
  cropZoom.value = String(cropEnemyLayout.scale);
  drawCrop();
});
cropZoom.addEventListener("input", drawCrop);
cropCanvas.addEventListener("pointerdown", function(event) {
  cropCanvas.setPointerCapture(event.pointerId);
  cropDrag = { x: event.clientX, y: event.clientY };
});
cropCanvas.addEventListener("pointermove", function(event) {
  if (!cropDrag) return;
  const bounds = cropCanvas.getBoundingClientRect();
  const moveX = (event.clientX - cropDrag.x) * cropCanvas.width / bounds.width;
  const moveY = (event.clientY - cropDrag.y) * cropCanvas.height / bounds.height;
  if (cropEnemyLayout) {
    const dimensions = cropDimensions();
    const spaceX = dimensions.areaWidth - dimensions.width;
    const spaceY = dimensions.areaHeight - dimensions.height;
    if (Math.abs(spaceX) > 1) cropEnemyLayout.x = Math.max(0, Math.min(100, cropEnemyLayout.x + moveX / spaceX * 100));
    if (Math.abs(spaceY) > 1) cropEnemyLayout.y = Math.max(0, Math.min(100, cropEnemyLayout.y + moveY / spaceY * 100));
  } else {
    cropOffsetX += moveX;
    cropOffsetY += moveY;
  }
  cropDrag = { x: event.clientX, y: event.clientY };
  drawCrop();
});
cropCanvas.addEventListener("pointerup", function() { cropDrag = null; });
cropCanvas.addEventListener("pointercancel", function() { cropDrag = null; });
template.stats.forEach(function(key) {
  form.elements[key].addEventListener("input", updateTotal);
});
form.elements.race.addEventListener("change", updateArcanaForRace);
presidentOtherArcana.addEventListener("change", updateArcanaForRace);
form.elements.era.addEventListener("input", function() {
  const digits = this.value.replace(/\D/g, "").slice(0, 4);
  if (this.value !== digits) this.value = digits;
});

if (existing) {
  document.title = "Edit " + existing.name + " | Reverse : Noir Chronicle";
  document.getElementById("editorHeading").textContent = "Edit Character";
  document.getElementById("editorMode").textContent = "EDIT CHARACTER FILE";
  document.getElementById("saveCharacter").textContent = "บันทึกการแก้ไข";
  Object.keys(existing).forEach(function(key) {
    if (key !== "arcana" && form.elements[key] && typeof existing[key] === "string") {
      const control = form.elements[key];
      if (control.tagName === "SELECT" && existing[key] && !Array.from(control.options).some(function(option) { return option.value === existing[key]; })) {
        control.add(new Option(existing[key], existing[key]));
      }
      control.value = key === "era" ? String(existing[key]).replace(/\D/g, "").slice(0, 4) : existing[key];
    }
  });
  const legacyMeasurements = store.splitLegacyMeasurements(existing.heightWeight);
  if (!form.elements.height.value) form.elements.height.value = legacyMeasurements.height;
  if (!form.elements.weight.value) form.elements.weight.value = legacyMeasurements.weight;
  const selectedArcana = Array.from(form.querySelectorAll('input[name="arcana"]'))
    .find(function(input) { return input.value === existing.arcana; });
  if (selectedArcana) selectedArcana.checked = true;
  template.stats.forEach(function(key) {
    form.elements[key].value = existing.stats && existing.stats[key] != null ? existing.stats[key] : 0;
  });
  if (existing.enemyData && typeof existing.enemyData === "object") {
    const enemy = existing.enemyData;
    form.elements.enemyName.value = existing.name || "";
    form.elements.enemySubtype.value = ["Critter", "Arcanoid", "Magus Sacramentum"].includes(enemy.subtype) ? enemy.subtype : (["Critter", "Arcanoid", "Magus Sacramentum"].includes(existing.byname) ? existing.byname : "Critter");
    form.elements.enemyHp.value = Number.isInteger(Number(enemy.hp)) ? Number(enemy.hp) : 0;
    form.elements.enemyIsBoss.checked = enemy.isBoss === true;
    form.elements.enemyDescription.value = typeof enemy.description === "string" && enemy.description ? enemy.description : (existing.other || existing.quote || "");
    form.elements.enemyArcana.value = ["NATURAL", "BEAST", "PLANT", "STAR", "MINERAL", "SPIRIT", "INTELLECT"].includes(existing.arcana) ? existing.arcana : "NATURAL";
    document.querySelectorAll("[data-enemy-stat]").forEach(input => { input.value = existing.stats && existing.stats[input.dataset.enemyStat] != null ? existing.stats[input.dataset.enemyStat] : 0; });
  } else if (existing?.characterType === "Monster") {
    form.elements.enemyName.value = existing.name || "";
    form.elements.enemySubtype.value = ["Critter", "Arcanoid", "Magus Sacramentum"].includes(existing.byname) ? existing.byname : "Critter";
    form.elements.enemyDescription.value = existing.other || "";
    form.elements.enemyArcana.value = ["NATURAL", "BEAST", "PLANT", "STAR", "MINERAL", "SPIRIT", "INTELLECT"].includes(existing.arcana) ? existing.arcana : "NATURAL";
    document.querySelectorAll("[data-enemy-stat]").forEach(input => { input.value = existing.stats && existing.stats[input.dataset.enemyStat] != null ? existing.stats[input.dataset.enemyStat] : 0; });
  }
  if (existing.image || existing.galleryImage) updatePreview(existing.image || existing.galleryImage);
  updateTotal();
}

updateImageLayoutPreview();

const existingSkillDetails = existing && existing.skillDetails && typeof existing.skillDetails === "object"
  ? existing.skillDetails : {};
document.querySelectorAll("[data-skill-detail-name]").forEach(function(input) {
  const detail = existingSkillDetails[input.dataset.skillDetailName] || {};
  input.value = typeof detail.name === "string" ? detail.name : "";
  const description = document.querySelector('[data-skill-detail-description="' + input.dataset.skillDetailName + '"]');
  if (description) description.value = typeof detail.description === "string" ? detail.description : "";
});
updateCropButton();
employeeEditor = window.RNCEmployeeEditor.create({ form, existing, typeSelect });
updateTypePresentation();
updateSkillPreviews();

if (staffEditorMode) {
  const collectionButton = document.getElementById("openCharacterCollection");
  const canManageCollection = Boolean(existing && !isLegacyExisting && !String(existing.id || "").startsWith("oc-"));
  if (collectionButton) collectionButton.hidden = !canManageCollection;
  if (canManageCollection) form.classList.add("has-collection-tools");
  document.getElementById("editorHeading").textContent = existing ? "Edit Character" : "Create Character";
  document.getElementById("editorMode").textContent = "STAFF CHARACTER FILE";
  document.getElementById("saveCharacter").textContent = "บันทึกตัวละคร";
  const staffReturn = "/community/staff#characters";
  const back = document.querySelector(".editor-back"); back.href = staffReturn; back.textContent = "‹ กลับ Staff Console";
  document.querySelectorAll(".top-nav a[href=\"/community/rnc\"], .editor-actions > a").forEach(link => { link.href = staffReturn; });
  updateTypePresentation();
}
form.addEventListener("submit", async function(event) {
  event.preventDefault();
  if (existingId && !existing) {
    setError("ไม่พบตัวละครที่ต้องการแก้ไข กรุณากลับไปที่คลังตัวละครแล้วเปิดใหม่");
    return;
  }
  if (imagePreparationJobs.size) {
    setError("กำลังเตรียมรูป กรุณารอให้เสร็จก่อนบันทึก");
    return;
  }
  setError("");

  const saveButton = document.getElementById("saveCharacter");
  if (saveButton.disabled) return;
  const saveLabel = saveButton.textContent;
  saveButton.disabled = true;
  saveButton.textContent = "กำลังบันทึก…";
  saveButton.classList.add("is-saving");
  saveButton.setAttribute("aria-busy", "true");
  form.setAttribute("aria-busy", "true");
  form.querySelectorAll('[type="submit"]').forEach(button => { button.disabled = true; });
  const fields = [...textFields, "byname", "arcana"];
  const record = {};
  fields.forEach(function(key) { record[key] = String(form.elements[key].value || "").trim(); });
  record.nationalityCode = form.elements.nationalityCode.value;
  record.employeeEnabled = form.elements.employeeEnabled.checked;
  if (record.race === "Human" && !(canSelectUnknownArcana() && record.arcana === "UNKNOWN")) record.arcana = "NATURAL";
  record.rank = window.RNCCharacterStore.getRank(record);
  record.stats = {};
  template.stats.forEach(function(key) {
    record.stats[key] = typeSelect.value === "Human" ? 0 : Math.max(0, Number(form.elements[key].value) || 0);
  });
  record.image = portraitImage;
  record.galleryImage = galleryImage;
  record.galleryCrop = galleryCrop;
  record.imageLayout = imageLayout;
  if (staffEditorMode && typeSelect.value !== "Monster") {
    const savedScale = Number(existing?.heightChartScale);
    const savedOffset = Number(existing?.heightChartOffset);
    const savedXOffset = Number(existing?.heightChartXOffset);
    record.heightChartScale = Number.isFinite(savedScale) ? Math.max(0.5, Math.min(1.5, savedScale)) : 1;
    record.heightChartOffset = Number.isFinite(savedOffset) ? Math.max(-60, Math.min(60, savedOffset)) : 0;
    record.heightChartXOffset = Number.isFinite(savedXOffset) ? Math.max(-140, Math.min(140, savedXOffset)) : 0;
  }
  record.weapons = typeSelect.value !== "Monster" && (typeSelect.value === "Human" || record.race === "Human") ? collectHumanWeapons() : [];
  record.weaponName = record.weapons[0]?.name || "";
  record.weaponDescription = record.weapons[0]?.description || "";
  record.weaponArcana = record.weapons[0]?.arcana || "";
  record.skillImages = skillImages.slice();
  record.skillImageRemovals = Array.from(removedSkillImages);
  record.weaponImageRemovals = Array.from(removedWeaponImages);
  record.skillDetails = {};
  document.querySelectorAll("[data-skill-detail-name]").forEach(function(input) {
    const key = input.dataset.skillDetailName;
    const description = document.querySelector('[data-skill-detail-description="' + key + '"]');
    const index = SKILL_CROP_KEYS.indexOf(key);
    record.skillDetails[key] = {
      name: input.value.trim(),
      description: description ? description.value.trim() : "",
      imageCrop: normalizeSkillCrop(skillImageCrops[index]),
    };
  });
  if (isLegacyExisting) record.legacyId = existing.id;
  record.characterType = typeSelect.value;
  record.expectedUpdatedAt = existing?.updatedAt;
  record.intent = "publish";
  if (staffEditorMode && typeSelect.value === "Monster") {
    record.name = form.elements.enemyName.value.trim();
    record.byname = ""; record.era = ""; record.quote = ""; record.nickname = ""; record.age = ""; record.gender = "";
    record.nationality = ""; record.height = ""; record.weight = ""; record.heightWeight = ""; record.race = ""; record.position = "";
    record.arcana = form.elements.enemyArcana.value || "NATURAL"; record.rank = null;
    record.mediumName = ""; record.mediumDescription = ""; record.abilityDescription = ""; record.limitations = "";
    record.weaponName = ""; record.weaponDescription = ""; record.weaponArcana = "";
    record.weapons = [];
    record.likes = ""; record.dislikes = ""; record.personality = ""; record.history = "";
    record.playstyle = ""; record.status = ""; record.contact = ""; record.discord = ""; record.other = "";
    record.stats = {};
    document.querySelectorAll("[data-enemy-stat]").forEach(input => { record.stats[input.dataset.enemyStat] = Math.max(0, Number(input.value) || 0); });
    record.enemyData = {
      subtype: form.elements.enemySubtype.value,
      hp: Math.max(0, Number(form.elements.enemyHp.value) || 0),
      isBoss: form.elements.enemyIsBoss.checked,
      description: form.elements.enemyDescription.value.trim(),
    };
  }
  if (staffEditorMode) {
    record.ownerId = typeSelect.value === "Monster" ? null : form.elements.staffOwnerId.value || null;
  }

  try {
    const themeSongPayload = window.RNCThemeEditor?.payload();
    if (themeSongPayload !== undefined) record.themeSong = themeSongPayload;
    form.inert = true;
    const isUpdate = Boolean(existing && !isLegacyExisting);
    const endpointBase = staffEditorMode ? "/api/community/staff/characters" : "/api/community/characters";
    const endpoint = isUpdate ? endpointBase + "/" + encodeURIComponent(existing.id) : endpointBase;
    const response = await fetch(endpoint, {
      method: isUpdate ? "PUT" : "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(60000),
    });
    const result = await response.json().catch(function() { return {}; });
    if (!response.ok || !result.character) {
      const saveError = result.error === "database-error"
        ? "บันทึกไม่สำเร็จ ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง"
        : result.error;
      throw new Error(saveError || "บันทึกตัวละครไม่สำเร็จ กรุณาลองอีกครั้ง");
    }
    if (isLegacyExisting) window.RNCCharacterStore.removeLegacyDraft(existing.id);
    window.RNCCharacterStore.add(result.character);
    const destination = staffEditorMode ? "/community/staff#characters" : "/community/rnc/character?id=" + encodeURIComponent(result.character.id);
    window.RNCNavigate ? window.RNCNavigate(destination) : (location.href = destination);
  } catch (error) {
    form.inert = false;
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    if (timedOut) setError("การเชื่อมต่อใช้เวลานาน กรุณาเปิดข้อมูลตัวละครอีกครั้งเพื่อตรวจสอบก่อนบันทึกใหม่");
    else setError(error instanceof Error ? error.message : "The character could not be saved.");
    saveButton.disabled = false;
    saveButton.textContent = saveLabel;
    saveButton.classList.remove("is-saving");
    saveButton.removeAttribute("aria-busy");
    form.removeAttribute("aria-busy");
    form.querySelectorAll('[type="submit"]').forEach(button => { button.disabled = false; });
  }
});
