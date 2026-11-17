(() => {
  "use strict";
  const cache = new Map(), NS = "http://www.w3.org/2000/svg";
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  function geometry(source, layout = {}) {
    const {width, height, crop} = source;
    const scale = clamp(number(layout.scale, 1), .5, 2);
    const size = Math.min(width, height, Math.max(1, crop.size / scale));
    const anchorX = clamp(crop.x + crop.size / 2 - size / 2, 0, width - size);
    const anchorY = clamp(crop.y + crop.size / 2 - size / 2, 0, height - size);
    const offset = (anchor, maximum, value) => {
      const focus = clamp(number(value, 50), 0, 100);
      return focus < 50 ? anchor * focus / 50 : anchor + (maximum - anchor) * (focus - 50) / 50;
    };
    return {x:offset(anchorX, width - size, layout.x), y:offset(anchorY, height - size, layout.y), size};
  }
  function load(url) {
    if (!url) return Promise.resolve(null);
    if (!cache.has(url)) cache.set(url, new Promise(resolve => {
      const image = new Image();
      image.onload = () => {
        const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
        const fallbackSize = Math.min(width, height);
        const source = {url, width, height, crop:{x:(width-fallbackSize)/2, y:(height-fallbackSize)/2, size:fallbackSize}};
        try {
          const suggested = window.RNCEmployeePhoto?.suggest(image);
          if (suggested) {
            const size = Math.min(width, height, suggested.width, height / width > 1.3 ? height * .28 : suggested.width);
            if (size > 0 && Number.isFinite(size)) source.crop = {
              x:clamp(suggested.x + suggested.width / 2 - size / 2, 0, width - size),
              y:clamp(suggested.y, 0, height - size), size,
            };
          }
        } catch {}
        resolve(source);
      };
      image.onerror = () => resolve(null);
      image.src = url;
    }));
    return cache.get(url);
  }
  function render(source, layout) {
    const {x, y, size} = geometry(source, layout);
    const svg = document.createElementNS(NS, "svg");
    for (const [key, value] of Object.entries({class:"collection-portrait", viewBox:[x,y,size,size].join(" "), preserveAspectRatio:"xMidYMid slice", "aria-hidden":"true", focusable:"false"})) svg.setAttribute(key, value);
    const image = document.createElementNS(NS, "image");
    for (const [key, value] of Object.entries({href:source.url, width:source.width, height:source.height})) image.setAttribute(key, value);
    svg.append(image);
    return svg;
  }
  window.RNCRelationshipPortrait = {load, geometry, render};
})();
