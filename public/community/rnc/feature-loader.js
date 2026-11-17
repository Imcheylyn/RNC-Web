(function () {
  "use strict";
  const resources = new Map(), features = new Map();
  const base = "/community/rnc/";
  function resource(file, style = false) {
    const url = base + file;
    if (resources.has(url)) return resources.get(url);
    // Editor pages already execute some shared dependencies before this loader.
    const existing = Array.from(document.querySelectorAll(style ? 'link[rel="stylesheet"]' : "script[src]"))
      .find(element => element.getAttribute(style ? "href" : "src") === url);
    if (existing) return Promise.resolve();
    const promise = new Promise((resolve, reject) => {
      const element = document.createElement(style ? "link" : "script");
      if (style) { element.rel = "stylesheet"; element.href = url; }
      else { element.src = url; element.async = true; }
      const timer = setTimeout(() => finish(new Error("โหลดส่วนนี้นานเกินไป กรุณากดลองอีกครั้ง")), 20000);
      function finish(error) {
        clearTimeout(timer); element.onload = element.onerror = null;
        if (error) { element.remove(); reject(error); } else resolve();
      }
      element.onload = () => finish();
      element.onerror = () => finish(new Error("โหลดส่วนนี้ไม่สำเร็จ กรุณากดลองอีกครั้ง"));
      document.head.append(element);
    });
    resources.set(url, promise);
    promise.catch(() => resources.delete(url));
    return promise;
  }
  const media = "character-media.js?v=upload-stability-20261116-v1";
  const definitions = {
    media: { dependencies: [media] },
    wardrobe: {
      style: "wardrobe.css?v=wardrobe-accessory-layout-20261117-v1",
      dependencies: [],
      script: "wardrobe.js?v=wardrobe-medium-roles-20261117-v1",
    },
    employeeCard: {
      style: "employee-card.css?v=signature-clean-ui-20261030-v5",
      dependencies: ["employee-photo.js?v=face-default-20261027", "employee-card-nationality.js?v=nationality-demonym-20261107"],
      script: "employee-card.js?v=lazy-features-20261117-v1",
    },
    collection: {
      style: "character-collection.css?v=voice-notes-20261117-v2",
      dependencies: ["employee-photo.js?v=face-default-20261027", "relationship-portrait.js?v=relationships-20261107-v1", media, "relationship-map-layout.js?v=caseboard-cords-20261106-v3"],
      script: "character-collection.js?v=voice-notes-20261117-v2",
    },
  };
  function load(name) {
    if (features.has(name)) return features.get(name);
    const definition = definitions[name];
    if (!definition) return Promise.reject(new Error("Unknown feature: " + name));
    const promise = Promise.all([
      ...(definition.style ? [resource(definition.style, true)] : []),
      ...definition.dependencies.map(file => resource(file)),
    ]).then(() => definition.script ? resource(definition.script) : undefined);
    features.set(name, promise);
    promise.catch(() => features.delete(name));
    return promise;
  }
  function showError(error) {
    let message = document.getElementById("rncFeatureError");
    if (!message) {
      message = document.createElement("p"); message.id = "rncFeatureError";
      message.setAttribute("role", "alert");
      message.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483647;max-width:90vw;padding:12px 18px;background:#211e1b;color:#f4e8d2;border:1px solid #b5885b;border-radius:6px;text-align:center";
      document.body.append(message);
    }
    message.textContent = error.message; message.hidden = false;
  }
  function bind(button, name, open) {
    if (!button) return;
    let pending = false;
    button.addEventListener("click", async () => {
      if (pending) return;
      pending = true; button.setAttribute("aria-busy", "true");
      document.getElementById("rncFeatureError")?.setAttribute("hidden", "");
      try { await load(name); await open(); }
      catch (error) { showError(error); }
      finally { pending = false; button.removeAttribute("aria-busy"); }
    });
  }
  window.RNCFeatures = { load, bind, showError };
})();
