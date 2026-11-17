(function () {
  "use strict";

  let frame = document.getElementById("rncAppFrame");
  let pendingFrame = null;
  let retiringFrame = null;
  let frameFade = null;
  const dock = document.getElementById("rncThemeDock");
  const audio = dock.querySelector("[data-dock-audio]");
  const provider = dock.querySelector("[data-dock-provider]");
  const playButton = dock.querySelector("[data-dock-play]");
  const seek = dock.querySelector("[data-dock-seek]");
  const currentTime = dock.querySelector("[data-dock-current]");
  const duration = dock.querySelector("[data-dock-duration]");
  const status = dock.querySelector("[data-dock-status]");
  const volumeSlider = dock.querySelector("[data-dock-volume]");
  const volumeDown = dock.querySelector("[data-dock-volume-down]");
  const volumeUp = dock.querySelector("[data-dock-volume-up]");
  const volumeValue = dock.querySelector("[data-dock-volume-value]");
  const volumeNote = dock.querySelector("[data-dock-volume-note]");
  const queuePanel = dock.querySelector("#rncDockQueue");
  const queueToggle = dock.querySelector("[data-dock-queue-toggle]");
  const queueCount = dock.querySelector("[data-dock-queue-count]");
  const queueEmpty = dock.querySelector("[data-dock-queue-empty]");
  const queueList = dock.querySelector("[data-dock-queue-list]");
  const nextButton = dock.querySelector("[data-dock-next]");
  const queue = [];
  const volumeStorageKey = "rnc-theme-dock-volume";
  const audioVolumeSupported = (() => {
    const original = audio.volume;
    audio.volume = .5;
    const supported = audio.volume === .5;
    audio.volume = original;
    return supported;
  })();
  let volume = 100;
  try {
    const saved = localStorage.getItem(volumeStorageKey);
    if (saved !== null && Number.isFinite(Number(saved))) volume = Math.max(0, Math.min(100, Math.round(Number(saved))));
  } catch {}
  const initialUrl = new URL(window.__RNC_INITIAL_URL__ || "/community/rnc", location.origin);

  let currentSong = null;
  let currentKey = "";
  let clipEnded = false;
  let sourceDuration = 0;
  let sourceTime = 0;
  let seekDragging = false;
  let pendingSeek = null;
  let playerState = "paused";
  let drag = null;
  let youtubeFallbackTimer = 0;
  let youtubeReady = false;
  let draggedMini = false;
  const miniButton = dock.querySelector("[data-dock-restore]");
  const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7z" fill="currentColor"/></svg>';
  const pauseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm7 0h4v14h-4z" fill="currentColor"/></svg>';

  const frameUrl = (value) => {
    const next = new URL(value, location.origin);
    next.searchParams.set("rnc_inner", "1");
    return next.pathname + next.search + next.hash;
  };

  const displayUrl = (value) => {
    const next = new URL(value, location.origin);
    next.searchParams.delete("rnc_inner");
    return next.pathname + next.search + next.hash;
  };

  const songKey = (song) => String(song?.id || song?.audioAssetId || song?.youtubeId || song?.sourceUrl || song?.title || "");
  const timeText = (value) => {
    if (!Number.isFinite(value) || value < 0) return "–:––";
    const seconds = Math.floor(value);
    return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  };

  function postToFrame(type, extra = {}) {
    try {
      frame.contentWindow?.postMessage({ type, ...extra }, location.origin);
    } catch {}
  }

  function syncFrameAddress() {
    try {
      const inner = new URL(frame.contentWindow.location.href);
      if (inner.origin !== location.origin) return;
      const visible = displayUrl(inner.href);
      if (location.pathname + location.search + location.hash !== visible) {
        history.replaceState(null, "", visible);
      }
    } catch {}
    publishPlayback();
  }

  function publishPlayback() {
    postToFrame("RNC_THEME_DOCK_STATE", {
      state: playerState,
      message: status.textContent,
      songKey: currentKey,
      queuedKeys: queue.map(songKey),
    });
  }

  function finishFrameFade() {
    frameFade?.cancel();
    frameFade = null;
    retiringFrame?.remove();
    retiringFrame = null;
  }

  function navigateFrame(value, push = true) {
    const next = new URL(value, location.origin);
    const target = frameUrl(next.href);
    if (pendingFrame?.getAttribute("src") === target && push) return;
    pendingFrame?.remove();
    pendingFrame = null;
    finishFrameFade();

    const isArcade = next.pathname === "/community/rnc/arcade" || next.pathname.startsWith("/community/rnc/arcade/");
    if (isArcade && push && displayUrl(next.href) === displayUrl(location.href)) return;

    if (!isArcade || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (push) history.pushState(null, "", displayUrl(next.href));
      frame.src = target;
      return;
    }

    const incoming = frame.cloneNode(false);
    incoming.removeAttribute("id");
    incoming.classList.add("rnc-app-frame-pending");
    incoming.setAttribute("aria-hidden", "true");
    incoming.inert = true;
    incoming.src = target;
    pendingFrame = incoming;
    incoming.addEventListener("load", () => {
      if (pendingFrame !== incoming) return;
      pendingFrame = null;

      const previous = frame;
      const wasFocused = document.activeElement === previous;
      previous.removeEventListener("load", syncFrameAddress);
      previous.removeAttribute("id");
      previous.classList.add("rnc-app-frame-retiring");
      previous.setAttribute("aria-hidden", "true");
      previous.inert = true;
      retiringFrame = previous;

      frame = incoming;
      frame.id = "rncAppFrame";
      frame.classList.remove("rnc-app-frame-pending");
      frame.removeAttribute("aria-hidden");
      frame.inert = false;
      frame.addEventListener("load", syncFrameAddress);
      if (push) history.pushState(null, "", displayUrl(next.href));
      syncFrameAddress();
      frameFade = frame.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 280, easing: "cubic-bezier(.25,.6,.3,1)", fill: "both",
      });
      frameFade.onfinish = finishFrameFade;
      postToFrame("RNC_ARCADE_REVEAL");
      if (wasFocused) frame.focus({ preventScroll: true });
    }, { once: true });
    frame.after(incoming);
  }

  frame.addEventListener("load", syncFrameAddress);
  frame.src = frameUrl(initialUrl.href);

  function setState(state, message = "") {
    playerState = state;
    dock.classList.toggle("is-playing", state === "playing");
    dock.dataset.state = state;
    playButton.innerHTML = state === "playing" ? pauseIcon : playIcon;
    dock.querySelector("[data-dock-state]").textContent = ({playing:"NOW PLAYING",loading:"LOADING",error:"UNAVAILABLE",ended:"FINISHED"})[state] || "PAUSED";
    playButton.setAttribute("aria-label", state === "playing" ? "พักเพลง" : "เล่นเพลง");
    miniButton.setAttribute("aria-label", "เปิดเครื่องเล่น: " + (currentSong?.title || "Theme Song") + (state === "playing" ? " · กำลังเล่น" : ""));
    status.textContent = message;
    publishPlayback();
  }

  function updateVolumeControls() {
    const available = currentSong?.sourceType === "YOUTUBE" || audioVolumeSupported;
    volumeSlider.value = String(volume);
    volumeSlider.style.setProperty("--volume-level", volume + "%");
    volumeSlider.setAttribute("aria-valuetext", volume + "%");
    volumeSlider.disabled = !available;
    volumeDown.disabled = !available || volume === 0;
    volumeUp.disabled = !available || volume === 100;
    volumeValue.textContent = available ? volume + "%" : "—";
    volumeNote.hidden = available;
  }

  function applyVolume() {
    if (audioVolumeSupported) audio.volume = volume / 100;
    audio.muted = volume === 0 && audioVolumeSupported;
    if (youtubeReady) youtubeCommand("setVolume", [volume]);
  }

  function setVolume(value) {
    if (!Number.isFinite(value)) return;
    volume = Math.max(0, Math.min(100, Math.round(value)));
    applyVolume();
    updateVolumeControls();
    try { localStorage.setItem(volumeStorageKey, String(volume)); } catch {}
  }

  function showQueue(show) {
    queuePanel.hidden = !show;
    queueToggle.setAttribute("aria-expanded", String(show));
    if (show && dock.style.left) {
      const rect = dock.getBoundingClientRect();
      clampDock(rect.left, rect.top);
    }
  }

  function renderQueue() {
    const previousFocus = queueList.contains(document.activeElement) ? document.activeElement : null;
    let nextFocus = null;
    queueCount.textContent = String(queue.length);
    queueCount.hidden = queue.length === 0;
    nextButton.disabled = nextButton.hidden = queue.length === 0;
    queueEmpty.hidden = queue.length > 0;
    queueList.replaceChildren();
    queue.forEach((song, index) => {
      const title = song.title || "Theme Song";
      const key = songKey(song);
      const row = document.createElement("li");
      const actions = document.createElement("div");
      actions.className = "rnc-dock-queue-entry";

      function addAction(action, label, name, handler) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.setAttribute("aria-label", name + title);
        button.dataset.queueAction = action;
        button.dataset.songKey = key;
        if (previousFocus?.dataset.songKey === key && previousFocus.dataset.queueAction === action) nextFocus = button;
        button.addEventListener("click", handler);
        actions.append(button);
        return button;
      }

      const play = addAction("play", title, "เล่นตอนนี้: ", () => playQueued(index, true));
      play.className = "rnc-dock-queue-song";
      play.title = title;
      const moveUp = addAction("up", "ขึ้น", "เลื่อนขึ้น: ", () => {
        queue.splice(index, 1);
        queue.splice(index - 1, 0, song);
        renderQueue();
        publishPlayback();
      });
      moveUp.disabled = index === 0;
      addAction("remove", "ลบ", "เอาออกจากคิว: ", () => {
        queue.splice(index, 1);
        renderQueue();
        publishPlayback();
      });
      row.append(actions);
      queueList.append(row);
    });
    if (previousFocus) (nextFocus && !nextFocus.disabled ? nextFocus : queueToggle).focus({ preventScroll: true });
  }

  function enqueueSong(song) {
    if (!song || typeof song !== "object") return;
    const key = songKey(song);
    if (!key || queue.some(item => songKey(item) === key)) return;
    if (queue.length >= 50) {
      status.textContent = "คิวเพลงเต็มแล้ว";
      return;
    }
    queue.push(song);
    if (dock.hidden) {
      dock.hidden = false;
      setCollapsed(false);
      dock.dataset.state = "queued";
      miniButton.setAttribute("aria-label", "เปิดคิวเพลง");
      miniButton.title = "เปิดคิวเพลง";
      showQueue(true);
      if (innerWidth <= 520) setCollapsed(true);
    }
    renderQueue();
    publishPlayback();
  }

  function playQueued(index, reveal) {
    if (!queue[index]) return false;
    const [song] = queue.splice(index, 1);
    renderQueue();
    openSong(song, reveal);
    if (!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      const artwork = dock.querySelector(".rnc-dock-art");
      artwork?.getAnimations().forEach(motion => motion.cancel());
      artwork?.animate([
        { transform: "translateX(-7px)", opacity: .65 },
        { transform: "translateX(0)", opacity: 1 },
      ], { duration: 230, easing: "ease-out" });
    }
    return true;
  }

  function finishTrack() {
    if (clipEnded) return;
    clipEnded = true;
    pendingSeek = null;
    if (currentSong.sourceType === "YOUTUBE") youtubeCommand("pauseVideo");
    else audio.pause();
    updateProgress(playbackRange().end);
    if (!playQueued(0, false)) setState("ended", "เพลงจบแล้ว แตะเล่นเพื่อฟังซ้ำ");
  }

  function paintProgress() {
    seek.style.setProperty("--seek-progress", Number(seek.value) / 10 + "%");
  }

  function playbackRange() {
    const start = Math.max(0, Number(currentSong?.startSeconds) || 0);
    const requestedEnd = currentSong?.endSeconds == null ? sourceDuration : Number(currentSong.endSeconds);
    const end = Math.max(start, Math.min(sourceDuration, requestedEnd));
    return { start, end, length: end - start };
  }

  function updateProgress(at, fullDuration) {
    if (Number.isFinite(fullDuration) && fullDuration > 0) sourceDuration = fullDuration;
    const hasTime = Number.isFinite(at) && at >= 0;
    if (hasTime) sourceTime = at;
    const range = playbackRange();
    const ready = sourceDuration > 0 && range.length > 0;
    seek.disabled = !ready;
    duration.textContent = ready ? timeText(range.length) : "–:––";
    if (ready) duration.dataset.seconds = String(sourceDuration);
    if (pendingSeek && ((hasTime && Math.abs(at - pendingSeek.time) < .75) || Date.now() >= pendingSeek.until)) {
      pendingSeek = null;
    }
    if (seekDragging) return;
    const position = clipEnded ? range.end : pendingSeek?.time ?? sourceTime;
    const elapsed = Math.max(0, Math.min(range.length, position - range.start));
    currentTime.textContent = timeText(elapsed);
    seek.value = String(ready ? Math.round(elapsed / range.length * 1000) : 0);
    paintProgress();
  }

  function clampDock(left, top) {
    dock.style.left = Math.max(8, Math.min(innerWidth - dock.offsetWidth - 8, left)) + "px";
    dock.style.top = Math.max(8, Math.min(innerHeight - dock.offsetHeight - 8, top)) + "px";
    dock.style.right = "auto";
    dock.style.bottom = "auto";
  }

  function setCollapsed(collapsed, focus = false) {
    const previous = dock.getBoundingClientRect();
    const positioned = Boolean(dock.style.left);
    dock.classList.toggle("is-collapsed", collapsed);
    if (positioned) clampDock(previous.right - dock.offsetWidth, previous.bottom - dock.offsetHeight);
    if (focus) (collapsed ? miniButton : playButton).focus({ preventScroll: true });
  }

  function resetPlayback() {
    window.clearTimeout(youtubeFallbackTimer);
    youtubeReady = false;
    audio.onloadedmetadata = null;
    audio.ontimeupdate = null;
    audio.onplay = null;
    audio.onpause = null;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    provider.replaceChildren();
    provider.hidden = true;
    clipEnded = false;
    sourceDuration = 0;
    sourceTime = 0;
    seekDragging = false;
    pendingSeek = null;
    seek.disabled = true;
    seek.value = "0";
    paintProgress();
    currentTime.textContent = "0:00";
    duration.textContent = "–:––";
    duration.removeAttribute("data-seconds");
  }

  function youtubeId(value) {
    if (/^[\w-]{11}$/.test(value || "")) return value;
    try {
      const url = new URL(value);
      const host = url.hostname.replace(/^(www\.|m\.)/, "");
      const id = host === "youtu.be"
        ? url.pathname.split("/")[1]
        : ["youtube.com", "youtube-nocookie.com"].includes(host)
          ? url.searchParams.get("v") || url.pathname.split("/")[2]
          : "";
      return /^[\w-]{11}$/.test(id || "") ? id : "";
    } catch {
      return "";
    }
  }

  function openSong(song, reveal = true) {
    if (!song || typeof song !== "object") return;
    currentSong = song;
    currentKey = songKey(song);
    dock.hidden = false;
    if (reveal) setCollapsed(false);
    updateVolumeControls();
    dock.querySelector("[data-dock-character]").textContent = song.characterName || "PERSONAL ARCHIVE";
    dock.querySelector("[data-dock-title]").textContent = song.title || "Theme Song";
    dock.querySelector("[data-dock-artist]").textContent = song.artist || "Theme Song";

    const cover = dock.querySelector("[data-dock-cover]");
    cover.replaceChildren();
    if (song.coverUrl) {
      const image = new Image();
      image.alt = "ปกเพลง";
      image.src = song.coverUrl;
      cover.append(image);
    } else {
      cover.textContent = "R:NC";
    }
    dock.querySelectorAll("[data-record-label]").forEach(label => {
      label.replaceChildren();
      if (song.coverUrl) {
        const image = new Image();
        image.alt = "";
        image.src = song.coverUrl;
        label.append(image);
      }
    });
    miniButton.title = "เปิดเครื่องเล่น: " + (song.title || "Theme Song");

    resetPlayback();
    if (song.sourceType === "YOUTUBE") {
      const id = youtubeId(song.youtubeId || song.sourceUrl);
      if (!id) {
        setState("error", "ลิงก์ YouTube นี้ไม่ถูกต้อง");
        return;
      }

      const start = Math.max(0, Number(song.startSeconds) || 0);
      const params = new URLSearchParams({
        autoplay: "1",
        controls: "0",
        playsinline: "1",
        rel: "0",
        enablejsapi: "1",
        origin: location.origin,
        start: String(Math.floor(start)),
      });
      if (song.endSeconds != null) params.set("end", String(Math.max(1, Math.floor(Number(song.endSeconds)))));

      const iframe = document.createElement("iframe");
      iframe.title = "เสียงเพลง YouTube";
      iframe.allow = "autoplay; encrypted-media";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) + "?" + params.toString();
      iframe.addEventListener("load", () => {
        if (provider.querySelector("iframe") !== iframe) return;
        iframe.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: "rnc-theme-player", channel: "widget" }), "https://www.youtube-nocookie.com");
        youtubeCommand("addEventListener", ["onStateChange"]);
        youtubeCommand("addEventListener", ["onAutoplayBlocked"]);
        youtubeCommand("addEventListener", ["onError"]);
        youtubeCommand("setVolume", [volume]);
      }, { once: true });
      provider.append(iframe);
      provider.hidden = false;
      setState("loading", "กำลังเชื่อมต่อเพลง");
      youtubeFallbackTimer = window.setTimeout(() => {
        if (currentSong === song && playerState === "loading") {
          setState("paused", "แตะเล่นเพื่อเริ่มเสียง");
        }
      }, 15000);
      return;
    }

    const source = song.audioUrl || song.sourceUrl;
    if (!source) {
      setState("error", "เพลงนี้ยังไม่มีไฟล์เสียง");
      return;
    }

    applyVolume();
    setState("loading", "กำลังโหลดเสียง");
    audio.onloadedmetadata = async () => {
      if (currentSong !== song) return;
      const start = Math.max(0, Number(song.startSeconds) || 0);
      updateProgress(start, audio.duration);
      if (!playbackRange().length) {
        setState("error", "ช่วงเวลาเพลงไม่ถูกต้อง");
        return;
      }
      audio.currentTime = start;
      try {
        await audio.play();
      } catch {
        if (currentSong === song) setState("paused", "แตะเล่นเพื่อเริ่มเพลง");
      }
    };
    audio.ontimeupdate = () => {
      const range = playbackRange();
      if (!clipEnded && range.length && audio.currentTime >= range.end) {
        finishTrack();
        return;
      }
      updateProgress(audio.currentTime, audio.duration);
    };
    audio.onplay = () => {
      clipEnded = false;
      updateProgress(audio.currentTime, audio.duration);
      setState("playing");
    };
    audio.onpause = () => {
      if (!audio.ended && !clipEnded) setState("paused");
    };
    audio.onended = () => {
      if (currentSong === song && audio.ended) finishTrack();
    };
    audio.onerror = () => setState("error", "โหลดเพลงไม่ได้ ลิงก์อาจหมดอายุหรือไฟล์ไม่พร้อม");
    audio.src = source;
    audio.load();
  }

  function youtubeCommand(func, args = []) {
    provider.querySelector("iframe")?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args, id: "rnc-theme-player", channel: "widget" }),
      "https://www.youtube-nocookie.com",
    );
  }

  function togglePlayback() {
    if (!currentSong) {
      playQueued(0, true);
      return;
    }
    if (currentSong.sourceType === "YOUTUBE") {
      if (playerState === "playing") {
        youtubeCommand("pauseVideo");
        setState("paused");
      } else {
        if (playerState === "ended") {
          clipEnded = false;
          pendingSeek = { time: playbackRange().start, until: Date.now() + 1500 };
          youtubeCommand("seekTo", [pendingSeek.time, true]);
          updateProgress();
        }
        youtubeCommand("playVideo");
        setState("loading", "กำลังเล่นเพลง");
      }
      return;
    }
    if (audio.paused) {
      if (clipEnded) audio.currentTime = Math.max(0, Number(currentSong.startSeconds) || 0);
      audio.play().catch(() => setState("paused", "แตะเล่นอีกครั้งเพื่อเริ่มเพลง"));
    } else {
      audio.pause();
    }
  }

  applyVolume();
  updateVolumeControls();
  volumeSlider.addEventListener("input", () => setVolume(Number(volumeSlider.value)));
  volumeDown.addEventListener("click", () => setVolume(volume - 10));
  volumeUp.addEventListener("click", () => setVolume(volume + 10));
  queueToggle.addEventListener("click", () => showQueue(queuePanel.hidden));
  nextButton.addEventListener("click", () => {
    if (playQueued(0, true) && nextButton.disabled) playButton.focus({ preventScroll: true });
  });
  playButton.addEventListener("click", togglePlayback);
  seek.addEventListener("input", () => {
    if (!currentSong || seek.disabled) return;
    const range = playbackRange();
    const ratio = Math.max(0, Math.min(1, Number(seek.value) / 1000));
    const at = range.start + range.length * ratio;
    pendingSeek = { time: at, until: Date.now() + 1500 };
    clipEnded = false;
    currentTime.textContent = timeText(at - range.start);
    paintProgress();
    if (playerState === "ended") setState("paused");
    if (currentSong.sourceType === "YOUTUBE") youtubeCommand("seekTo", [at, true]);
    else audio.currentTime = at;
  });
  seek.addEventListener("pointerdown", event => {
    if (!seek.disabled && event.button === 0) seekDragging = true;
  });
  function finishSeek() {
    if (!seekDragging) return;
    seekDragging = false;
    updateProgress();
  }
  seek.addEventListener("change", finishSeek);
  window.addEventListener("pointerup", finishSeek);
  window.addEventListener("pointercancel", finishSeek);

  dock.querySelector("[data-dock-close]").addEventListener("click", () => {
    resetPlayback();
    currentSong = null;
    currentKey = "";
    dock.hidden = true;
    if (queue.length) {
      queue.length = 0;
      renderQueue();
    }
    showQueue(false);
    setState("closed");
  });
  dock.querySelector("[data-dock-minimize]").addEventListener("click", () => setCollapsed(true, true));
  miniButton.addEventListener("click", event => {
    if (draggedMini && event.detail !== 0) { draggedMini = false; return; }
    draggedMini = false;
    setCollapsed(false, true);
  });
  dock.querySelector("[data-dock-library]").addEventListener("click", event => {
    event.preventDefault();
    navigateFrame("/community/rnc/music");
  });

  const dragHandle = dock.querySelector("[data-dock-drag]");
  [dragHandle, miniButton].forEach(handle => {
    handle.addEventListener("pointerdown", event => {
      if (event.button !== 0 || (handle === dragHandle && event.target.closest("button"))) return;
      const rect = dock.getBoundingClientRect();
      draggedMini = false;
      drag = { pointerId:event.pointerId, x:event.clientX - rect.left, y:event.clientY - rect.top, startX:event.clientX, startY:event.clientY };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 4) return;
      draggedMini = handle === miniButton;
      clampDock(event.clientX - drag.x, event.clientY - drag.y);
    });
    handle.addEventListener("pointerup", () => { drag = null; });
    handle.addEventListener("pointercancel", () => { drag = null; draggedMini = false; });
    handle.addEventListener("lostpointercapture", () => { drag = null; });
  });

  window.addEventListener("resize", () => {
    if (!dock.hidden && dock.style.left) {
      const rect = dock.getBoundingClientRect();
      clampDock(rect.left, rect.top);
    }
  });

  window.addEventListener("message", (event) => {
    if (event.source === frame.contentWindow && event.origin === location.origin) {
      if (event.data?.type === "RNC_APP_NAVIGATE") {
        const next = new URL(event.data.url, location.origin);
        if (next.origin !== location.origin || !next.pathname.startsWith("/community")) return;
        navigateFrame(next.href);
      } else if (event.data?.type === "RNC_APP_HASH") {
        const next = new URL(event.data.url, location.origin);
        if (next.origin === location.origin) history.replaceState(null, "", displayUrl(next.href));
      } else if (event.data?.type === "RNC_THEME_DOCK_TOGGLE") {
        const song = event.data.song;
        if (songKey(song) === currentKey && currentSong) {
          dock.hidden = false;
          setCollapsed(false);
          togglePlayback();
        } else {
          const queued = queue.findIndex(item => songKey(item) === songKey(song));
          if (queued !== -1) playQueued(queued, true);
          else openSong(song);
        }
      } else if (event.data?.type === "RNC_THEME_DOCK_ENQUEUE") {
        enqueueSong(event.data.song);
      } else if (event.data?.type === "RNC_THEME_DOCK_REQUEST") {
        publishPlayback();
      }
      return;
    }

    const iframe = provider.querySelector("iframe");
    if (!iframe || event.source !== iframe.contentWindow || !["https://www.youtube-nocookie.com", "https://www.youtube.com"].includes(event.origin)) return;
    let payload;
    try { payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
    if (!youtubeReady && ["onReady", "initialDelivery", "infoDelivery", "onStateChange"].includes(payload?.event)) {
      youtubeReady = true;
      applyVolume();
    }
    if (payload?.event === "onAutoplayBlocked") {
      window.clearTimeout(youtubeFallbackTimer);
      setState("paused", "แตะเล่นเพื่อเริ่มเพลง");
    } else if (payload?.event === "onError") {
      window.clearTimeout(youtubeFallbackTimer);
      setState("error", "เล่นเพลง YouTube นี้ไม่ได้");
    }
    if (payload?.event === "infoDelivery" && payload.info) {
      const info = payload.info;
      // YouTube sends duration and current time independently after the initial update.
      updateProgress(info.currentTime, info.duration);
      const range = playbackRange();
      if (playerState === "playing" && currentSong.endSeconds != null && !pendingSeek && range.length && info.currentTime >= range.end) {
        finishTrack();
        return;
      }
    }
    if (payload?.event === "onStateChange") {
      const state = Number(payload.info);
      if (state === 1) {
        window.clearTimeout(youtubeFallbackTimer);
        clipEnded = false;
        updateProgress();
        setState("playing");
      } else if (state === 2 && !clipEnded) {
        setState("paused");
      } else if (state === 0) {
        window.clearTimeout(youtubeFallbackTimer);
        finishTrack();
      }
    }
  });

  window.addEventListener("popstate", () => { navigateFrame(location.href, false); });
})();
