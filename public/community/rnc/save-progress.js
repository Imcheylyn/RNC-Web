(function () {
  "use strict";

  if (window.RNCSavingIndicator) return;

  let dialog = null;
  let labelNode = null;
  let activeOperations = 0;
  let showTimer = 0;

  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement("dialog");
    dialog.className = "wardrobe-saving-dialog";
    dialog.id = "rncSavingDialog";
    dialog.setAttribute("aria-labelledby", "rncSavingLabel");
    dialog.setAttribute("aria-modal", "true");
    dialog.tabIndex = -1;
    dialog.innerHTML = `
      <div class="wardrobe-saving-content">
        <div class="rnc-saving-mark" aria-hidden="true"><div class="ld-gyro"><i></i><i></i></div><div class="ld-spark"></div></div>
        <p class="wardrobe-saving-label" id="rncSavingLabel" role="status" aria-live="polite">กำลังบันทึก…</p>
      </div>`;
    dialog.addEventListener("cancel", event => event.preventDefault());
    document.body.append(dialog);
    labelNode = dialog.querySelector("#rncSavingLabel");
  }

  function language() {
    if (document.getElementById("wardrobeScreen")) {
      try {
        const preference = localStorage.getItem("rnc-wardrobe-language");
        if (preference === "th" || preference === "en") return preference;
      } catch {}
    }
    return document.documentElement.lang.toLowerCase().startsWith("en") ? "en" : "th";
  }

  function savingLabel(pathname, lang) {
    const isEnglish = lang === "en";
    if (pathname.includes("/employee-card")) return isEnglish ? "Saving employee card…" : "กำลังบันทึกบัตรพนักงาน…";
    if (pathname.includes("/wardrobe")) return isEnglish ? "Saving outfit…" : "กำลังบันทึกชุด…";
    if (pathname.includes("/relationships")) return isEnglish ? "Saving relationship…" : "กำลังบันทึกความสัมพันธ์…";
    if (pathname.includes("/voice-lines")) return isEnglish ? "Saving voice line…" : "กำลังบันทึก Voice Line…";
    if (pathname.includes("/theme-song")) return isEnglish ? "Saving theme song…" : "กำลังบันทึกเพลงประจำตัว…";
    if (pathname === "/api/community/staff/height") return isEnglish ? "Saving character placement…" : "กำลังบันทึกตำแหน่งตัวละคร…";
    if (pathname === "/api/community/staff/dashboard") return isEnglish ? "Saving Community settings…" : "กำลังบันทึกข้อมูล Community…";
    if (pathname === "/api/community/characters" || /^\/api\/community\/characters\/[^/]+$/.test(pathname)) return isEnglish ? "Saving character…" : "กำลังบันทึกตัวละคร…";
    return isEnglish ? "Saving changes…" : "กำลังบันทึกข้อมูล…";
  }

  function begin(message) {
    ensureDialog();
    activeOperations += 1;
    if (message) labelNode.textContent = message;
    if (activeOperations === 1) {
      window.clearTimeout(showTimer);
      showTimer = window.setTimeout(() => {
        if (activeOperations && !dialog.open) dialog.showModal();
      }, 110);
    }
    let finished = false;
    return function finish() {
      if (finished) return;
      finished = true;
      activeOperations = Math.max(0, activeOperations - 1);
      if (activeOperations) return;
      window.clearTimeout(showTimer);
      showTimer = 0;
      if (dialog.open) dialog.close();
    };
  }

  window.RNCSavingIndicator = {
    begin,
    isActive: () => activeOperations > 0,
  };

  const nativeFetch = window.fetch;
  window.fetch = function (input, init) {
    const isRequest = typeof Request !== "undefined" && input instanceof Request;
    const rawUrl = isRequest ? input.url : String(input);
    const method = String(init?.method || (isRequest ? input.method : "GET")).toUpperCase();
    if (!["POST", "PUT", "PATCH"].includes(method)) return nativeFetch.apply(this, arguments);

    let url;
    try { url = new URL(rawUrl, window.location.href); }
    catch { return nativeFetch.apply(this, arguments); }
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/community/")) return nativeFetch.apply(this, arguments);
    if (/^\/api\/community\/staff\/(?:lock|unlock)$/.test(url.pathname) || url.pathname === "/api/community/preview" || url.pathname === "/api/community/media/uploads") return nativeFetch.apply(this, arguments);

    const finish = begin(savingLabel(url.pathname, language()));
    let request;
    try { request = nativeFetch.apply(this, arguments); }
    catch (error) { finish(); throw error; }
    return Promise.resolve(request).finally(finish);
  };
})();
