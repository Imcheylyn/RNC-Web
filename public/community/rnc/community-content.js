(() => {
  "use strict";
  const element = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
  const date = value => new Date(value).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "long", timeStyle: "short" });
  function settingCard(settings) {
    const card = element("aside", null, "community-record");
    card.append(element("p", "COMMUNITY RECORD", "community-record-kicker"), element("h3", settings?.name || "Reverse : Noir Chronicle"));
    if (!settings) { card.append(element("p", "ยังไม่มีข้อมูล Community", "community-live-empty")); return card; }
    const facts = element("dl", null, "community-record-facts");
    [["สถานะ", { OPEN: "เปิด Community", CLOSED: "ยังไม่เปิด Community", PAUSED: "พักชั่วคราว" }[settings.state] || settings.state], ["วันเปิด", settings.opensAt ? date(settings.opensAt) : "ยังไม่ประกาศ"], ["การลงทะเบียน", settings.registrationOpen ? "เปิดรับตัวละครใหม่" : "ปิดรับตัวละครใหม่"]].forEach(([key, value]) => { const row = element("div"); row.append(element("dt", key), element("dd", value)); facts.append(row); });
    card.append(facts);
    if (settings.headline) card.append(element("h4", settings.headline));
    if (settings.description) card.append(element("p", settings.description, "community-live-body"));
    if (settings.worldUrl && settings.worldUrl.startsWith("https://")) { const link = element("a", "เปิดบันทึกโลก ↗", "community-world-link"); link.href = settings.worldUrl; link.target = "_blank"; link.rel = "noopener noreferrer"; card.append(link); }
    card.append(element("p", "RNC / OFFICIAL RECORD", "community-record-footer")); return card;
  }
  function noticeCard(notice, index) {
    const card = element("article", null, "community-notice-sheet"), meta = element("header", null, "community-notice-meta");
    meta.append(element("span", "NO. " + String(index + 1).padStart(2, "0")), element("span", { NOTICE: "NOTICE", STORY: "STORY RECORD", OPENING: "OPENING SCHEDULE", SETTING: "WORLD RECORD" }[notice.kind] || "NOTICE"));
    if (notice.pinned) meta.append(element("span", "◇ ปักหมุด", "community-pin"));
    card.append(meta, element("h3", notice.title));
    const published = notice.publishAt || notice.updatedAt;
    if (published) { const time = element("time", date(published)); time.dateTime = new Date(published).toISOString(); card.append(time); }
    card.append(element("p", notice.body, "community-live-body")); return card;
  }
  function board(container, content) {
    const feed = element("section", null, "community-notice-feed"), heading = element("div", null, "community-feed-heading"), notices = content.announcements || [];
    heading.append(element("span", "LATEST ENTRIES"), element("span", String(notices.length).padStart(2, "0") + " RECORDS")); feed.append(heading);
    if (notices.length) notices.forEach((notice, index) => feed.append(noticeCard(notice, index)));
    else { const empty = element("div", null, "community-empty-record"); empty.append(element("span", "—", "community-empty-mark"), element("h3", "ยังไม่มีประกาศใหม่"), element("p", "เรื่องราวและกำหนดการจาก Staff จะถูกบันทึกไว้ที่นี่")); feed.append(empty); }
    container.replaceChildren(settingCard(content.settings), feed);
  }
  function render(content) {
    const notices = content.announcements || [], dialog = document.getElementById("communityAnnouncement");
    if (dialog) {
      const grid = dialog.querySelector(".community-dialog-grid"); if (grid) board(grid, content);
      const title = dialog.querySelector("#communityDialogTitle"); if (title) title.textContent = "The Community Chronicle";
      dialog.dataset.noticeId = notices.map(item => item.id + ":" + item.updatedAt).join("|") || "none";
      dialog.dataset.noticeUnread = String(notices.length > 0);
    }
    const pageGrid = document.querySelector(".community-stage .announcement-grid"); if (pageGrid) board(pageGrid, content);
  }
  const content = window.__RNC_BOOTSTRAP__?.content;
  if (content) render(content);
  else if (document.getElementById("communityAnnouncement") || document.querySelector(".announcement-grid")) fetch("/api/community/content", { cache: "no-store" }).then(response => { if (!response.ok) throw new Error(); return response.json(); }).then(render).catch(() => {});
})();
