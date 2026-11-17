// rnc-game.js — Mini-game: Find the Labuu
// ต้องการ: mx, my (global pointer coords จาก labuu.js)

let labuuFound = 0;
let labuuTimer = null;
let labuuDeadline = 0;
let labuuScoreRound = null;
let labuuBehaviorIntervals = [];
let labuuGamePhase = "idle";
let labuuEndTimeouts = new Set();
let labuuLaughAudio = null;
const LABUU_TOTAL = 7;

const GAME_TOP = 83;

function gameArea() {
  return {
    w: window.innerWidth,
    h: window.innerHeight - GAME_TOP,
    top: GAME_TOP,
  };
}

function startLabuuGame() {
  if (labuuGamePhase !== "idle") return;
  labuuGamePhase = "intro";
  document.body.classList.add("labuu-round-active");
  document.querySelectorAll(".site-notice, .top-nav, .labuu-stage").forEach((element) => {
    element.inert = true;
  });

  const overlay = document.createElement("div");
  overlay.id = "labuu-intro";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "labuu-intro-title");
  overlay.tabIndex = 0;
  overlay.innerHTML = [
    '<div class="labuu-intro-box">',
    '<p class="labuu-intro-eyebrow">? MINI GAME ?</p>',
    '<h1 class="labuu-intro-title" id="labuu-intro-title">FIND THE LABUU</h1>',
    '<img class="labuu-intro-img" src="/assets/Labuu.png" alt="">',
    '<p class="labuu-intro-desc">\u0e04\u0e49\u0e19\u0e2b\u0e32 <strong>\u0e25\u0e32\u0e1a\u0e39\u0e49 7 \u0e15\u0e31\u0e27</strong> \u0e17\u0e35\u0e48\u0e0b\u0e48\u0e2d\u0e19\u0e2d\u0e22\u0e39\u0e48\u0e43\u0e19\u0e04\u0e27\u0e32\u0e21\u0e21\u0e37\u0e14<br>\u0e43\u0e0a\u0e49\u0e44\u0e1f\u0e09\u0e32\u0e22\u0e2a\u0e48\u0e2d\u0e07\u0e2b\u0e32\u0e41\u0e25\u0e30\u0e04\u0e25\u0e34\u0e01\u0e17\u0e35\u0e48\u0e25\u0e32\u0e1a\u0e39\u0e49<br><strong>\u0e21\u0e35\u0e40\u0e27\u0e25\u0e32 60 \u0e27\u0e34\u0e19\u0e32\u0e17\u0e35</strong> \u0e23\u0e30\u0e27\u0e31\u0e07\u0e25\u0e32\u0e1a\u0e39\u0e49\u0e15\u0e31\u0e27\u0e1b\u0e25\u0e2d\u0e21\u0e14\u0e49\u0e27\u0e22<br>\u0e40\u0e08\u0e2d\u0e04\u0e23\u0e1a\u0e41\u0e25\u0e49\u0e27 \u0e41\u0e2a\u0e07\u0e44\u0e1f\u0e08\u0e30\u0e01\u0e25\u0e31\u0e1a\u0e21\u0e32</p>',
    '<p class="labuu-intro-hint">\u0e04\u0e25\u0e34\u0e01\u0e17\u0e35\u0e48\u0e43\u0e14\u0e01\u0e47\u0e44\u0e14\u0e49\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e40\u0e23\u0e34\u0e48\u0e21\u0e40\u0e01\u0e21</p>',
    '</div>'
  ].join("");
  document.body.appendChild(overlay);

  const beginFromIntro = async () => {
    if (labuuGamePhase !== "intro") return;
    labuuGamePhase = "starting";
    overlay.querySelector(".labuu-intro-hint").textContent = "กำลังเปิดรอบเล่น…";
    labuuScoreRound = await window.RNCLabuuScore.start();
    if (labuuGamePhase !== "starting") return;
    labuuGamePhase = "intro-exiting";
    document.body.classList.add("dark-mode");
    overlay.classList.add("exiting");
    scheduleEndTimeout(() => {
      overlay.remove();
      if (labuuGamePhase !== "intro-exiting") return;
      labuuGamePhase = "playing";
      placeLabuus();
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280);
  };
  overlay.addEventListener("click", beginFromIntro, { once: true });
  overlay.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    beginFromIntro();
  });
  overlay.focus({ preventScroll: true });
}

function placeLabuus() {
  labuuFound = 0;
  const total = LABUU_TOTAL;
  const { w, h, top } = gameArea();
  const size = 46;

  const feedback = document.createElement("div");
  feedback.id = "labuu-feedback";
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
  feedback.setAttribute("aria-atomic", "true");
  document.body.appendChild(feedback);

  const zones = [
    { x: [4, 22],  y: [5, 40] },
    { x: [78, 94], y: [5, 40] },
    { x: [38, 62], y: [3, 28] },
    { x: [5, 26],  y: [52, 85] },
    { x: [74, 94], y: [52, 85] },
    { x: [36, 64], y: [58, 88] },
    { x: [22, 78], y: [35, 60] },
  ];

  zones.forEach((zone, index) => {
    const x = (zone.x[0] + Math.random() * (zone.x[1] - zone.x[0])) / 100 * w;
    const y = top + (zone.y[0] + Math.random() * (zone.y[1] - zone.y[0])) / 100 * h;
    const el = document.createElement("div");
    el.className = "labuu";
    el.style.left = Math.min(x, w - size - 8) + "px";
    el.style.top  = Math.min(y, top + h - size - 8) + "px";
    el.style.transform = `rotate(${(Math.random() - 0.5) * 28}deg)`;
    el.innerHTML = `<img src="/assets/Labuu.png" alt="Labuu">`;
    el.addEventListener("click", () => collectLabuu(el, total, index));
    document.body.appendChild(el);

    const roll = Math.random();
    if (roll < 0.30) spawnDodger(el);
    else if (roll < 0.55) spawnPeeker(el, zone);
    else if (roll < 0.70) spawnHoverFleeer(el);
  });

  // ลาบู้ปลอม 2 ตัว
  for (let f = 0; f < 2; f++) {
    const fx = (10 + Math.random() * 80) / 100 * w;
    const fy = top + (10 + Math.random() * 80) / 100 * h;
    const fake = document.createElement("div");
    fake.className = "labuu labuu-fake";
    fake.style.left = Math.min(fx, w - size - 8) + "px";
    fake.style.top  = Math.min(fy, top + h - size - 8) + "px";
    fake.style.transform = `rotate(${(Math.random() - 0.5) * 28}deg)`;
    fake.innerHTML = `<img src="/assets/Labuu.png" alt="Labuu">`;
    fake.addEventListener("click", () => fakeCaught(fake, LABUU_TOTAL + f));
    document.body.appendChild(fake);
  }

  labuuDeadline = performance.now() + labuuScoreRound.durationMs;
  let labuuTimeLeft = Math.ceil(labuuScoreRound.durationMs / 1000);
  const hud = document.createElement("div");
  hud.id = "labuu-hud";
  hud.innerHTML = `
    <div class="labuu-hud-stat" id="labuu-timer" role="timer">
      <span class="labuu-hud-label">เวลาเหลือ</span>
      <strong class="labuu-hud-value"><span id="labuu-time-text">${labuuTimeLeft}</span><small> วิ</small></strong>
    </div>
    <div class="labuu-hud-stat" role="status">
      <span class="labuu-hud-label">เจอแล้ว</span>
      <strong class="labuu-hud-value"><span id="labuu-count-text">0</span><small> / ${total}</small></strong>
    </div>
    <div class="labuu-hud-stat">
      <span class="labuu-hud-label">คะแนน</span>
      <strong class="labuu-hud-value" id="labuu-live-score">00000</strong>
    </div>
  `;
  const timerEl = hud.querySelector("#labuu-timer");
  const timeText = hud.querySelector("#labuu-time-text");
  document.body.appendChild(hud);
  labuuTimer = setInterval(() => {
    if (labuuGamePhase !== "playing") return;
    const seconds = Math.max(0, Math.ceil((labuuDeadline - performance.now()) / 1000));
    if (seconds === labuuTimeLeft) return;
    labuuTimeLeft = seconds;
    timeText.textContent = String(labuuTimeLeft);
    timerEl.classList.toggle("urgent", labuuTimeLeft <= 10);
    if (labuuTimeLeft <= 0) {
      clearInterval(labuuTimer);
      labuuTimer = null;
      triggerJumpscare();
    }
  }, 100);
}

/* ── ลาบู้หลบเมาส์ ── */
function spawnDodger(el) {
  const size = 46;
  const dodgeRadius = 180;

  function dodge() {
    if (labuuGamePhase !== "playing" || !document.body.contains(el)) return;
    const { w, h, top } = gameArea();
    const ex = parseFloat(el.style.left) + size / 2;
    const ey = parseFloat(el.style.top)  + size / 2;
    const dx = mx - ex, dy = my - ey;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < dodgeRadius) {
      const angle = Math.atan2(dy, dx) + Math.PI + (Math.random() - 0.5) * 1.2;
      const jump  = 90 + Math.random() * 80;
      const nx = Math.max(4,       Math.min(w - size - 4,       ex + Math.cos(angle) * jump - size / 2));
      const ny = Math.max(top + 4, Math.min(top + h - size - 4, ey + Math.sin(angle) * jump - size / 2));
      el.classList.add("dodging");
      el.style.left = nx + "px";
      el.style.top  = ny + "px";
      setTimeout(() => el.classList.remove("dodging"), 300);
    }
  }

  const id = setInterval(dodge, 120);
  labuuBehaviorIntervals.push(id);
}

/* ── ลาบู้แอบมอง ── */
function spawnPeeker(el, zone) {
  const side = Math.floor(Math.random() * 4);
  const size = 46;
  const hidePos = getPeekHidePos(el, side, size);
  el.style.left = hidePos.x + "px";
  el.style.top  = hidePos.y + "px";
  el.classList.add("peeking", "peek-hidden");

  function doPeek() {
    if (labuuGamePhase !== "playing" || !document.body.contains(el)) return;
    const peekPos = getPeekShowPos(side, size);
    el.style.left = peekPos.x + "px";
    el.style.top  = peekPos.y + "px";
    el.classList.remove("peek-hidden");

    const showTime = 1200 + Math.random() * 800;
    setTimeout(() => {
      if (labuuGamePhase !== "playing" || !document.body.contains(el)) return;
      el.classList.add("peek-hidden");
      el.style.left = hidePos.x + "px";
      el.style.top  = hidePos.y + "px";
    }, showTime);
  }

  const firstDelay = 1000 + Math.random() * 2000;
  setTimeout(() => {
    if (labuuGamePhase !== "playing" || !document.body.contains(el)) return;
    doPeek();
    const id = setInterval(() => {
      if (labuuGamePhase !== "playing" || !document.body.contains(el)) { clearInterval(id); return; }
      doPeek();
    }, 2500 + Math.random() * 2500);
    labuuBehaviorIntervals.push(id);
  }, firstDelay);
}

function getPeekHidePos(el, side, size) {
  const { w, h, top } = gameArea();
  const cx = parseFloat(el.style.left) + size / 2;
  const cy = parseFloat(el.style.top)  + size / 2;
  switch (side) {
    case 0: return { x: cx,       y: top - size - 10 };
    case 1: return { x: w + 10,   y: cy };
    case 2: return { x: cx,       y: top + h + 10 };
    case 3: return { x: -size-10, y: cy };
  }
}

function getPeekShowPos(side, size) {
  const { w, h, top } = gameArea();
  const rand = Math.random();
  switch (side) {
    case 0: return { x: rand * (w - size),    y: top - size * 0.35 };
    case 1: return { x: w - size * 0.65,      y: top + rand * (h - size) };
    case 2: return { x: rand * (w - size),    y: top + h - size * 0.65 };
    case 3: return { x: -size * 0.35,         y: top + rand * (h - size) };
  }
}

/* ── ลาบู้หนีตอน hover ── */
function spawnHoverFleeer(el) {
  const size = 46;
  const fleeRadius = 70;
  let cooldown = false;

  function checkHover() {
    if (labuuGamePhase !== "playing" || !document.body.contains(el) || cooldown) return;
    const { w, h, top } = gameArea();
    const ex = parseFloat(el.style.left) + size / 2;
    const ey = parseFloat(el.style.top)  + size / 2;
    const dx = mx - ex, dy = my - ey;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < fleeRadius && Math.random() < 0.35) {
      cooldown = true;
      const angle = Math.atan2(dy, dx) + Math.PI + (Math.random() - 0.5) * 0.8;
      const jump  = 120 + Math.random() * 100;
      const nx = Math.max(4,       Math.min(w - size - 4,       ex + Math.cos(angle) * jump - size / 2));
      const ny = Math.max(top + 4, Math.min(top + h - size - 4, ey + Math.sin(angle) * jump - size / 2));
      el.style.transition = "left 0.15s cubic-bezier(0.2,1.8,0.5,1), top 0.15s cubic-bezier(0.2,1.8,0.5,1)";
      el.style.left = nx + "px";
      el.style.top  = ny + "px";
      setTimeout(() => { el.style.transform = `rotate(${(Math.random()-0.5)*30}deg) scale(1.1)`; }, 160);
      setTimeout(() => { el.style.transform = `rotate(${(Math.random()-0.5)*20}deg) scale(1)`;   }, 320);
      setTimeout(() => { cooldown = false; }, 1500 + Math.random() * 1500);
    }
  }

  const id = setInterval(checkHover, 120);
  labuuBehaviorIntervals.push(id);
}

/* ── ลาบู้ปลอม ── */
function recordLabuuClick(index) {
  window.RNCLabuuScore.record(labuuScoreRound, index);
  const score = document.getElementById("labuu-live-score");
  if (score) score.textContent = String(window.RNCLabuuScore.points(labuuScoreRound)).padStart(5, "0");
}

function fakeCaught(el, index) {
  if (labuuGamePhase !== "playing" || performance.now() >= labuuDeadline
    || el.classList.contains("fake-laugh") || el.classList.contains("fake-fleeing")) return;
  recordLabuuClick(index);
  showLabuuFeedback("ลาบู้ปลอม! ลองหาใหม่");
  if (Math.random() < 0.4) {
    el.classList.add("fake-laugh");
    setTimeout(() => {
      if (labuuGamePhase === "playing") el.classList.remove("fake-laugh");
    }, 500);
    return;
  }
  el.classList.add("fake-laugh");
  setTimeout(() => {
    if (labuuGamePhase !== "playing" || !document.body.contains(el)) return;
    el.classList.remove("fake-laugh");
    el.classList.add("fake-fleeing");
    const { w, h, top } = gameArea();
    const size = 46;
    const nx = Math.max(4,       Math.min(w - size - 4,       Math.random() * w));
    const ny = Math.max(top + 4, Math.min(top + h - size - 4, top + Math.random() * h));
    el.style.left = nx + "px";
    el.style.top  = ny + "px";
    el.style.transform = `rotate(${(Math.random()-0.5)*30}deg)`;
    setTimeout(() => {
      if (labuuGamePhase === "playing") el.classList.remove("fake-fleeing");
    }, 400);
  }, 500);
}

function collectLabuu(el, total, index) {
  const remainingMs = labuuDeadline - performance.now();
  if (labuuGamePhase !== "playing" || remainingMs <= 0
    || el.classList.contains("caught") || el.classList.contains("found")) return;
  recordLabuuClick(index);
  labuuFound++;
  const count = document.getElementById("labuu-count-text");
  if (count) count.textContent = String(labuuFound);
  el.classList.remove("peeking", "peek-hidden", "dodging");
  el.classList.add("caught");
  scheduleEndTimeout(() => el.remove(), 600);

  if (labuuFound >= total) {
    labuuGamePhase = "win-pending";
    window.RNCLabuuScore.finish(labuuScoreRound, remainingMs);
    stopGameActivity();
    playLabuuLaugh();
    scheduleEndTimeout(winLabuuGame, 600);
  }
}

function showLabuuFeedback(message) {
  const feedback = document.getElementById("labuu-feedback");
  if (!feedback || labuuGamePhase !== "playing") return;
  feedback.textContent = message;
  feedback.classList.remove("is-visible");
  void feedback.offsetWidth;
  feedback.classList.add("is-visible");
}

function playLabuuLaugh() {
  if (!labuuLaughAudio) {
    labuuLaughAudio = new Audio("/assets/Labuu-Sound.mp3");
    labuuLaughAudio.preload = "auto";
  }
  labuuLaughAudio.pause();
  labuuLaughAudio.currentTime = 0;
  const playback = labuuLaughAudio.play();
  if (playback && typeof playback.catch === "function") playback.catch(() => {});
}

function stopLabuuLaugh() {
  if (!labuuLaughAudio) return;
  labuuLaughAudio.pause();
  labuuLaughAudio.currentTime = 0;
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function scheduleEndTimeout(callback, delay) {
  let timeout = null;
  timeout = window.setTimeout(() => {
    labuuEndTimeouts.delete(timeout);
    callback();
  }, prefersReducedMotion() ? 0 : delay);
  labuuEndTimeouts.add(timeout);
  return timeout;
}

function clearEndTimeouts() {
  labuuEndTimeouts.forEach((timeout) => clearTimeout(timeout));
  labuuEndTimeouts.clear();
}

function stopGameActivity() {
  if (labuuTimer) {
    clearInterval(labuuTimer);
    labuuTimer = null;
  }
  labuuBehaviorIntervals.forEach((interval) => clearInterval(interval));
  labuuBehaviorIntervals = [];
}

function cleanupGame() {
  stopGameActivity();
  clearEndTimeouts();
  document.getElementById("labuu-hud")?.remove();
  document.getElementById("labuu-feedback")?.remove();
  document.querySelectorAll(".labuu").forEach((el) => el.remove());
}

function restoreFromGame() {
  stopLabuuLaugh();
  cleanupGame();
  document.getElementById("labuu-intro")?.remove();
  document.getElementById("labuu-result")?.remove();
  document.getElementById("labuu-scare-backdrop")?.remove();
  document.querySelectorAll(".scare-labuu").forEach((el) => el.remove());
  document.getElementById("labuu-flash")?.remove();
  document.body.classList.remove("dark-mode", "jumpscare-shake", "labuu-result-open", "site-cursor-native");

  const tab = document.getElementById("lamp-tab");
  const container = document.getElementById("lamp-container");
  tab?.classList.remove("scroll-hidden", "open");
  tab?.classList.add("visible");
  container?.classList.remove("scroll-hidden", "revealed");
  labuuFound = 0;
  labuuScoreRound = null;
  labuuGamePhase = "idle";
}

function showResultScreen(outcome) {
  cleanupGame();
  labuuGamePhase = "result";
  const won = outcome === "win";
  document.body.classList.remove("jumpscare-shake");
  document.body.classList.add("labuu-result-open", "site-cursor-native");
  if (!won) document.body.classList.remove("dark-mode");
  const result = document.createElement("div");
  result.id = "labuu-result";
  result.dataset.outcome = won ? "win" : "loss";
  result.setAttribute("role", "dialog");
  result.setAttribute("aria-modal", "true");
  result.setAttribute("aria-labelledby", "labuu-result-title");
  result.tabIndex = -1;

  const eyebrow = won ? "ALL LABUU FOUND" : "TIME IS UP";
  const title = won ? "\u0e40\u0e08\u0e2d\u0e04\u0e23\u0e1a\u0e41\u0e25\u0e49\u0e27!" : "\u0e2b\u0e21\u0e14\u0e40\u0e27\u0e25\u0e32";
  const description = won
    ? "\u0e41\u0e2a\u0e07\u0e2a\u0e27\u0e48\u0e32\u0e07\u0e01\u0e25\u0e31\u0e1a\u0e04\u0e37\u0e19\u0e21\u0e32\u0e41\u0e25\u0e49\u0e27 \u0e25\u0e32\u0e1a\u0e39\u0e49\u0e04\u0e23\u0e1a\u0e17\u0e31\u0e49\u0e07 " + LABUU_TOTAL + " \u0e15\u0e31\u0e27"
    : "\u0e04\u0e23\u0e32\u0e27\u0e19\u0e35\u0e49\u0e40\u0e08\u0e2d " + labuuFound + " / " + LABUU_TOTAL + " \u0e15\u0e31\u0e27 \u0e25\u0e32\u0e1a\u0e39\u0e49\u0e2b\u0e19\u0e35\u0e44\u0e1b\u0e01\u0e48\u0e2d\u0e19\u0e41\u0e25\u0e49\u0e27";

  result.innerHTML =
    '<section class="labuu-result-card">' +
      '<span class="labuu-result-mark" aria-hidden="true"></span>' +
      '<p class="labuu-result-eyebrow">' + eyebrow + '</p>' +
      '<img class="labuu-result-art" src="/assets/Labuu.png" alt="" role="button" tabindex="0" data-labuu-laugh aria-label="Make Labuu laugh">' +
      '<h2 class="labuu-result-title" id="labuu-result-title">' + title + '</h2>' +
      '<p class="labuu-result-copy">' + description + '</p>' +
      '<div class="labuu-result-scores" data-labuu-scores>' +
        '<div class="labuu-result-values">' +
          '<div><span>SCORE</span><strong data-round-score>—</strong></div>' +
          '<div><span>HI SCORE</span><strong data-round-best>—</strong></div>' +
        '</div>' +
        '<p class="labuu-save-status" data-round-status role="status"></p>' +
        '<button type="button" data-round-retry hidden>ลองบันทึกอีกครั้ง</button>' +
      '</div>' +
      '<div class="labuu-result-actions">' +
        '<button class="labuu-result-primary" type="button" data-labuu-replay>\u0e25\u0e2d\u0e07\u0e2d\u0e35\u0e01\u0e04\u0e23\u0e31\u0e49\u0e07</button>' +
        '<button class="labuu-result-secondary" type="button" data-labuu-return>กลับ Arcade</button>' +
      '</div>' +
    '</section>';

  document.body.appendChild(result);
  window.RNCLabuuScore.show(result.querySelector("[data-labuu-scores]"), labuuScoreRound);
  result.querySelector("[data-labuu-replay]").addEventListener("click", () => closeLabuuResult(result, "replay"));
  result.querySelector("[data-labuu-return]").addEventListener("click", () => closeLabuuResult(result, "return"));
  const resultArt = result.querySelector("[data-labuu-laugh]");
  const laughFromArt = () => {
    if (labuuGamePhase !== "result") return;
    resultArt.classList.remove("is-laughing");
    void resultArt.offsetWidth;
    resultArt.classList.add("is-laughing");
    playLabuuLaugh();
  };
  resultArt.addEventListener("click", laughFromArt);
  resultArt.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    laughFromArt();
  });
  resultArt.addEventListener("animationend", (event) => {
    if (event.animationName === "labuuResultLaugh") resultArt.classList.remove("is-laughing");
  });
  result.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeLabuuResult(result, "return");
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = [...result.querySelectorAll("button:not([hidden]):not(:disabled), [data-labuu-laugh]")];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  result.querySelector("[data-labuu-replay]").focus({ preventScroll: true });

  if (outcome === "win") {
    scheduleEndTimeout(() => document.body.classList.remove("dark-mode"), 500);
  } else {
    scheduleEndTimeout(() => {
      document.getElementById("labuu-scare-backdrop")?.remove();
      document.querySelectorAll(".scare-labuu").forEach((el) => el.remove());
    }, 500);
  }
}

function closeLabuuResult(result, action) {
  if (labuuGamePhase !== "result") return;
  labuuGamePhase = "result-closing";
  result.querySelectorAll("button").forEach((button) => { button.disabled = true; });

  if (action === "return") {
    // Keep the result visible while the app shell loads the Arcade frame.
    stopLabuuLaugh();
    result.querySelector("[data-labuu-return]").textContent = "กำลังกลับ Arcade…";
    if (typeof window.RNCNavigate === "function") window.RNCNavigate("/community/rnc/arcade");
    else location.assign("/community/rnc/arcade");
    return;
  }

  result.classList.add("is-closing");
  scheduleEndTimeout(() => {
    restoreFromGame();
    startLabuuGame();
  }, 320);
}

function winLabuuGame() {
  if (labuuGamePhase !== "win-pending") return;
  showResultScreen("win");
}

function triggerJumpscare() {
  if (labuuGamePhase !== "playing") return;
  labuuGamePhase = "loss-animation";
  window.RNCLabuuScore.finish(labuuScoreRound, 0);
  cleanupGame();

  document.body.classList.add("jumpscare-shake");
  const flash = document.createElement("div");
  flash.id = "labuu-flash";
  document.body.appendChild(flash);

  scheduleEndTimeout(() => {
    flash.remove();
    document.body.classList.remove("jumpscare-shake", "dark-mode");

    const backdrop = document.createElement("div");
    backdrop.id = "labuu-scare-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    document.body.appendChild(backdrop);

    const scare = document.createElement("div");
    scare.className = "scare-labuu";
    scare.classList.add("laughing");
    scare.setAttribute("aria-hidden", "true");
    scare.innerHTML = '<img src="/assets/Labuu.png" alt="">';
    document.body.appendChild(scare);
    playLabuuLaugh();

    scheduleEndTimeout(() => {
      if (labuuGamePhase !== "loss-animation") return;
      scare.classList.remove("laughing");
      scare.classList.add("dripping");
      scheduleEndTimeout(() => showResultScreen("loss"), 900);
    }, 1520);
  }, 720);
}
