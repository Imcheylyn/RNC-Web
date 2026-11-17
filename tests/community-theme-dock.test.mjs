import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../public/community/rnc/app-shell.js", import.meta.url), "utf8");

function harness() {
  const listeners = new Map();
  const clock = { value: 0 };
  class Element {
    constructor(tag = "div") {
      this.tagName = tag;
      this.children = [];
      this.dataset = {};
      this.style = { setProperty(name, value) { this[name] = value; } };
      this.handlers = new Map();
      this.attributes = new Map();
      const classes = new Set();
      this.classList = {
        toggle(name, enabled) {
          const next = enabled ?? !classes.has(name);
          if (next) classes.add(name);
          else classes.delete(name);
        },
        contains(name) { return classes.has(name); },
      };
      this.textContent = "";
      this.value = "0";
      this.hidden = false;
      this.contentWindow = { commands: [], postMessage(value) { this.commands.push(value); } };
    }
    addEventListener(type, handler) {
      if (!this.handlers.has(type)) this.handlers.set(type, []);
      this.handlers.get(type).push(handler);
    }
    emit(type, extra = {}) {
      for (const handler of this.handlers.get(type) || []) handler({ target: this, ...extra });
    }
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
    append(child) { this.children.push(child); }
    replaceChildren() { this.children = []; }
    querySelector(selector) {
      return selector === "iframe" ? this.children.find(child => child.tagName === "iframe") : null;
    }
    getBoundingClientRect() { return { left: 0, top: 0, right: 376, bottom: 320 }; }
    contains(element) {
      return element === this || this.children.some(child => child.contains(element));
    }
    focus() {}
  }

  const elements = new Map();
  for (const name of ["audio", "provider", "play", "seek", "current", "duration", "status", "restore", "state", "character", "title", "artist", "cover", "close", "minimize", "library", "drag", "volume", "volume-down", "volume-up", "volume-value", "volume-note", "queue-toggle", "queue-count", "queue-empty", "queue-list", "next"]) {
    elements.set("[data-dock-" + name + "]", new Element(name));
  }
  const dock = new Element();
  const queuePanel = new Element("section");
  dock.hidden = true;
  queuePanel.hidden = true;
  dock.querySelector = selector => selector === "#rncDockQueue" ? queuePanel : elements.get(selector);
  dock.querySelectorAll = () => [new Element(), new Element()];
  const seek = elements.get("[data-dock-seek]");
  let seekValue = 0;
  Object.defineProperty(seek, "value", {
    get() { return String(seekValue); },
    set(value) { seekValue = Number.isFinite(Number(value)) ? Math.max(0, Math.min(1000, Number(value))) : 500; },
  });
  const audio = elements.get("[data-dock-audio]");
  audio.duration = 120;
  audio.volume = 1;
  audio.currentTime = 0;
  audio.paused = true;
  audio.pause = () => { audio.paused = true; audio.onpause?.(); };
  audio.play = async () => { audio.paused = false; audio.onplay?.(); };
  audio.load = () => {};
  const frame = new Element("iframe");
  const window = {
    __RNC_INITIAL_URL__: "/community/rnc",
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    setTimeout() { return 1; },
    clearTimeout() {},
  };
  const document = {
    getElementById(id) { return id === "rncAppFrame" ? frame : dock; },
    createElement(tag) { return new Element(tag); },
  };
  vm.runInNewContext(source, {
    window, document, URL, URLSearchParams,
    location: { origin: "http://localhost:3002", href: "http://localhost:3002/community/rnc" },
    history: { replaceState() {}, pushState() {} },
    Image: class extends Element {},
    Date: { now: () => clock.value },
    innerWidth: 1440, innerHeight: 900,
  });
  function emit(type, extra) {
    for (const handler of listeners.get(type) || []) handler(extra);
  }
  const element = name => elements.get("[data-dock-" + name + "]");
  const sendSong = (type, song) => emit("message", {
    origin: "http://localhost:3002", source: frame.contentWindow,
    data: { type, song },
  });
  const open = song => sendSong("RNC_THEME_DOCK_TOGGLE", song);
  const enqueue = song => sendSong("RNC_THEME_DOCK_ENQUEUE", song);
  const youtube = (info, event = "infoDelivery", target = element("provider").querySelector("iframe")) => emit("message", {
    origin: "https://www.youtube-nocookie.com", source: target.contentWindow,
    data: JSON.stringify({ event, info }),
  });
  return { element, audio, dock, seek, clock, open, enqueue, youtube, emit };
}

const youtubeSong = { id: "theme", sourceType: "YOUTUBE", youtubeId: "M7lc1UVf-VE", title: "Theme" };

test("YouTube time-only messages move the timeline and duration-only messages preserve its position", () => {
  const state = harness();
  state.open(youtubeSong);
  state.youtube({ duration: 240, currentTime: 5 });
  state.youtube({ currentTime: 120 });
  assert.equal(state.seek.value, "500");
  assert.equal(state.element("current").textContent, "2:00");
  assert.equal(state.element("duration").textContent, "4:00");
  state.youtube({ duration: 240 });
  assert.equal(state.seek.value, "500");
  assert.equal(state.seek.style["--seek-progress"], "50%");
});

test("the timeline and seek commands use the selected clip and ignore stale time after seeking", () => {
  const state = harness();
  state.open({ ...youtubeSong, startSeconds: 30, endSeconds: 90 });
  state.youtube({ duration: 180, currentTime: 60 });
  assert.equal(state.seek.value, "500");
  assert.equal(state.element("duration").textContent, "1:00");
  state.seek.value = "800";
  state.seek.emit("input");
  assert.equal(state.element("current").textContent, "0:48");
  const commands = state.element("provider").querySelector("iframe").contentWindow.commands.map(value => JSON.parse(value));
  assert.deepEqual(commands.at(-1).args, [78, true]);
  state.youtube({ currentTime: 60.1 });
  assert.equal(state.seek.value, "800");
  state.youtube({ currentTime: 78 });
  state.youtube({ currentTime: 79 });
  assert.equal(state.seek.value, "817");
  state.youtube({ duration: 180 });
  assert.equal(state.seek.value, "817");
});

test("playback updates leave an active drag alone and resume when the pointer is released", () => {
  const state = harness();
  state.open(youtubeSong);
  state.youtube({ duration: 100, currentTime: 10 });
  state.seek.emit("pointerdown", { button: 0 });
  state.seek.value = "500";
  state.seek.emit("input");
  state.youtube({ currentTime: 50 });
  state.youtube({ currentTime: 51 });
  assert.equal(state.seek.value, "500");
  state.emit("pointerup", {});
  assert.equal(state.seek.value, "510");
});

test("changing songs discards old metadata and a completed clip keeps the timeline at its end", () => {
  const state = harness();
  state.open(youtubeSong);
  state.youtube({ duration: 240, currentTime: 120 });
  const previous = state.element("provider").querySelector("iframe");
  state.open({ ...youtubeSong, id: "next", startSeconds: 20, endSeconds: 200 });
  state.youtube({ duration: 240, currentTime: 200 }, "infoDelivery", previous);
  assert.equal(state.seek.disabled, true);
  state.youtube({ currentTime: 20 });
  assert.equal(state.seek.disabled, true);
  state.youtube({ duration: 120 });
  assert.equal(state.element("duration").textContent, "1:40");
  state.youtube(0, "onStateChange");
  assert.equal(state.seek.value, "1000");
  assert.equal(state.element("current").textContent, "1:40");
  state.youtube({ currentTime: 0 });
  assert.equal(state.seek.value, "1000");
});

test("uploaded audio seeks within the clip, finishes at the end and restarts from the clip start", async () => {
  const state = harness();
  state.open({ id: "audio", sourceType: "UPLOAD", audioUrl: "/audio.wav", startSeconds: 20, endSeconds: 60 });
  await state.audio.onloadedmetadata();
  state.audio.currentTime = 40;
  state.audio.ontimeupdate();
  assert.equal(state.seek.value, "500");
  state.seek.value = "750";
  state.seek.emit("input");
  assert.equal(state.audio.currentTime, 50);
  assert.equal(state.element("current").textContent, "0:30");
  state.audio.currentTime = 60;
  state.audio.ontimeupdate();
  assert.equal(state.seek.value, "1000");
  assert.equal(state.audio.paused, true);
  state.element("play").emit("click");
  assert.equal(state.audio.currentTime, 20);
  state.audio.ontimeupdate();
  assert.equal(state.seek.value, "0");
});

test("the selected volume applies to uploads and carries over when YouTube becomes ready", () => {
  const state = harness();
  state.open({ id: "audio", sourceType: "UPLOAD", audioUrl: "/audio.wav" });
  state.element("volume-down").emit("click");
  assert.equal(state.audio.volume, .9);
  state.element("volume").value = "35";
  state.element("volume").emit("input");
  assert.equal(state.audio.volume, .35);
  state.open(youtubeSong);
  state.youtube(null, "onReady");
  const commands = state.element("provider").querySelector("iframe").contentWindow.commands;
  assert.equal(JSON.parse(commands.at(-1)).func, "setVolume");
  assert.deepEqual(JSON.parse(commands.at(-1)).args, [35]);
  state.element("volume-up").emit("click");
  assert.deepEqual(JSON.parse(commands.at(-1)).args, [45]);
});

test("queued songs advance once when either playback source finishes and stay minimized", async () => {
  const state = harness();
  const audioSong = { id: "audio", title: "Upload", sourceType: "UPLOAD", audioUrl: "/audio.wav", endSeconds: 5 };
  state.open({ ...youtubeSong, endSeconds: 91 });
  state.enqueue(audioSong);
  state.enqueue(audioSong);
  state.enqueue({ ...youtubeSong, id: "final", title: "Final" });
  assert.equal(state.element("queue-count").textContent, "2");
  state.element("minimize").emit("click");
  const oldIframe = state.element("provider").querySelector("iframe");
  state.youtube({ currentTime: 90, duration: 120 });
  state.youtube(1, "onStateChange");
  state.youtube({ currentTime: 91 });
  state.youtube(0, "onStateChange", oldIframe);
  assert.equal(state.element("title").textContent, "Upload");
  assert.equal(state.element("queue-count").textContent, "1");
  assert.equal(state.dock.classList.contains("is-collapsed"), true);
  await state.audio.onloadedmetadata();
  state.audio.currentTime = 5;
  state.audio.ontimeupdate();
  assert.equal(state.element("title").textContent, "Final");
  assert.equal(state.element("queue-count").textContent, "0");
  assert.equal(state.dock.classList.contains("is-collapsed"), true);
  state.youtube(0, "onStateChange");
  assert.equal(state.dock.dataset.state, "ended");
  state.youtube(2, "onStateChange");
  assert.equal(state.dock.dataset.state, "ended");
});
