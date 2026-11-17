(function() {
  const states = new WeakMap();
  function normalize(crop) {
    const value = crop && typeof crop === 'object' ? crop : {};
    const clamp = (raw, fallback, min, max) => {
      const number = Number(raw);
      return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
    };
    return { scale: clamp(value.scale, 1, 1, 3), x: clamp(value.x, 50, 0, 100), y: clamp(value.y, 50, 0, 100) };
  }
  function layoutSize(element) {
    if (!element) return null;
    // Animation transforms change the screen rectangle, not the artwork's layout size.
    const style = getComputedStyle(element);
    return {
      width: parseFloat(style.width) || element.clientWidth,
      height: parseFloat(style.height) || element.clientHeight,
    };
  }
  function getBaseSize(windowElement) {
    const image = windowElement && windowElement.querySelector('img');
    const rect = layoutSize(windowElement);
    if (!image || !rect || !rect.width || !rect.height || !image.naturalWidth || !image.naturalHeight) return null;
    const cover = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
    return { rect, width: image.naturalWidth * cover, height: image.naturalHeight * cover };
  }
  function measure(windowElement, crop) {
    const base = getBaseSize(windowElement);
    if (!base) return { x: 0, y: 0, width: 0, height: 0 };
    const safeCrop = normalize(crop);
    const width = base.width * safeCrop.scale;
    const height = base.height * safeCrop.scale;
    return { x: Math.max(0, (width - base.rect.width) / 2), y: Math.max(0, (height - base.rect.height) / 2), width, height };
  }
  function apply(windowElement, crop) {
    if (!windowElement) return;
    let state = states.get(windowElement);
    if (!state) {
      state = { crop: normalize(crop), boundImage: null, render: null };
      state.render = function() {
        const image = windowElement.querySelector('img');
        if (!image) return;
        const rect = layoutSize(windowElement);
        if (!rect.width || !rect.height || !image.naturalWidth || !image.naturalHeight) return;
        const bounds = measure(windowElement, state.crop);
        const offsetX = ((50 - state.crop.x) / 50) * bounds.x;
        const offsetY = ((50 - state.crop.y) / 50) * bounds.y;
        image.style.position = 'absolute';
        image.style.inset = 'auto';
        image.style.width = bounds.width + 'px';
        image.style.height = bounds.height + 'px';
        image.style.maxWidth = 'none';
        image.style.maxHeight = 'none';
        image.style.objectFit = 'fill';
        image.style.transform = 'none';
        image.style.left = 'calc(50% - ' + (bounds.width / 2) + 'px + ' + offsetX + 'px)';
        image.style.top = 'calc(50% - ' + (bounds.height / 2) + 'px + ' + offsetY + 'px)';
      };
      if (typeof ResizeObserver !== 'undefined') {
        state.observer = new ResizeObserver(state.render);
        state.observer.observe(windowElement);
      }
      states.set(windowElement, state);
    }
    state.crop = normalize(crop);
    const image = windowElement.querySelector('img');
    if (image && image !== state.boundImage) {
      image.addEventListener('load', state.render);
      state.boundImage = image;
    }
    state.render();
    requestAnimationFrame(state.render);
  }
  window.RNCSkillCrop = { apply, measure, normalize };
})();
