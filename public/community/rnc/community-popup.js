(() => {
  "use strict";

  const dialog = document.getElementById("communityAnnouncement");
  if (!dialog || typeof dialog.showModal !== "function") return;

  const triggers = [...document.querySelectorAll("[data-community-open]")];
  const notificationMarks = triggers
    .map((trigger) => trigger.querySelector("[data-community-notification]"))
    .filter(Boolean);
  const readKey = () => `rnc-community-notice-read:${dialog.dataset.noticeId || "latest"}`;

  function alreadyRead() {
    try { return sessionStorage.getItem(readKey()) === "read"; }
    catch { return false; }
  }

  function updateNotification() {
    const unread = dialog.dataset.noticeUnread === "true" && !alreadyRead();
    notificationMarks.forEach((mark) => { mark.hidden = !unread; });
    triggers.forEach((trigger) => {
      trigger.setAttribute("aria-label", unread ? "COMMUNITY, new staff notice" : "COMMUNITY");
    });
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      if (dialog.dataset.noticeUnread === "true") {
        try { sessionStorage.setItem(readKey(), "read"); } catch { /* Keep the in-page state usable. */ }
        updateNotification();
      }
      trigger.setAttribute("aria-expanded", "true");
      if (!dialog.open) dialog.showModal();
    });
  });

  dialog.querySelectorAll("[data-community-close]").forEach((button) => {
    button.addEventListener("click", () => dialog.close());
  });
  dialog.addEventListener("close", () => {
    triggers.forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  new MutationObserver(updateNotification).observe(dialog, {
    attributes: true,
    attributeFilter: ["data-notice-unread", "data-notice-id"],
  });
  updateNotification();
})();