(function () {
  "use strict";

  const track = document.querySelector("[data-cabinet-track]");
  const template = document.getElementById("arcade-cabinet");
  const title = document.querySelector("[data-game-title]");
  const description = document.querySelector("[data-game-description]");
  const notes = document.getElementById("arcade-game-notes");
  const noteStatus = document.querySelector("[data-game-status]");
  const noteQuote = document.querySelector("[data-game-quote]");
  const shell = document.querySelector(".arcade-shell");
  const leaderboardButton = document.querySelector("[data-leaderboard-open]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const number = new Intl.NumberFormat("th-TH");
  const games = [
    {
      id: "labuu", title: "Find the Labuu", marquee: "FIND THE LABUU",
      description: "ลาบู้ทั้ง 7 ตัวกำลังซ่อนอยู่ในความมืด! รีบตามหาให้ครบก่อนหมดเวลานะคะ!", url: "/community/rnc/arcade/labuu?play=1",
      status: "[ SCANNING... 0/7 FOUND ]",
      quote: "\" เอ๋~? หายไปไหนกันหมดนะ... 404 LABUU NOT FOUND!? (・_・?) \"",
      seeds: "/community/rnc/labuu-leaderboard-seeds.json?v=2",
    },
    {
      id: "labuu-run", title: "Labuu Run", marquee: "LABUU RUN",
      description: "กระโดดสองจังหวะหลบเหล่ามอนสเตอร์ แล้ววิ่งไปให้ไกลที่สุดเท่าที่จะทำได้!", url: "/community/rnc/arcade/labuu-run",
      status: "[ SYSTEM : RUNNING... ]",
      quote: "\" ระวังข้างหน้าด้วยนะคะ! อ๊ะ...โดดดด! (>▽<) \"",
      seeds: "/community/rnc/labuu-run-leaderboard-seeds.json",
      scoreLocale: "en",
    },
    ...[3, 4, 5].map(slot => ({ title: "ตู้ " + String(slot).padStart(2, "0"), marquee: "FILE NO. 00" + slot, description: "ตู้เกมนี้ยังไม่เปิดให้เล่น" })),
  ];
  const scoreCopy = {
    th: {
      close: "ปิด", region: "อันดับและคะแนน", personal: "คะแนนสูงสุดของคุณ",
      rank: rank => "อันดับ " + rank + " ของเซิร์ฟ", outside: "อันดับของคุณอยู่นอก 10 อันดับแรก",
      loading: "กำลังโหลดอันดับของเซิร์ฟ", empty: "ยังไม่มีคะแนนของเกมนี้",
      error: "โหลดอันดับผู้เล่นไม่ได้ ลองเปิดตารางอีกครั้ง",
    },
    en: {
      close: "Close", region: "Ranks and scores", personal: "Your high score",
      rank: rank => "Server rank " + rank, outside: "Your rank is outside the top 10",
      loading: "Loading leaderboard…", empty: "No scores yet",
      error: "Could not load scores. Open the leaderboard to try again.",
    },
  };
  const outerSlot = Math.floor(games.length / 2);
  const params = new URLSearchParams(location.search);
  const initialCabinet = Math.max(0, games.findIndex(game => game.id && game.id === params.get("game")));
  let active = initialCabinet;
  let scoreRequest;
  let moving = false;
  let queuedStep = null;
  let pointerStart = null;
  let lastSwipe = -Infinity;
  let cueLabuuCameo;
  let previewedCabinet = null;
  const cabinets = games.map((game, index) => {
    const cabinet = template.content.firstElementChild.cloneNode(true);
    cabinet.querySelector(".cabinet-marquee").textContent = game.marquee;
    cabinet.querySelector("img").hidden = !game.url;
    cabinet.classList.toggle("is-offline", !game.url);
    cabinet.addEventListener("pointerenter", event => {
      if (event.pointerType !== "mouse" || moving || !game.status) return;
      previewedCabinet = index;
      renderGameInfo(game, true);
    });
    cabinet.addEventListener("pointerleave", event => {
      if (event.pointerType !== "mouse" || previewedCabinet !== index) return;
      previewedCabinet = null;
      renderGameInfo(games[active]);
    });
    cabinet.addEventListener("click", event => {
      if (moving || (event.detail > 0 && performance.now() - lastSwipe < 300)) return;
      const offset = cabinetOffset(index);
      if (offset !== 0) {
        if (Math.abs(offset) === 1) shift(offset, true);
        return;
      }
      if (!game.url || event.detail > 1) return;
      if (typeof window.RNCNavigate === "function") window.RNCNavigate(game.url);
      else location.assign(game.url);
    });
    track.append(cabinet);
    return cabinet;
  });

  function wrap(index) {
    return (index + games.length) % games.length;
  }

  function cabinetOffset(index) {
    return wrap(index - active + outerSlot) - outerSlot;
  }

  function updateCabinetAction(cabinet, game, canLaunch) {
    cabinet.querySelector(".cabinet-status").textContent = game.url
      ? (canLaunch ? "PRESS START" : "SELECT")
      : "OFFLINE";
    cabinet.setAttribute("aria-label", game.url
      ? (canLaunch ? "เล่น " : "เลือก ") + game.title
      : game.title + " · ยังไม่เปิดให้เล่น");
  }

  function renderGameInfo(game, showNotes = false) {
    title.textContent = game.title;
    description.textContent = game.description;
    noteStatus.textContent = showNotes ? game.status : "";
    noteQuote.textContent = showNotes ? game.quote : "";
    notes.hidden = !showNotes;
  }

  function select(index, moveFocus = false) {
    active = wrap(index);
    cabinets.forEach((cabinet, slot) => {
      const distance = cabinetOffset(slot);
      cabinet.dataset.offset = String(distance);
      cabinet.setAttribute("aria-current", String(distance === 0));
      cabinet.tabIndex = distance === 0 ? 0 : -1;
      cabinet.inert = Math.abs(distance) > 1;
      updateCabinetAction(cabinet, games[slot], distance === 0 && !moving);
    });
    const game = games[active];
    previewedCabinet = null;
    renderGameInfo(game);
    leaderboardButton.hidden = !game.id;
    if (moveFocus) cabinets[active].focus({ preventScroll: true });
    cueLabuuCameo?.();
  }

  function shift(step, moveFocus = false) {
    if (!step) return;
    if (moving) {
      queuedStep = { step, moveFocus };
      return;
    }
    if (reducedMotion.matches) {
      select(active + step, moveFocus);
      return;
    }

    moving = true;
    track.classList.add("is-sliding");
    const departingOffset = -step * outerSlot;
    const wrapping = cabinets[wrap(active + departingOffset)];
    const departing = wrapping.cloneNode(true);
    departing.inert = true;
    departing.setAttribute("aria-hidden", "true");
    departing.classList.add("arcade-cabinet-ghost");
    track.append(departing);

    // The departing copy leaves its edge while the original enters from the opposite edge.
    wrapping.classList.add("is-repositioning");
    wrapping.dataset.offset = String(step * (outerSlot + 1));
    void track.offsetWidth;
    wrapping.classList.remove("is-repositioning");

    select(active + step, moveFocus);
    departing.dataset.offset = String(departingOffset - step);

    const arriving = cabinets[active];
    const fallback = window.setTimeout(finish, 420);
    arriving.addEventListener("transitionend", onArrivalEnd);

    function onArrivalEnd(event) {
      if (event.target === arriving && event.propertyName === "transform") finish();
    }

    function finish() {
      window.clearTimeout(fallback);
      arriving.removeEventListener("transitionend", onArrivalEnd);
      departing.remove();
      moving = false;
      track.classList.remove("is-sliding");
      const queued = queuedStep;
      queuedStep = null;
      if (queued) shift(queued.step, queued.moveFocus);
      else updateCabinetAction(arriving, games[active], true);
    }
  }

  for (const button of document.querySelectorAll("[data-cabinet-step]")) {
    button.addEventListener("click", () => shift(Number(button.dataset.cabinetStep)));
  }

  document.querySelector(".arcade-carousel").addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.repeat && event.key === "Enter" && track.contains(event.target)) {
      event.preventDefault();
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    shift(event.key === "ArrowRight" ? 1 : -1, track.contains(event.target));
  });

  track.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.pointerType === "mouse") return;
    pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  track.addEventListener("pointerup", event => {
    if (!pointerStart || event.pointerId !== pointerStart.id) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
    lastSwipe = performance.now();
    shift(dx < 0 ? 1 : -1);
  });
  track.addEventListener("pointercancel", () => { pointerStart = null; });

  function appendScoreRow(rows, entry) {
    const row = rows.insertRow();
    row.classList.toggle("is-mine", Boolean(entry.isMine));
    row.insertCell().textContent = String(entry.rank).padStart(2, "0");
    row.insertCell().textContent = String(entry.score).padStart(5, "0");
    row.insertCell().textContent = entry.name;
  }

  function showScores(top, personal, copy) {
    const rows = document.querySelector("[data-score-rows]");
    rows.replaceChildren();
    document.querySelector("[data-personal-score]").textContent = "—";
    document.querySelector("[data-personal-rank]").hidden = true;
    top.forEach(entry => appendScoreRow(rows, entry));
    if (personal) {
      document.querySelector("[data-personal-score]").textContent = number.format(personal.score);
      const rank = document.querySelector("[data-personal-rank]");
      rank.textContent = copy.rank(number.format(personal.rank));
      rank.hidden = false;
      if (!top.some(entry => entry.isMine)) {
        const gap = rows.insertRow();
        gap.className = "arcade-score-gap";
        const marker = gap.insertCell();
        marker.colSpan = 3;
        marker.setAttribute("aria-label", copy.outside);
        marker.textContent = "…";
        appendScoreRow(rows, personal);
      }
    }
    document.querySelector("[data-score-table]").hidden = false;
  }

  async function loadScores(game) {
    scoreRequest?.abort();
    const request = new AbortController();
    scoreRequest = request;
    const status = document.querySelector("[data-score-status]");
    document.querySelector("[data-score-game]").textContent = game.title;
    const copy = scoreCopy[game.scoreLocale ?? "th"];
    showScores([], null, copy);
    document.querySelector("[data-score-table]").hidden = true;
    status.hidden = false;
    status.textContent = copy.loading;
    try {
      const response = await fetch("/api/community/arcade/" + game.id, { cache: "no-store", signal: request.signal });
      if (!response.ok) throw new Error("Scoreboard request failed");
      const { top, personal } = await response.json();
      if (request.signal.aborted) return;
      showScores(top, personal, copy);
      status.hidden = top.length > 0;
      if (!top.length) status.textContent = copy.empty;
    } catch {
      if (request.signal.aborted) return;
      status.textContent = copy.error;
      if (!game.seeds) return;
      try {
        const response = await fetch(game.seeds, { signal: request.signal });
        if (!response.ok) return;
        const seeds = await response.json();
        if (!request.signal.aborted) showScores(seeds.map((entry, index) => ({ ...entry, rank: index + 1 })), null, copy);
      } catch {
        // Keep the load error visible when neither source is available.
      }
    }
  }

  function setupLabuuCameo(scoreboard, leaderboardButton) {
    const stage = track.parentElement;
    const sprite = stage.querySelector(".arcade-labuu-cameo");
    let timer = null;
    let scheduledAt = Infinity;
    let lastAppearance = -Infinity;
    let lastPointerCheck = -Infinity;
    let animation = null;
    let walking = false;
    let peeking = null;
    let attachedCabinet = null;
    let mouse = null;

    const paused = () => document.hidden || reducedMotion.matches || scoreboard.open;
    const position = (x, y, tilt = 0) => ({
      transform: `translate3d(${x}px, ${y}px, 0) rotate(${tilt}deg)`,
    });
    const floorY = height => height - sprite.offsetHeight - 10;

    function stop() {
      window.clearTimeout(timer);
      timer = null;
      scheduledAt = Infinity;
      animation?.cancel();
      animation = null;
      walking = false;
      peeking = null;
      attachedCabinet = null;
      sprite.classList.remove("is-peeking");
      sprite.hidden = true;
    }

    function finishCameo() {
      stop();
      schedule();
    }

    function play(keyframes, duration, { isWalk = false, onFinish = finishCameo } = {}) {
      animation?.cancel();
      const motion = sprite.animate(keyframes, { duration, fill: "forwards" });
      animation = motion;
      walking = isWalk;
      motion.onfinish = () => {
        if (animation === motion) onFinish();
      };
    }

    function walkSteps(startX, endX, floor, direction, steps, start = 0, end = 1) {
      return Array.from({ length: steps + 1 }, (_, step) => {
        const progress = step / steps;
        const lifted = step % 2 === 1;
        return {
          ...position(startX + (endX - startX) * progress, floor - (lifted ? 6 : 0), lifted ? direction * 5 : 0),
          offset: start + (end - start) * progress,
        };
      });
    }

    function walk(bounds, shouldStumble = false) {
      const spriteWidth = sprite.offsetWidth;
      const floor = floorY(bounds.height);
      const direction = Math.random() < .5 ? 1 : -1;
      const startX = direction > 0 ? -spriteWidth : bounds.width;
      const endX = direction > 0 ? bounds.width : -spriteWidth;
      const duration = Math.min(4800, 2000 + bounds.width * 2);
      if (!shouldStumble) {
        play(walkSteps(startX, endX, floor, direction, 14), duration, { isWalk: true });
        return;
      }

      const tripX = startX + (endX - startX) * .46;
      const recoverX = tripX + direction * 32;
      play([
        ...walkSteps(startX, tripX, floor, direction, 6, 0, .36),
        { ...position(tripX + direction * 12, floor - 13, direction * 24), offset: .39 },
        { ...position(recoverX, floor + 5, direction * 73), offset: .45 },
        { ...position(recoverX, floor + 5, direction * 73), offset: .52 },
        { ...position(recoverX, floor - 8, -direction * 12), offset: .58 },
        { ...position(recoverX, floor, -direction * 9), offset: .63 },
        { ...position(recoverX, floor, direction * 9), offset: .68 },
        ...walkSteps(recoverX, endX, floor, direction, 8, .72, 1),
      ], duration + 1200);
    }

    function slide(bounds) {
      attachedCabinet = cabinets[active];
      const cabinet = attachedCabinet.getBoundingClientRect();
      const side = Math.random() < .5 ? -1 : 1;
      const spriteWidth = sprite.offsetWidth;
      const clampX = x => Math.max(4, Math.min(bounds.width - spriteWidth - 4, x));
      const edge = (side < 0 ? cabinet.left : cabinet.right) - bounds.left;
      const grip = clampX(edge - spriteWidth / 2);
      const top = Math.max(7, cabinet.top - bounds.top - sprite.offsetHeight * .32);
      const floor = floorY(bounds.height);
      const land = clampX(grip + side * 22);
      play([
        { ...position(grip - side * 12, top - 6, side * 8), opacity: 0 },
        { ...position(grip, top, side * 14), opacity: 1, offset: .17 },
        { ...position(grip + side * 4, top + 5, side * 23), opacity: 1, offset: .33, easing: "cubic-bezier(.62,.06,.82,.5)" },
        { ...position(land, floor, side * 26), opacity: 1, offset: .68 },
        { ...position(land, floor - 16, -side * 8), opacity: 1, offset: .76 },
        { ...position(land, floor, 0), opacity: 1, offset: .85 },
        { ...position(clampX(land + side * 28), floor, side * 4), opacity: 0 },
      ], 2300);
    }

    function peekFromSide(side, firstPeek) {
      const bounds = stage.getBoundingClientRect();
      const cabinet = attachedCabinet.getBoundingClientRect();
      const width = sprite.offsetWidth;
      const edge = (side < 0 ? cabinet.left : cabinet.right) - bounds.left;
      const tuckedX = side < 0 ? edge + 5 : edge - width - 5;
      const visibleX = tuckedX + side * width * .64;
      const y = Math.max(6, cabinet.top - bounds.top + cabinet.height * .47 - sprite.offsetHeight / 2);
      const tuck = position(tuckedX, y);
      const next = firstPeek ? () => peekFromSide(-side, false) : finishCameo;
      peeking = { side, tuck, next };
      play([
        tuck,
        { ...tuck, offset: .12 },
        { ...position(visibleX, y, side * 11), offset: .32 },
        { ...position(visibleX, y, side * 6), offset: .74, easing: "ease-in" },
        tuck,
      ], firstPeek ? 1800 : 1500, { onFinish: next });
    }

    function peek() {
      attachedCabinet = cabinets[active];
      sprite.classList.add("is-peeking");
      peekFromSide(Math.random() < .5 ? -1 : 1, true);
    }

    function hop(bounds, cursor, currentTransform) {
      const floor = floorY(bounds.height);
      const spriteWidth = sprite.offsetWidth;
      const cursorX = cursor.x - bounds.left - spriteWidth / 2;
      const currentX = currentTransform ? new DOMMatrixReadOnly(currentTransform).m41 : null;
      const direction = cursorX >= (currentX ?? bounds.width / 2) ? 1 : -1;
      const insideStage = x => Math.max(4, Math.min(bounds.width - spriteWidth - 4, x));
      const targetX = insideStage(cursorX + direction * 18);
      const targetY = Math.max(8, Math.min(floor - 20, cursor.y - bounds.top - sprite.offsetHeight * .8));
      const startX = currentX ?? insideStage(targetX - direction * 110);
      const landingX = insideStage(targetX + direction * 36);
      play([
        { transform: currentTransform ?? position(startX, floor).transform, opacity: currentTransform ? 1 : 0 },
        { ...position(insideStage(startX + direction * 18), floor), opacity: 1, offset: .16, easing: "cubic-bezier(.15,.7,.3,1)" },
        { ...position(targetX, targetY, direction * 10), opacity: 1, offset: .49 },
        { ...position(targetX, targetY, direction * 6), opacity: 1, offset: .60, easing: "cubic-bezier(.6,.1,.8,.5)" },
        { ...position(landingX, floor), opacity: 1, offset: .85 },
        { ...position(insideStage(landingX + direction * 12), floor), opacity: 0 },
      ], 1700);
    }

    function showCameo() {
      const bounds = stage.getBoundingClientRect();
      if (bounds.bottom <= 0 || bounds.top >= window.innerHeight) {
        schedule();
        return;
      }

      lastAppearance = performance.now();
      sprite.hidden = false;
      const mouseOnStage = mouse && mouse.x >= bounds.left && mouse.x <= bounds.right
        && mouse.y >= bounds.top && mouse.y <= bounds.bottom;
      const choice = Math.random();
      if (choice < .18) slide(bounds);
      else if (choice < .36) walk(bounds, true);
      else if (choice < .56) peek();
      else if (mouseOnStage && Math.random() < .45) hop(bounds, mouse);
      else walk(bounds);
    }

    function schedule(delay = 14000 + Math.random() * 10000) {
      if (paused() || animation) return;
      const now = performance.now();
      const next = Math.max(now + delay, lastAppearance + 9000);
      if (next >= scheduledAt) return;

      window.clearTimeout(timer);
      scheduledAt = next;
      timer = window.setTimeout(() => {
        timer = null;
        scheduledAt = Infinity;
        if (!paused()) showCameo();
      }, next - now);
    }

    const resume = () => schedule(4200 + Math.random() * 3400);
    const updateMotion = () => {
      stop();
      resume();
    };

    stage.addEventListener("pointermove", event => {
      if (event.pointerType !== "mouse") {
        mouse = null;
        return;
      }
      mouse = { x: event.clientX, y: event.clientY };
      if (!walking && !peeking) return;

      const now = performance.now();
      if (now - lastPointerCheck < 100) return;
      lastPointerCheck = now;
      const spriteBounds = sprite.getBoundingClientRect();
      const distanceX = mouse.x - (spriteBounds.left + spriteBounds.width / 2);
      if (peeking) {
        const distanceY = mouse.y - (spriteBounds.top + spriteBounds.height / 2);
        if (Math.hypot(distanceX, distanceY) > 88) return;
        const cabinet = attachedCabinet.getBoundingClientRect();
        const { side, tuck, next } = peeking;
        const exposed = side < 0 ? spriteBounds.left < cabinet.left - 4 : spriteBounds.right > cabinet.right + 4;
        if (exposed) {
          peeking = null;
          play([{ transform: getComputedStyle(sprite).transform }, tuck], 170, { onFinish: next });
        }
        return;
      }

      const bounds = stage.getBoundingClientRect();
      if (spriteBounds.right <= bounds.left || spriteBounds.left >= bounds.right) return;
      const distance = Math.abs(distanceX);
      if (distance <= Math.min(200, bounds.width * .48)) {
        hop(bounds, mouse, getComputedStyle(sprite).transform);
      }
    }, { passive: true });
    stage.addEventListener("pointerleave", () => { mouse = null; });
    leaderboardButton.addEventListener("click", stop);
    scoreboard.addEventListener("close", resume);
    document.addEventListener("visibilitychange", updateMotion);
    reducedMotion.addEventListener("change", updateMotion);
    window.addEventListener("pagehide", stop);
    window.addEventListener("pageshow", resume);
    resume();

    return () => {
      if (attachedCabinet && attachedCabinet !== cabinets[active]) stop();
      schedule(2400 + Math.random() * 1800);
    };
  }

  select(initialCabinet);
  if (window.frameElement?.classList.contains("rnc-app-frame-pending")) {
    window.addEventListener("message", function reveal(event) {
      if (event.source !== window.parent || event.origin !== location.origin
        || event.data?.type !== "RNC_ARCADE_REVEAL") return;
      shell.classList.add("is-opening");
      window.removeEventListener("message", reveal);
    });
  } else {
    shell.classList.add("is-opening");
  }
  const scoreboard = document.getElementById("arcade-leaderboard");
  const scoreBody = scoreboard.querySelector(".arcade-score-body");
  function openLeaderboard() {
    const game = games[active];
    if (!game.id || scoreboard.open) return;
    const locale = game.scoreLocale ?? "th";
    const copy = scoreCopy[locale];
    scoreboard.lang = locale;
    scoreboard.querySelector(".arcade-leaderboard-close").setAttribute("aria-label", copy.close);
    scoreboard.querySelector("[data-personal-label]").textContent = copy.personal;
    scoreBody.setAttribute("aria-label", copy.region);
    scoreboard.showModal();
    scoreBody.scrollTop = 0;
    void loadScores(game);
  }
  leaderboardButton.addEventListener("click", openLeaderboard);
  scoreboard.addEventListener("close", () => scoreRequest?.abort());
  scoreboard.addEventListener("click", event => {
    if (event.target === scoreboard) scoreboard.close();
  });
  cueLabuuCameo = setupLabuuCameo(scoreboard, leaderboardButton);
  if (params.get("scores") === "1") openLeaderboard();
})();
