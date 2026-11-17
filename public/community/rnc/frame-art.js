(() => {
  "use strict";
  const namespace = "http://www.w3.org/2000/svg";
  const filters = new Map();
  let definitions;
  function tintFilter(color) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return "";
    if (filters.has(color)) return filters.get(color);
    if (!definitions) {
      const svg = document.createElementNS(namespace, "svg");
      svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.setAttribute("aria-hidden", "true"); svg.style.position = "absolute";
      definitions = document.createElementNS(namespace, "defs"); svg.append(definitions); document.body.append(svg);
    }
    const id = "rnc-frame-tone-" + color.slice(1), filter = document.createElementNS(namespace, "filter"), matrix = document.createElementNS(namespace, "feColorMatrix");
    filter.id = id; filter.setAttribute("color-interpolation-filters", "sRGB");
    // Preserve the PNG's shading and transparency while changing its ink colour.
    const channels = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255);
    const rows = channels.flatMap(channel => [.2126 * channel * 1.8, .7152 * channel * 1.8, .0722 * channel * 1.8, 0, 0]);
    matrix.setAttribute("type", "matrix"); matrix.setAttribute("values", [...rows, 0, 0, 0, 1, 0].join(" "));
    filter.append(matrix); definitions.append(filter); const result = "url(#" + id + ")"; filters.set(color, result); return result;
  }
  function apply(image, style) {
    if (!image || !style) return;
    image.classList.toggle("president-rainbow-frame", style.glowMode === "rainbow");
    const tint = style.tint || style.borderColor.toLowerCase() !== style.defaultBorder.toLowerCase();
    image.style.filter = (tint ? tintFilter(style.borderColor) + " " : "") + "drop-shadow(0 0 2px " + style.glowColor + "80) drop-shadow(0 0 7px " + style.glowColor + "45)";
  }
  window.RNCFrameArt = { apply };
})();
