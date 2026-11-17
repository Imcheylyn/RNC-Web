(() => {
  "use strict";
  const ASPECT = 1047 / 1340;
  const MAX_ZOOM = 8;
  const limit = (value, low, high) => Math.max(low, Math.min(high, value));

  function coverWidth(width, height) {
    return Math.min(width, height * ASPECT);
  }

  function clampCrop(width, height, crop = {}) {
    const largest = coverWidth(width, height);
    const requestedBaseWidth = Number(crop.baseWidth);
    const baseWidth = requestedBaseWidth > 0 ? Math.min(requestedBaseWidth, largest) : largest;
    const cropWidth = limit(Number(crop.width) || baseWidth, baseWidth / MAX_ZOOM, baseWidth);
    const cropHeight = cropWidth / ASPECT;
    return {
      x:limit(Number(crop.x) || 0, 0, Math.max(0, width - cropWidth)),
      y:limit(Number(crop.y) || 0, 0, Math.max(0, height - cropHeight)),
      width:cropWidth, height:cropHeight, baseWidth,
    };
  }

  function portraitCrop(width, height, bounds = { x:0, y:0, width, height }) {
    const tall = bounds.height / bounds.width > 1.55;
    const baseWidth = Math.min(coverWidth(width, height), coverWidth(bounds.width, bounds.height));
    const cropHeight = baseWidth / ASPECT;
    const centerX = Number.isFinite(bounds.headX) ? bounds.headX : bounds.x + bounds.width / 2;
    return clampCrop(width, height, {
      x:centerX - baseWidth / 2,
      y:tall ? bounds.y - cropHeight * .025 : bounds.y + (bounds.height - cropHeight) / 2,
      width:baseWidth,
      baseWidth,
    });
  }

  function zoomCrop(width, height, crop, zoom) {
    const baseWidth = Number(crop.baseWidth) || coverWidth(width, height);
    const cropWidth = baseWidth / limit(Number(zoom) || 1, 1, MAX_ZOOM);
    return clampCrop(width, height, {
      x:crop.x + crop.width / 2 - cropWidth / 2,
      y:crop.y + crop.height / 2 - cropWidth / ASPECT / 2,
      width:cropWidth,
      baseWidth,
    });
  }

  function contentBounds(image) {
    const fallback = { x:0, y:0, width:image.width, height:image.height };
    try {
      const scale = Math.min(1, 512 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d", { willReadFrequently:true });
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        if (pixels[(y * canvas.width + x) * 4 + 3] > 20) {
          left = Math.min(left, x); right = Math.max(right, x);
          top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
      if (right < left) return fallback;
      let headSum = 0, headWeight = 0;
      const headBottom = top + (bottom - top) * .26;
      for (let y = top; y <= headBottom; y++) for (let x = left; x <= right; x++) {
        if (pixels[(y * canvas.width + x) * 4 + 3] > 20) { headSum += x; headWeight++; }
      }
      const sx = image.width / canvas.width, sy = image.height / canvas.height;
      return { x:left * sx, y:top * sy, width:(right - left + 1) * sx, height:(bottom - top + 1) * sy, headX:headWeight ? headSum / headWeight * sx : (left + right) / 2 * sx };
    } catch { return fallback; }
  }

  function suggest(image, alreadyCropped = false) {
    if (alreadyCropped && image.width === 1047 && image.height === 1340) {
      return { x:0, y:0, width:image.width, height:image.height };
    }
    return portraitCrop(image.width, image.height, contentBounds(image));
  }

  function draw(ctx, image, crop, x, y, width, height) {
    ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, x, y, width, height);
  }

  window.RNCEmployeePhoto = { ASPECT, MAX_ZOOM, coverWidth, clampCrop, portraitCrop, zoomCrop, suggest, draw };
})();
