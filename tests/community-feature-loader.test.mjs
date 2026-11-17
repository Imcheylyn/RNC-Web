import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const source=readFileSync(new URL("../public/community/rnc/feature-loader.js",import.meta.url),"utf8");
function harness(initial=[]) {
  const nodes=[],messages=[],timers=new Map();let nextTimer=0;
  function element(tag){return {tag,attributes:{},style:{},listeners:{},hidden:false,
    getAttribute(key){return this.attributes[key]??this[key]??null;},
    setAttribute(key,value){this.attributes[key]=value;},removeAttribute(key){delete this.attributes[key];},
    addEventListener(key,fn){this.listeners[key]=fn;},remove(){this.removed=true;},
  };}
  const document={createElement:element,querySelectorAll:()=>initial,
    head:{append:node=>nodes.push(node)},body:{append:node=>messages.push(node)},
    getElementById:id=>messages.find(node=>node.id===id),
  };
  const window={};vm.runInNewContext(source,{window,document,setTimeout:fn=>{const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
  return {api:window.RNCFeatures,nodes,messages,timers,element};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test("optional features request nothing until opened and share concurrent dependencies",async()=>{
  const h=harness();assert.equal(h.nodes.length,0);
  const first=h.api.load("collection"),second=h.api.load("collection"),media=h.api.load("media");
  assert.equal(first,second);
  assert.equal(h.nodes.filter(node=>node.src?.includes("character-media.js")).length,1);
  assert.equal(h.nodes.some(node=>node.src?.includes("character-collection.js")),false);
  for(const node of [...h.nodes])node.onload();
  await flush();
  const collection=h.nodes.find(node=>node.src?.includes("character-collection.js"));
  assert.ok(collection);collection.onload();await Promise.all([first,second,media]);
  const count=h.nodes.length;await h.api.load("collection");assert.equal(h.nodes.length,count);
  assert.equal(h.timers.size,0);
});

test("failed downloads and timeouts can retry while successful dependencies stay loaded",async()=>{
  const h=harness();const failed=h.api.load("employeeCard");
  h.nodes[0].onerror();for(const node of h.nodes.slice(1))node.onload();
  await assert.rejects(failed);assert.equal(h.nodes[0].removed,true);
  const retry=h.api.load("employeeCard");
  const css=h.nodes.at(-1);assert.equal(css.tag,"link");css.onload();await flush();
  const card=h.nodes.at(-1);assert.ok(card.src.includes("employee-card.js"));
  const timeout=[...h.timers.values()][0];timeout();await assert.rejects(retry);assert.equal(card.removed,true);
  const last=h.api.load("employeeCard");await flush();h.nodes.at(-1).onload();await last;
  assert.equal(h.nodes.filter(node=>node.src?.includes("employee-photo.js")).length,1);
});

test("repeat taps open one dialog and a failed first tap unlocks the next attempt",async()=>{
  const h=harness(),button=h.element("button");let opened=0;
  h.api.bind(button,"media",()=>{opened++;});
  const first=button.listeners.click();await button.listeners.click();
  assert.equal(h.nodes.length,1);assert.equal(button.attributes["aria-busy"],"true");
  h.nodes[0].onerror();await first;assert.equal(opened,0);assert.ok(h.messages[0].textContent);
  const retry=button.listeners.click();h.nodes.at(-1).onload();await retry;
  assert.equal(opened,1);assert.equal(button.attributes["aria-busy"],undefined);
});

test("editor dependencies already loaded by the page are reused",async()=>{
  const h=harness([{getAttribute:()=>"/community/rnc/character-media.js?v=upload-stability-20261116-v1"}]);
  await h.api.load("media");assert.equal(h.nodes.length,0);
});
