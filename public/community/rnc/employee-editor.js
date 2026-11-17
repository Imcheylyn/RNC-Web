/* ISO 3166-1 choices: https://www.iso.org/iso-3166-country-codes.html */
(() => {
  "use strict";
  const departments = { Timekeeper: "TM", Researcher: "RE", Medic: "MD", Intern: "IN" };
  const requiredTypes = new Set(["President", "Director", "Character", "Human"]);
  const unspecified = { code: "XX", th: "ไม่ระบุ", en: "Unspecified", nationalityEn: "ไม่ระบุ" };
  const isUnspecified = value => ["", "ไม่ระบุ", "unspecified", "unknown", "not specified"]
    .includes(String(value).normalize("NFKC").trim().toLowerCase());
  let countryRequest;
  window.RNCEmployeeEditor = {
    create({ form, existing, typeSelect }) {
      const input = form.elements.nationality, code = form.elements.nationalityCode;
      const picker = input.closest(".country-picker"), list = picker.querySelector('[role="listbox"]');
      const checkbox = form.elements.employeeEnabled, optional = checkbox.closest("label");
      const preview = document.getElementById("employeePreview"), output = document.getElementById("employeeIdPreview");
      let countries = [unspecified], matches = [], active = -1, expanded = false;
      code.value = existing?.nationalityCode || (isUnspecified(input.value) ? "XX" : "");
      checkbox.checked = existing?.employeeEnabled === true;
      const normalized = value => String(value).normalize("NFKC").trim().toLocaleLowerCase();
      function sync() {
        const type = typeSelect.value, enabled = requiredTypes.has(type) || (type === "NPC" && checkbox.checked);
        const strict = enabled && (!existing || existing.employeeNumber != null || (type === "NPC" && !existing.employeeEnabled));
        optional.hidden = type !== "NPC";
        preview.hidden = !enabled;
        form.elements.position.required = strict && type !== "President";
        form.elements.era.required = strict;
        input.required = false;
        input.setCustomValidity(strict && !code.value ? "กรุณาเลือกประเทศหรือไม่ระบุจากรายการ" : "");
        const department = type === "President" ? "PR" : departments[form.elements.position.value], year = form.elements.era.value;
        const number = existing?.employeeNumber != null ? String(existing.employeeNumber).padStart(4, "0") : "----";
        const parts = [department || "--", /^\d{4}$/.test(year) ? year : "----", number, code.value || "--"];
        const labels = ["แผนก", "ปี ER", "เลขทะเบียน", "ประเทศ"];
        const keys = ["department", "era", "number", "country"];
        output.replaceChildren();
        parts.forEach((part, index) => {
          if (index) output.append(document.createTextNode(" "));
          const block = document.createElement("span");
          block.className = "employee-id-segment";
          block.dataset.employeePart = keys[index];
          block.title = labels[index];
          block.textContent = part;
          output.append(block);
        });
      }
      function close() {
        expanded = false; list.hidden = true; input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant"); active = -1;
      }
      function highlight(index) {
        active = index;
        Array.from(list.querySelectorAll('[role="option"]')).forEach((option, i) => option.setAttribute("aria-selected", String(i === active)));
        const option = list.children[active];
        if (option) { input.setAttribute("aria-activedescendant", option.id); option.scrollIntoView({ block: "nearest" }); }
        else input.removeAttribute("aria-activedescendant");
      }
      function choose(country) {
        code.value = country.code; input.value = country.nationalityEn;
        close(); sync(); input.dispatchEvent(new Event("change", { bubbles: true })); input.focus();
      }
      function render(query = "") {
        if (input.disabled) return;
        const search = normalized(query);
        matches = countries.filter(country => !search || normalized(country.th + " " + country.en + " " + (country.nationalityEn || "") + " " + country.code).includes(search));
        matches.sort((a, b) => Number(normalized(b.code) === search) - Number(normalized(a.code) === search));
        list.replaceChildren(); active = -1;
        matches.forEach(country => {
          const option = document.createElement("button");
          option.type = "button"; option.role = "option"; option.id = "nationality-option-" + country.code;
          option.setAttribute("aria-selected", "false");
          option.textContent = country.code === "XX" ? country.th + " (XX)" : country.th + " — " + country.en + " · " + country.nationalityEn + " (" + country.code + ")";
          option.addEventListener("pointerdown", event => event.preventDefault());
          option.addEventListener("click", () => choose(country)); list.append(option);
        });
        if (!matches.length) {
          const empty = document.createElement("span"); empty.className = "country-empty";
          empty.textContent = countries.length ? "ไม่พบประเทศที่ค้นหา" : "กำลังโหลดรายชื่อประเทศ…"; list.append(empty);
        }
        expanded = true; list.hidden = false; input.setAttribute("aria-expanded", "true");
        if (matches.length) highlight(Math.max(0, matches.findIndex(country => country.code === code.value)));
      }
      input.addEventListener("focus", () => { if (!expanded) render(code.value ? "" : input.value); });
      input.addEventListener("input", () => { code.value = isUnspecified(input.value) ? "XX" : ""; sync(); render(input.value); });
      input.addEventListener("keydown", event => {
        if (["ArrowDown", "ArrowUp"].includes(event.key)) {
          event.preventDefault(); if (!expanded) render(code.value ? "" : input.value);
          if (matches.length) highlight((active + (event.key === "ArrowDown" ? 1 : matches.length - 1) + matches.length) % matches.length);
        } else if (event.key === "Enter" && expanded && matches.length) {
          event.preventDefault(); choose(matches[Math.max(0, active)]);
        } else if (event.key === "Escape" || event.key === "Tab") close();
      });
      picker.addEventListener("focusout", event => {
        if (!picker.contains(event.relatedTarget)) {
          if (code.value === "XX" && !input.value.trim()) input.value = unspecified.th;
          close();
        }
      });
      document.addEventListener("pointerdown", event => { if (!picker.contains(event.target)) close(); });
      [form.elements.position, form.elements.era, checkbox].forEach(control => control.addEventListener("input", sync));
      checkbox.addEventListener("change", sync);
      countryRequest ||= fetch("/community/rnc/countries.json?v=nationality-demonym-20261107").then(response => {
        if (!response.ok) throw new Error("Country list unavailable"); return response.json();
      });
      countryRequest.then(rows => {
        countries = [unspecified, ...rows.slice().sort((a, b) => a.th.localeCompare(b.th, "th"))];
        const selected = countries.find(country => country.code === code.value);
        if (selected) input.value = selected.nationalityEn;
        else code.value = "";
        sync(); if (expanded) render(code.value ? "" : input.value);
      }).catch(() => {
        const message = document.createElement("span"); message.className = "country-empty";
        message.textContent = "โหลดรายชื่อประเทศไม่สำเร็จ กรุณารีเฟรชหน้า";
        list.replaceChildren(message);
      });
      sync();
      return { sync };
    },
  };
})();
