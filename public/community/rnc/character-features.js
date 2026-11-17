(function () {
  "use strict";
  const button = document.getElementById("openCharacterCollection");
  if (!button || !window.RNCCharacterStore?.getById(new URLSearchParams(location.search).get("id"))) return;
  window.RNCFeatures.bind(button, "collection", () => window.RNCCharacterCollection.open());
  function openHash() {
    if (!["#relationships", "#voice-lines"].includes(location.hash) || window.RNCCharacterCollection) return;
    // The collection restores the selected tab itself after its dependencies load.
    window.RNCFeatures.load("collection").catch(window.RNCFeatures.showError);
  }
  window.addEventListener("hashchange", openHash);
  window.addEventListener("popstate", openHash);
  openHash();
})();
