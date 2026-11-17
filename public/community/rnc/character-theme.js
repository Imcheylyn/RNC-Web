(function () {
  "use strict";
  const store=window.RNCCharacterStore;
  const character=store?.getById(new URLSearchParams(location.search).get("id"));
  if(!character)return;
  let media=window.RNCCharacterMedia;
  const enemyCharacter=["Monster","Enemy"].includes(character.characterType);
  const node=(tag,text,className)=>{const element=document.createElement(tag);if(text!==undefined&&text!==null)element.textContent=text;if(className)element.className=className;return element;};
  const clipClock=value=>{const seconds=Math.max(0,Math.floor(Number(value)||0));return Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0");};
  const transportIcons={
    play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7Z"/></svg>',
    pause:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm7 0h4v14h-4z"/></svg>',
    previous:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h2v14H5zm14 0L8 12l11 7Z"/></svg>',
    next:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 5h2v14h-2zM5 5l11 7-11 7Z"/></svg>',
    loading:'<svg class="voice-loading-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/></svg>'
  };
  function paintEnemyThemeButton(button, state) {
    const playing = state === "playing";
    const loading = state === "loading";
    const label = playing ? "พักเพลง" : loading ? "กำลังโหลดเพลง" : "เล่นเพลง";
    button.innerHTML = loading ? transportIcons.loading : playing ? transportIcons.pause : transportIcons.play;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(playing));
    button.title = label;
  }

  window.addEventListener("message", event => {
    if (enemyCharacter || event.origin !== location.origin || event.source !== window.parent) return;
    if (event.data?.type !== "RNC_THEME_DOCK_STATE") return;
    const section = document.querySelector(".character-theme-song");
    if (!section) return;
    const button = section.querySelector("button");
    const stateLabel = section.querySelector(".theme-player-status");
    const isCurrent = Boolean(event.data.songKey && event.data.songKey === button?.dataset.themeSongKey);
    const state = isCurrent ? event.data.state : "paused";
    const playing = state === "playing";
    section.classList.toggle("is-playing", playing);
    if (button?.disabled) return;
    if (button) button.textContent = playing ? "กำลังเล่น" : state === "loading" ? "กำลังเชื่อมต่อ…" : "เล่นเพลง";
    if (stateLabel) stateLabel.textContent = isCurrent ? event.data.message || (playing ? "เพลงกำลังเล่นในแถบลอย" : "") : "";
  });
  function themeSong() {
    const song = character.themeSong;
    if (!song) return;

    const section = enemyCharacter
      ? document.getElementById("enemyThemeSong")
      : node("section", null, "character-theme-song");
    if (!section) return;
    section.hidden = false;
    section.setAttribute("aria-label", enemyCharacter ? "เพลงประจำตัวมอน" : "เพลงประจำตัวละคร");

    const artwork = enemyCharacter
      ? '<span class="enemy-theme-tape" aria-hidden="true"><span class="enemy-tape-shell"><span class="enemy-tape-label"></span><span class="enemy-tape-light"></span><span class="enemy-tape-window"><i></i><i></i></span><span class="enemy-tape-sheen"></span></span></span>'
      : '<div class="theme-song-art"><span class="theme-record" aria-hidden="true"></span><span class="theme-cover"></span></div>';
    const details = enemyCharacter
      ? '<div class="enemy-theme-track"><div class="enemy-theme-caption"><h3></h3><p></p></div><div class="enemy-theme-progress"><input class="enemy-theme-seek" type="range" min="0" max="1" step="0.1" value="0" aria-label="ตำแหน่งเพลง" disabled><span class="enemy-theme-time">0:00 / –:––</span></div></div>'
      : "<small>CHARACTER THEME</small><h3></h3><p></p>";
    section.innerHTML = '<div class="theme-song-main">' + artwork + '<div class="theme-song-details">' + details + '<button type="button">เล่นเพลง</button></div></div><div class="character-media-player" hidden></div><p class="theme-player-status" role="status" aria-live="polite"></p>';

    const title = section.querySelector("h3");
    title.textContent = song.title;
    title.title = song.title;
    const artist = section.querySelector(".theme-song-details p");
    artist.textContent = song.artist || (enemyCharacter ? "" : "Theme Song");
    artist.title = song.artist || "";
    artist.hidden = enemyCharacter && !song.artist;

    const cover = section.querySelector(".theme-cover");
    if (cover) {
      if (song.coverUrl) {
        const image = node("img");
        image.src = song.coverUrl;
        image.alt = "ปกเพลง " + song.title;
        image.loading = "lazy";
        cover.append(image);
      } else {
        cover.textContent = "R:NC";
      }
    }

    const button = section.querySelector("button");
    const mount = section.querySelector(".character-media-player");
    const stateLabel = section.querySelector(".theme-player-status");
    const playable = song.sourceType !== "NONE" && Boolean(song.audioUrl || song.sourceUrl || song.youtubeId);
    button.dataset.themeSongKey = String(song.id || song.audioAssetId || song.youtubeId || song.sourceUrl || song.title || "");
    button.disabled = !playable;
    if (enemyCharacter) paintEnemyThemeButton(button, "paused");
    if (!playable) {
      if (enemyCharacter) {
        artist.textContent = "ยังไม่มีไฟล์เสียง";
        artist.hidden = false;
        button.title = "ยังไม่มีไฟล์เสียง";
      } else {
        stateLabel.textContent = "ยังไม่มีไฟล์เสียง";
      }
    }

    const tape = section.querySelector(".enemy-theme-tape");
    const timeline = section.querySelector(".enemy-theme-seek");
    const counter = section.querySelector(".enemy-theme-time");
    let duration = 0;
    let scrubbing = false;
    let playerState = "idle";

    function paintProgress(progress) {
      if (!timeline || scrubbing) return;
      duration = Math.max(0, Number(progress.duration) || 0);
      const current = Math.max(0, Math.min(duration, Number(progress.current) || 0));
      timeline.max = String(duration || 1);
      timeline.value = String(current);
      timeline.disabled = !duration || playerState === "stopped" || playerState === "error";
      timeline.style.setProperty("--enemy-theme-progress", (duration ? current / duration * 100 : 0) + "%");
      timeline.setAttribute("aria-valuetext", clipClock(current) + " จาก " + clipClock(duration));
      counter.textContent = clipClock(current) + " / " + (duration ? clipClock(duration) : "–:––");
    }

    if (timeline) {
      timeline.addEventListener("pointerdown", () => { scrubbing = true; });
      timeline.addEventListener("input", () => {
        const current = Number(timeline.value);
        timeline.style.setProperty("--enemy-theme-progress", (duration ? current / duration * 100 : 0) + "%");
        timeline.setAttribute("aria-valuetext", clipClock(current) + " จาก " + clipClock(duration));
        counter.textContent = clipClock(current) + " / " + clipClock(duration);
        media?.seek(current, mount);
      });
      for (const eventName of ["pointerup", "pointercancel", "lostpointercapture", "blur"]) {
        timeline.addEventListener(eventName, () => { scrubbing = false; });
      }
      tape.addEventListener("animationend", event => {
        if (event.animationName === "enemy-tape-press") tape.classList.remove("is-pressed");
      });
      tape.addEventListener("pointermove", event => {
        if (event.pointerType === "touch") return;
        const bounds = tape.getBoundingClientRect();
        tape.style.setProperty("--tape-tilt-x", (0.5 - (event.clientY - bounds.top) / bounds.height) * 18 + "deg");
        tape.style.setProperty("--tape-tilt-y", ((event.clientX - bounds.left) / bounds.width - 0.5) * 22 + "deg");
      });
    }

    button.addEventListener("click", async () => {
      stateLabel.textContent = "";
      const selectedSong = { ...song, characterName: character.byname || character.name };
      if (!enemyCharacter && window.parent !== window) {
        window.parent.postMessage({ type: "RNC_THEME_DOCK_TOGGLE", song: selectedSong }, location.origin);
        return;
      }
      if (tape && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        tape.classList.remove("is-pressed");
        void tape.offsetWidth;
        tape.classList.add("is-pressed");
      }
      try {
        button.disabled = true;
        await window.RNCFeatures.load("media");
        media = window.RNCCharacterMedia;
        button.disabled = !playable;
        await media.play({ ...song, id: "theme-" + song.id }, {
          mount,
          controls: !enemyCharacter,
          onProgress: enemyCharacter ? paintProgress : undefined,
          onState(state) {
            playerState = state;
            section.classList.toggle("is-playing", state === "playing");
            if (enemyCharacter) {
              paintEnemyThemeButton(button, state);
              button.disabled = state === "loading" || !playable;
              if (state === "stopped" || state === "error") {
                scrubbing = false;
                timeline.disabled = true;
              }
            } else {
              button.textContent = state === "playing" ? "พักเพลง" : state === "loading" ? "กำลังโหลด…" : "เล่นเพลง";
            }
            stateLabel.textContent = state === "error" ? "เล่นเพลงนี้ไม่ได้" : "";
          },
        });
      } catch (error) {
        if (enemyCharacter) paintEnemyThemeButton(button, "error");
        section.classList.remove("is-playing");
        button.disabled = !playable;
        stateLabel.textContent = error.message;
      }
    });

    if (!enemyCharacter) document.querySelector(".scene-left .owner-line").before(section);
    if (!enemyCharacter && window.parent !== window) {
      window.parent.postMessage({ type: "RNC_THEME_DOCK_REQUEST" }, location.origin);
    }
  }
  themeSong();
})();

