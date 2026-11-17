(function () {
  "use strict";
  const store = window.RNCCharacterStore;
  const character = store?.getById(new URLSearchParams(location.search).get("id"));
  const $ = id => document.getElementById(id);
  const screen = $("wardrobeScreen");
  if (!character || character.characterType === "Monster" || !screen) return;
  const main = document.querySelector(".character-stage"), scene = $("characterScene");
  const portraitFrame = $("scenePortrait"), portrait = $("scenePortraitImage");
  const signature = $("cycleWardrobeSkin"), signatureStamp = $("wardrobeSignatureStamp"), hanger = $("openWardrobe");
  const sceneAccessories = $("sceneAccessories"), sceneChibi = $("sceneChibiImage"), sceneMedium = $("sceneMediumImage");
  const sceneChibiButton = $("sceneChibiButton"), sceneMediumButton = $("sceneMediumButton");
  const chibiDialog = $("wardrobeChibiDialog"), chibiArtwork = $("wardrobeChibiArtwork"), chibiError = $("wardrobeChibiError");
  const api = "/api/community/characters/" + encodeURIComponent(character.id) + "/wardrobe";
  const storageKey = "rnc-wardrobe:" + (store.currentUser?.id || "viewer") + ":" + character.id;
  let language = "en";
  try { language = localStorage.getItem("rnc-wardrobe-language") === "th" ? "th" : "en"; } catch {}
  let skins = [{id:"default",name:"Default",description:character.quote || "",image:character.image || "",thumbnail:character.galleryImage || character.image || "",chibi:"",medium:"",updatedAt:null,isDefault:true}];
  let activeId = "default", canEdit = false, ready = false, loading = null, loadError = "", artworkError = "";
  let canHaveMedium = ["Character", "Arcanist", "Acranist"].includes(character.characterType);
  let signatureConfirmed = Boolean(character.employeeCardSigned || character.employeeCardSignature);
  let applyToken = 0, layoutFrame = 0, signatureStampJob = 0, signatureStampUrl = "";
  const activeSkin = () => skins.find(skin => skin.id === activeId) || skins[0];
  const listeners = new Set();
  const notify = type => listeners.forEach(listener => listener(type));
  const getState = () => ({skins,activeId,canEdit,ready,loading,loadError,artworkError,canHaveMedium,signatureConfirmed});
  const t = key => key === "artworkLoadError" ? language === "th" ? "โหลดรูปไม่สำเร็จ ลองเปิดดูอีกครั้ง" : "Could not load this image. Try opening it again." : language === "th" ? "โหลดรูปสกินไม่สำเร็จ กรุณาลองเลือกสกินอีกครั้ง" : "The artwork could not be loaded. Please select the skin again.";
  function skinImageScale(skin) {
    const value = Number(skin?.imageScale);
    return Number.isFinite(value) && value >= 50 && value <= 200 ? value : 100;
  }
  function skinImageOffsetX(skin) {
    return skinImageOffset(skin?.imageOffsetX);
  }
  function skinImageOffset(value) {
    value = Number(value);
    return Number.isFinite(value) && value >= -100 && value <= 100 ? Math.round(value * 100) / 100 || 0 : 0;
  }
  function skinImageOffsetY(skin) {
    return skinImageOffset(skin?.imageOffsetY);
  }
  function applyProfileFraming(frame, image, skin, artworkRatio) {
    const fittedArtwork = Boolean(skin.image && !skin.isDefault);
    frame.classList.toggle("wardrobe-fitted-portrait", fittedArtwork);
    frame.style.setProperty("--portrait-ratio", fittedArtwork ? String(artworkRatio) : "2 / 3");
    window.RNCImageLayout?.apply(image, skin.isDefault ? character : null, "profile");
    const usePosition = skin.applyFramingToProfile === true;
    const scale = skin.applyFramingToProfile === false ? 1 : skinImageScale(skin) / 100;
    image.style.setProperty("--wardrobe-image-scale", String(scale));
    image.style.setProperty("--wardrobe-image-offset-x", (usePosition ? skinImageOffsetX(skin) : 0) + "%");
    image.style.setProperty("--wardrobe-image-offset-y", (usePosition ? skinImageOffsetY(skin) : 0) + "%");
  }
  async function request(path = "", options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(),60000);
    try {
      const response = await fetch(api + path,{...options,credentials:"same-origin",cache:"no-store",signal:controller.signal,headers:{Accept:"application/json",...options.headers}});
      const value = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(value?.error || "ระบบตู้เสื้อผ้ายังไม่พร้อม กรุณาลองอีกครั้ง");
        error.status = response.status;
        throw error;
      }
      if (!value || !Array.isArray(value.skins)) throw new Error("โหลดข้อมูลตู้เสื้อผ้าไม่สำเร็จ");
      return value;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("การเชื่อมต่อใช้เวลานาน กรุณาเปิดตู้เสื้อผ้าอีกครั้งเพื่อตรวจสอบก่อนลองบันทึกใหม่");
      throw error;
    } finally { clearTimeout(timer); }
  }
  function syncSkinAccessories(skin) {
    const mediumSource = canHaveMedium ? skin.medium : "";
    const sources = [
      [sceneChibi, sceneChibiButton, skin.chibi, "Chibi"],
      [sceneMedium, sceneMediumButton, mediumSource, "Medium"],
    ];
    for (const [image, button, source, label] of sources) {
      image.hidden = !source;
      button.hidden = !source;
      button.setAttribute("aria-label", (language === "th" ? "ดูรูป " : "View ") + label + " · " + skin.name);
      image.alt = label + " · " + skin.name;
      if (source) image.src = source;
      else image.removeAttribute("src");
    }
    sceneAccessories.hidden = sceneChibi.hidden && sceneMedium.hidden;
  }
  async function applySkin(skin, animate) {
    if (!skin) return false;
    const token = ++applyToken;
    let artworkRatio = 2 / 3;
    if (skin.image) {
      const image = new Image();
      let timeout;
      try {
        await new Promise((resolve,reject) => {
          image.onload = resolve;
          image.onerror = () => reject(new Error("image-load"));
          timeout = setTimeout(() => reject(new Error("image-timeout")),20000);
          image.src = skin.image;
          if (image.complete && image.naturalWidth) resolve();
        });
        artworkRatio = image.naturalWidth / image.naturalHeight || artworkRatio;
      } catch {
        if (token === applyToken) { artworkError = t("imageError"); notify("error"); }
        return false;
      } finally { clearTimeout(timeout); image.onload = image.onerror = null; }
    }
    if (token !== applyToken) return false;
    artworkError = "";
    activeId = skin.id;
    portrait.hidden = !skin.image;
    if (skin.image) portrait.src = skin.image; else portrait.removeAttribute("src");
    portraitFrame.classList.toggle("empty-portrait",!skin.image);
    portraitFrame.style.backgroundImage = "none";
    applyProfileFraming(portraitFrame, portrait, skin, artworkRatio);
    if (animate && skin.image) {
      portrait.classList.remove("wardrobe-skin-enter"); void portrait.offsetWidth; portrait.classList.add("wardrobe-skin-enter");
    }
    syncSkinAccessories(skin);
    signature.hidden = false;
    document.querySelector(".identity-caption-row").classList.toggle("has-skins",skins.length > 1);
    try { localStorage.setItem(storageKey,skin.id); } catch {}
    scheduleSignaturePosition(); notify("skin");
    return true;
  }
  async function acceptWardrobe(value, selected) {
    canEdit = Boolean(value.canEdit); ready = true;
    if (typeof value.canHaveMedium === "boolean") canHaveMedium = value.canHaveMedium;

    skins = value.skins;
    signature.hidden = false;
    document.querySelector(".identity-caption-row").classList.toggle("has-skins",skins.length > 1);
    const base = skins.find(skin => skin.isDefault);
    if (base) character.image = base.image;
    let requested = selected || activeId;
    if (!selected) { try { requested = localStorage.getItem(storageKey) || requested; } catch {} }
    const chosen = skins.find(skin => skin.id === requested) || skins[0];
    notify("data");
    return applySkin(chosen,false);
  }
  function loadWardrobe() {
    if (loading) return loading;
    loading = request().then(async value => {
      loadError = "";
      await acceptWardrobe(value);
      return value;
    }).catch(error => { loadError = error.message; notify("error"); return null; })
      .finally(() => { loading = null; notify("loaded"); });
    notify("loading");
    return loading;
  }
  let signatureEntranceReady = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function scheduleSignaturePosition() { cancelAnimationFrame(layoutFrame); layoutFrame = requestAnimationFrame(positionSignature); }
  function watchSignatureEntrance() {
    if (signatureEntranceReady) return;
    const pending = new Set();
    const finish = () => {
      if (signatureEntranceReady) return;
      signatureEntranceReady = true;
      scheduleSignaturePosition();
    };
    [portraitFrame,$("roleTags")].forEach(element => {
      if (!element || getComputedStyle(element).animationName === "none") return;
      pending.add(element);
      const complete = event => {
        if (event.target !== element) return;
        element.removeEventListener("animationend",complete);
        element.removeEventListener("animationcancel",complete);
        pending.delete(element);
        if (!pending.size) finish();
      };
      element.addEventListener("animationend",complete);
      element.addEventListener("animationcancel",complete);
    });
    if (!pending.size) finish();
    else setTimeout(finish,1500);
  }
  function positionSignature() {
    if (scene.hidden || main.hidden || signature.hidden) return;
    if (matchMedia("(max-width:900px)").matches) {
      const dock = $("mobileSignatureDock"); if (signature.parentElement !== dock) dock.append(signature);
      signature.dataset.positioned = "mobile-era"; return;
    }
    if (!signatureEntranceReady) { signature.removeAttribute("data-positioned"); return; }
    if (signature.parentElement !== scene) scene.insertBefore(signature,scene.querySelector(".scene-outline"));
    const bounds = scene.getBoundingClientRect(), roles = $("roleTags").getBoundingClientRect();
    if (!roles.width) return;
    const race = $("roleTags").lastElementChild?.getBoundingClientRect() || roles;
    const width = Math.min(212,Math.max(176,roles.width * .37)) * 1.6;
    const detailLeft = scene.querySelector(".scene-right").getBoundingClientRect().left;
    const x = Math.min(detailLeft - width / 2 - 12,Math.max(roles.left + roles.width * .84,race.right + 12 + width / 2));
    signature.style.setProperty("--signature-x",(x - bounds.left - scene.clientLeft).toFixed(1) + "px");
    signature.style.setProperty("--signature-y",(race.top + race.height / 2 - bounds.top - scene.clientTop).toFixed(1) + "px");
    signature.style.setProperty("--signature-width",width.toFixed(1) + "px"); signature.style.setProperty("--signature-height","90px");
    signature.dataset.positioned = "desktop-roles";
  }
  function updateSignatureStampSize() {
    const width = Number(signatureStamp.dataset.renderWidth), height = Number(signatureStamp.dataset.renderHeight);
    const slot = signatureStamp.parentElement;
    if (!width || !height || !slot) return;
    const bounds = slot.getBoundingClientRect();
    const unit = Math.min(bounds.width / 1200, bounds.height / 360);
    if (!unit || !Number.isFinite(unit)) return;
    signatureStamp.style.width = Math.max(1, width * unit) + "px";
    signatureStamp.style.height = Math.max(1, height * unit) + "px";
  }
  async function setSignatureStamp(source) {
    const job = ++signatureStampJob;
    try {
      const stamp = await makeRedSignature(source || "/assets/Sign.png", true);
      if (job !== signatureStampJob) return;
      const previous = signatureStampUrl;
      const bitmap = await createImageBitmap(stamp);
      signatureStamp.dataset.renderWidth = String(bitmap.width);
      signatureStamp.dataset.renderHeight = String(bitmap.height);
      bitmap.close();
      signatureStampUrl = URL.createObjectURL(stamp);
      signatureStamp.src = signatureStampUrl;
      signatureStamp.hidden = false;
      if (previous) URL.revokeObjectURL(previous);
    } catch {
      if (job !== signatureStampJob) return;
      if (signatureStampUrl) URL.revokeObjectURL(signatureStampUrl);
      signatureStampUrl = "";
      signatureStamp.src = "/assets/Sign.png";
      signatureStamp.hidden = false;
    }
  }
  function loadSignatureImage(source) {
    return new Promise((resolve,reject) => {
      const image = new Image();
      const timer = setTimeout(() => reject(new Error("โหลดลายเซ็นใช้เวลานาน กรุณาลองอีกครั้ง")),20000);
      image.onload = () => { clearTimeout(timer); resolve(image); };
      image.onerror = () => { clearTimeout(timer); reject(new Error("เปิดภาพลายเซ็นไม่สำเร็จ")); };
      image.src = source;
    });
  }
  async function prepareSignature(source, asStamp = false, preserveFrame = false) {
    let image = source, objectUrl = "";
    if (source instanceof Blob) {
      objectUrl = URL.createObjectURL(source);
      try { image = await loadSignatureImage(objectUrl); }
      finally { URL.revokeObjectURL(objectUrl); }
    } else if (typeof source === "string") image = await loadSignatureImage(source);
    const width = image instanceof HTMLCanvasElement ? image.width : image.naturalWidth;
    const height = image instanceof HTMLCanvasElement ? image.height : image.naturalHeight;
    if (!width || !height) throw new Error("ไฟล์นี้ไม่มีภาพลายเซ็น");
    const canvas = document.createElement("canvas");
    const keepAdjustmentFrame = preserveFrame && width >= 1200 && height >= 360 && width <= 4608 && height <= 4608;
    const scale = keepAdjustmentFrame ? 1 : Math.min(1120 / width, 300 / height);
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d", {willReadFrequently:true});
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Store the original colors; the red stamp is a display-only derivative.
    if (asStamp) {
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      let transparent = false;
      for (let index = 3; index < pixels.data.length; index += 4) {
        if (pixels.data[index] < 250) { transparent = true; break; }
      }
      const corners = [0, (canvas.width - 1) * 4, (canvas.height - 1) * canvas.width * 4, (canvas.width * canvas.height - 1) * 4];
      const background = [0, 1, 2].map(channel => corners.reduce((sum, index) => sum + pixels.data[index + channel], 0) / corners.length);
      for (let index = 0; index < pixels.data.length; index += 4) {
        const contrast = Math.max(Math.abs(pixels.data[index] - background[0]), Math.abs(pixels.data[index + 1] - background[1]), Math.abs(pixels.data[index + 2] - background[2]));
        const opacity = transparent ? 1 : contrast > 8 ? Math.min(1, contrast / 120) : 0;
        pixels.data[index] = 181; pixels.data[index + 1] = 45; pixels.data[index + 2] = 36;
        pixels.data[index + 3] = Math.round(pixels.data[index + 3] * opacity);
      }
      context.putImageData(pixels, 0, 0);
    }
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("เตรียมลายเซ็นไม่สำเร็จ")), "image/png"));
  }
  function makeRedSignature(source, preserveFrame = false) { return prepareSignature(source, true, preserveFrame); }
  function isDialogBackdrop(event, dialog) {
    if (event.target !== dialog) return false;
    const bounds = dialog.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  }
  function showSkinArtwork(slot) {
    const skin = activeSkin();
    const source = slot === "medium" ? canHaveMedium && skin?.medium : skin?.chibi;
    if (!source || chibiDialog.open) return;
    const label = slot === "medium" ? "Medium" : "Chibi";
    $("wardrobeChibiTitle").textContent = label + " · " + skin.name;
    chibiArtwork.alt = label + " · " + skin.name;
    chibiError.hidden = true;
    chibiArtwork.hidden = false;
    chibiArtwork.src = source;
    chibiDialog.showModal();
  }
  function finishChibiClose() {
    chibiDialog.removeAttribute("data-closing");
    if (chibiDialog.open) chibiDialog.close();
  }
  async function closeChibi() {
    if (!chibiDialog.open || chibiDialog.hasAttribute("data-closing")) return;
    chibiDialog.setAttribute("data-closing", "");
    const fade = chibiDialog.getAnimations().find(animation => animation.animationName === "wardrobeChibiFadeOut");
    if (fade) await fade.finished.catch(() => {});
    if (chibiDialog.hasAttribute("data-closing")) finishChibiClose();
  }
  const observer = new ResizeObserver(scheduleSignaturePosition);
  [scene,scene.querySelector(".scene-left"),scene.querySelector(".scene-right")].forEach(element => { if (element) observer.observe(element); });
  window.addEventListener("resize",scheduleSignaturePosition,{passive:true});
  scene.querySelector(".scene-left")?.addEventListener("scroll",scheduleSignaturePosition,{passive:true});
  portraitFrame.addEventListener("animationend",scheduleSignaturePosition);
  $("roleTags").addEventListener("animationend",scheduleSignaturePosition);
  document.fonts?.ready.then(scheduleSignaturePosition);
  watchSignatureEntrance();
  $("closeWardrobeChibi").addEventListener("click", closeChibi);
  chibiDialog.addEventListener("cancel", event => {
    event.preventDefault();
    closeChibi();
  });
  chibiDialog.addEventListener("click", event => {
    if (isDialogBackdrop(event, chibiDialog)) closeChibi();
  });
  chibiArtwork.addEventListener("error", () => {
    if (!chibiDialog.open || !chibiArtwork.hasAttribute("src")) return;
    chibiArtwork.hidden = true;
    chibiError.textContent = t("artworkLoadError");
    chibiError.hidden = false;
  });


  window.RNCWardrobeScene = {
    getState, activeSkin, request, applySkin, acceptWardrobe, loadWardrobe,
    skinImageScale, skinImageOffsetX, skinImageOffsetY, applyProfileFraming,
    showSkinArtwork, finishChibiClose, isDialogBackdrop, scheduleSignaturePosition, setSignatureStamp,
    loadSignatureImage, prepareSignature, makeRedSignature,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setLanguage(value) { language = value === "th" ? "th" : "en"; },
  };
  const currentUser = store.currentUser;
  $("editCharacterSignature").hidden = !(currentUser && character.ownerId === currentUser.id);
  window.RNCFeatures.bind(hanger, "wardrobe", () => window.RNCWardrobeUI.open());
  window.RNCFeatures.bind($("editCharacterSignature"), "wardrobe", () => window.RNCWardrobeUI.editSignature());
  signature.addEventListener("click", () => {
    if (!window.RNCWardrobeUI?.isBusy() && skins.length > 1) {
      void applySkin(skins[(skins.findIndex(skin => skin.id === activeId) + 1) % skins.length], true);
    }
  });
  window.addEventListener("rnc:employee-signature-change", event => {
    if (event.detail?.characterId !== character.id) return;
    signatureConfirmed = Boolean(event.detail.signed);
    if (!signatureConfirmed) { character.employeeCardSignature = ""; setSignatureStamp("/assets/Sign.png"); }
    else if (character.employeeCardSignature) setSignatureStamp(character.employeeCardSignature);
    notify("signature");
  });
  sceneChibiButton.addEventListener("click", () => showSkinArtwork("chibi"));
  sceneMediumButton.addEventListener("click", () => showSkinArtwork("medium"));
  for (const [image, button] of [[sceneChibi,sceneChibiButton],[sceneMedium,sceneMediumButton]]) {
    image.addEventListener("error", () => {
      image.hidden = button.hidden = true;
      sceneAccessories.hidden = !sceneAccessories.querySelector("button:not([hidden])");
    });
  }
  const signatureStampResizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(updateSignatureStampSize) : null;
  if (signatureStampResizeObserver && signatureStamp.parentElement) signatureStampResizeObserver.observe(signatureStamp.parentElement);
  hanger.setAttribute("aria-label", language === "th" ? "ตู้เสื้อผ้า" : "GARMENTS");
  hanger.title = hanger.getAttribute("aria-label");
  signature.setAttribute("aria-label", language === "th" ? "สลับสกิน" : "Switch skin");
  signature.title = signature.getAttribute("aria-label");
  $("closeWardrobeChibi").setAttribute("aria-label", language === "th" ? "ปิดรูป" : "Close image");
  function openHash() {
    if (location.hash !== "#wardrobe" || window.RNCWardrobeUI) return;
    window.RNCFeatures.load("wardrobe").then(() => {
      if (location.hash === "#wardrobe") window.RNCWardrobeUI.open(false);
    }).catch(window.RNCFeatures.showError);
  }
  window.addEventListener("popstate", openHash);
  window.addEventListener("hashchange", openHash);
  setSignatureStamp(character.employeeCardSignature || "/assets/Sign.png");
  loadWardrobe();
  openHash();
})();
