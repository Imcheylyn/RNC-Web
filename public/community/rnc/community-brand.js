(() => {
  "use strict";
  const nav = document.querySelector(".top-nav");
  if (!nav) return;
  const measure = () => document.documentElement.style.setProperty("--rnc-nav-height", Math.ceil(nav.getBoundingClientRect().height) + "px");
  measure();
  new ResizeObserver(measure).observe(nav);
})();
