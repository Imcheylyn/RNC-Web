(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const ARCANA_BADGES = { NATURAL: { label: "Natural", icon: "Neutral.png" }, BEAST: { label: "Beast", icon: "Beast.png" }, PLANT: { label: "Plant", icon: "Plant.png" }, STAR: { label: "Star", icon: "Star.png" }, MINERAL: { label: "Mineral", icon: "Mineral.png" }, SPIRIT: { label: "Spirit", icon: "Spirit.png" }, INTELLECT: { label: "Intellect", icon: "Intel.png" }, UNKNOWN: { label: "Unknown", icon: "Unknown.png" } };
  const labels = { DRAFT: "ฉบับร่าง", PUBLISHED: "เผยแพร่", ARCHIVED: "เก็บเข้าคลัง", OPEN: "เปิด Community", CLOSED: "ปิด Community", PAUSED: "พักชั่วคราว" };
  let data = null;
  const control = (form, key) => form.elements.namedItem(key);
  const node = (tag, text, className) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (className) n.className = className; return n; };
  const pill = (text, color) => { const n = node("span", text, "staff-pill"); if (color) n.style.setProperty("--role-color", color); return n; };
  const formatDate = value => value ? new Date(value).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }) : "ไม่ระบุ";
  const localDate = value => { if (!value) return ""; const d = new Date(value); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const communityPanel = document.querySelector('[data-panel="community"]');
  const settingsPanel = document.querySelector('[data-panel="settings"]');
  const settingsForm = $("settingsForm");
  settingsForm.classList.remove("staff-wide-form");
  settingsForm.classList.add("community-settings-card");
  communityPanel.append(settingsForm);
  settingsPanel.remove();
  function message(text, error = false) { $("staffMessage").textContent = text; $("staffMessage").dataset.error = String(error); }
  async function api(path, body) {
    const response = await fetch(path, { method: body ? "POST" : "GET", credentials: "same-origin", cache: "no-store", ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "ไม่สามารถติดต่อระบบได้");
    return result;
  }
  function tab(name) {
    document.querySelectorAll("[data-tab]").forEach(button => button.setAttribute("aria-current", button.dataset.tab === name ? "page" : "false"));
    document.querySelectorAll("[data-panel]").forEach(panel => { panel.hidden = panel.dataset.panel !== name; });
  }
  document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => {
    tab(button.dataset.tab);
    history.replaceState(null, "", button.dataset.tab === "overview" ? location.pathname : "#" + button.dataset.tab);
  }));
  const initialTab = location.hash.slice(1);
  if (["overview", "characters", "monsters", "community"].includes(initialTab)) tab(initialTab);
  function fill(form, item) {
    form.reset();
    form.querySelectorAll('input[type="hidden"]').forEach(input => { input.value = ""; });
    Object.entries(item || {}).forEach(([key, value]) => {
      const input = control(form, key); if (!input) return;
      if (input.type === "checkbox") input.checked = Boolean(value);
      else input.value = input.type === "datetime-local" ? localDate(value) : value == null ? "" : String(value);
    });
    if (control(form, "expectedUpdatedAt")) control(form, "expectedUpdatedAt").value = item?.updatedAt || "";
  }
  function values(form) {
    const result = Object.fromEntries(new FormData(form));
    form.querySelectorAll('input[type="checkbox"]').forEach(input => { result[input.name] = input.checked; });
    form.querySelectorAll('input[type="datetime-local"]').forEach(input => { result[input.name] = input.value ? new Date(input.value).toISOString() : null; });
    return result;
  }
  function actionButton(text, handler) { const button = node("button", text); button.type = "button"; button.className = "staff-quiet"; button.addEventListener("click", handler); return button; }
  function empty(container, text) { container.replaceChildren(node("p", text)); }
  function announcementState(item) { return item.state === "PUBLISHED" && item.publishAt && new Date(item.publishAt) > new Date() ? "ตั้งเวลาเผยแพร่" : item.state === "PUBLISHED" && item.expiresAt && new Date(item.expiresAt) <= new Date() ? "หมดอายุ" : labels[item.state]; }
  function renderAnnouncements() {
    const list = $("announcementList"); list.replaceChildren();
    if (!data.announcements.length) return empty(list, "ยังไม่มีประกาศ เริ่มเขียนฉบับแรกได้เลย");
    data.announcements.forEach(item => {
      const row = node("article", null, "staff-list-item"); row.append(node("h3", item.title), pill(announcementState(item)), node("p", "เผยแพร่: " + formatDate(item.publishAt) + (item.pinned ? " · ปักหมุด" : "")));
      row.append(actionButton("แก้ไข", () => { fill($("announcementForm"), item); $("announcementFormTitle").textContent = "แก้ไขประกาศ"; previewNotice(); $("announcementForm").scrollIntoView({ block: "start", behavior: "smooth" }); })); list.append(row);
    });
  }
  function renderOverview() {
    const metrics = $("staffMetrics"); metrics.replaceChildren();
    [[data.characters.length, "ตัวละครทั้งหมด"], [data.users.length, "สมาชิก Community"]].forEach(([value, text]) => {
      const card = node("div", null, "staff-metric"); card.append(node("strong", value), node("span", text)); metrics.append(card);
    });

    $("overviewTitle").textContent = data.settings?.name || "Community";
    $("overviewStatus").textContent = (labels[data.settings?.state] || "ยังไม่ตั้งค่า") + " · วันเปิด " + formatDate(data.settings?.opensAt) + " · " + (data.settings?.registrationOpen ? "รับตัวละครใหม่" : "ปิดรับตัวละครใหม่");
    const notices = $("overviewNotices"); notices.replaceChildren();
    data.announcements.slice(0, 3).forEach(item => { const row = node("div", null, "staff-list-item"); row.append(node("h3", item.title), node("p", announcementState(item) + " · " + formatDate(item.publishAt))); notices.append(row); });
  }
  function positionCharacterCard(card) {
    const viewportWidth = document.documentElement.clientWidth;
    const width = Math.min(420, viewportWidth - 32);
    const bounds = card.getBoundingClientRect();
    const centeredLeft = bounds.left + (bounds.width - width) / 2;
    const left = Math.min(Math.max(centeredLeft, 16), viewportWidth - width - 16);
    card.style.setProperty("--staff-id-width", width + "px");
    card.style.setProperty("--staff-id-offset", (left - centeredLeft) + "px");
  }
  window.addEventListener("resize", () => {
    document.querySelectorAll(".staff-character-card:is(:hover,:focus-within)").forEach(positionCharacterCard);
  });
  function renderCharacters(isMonster = false) {
    if (!data) return;
    const query = $(isMonster ? "monsterSearch" : "characterSearch").value.trim().toLowerCase();
    const type = isMonster ? "Monster" : $("characterTypeFilter").value;
    const source = isMonster ? data.characters.filter(item => item.characterType === "Monster") : data.characters.filter(item => item.characterType !== "Monster");
    const list = source.filter(item => {
      const typeLabel = item.characterType === "Character" ? "Arcanist" : item.characterType === "Monster" ? "Monster" : item.characterType;
      const matchesType = isMonster || type === "all" || item.characterType === type;
      const searchable = [item.name, item.owner, item.position, item.race, typeLabel].filter(Boolean).join(" ").toLowerCase();
      return matchesType && (!query || searchable.includes(query));
    });
    const cards = $(isMonster ? "monsterRows" : "characterRows");
    cards.replaceChildren();
    if (!list.length) {
      const emptyMessage = isMonster
        ? query ? "ไม่พบ Monster ตามคำค้นนี้" : "ยังไม่มี Monster ในคลัง Community"
        : "ไม่พบตัวละครตามตัวเลือกนี้";
      cards.append(node("p", emptyMessage, "staff-character-empty"));
      return;
    }
    list.forEach(item => {
      const card = node("article", null, "staff-character-card");
      card.setAttribute("role", "listitem");
      card.addEventListener("pointerenter", () => positionCharacterCard(card));
      card.addEventListener("focusin", () => positionCharacterCard(card));
      const frameStyle = (data.frameStyles || []).find(style => style.key === item.frameKey);
      if (frameStyle) {
        card.style.setProperty("--frame-color", frameStyle.borderColor);
        card.style.setProperty("--frame-glow", frameStyle.glowColor);
      }
      const typeLabel = item.characterType === "Character" ? "Arcanist" : item.characterType === "Monster" ? "Monster" : item.characterType;
      const rankLabel = item.rank ? " · " + item.rank + " ดาว" : "";

      const arcana = item.arcana === "UNKNOWN" && ["President", "Magus"].includes(item.characterType)
        ? "UNKNOWN" : item.race === "Human" ? "NATURAL" : (Object.prototype.hasOwnProperty.call(ARCANA_BADGES, item.arcana) ? item.arcana : "NATURAL");
      const arcanaInfo = ARCANA_BADGES[arcana];
      const makeArcanaBadge = side => {
        const badge = node("span", null, "card-affinity staff-character-arcana-badge staff-character-arcana-badge-" + side);
        badge.dataset.arcana = arcana;
        badge.title = "Element: " + arcanaInfo.label;
        badge.setAttribute("aria-label", "Element " + arcanaInfo.label);
        const icon = node("img");
        icon.src = "/assets/RNCelement/" + arcanaInfo.icon;
        icon.alt = "";
        icon.setAttribute("aria-hidden", "true");
        badge.append(icon);
        return badge;
      };

      const link = node("a", null, "staff-character-card-link");
      link.href = "/community/rnc/editor?staff=1&id=" + encodeURIComponent(item.id);
      link.setAttribute("aria-label", "แก้ไข " + (item.name || "ไม่ระบุชื่อ") + " · " + typeLabel + rankLabel + " · ตำแหน่ง " + (item.position || "ไม่ระบุ") + " · เผ่าพันธุ์ " + (item.race || "ไม่ระบุ"));
      const flip = node("span", null, "staff-character-flip");
      const front = node("span", null, "staff-character-face staff-character-face-front");
      const portraitWindow = node("span", null, "staff-character-portrait-window");
      const placeholder = () => node("span", String(item.name || "?").trim().slice(0, 2).toUpperCase(), "staff-character-placeholder");
      if (item.image) {
        const image = node("img", null, "staff-character-portrait-art");
        image.src = item.image;
        image.alt = "";
        image.loading = "lazy";
        window.RNCImageLayout?.apply(image, item, "staffCard");
        image.onerror = () => { image.remove(); portraitWindow.append(placeholder()); };
        portraitWindow.append(image);
      } else {
        portraitWindow.append(placeholder());
      }
      front.append(portraitWindow);
      front.append(makeArcanaBadge("portrait"));
      if (item.frameAsset) {
        const frame = node("img", null, "card-rank-frame staff-character-frame");
        frame.src = item.frameAsset;
        frame.alt = "";
        frame.setAttribute("aria-hidden", "true");
        window.RNCFrameArt?.apply(frame, frameStyle);
        front.append(frame);
      }
      const frontCaption = node("span", null, "staff-character-front-caption");
      frontCaption.append(node("strong", item.name || "ไม่ระบุชื่อ"), node("small", typeLabel + rankLabel));
      front.append(frontCaption);

      const back = node("span", null, "staff-character-face staff-character-face-back");
      const idHeader = node("span", null, "staff-character-id-header");
      const communityLogo = node("img");
      communityLogo.src = "/assets/Title_White.png";
      communityLogo.alt = "Reverse : Noir Chronicle";
      communityLogo.className = "staff-id-community-logo";
      communityLogo.width = 1818; communityLogo.height = 156;
      idHeader.append(communityLogo, node("small", "CHARACTER RECORD · STAFF ARCHIVE"));
      const idIdentity = node("span", null, "staff-character-id-identity");
      const idPhoto = node("span", null, "staff-character-id-photo");
      if (item.image) {
        const image = node("img", null, "staff-character-id-photo-art");
        image.src = item.image;
        image.alt = "";
        image.loading = "lazy";
        window.RNCImageLayout?.apply(image, item, "staffId");
        image.onerror = () => image.remove();
        idPhoto.append(image);
      } else {
        idPhoto.append(placeholder());
      }
      const idName = node("span", null, "staff-character-id-name");
      idName.append(node("strong", item.name || "ไม่ระบุชื่อ"), node("small", typeLabel + rankLabel));
      idIdentity.append(idPhoto, idName, makeArcanaBadge("id"));
      const idFacts = node("span", null, "staff-character-id-facts");
      const addIdFact = (label, value) => {
        const fact = node("span", null, "staff-character-id-fact");
        fact.append(node("small", label), node("strong", value || "ไม่ระบุ"));
        idFacts.append(fact);
      };
      addIdFact("POSITION", item.position);
      addIdFact("RACE", item.race);
      const idFooter = node("span", "REVERSE : NOIR CHRONICLE", "staff-character-id-footer");
      if (["President", "Director", "Character", "Human"].includes(item.characterType) || (item.characterType === "NPC" && item.employeeEnabled)) {
        idFooter.classList.add("has-employee-id");
        idFooter.replaceChildren(node("small", "EMPLOYEE ID"), node("span", item.employeeId || "รอออกรหัสพนักงาน", "staff-employee-number"));
      }
      idIdentity.append(idFacts);
      back.append(idHeader, idIdentity, idFooter);
      flip.append(front, back);
      link.append(flip);

      const remove = node("button", "×", "staff-character-delete-trigger");
      remove.type = "button";
      remove.setAttribute("aria-label", "ลบ " + (item.name || "ตัวละคร") + " ออกจากคลัง");
      remove.setAttribute("aria-expanded", "false");
      const confirmation = node("div", null, "staff-character-delete-confirm");
      confirmation.hidden = true;
      confirmation.setAttribute("role", "group");
      confirmation.setAttribute("aria-label", "ยืนยันการลบตัวละคร");
      confirmation.append(node("strong", "ลบตัวละครนี้ออกจากคลัง?"), node("p", item.name || "ไม่ระบุชื่อ"));
      const confirmActions = node("div", null, "staff-character-delete-actions");
      const cancel = node("button", "ยกเลิก", "staff-quiet staff-character-delete-cancel");
      cancel.type = "button";
      const confirmDelete = node("button", "ยืนยันลบ", "staff-character-delete-action");
      confirmDelete.type = "button";
      confirmActions.append(cancel, confirmDelete);
      confirmation.append(confirmActions);
      const closeConfirmation = () => {
        card.removeAttribute("data-delete-confirm");
        confirmation.hidden = true;
        remove.setAttribute("aria-expanded", "false");
        remove.focus();
      };
      remove.addEventListener("click", () => {
        card.dataset.deleteConfirm = "true";
        confirmation.hidden = false;
        remove.setAttribute("aria-expanded", "true");
        confirmDelete.focus();
      });
      cancel.addEventListener("click", closeConfirmation);
      confirmDelete.addEventListener("click", () => deleteCharacter(item, confirmDelete, card));
      card.addEventListener("keydown", event => {
        if (event.key === "Escape" && !confirmation.hidden) {
          event.preventDefault();
          closeConfirmation();
        }
      });
      card.append(link, remove, confirmation);
      cards.append(card);
    });
  }
  async function deleteCharacter(item, button, card) {
    button.disabled = true;
    card.dataset.deleting = "true";
    try {
      await api("/api/community/staff/dashboard", { action: "deleteCharacter", id: item.id });
      await load();
      message("ลบข้อมูลตัวละครแล้ว");
    } catch (error) {
      message(error.message, true);
    } finally {
      button.disabled = false;
      card.removeAttribute("data-deleting");
    }
  }  function renderRoles() {
    const list = $("roleList"); list.replaceChildren();
    if (!data.roles.length) return empty(list, "ยังไม่มี Role ของตัวละคร");
    data.roles.forEach(item => {
      const row = node("article", null, "staff-list-item"); row.append(pill(item.name, item.color), node("p", item.description || "ไม่มีคำอธิบาย"), node("small", (item.isActive ? "เปิดใช้งาน" : "หยุดให้เลือกใหม่") + " · " + item._count.characters + " ตัวละคร"), actionButton("แก้ไข", () => { fill($("roleForm"), item); $("roleForm").scrollIntoView({ block: "start", behavior: "smooth" }); })); list.append(row);
    });
  }
  function renderStyles() {
    const container = $("rankStyleFields"); container.replaceChildren();
    data.frameStyles.forEach(item => {
      const card = node("div", null, "staff-style-card"); card.dataset.frame = item.key; card.dataset.updatedAt = item.updatedAt || ""; card.append(node("h3", item.label));
      const preview = node("div", null, "staff-frame-preview"), image = node("img"); image.src = item.asset; image.alt = "กรอบ " + item.label;
      if (item.tint) { image.dataset.elementFrame = "true"; image.src = "/assets/RNCelement/" + $("framePreviewRank").value + "%20Star.png"; }
      preview.append(image, node("span", item.caption, "staff-frame-caption")); card.append(preview);
      const current = { ...item }, inputs = [];
      [["borderColor", "สีกรอบ"], ["glowColor", "สีเรืองแสง"]].forEach(([key, text]) => {
        const label = node("label", text), controls = node("span", null, "staff-glow-control"), input = node("input"), hex = node("output", null, "staff-glow-hex");
        input.type = "color"; input.value = item[key]; input.dataset.color = key; input.setAttribute("aria-label", text + " " + item.label);
        const update = () => { current[key] = input.value; hex.textContent = input.value.toUpperCase(); window.RNCFrameArt?.apply(image, current); };
        input.addEventListener("input", update); update(); inputs.push({ input, update, key }); controls.append(input, hex); label.append(controls); card.append(label);
      });
      const reset = actionButton("คืนสีเริ่มต้น", () => { inputs.forEach(({ input, update, key }) => { input.value = key === "borderColor" ? item.defaultBorder : item.defaultGlow; update(); }); }); reset.className = "staff-frame-reset";
      card.append(reset, node("small", decodeURIComponent(item.asset.split("/").pop()), "staff-frame-file")); container.append(card);
    });
  }
  function renderLogs() {
    const list = $("auditList"); list.replaceChildren();
    if (!data.logs.length) return empty(list, "ยังไม่มีรายการจัดการ");
    data.logs.forEach(item => {
      const row = node("article", null, "staff-list-item"); row.append(node("h3", item.summary), node("p", item.actorName + " · " + item.action + " · " + formatDate(item.createdAt)));
      const details = node("details"), summary = node("summary", "ดูการเปลี่ยนแปลง"); details.append(summary, node("pre", JSON.stringify({ before: item.before, after: item.after }, null, 2))); row.append(details); list.append(row);
    });
  }
  async function load() {
    data = await api("/api/community/staff/dashboard");
    fill($("settingsForm"), data.settings); renderOverview(); renderAnnouncements(); renderCharacters(); renderCharacters(true); renderRoles(); renderStyles(); renderLogs();
  }
  async function save(form, payload, reset) {
    const button = form.querySelector('[type="submit"]'); button.disabled = true;
    try { await api("/api/community/staff/dashboard", payload); await load(); if (reset) reset(); message("บันทึกเรียบร้อยแล้ว"); return true; }
    catch (error) { message(error.message, true); return false; }
    finally { button.disabled = false; }
  }
  function previewNotice() { const form = $("announcementForm"); $("noticePreviewTitle").textContent = control(form, "title").value || "หัวข้อประกาศ"; $("noticePreviewBody").textContent = control(form, "body").value || "เนื้อหาประกาศ"; }
  function resetAnnouncement() { fill($("announcementForm"), {}); $("announcementFormTitle").textContent = "เขียนประกาศ"; previewNotice(); }
  $("announcementForm").addEventListener("input", previewNotice);
  $("resetAnnouncement").addEventListener("click", resetAnnouncement);
  $("resetRole").addEventListener("click", () => fill($("roleForm"), {}));
  $("announcementForm").addEventListener("submit", event => { event.preventDefault(); save(event.currentTarget, { ...values(event.currentTarget), action: "announcement" }, resetAnnouncement); });
  $("settingsForm").addEventListener("submit", event => { event.preventDefault(); save(event.currentTarget, { ...values(event.currentTarget), action: "settings" }); });
  $("roleForm").addEventListener("submit", event => { event.preventDefault(); save(event.currentTarget, { ...values(event.currentTarget), action: "role" }, () => fill($("roleForm"), {})); });
  $("stylesForm").addEventListener("submit", event => { event.preventDefault(); const styles = [...document.querySelectorAll("[data-frame]")].map(card => ({ key: card.dataset.frame, borderColor: card.querySelector('[data-color="borderColor"]').value, glowColor: card.querySelector('[data-color="glowColor"]').value, expectedUpdatedAt: card.dataset.updatedAt })); save(event.currentTarget, { action: "frameStyles", styles }); });
  $("framePreviewRank").addEventListener("change", event => { document.querySelectorAll("[data-element-frame]").forEach(image => { image.src = "/assets/RNCelement/" + event.target.value + "%20Star.png"; }); });

  $("characterSearch").addEventListener("input", () => renderCharacters());
  $("characterTypeFilter").addEventListener("change", () => renderCharacters());
  $("monsterSearch").addEventListener("input", () => renderCharacters(true));
  $("lockStaffMode").addEventListener("click", async () => {
    const button = $("lockStaffMode");
    const root = document.documentElement;
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    button.disabled = true;
    if (!reduceMotion) root.classList.add("rnc-screen-powering-off");
    const shutdownAnimation = reduceMotion ? Promise.resolve() : new Promise(resolve => setTimeout(resolve, 520));
    try {
      await Promise.all([api("/api/community/staff/lock", {}), shutdownAnimation]);
      try { sessionStorage.setItem("rnc-screen-power-on", "1"); } catch {}
      location.replace("/community/rnc");
    } catch (error) {
      root.classList.remove("rnc-screen-powering-off");
      button.disabled = false;
      message(error.message, true);
    }
  });
  $("staffUserName").textContent = window.__RNC_BOOTSTRAP__?.currentUser?.name || "Staff";
  previewNotice(); load().then(() => message("ข้อมูลพร้อมแล้ว")).catch(error => message(error.message, true));
})();
