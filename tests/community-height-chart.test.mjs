import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../public/community/rnc/height-chart.js", import.meta.url), "utf8");

class ChartElement {
  constructor(tag = "div") {
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.style = { setProperty() {} };
    this.classList = { add() {}, toggle() {} };
    this.handlers = new Map();
    this.value = "";
    this.textContent = "";
    this.disabled = false;
    this.scrollLeft = 0;
    this.clientWidth = 600;
    this.clientHeight = 500;
    this.scrollWidth = 2400;
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute() {}
  removeAttribute(name) { if (name === "data-error") delete this.dataset.error; }
  addEventListener(type, handler) {
    const handlers = this.handlers.get(type) || [];
    handlers.push(handler);
    this.handlers.set(type, handlers);
  }
  async fire(type, properties = {}) {
    const event = { target: this, preventDefault() { this.defaultPrevented = true; }, ...properties };
    for (const handler of this.handlers.get(type) || []) await handler(event);
    return event;
  }
  querySelector(selector) {
    const id = selector.match(/data-character-id="([^"]+)"/)?.[1];
    return this.children.find(node => id ? node.dataset.characterId === id
      : selector === "img" ? node.tag === "img" : node.className?.split(" ").includes(selector.slice(1))) || null;
  }
  querySelectorAll(selector) {
    return this.children.filter(node => node.className?.split(" ").includes(selector.slice(1)));
  }
}

function fixture({ staff = true, count = 3, request } = {}) {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, new ChartElement());
    return elements.get(id);
  };
  const characters = Array.from({ length: count }, (_, index) => ({
    id: String(index), name: "Character " + index, characterType: "Character", height: "170",
    heightChartScale: 1, heightChartOffset: 0, heightChartXOffset: 0,
    updatedAt: "2026-11-17T00:00:00.000Z",
  }));
  get("unitSelect").value = "cm";
  get("sortSelect").value = "height";
  get("zoomRange").value = "50";
  get("spacingRange").value = "100";
  const requests = [];
  const response = updates => ({
    ok: true,
    json: async () => ({ characters: updates.map(item => ({ ...item, updatedAt: "2026-11-17T00:00:01.000Z" })), conflicts: [] }),
  });
  const window = {
    __RNC_BOOTSTRAP__: { staffMode: staff, characters },
    addEventListener() {},
    setTimeout(callback) { callback(); },
  };
  vm.runInNewContext(source, {
    window, console, Error, Element: ChartElement,
    CSS: { escape: value => value },
    document: {
      body: new ChartElement(),
      getElementById: get,
      createElement: tag => new ChartElement(tag),
      querySelector: selector => selector === ".top-links" ? null : get(selector),
    },
    getComputedStyle: () => ({ getPropertyValue: () => "57" }),
    fetch: async (url, init) => {
      const updates = JSON.parse(init.body).updates;
      requests.push(updates);
      return request ? request(updates, requests.length) : response(updates);
    },
  });
  return {
    get, characters, requests, response,
    async resize(id, percent) {
      await get("heightTrack").querySelector('[data-character-id="' + id + '"]').fire("click");
      get("staffScaleControl").value = String(percent);
      await get("staffScaleControl").fire("input");
    },
  };
}

test("mouse wheel pans the member and staff charts, with line/page units and native horizontal input", async () => {
  for (const staff of [false, true]) {
    const { get } = fixture({ staff });
    const chart = get("chartScroll");
    const wheel = properties => chart.fire("wheel", { deltaX: 0, deltaY: 120, deltaMode: 0, ...properties });
    assert.equal((await wheel()).defaultPrevented, true);
    assert.equal(chart.scrollLeft, 120);
    await wheel({ deltaY: -60 });
    assert.equal(chart.scrollLeft, 60);
    await wheel({ deltaY: 3, deltaMode: 1 });
    assert.equal(chart.scrollLeft, 108);
    await wheel({ deltaY: 1, deltaMode: 2 });
    assert.equal(chart.scrollLeft, 708);
    assert.equal((await wheel({ ctrlKey: true })).defaultPrevented, undefined);
    assert.equal((await wheel({ metaKey: true })).defaultPrevented, undefined);
    assert.equal((await wheel({ deltaX: 120, deltaY: 1 })).defaultPrevented, undefined);
    assert.equal(chart.scrollLeft, 708);
    chart.scrollWidth = chart.clientWidth;
    assert.equal((await wheel()).defaultPrevented, undefined);
  }
});

test("multi-character save retains edits made during the request and prevents duplicate submissions", async () => {
  let complete;
  const waiting = new Promise(resolve => { complete = resolve; });
  const h = fixture({ request: (updates, index) => index === 1 ? waiting : h.response(updates) });
  await h.resize("0", 120);
  await h.resize("1", 130);
  const saving = h.get("saveStaffCalibration").fire("click");
  assert.equal(h.requests[0].length, 2);
  await h.resize("0", 150);
  await h.resize("2", 110);
  assert.equal(h.get("saveStaffCalibration").disabled, true);
  await h.get("saveStaffCalibration").fire("click");
  assert.equal(h.requests.length, 1);
  complete(h.response(h.requests[0]));
  await saving;
  assert.equal(h.characters[0].heightChartScale, 1.5);
  assert.equal(h.characters[0].updatedAt, "2026-11-17T00:00:01.000Z");
  assert.match(h.get("saveStaffCalibration").textContent, /\(2\)/);
  await h.get("saveStaffCalibration").fire("click");
  assert.deepEqual(h.requests[1].map(item => item.id), ["0", "2"]);
  assert.equal(h.requests[1][0].expectedUpdatedAt, "2026-11-17T00:00:01.000Z");
  assert.equal(h.requests[1][0].heightChartScale, 1.5);
  assert.equal(h.get("saveStaffCalibration").disabled, true);
});

test("a failure after the first 300 saves retains the remaining characters for retry", async () => {
  const h = fixture({ count: 305, request: (updates, index) => {
    if (index === 2) throw new Error("Temporary connection failure");
    return h.response(updates);
  } });
  for (let id = 0; id < h.characters.length; id++) await h.resize(String(id), 120);
  await h.get("saveStaffCalibration").fire("click");
  assert.deepEqual(h.requests.map(batch => batch.length), [300, 5]);
  assert.match(h.get("saveStaffCalibration").textContent, /\(5\)/);
  assert.match(h.get("staffCalibrationStatus").textContent, /300.*Temporary connection failure/);
  assert.equal(h.get("staffCalibrationStatus").dataset.error, "true");
  await h.get("saveStaffCalibration").fire("click");
  assert.deepEqual(h.requests[2].map(item => item.id), ["300", "301", "302", "303", "304"]);
  assert.equal(h.get("saveStaffCalibration").disabled, true);
});

test("a conflicting character stays pending while independent characters finish saving", async () => {
  const h = fixture({ request: updates => ({
    ok: true,
    json: async () => ({
      characters: [{ ...updates[0], updatedAt: "2026-11-17T00:00:01.000Z" }],
      conflicts: [{ id: updates[1].id, error: "Edited elsewhere" }],
    }),
  }) });
  await h.resize("0", 120);
  await h.resize("1", 130);
  await h.get("saveStaffCalibration").fire("click");
  assert.match(h.get("saveStaffCalibration").textContent, /\(1\)/);
  assert.match(h.get("staffCalibrationStatus").textContent, /Character 1/);
  assert.equal(h.get("staffCalibrationStatus").dataset.error, "true");
  await h.get("heightTrack").querySelector('[data-character-id="0"]').fire("click");
  assert.equal(h.get("staffCalibrationStatus").dataset.error, "true");
  assert.equal(h.characters[1].heightChartScale, 1.3);
  assert.equal(h.characters[1].updatedAt, "2026-11-17T00:00:00.000Z");
});
