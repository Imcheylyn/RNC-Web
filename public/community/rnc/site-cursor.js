(function initializeSiteCursor() {
  if (window.__siteCursorInitialized) return;
  const supportsCustomCursor = window.matchMedia("(any-hover: hover) and (any-pointer: fine)");
  if (!document.body || document.body.dataset.staffMode === "true") return;
  if (!supportsCustomCursor.matches) {
    supportsCustomCursor.addEventListener("change", function enableCursor(event) {
      if (!event.matches) return;
      supportsCustomCursor.removeEventListener("change", enableCursor);
      initializeSiteCursor();
    });
    return;
  }
  window.__siteCursorInitialized = true;

  const getCursorElement = (id) => {
    let element = document.getElementById(id);
    if (!element) {
      element = document.createElement("div");
      element.id = id;
      element.setAttribute("aria-hidden", "true");
    }
    return element;
  };
  const layer = getCursorElement("site-cursor-layer");
  const dot = getCursorElement("cursor-dot");
  const ring = getCursorElement("cursor-ring");
  const supportsPopover = typeof layer.showPopover === "function";
  if (supportsPopover) layer.setAttribute("popover", "manual");
  layer.append(dot, ring);
  document.body.append(layer);
  document.body.classList.add("has-site-cursor");

  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  let ringX = x;
  let ringY = y;
  let frame = 0;
  let previousTime = 0;
  let visible = false;
  let native = false;
  let fallback = false;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function stopAnimation() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
  }
  function scheduleAnimation() {
    if (!frame && visible && !native && !fallback && !document.hidden) frame = window.requestAnimationFrame(animateRing);
  }
  function position(element, left, top) {
    element.style.transform = "translate3d(" + left.toFixed(2) + "px," + top.toFixed(2) + "px,0) translate(-50%,-50%) rotate(45deg)";
  }
  function animateRing(time) {
    frame = 0;
    if (!visible || native || fallback || document.hidden) { previousTime = 0; return; }
    const elapsed = previousTime ? Math.min(64, time - previousTime) : 1000 / 60;
    const follow = reduceMotion.matches ? 1 : 1 - Math.pow(0.87, elapsed / (1000 / 60));
    previousTime = time;
    ringX += (x - ringX) * follow;
    ringY += (y - ringY) * follow;
    const settled = Math.abs(x - ringX) < 0.1 && Math.abs(y - ringY) < 0.1;
    if (settled) { ringX = x; ringY = y; }
    position(dot, x, y);
    position(ring, ringX, ringY);
    if (!settled) scheduleAnimation();
    else previousTime = 0;
  }

  function updateContext(target) {
    const dialog = target?.closest("dialog[open]");
    const host = dialog || document.body;
    // A modal outranks body z-index. Keep a manual, non-interactive popover inside
    // that modal so its cursor escapes clipping without stealing focus or clicks.
    if (layer.parentElement !== host) {
      if (supportsPopover && layer.matches(":popover-open")) layer.hidePopover();
      host.append(layer);
    }
    let elevated = false;
    if (supportsPopover) {
      try {
        if (!layer.matches(":popover-open")) layer.showPopover();
        elevated = layer.matches(":popover-open");
      } catch { /* Native cursor remains available if top-layer placement fails. */ }
    }
    fallback = supportsPopover ? !elevated : Boolean(dialog);
    native = document.body.classList.contains("labuu-result-open") || Boolean(target?.closest('input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable="true"]'));
    const interactive = target?.closest('a, button, [role="button"], input[type="button"], input[type="submit"], summary');
    document.body.classList.toggle("site-cursor-native", native);
    document.body.classList.toggle("site-cursor-fallback", fallback);
    document.body.classList.toggle("site-cursor-hover", Boolean(interactive) && !native && !fallback);
    if (native || fallback) stopAnimation();
    else scheduleAnimation();
  }
  function trackPointer(event) {
    if (event.pointerType === "touch" || !supportsCustomCursor.matches) { hideCursor(); return; }
    x = event.clientX;
    y = event.clientY;
    if (!visible) {
      visible = true;
      ringX = x;
      ringY = y;
      document.body.classList.add("site-cursor-visible");
    }
    updateContext(event.target instanceof Element ? event.target : null);
  }
  document.addEventListener("pointermove", trackPointer, { passive: true });
  document.addEventListener("pointerover", trackPointer, { passive: true });
  document.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch" || !supportsCustomCursor.matches) { hideCursor(); return; }
    trackPointer(event);
    document.body.classList.add("site-cursor-pressed");
  });
  window.addEventListener("pointerup", () => document.body.classList.remove("site-cursor-pressed"));

  // Dialogs can open/close or replace their content while the mouse is still.
  // Restore the cursor host after those changes, including nested editors.
  new MutationObserver(() => {
    const target = document.elementFromPoint(x, y);
    updateContext(target instanceof Element ? target : null);
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });

  function hideCursor() {
    visible = false;
    stopAnimation();
    document.body.classList.remove("site-cursor-visible", "site-cursor-hover", "site-cursor-pressed", "site-cursor-native", "site-cursor-fallback");
  }
  window.addEventListener("pointerout", event => { if (!event.relatedTarget) hideCursor(); });
  window.addEventListener("blur", hideCursor);
  document.addEventListener("visibilitychange", () => { if (document.hidden) hideCursor(); });
  supportsCustomCursor.addEventListener("change", () => { if (!supportsCustomCursor.matches) hideCursor(); });
})();
