(function() {
  "use strict";

  const defaults = Object.freeze({
    galleryDesktop: Object.freeze({ scale: 1, x: 50, y: 50 }),
    galleryMobile: Object.freeze({ scale: 1, x: 50, y: 18 }),
    profile: Object.freeze({ scale: 1, x: 50, y: 50 }),
    staffCard: Object.freeze({ scale: 1, x: 50, y: 100 }),
    staffId: Object.freeze({ scale: 1, x: 50, y: 28 }),
    relationships: Object.freeze({ scale: 1, x: 50, y: 50 }),
  });

  function normalize(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const result = {};
    Object.entries(defaults).forEach(function([view, fallback]) {
      const requested = source[view] && typeof source[view] === "object" ? source[view] : {};
      const scale = Number(requested.scale);
      const x = Number(requested.x);
      const y = Number(requested.y);
      result[view] = {
        scale: Math.min(2, Math.max(.5, Number.isFinite(scale) ? scale : fallback.scale)),
        x: Math.min(100, Math.max(0, Number.isFinite(x) ? x : fallback.x)),
        y: Math.min(100, Math.max(0, Number.isFinite(y) ? y : fallback.y)),
      };
    });
    return result;
  }

  function get(character, view) {
    return normalize(character && character.imageLayout)[view] || { scale: 1, x: 50, y: 50 };
  }

  function apply(element, character, view, prefix) {
    if (!element) return get(character, view);
    const layout = get(character, view);
    const cssPrefix = prefix || "rnc-image";
    element.style.setProperty("--" + cssPrefix + "-scale", String(layout.scale));
    element.style.setProperty("--" + cssPrefix + "-hover-scale", String(layout.scale * 1.055));
    element.style.setProperty("--" + cssPrefix + "-x", layout.x + "%");
    element.style.setProperty("--" + cssPrefix + "-y", layout.y + "%");
    element.style.setProperty("--" + cssPrefix + "-origin", layout.x + "% " + layout.y + "%");
    return layout;
  }

  window.RNCImageLayout = { defaults, normalize, get, apply };
})();
