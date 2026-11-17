(() => {
  "use strict";

  const WIDTH = 1968;
  const HEIGHT = 1240;
  const FONT = 'EmployeeDIN, Sarabun, "Noto Sans Thai", "Leelawadee UI", sans-serif';
  const photoTools = window.RNCEmployeePhoto;
  const nationalityTools = window.RNCEmployeeCardNationality;

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = new URL(source, location.href);
      if (url.origin !== location.origin && !["data:", "blob:"].includes(url.protocol)) image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("โหลดรูปบัตรไม่สำเร็จ กรุณาลองอีกครั้ง"));
      image.src = url.href;
    });
  }

  function rounded(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  }

  function fittedText(ctx, value, x, y, maxWidth, fontSize, options = {}) {
    const text = String(value || "—");
    let size = fontSize;
    ctx.textAlign = options.align || "left";
    ctx.fillStyle = options.color || "#211d25";
    ctx.font = (options.weight || 700) + " " + size + "px " + FONT;
    while (ctx.measureText(text).width > maxWidth && size > 30) {
      size -= 2;
      ctx.font = (options.weight || 700) + " " + size + "px " + FONT;
    }
    let visible = text;
    while (ctx.measureText(visible).width > maxWidth && visible.length > 1) visible = visible.slice(0, -2) + "…";
    ctx.fillText(visible, x, y);
  }

  function drawImageInBox(ctx, image, x, y, width, height, cover) {
    const scale = (cover ? Math.max : Math.min)(width / image.width, height / image.height);
    const drawnWidth = image.width * scale;
    const drawnHeight = image.height * scale;
    ctx.drawImage(image, x + (width - drawnWidth) / 2, y + (height - drawnHeight) * (cover ? .28 : .5), drawnWidth, drawnHeight);
  }

  function laminate(ctx) {
    const sheen = ctx.createLinearGradient(0, HEIGHT, WIDTH, 0);
    ["#88b7ff00", "#9adfff0b", "#acffdf17", "#ffeaaa0e", "#efb0ff18", "#a2c8ff08", "#ffffff00"].forEach((color, index) => sheen.addColorStop(index / 6, color));
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = "#ffffff99";
    ctx.lineWidth = 3;
    rounded(ctx, 2, 2, WIDTH - 4, HEIGHT - 4, 35);
    ctx.stroke();
  }

  function drawFront(canvas, template, photo, details, photoCrop) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.save();
    rounded(ctx, 0, 0, WIDTH, HEIGHT, 36);
    ctx.clip();
    // The labels belong to the supplied artwork. Draw only the character's values.
    // Crop its white outer canvas so the visible object is the card itself.
    ctx.drawImage(template, 82, 48, 3276, 2063, 0, 0, WIDTH, HEIGHT);
    const sx = value => (value - 82) * WIDTH / 3276;
    const sy = value => (value - 48) * HEIGHT / 2063;
    const x = sx(317), y = sy(497), w = 1047 * WIDTH / 3276, h = 1340 * HEIGHT / 2063;
    ctx.save();
    rounded(ctx, x, y, w, h, 17);
    ctx.clip();
    const background = ctx.createLinearGradient(x, y, x + w, y + h);
    background.addColorStop(0, "#343943");
    background.addColorStop(1, "#11151b");
    ctx.fillStyle = background;
    ctx.fillRect(x, y, w, h);
    if (photo) photoTools.draw(ctx, photo, photoCrop, x, y, w, h);
    else {
      fittedText(ctx, details.name.slice(0, 1), x + w / 2, y + h * .54, w * .8, 190, { align:"center", color:"#d9d9df" });
      fittedText(ctx, "PORTRAIT", x + w / 2, y + h * .68, w * .8, 30, { align:"center", weight:400, color:"#9ca6b4" });
    }
    ctx.restore();
    fittedText(ctx, details.name, sx(1450), sy(890), WIDTH * .51, 88);
    fittedText(ctx, details.position, sx(1450), sy(1295), WIDTH * .5, 88);
    fittedText(ctx, details.nationality, sx(1450), sy(1700), WIDTH * .5, 88);
    fittedText(ctx, details.id, x + w / 2, sy(1960), w * 1.04, 57, { align:"center", weight:400, color:"#62636b" });
    laminate(ctx);
    ctx.restore();
  }

  function drawBack(canvas, backTemplate, rainbowSeal, signature) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.save();
    rounded(ctx, 0, 0, WIDTH, HEIGHT, 36);
    ctx.clip();
    // Use the new printed back as the card surface; keep the previous content layout on top.
    ctx.drawImage(backTemplate, 82, 48, 3276, 2063, 0, 0, WIDTH, HEIGHT);



    // Retain the dark strip while leaving the new right-edge barcode unobstructed.
    const stripe = ctx.createLinearGradient(0, 235, 0, 445);
    stripe.addColorStop(0, "#232832"); stripe.addColorStop(.5, "#131720"); stripe.addColorStop(1, "#2a303a");
    ctx.fillStyle = stripe;
    ctx.fillRect(0, 235, WIDTH - 180, 210);

    // Keep the original signature field and its placement.
    ctx.fillStyle = "#f9f8f2";
    rounded(ctx, 100, 790, 1400, 260, 9);
    ctx.fill();
    ctx.strokeStyle = "#8592a0";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(135, 1012); ctx.lineTo(1465, 1012); ctx.stroke();
    if (signature) drawImageInBox(ctx, signature, 160, 815, 1280, 180, false);
    else fittedText(ctx, "ยังไม่ได้เซ็น", 800, 932, 1200, 40, { align:"center", weight:400, color:"#9b9b9d" });
    fittedText(ctx, "AUTHORIZED SIGNATURE", 100, 1110, 1400, 33, { weight:400, color:"#5d6979" });

    // Use the supplied transparent rainbow emblem as the laminated seal.
    const sealX = 1545, sealY = 790, sealSize = 255;
    const seal = ctx.createLinearGradient(sealX, sealY, sealX + sealSize, sealY + sealSize);
    seal.addColorStop(0, "#b8cdeb"); seal.addColorStop(.33, "#a9d5c7"); seal.addColorStop(.66, "#efd3a3"); seal.addColorStop(1, "#d3b6dc");
    ctx.save();
    ctx.globalAlpha = .7;
    ctx.shadowColor = "#75849a55";
    ctx.shadowBlur = 10;
    ctx.fillStyle = seal;
    rounded(ctx, sealX, sealY, sealSize, sealSize, 24); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.save();
    rounded(ctx, sealX, sealY, sealSize, sealSize, 24); ctx.clip();
    ctx.globalAlpha = 1;
    ctx.shadowColor = "#45526799";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;
    ctx.filter = "saturate(1.3) contrast(1.15)";
    ctx.drawImage(rainbowSeal, sealX + 4, sealY + 4, sealSize - 8, sealSize - 8);
    ctx.filter = "none";
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.restore();
    ctx.strokeStyle = "#71819899";
    ctx.lineWidth = 2;
    rounded(ctx, sealX, sealY, sealSize, sealSize, 24); ctx.stroke();

    laminate(ctx);
    ctx.restore();
  }

  function toBlob(canvas, type = "image/png", quality) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("สร้างไฟล์รูปไม่สำเร็จ")), type, quality));
  }

  function signatureCanvas(pad) {
    const ctx = pad.getContext("2d");
    const pixels = ctx.getImageData(0, 0, pad.width, pad.height).data;
    let left = pad.width, top = pad.height, right = -1, bottom = -1;
    for (let y = 0; y < pad.height; y++) for (let x = 0; x < pad.width; x++) {
      if (pixels[(y * pad.width + x) * 4 + 3]) {
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
    if (right < left) throw new Error("กรุณาเซ็นก่อนบันทึก");
    const cropped = document.createElement("canvas");
    cropped.width = right - left + 41;
    cropped.height = bottom - top + 41;
    cropped.getContext("2d").drawImage(pad, left, top, right - left + 1, bottom - top + 1, 20, 20, right - left + 1, bottom - top + 1);
    return cropped;
  }

  function drawUploadedSignature(pad, image) {
    const context = pad.getContext("2d");
    context.clearRect(0, 0, pad.width, pad.height);
    const scale = Math.min(pad.width * .9 / image.naturalWidth, pad.height * .78 / image.naturalHeight);
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
    context.drawImage(image, (pad.width - width) / 2, (pad.height - height) / 2, width, height);
    const pixels = context.getImageData(0, 0, pad.width, pad.height).data;
    let visible = 0;
    for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 12) visible++;
    if (!visible) throw new Error("ไม่พบลายเซ็นในภาพ กรุณาเลือกภาพใหม่");
    return visible;
  }

  function signatureInkBounds(pad, pixels) {
    let left = pad.width, top = pad.height, right = -1, bottom = -1;
    for (let y = 0; y < pad.height; y++) for (let x = 0; x < pad.width; x++) {
      if (pixels[(y * pad.width + x) * 4 + 3] < 12) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
    if (right < left) return null;
    const corners = [top * pad.width + left, top * pad.width + right, bottom * pad.width + left, bottom * pad.width + right].map(index => index * 4);
    const background = [0, 1, 2].map(channel => corners.reduce((sum, index) => sum + pixels[index + channel], 0) / corners.length);
    let transparent = 0, maxContrast = 0;
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const index = (y * pad.width + x) * 4;
      if (pixels[index + 3] < 240) transparent++;
      maxContrast = Math.max(maxContrast, ...background.map((value, channel) => Math.abs(pixels[index + channel] - value)));
    }
    return { background, opaque: transparent / ((right - left + 1) * (bottom - top + 1)) < .015 && maxContrast > 12 };
  }

  function signatureInkColor(pad) {
    const pixels = pad.getContext("2d").getImageData(0, 0, pad.width, pad.height).data;
    const bounds = signatureInkBounds(pad, pixels);
    if (!bounds) return "#182c48";
    let score = 0, color = "#182c48";
    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3];
      if (alpha < 12) continue;
      const contrast = Math.max(...bounds.background.map((value, channel) => Math.abs(pixels[index + channel] - value)));
      const candidate = bounds.opaque ? contrast * alpha / 255 : alpha;
      if (candidate <= score) continue;
      score = candidate;
      color = "#" + Array.from(pixels.slice(index, index + 3), value => value.toString(16).padStart(2, "0")).join("");
      if (!bounds.opaque && score === 255) break;
    }
    return color;
  }

  function recolorSignature(pad, color) {
    const context = pad.getContext("2d");
    const image = context.getImageData(0, 0, pad.width, pad.height);
    const pixels = image.data;
    const bounds = signatureInkBounds(pad, pixels);
    if (!bounds) return 0;
    const [red, green, blue] = color.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16));
    let visible = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      let alpha = pixels[index + 3];
      if (alpha < 12) continue;
      if (bounds.opaque) {
        const contrast = Math.max(...bounds.background.map((value, channel) => Math.abs(pixels[index + channel] - value)));
        alpha = contrast > 8 ? Math.round(alpha * Math.min(1, contrast / 120)) : 0;
      }
      if (alpha < 12) { pixels[index + 3] = 0; continue; }
      pixels[index] = red; pixels[index + 1] = green; pixels[index + 2] = blue; pixels[index + 3] = alpha;
      visible++;
    }
    if (visible) context.putImageData(image, 0, 0);
    return visible;
  }
  function init(character, options = {}) {
    const get = id => document.getElementById(id);
    const dialog = get("employeeCardDialog");
    const card = get("employeeCardFlip");
    const front = get("employeeCardFront");
    const back = get("employeeCardBack");
    const photoButton = get("chooseEmployeeCardPhoto");
    const photoInput = get("employeeCardFile");
    const photoPanel = get("employeePhotoPanel");
    const photoCanvas = get("employeePhotoCrop");
    const photoZoom = get("employeePhotoZoom");
    const savePhoto = get("saveEmployeePhoto");
    const signButton = get("openEmployeeSignature");
    const downloadButton = get("downloadEmployeeCard");
    const status = get("employeeCardStatus");
    const panel = get("employeeSignaturePanel");
    const pad = get("employeeSignaturePad");
    const signatureUploadButton = get("uploadEmployeeSignature");
    const signatureFile = get("employeeSignatureFile");
    const signatureColor = get("employeeSignatureColor");
    const signatureStatus = get("employeeSignatureStatus");
    const saveSignature = get("saveEmployeeSignature");
    const deleteSignature = get("deleteEmployeeSignature");
    const repair = options.repairText || (value => String(value || ""));
    const details = {
      name: repair(character.name),
      position: repair(character.characterType === "President" ? "President" : character.position || character.characterType),
      nationality: "XX",
      id: character.employeeId,
    };
    let template, backTemplate, rainbowSeal, photo, signature, preparation, photoCrop;
    let draftPhoto = null, draftCrop = null, photoDrag = null;
    let ready = false, busy = false, flipped = false, flipUntil = 0;
    let drawingPointer = null, lastPoint = null, inkDistance = 0, signatureMode = "draw", signatureDirty = false;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    photoButton.hidden = !options.canEdit;
    signButton.hidden = !options.canEditSignature;

    function updateActions() {
      photoButton.disabled = busy || !ready;
      photoButton.textContent = character.employeeCardImage ? "เปลี่ยน / จัดรูป" : "จัดรูปติดบัตร";
      savePhoto.disabled = busy || !draftPhoto;
      photoZoom.disabled = busy || !draftPhoto;
      get("resetEmployeePhoto").disabled = busy || !draftPhoto;
      get("chooseNewEmployeePhoto").disabled = busy;
      get("cancelEmployeePhoto").disabled = busy;
      photoCanvas.style.pointerEvents = busy ? "none" : "auto";
      signButton.disabled = busy || !ready;
      signButton.textContent = signature ? "จัดการลายเซ็น" : "เซ็นหลังบัตร";
      deleteSignature.hidden = !options.canEditSignature || !signature;
      deleteSignature.disabled = busy;
      downloadButton.disabled = busy || !ready || !signature;
      downloadButton.title = signature ? "บันทึกด้านหน้าและด้านหลังพร้อมลายเซ็นเป็นไฟล์ PNG" : "เซ็นหลังบัตรก่อนดาวน์โหลด";
      saveSignature.disabled = busy || !signatureDirty || inkDistance < 6;
      signatureUploadButton.disabled = busy;
      signatureFile.disabled = busy;
      signatureColor.disabled = busy;
      pad.style.pointerEvents = busy ? "none" : "auto";
      get("clearEmployeeSignature").disabled = busy;
      get("cancelEmployeeSignature").disabled = busy;
      get("closeEmployeeCard").disabled = busy;
      card.disabled = !ready;
    }

    function redraw() {
      drawFront(front, template, photo, details, photoCrop);
      drawBack(back, backTemplate, rainbowSeal, signature);
      front.setAttribute("aria-label", [details.name, details.position, details.nationality, details.id].join(" · "));
      updateActions();
    }

    function setFlipped(value) {
      flipped = value;
      flipUntil = performance.now() + 750;
      card.classList.remove("is-tilting");
      card.classList.toggle("is-flipped", flipped);
      card.style.setProperty("--card-tilt-x", "0deg");
      card.style.setProperty("--card-tilt-y", "0deg");
      card.setAttribute("aria-pressed", String(flipped));
      card.setAttribute("aria-label", (flipped ? "ด้านหลัง" : "ด้านหน้า") + "บัตรของ " + details.name + " · คลิกเพื่อพลิกบัตร");
      get("employeeCardHint").textContent = flipped ? "ด้านหลัง · คลิกที่บัตรเพื่อกลับด้านหน้า" : "คลิกที่บัตรเพื่อพลิกดูด้านหลัง";
    }

    async function prepare() {
      if (preparation) return preparation;
      status.textContent = "กำลังเตรียมบัตร…";
      updateActions();
      preparation = (async () => {
        const fontsReady = Promise.all([document.fonts.load("700 88px EmployeeDIN"), document.fonts.load("400 38px EmployeeDIN")]).then(() => document.fonts.ready);
        const countriesReady = fetch("/community/rnc/countries.json?v=nationality-demonym-20261107", { credentials:"same-origin" })
          .then(response => response.ok ? response.json() : [])
          .catch(() => []);
        const imagesReady = Promise.all([
          loadImage("/assets/employee-card-front.webp"),
          loadImage("/assets/employee-card-back.webp"),
          loadImage("/assets/Temporis%20Codex%20Rainbow%20B.png"),
          character.employeeCardImage ? loadImage(character.employeeCardImage).catch(() => null) : Promise.resolve(null),
          character.employeeCardSignature ? loadImage(character.employeeCardSignature).catch(() => null) : Promise.resolve(null),
        ]);
        const [, countries, images] = await Promise.all([fontsReady, countriesReady, imagesReady]);
        details.nationality = repair(nationalityTools.format(character, countries));
        [template, backTemplate, rainbowSeal, photo, signature] = images;
        if (!photo) {
          const fallback = character.galleryImage || character.image || character.detailImage;
          if (fallback) photo = await loadImage(fallback).catch(() => null);
        }
        if (photo) photoCrop = photoTools.suggest(photo, Boolean(character.employeeCardImage));
        ready = true;
        redraw();
        status.textContent = signature ? "พร้อมดาวน์โหลดทั้งด้านหน้าและด้านหลัง" : options.canEditSignature ? "เซ็นหลังบัตรเพื่อดาวน์โหลดเก็บไว้" : "เจ้าของบัตรยังไม่ได้เซ็น";
      })().catch(error => {
        preparation = null;
        status.textContent = error.message;
        updateActions();
      });
      return preparation;
    }

    async function upload(blob, kind) {
      const form = new FormData();
      form.append(kind, blob, kind === "signature" ? "signature.png" : "portrait.webp");
      const response = await fetch("/api/community/characters/" + encodeURIComponent(character.id) + "/employee-card", {
        method:"PUT", credentials:"same-origin", body:form,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.image) {
        const messages = {
          unauthorized:"กรุณาเข้าสู่ระบบอีกครั้งก่อนบันทึกบัตร",
          forbidden:"เจ้าของตัวละครหรือ Staff ที่เข้าโหมด Staff แล้วเท่านั้นที่แก้ไขบัตรได้",
          "employee-id-required":"ตัวละครนี้ยังไม่มี EmpID",
          "invalid-photo":"กรุณาเลือกไฟล์รูป PNG, JPG หรือ WebP",
          "photo-too-large":"รูปติดบัตรต้องมีขนาดไม่เกิน 5 MB",
          "invalid-signature":"ไฟล์ลายเซ็นไม่ถูกต้อง กรุณาเซ็นใหม่",
          "signature-too-large":"ลายเซ็นมีขนาดใหญ่เกินไป กรุณาเซ็นใหม่",
        };
        throw new Error(messages[result.error] || "บันทึกบัตรไม่สำเร็จ กรุณาลองอีกครั้ง");
      }
      return result.image;
    }

    window.addEventListener("rnc:employee-signature-change", async event => {
      if (event.detail?.characterId !== character.id || !ready) return;
      const source = character.employeeCardSignature;
      if (!source) {
        if (signature) { signature = null; redraw(); }
        return;
      }
      if (signature?.src === new URL(source, location.href).href) return;
      try {
        const replacement = await loadImage(source);
        if (character.employeeCardSignature === source) { signature = replacement; redraw(); }
      } catch { status.textContent = "โหลดลายเซ็นล่าสุดไม่สำเร็จ กรุณาเปิดบัตรอีกครั้ง"; }
    });

    function open() {
      if (!dialog.open) dialog.showModal();
      setFlipped(false);
      void prepare();
    }
    get("closeEmployeeCard").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => { if (event.target === dialog && !busy) dialog.close(); });
    dialog.addEventListener("cancel", event => {
      if (busy) event.preventDefault();
      else if (!photoPanel.hidden) { event.preventDefault(); photoPanel.hidden = true; photoButton.focus(); }
      else if (!panel.hidden) { event.preventDefault(); panel.hidden = true; signButton.focus(); }
    });
    dialog.addEventListener("close", () => { panel.hidden = true; photoPanel.hidden = true; });
    card.addEventListener("click", () => setFlipped(!flipped));
    card.addEventListener("pointermove", event => {
      if (event.pointerType === "touch" || reduceMotion.matches || performance.now() < flipUntil) return;
      const rect = card.parentElement.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      card.classList.add("is-tilting");
      card.style.setProperty("--card-tilt-x", (0.5 - y) * 11 + "deg");
      card.style.setProperty("--card-tilt-y", (x - 0.5) * 13 + "deg");
      card.style.setProperty("--shine-x", Math.round(x * 100) + "%");
      card.style.setProperty("--shine-y", Math.round(y * 100) + "%");
    });
    card.addEventListener("pointerleave", () => {
      card.classList.remove("is-tilting");
      card.style.setProperty("--card-tilt-x", "0deg");
      card.style.setProperty("--card-tilt-y", "0deg");
    });

    function renderPhotoCrop() {
      const ctx = photoCanvas.getContext("2d");
      ctx.clearRect(0, 0, photoCanvas.width, photoCanvas.height);
      if (draftPhoto && draftCrop) {
        photoTools.draw(ctx, draftPhoto, draftCrop, 0, 0, photoCanvas.width, photoCanvas.height);
        const percent = Math.round((draftCrop.baseWidth || photoTools.coverWidth(draftPhoto.width, draftPhoto.height)) / draftCrop.width * 100);
        photoZoom.value = String(percent);
        get("employeePhotoZoomValue").textContent = percent + "%";
      }
      updateActions();
    }
    photoButton.addEventListener("click", () => {
      panel.hidden = true; setFlipped(false);
      draftPhoto = photo || null;
      draftCrop = photo ? { ...photoCrop } : null;
      photoPanel.hidden = false;
      renderPhotoCrop(); photoCanvas.focus();
    });
    get("chooseNewEmployeePhoto").addEventListener("click", () => photoInput.click());
    get("cancelEmployeePhoto").addEventListener("click", () => { photoPanel.hidden = true; photoButton.focus(); });
    get("resetEmployeePhoto").addEventListener("click", () => {
      if (draftPhoto) { draftCrop = photoTools.suggest(draftPhoto); renderPhotoCrop(); }
    });
    photoZoom.addEventListener("input", () => {
      if (!draftPhoto || !draftCrop) return;
      draftCrop = photoTools.zoomCrop(draftPhoto.width, draftPhoto.height, draftCrop, Number(photoZoom.value) / 100);
      renderPhotoCrop();
    });
    photoCanvas.addEventListener("wheel", event => {
      if (!draftPhoto || !draftCrop || busy) return;
      event.preventDefault();
      const current = (draftCrop.baseWidth || photoTools.coverWidth(draftPhoto.width, draftPhoto.height)) / draftCrop.width;
      draftCrop = photoTools.zoomCrop(draftPhoto.width, draftPhoto.height, draftCrop, current * Math.exp(-event.deltaY * .0015));
      renderPhotoCrop();
    }, { passive:false });
    photoCanvas.addEventListener("pointerdown", event => {
      if (busy || !draftPhoto || photoDrag || (event.pointerType === "mouse" && event.button !== 0)) return;
      event.preventDefault();
      photoDrag = { id:event.pointerId, x:event.clientX, y:event.clientY };
      photoCanvas.setPointerCapture(event.pointerId);
    });
    photoCanvas.addEventListener("pointermove", event => {
      if (!photoDrag || photoDrag.id !== event.pointerId || !draftCrop) return;
      const rect = photoCanvas.getBoundingClientRect();
      draftCrop = photoTools.clampCrop(draftPhoto.width, draftPhoto.height, {
        ...draftCrop,
        x:draftCrop.x - (event.clientX - photoDrag.x) * draftCrop.width / rect.width,
        y:draftCrop.y - (event.clientY - photoDrag.y) * draftCrop.height / rect.height,
      });
      photoDrag.x = event.clientX; photoDrag.y = event.clientY;
      renderPhotoCrop();
    });
    function finishPhotoDrag(event) {
      if (!photoDrag || photoDrag.id !== event.pointerId) return;
      photoDrag = null;
      if (photoCanvas.hasPointerCapture(event.pointerId)) photoCanvas.releasePointerCapture(event.pointerId);
    }
    photoCanvas.addEventListener("pointerup", finishPhotoDrag);
    photoCanvas.addEventListener("pointercancel", finishPhotoDrag);
    photoCanvas.addEventListener("lostpointercapture", finishPhotoDrag);
    photoInput.addEventListener("change", async () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;
      if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
        status.textContent = "เลือกรูป PNG, JPG หรือ WebP ขนาดไม่เกิน 5 MB";
        photoInput.value = "";
        return;
      }
      busy = true; updateActions();
      status.textContent = "กำลังเตรียมรูป…";
      const objectUrl = URL.createObjectURL(file);
      try {
        draftPhoto = await loadImage(objectUrl);
        draftCrop = photoTools.suggest(draftPhoto);
        photoPanel.hidden = false;
        renderPhotoCrop();
        status.textContent = "จัดกรอบให้เห็นใบหน้า แล้วกดใช้รูปนี้บนบัตร";
      } catch (error) { status.textContent = error.message || "เปิดรูปไม่สำเร็จ"; }
      finally { URL.revokeObjectURL(objectUrl); photoInput.value = ""; busy = false; updateActions(); }
    });
    savePhoto.addEventListener("click", async () => {
      if (busy || !draftPhoto || !draftCrop) return;
      busy = true; updateActions(); status.textContent = "กำลังบันทึกรูปติดบัตร…";
      try {
        const cropped = document.createElement("canvas");
        cropped.width = 1047; cropped.height = 1340;
        photoTools.draw(cropped.getContext("2d"), draftPhoto, draftCrop, 0, 0, cropped.width, cropped.height);
        const source = await upload(await toBlob(cropped, "image/webp", .9), "photo");
        const replacement = await loadImage(source);
        character.employeeCardImage = source;
        photo = replacement;
        photoCrop = { x:0, y:0, width:photo.width, height:photo.height };
        photoPanel.hidden = true;
        redraw();
        status.textContent = "บันทึกรูปติดบัตรแล้ว";
      } catch (error) { status.textContent = error.message || "บันทึกรูปไม่สำเร็จ"; }
      finally { busy = false; updateActions(); if (photoPanel.hidden) photoButton.focus(); }
    });

    function clearPad() {
      pad.getContext("2d").clearRect(0, 0, pad.width, pad.height);
      drawingPointer = null; lastPoint = null; inkDistance = 0; signatureMode = "draw"; signatureDirty = false;
      signatureFile.value = "";
      get("employeeSignaturePlaceholder").hidden = false;
      updateActions();
    }
    signButton.addEventListener("click", () => {
      photoPanel.hidden = true; setFlipped(true); clearPad(); signatureStatus.textContent = ""; panel.hidden = false;
      if (signature) {
        try {
          inkDistance = Math.max(6, drawUploadedSignature(pad, signature));
          signatureMode = "existing";
          signatureColor.value = signatureInkColor(pad);
          get("employeeSignaturePlaceholder").hidden = true;
          updateActions();
        } catch (error) { clearPad(); signatureStatus.textContent = error.message; }
      }
      pad.focus();
    });
    signatureColor.addEventListener("input", () => {
      if (busy || inkDistance < 6) return;
      if (!recolorSignature(pad, signatureColor.value)) return;
      signatureDirty = true;
      signatureStatus.textContent = "ปรับสีแล้ว กดบันทึกลงบัตร";
      updateActions();
    });
    get("cancelEmployeeSignature").addEventListener("click", () => { panel.hidden = true; signButton.focus(); });
    get("clearEmployeeSignature").addEventListener("click", () => { clearPad(); signatureStatus.textContent = "ล้างเฉพาะช่องเซ็น ลายเซ็นบนบัตรยังอยู่"; });
    signatureUploadButton.addEventListener("click", () => signatureFile.click());
    signatureFile.addEventListener("change", async () => {
      const file = signatureFile.files && signatureFile.files[0];
      if (!file) return;
      if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 20 * 1024 * 1024) {
        signatureStatus.textContent = "เลือกลายเซ็น PNG, JPG หรือ WebP ขนาดไม่เกิน 20 MB";
        signatureFile.value = "";
        return;
      }
      busy = true; updateActions(); signatureStatus.textContent = "กำลังเตรียมลายเซ็น…";
      const objectUrl = URL.createObjectURL(file);
      try {
        const image = await loadImage(objectUrl);
        inkDistance = Math.max(6, drawUploadedSignature(pad, image));
        signatureMode = "upload"; signatureDirty = true;
        get("employeeSignaturePlaceholder").hidden = true;
        signatureStatus.textContent = "ตรวจสอบลายเซ็น แล้วกดบันทึกลงบัตร";
      } catch (error) {
        clearPad();
        signatureStatus.textContent = error.message || "เตรียมภาพลายเซ็นไม่สำเร็จ";
      } finally {
        URL.revokeObjectURL(objectUrl);
        signatureFile.value = "";
        busy = false; updateActions();
      }
    });
    const point = event => {
      const rect = pad.getBoundingClientRect();
      return { x:(event.clientX - rect.left) * pad.width / rect.width, y:(event.clientY - rect.top) * pad.height / rect.height };
    };
    pad.addEventListener("pointerdown", event => {
      if (busy || (event.pointerType === "mouse" && event.button !== 0) || drawingPointer !== null) return;
      event.preventDefault();
      if (signatureMode === "upload") {
        pad.getContext("2d").clearRect(0, 0, pad.width, pad.height);
        inkDistance = 0; signatureMode = "draw"; signatureDirty = false; signatureFile.value = ""; saveSignature.disabled = true;
      }
      drawingPointer = event.pointerId;
      signatureStatus.textContent = "";
      lastPoint = point(event);
      pad.setPointerCapture(event.pointerId);
      get("employeeSignaturePlaceholder").hidden = true;
    });
    pad.addEventListener("pointermove", event => {
      if (drawingPointer !== event.pointerId || !lastPoint) return;
      const next = point(event);
      const ctx = pad.getContext("2d");
      ctx.strokeStyle = signatureColor.value; ctx.lineWidth = 4.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(lastPoint.x, lastPoint.y); ctx.lineTo(next.x, next.y); ctx.stroke();
      inkDistance += Math.hypot(next.x - lastPoint.x, next.y - lastPoint.y); signatureDirty = true;
      lastPoint = next;
      saveSignature.disabled = busy || !signatureDirty || inkDistance < 6;
    });
    function finishStroke(event) {
      if (drawingPointer !== event.pointerId) return;
      if (pad.hasPointerCapture(event.pointerId)) pad.releasePointerCapture(event.pointerId);
      drawingPointer = null; lastPoint = null;
    }
    pad.addEventListener("pointerup", finishStroke);
    pad.addEventListener("pointercancel", finishStroke);
    pad.addEventListener("lostpointercapture", finishStroke);
    saveSignature.addEventListener("click", async () => {
      if (inkDistance < 6 || !signatureDirty || busy) return;
      busy = true; updateActions(); signatureStatus.textContent = "กำลังบันทึกลายเซ็น…";
      try {
        const source = await upload(await toBlob(signatureCanvas(pad)), "signature");
        const saved = await loadImage(source);
        character.employeeCardSignature = source;
        character.employeeCardSigned = true;
        signature = saved;
        redraw(); panel.hidden = true; setFlipped(true);
        window.dispatchEvent(new CustomEvent("rnc:employee-signature-change",{detail:{characterId:character.id,signed:true}}));
        status.textContent = "เซ็นบัตรแล้ว ดาวน์โหลดทั้งด้านหน้าและด้านหลังได้เลย";
      } catch (error) { signatureStatus.textContent = error.message || "บันทึกลายเซ็นไม่สำเร็จ"; }
      finally { busy = false; updateActions(); if (panel.hidden) downloadButton.focus(); }
    });

    deleteSignature.addEventListener("click", async () => {
      if (busy || !signature || !window.confirm("ลบลายเซ็นออกจากบัตรนี้? คุณสามารถเซ็นใหม่ได้ภายหลัง")) return;
      busy = true; updateActions(); signatureStatus.textContent = "กำลังลบลายเซ็น…";
      try {
        const response = await fetch("/api/community/characters/" + encodeURIComponent(character.id) + "/employee-card", { method:"DELETE", credentials:"same-origin" });
        if (!response.ok) throw new Error(response.status === 403 ? "เฉพาะเจ้าของตัวละครหรือ Staff ที่เข้าโหมดแล้วเท่านั้นที่ลบลายเซ็นได้" : "ลบลายเซ็นไม่สำเร็จ กรุณาลองอีกครั้ง");
        signature = null; character.employeeCardSignature = ""; character.employeeCardSigned = false;
        window.dispatchEvent(new CustomEvent("rnc:employee-signature-change",{detail:{characterId:character.id,signed:false}}));
        clearPad(); redraw(); panel.hidden = true; setFlipped(true);
        status.textContent = "ลบลายเซ็นออกจากบัตรแล้ว สามารถเซ็นใหม่ได้";
      } catch (error) { signatureStatus.textContent = error.message; }
      finally { busy = false; updateActions(); if (panel.hidden) signButton.focus(); }
    });

    downloadButton.addEventListener("click", async () => {
      if (!signature || !ready || busy) return;
      busy = true; updateActions(); status.textContent = "กำลังสร้างไฟล์บัตร…";
      try {
        redraw();
        const exported = document.createElement("canvas");
        exported.width = WIDTH + 96; exported.height = HEIGHT * 2 + 144;
        const ctx = exported.getContext("2d");
        ctx.drawImage(front, 48, 48); ctx.drawImage(back, 48, HEIGHT + 96);
        const blob = await toBlob(exported);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = "RNC-" + String(details.id).replace(/[^A-Za-z0-9_-]/g, "-") + ".png";
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        status.textContent = "ดาวน์โหลดบัตรด้านหน้า–หลังพร้อมลายเซ็นแล้ว";
      } catch (error) { status.textContent = error.message || "ดาวน์โหลดบัตรไม่สำเร็จ กรุณาลองอีกครั้ง"; }
      finally { busy = false; updateActions(); }
    });
    setFlipped(false);
    updateActions();
    return { open };
  }

  window.RNCEmployeeCard = { init };
})();
