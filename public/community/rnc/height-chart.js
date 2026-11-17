(() => {
  "use strict";

  const staffMode = window.__RNC_BOOTSTRAP__?.staffMode === true;
  const staffTools = document.getElementById("staffHeightTools");
  const staffActiveName = document.getElementById("heightActiveName");
  const staffScaleControl = document.getElementById("staffScaleControl");
  const staffOffsetControl = document.getElementById("staffOffsetControl");
  const staffScaleOutput = document.getElementById("staffScaleOutput");
  const staffOffsetOutput = document.getElementById("staffOffsetOutput");
  const staffSaveButton = document.getElementById("saveStaffCalibration");
  const staffResetButton = document.getElementById("resetStaffCalibration");
  const staffCalibrationStatus = document.getElementById("staffCalibrationStatus");
  const dirtyCharacterIds = new Set();
  let activeCharacterId = "";

  const allRecords = Array.isArray(window.__RNC_BOOTSTRAP__?.characters)
    ? window.__RNC_BOOTSTRAP__.characters.filter(character => !["Monster", "Enemy"].includes(character.characterType))
    : [];
  const searchInput = document.getElementById("characterSearch");
  const searchForm = document.getElementById("searchForm");
  const units = document.getElementById("unitSelect");
  const sort = document.getElementById("sortSelect");
  const sortDirection = document.getElementById("sortDirection");
  const zoom = document.getElementById("zoomRange");
  const spacing = document.getElementById("spacingRange");
  const stage = document.querySelector(".chart-stage");
  const track = document.getElementById("heightTrack");
  const ruler = document.getElementById("heightRuler");
  const canvas = document.getElementById("chartCanvas");
  const chartScroll = document.getElementById("chartScroll");
  const panLeftButton = document.getElementById("heightPanLeft");
  const panRightButton = document.getElementById("heightPanRight");
  const empty = document.getElementById("chartEmpty");
  const status = document.getElementById("chartStatus");
  const zoomValue = document.getElementById("zoomValue");
  const spacingValue = document.getElementById("spacingValue");
  const dialog = document.getElementById("selectionDialog");
  const selectionList = document.getElementById("selectionList");
  const selectionCount = document.getElementById("selectionCount");
  const selectedIds = new Set();
  let descending = false;

  function floorHeight() {
    const value = Number.parseFloat(getComputedStyle(canvas).getPropertyValue("--height-floor"));
    return Number.isFinite(value) ? value : 57;
  }

  function parseHeight(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const valid = cm => Number.isFinite(cm) && cm >= 80 && cm <= 250 ? cm : null;
    const labeledHeight = raw.match(/(?:height|ส่วนสูง|ความสูง)\s*[:=]?\s*(\d{2,3}(?:\.\d+)?)/i);
    if (labeledHeight) return valid(Number(labeledHeight[1]));
    const feet = raw.match(/(?:^|[\s:=])(\d{1,2})\s*(?:ft|feet|')\s*(?:(\d{1,2})\s*(?:in|inches|\")?)?/i);
    if (feet) return valid(Number(feet[1]) * 30.48 + Number(feet[2] || 0) * 2.54);
    const meters = raw.match(/(?:^|[\s:=])(1\.\d{1,2}|2\.\d{1,2})\s*m(?:\b|$)/i);
    if (meters) return valid(Number(meters[1]) * 100);
    const centimeters = raw.match(/(\d{2,3}(?:\.\d+)?)\s*(?:cm\b|ซม\.?)/i);
    if (centimeters) return valid(Number(centimeters[1]));
    const leading = raw.match(/^\s*(\d{2,3}(?:\.\d+)?)(?:\s|\/|$)/);
    if (leading) return valid(Number(leading[1]));
    const bareMeters = raw.match(/^\s*(1\.\d{1,2}|2\.\d{1,2})\s*$/);
    if (bareMeters) return valid(Number(bareMeters[1]) * 100);
    return null;
  }
  const measured = allRecords.map(character => ({ character, cm: parseHeight(character.height || character.heightWeight) }))
    .filter(item => item.cm !== null);
  measured.forEach(item => selectedIds.add(String(item.character.id)));
  if (staffMode) {
    if (measured.length) activeCharacterId = String(measured.slice().sort((a, b) => a.cm - b.cm)[0].character.id);
    if (measured.length) staffTools.hidden = false;
    document.body.dataset.staffHeight = "true";
    const links = document.querySelector(".top-links");
    if (links) {
      const back = document.createElement("a");
      back.className = "staff-height-return";
      back.href = "/community/staff#characters";
      back.textContent = "STAFF CONSOLE";
      links.prepend(back);
    }
  }

  function displayHeight(cm) {
    if (units.value === "cm") return Math.round(cm) + " cm";
    return (cm / 2.54).toFixed(2) + " in.";
  }

  function getCalibration(character) {
    const scale = Number(character.heightChartScale);
    const offset = Number(character.heightChartOffset);
    const xOffset = Number(character.heightChartXOffset);
    return {
      scale: Number.isFinite(scale) ? Math.max(0.5, Math.min(1.5, scale)) : 1,
      offset: Number.isFinite(offset) ? Math.max(-60, Math.min(60, offset)) : 0,
      xOffset: Number.isFinite(xOffset) ? Math.max(-140, Math.min(140, xOffset)) : 0,
    };
  }

  function calibrationItem(id) {
    return measured.find(item => String(item.character.id) === String(id));
  }

  function updateStaffControls() {
    if (!staffMode || !staffTools) return;
    const item = calibrationItem(activeCharacterId);
    if (!item) {
      staffActiveName.textContent = "เลือกตัวละครเพื่อเริ่มปรับ";
      staffScaleControl.disabled = true;
      staffOffsetControl.disabled = true;
      staffResetButton.disabled = true;
    } else {
      const calibration = getCalibration(item.character);
      staffActiveName.textContent = (item.character.name || "ไม่ระบุชื่อ") + " · " + displayHeight(item.cm);
      staffScaleControl.disabled = false;
      staffOffsetControl.disabled = false;
      staffResetButton.disabled = false;
      staffScaleControl.value = String(Math.round(calibration.scale * 100));
      staffOffsetControl.value = String(Math.round(calibration.offset));
      staffScaleOutput.textContent = Math.round(calibration.scale * 100) + "%";
      staffOffsetOutput.textContent = (calibration.offset > 0 ? "+" : "") + Math.round(calibration.offset) + "%";
    }
    const count = dirtyCharacterIds.size;
    staffSaveButton.disabled = count === 0;
    staffSaveButton.textContent = count ? "บันทึกการปรับ (" + count + ")" : "บันทึกการปรับ";
    staffCalibrationStatus.textContent = count ? "มี " + count + " ตัวละครที่ยังไม่บันทึก" : "ไม่มีรายการค้างบันทึก";
    staffCalibrationStatus.removeAttribute("data-error");
  }

  function selectStaffCharacter(id) {
    activeCharacterId = String(id);
    track.querySelectorAll(".height-person-editable").forEach(person => {
      const selected = person.dataset.characterId === activeCharacterId;
      person.classList.toggle("is-selected", selected);
      person.setAttribute("aria-pressed", String(selected));
    });
    updateStaffControls();
  }

  function markCalibrationDirty(character) {
    dirtyCharacterIds.add(String(character.id));
    updateStaffControls();
  }

  function updateLiveCalibration(character) {
    const card = track.querySelector('[data-character-id="' + CSS.escape(String(character.id)) + '"]');
    if (!card) return;
    const art = card.querySelector(".person-art");
    const image = art && art.querySelector("img");
    if (!art) return;
    const figureHeight = Number.parseFloat(art.dataset.chartFigureHeight) || 1;
    const calibration = getCalibration(character);
    const aspectRatio = image && image.naturalWidth > 0 && image.naturalHeight > 0
      ? image.naturalWidth / image.naturalHeight
      : 0.62;
    const displayHeight = figureHeight * calibration.scale;
    const displayWidth = displayHeight * aspectRatio;
    art.style.width = displayWidth + "px";
    art.style.height = displayHeight + "px";
    art.style.bottom = (floorHeight() - figureHeight * calibration.offset / 100) + "px";
    card.style.setProperty("--person-width", Math.max(62, displayWidth + 12) + "px");
    art.style.setProperty("--person-x-offset", calibration.xOffset + "px");
  }

  async function saveCalibrations() {
    if (!staffMode || dirtyCharacterIds.size === 0) return;
    const updates = [...dirtyCharacterIds].map(id => {
      const item = calibrationItem(id);
      if (!item) return null;
      const calibration = getCalibration(item.character);
      return {
        id: String(item.character.id),
        expectedUpdatedAt: item.character.updatedAt,
        heightChartScale: calibration.scale,
        heightChartOffset: calibration.offset,
        heightChartXOffset: calibration.xOffset,
      };
    }).filter(Boolean);
    if (!updates.length) return;
    staffSaveButton.disabled = true;
    staffSaveButton.textContent = "กำลังบันทึก…";
    try {
      const response = await fetch("/api/community/staff/height", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ updates }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "บันทึกการปรับไม่สำเร็จ");
      for (const saved of result.characters || []) {
        const item = calibrationItem(saved.id);
        if (!item) continue;
        item.character.heightChartScale = saved.heightChartScale;
        item.character.heightChartOffset = saved.heightChartOffset;
        item.character.heightChartXOffset = saved.heightChartXOffset;
        item.character.updatedAt = saved.updatedAt;
        dirtyCharacterIds.delete(String(saved.id));
      }
      staffCalibrationStatus.textContent = "บันทึกการปรับเรียบร้อยแล้ว";
      render();
      announce("บันทึกการจัดวางตัวละครในหน้า Height แล้ว");
    } catch (error) {
      staffCalibrationStatus.textContent = error instanceof Error ? error.message : "บันทึกการปรับไม่สำเร็จ";
      staffCalibrationStatus.dataset.error = "true";
    } finally {
      updateStaffControls();
    }
  }

  function initials(name) {
    return String(name || "?").trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join("").toUpperCase();
  }

  function updateSortDirection() {
    const heightSort = sort.value === "height";
    sortDirection.innerHTML = descending ? "&#9660;" : "&#9650;";
    sortDirection.setAttribute(
      "aria-label",
      descending ? "Switch to ascending order" : "Switch to descending order",
    );
    sortDirection.title = heightSort
      ? descending ? "Sort from shortest to tallest" : "Sort from tallest to shortest"
      : descending ? "Sort names A to Z" : "Sort names Z to A";
  }
  function makePerson(item, scale) {
    const character = item.character;
    const heightInches = item.cm / 2.54;
    const figureHeight = heightInches * scale;
    const figureWidth = Math.max(42, figureHeight * 0.62);
    const calibration = getCalibration(character);
    const artScale = calibration.scale;
    const link = document.createElement(staffMode ? "div" : "a");
    link.className = staffMode ? "height-person height-person-editable" : "height-person";
    if (staffMode) {
      link.setAttribute("role", "button");
      link.setAttribute("tabindex", "0");
      link.setAttribute("aria-pressed", String(String(character.id) === activeCharacterId));
      if (String(character.id) === activeCharacterId) link.classList.add("is-selected");
      link.addEventListener("click", () => selectStaffCharacter(character.id));
      link.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectStaffCharacter(character.id);
        }
      });
    } else {
      link.href = "/community/rnc/character?id=" + encodeURIComponent(character.id) + "&from=height";
    }
    link.dataset.characterId = String(character.id);
    link.title = String(character.name || "Character") + " - " + displayHeight(item.cm);
    link.style.setProperty("--figure-height", figureHeight * artScale + "px");
    link.style.setProperty("--figure-width", figureWidth * artScale + "px");
    link.style.setProperty("--person-width", Math.max(62, figureWidth * artScale + 12) + "px");

    const art = document.createElement("span");
    art.className = "person-art";
    art.dataset.chartFigureHeight = String(figureHeight);
    art.style.setProperty("--person-x-offset", calibration.xOffset + "px");
    const imageUrl = character.image || character.galleryImage;
    if (imageUrl) {
      const image = document.createElement("img");
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("load", () => updateLiveCalibration(character), { once: true });
      image.src = imageUrl;
      art.append(image);
      if (staffMode) {
        const handle = document.createElement("span");
        handle.className = "height-resize-handle";
        handle.title = "ลากเพื่อยืดหรือหดรูป โดยยึดเท้าไว้กับเส้นพื้น";
        handle.setAttribute("aria-hidden", "true");
        art.append(handle);
      }
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "person-placeholder";
      placeholder.textContent = initials(character.name);
      art.append(placeholder);
    }

    const meta = document.createElement("span");
    meta.className = "person-meta";
    const name = document.createElement("strong");
    name.textContent = character.name || "Unnamed";
    const measurement = document.createElement("span");
    measurement.textContent = displayHeight(item.cm);
    meta.append(name, measurement);
    link.append(art, meta);
    return link;
  }

  let calibrationDrag = null;

  function changeCalibrationFromDrag(event) {
    if (!calibrationDrag || event.pointerId !== calibrationDrag.pointerId) return;
    const dx = event.clientX - calibrationDrag.startX;
    const dy = event.clientY - calibrationDrag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 2) calibrationDrag.moved = true;
    const item = calibrationItem(calibrationDrag.id);
    if (!item) return;
    if (calibrationDrag.mode === "resize") {
      item.character.heightChartScale = Math.max(0.5, Math.min(1.5,
        calibrationDrag.scale - (dy / calibrationDrag.figureHeight) * 0.9));
    } else {
      item.character.heightChartXOffset = Math.max(-140, Math.min(140, calibrationDrag.xOffset + dx));
      item.character.heightChartOffset = Math.max(-60, Math.min(60,
        calibrationDrag.offset + (dy / calibrationDrag.figureHeight) * 100));
    }
    updateLiveCalibration(item.character);
    updateStaffControls();
  }

  function finishCalibrationDrag(event) {
    if (!calibrationDrag || event.pointerId !== calibrationDrag.pointerId) return;
    const drag = calibrationDrag;
    calibrationDrag = null;
    if (drag.moved) {
      const item = calibrationItem(drag.id);
      if (item) markCalibrationDirty(item.character);
    }
    try { drag.art.releasePointerCapture(event.pointerId); } catch {}
  }

  function renderRuler(maxInches, scale) {
    ruler.replaceChildren();
    for (let inch = 0; inch <= maxInches; inch += 12) {
      const label = document.createElement("span");
      label.className = "ruler-label";
      const value = units.value === "cm" ? Math.round(inch * 2.54) + " cm" : inch + " in.";
      label.textContent = value;
      label.style.bottom = (floorHeight() + inch * scale) + "px";
      ruler.append(label);
    }
  }

  function render() {
    const items = measured.filter(item => selectedIds.has(String(item.character.id)));
    if (sort.value === "name") {
      items.sort((a, b) => String(a.character.name || "").localeCompare(String(b.character.name || "")));
    } else {
      items.sort((a, b) => a.cm - b.cm);
    }
    if (descending) items.reverse();

    const tallestInches = Math.max(0, ...items.map(item => item.cm / 2.54));
    const maxInches = Math.max(96, Math.ceil(tallestInches / 12) * 12);
    const availableHeight = Math.max(240, stage.clientHeight - floorHeight());
    const scale = availableHeight / maxInches * Number(zoom.value) / 50;
    const visibleInches = Math.floor(availableHeight / scale / 12) * 12;
    const rulerMax = Math.max(Math.ceil(tallestInches / 12) * 12, visibleInches);
    const chartHeight = Math.max(stage.clientHeight, Math.round(floorHeight() + rulerMax * scale));
    canvas.style.height = chartHeight + "px";
    canvas.style.setProperty("--grid-step", (12 * scale) + "px");
    track.style.height = chartHeight + "px";
    track.style.setProperty("--person-gap", (28 * Number(spacing.value) / 100) + "px");
    renderRuler(rulerMax, scale);
    track.replaceChildren(...items.map(item => makePerson(item, scale)));
    items.forEach(item => updateLiveCalibration(item.character));
    empty.hidden = items.length > 0;
    track.hidden = items.length === 0;
    zoomValue.value = zoom.value + "%";
    zoomValue.textContent = zoom.value + "%";
    spacingValue.value = spacing.value + "%";
    spacingValue.textContent = spacing.value + "%";
    updateStaffControls();
    updatePanControls();
  }

  function buildSelection() {
    selectionList.replaceChildren();
    if (measured.length === 0) {
      const none = document.createElement("p");
      none.className = "selection-none";
      none.textContent = "No measured characters";
      selectionList.append(none);
      selectionCount.textContent = "0 selected";
      return;
    }
    measured.slice().sort((a, b) => String(a.character.name || "").localeCompare(String(b.character.name || "")))
      .forEach(item => {
        const label = document.createElement("label");
        label.className = "selection-option";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = selectedIds.has(String(item.character.id));
        checkbox.dataset.characterId = String(item.character.id);
        const name = document.createElement("span");
        name.textContent = item.character.name || "Unnamed";
        const height = document.createElement("small");
        height.textContent = displayHeight(item.cm);
        label.append(checkbox, name, height);
        selectionList.append(label);
      });
    updateSelectionCount();
  }

  function updateSelectionCount() {
    const count = selectionList.querySelectorAll("input:checked").length;
    selectionCount.textContent = count + " selected";
  }

  function announce(message) {
    status.textContent = "";
    window.setTimeout(() => { status.textContent = message; }, 20);
  }

  function searchCharacter(event) {
    event.preventDefault();
    const query = searchInput.value.trim().toLocaleLowerCase();
    if (!query) return;
    const match = allRecords.find(character =>
      [character.name, character.nickname, character.byname]
        .some(value => String(value || "").toLocaleLowerCase().includes(query)),
    );
    if (!match) {
      announce("No match");
      return;
    }
    const item = measured.find(entry => String(entry.character.id) === String(match.id));
    if (!item) {
      announce("No height");
      return;
    }
    selectedIds.add(String(match.id));
    if (staffMode) activeCharacterId = String(match.id);
    render();
    window.requestAnimationFrame(() => {
      const card = track.querySelector('[data-character-id="' + CSS.escape(String(match.id)) + '"]');
      if (card) card.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    });
  }

  let edgePanDirection = 0;
  let edgePanFrame = 0;
  let edgePanPreviousTime = 0;
  function stopEdgePan() {
    edgePanDirection = 0;
    edgePanPreviousTime = 0;
    if (edgePanFrame) window.cancelAnimationFrame(edgePanFrame);
    edgePanFrame = 0;
  }
  function updatePanControls() {
    const maxScroll = Math.max(0, chartScroll.scrollWidth - chartScroll.clientWidth);
    panLeftButton.disabled = maxScroll < 2 || chartScroll.scrollLeft <= 1;
    panRightButton.disabled = maxScroll < 2 || chartScroll.scrollLeft >= maxScroll - 1;
    if ((edgePanDirection < 0 && panLeftButton.disabled) || (edgePanDirection > 0 && panRightButton.disabled)) stopEdgePan();
  }
  function edgePanStep(time) {
    if (!edgePanDirection) return;
    if (!edgePanPreviousTime) edgePanPreviousTime = time;
    const elapsed = Math.min(32, time - edgePanPreviousTime);
    edgePanPreviousTime = time;
    chartScroll.scrollLeft += edgePanDirection * elapsed * 0.75;
    updatePanControls();
    if (edgePanDirection) edgePanFrame = window.requestAnimationFrame(edgePanStep);
  }
  function startEdgePan(direction) {
    updatePanControls();
    const button = direction < 0 ? panLeftButton : panRightButton;
    if (button.disabled) return;
    stopEdgePan();
    edgePanDirection = direction;
    edgePanFrame = window.requestAnimationFrame(edgePanStep);
  }
  [[panLeftButton, -1], [panRightButton, 1]].forEach(([button, direction]) => {
    button.addEventListener("pointerenter", event => {
      if (event.pointerType === "mouse" || event.pointerType === "pen") startEdgePan(direction);
    });
    button.addEventListener("pointerleave", stopEdgePan);
    button.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse" || button.disabled) return;
      chartScroll.scrollBy({ left: direction * Math.max(220, chartScroll.clientWidth * 0.72), behavior: "smooth" });
    });
    button.addEventListener("click", event => {
      if (event.detail !== 0 || button.disabled) return;
      chartScroll.scrollBy({ left: direction * Math.max(220, chartScroll.clientWidth * 0.72), behavior: "smooth" });
    });
  });
  chartScroll.addEventListener("scroll", updatePanControls, { passive: true });
  window.addEventListener("blur", stopEdgePan);
  chartScroll.addEventListener("wheel", event => {
    if (!event.shiftKey || event.deltaY === 0 || chartScroll.scrollWidth <= chartScroll.clientWidth) return;
    event.preventDefault();
    chartScroll.scrollLeft += event.deltaY;
  }, { passive: false });
  chartScroll.addEventListener("keydown", event => {
    if (event.target !== chartScroll || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    chartScroll.scrollBy({ left: event.key === "ArrowRight" ? 72 : -72, behavior: "smooth" });
  });

  document.getElementById("openSelection").addEventListener("click", () => {
    buildSelection();
    dialog.showModal();
  });
  document.getElementById("closeSelection").addEventListener("click", () => dialog.close());
  document.getElementById("applySelection").addEventListener("click", () => {
    selectedIds.clear();
    selectionList.querySelectorAll("input:checked").forEach(input => selectedIds.add(input.dataset.characterId));
    dialog.close();
    render();
  });
  selectionList.addEventListener("change", updateSelectionCount);
  document.getElementById("clearSelection").addEventListener("click", () => {
    selectedIds.clear();
    render();
  });
  document.getElementById("sortDirection").addEventListener("click", () => {
    descending = !descending;
    updateSortDirection();
    render();
  });
  searchForm.addEventListener("submit", searchCharacter);
  [units, zoom, spacing].forEach(control => control.addEventListener("input", render));
  units.addEventListener("change", render);
  sort.addEventListener("change", () => {
    descending = false;
    updateSortDirection();
    render();
  });
  updateSortDirection();
  if (staffMode) {
    sort.value = "height";
    updateSortDirection();
    staffScaleControl.addEventListener("input", () => {
      const item = calibrationItem(activeCharacterId);
      if (!item) return;
      item.character.heightChartScale = Number(staffScaleControl.value) / 100;
      markCalibrationDirty(item.character);
      updateLiveCalibration(item.character);
      staffScaleOutput.textContent = staffScaleControl.value + "%";
    });
    staffOffsetControl.addEventListener("input", () => {
      const item = calibrationItem(activeCharacterId);
      if (!item) return;
      item.character.heightChartOffset = Number(staffOffsetControl.value);
      markCalibrationDirty(item.character);
      updateLiveCalibration(item.character);
      staffOffsetOutput.textContent = (Number(staffOffsetControl.value) > 0 ? "+" : "") + staffOffsetControl.value + "%";
    });
    staffResetButton.addEventListener("click", () => {
      const item = calibrationItem(activeCharacterId);
      if (!item) return;
      item.character.heightChartScale = 1;
      item.character.heightChartOffset = 0;
      item.character.heightChartXOffset = 0;
      markCalibrationDirty(item.character);
      render();
    });
    staffSaveButton.addEventListener("click", saveCalibrations);
    track.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      const art = event.target instanceof Element ? event.target.closest(".person-art") : null;
      const card = art && art.closest(".height-person-editable");
      if (!art || !card) return;
      const item = calibrationItem(card.dataset.characterId);
      if (!item) return;
      event.preventDefault();
      selectStaffCharacter(item.character.id);
      const calibration = getCalibration(item.character);
      const figureHeight = Number.parseFloat(getComputedStyle(art).height) || 1;
      calibrationDrag = {
        id: String(item.character.id),
        art,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        figureHeight,
        scale: calibration.scale,
        offset: calibration.offset,
        xOffset: calibration.xOffset,
        mode: event.target.closest(".height-resize-handle") ? "resize" : "move",
        moved: false,
      };
      try { art.setPointerCapture(event.pointerId); } catch {}
    });
    track.addEventListener("pointermove", changeCalibrationFromDrag);
    track.addEventListener("pointerup", finishCalibrationDrag);
    track.addEventListener("pointercancel", finishCalibrationDrag);
    window.addEventListener("beforeunload", event => {
      if (dirtyCharacterIds.size) {
        event.preventDefault();
        event.returnValue = "";
      }
    });
  }
  window.addEventListener("resize", render);
  render();
})();
