const statusMessages = {
  "not-member": "บัญชี Discord ที่เลือกไม่พบในเซิร์ฟเวอร์นี้ ถ้าคุณเป็นสมาชิกอยู่ ให้ลองเชื่อมต่อด้วยบัญชี Discord ที่ใช้เข้าเซิร์ฟเวอร์",
  cancelled: "ยกเลิกการเชื่อมต่อแล้ว คุณสามารถลองใหม่ได้ทุกเมื่อ",
  error: "ตรวจสอบบัญชีไม่สำเร็จ กรุณาเริ่มเชื่อมต่อใหม่อีกครั้ง",
  setup: "การเชื่อมต่อ Discord ยังไม่พร้อมใช้งานในตอนนี้",
  scope: "Discord ยังไม่ได้ให้สิทธิ์ที่จำเป็นสำหรับตรวจสอบสมาชิก กดปุ่มอีกครั้งเพื่อยืนยันสิทธิ์นี้",
  oauth: "แลกเปลี่ยนการยืนยันกับ Discord ไม่สำเร็จ โปรดตรวจ Client ID, Client Secret และ Redirect URI ในการตั้งค่าแอป",
  "database-error": "ยืนยันบัญชี Discord แล้ว แต่บันทึกบัญชีลงฐานข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  "discord-error": "Discord ตอบกลับไม่สำเร็จระหว่างตรวจสอบบัญชี กรุณาลองใหม่อีกครั้ง",
  state: "การยืนยันหมดอายุหรือถูกรบกวน กรุณาเริ่มเชื่อมต่อใหม่",
};

const status = document.getElementById("connectionStatus");
const button = document.getElementById("connectButton");
button.addEventListener("click", event => {
  if (button.getAttribute("aria-disabled") === "true") event.preventDefault();
});
const params = new URLSearchParams(location.search);
const requestedStatus = params.get("status");
if (statusMessages[requestedStatus]) {
  status.textContent = statusMessages[requestedStatus];
  if (requestedStatus === "oauth") {
    const discordStatus = params.get("discord_status");
    const discordCode = params.get("discord_code");
    if (/^\d{3}$/.test(discordStatus || "")) {
      const codeHint = /^\d+$/.test(discordCode || "") ? `, Discord code ${discordCode}` : "";
      status.textContent += ` (HTTP ${discordStatus}${codeHint})`;
    }
  }
  status.hidden = false;
  if (requestedStatus === "scope") button.href = "/auth/discord/start?consent=1";
}

fetch("/api/community/session", { credentials: "same-origin" })
  .then(response => response.json())
  .then(session => {
    if (session.authenticated) {
      location.replace("/community/rnc");
    } else if (!session.configured) {
      status.textContent = statusMessages.setup;
      status.hidden = false;
      button.setAttribute("aria-disabled", "true");
    }
  })
  .catch(() => {
    status.textContent = "ตรวจสอบการเชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
    status.hidden = false;
  });

const serverAvatar = document.getElementById("serverAvatar");
const serverAvatarFallback = document.getElementById("serverAvatarFallback");
const serverName = document.getElementById("serverName");
const serverOnlineCount = document.getElementById("serverOnlineCount");

function loadServerAvatar(url) {
  serverAvatar.hidden = true;
  serverAvatarFallback.hidden = false;
  serverAvatar.onload = () => {
    serverAvatar.hidden = false;
    serverAvatarFallback.hidden = true;
  };
  serverAvatar.onerror = () => {
    serverAvatar.hidden = true;
    serverAvatarFallback.hidden = false;
  };
  serverAvatar.src = url;
}

fetch("/api/community/preview", { credentials: "same-origin" })
  .then(response => {
    if (!response.ok) throw new Error("Server preview is unavailable");
    return response.json();
  })
  .then(preview => {
    if (typeof preview.name === "string" && preview.name.trim()) {
      serverName.textContent = preview.name;
      serverAvatar.alt = `รูปโปรไฟล์เซิร์ฟเวอร์ ${preview.name}`;
    }
    if (Number.isInteger(preview.onlineCount) && preview.onlineCount >= 0) {
      serverOnlineCount.textContent = `${preview.onlineCount} คนกำลังออนไลน์`;
    } else {
      serverOnlineCount.textContent = "ยังไม่มีข้อมูลจำนวนออนไลน์";
    }
    if (typeof preview.iconUrl === "string") {
      const iconUrl = new URL(preview.iconUrl);
      if (iconUrl.protocol === "https:" && iconUrl.hostname === "cdn.discordapp.com") {
        loadServerAvatar(iconUrl.href);
      }
    }
  })
  .catch(() => {
    serverOnlineCount.textContent = "— คนกำลังออนไลน์";
  });
