(function() {
  "use strict";
  const store = window.RNCCharacterStore;
  const core = window.RNCWardrobeScene;
  if (!core) return;
  const {skinImageScale,skinImageOffsetX,skinImageOffsetY,applyProfileFraming,request,scheduleSignaturePosition,setSignatureStamp,loadSignatureImage,prepareSignature,makeRedSignature,showSkinArtwork,finishChibiClose,isDialogBackdrop} = core;
  const character = store?.getById(new URLSearchParams(location.search).get("id"));
  const screen = document.getElementById("wardrobeScreen");
  if (!character || character.characterType === "Monster" || !screen) return;
  const $ = id => document.getElementById(id);
  const main = document.querySelector(".character-stage");
  const scene = $("characterScene");
  const signature = $("cycleWardrobeSkin");
  const hanger = $("openWardrobe");
  const list = $("wardrobeSkinList");
  const form = $("wardrobeSkinForm");
  const skinDialog = $("wardrobeSkinDialog");
  const confirmDialog = $("wardrobeConfirmDialog");
  const wardrobeChibiButton = $("openWardrobeChibi");
  const wardrobeMediumButton = $("openWardrobeMedium");
  const wardrobeAccessories = $("wardrobeAccessories");
  const wardrobeChibi = $("wardrobeHeroChibi");
  const wardrobeMedium = $("wardrobeHeroMedium");
  const imageTransformPreview = $("wardrobeImageTransformPreview");
  const imageScaleControl = $("wardrobeImageScale");
  const framingOptions = $("wardrobeProfileFraming");
  const profilePreview = $("wardrobeProfilePreview");
  const profilePanHint = $("wardrobeProfilePanHint");
  const profilePreviewFrame = $("wardrobeProfileFrame");
  const profilePreviewImage = $("wardrobeProfileImage");
  const outfitStage = $("wardrobeArtworkStage");
  const signatureApi = "/api/community/characters/" + encodeURIComponent(character.id) + "/employee-card";
  const signatureDialog = $("wardrobeSignatureDialog");
  const signaturePad = $("wardrobeSignaturePad");
  const signaturePreview = $("wardrobeSignaturePreview");
  const signatureFile = $("wardrobeSignatureFile");
  const signatureAdjustmentPanel = $("wardrobeSignatureAdjustments");
  const signatureTransform = $("signatureTransform");
  const editSignature = $("editCharacterSignature");
  const currentUser = store.currentUser;
  let canManageSignature = Boolean(currentUser && character.ownerId === currentUser.id);
  const labels = {
    en:{garments:"GARMENTS",add:"Add skin",edit:"Edit skin",delete:"Delete skin",back:"Back to Character",archive:"Character Archive",retry:"Retry",name:"Skin name *",image:"Skin artwork *",description:"Description",chibi:"Chibi · optional",removeChibi:"Remove Chibi",cancel:"Cancel",save:"Save",loading:"Loading wardrobe…",preparing:"Preparing image…",saving:"Saving…",saved:"Skin saved",deleted:"Skin deleted",sign:"Switch skin",unsaved:"Discard the unsaved skin changes?",deleteConfirm:"Delete this skin?",needImage:"Choose the skin artwork first.",imageError:"The artwork could not be loaded. Please select the skin again.",savedImageError:"The skin was saved, but its artwork could not be loaded yet.",skins:"Select skin",imageSize:"Image size",resetImageSize:"Reset size",skinFormHint:"Add artwork and details for this skin."},
    th:{garments:"ตู้เสื้อผ้า",add:"เพิ่มสกิน",edit:"แก้ไขสกิน",delete:"ลบสกิน",back:"กลับหน้าตัวละคร",archive:"คลังตัวละคร",retry:"ลองอีกครั้ง",name:"ชื่อสกิน *",image:"ภาพสกิน *",description:"รายละเอียด",chibi:"Chibi · ไม่บังคับ",removeChibi:"เอา Chibi ออก",cancel:"ยกเลิก",save:"บันทึก",loading:"กำลังโหลดตู้เสื้อผ้า…",preparing:"กำลังเตรียมรูป…",saving:"กำลังบันทึก…",saved:"บันทึกสกินแล้ว",deleted:"ลบสกินแล้ว",sign:"สลับสกิน",unsaved:"ยกเลิกข้อมูลสกินที่ยังไม่ได้บันทึก?",deleteConfirm:"ลบสกินนี้?",needImage:"กรุณาเพิ่มรูปสกินก่อนบันทึก",imageError:"โหลดรูปสกินไม่สำเร็จ กรุณาลองเลือกสกินอีกครั้ง",savedImageError:"บันทึกสกินแล้ว แต่ยังโหลดภาพไม่สำเร็จ กรุณาเลือกสกินอีกครั้ง",skins:"เลือกสกิน",imageSize:"ขนาดภาพ",resetImageSize:"คืนขนาดเริ่มต้น",skinFormHint:"เพิ่มรูปและรายละเอียดของสกิน"}
  };
  Object.assign(labels.en,{addTitle:"New outfit",editTitle:"Edit outfit",name:"Outfit name *",image:"Outfit artwork *",description:"Wondrous outfit details",optional:"Optional",preview:"PREVIEW",previewName:"Your new outfit",uploadArtwork:"Choose outfit artwork",dropArtwork:"or drop an image here",changeArtwork:"Change image",addChibi:"Add a Chibi",chibiHint:"A little companion for this outfit",save:"Save outfit",resetImageSize:"Reset",skinFormHint:"A new look for your wardrobe.",needImage:"Choose your outfit artwork first."});
  Object.assign(labels.th,{addTitle:"เพิ่มชุดใหม่",editTitle:"จัดชุดของคุณ",name:"ชื่อชุด *",image:"ภาพชุด *",description:"รายละเอียดของชุดสุดมหัศจรรย์",optional:"ไม่บังคับ",preview:"ตัวอย่าง",previewName:"ชุดใหม่ของคุณ",uploadArtwork:"เลือกรูปชุด",dropArtwork:"หรือลากรูปมาวางตรงนี้",changeArtwork:"เปลี่ยนภาพ",addChibi:"เพิ่มภาพ Chibi",chibiHint:"ตัวจิ๋วประจำชุดนี้",save:"บันทึกชุด",resetImageSize:"คืนค่า",skinFormHint:"เพิ่มลุคใหม่ให้ตู้เสื้อผ้าของคุณ",needImage:"เพิ่มภาพชุดก่อนบันทึก"});
  Object.assign(labels.en, {addMedium:"Add Medium artwork", mediumHint:"The Medium for this outfit", removeMedium:"Remove Medium", viewMedium:"View Medium", closeArtwork:"Close image", artworkLoadError:"Could not load this image. Try opening it again."});
  Object.assign(labels.th, {addMedium:"เพิ่มภาพ Medium", mediumHint:"Medium ประจำชุดนี้", removeMedium:"เอา Medium ออก", viewMedium:"ดูรูป Medium", closeArtwork:"ปิดรูป", artworkLoadError:"โหลดรูปไม่สำเร็จ ลองเปิดดูอีกครั้ง"});
  Object.assign(labels.en,{unsavedTitle:"Leave without saving?",unsavedMessage:"Your outfit has changes that haven't been saved.",keepEditing:"Keep editing",discardChanges:"Leave without saving",deleteTitle:"Delete this outfit?",deleteOutfit:"Delete outfit",keepOutfit:"Keep outfit"});
  Object.assign(labels.th,{unsavedTitle:"ออกโดยไม่บันทึกชุดนี้?",unsavedMessage:"ชุดนี้มีการแก้ไขที่ยังไม่ได้บันทึก",keepEditing:"แก้ไขต่อ",discardChanges:"ไม่บันทึกและออก",deleteTitle:"ลบชุดนี้?",deleteOutfit:"ลบชุดนี้",keepOutfit:"เก็บชุดไว้"});
  Object.assign(labels.en,{scenePreview:"Scene",fullPreview:"Full image",previewMode:"Preview mode"});
  Object.assign(labels.th,{scenePreview:"ดูบนฉาก",fullPreview:"ภาพเต็ม",previewMode:"รูปแบบพรีวิว"});
  Object.assign(labels.en,{panHint:"Drag the artwork to position it",resetImageSize:"Reset"});
  Object.assign(labels.th,{panHint:"ลากภาพเพื่อจัดตำแหน่งได้ทุกทิศทาง",resetImageSize:"คืนค่า"});
  Object.assign(labels.en, {
    profilePreview: "Character page", framingScope: "Apply framing to", wardrobeOnly: "Wardrobe only",
    wardrobeAndProfile: "Wardrobe + profile", legacyFraming: "Original · size only",
    viewChibi: "View Chibi", closeChibi: "Close Chibi", chibiLoadError: "Could not load this Chibi. Try opening it again.",
    profilePanHint: "Drag the image left, right, up, or down.",
    profilePanEnable: "Choose Wardrobe + profile to move the image here.",
  });
  Object.assign(labels.th, {
    profilePreview: "ดูหน้าตัวละคร", framingScope: "ใช้การจัดรูปกับ", wardrobeOnly: "เฉพาะในตู้",
    wardrobeAndProfile: "ตู้และหน้าตัวละคร", legacyFraming: "ค่าเดิม · เฉพาะขนาด",
    viewChibi: "ดูจิบิ", closeChibi: "ปิดรูปจิบิ", chibiLoadError: "โหลดรูปจิบิไม่สำเร็จ ลองเปิดดูอีกครั้ง",
    profilePanHint: "ลากรูปไปทางซ้าย ขวา ขึ้น หรือลงได้เลย",
    profilePanEnable: "เลือก «ตู้และหน้าตัวละคร» เพื่อเลื่อนรูปในพรีวิวนี้",
  });
  let language = "en";
  try { language = localStorage.getItem("rnc-wardrobe-language") === "th" ? "th" : "en"; } catch {}
  const t = key => labels[language][key] || key;
  let skins = [{id:"default",name:"Default",description:character.quote || "",image:character.image || "",thumbnail:character.galleryImage || character.image || "",chibi:"",updatedAt:null,isDefault:true}];
  let activeId = "default", canEdit = false, ready = false, busy = false, opened = false;
  let canHaveMedium;
  let signatureConfirmed = Boolean(character.employeeCardSigned || character.employeeCardSignature);
  let signatureMode = "draw", pendingSignature = null, signaturePreviewUrl = "", signatureBusy = false, signatureGatePending = false, signatureInk = 0, signaturePointer = null, signatureLastPoint = null, signatureTransformPointer = null;
  let signatureDirty = false, signatureSaving = false, signaturePurpose = "wardrobe", signatureToastTimer = 0;
  let signatureAdjust = {scale:100,x:0,y:0,rotation:0,pivotX:50,pivotY:50};
  let editing = null, newSkinId = "", loading = null, loadError = "", savedScroll = 0;
  let pendingImage = null, pendingChibi = null, removeChibi = false, imageDisplayScale = 100, imageOffsetX = 0, imageOffsetY = 0;
  let pendingMedium = null, removeMedium = false;
  let outfitPreviewMode = "scene";
  let outfitPan = null;
  let savingSkin = false;
  let confirmation = null;
  const jobs = {image:0,chibi:0,medium:0}, processing = {image:false,chibi:false,medium:false}, previewUrls = new Map();
  const activeSkin = core.activeSkin;
  function syncSceneState() {
    ({skins,activeId,canEdit,ready,canHaveMedium,loading,loadError,signatureConfirmed} = core.getState());
  }
  syncSceneState();

  function savedFramingOption(skin) {
    if (!skin) return "false";
    return skin.applyFramingToProfile == null ? "legacy" : String(skin.applyFramingToProfile);
  }

  function selectedFramingOption() {
    return framingOptions.querySelector("input:checked").value;
  }

  $("wardrobeCharacterName").textContent = character.name;

  function status(message, error) {
    const text = message || "";
    $("wardrobeStatus").textContent = text;
    $("wardrobeStatus").classList.toggle("is-error", Boolean(error));
    const formStatus = $("wardrobeFormStatus");
    formStatus.textContent = text;
    formStatus.dataset.state = error ? "error" : text === t("preparing") ? "preparing" : text === t("saving") ? "saving" : "";
    formStatus.classList.toggle("is-error", Boolean(error));
  }
  function setLanguage(value) {
    language = value === "th" ? "th" : "en";
    core.setLanguage(language);
    $("wardrobeLanguage").value = language;
    screen.querySelectorAll("[data-wardrobe-label]").forEach(element => { element.textContent = t(element.dataset.wardrobeLabel); });
    skinDialog.querySelectorAll("[data-wardrobe-label]").forEach(element => { element.textContent = t(element.dataset.wardrobeLabel); });
    [[hanger,"garments"],[signature,"sign"],[$("closeWardrobe"),"back"],[$("wardrobeArchiveLink"),"archive"],[$("editWardrobeSkin"),"edit"],[$("deleteWardrobeSkin"),"delete"],[$("addWardrobeSkin"),"add"]].forEach(([element,key]) => { element.setAttribute("aria-label",t(key)); element.title = t(key); });
    wardrobeChibiButton.setAttribute("aria-label", t("viewChibi"));
    wardrobeChibiButton.title = t("viewChibi");
    wardrobeMediumButton.setAttribute("aria-label", t("viewMedium"));
    wardrobeMediumButton.title = t("viewMedium");
    $("closeWardrobeChibi").setAttribute("aria-label", t("closeArtwork"));
    list.setAttribute("aria-label",t("skins"));
    $("wardrobeFormTitle").textContent = t(editing ? "editTitle" : "addTitle");
    $("wardrobeSkinFormHint").textContent = t("skinFormHint");
    $("wardrobeSkinName").placeholder = language === "th" ? "ตั้งชื่อให้ชุดนี้" : "Give this outfit a name";
    $("wardrobeSkinDescription").placeholder = language === "th" ? "บอกรายละเอียดของชุดสุดมหัศจรรย์นี้…" : "Describe this wondrous outfit…";
    syncOutfitPreview();
    try { localStorage.setItem("rnc-wardrobe-language",language); } catch {}
  }
  function updateControls() {
    const editingForm = !form.hidden;
    $("wardrobeActions").hidden = !canEdit;
    $("addWardrobeSkin").disabled = busy || editingForm || !ready;
    $("editWardrobeSkin").disabled = busy || editingForm || !ready;
    $("deleteWardrobeSkin").hidden = !canEdit || activeSkin().isDefault;
    $("deleteWardrobeSkin").disabled = busy || editingForm;
    form.querySelectorAll("input,textarea,button").forEach(element => { element.disabled = busy; });
    const preparing = processing.image || processing.chibi || processing.medium;
    $("saveWardrobeSkin").disabled = busy || preparing;
    const saveState = $("wardrobeFormStatus").dataset.state;
    $("saveWardrobeSkinLabel").textContent = busy ? t(saveState === "preparing" ? "preparing" : "saving") : t("save");
    $("saveWardrobeSkin").setAttribute("aria-busy",String(busy || preparing));
    $("saveWardrobeSkin").classList.toggle("is-busy",busy || preparing);
    $("removeWardrobeChibi").disabled = busy || processing.chibi;
    $("removeWardrobeMedium").disabled = busy || processing.medium;
    imageScaleControl.disabled = busy || processing.image;
    $("resetWardrobeImageScale").disabled = busy || processing.image;
    $("closeWardrobe").disabled = busy;
    $("wardrobeLanguage").disabled = busy;
    list.querySelectorAll("button").forEach(button => { button.disabled = busy || editingForm; });
    signature.disabled = busy;
    form.setAttribute("aria-busy",String(savingSkin));
    if (busy || processing.image) stopOutfitPan();
    fitOutfitArtwork();
  }

  function renderList() {
    const content = document.createDocumentFragment();
    skins.forEach((skin,index) => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "wardrobe-skin";
      button.setAttribute("role","option"); button.setAttribute("aria-selected",String(skin.id === activeId));
      button.setAttribute("aria-label",skin.name); button.tabIndex = skin.id === activeId ? 0 : -1;
      button.dataset.skinId = skin.id;
      if (skin.thumbnail || skin.image) {
        const image = document.createElement("img"); image.className = "skin-art"; image.alt = ""; image.loading = "lazy"; image.src = skin.thumbnail || skin.image;
        image.addEventListener("error",() => { image.hidden = true; },{once:true}); button.append(image);
      }
      const mark = document.createElement("span"); mark.className = "wardrobe-skin-mark"; mark.textContent = String(index + 1).padStart(2,"0");
      const name = document.createElement("span"); name.className = "wardrobe-skin-name"; name.textContent = skin.name;
      button.append(mark,name);
      if (skin.chibi) { const chibi = document.createElement("img"); chibi.className = "wardrobe-skin-chibi"; chibi.alt = ""; chibi.loading = "lazy"; chibi.src = skin.chibi; button.append(chibi); }
      button.addEventListener("click",() => { if (!busy && form.hidden) applySkin(skin,true); });
      content.append(button);
    });
    list.replaceChildren(content);
    $("wardrobeSkinCount").textContent = String(skins.length).padStart(2,"0");
    updateControls();
  }
  function syncSkinAccessories(skin) {
    const mediumSource = canHaveMedium ? skin.medium : "";
    const sources = [
      [wardrobeChibi, wardrobeChibiButton, skin.chibi, "Chibi"],
      [wardrobeMedium, wardrobeMediumButton, mediumSource, "Medium"],
    ];
    for (const [image, button, source, label] of sources) {
      image.hidden = !source;
      button.hidden = !source;
      button.setAttribute("aria-label", (language === "th" ? "ดูรูป " : "View ") + label + " · " + skin.name);
      image.alt = label + " · " + skin.name;
      if (source) image.src = source;
      else image.removeAttribute("src");
    }
    wardrobeAccessories.hidden = wardrobeChibi.hidden && wardrobeMedium.hidden;
  }

  function applySkin(skin, animate) { return core.applySkin(skin, animate); }
  function acceptWardrobe(value, selected) { return core.acceptWardrobe(value, selected); }
  function loadWardrobe() {
    if (opened) status(t("loading"));
    $("retryWardrobe").hidden = true;
    return core.loadWardrobe().then(value => {
      syncSceneState();
      $("retryWardrobe").hidden = !loadError;
      if (opened) status(loadError || core.getState().artworkError || "", Boolean(loadError || core.getState().artworkError));
      updateControls(); return value;
    });
  }

  function openWardrobe(pushHistory = true) {
    if (opened) return;
    if (!signatureConfirmed) {
      if (location.hash === "#wardrobe") {
        const url = new URL(location.href); url.hash = ""; history.replaceState(history.state,"",url);
      }
      openSignatureGate();
      return;
    }
    opened = true; savedScroll = window.scrollY; main.hidden = true; screen.hidden = false; document.body.classList.add("wardrobe-open");
    if (pushHistory && location.hash !== "#wardrobe") history.pushState({...history.state,rncWardrobe:character.id},"","#wardrobe");
    if (!ready) { status(loadError || t("loading"),Boolean(loadError)); loadWardrobe(); }
    $("closeWardrobe").focus();
  }
  function resetForm() {
    stopOutfitPan();
    for (const slot of Object.keys(jobs)) { jobs[slot]++; processing[slot] = false; }
    for (const url of previewUrls.values()) URL.revokeObjectURL(url); previewUrls.clear();
    if (skinDialog.open) skinDialog.close();
    form.reset(); form.hidden = true; editing = null; newSkinId = ""; pendingImage = pendingChibi = null; removeChibi = false; imageDisplayScale = 100; imageOffsetX = imageOffsetY = 0; outfitPreviewMode = "scene";
    pendingMedium = null; removeMedium = false;
    $("wardrobeImageScaleValue").textContent = "100%";
    preview("wardrobeImageTransformPreview",""); preview("wardrobeChibiPreview",""); preview("wardrobeMediumPreview",""); syncOutfitPreview();
    updateControls();
  }
  function hasUnsavedChanges() {
    if (form.hidden) return false;
    return Boolean(processing.image || processing.chibi || processing.medium || pendingImage || pendingChibi || pendingMedium
      || (removeChibi && editing?.chibi)
      || (removeMedium && editing?.medium)
      || imageDisplayScale !== skinImageScale(editing)
      || imageOffsetX !== skinImageOffsetX(editing)
      || imageOffsetY !== skinImageOffsetY(editing)
      || selectedFramingOption() !== savedFramingOption(editing)
      || $("wardrobeSkinName").value.trim() !== (editing?.name || "").trim()
      || $("wardrobeSkinDescription").value.trim() !== (editing?.description || "").trim());
  }
  function confirmWardrobeAction(title, message, proceedLabel, cancelLabel) {
    if (confirmation) return confirmation.promise;
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    confirmation = { promise, resolve };
    $("wardrobeConfirmTitle").textContent = title;
    $("wardrobeConfirmMessage").textContent = message;
    $("wardrobeConfirmProceed").textContent = proceedLabel;
    $("wardrobeConfirmCancel").textContent = cancelLabel;
    $("closeWardrobeConfirm").setAttribute("aria-label",language === "th" ? "กลับไปแก้ไข" : "Go back");
    confirmDialog.showModal();
    $("wardrobeConfirmCancel").focus();
    return promise;
  }
  function finishWardrobeConfirmation(approved) {
    if (!confirmation) return;
    const pending = confirmation;
    confirmation = null;
    if (confirmDialog.open) confirmDialog.close();
    pending.resolve(approved);
  }

  async function discardForm() {
    if (busy) return false;
    if (hasUnsavedChanges() && !await confirmWardrobeAction(t("unsavedTitle"),t("unsavedMessage"),t("discardChanges"),t("keepEditing"))) return false;
    resetForm();
    return true;
  }
  function hideWardrobe() {
    finishChibiClose();
    opened = false; screen.hidden = true; main.hidden = false; document.body.classList.remove("wardrobe-open");
    scheduleSignaturePosition(); window.scrollTo(0,savedScroll); hanger.focus({preventScroll:true});
  }
  async function closeWardrobe() {
    if (!opened || busy || confirmDialog.open || (!form.hidden && !await discardForm())) return;
    if (history.state?.rncWardrobe === character.id) history.back();
    else { const url = new URL(location.href); url.hash = ""; history.replaceState(history.state,"",url); hideWardrobe(); }
  }

  function showCharacterSignatureToast(message) {
    const status = $("characterSignatureStatus");
    clearTimeout(signatureToastTimer);
    status.textContent = message;
    status.classList.add("is-visible");
    signatureToastTimer = setTimeout(() => { status.textContent = ""; status.classList.remove("is-visible"); }, 3200);
  }

  async function openSignatureGate(editingSignature = false) {
    if (signatureDialog.open || signatureGatePending) return;
    signatureGatePending = true;
    signaturePurpose = editingSignature ? "edit" : "wardrobe";
    try {
      if (!canManageSignature && !ready && loading) { try { await loading; } catch {} }
      if (editingSignature && !canManageSignature) return;
      $("wardrobeSignatureEditor").hidden = !canManageSignature;
      $("wardrobeSignatureReadonly").hidden = canManageSignature;
      signatureDialog.querySelector(".wardrobe-signature-kicker").textContent = editingSignature ? "CHARACTER SIGNATURE" : "GARMENT ACCESS";
      $("wardrobeSignatureTitle").textContent = editingSignature ? "แก้ไขลายเซ็น" : "ยืนยันลายเซ็นเพื่อเข้า";
      $("wardrobeSignatureHint").textContent = editingSignature ? "เซ็นใหม่หรืออัปโหลดภาพได้ทีละแบบ หากอัปโหลดรูปแล้ว ให้ล้างรูปก่อนจึงจะกลับมาเซ็นได้" : "เซ็นหรืออัปโหลดได้ทีละแบบ หากอัปโหลดรูปแล้ว ให้กด “ล้างรูป / เริ่มเซ็นใหม่” ก่อนจึงจะวาดลายเซ็นได้";
      $("wardrobeSignatureStatus").textContent = "";
      clearTimeout(signatureToastTimer);
      $("characterSignatureStatus").textContent = ""; $("characterSignatureStatus").classList.remove("is-visible");
      resetSignatureDraft();
      signatureDialog.showModal();
      if (editingSignature && character.employeeCardSignature) {
        signatureBusy = true; updateSignatureSaveButton();
        $("wardrobeSignatureStatus").textContent = "กำลังโหลดลายเซ็น…";
        try {
          const original = await prepareSignature(character.employeeCardSignature, false, true);
          const stamp = await makeRedSignature(original);
          pendingSignature = await trimSignatureToInk(stamp); signatureMode = "upload"; signatureAdjust = {scale:100,x:0,y:0,rotation:0,pivotX:50,pivotY:50};
          signaturePreviewUrl = URL.createObjectURL(pendingSignature);
          signaturePreview.src = signaturePreviewUrl; signaturePreview.hidden = false; updateSignatureAdjustmentUI();
          $("wardrobeSignatureStatus").textContent = "";
        } catch (error) {
          $("wardrobeSignatureStatus").textContent = "โหลดลายเซ็นเดิมไม่สำเร็จ สามารถเซ็นใหม่หรือเลือกรูปได้";
        } finally { signatureBusy = false; signatureSaving = false; updateSignatureSaveButton(); }
      }
      $(canManageSignature ? "wardrobeSignaturePad" : "closeWardrobeSignature").focus();
    } finally { signatureGatePending = false; }
  }
  function closeSignatureGate() {
    if (signatureBusy) return;
    signatureDialog.close();
    (signaturePurpose === "edit" ? editSignature : hanger).focus({preventScroll:true});
  }
  function resetSignatureDraft() {
    const ctx = signaturePad.getContext("2d");
    ctx.clearRect(0,0,signaturePad.width,signaturePad.height);
    signatureMode = "draw"; pendingSignature = null; signatureInk = 0; signaturePointer = null; signatureLastPoint = null; signatureDirty = false;
    signatureAdjust = {scale:100,x:0,y:0,rotation:0,pivotX:50,pivotY:50}; updateSignatureAdjustmentUI();
    if (signaturePreviewUrl) URL.revokeObjectURL(signaturePreviewUrl);
    signaturePreviewUrl = ""; signaturePreview.removeAttribute("src"); signatureTransform.hidden = true;
    signatureFile.value = "";
    updateSignatureSaveButton();
  }
  function updateSignatureAdjustmentUI() {
    const values = [["signatureImageScale","scale","%"],["signatureImageX","x","%"],["signatureImageY","y","%"],["signatureImageRotation","rotation","°"]];
    values.forEach(([id,key,suffix]) => {
      const displayed = Math.round(signatureAdjust[key]);
      const input = $(id); input.value = String(displayed);
      const output = input.closest("label")?.querySelector("output"); if (output) output.textContent = displayed + suffix;
      if (key === "scale") $("signatureImageScaleValue").textContent = displayed + suffix;
      if (key === "rotation") $("signatureImageRotationValue").textContent = displayed + suffix;
    });
    signatureAdjustmentPanel.hidden = signatureMode !== "upload";
    signaturePad.hidden = false;
    signaturePad.classList.toggle("is-upload-mode",signatureMode === "upload");
    signatureTransform.hidden = signatureMode !== "upload";
    if (signatureMode === "upload" && pendingSignature) scheduleSignatureAdjustmentPreview();
    updateSignatureSaveButton();
  }
  function scheduleSignatureAdjustmentPreview() {
    if (signatureMode !== "upload" || !pendingSignature || !signaturePreview.naturalWidth) return;
    const paper = signaturePreview.parentElement.parentElement;
    const bounds = paper.getBoundingClientRect();
    const frameWidth = Math.max(1,bounds.width - 28), frameHeight = Math.max(1,bounds.height - 28);
    const fit = Math.min(frameWidth / signaturePreview.naturalWidth,frameHeight / signaturePreview.naturalHeight);
    signatureTransform.style.width = Math.max(1,signaturePreview.naturalWidth * fit) + "px";
    signatureTransform.style.height = Math.max(1,signaturePreview.naturalHeight * fit) + "px";
    signatureTransform.style.left = "calc(50% + " + (bounds.width * signatureAdjust.x / 100) + "px)";
    signatureTransform.style.top = "calc(50% + " + (bounds.height * signatureAdjust.y / 100) + "px)";
    signatureTransform.style.transform = "translate(-50%,-50%) rotate(" + signatureAdjust.rotation + "deg) scale(" + (signatureAdjust.scale / 100) + ")";
  }
  function updateSignatureSaveButton() {
    $("saveWardrobeSignature").disabled = signatureBusy || !canManageSignature || !signatureDirty || (signatureMode === "upload" ? !pendingSignature : signatureInk < 6);
    $("saveWardrobeSignature").textContent = signatureSaving ? "กำลังบันทึก…" : signaturePurpose === "edit" ? "บันทึกลายเซ็น" : "ยืนยันและเข้า";
    $("closeWardrobeSignature").disabled = signatureBusy;
    $("uploadWardrobeSignature").disabled = signatureBusy || (signatureMode === "draw" && signatureDirty);
    const clearSignature = $("clearWardrobeSignature");
    clearSignature.hidden = signatureMode === "draw" && !signatureDirty && signatureInk < 6;
    clearSignature.textContent = signatureMode === "upload" ? "ล้างรูป / เริ่มเซ็นใหม่" : "ล้างลายเซ็น";
    clearSignature.disabled = signatureBusy;
    signatureAdjustmentPanel.querySelectorAll("input,button").forEach(control => { control.disabled = signatureBusy; });
  }

  async function renderAdjustedSignature(source, adjustment) {
    let image = source, objectUrl = "";
    if (source instanceof Blob) { objectUrl = URL.createObjectURL(source); image = await loadSignatureImage(objectUrl); }
    else if (typeof source === "string") image = await loadSignatureImage(source);
    try {
      const width = image instanceof HTMLCanvasElement ? image.width : image.naturalWidth;
      const height = image instanceof HTMLCanvasElement ? image.height : image.naturalHeight;
      if (!width || !height) throw new Error("ไฟล์นี้ไม่มีภาพลายเซ็น");
      const frameWidth = 1200, frameHeight = 360;
      const fit = Math.min(frameWidth / width, frameHeight / height), drawWidth = width * fit, drawHeight = height * fit;
      const drawLeft = (frameWidth - drawWidth) / 2, drawTop = (frameHeight - drawHeight) / 2;
      const scale = adjustment.scale / 100, angle = adjustment.rotation * Math.PI / 180;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const pivotX = frameWidth * adjustment.pivotX / 100, pivotY = frameHeight * adjustment.pivotY / 100;
      const offsetX = frameWidth * adjustment.x / 100, offsetY = frameHeight * adjustment.y / 100;
      const transformPoint = (x,y) => {
        const dx = (x - pivotX) * scale, dy = (y - pivotY) * scale;
        return {x:pivotX + offsetX + dx * cos - dy * sin,y:pivotY + offsetY + dx * sin + dy * cos};
      };
      const points = [{x:0,y:0},{x:frameWidth,y:0},{x:frameWidth,y:frameHeight},{x:0,y:frameHeight},
        transformPoint(drawLeft,drawTop),transformPoint(drawLeft + drawWidth,drawTop),
        transformPoint(drawLeft + drawWidth,drawTop + drawHeight),transformPoint(drawLeft,drawTop + drawHeight)];
      const minX = Math.floor(Math.min(...points.map(point => point.x))), minY = Math.floor(Math.min(...points.map(point => point.y)));
      const maxX = Math.ceil(Math.max(...points.map(point => point.x))), maxY = Math.ceil(Math.max(...points.map(point => point.y)));
      const outputWidth = maxX - minX, outputHeight = maxY - minY;
      if (outputWidth > 4608 || outputHeight > 4608) throw new Error("ภาพที่ปรับมีขนาดใหญ่เกินไป กรุณาลดขนาดหรือมุมหมุนลงเล็กน้อย");
      const canvas = document.createElement("canvas"); canvas.width = outputWidth; canvas.height = outputHeight;
      const context = canvas.getContext("2d"); if (!context) throw new Error("ไม่สามารถจัดภาพลายเซ็นได้");
      const probe = document.createElement("canvas"); probe.width = width; probe.height = height;
      const probeContext = probe.getContext("2d", {willReadFrequently:true}); probeContext.drawImage(image,0,0,width,height);
      const sourcePixels = probeContext.getImageData(0,0,width,height).data;
      let sourceHasTransparency = false;
      for (let index = 3; index < sourcePixels.length; index += 4) { if (sourcePixels[index] < 250) { sourceHasTransparency = true; break; } }
      if (!sourceHasTransparency) {
        const corners = [0,(width - 1) * 4,(height - 1) * width * 4,(width * height - 1) * 4];
        const background = [0,1,2].map(channel => Math.round(corners.reduce((sum,index) => sum + sourcePixels[index + channel],0) / corners.length));
        context.fillStyle = "rgb(" + background.join(",") + ")"; context.fillRect(0,0,outputWidth,outputHeight);
      }
      context.translate(-minX,-minY);
      context.translate(pivotX,pivotY); context.translate(offsetX,offsetY);
      context.rotate(angle); context.scale(scale,scale); context.translate(-pivotX,-pivotY);
      context.drawImage(image,drawLeft,drawTop,drawWidth,drawHeight);
      const blob = await new Promise((resolve,reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("เตรียมภาพลายเซ็นไม่สำเร็จ")),"image/png"));
      return {blob,width:outputWidth,height:outputHeight,minX,minY,pivotX:pivotX + offsetX,pivotY:pivotY + offsetY};
    } finally { if (objectUrl) URL.revokeObjectURL(objectUrl); }
  }

  async function trimSignatureToInk(source) {
    const objectUrl = URL.createObjectURL(source);
    try {
      const image = await loadSignatureImage(objectUrl);
      const width = image.naturalWidth, height = image.naturalHeight;
      const scan = document.createElement("canvas"); scan.width = width; scan.height = height;
      const scanContext = scan.getContext("2d",{willReadFrequently:true});
      if (!scanContext) throw new Error("อ่านขอบลายเซ็นไม่สำเร็จ");
      scanContext.drawImage(image,0,0);
      const pixels = scanContext.getImageData(0,0,width,height).data;
      let left = width, top = height, right = -1, bottom = -1;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        if (pixels[(y * width + x) * 4 + 3] < 8) continue;
        left = Math.min(left,x); top = Math.min(top,y); right = Math.max(right,x); bottom = Math.max(bottom,y);
      }
      if (right < left || bottom < top) throw new Error("ไม่พบเส้นลายเซ็นในภาพนี้");
      const padding = Math.max(6,Math.round(Math.max(width,height) * 0.025));
      left = Math.max(0,left - padding); top = Math.max(0,top - padding);
      right = Math.min(width - 1,right + padding); bottom = Math.min(height - 1,bottom + padding);
      const cropped = document.createElement("canvas"); cropped.width = right - left + 1; cropped.height = bottom - top + 1;
      const croppedContext = cropped.getContext("2d");
      if (!croppedContext) throw new Error("เตรียมกรอบลายเซ็นไม่สำเร็จ");
      croppedContext.drawImage(image,left,top,cropped.width,cropped.height,0,0,cropped.width,cropped.height);
      return await new Promise((resolve,reject) => cropped.toBlob(blob => blob ? resolve(blob) : reject(new Error("เตรียมลายเซ็นไม่สำเร็จ")),"image/png"));
    } finally { URL.revokeObjectURL(objectUrl); }
  }

  async function saveWardrobeSignature() {
    if (signatureBusy || !canManageSignature || !signatureDirty || (signatureMode === "upload" ? !pendingSignature : signatureInk < 6)) return;
    signatureBusy = true; signatureSaving = true;
    updateSignatureSaveButton();
    $("wardrobeSignatureStatus").textContent = "";
    try {
      const rendered = signatureMode === "upload" ? await renderAdjustedSignature(pendingSignature,signatureAdjust) : null;
      const stamp = signatureMode === "upload" ? await makeRedSignature(rendered.blob, true) : await prepareSignature(signaturePad);
      const body = new FormData(); body.set("signature",stamp,"signature.png");
      const response = await fetch(signatureApi,{method:"PUT",credentials:"same-origin",body});
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.image) {
        const messages = {unauthorized:"กรุณาเข้าสู่ระบบก่อนยืนยันลายเซ็น",forbidden:"เฉพาะเจ้าของตัวละครหรือสต๊าฟที่เข้าโหมดแล้วเท่านั้นที่ยืนยันได้", "invalid-signature":"ภาพลายเซ็นไม่ถูกต้อง กรุณาเลือกภาพใหม่", "signature-too-large":"ไฟล์ลายเซ็นมีขนาดใหญ่เกินไป"};
        throw new Error(messages[result.error] || "บันทึกลายเซ็นไม่สำเร็จ กรุณาลองอีกครั้ง");
      }
      character.employeeCardSignature = result.image;
      character.employeeCardSigned = true;
      setSignatureStamp(result.image);
      signatureConfirmed = true;
      window.dispatchEvent(new CustomEvent("rnc:employee-signature-change",{detail:{characterId:character.id,signed:true}}));
      signatureDialog.close();
      if (signaturePurpose === "edit") {
        showCharacterSignatureToast("บันทึกลายเซ็นแล้ว");
        editSignature.focus({preventScroll:true});
      } else openWardrobe();
    } catch (error) {
      $("wardrobeSignatureStatus").textContent = error.message || "บันทึกลายเซ็นไม่สำเร็จ กรุณาลองอีกครั้ง";
    } finally { signatureBusy = false; signatureSaving = false; updateSignatureSaveButton(); }
  }
  function signaturePoint(event) {
    const bounds = signaturePad.getBoundingClientRect();
    return {x:(event.clientX - bounds.left) * signaturePad.width / bounds.width,y:(event.clientY - bounds.top) * signaturePad.height / bounds.height};
  }
  function preview(id, source) {
    const image = $(id);
    const previous = previewUrls.get(id);
    const objectUrl = source instanceof Blob ? URL.createObjectURL(source) : "";
    if (source) image.src = objectUrl || source;
    else image.removeAttribute("src");
    image.hidden = !source;
    if (objectUrl) previewUrls.set(id, objectUrl);
    else previewUrls.delete(id);
    if (previous) URL.revokeObjectURL(previous);
  }
  function openForm(skin) {
    if (!canEdit || !ready || busy) return;
    resetForm(); editing = skin || null; newSkinId = skin ? "" : crypto.randomUUID();
    $("wardrobeFormTitle").textContent = t(skin ? "editTitle" : "addTitle");
    $("wardrobeSkinName").value = skin?.name || ""; $("wardrobeSkinName").readOnly = Boolean(skin?.isDefault);
    $("wardrobeSkinDescription").value = skin?.description || "";
    imageDisplayScale = skinImageScale(skin);
    imageOffsetX = skinImageOffsetX(skin);
    imageOffsetY = skinImageOffsetY(skin);
    const framingOption = savedFramingOption(skin);
    framingOptions.querySelector('[value="legacy"]').closest("label").hidden = framingOption !== "legacy";
    framingOptions.querySelector(`[value="${framingOption}"]`).checked = true;
    imageScaleControl.value = String(imageDisplayScale);
    $("wardrobeImageScaleValue").textContent = `${imageDisplayScale}%`;
    $("wardrobeSkinImage").required = false;
    preview("wardrobeImageTransformPreview",skin?.image || ""); preview("wardrobeChibiPreview",skin?.chibi || "");
    preview("wardrobeMediumPreview",canHaveMedium ? skin?.medium || "" : "");
    $("removeWardrobeChibi").hidden = !skin?.chibi;
    $("removeWardrobeMedium").hidden = !skin?.medium;
    syncOutfitPreview();
    form.hidden = false; skinDialog.showModal(); fitOutfitArtwork(); status(""); updateControls(); $("wardrobeSkinName").focus();
  }
  async function decodeWardrobeImage(file) {
    if (!file || !file.size) throw new Error("กรุณาเลือกไฟล์รูปที่มีข้อมูล");
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const png = [137,80,78,71,13,10,26,10].every((byte, index) => bytes[index] === byte);
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!png && !jpeg && !webp) throw new Error("รองรับรูป PNG, JPEG และ WebP เท่านั้น");
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file);
        if (bitmap.width && bitmap.height) {
          return {source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close()};
        }
        bitmap.close();
      } catch {}
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    let timer;
    try {
      await new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error("เปิดรูปใช้เวลานาน กรุณาลองเลือกไฟล์อีกครั้ง")), 20000);
        image.onload = resolve;
        image.onerror = () => reject(new Error("เบราว์เซอร์เปิดรูปนี้ไม่ได้ กรุณาลอง PNG, JPEG หรือ WebP ไฟล์อื่น"));
        image.src = url;
      });
      if (!image.naturalWidth || !image.naturalHeight) throw new Error("เปิดรูปไม่สำเร็จ กรุณาเลือกไฟล์ใหม่");
      return {source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url)};
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    } finally {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
    }
  }

  function canvasBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob && ["image/png", "image/jpeg", "image/webp"].includes(blob.type)) resolve(blob);
        else reject(new Error("เตรียมรูปไม่สำเร็จ กรุณาเลือกไฟล์ใหม่"));
      }, "image/webp", quality);
    });
  }
  async function prepareImage(file, chibi) {
    const decoded = await decodeWardrobeImage(file);
    try {
      const limit = chibi ? 1600 : 3200;
      let scale = Math.min(1,limit / Math.max(decoded.width,decoded.height)), quality = .9;
      for (let attempt = 0; attempt < 24; attempt++) {
        const canvas = document.createElement("canvas"); canvas.width = Math.max(1,Math.round(decoded.width * scale)); canvas.height = Math.max(1,Math.round(decoded.height * scale));
        const context = canvas.getContext("2d"); if (!context) throw new Error("ไม่สามารถเตรียมรูปได้ กรุณาลองอีกครั้ง");
        context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
        context.drawImage(decoded.source,0,0,canvas.width,canvas.height);
        const blob = await canvasBlob(canvas,quality);
        if (blob.size <= (chibi ? 700 : 1800) * 1024) return blob;
        if (blob.type !== "image/png" && quality > .64) quality -= .08;
        else { scale *= .82; quality = .88; }
      }
      throw new Error("เตรียมรูปไม่สำเร็จ กรุณาลองเลือกไฟล์อีกครั้ง");
    } finally { decoded.release(); }
  }
  function syncOutfitPreview() {
    const artworkSource = imageTransformPreview.getAttribute("src");
    const hasArtwork = Boolean(artworkSource);
    const hasChibi = Boolean($("wardrobeChibiPreview").getAttribute("src"));
    const hasMedium = Boolean($("wardrobeMediumPreview").getAttribute("src"));
    $("wardrobeMediumSection").hidden = !canHaveMedium;
    $("wardrobeMediumEmpty").hidden = hasMedium;
    $("wardrobeMediumActionLabel").textContent = t(hasMedium ? "changeArtwork" : "addMedium");
    $("chooseWardrobeArtwork").hidden = hasArtwork;
    $("wardrobeArtworkCanvas").hidden = !hasArtwork;
    $("wardrobeArtworkChange").hidden = !hasArtwork;
    $("wardrobePreviewModes").hidden = !hasArtwork;
    $("wardrobePreviewModes").setAttribute("aria-label",t("previewMode"));
    $("wardrobeImageSizeControls").hidden = !hasArtwork;
    $("wardrobeFramingOption").hidden = !hasArtwork;
    if (hasArtwork && outfitPreviewMode === "profile") {
      if (profilePreviewImage.getAttribute("src") !== artworkSource) profilePreviewImage.setAttribute("src", artworkSource);
    } else {
      profilePreviewImage.removeAttribute("src");
    }
    $("wardrobeImageEditor").classList.toggle("has-artwork",hasArtwork);
    $("chooseWardrobeArtwork").setAttribute("aria-label",t(hasArtwork ? "changeArtwork" : "uploadArtwork"));
    $("wardrobeOutfitPreviewName").textContent = $("wardrobeSkinName").value.trim() || t("previewName");
    $("wardrobeChibiEmpty").hidden = hasChibi;
    $("wardrobeChibiActionLabel").textContent = t(hasChibi ? "changeArtwork" : "addChibi");
    fitOutfitArtwork();
  }
  function fitOutfitArtwork() {
    const stage = $("wardrobeArtworkStage");
    $("wardrobeImageEditor").dataset.previewMode = outfitPreviewMode;
    $("previewWardrobeScene").setAttribute("aria-pressed",String(outfitPreviewMode === "scene"));
    $("previewWardrobeFull").setAttribute("aria-pressed",String(outfitPreviewMode === "full"));
    $("previewWardrobeProfile").setAttribute("aria-pressed",String(outfitPreviewMode === "profile"));
    profilePreview.hidden = outfitPreviewMode !== "profile";
    imageTransformPreview.style.setProperty("--wardrobe-image-scale",String(imageDisplayScale / 100));
    imageTransformPreview.style.setProperty("--wardrobe-image-offset-x",imageOffsetX + "%");
    imageTransformPreview.style.setProperty("--wardrobe-image-offset-y",imageOffsetY + "%");
    const framingOption = selectedFramingOption();
    const profileMode = outfitPreviewMode === "profile";
    const canPosition = outfitPreviewMode === "scene" || (profileMode && framingOption === "true");
    const artworkSource = imageTransformPreview.getAttribute("src");
    const canPan = !form.hidden && canEdit && !busy && !processing.image && canPosition && Boolean(artworkSource);
    stage.dataset.panEnabled = String(canPan);
    stage.tabIndex = canPan ? 0 : -1;
    const previewLabel = { scene:"scenePreview", full:"fullPreview", profile:"profilePreview" };
    stage.setAttribute("aria-label",t(canPan && !profileMode ? "panHint" : previewLabel[outfitPreviewMode]));
    stage.title = canPan && !profileMode ? t("panHint") : "";
    profilePanHint.hidden = !profileMode || !artworkSource;
    if (profilePanHint.hidden) {
      stage.removeAttribute("aria-describedby");
    } else {
      const message = t(framingOption === "true" ? "profilePanHint" : "profilePanEnable");
      if (profilePanHint.textContent !== message) profilePanHint.textContent = message;
      stage.setAttribute("aria-describedby", profilePanHint.id);
    }
    if (form.hidden || !artworkSource) return;
    const mobile = matchMedia("(max-width:900px)").matches;
    if (profileMode) {
      fitCharacterPreview(stage, mobile, framingOption, artworkSource);
      return;
    }
    const actualStage = screen.querySelector(".wardrobe-left");
    const width = actualStage?.clientWidth || (mobile ? innerWidth - 10 : innerWidth - 10 - Math.min(390,Math.max(310,innerWidth * .27)));
    const height = actualStage?.clientHeight || (mobile ? Math.max(350,innerHeight * .58) : innerHeight - 10);
    const ratio = width / height;
    stage.style.aspectRatio = String(ratio);
    stage.style.maxWidth = Math.min(430,Math.max(260,innerHeight * .5)) * ratio + "px";
  }
  function fitCharacterPreview(stage, mobile, framingOption, artworkSource) {
    // Show the initial character viewport using its own portrait frame at a reduced size.
    const width = document.documentElement.clientWidth - (mobile ? 18 : 26);
    const height = mobile ? innerHeight - 18 : Math.max(590, innerHeight) - 21;
    const ratio = width / height;
    stage.style.aspectRatio = String(ratio);
    stage.style.maxWidth = Math.min(430, Math.max(260, innerHeight * .5)) * ratio + "px";
    profilePreview.style.setProperty("--preview-width", width + "px");
    profilePreview.style.setProperty("--preview-height", height + "px");
    profilePreview.style.setProperty("--preview-scale", String(stage.clientWidth / width));
    applyProfileFraming(profilePreviewFrame, profilePreviewImage, {
      isDefault: editing?.isDefault,
      image: artworkSource,
      applyFramingToProfile: framingOption === "legacy" ? null : framingOption === "true",
      imageScale: imageDisplayScale, imageOffsetX, imageOffsetY,
    }, imageTransformPreview.naturalWidth / imageTransformPreview.naturalHeight || 2 / 3);
  }

  function stopOutfitPan(revert = false) {
    const pan = outfitPan;
    if (!pan) return;
    outfitPan = null;
    outfitStage.classList.remove("is-panning");
    if (outfitStage.hasPointerCapture(pan.id)) outfitStage.releasePointerCapture(pan.id);
    if (revert) { imageOffsetX = pan.startOffset; imageOffsetY = pan.startOffsetY; fitOutfitArtwork(); }
  }
  function startOutfitPan(event) {
    if (outfitPan || outfitStage.dataset.panEnabled !== "true" || event.isPrimary === false || (event.pointerType === "mouse" && event.button !== 0) || event.target.closest("button")) return;
    const frame = outfitPreviewMode === "profile" ? profilePreviewFrame : outfitStage;
    const {width,height} = frame.getBoundingClientRect();
    if (!width || !height) return;
    if (event.pointerType !== "touch") event.preventDefault();
    outfitStage.focus({preventScroll:true});
    outfitPan = {id:event.pointerId,startX:event.clientX,startY:event.clientY,startOffset:imageOffsetX,startOffsetY:imageOffsetY,width,height};
    outfitStage.classList.add("is-panning");
    outfitStage.setPointerCapture(event.pointerId);
  }
  function moveOutfitPan(event) {
    const pan = outfitPan;
    if (!pan || pan.id !== event.pointerId) return;
    if (busy || processing.image || outfitStage.dataset.panEnabled !== "true") { stopOutfitPan(); return; }
    const dx = event.clientX - pan.startX, dy = event.clientY - pan.startY;
    if (!pan.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    pan.moved = true;
    event.preventDefault();
    imageOffsetX = Math.round(Math.max(-100,Math.min(100,pan.startOffset + dx * 100 / pan.width)) * 100) / 100 || 0;
    imageOffsetY = Math.round(Math.max(-100,Math.min(100,pan.startOffsetY + dy * 100 / pan.height)) * 100) / 100 || 0;
    fitOutfitArtwork();
  }
  function endOutfitPan(event) {
    if (outfitPan?.id === event.pointerId) stopOutfitPan(event.type !== "pointerup");
  }
  function keyOutfitPan(event) {
    if (event.key === "Escape" && outfitPan) { event.preventDefault(); event.stopPropagation(); stopOutfitPan(true); return; }
    if (event.target !== outfitStage || outfitStage.dataset.panEnabled !== "true" || !["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home"].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 5 : 1;
    if (event.key === "Home") imageOffsetX = imageOffsetY = 0;
    else if (["ArrowLeft","ArrowRight"].includes(event.key)) imageOffsetX = Math.round(Math.max(-100,Math.min(100,imageOffsetX + (event.key === "ArrowRight" ? step : -step))) * 100) / 100 || 0;
    else imageOffsetY = Math.round(Math.max(-100,Math.min(100,imageOffsetY + (event.key === "ArrowDown" ? step : -step))) * 100) / 100 || 0;
    fitOutfitArtwork();
  }
  async function chooseImage(slot, input, droppedFile) {
    if (busy || form.hidden || (slot === "medium" && !canHaveMedium)) return;
    const file = droppedFile || input.files?.[0];
    if (!file) return;
    // The draft owns the File after selection. Clear the native input so picking it again emits change.
    input.value = "";
    const job = ++jobs[slot]; processing[slot] = true; status(t("preparing")); updateControls();
    try {
      let blob = file;
      if (slot !== "image") blob = await prepareImage(file,true);
      else {
        const decoded = await decodeWardrobeImage(file);
        decoded.release();
      }
      if (job !== jobs[slot] || form.hidden) return;
      if (slot === "image") {
        preview("wardrobeImageTransformPreview",file);
        pendingImage = file;
      } else if (slot === "chibi") {
        preview("wardrobeChibiPreview",blob);
        pendingChibi = blob;
        removeChibi = false;
        $("removeWardrobeChibi").hidden = false;
      } else {
        preview("wardrobeMediumPreview",blob);
        pendingMedium = blob;
        removeMedium = false;
        $("removeWardrobeMedium").hidden = false;
      }
      syncOutfitPreview();
      status("");
    } catch(error) { if (job === jobs[slot]) status(error.message || "เตรียมรูปไม่สำเร็จ",true); }
    finally { if (job === jobs[slot]) { processing[slot] = false; updateControls(); } }
  }
  editSignature.hidden = !canManageSignature;
  $("closeWardrobeSignature").addEventListener("click",closeSignatureGate);
  signatureDialog.addEventListener("cancel",event => { if (signatureBusy) event.preventDefault(); });
  signatureDialog.addEventListener("click",event => { if (event.target === signatureDialog) closeSignatureGate(); });
  $("clearWardrobeSignature").addEventListener("click",() => { resetSignatureDraft(); $("wardrobeSignatureStatus").textContent = ""; });
  $("uploadWardrobeSignature").addEventListener("click",() => signatureFile.click());
  signaturePreview.addEventListener("load",scheduleSignatureAdjustmentPreview);
  signatureAdjustmentPanel.addEventListener("input",event => {
    const key = event.target.dataset.signatureAdjustment;
    if (!key || signatureBusy || signatureMode !== "upload") return;
    signatureAdjust[key] = Number(event.target.value); signatureDirty = true;
    updateSignatureAdjustmentUI(); updateSignatureSaveButton();
  });
  signatureTransform.addEventListener("pointerdown",event => {
    if (signatureBusy || signatureMode !== "upload" || !canManageSignature || (event.pointerType === "mouse" && event.button !== 0) || signatureTransformPointer) return;
    event.preventDefault();
    const paper = signaturePreview.parentElement.parentElement.getBoundingClientRect();
    const center = {x:paper.left + paper.width / 2 + paper.width * signatureAdjust.x / 100,y:paper.top + paper.height / 2 + paper.height * signatureAdjust.y / 100};
    const handle = event.target.closest("[data-signature-transform]");
    const mode = handle?.dataset.signatureTransform || "move";
    const distance = Math.hypot(event.clientX - center.x,event.clientY - center.y);
    signatureTransformPointer = {id:event.pointerId,mode,startX:event.clientX,startY:event.clientY,center,startDistance:Math.max(1,distance),startAngle:Math.atan2(event.clientY - center.y,event.clientX - center.x) * 180 / Math.PI,startScale:signatureAdjust.scale,startRotation:signatureAdjust.rotation,startOffsetX:signatureAdjust.x,startOffsetY:signatureAdjust.y};
    signatureTransform.classList.add("is-dragging");
    signatureTransform.setPointerCapture(event.pointerId);
  });
  signatureTransform.addEventListener("pointermove",event => {
    const drag = signatureTransformPointer;
    if (!drag || drag.id !== event.pointerId) return;
    const paper = signaturePreview.parentElement.parentElement.getBoundingClientRect();
    if (drag.mode === "move") {
      signatureAdjust.x = Math.max(-50,Math.min(50,drag.startOffsetX + (event.clientX - drag.startX) * 100 / paper.width));
      signatureAdjust.y = Math.max(-50,Math.min(50,drag.startOffsetY + (event.clientY - drag.startY) * 100 / paper.height));
    } else if (drag.mode === "rotate") {
      const angle = Math.atan2(event.clientY - drag.center.y,event.clientX - drag.center.x) * 180 / Math.PI;
      const next = drag.startRotation + angle - drag.startAngle;
      signatureAdjust.rotation = ((next + 180) % 360 + 360) % 360 - 180;
    } else {
      const distance = Math.hypot(event.clientX - drag.center.x,event.clientY - drag.center.y);
      signatureAdjust.scale = Math.max(40,Math.min(300,drag.startScale * distance / drag.startDistance));
    }
    signatureDirty = true;
    updateSignatureAdjustmentUI(); updateSignatureSaveButton();
  });
  function finishSignatureTransform(event) {
    if (!signatureTransformPointer || signatureTransformPointer.id !== event.pointerId) return;
    if (signatureTransform.hasPointerCapture(event.pointerId)) signatureTransform.releasePointerCapture(event.pointerId);
    signatureTransformPointer = null; signatureTransform.classList.remove("is-dragging");
  }
  signatureTransform.addEventListener("pointerup",finishSignatureTransform);
  signatureTransform.addEventListener("pointercancel",finishSignatureTransform);
  signatureTransform.addEventListener("lostpointercapture",finishSignatureTransform);
  $("resetSignatureAdjustments").addEventListener("click",() => {
    const changed = signatureAdjust.scale !== 100 || signatureAdjust.x !== 0 || signatureAdjust.y !== 0 || signatureAdjust.rotation !== 0 || signatureAdjust.pivotX !== 50 || signatureAdjust.pivotY !== 50;
    signatureAdjust = {scale:100,x:0,y:0,rotation:0,pivotX:50,pivotY:50};
    if (changed && signatureMode === "upload") signatureDirty = true;
    updateSignatureAdjustmentUI(); updateSignatureSaveButton();
  });
  signatureFile.addEventListener("change",async () => {
    const file = signatureFile.files?.[0];
    if (!file) return;
    if (signatureMode === "draw" && signatureDirty) {
      $("wardrobeSignatureStatus").textContent = "ล้างลายเซ็นก่อนเปลี่ยนเป็นรูปอัปโหลด";
      signatureFile.value = ""; return;
    }
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 20 * 1024 * 1024) {
      $("wardrobeSignatureStatus").textContent = "เลือกภาพลายเซ็น PNG, JPG หรือ WebP ขนาดไม่เกิน 20 MB";
      signatureFile.value = ""; return;
    }
    signatureBusy = true; updateSignatureSaveButton(); $("wardrobeSignatureStatus").textContent = "กำลังเตรียมภาพลายเซ็น…";
    try {
      const original = await prepareSignature(file);
      const stamp = await makeRedSignature(original);
      pendingSignature = await trimSignatureToInk(stamp); signatureMode = "upload"; signatureInk = 0; signatureDirty = true; signatureAdjust = {scale:100,x:0,y:0,rotation:0,pivotX:50,pivotY:50};
      if (signaturePreviewUrl) URL.revokeObjectURL(signaturePreviewUrl);
      signaturePreviewUrl = URL.createObjectURL(pendingSignature); signaturePreview.src = signaturePreviewUrl; signaturePreview.hidden = false; updateSignatureAdjustmentUI();
      signaturePad.getContext("2d").clearRect(0,0,signaturePad.width,signaturePad.height);
      $("wardrobeSignatureStatus").textContent = "";
    } catch(error) { $("wardrobeSignatureStatus").textContent = error.message || "เปิดภาพลายเซ็นไม่สำเร็จ"; }
    finally { signatureBusy = false; updateSignatureSaveButton(); signatureFile.value = ""; }
  });
  signaturePad.addEventListener("pointerdown",event => {
    if (signatureBusy || signatureMode !== "draw" || !canManageSignature || (event.pointerType === "mouse" && event.button !== 0) || signaturePointer !== null) return;
    event.preventDefault();
    signaturePointer = event.pointerId; signatureLastPoint = signaturePoint(event);
    signaturePad.setPointerCapture(event.pointerId); updateSignatureSaveButton();
  });
  signaturePad.addEventListener("pointermove",event => {
    if (signaturePointer !== event.pointerId || !signatureLastPoint) return;
    const next = signaturePoint(event), ctx = signaturePad.getContext("2d");
    ctx.strokeStyle = "#ca3930"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(signatureLastPoint.x,signatureLastPoint.y); ctx.lineTo(next.x,next.y); ctx.stroke();
    signatureInk += Math.hypot(next.x - signatureLastPoint.x,next.y - signatureLastPoint.y); signatureDirty = true; signatureLastPoint = next; updateSignatureSaveButton();
  });
  function finishSignatureStroke(event) {
    if (signaturePointer !== event.pointerId) return;
    if (signaturePad.hasPointerCapture(event.pointerId)) signaturePad.releasePointerCapture(event.pointerId);
    signaturePointer = null; signatureLastPoint = null;
  }
  signaturePad.addEventListener("pointerup",finishSignatureStroke);
  signaturePad.addEventListener("pointercancel",finishSignatureStroke);
  signaturePad.addEventListener("lostpointercapture",finishSignatureStroke);
  $("saveWardrobeSignature").addEventListener("click",saveWardrobeSignature);
  $("closeWardrobe").addEventListener("click", () => closeWardrobe());

  wardrobeChibiButton.addEventListener("click", () => showSkinArtwork("chibi"));
  wardrobeMediumButton.addEventListener("click", () => showSkinArtwork("medium"));
  $("retryWardrobe").addEventListener("click",loadWardrobe);
  $("wardrobeLanguage").addEventListener("change",event => setLanguage(event.target.value));
  $("addWardrobeSkin").addEventListener("click",() => openForm(null));
  $("editWardrobeSkin").addEventListener("click",() => openForm(activeSkin()));
  $("cancelWardrobeEdit").addEventListener("click",() => { if (!busy) discardForm(); });
  $("closeWardrobeForm").addEventListener("click",() => { if (!busy) discardForm(); });
  skinDialog.addEventListener("cancel",event => { event.preventDefault(); if (!busy) discardForm(); });
  skinDialog.addEventListener("click",event => { if (isDialogBackdrop(event,skinDialog) && !busy && !confirmDialog.open) discardForm(); });
  $("wardrobeConfirmCancel").addEventListener("click",() => finishWardrobeConfirmation(false));
  $("wardrobeConfirmProceed").addEventListener("click",() => finishWardrobeConfirmation(true));
  $("closeWardrobeConfirm").addEventListener("click",() => finishWardrobeConfirmation(false));
  confirmDialog.addEventListener("cancel",event => { event.preventDefault(); finishWardrobeConfirmation(false); });
  confirmDialog.addEventListener("click",event => { if (isDialogBackdrop(event,confirmDialog)) finishWardrobeConfirmation(false); });
  $("wardrobeSkinName").addEventListener("input",syncOutfitPreview);
  $("wardrobeSkinImage").addEventListener("change",event => chooseImage("image",event.target));
  $("wardrobeSkinChibi").addEventListener("change",event => chooseImage("chibi",event.target));
  $("wardrobeSkinMedium").addEventListener("change",event => chooseImage("medium",event.target));
  imageTransformPreview.addEventListener("load",fitOutfitArtwork);
  const outfitPreviewObserver = new ResizeObserver(fitOutfitArtwork);
  outfitPreviewObserver.observe($("wardrobeArtworkStage"));
  const actualOutfitStage = screen.querySelector(".wardrobe-left");
  if (actualOutfitStage) outfitPreviewObserver.observe(actualOutfitStage);
  $("wardrobeArtworkChange").addEventListener("click",() => { if (!busy) $("wardrobeSkinImage").click(); });
  [["previewWardrobeScene","scene"], ["previewWardrobeProfile","profile"], ["previewWardrobeFull","full"]].forEach(([id,mode]) => {
    $(id).addEventListener("click", () => {
      stopOutfitPan();
      outfitPreviewMode = mode;
      syncOutfitPreview();
    });
  });
  framingOptions.addEventListener("change", () => {
    stopOutfitPan();
    fitOutfitArtwork();
  });
  outfitStage.addEventListener("pointerdown",startOutfitPan);
  outfitStage.addEventListener("pointermove",moveOutfitPan);
  outfitStage.addEventListener("pointerup",endOutfitPan);
  outfitStage.addEventListener("pointercancel",endOutfitPan);
  outfitStage.addEventListener("lostpointercapture",endOutfitPan);
  outfitStage.addEventListener("keydown",keyOutfitPan);
  [["chooseWardrobeArtwork","wardrobeArtworkStage","image","wardrobeSkinImage"],["chooseWardrobeChibi","chooseWardrobeChibi","chibi","wardrobeSkinChibi"],["chooseWardrobeMedium","chooseWardrobeMedium","medium","wardrobeSkinMedium"]].forEach(([buttonId,dropId,slot,inputId]) => {
    const button = $(buttonId), input = $(inputId);
    button.addEventListener("click",() => { if (!busy) input.click(); });
    const drop = $(dropId);
    drop.addEventListener("dragover",event => { event.preventDefault(); if (!busy) { drop.classList.add("is-dragging"); if (event.dataTransfer) event.dataTransfer.dropEffect = "copy"; } });
    drop.addEventListener("dragleave",event => { if (!drop.contains(event.relatedTarget)) drop.classList.remove("is-dragging"); });
    drop.addEventListener("drop",event => { event.preventDefault(); drop.classList.remove("is-dragging"); const file = event.dataTransfer?.files?.[0]; if (!busy && file) chooseImage(slot,input,file); });
  });
  imageScaleControl.addEventListener("input",() => {
    imageDisplayScale = Number(imageScaleControl.value);
    if (outfitPreviewMode === "full") outfitPreviewMode = "scene";
    $("wardrobeImageScaleValue").textContent = `${imageDisplayScale}%`;
    fitOutfitArtwork();
  });
  $("resetWardrobeImageScale").addEventListener("click",() => { stopOutfitPan(); imageOffsetX = imageOffsetY = 0; imageScaleControl.value = "100"; imageScaleControl.dispatchEvent(new Event("input",{bubbles:true})); });
  function removeAccessory(slot, name) {
    if (busy || form.hidden) return;
    jobs[slot]++;
    processing[slot] = false;
    if (slot === "chibi") {
      pendingChibi = null;
      removeChibi = Boolean(editing?.chibi);
    } else {
      pendingMedium = null;
      removeMedium = Boolean(editing?.medium);
    }
    $("wardrobeSkin" + name).value = "";
    preview("wardrobe" + name + "Preview", "");
    $("removeWardrobe" + name).hidden = true;
    syncOutfitPreview();
    updateControls();
    $("chooseWardrobe" + name).focus({preventScroll:true});
  }
  $("removeWardrobeChibi").addEventListener("click", () => removeAccessory("chibi", "Chibi"));
  $("removeWardrobeMedium").addEventListener("click", () => removeAccessory("medium", "Medium"));
  list.addEventListener("keydown",event => {
    if (busy || !form.hidden || !["ArrowLeft","ArrowRight","Home","End"].includes(event.key)) return;
    event.preventDefault(); const index = skins.findIndex(skin => skin.id === activeId);
    const next = event.key === "Home" ? 0 : event.key === "End" ? skins.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + skins.length) % skins.length;
    applySkin(skins[next],true).then(() => list.querySelector('[aria-selected="true"]')?.focus());
  });
  form.addEventListener("submit",async event => {
    event.preventDefault(); if (busy || processing.image || processing.chibi || processing.medium || !canEdit) return;
    if (!pendingImage && !editing?.image) { status(t("needImage"),true); $("chooseWardrobeArtwork").focus(); return; }
    const body = new FormData(); body.set("name",$("wardrobeSkinName").value.trim()); body.set("description",$("wardrobeSkinDescription").value.trim());
    body.set("expectedUpdatedAt",editing?.updatedAt || "");
    body.set("imageScale",String(imageDisplayScale));
    body.set("imageOffsetX",String(imageOffsetX));
    body.set("imageOffsetY",String(imageOffsetY));
    const framingOption = selectedFramingOption();
    if (framingOption !== "legacy") body.set("applyFramingToProfile",framingOption);
    if (!editing) body.set("skinId",newSkinId);
    else if (editing.isDefault) body.set("skinId",editing.id);
    if (pendingChibi) body.set("chibi",pendingChibi,"chibi." + pendingChibi.type.split("/")[1]);
    if (removeChibi) body.set("removeChibi","1");
    if (canHaveMedium && pendingMedium) body.set("medium",pendingMedium,"medium." + pendingMedium.type.split("/")[1]);
    if (canHaveMedium && removeMedium) body.set("removeMedium","1");
    const releaseSaving = window.RNCSavingIndicator?.begin(pendingImage ? (language === "th" ? "กำลังเตรียมรูปและบันทึกชุด…" : "Preparing and saving outfit…") : t("saving"));
    busy = true; savingSkin = true; status(pendingImage ? t("preparing") : t("saving")); updateControls();
    try {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (pendingImage) {
        const image = await prepareImage(pendingImage,false);
        body.set("image",image,"skin." + image.type.split("/")[1]);
      }
      status(t("saving")); updateControls();
      const defaultSkinEdit = Boolean(editing?.isDefault);
      const path = editing && !defaultSkinEdit ? "/" + encodeURIComponent(editing.id) : "";
      const method = editing && !defaultSkinEdit ? "PUT" : "POST";
      const value = await request(path,{method,body});
      resetForm(); const shown = await acceptWardrobe(value,value.savedId); status(t(shown ? "saved" : "savedImageError"),!shown);
    } catch(error) { status(error.message,true); }
    finally { busy = false; savingSkin = false; releaseSaving?.(); updateControls(); }
  });
  $("deleteWardrobeSkin").addEventListener("click",async () => {
    const skin = activeSkin(); if (busy || !canEdit || skin.isDefault || confirmDialog.open) return;
    const message = language === "th" ? "ชุด “" + skin.name + "” จะถูกลบออกจากตู้เสื้อผ้า" : "“" + skin.name + "” will be removed from your wardrobe.";
    if (!await confirmWardrobeAction(t("deleteTitle"),message,t("deleteOutfit"),t("keepOutfit"))) return;
    const releaseSaving = window.RNCSavingIndicator?.begin(t("saving"));
    busy = true; updateControls(); status(t("saving"));
    try { const value = await request("/" + encodeURIComponent(skin.id),{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({expectedUpdatedAt:skin.updatedAt})}); const shown = await acceptWardrobe(value,"default"); status(t(shown ? "deleted" : "savedImageError"),!shown); }
    catch(error) { status(error.message,true); }
    finally { busy = false; releaseSaving?.(); updateControls(); }
  });
  document.addEventListener("keydown",event => {
    if (!opened || event.key !== "Escape" || event.defaultPrevented || confirmDialog.open || window.RNCSavingIndicator?.isActive() || signatureDialog.open) return;
    if (!skinDialog.open && document.querySelector("dialog[open]")) return;
    event.preventDefault();
    if (!form.hidden) { if (!busy) discardForm(); } else closeWardrobe();
  });
  window.addEventListener("popstate",async () => {
    if (opened && location.hash !== "#wardrobe") {
      if (busy || confirmDialog.open) { history.pushState({...history.state,rncWardrobe:character.id},"","#wardrobe"); return; }
      if (hasUnsavedChanges()) {
        history.pushState({...history.state,rncWardrobe:character.id},"","#wardrobe");
        if (await discardForm()) history.back();
        return;
      }
      if (!form.hidden) resetForm();
      hideWardrobe();
    } else if (!opened && location.hash === "#wardrobe") openWardrobe(false);
  });
  window.addEventListener("beforeunload",event => { if (busy || hasUnsavedChanges()) { event.preventDefault(); event.returnValue = ""; } });
  for (const [image, button, container] of [
    [wardrobeChibi, wardrobeChibiButton, wardrobeAccessories], [wardrobeMedium, wardrobeMediumButton, wardrobeAccessories],
  ]) {
    image.addEventListener("error", () => {
      image.hidden = true;
      button.hidden = true;
      container.hidden = !container.querySelector("button:not([hidden])");
    });
  }
  function renderSceneSelection() {
    const skin = activeSkin(), hero = $("wardrobeHeroImage");
    hero.hidden = !skin.image;
    hero.style.setProperty("--wardrobe-image-scale",String(skinImageScale(skin) / 100));
    hero.style.setProperty("--wardrobe-image-offset-x",skinImageOffsetX(skin) + "%");
    hero.style.setProperty("--wardrobe-image-offset-y",skinImageOffsetY(skin) + "%");
    if (skin.image) hero.src = skin.image; else hero.removeAttribute("src");
    $("wardrobeCurrentName").textContent = skin.name;
    $("wardrobeCurrentDescription").textContent = skin.description || "";
    $("wardrobeDefaultTag").hidden = !skin.isDefault;
    syncSkinAccessories(skin); renderList();
  }
  core.subscribe(type => {
    syncSceneState();
    if (type === "skin" || type === "data") renderSceneSelection();
    if (type === "error" && opened) status(loadError || core.getState().artworkError,true);
    if (type === "loaded") { $("retryWardrobe").hidden = !loadError; updateControls(); }
  });
  setLanguage(language); renderSceneSelection();
  window.RNCWardrobeUI = {open:openWardrobe,editSignature:() => openSignatureGate(true),isBusy:() => busy};
})();
