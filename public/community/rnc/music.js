(() => {
  "use strict";
  const songs = window.__RNC_BOOTSTRAP__?.music || [];
  const grid = document.getElementById("musicGrid");
  const search = document.getElementById("musicSearch");
  const type = document.getElementById("musicType");
  const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7z" fill="currentColor"/></svg>';
  const pauseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm7 0h4v14h-4z" fill="currentColor"/></svg>';
  const queueIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h12M3 12h9M3 18h6m8-6v8m-4-4h8"/></svg>';
  const queuedIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h12M3 12h9M3 18h6m4-2 3 3 5-6"/></svg>';
  let playback = {songKey:"",state:"closed"};
  const key = song => String(song.id || song.audioAssetId || song.youtubeId || song.sourceUrl || song.title || "");
  const node = (tag, className, text) => { const item = document.createElement(tag); if (className) item.className = className; if (text != null) item.textContent = text; return item; };
  const typeName = value => ({Character:"Arcanist",Monster:"Enemy",HeadDirector:"President"})[value] || value;
  [...new Set(songs.map(song => song.characterType))].sort().forEach(value => {
    const option = node("option", "", typeName(value)); option.value = value; type.append(option);
  });
  function cover(song, label = false) {
    const item = node("span", label ? "rnc-record-label" : "music-sleeve");
    if (song.coverUrl) {
      const image = node("img"); image.src = song.coverUrl; image.alt = label ? "" : "ปกเพลง " + song.title; image.loading = "lazy";
      image.addEventListener("error", () => { image.remove(); if (!label) item.textContent = "R:NC"; }, {once:true});
      item.append(image);
    } else if (!label) item.textContent = "R:NC";
    return item;
  }
  function updatePlayback() {
    grid.querySelectorAll(".music-album").forEach(card => {
      const current = card.dataset.songKey === playback.songKey;
      const playing = current && playback.state === "playing";
      card.classList.toggle("is-playing", playing);
      card.querySelectorAll(".music-album-art, .music-album-play").forEach(button => {
        button.setAttribute("aria-label", (playing ? "พักเพลง " : "เล่นเพลง ") + card.dataset.title);
        button.setAttribute("aria-pressed", String(playing));
      });
      card.querySelector(".music-album-play").innerHTML = playing ? pauseIcon : playIcon;
      const queueButton = card.querySelector(".music-album-queue");
      const queued = playback.queuedKeys?.includes(card.dataset.songKey);
      queueButton.innerHTML = queued ? queuedIcon : queueIcon;
      queueButton.title = queued ? "อยู่ในคิว" : "เข้าคิว";
      queueButton.setAttribute("aria-disabled", String(Boolean(queued)));
      queueButton.setAttribute("aria-label", queued ? card.dataset.title + " อยู่ในคิว" : "เพิ่ม " + card.dataset.title + " เข้าคิว");
    });
  }
  function play(song) {
    if (window.parent === window) { location.assign("/community/rnc/music"); return; }
    window.parent.postMessage({type:"RNC_THEME_DOCK_TOGGLE",song}, location.origin);
  }
  function enqueue(song) {
    if (window.parent === window) { location.assign("/community/rnc/music"); return; }
    if (playback.queuedKeys?.includes(key(song))) return;
    window.parent.postMessage({ type: "RNC_THEME_DOCK_ENQUEUE", song }, location.origin);
  }
  function render() {
    const query = search.value.trim().toLocaleLowerCase();
    const matching = songs.filter(song => (!type.value || type.value === song.characterType) && [song.title,song.artist,song.characterName,song.characterFullName].some(value => String(value || "").toLocaleLowerCase().includes(query)));
    grid.replaceChildren();
    matching.forEach(song => {
      const card = node("article", "music-album"); card.dataset.songKey = key(song); card.dataset.title = song.title;
      const artwork = node("button", "music-album-art"); artwork.type = "button";
      const record = node("span", "rnc-record"); record.setAttribute("aria-hidden", "true"); record.append(cover(song, true));
      artwork.append(record, cover(song)); artwork.addEventListener("click", () => play(song));
      const artworkGroup = node("div", "music-album-artwork");
      const actions = node("div", "music-album-actions");
      const playButton = node("button", "music-album-play");
      playButton.type = "button";
      playButton.addEventListener("click", () => play(song));
      const queueButton = node("button", "music-album-queue");
      queueButton.type = "button";
      queueButton.addEventListener("click", () => enqueue(song));
      actions.append(playButton, queueButton);
      artworkGroup.append(artwork, actions);
      const title = node("h2", "", song.title); title.title = song.title;
      const character = node("a", "music-album-character", song.characterName); character.href = "/community/rnc/character?id=" + encodeURIComponent(song.characterId);
      card.append(artworkGroup, title, character);
      if (song.artist) card.append(node("p", "music-album-artist", song.artist));
      grid.append(card);
    });
    document.getElementById("musicTotal").textContent = String(matching.length).padStart(2,"0") + (matching.length === 1 ? " RECORD" : " RECORDS");
    document.getElementById("musicEmpty").hidden = matching.length > 0;
    document.getElementById("musicEmptyText").textContent = songs.length ? "ไม่พบเพลงที่ค้นหา" : "ยังไม่มีเพลงในคลัง";
    updatePlayback();
  }
  search.addEventListener("input", render);
  type.addEventListener("change", render);
  window.addEventListener("message", event => {
    if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== "RNC_THEME_DOCK_STATE") return;
    playback = event.data; updatePlayback();
  });
  render();
})();
