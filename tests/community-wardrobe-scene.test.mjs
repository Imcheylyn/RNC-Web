import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const sceneSource=readFileSync(new URL("../public/community/rnc/wardrobe-scene.js",import.meta.url),"utf8");
const uiSource=readFileSync(new URL("../public/community/rnc/wardrobe.js",import.meta.url),"utf8");
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
function fixture(options={}) {
  const elements=new Map(), fetched=[], images=[], features=[], saved=new Map(), frameCallbacks=[];
  const events={};
  function element(id="") {
    const attributes=new Map(),classes=new Set(),handlers={};
    const item={id,hidden:false,open:false,value:"false",dataset:{},children:[],textContent:"",src:"",disabled:false,
      clientWidth:0,clientHeight:0,clientLeft:0,clientTop:0,offsetWidth:0,
      style:{setProperty(key,value){this[key]=value;}},
      classList:{add(...values){values.forEach(v=>classes.add(v));},remove(...values){values.forEach(v=>classes.delete(v));},toggle(key,value){if(value??!classes.has(key))classes.add(key);else classes.delete(key);},contains:key=>classes.has(key)},
      setAttribute(key,value){if(key==="src")this.src=value;else attributes.set(key,value);},
      getAttribute(key){return key==="src" ? this.src || null : attributes.get(key)??null;},
      hasAttribute:key=>attributes.has(key),removeAttribute(key){attributes.delete(key);if(key==="src")this.src="";},
      addEventListener(key,fn){(handlers[key]??=[]).push(fn);},removeEventListener(){},
      async fire(key,event={}) { for(const fn of handlers[key]||[])await fn({target:this,preventDefault(){},...event}); },
      append(...nodes){nodes.forEach(node=>{node.parentElement=this;this.children.push(node);});},
      replaceChildren(...nodes){this.children=[];this.append(...nodes);},insertBefore(node){this.append(node);},
      querySelectorAll(){return [];},querySelector(selector){return get(id+selector);},closest(){return get(id+"parent");},
      getBoundingClientRect:()=>({left:0,top:0,width:0,height:0,right:0,bottom:0}),
      showModal(){this.open=true;},close(){this.open=false;},getAnimations:()=>[],focus(){},reset(){},
      getContext:()=>({clearRect(){},drawImage(){}}),
      toBlob:callback=>callback(new Blob(["processed outfit artwork"],{type:"image/webp"})),
    };
    return item;
  }
  function get(id) {if(!elements.has(id))elements.set(id,element(id));return elements.get(id);}
  for(const id of ["wardrobeScreen","wardrobeSkinForm","sceneAccessories","sceneChibiImage","sceneMediumImage","sceneChibiButton","sceneMediumButton"])get(id).hidden=true;
  const character={id:"hero",name:"Hero",ownerId:"owner",characterType:options.type||"Character",image:"/portrait.png",employeeCardSigned:options.signed!==false};
  const skins=options.skins||[
    {id:"default",name:"Default",image:"/portrait.png",chibi:"/chibi.png",medium:"/medium.png",isDefault:true},
    {id:"outfit",name:"Outfit",image:"/outfit.png",chibi:"/outfit-chibi.png",medium:"/outfit-medium.png",imageScale:150,applyFramingToProfile:true,imageOffsetX:10,imageOffsetY:-5},
  ];
  if(options.remembered)saved.set("rnc-wardrobe:owner:hero",options.remembered);
  class Image {
    constructor(){this.complete=false;this.naturalWidth=600;this.naturalHeight=900;images.push(this);}
    set src(value){this._src=value;if(value.includes("Sign.png")){queueMicrotask(()=>this.onerror?.());return;}if(!options.deferImages){this.complete=true;queueMicrotask(()=>this.onload?.());}}
    get src(){return this._src;}
  }
  const location=new URL("https://rnc.test/community/rnc/character?id=hero"+(options.hash||""));
  const history={state:{},pushState(state,_,url){this.state=state;location.hash=new URL(url,location).hash;},replaceState(state,_,url){this.state=state;location.hash=new URL(url,location).hash;},back(){location.hash="";}};
  const document={getElementById:get,querySelector:selector=>get(selector),querySelectorAll:()=>[],
    createElement:tag=>element(tag),createDocumentFragment:()=>element("fragment"),
    body:element("body"),documentElement:{clientWidth:390},addEventListener(){},fonts:{ready:Promise.resolve()},
  };
  const window={RNCCharacterStore:{getById:()=>character,currentUser:{id:"owner"}},scrollY:0,scrollTo(){},
    RNCFeatures:{bind(button,name,open){button.addEventListener("click",async()=>{features.push(name);await options.loadFeature?.();await open();});},load(name){features.push(name);return options.loadFeature?.()||Promise.resolve();},showError:assert.fail},
    addEventListener(name,fn){(events[name]??=[]).push(fn);},dispatchEvent(event){for(const fn of events[event.type]||[])fn(event);},
  };
  const context=vm.createContext({window,document,location,history,URL,URLSearchParams,Image,Blob,File,FormData,AbortController,Uint8Array,console,
    innerWidth:390,innerHeight:844,crypto:{randomUUID:()=>"new-outfit"},
    localStorage:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)},
    fetch:async(url,init)=>{fetched.push({url,init});if(options.response)return options.response();return {ok:true,json:async()=>({canEdit:true,canHaveMedium:options.mediumAllowed??character.characterType==="Character",skins,savedId:init.method ? "outfit" : undefined})};},
    matchMedia:()=>({matches:true}),getComputedStyle:()=>({animationName:"none"}),
    ResizeObserver:class {observe(){}},setTimeout,clearTimeout,
    requestAnimationFrame:fn=>options.runFrames ? queueMicrotask(fn) : frameCallbacks.push(fn),cancelAnimationFrame(){},
    createImageBitmap:options.createImageBitmap || (async()=>({width:80,height:120,close(){}})),
    CustomEvent:class {constructor(type,init){this.type=type;this.detail=init.detail;}},
  });
  vm.runInContext(sceneSource,context);
  return {get,window,context,location,character,skins,fetched,images,features,saved,events,
    core:window.RNCWardrobeScene,loadUi(){vm.runInContext(uiSource,context);return window.RNCWardrobeUI;}};
}

test("main Chibi, Medium, remembered outfit and viewer work before the wardrobe UI loads",async()=>{
  const h=fixture({remembered:"outfit"});await h.core.loadWardrobe();
  assert.equal(h.fetched.length,1);assert.equal(h.features.length,0);assert.equal(h.window.RNCWardrobeUI,undefined);
  assert.equal(h.core.activeSkin().id,"outfit");assert.equal(h.get("sceneChibiImage").src,"/outfit-chibi.png");
  assert.equal(h.get("sceneMediumImage").src,"/outfit-medium.png");assert.equal(h.get("sceneAccessories").hidden,false);
  await h.get("sceneMediumButton").fire("click");assert.equal(h.get("wardrobeChibiDialog").open,true);
  assert.equal(h.get("wardrobeChibiArtwork").src,"/outfit-medium.png");assert.equal(h.features.length,0);
  h.core.finishChibiClose();await h.get("cycleWardrobeSkin").fire("click");await flush();
  assert.equal(h.core.activeSkin().id,"default");assert.equal(h.get("sceneMediumImage").src,"/medium.png");
  assert.equal(h.features.length,0);
});

test("opening the lazy UI reuses loaded data, follows skin changes and keeps editing available",async()=>{
  const h=fixture();await h.core.loadWardrobe();const ui=h.loadUi();ui.open();
  assert.equal(h.get("wardrobeScreen").hidden,false);assert.equal(h.fetched.length,1);
  assert.equal(h.get("wardrobeHeroChibi").src,"/chibi.png");assert.equal(h.get("wardrobeHeroMedium").src,"/medium.png");
  await h.core.applySkin(h.skins[1],true);
  assert.equal(h.get("wardrobeHeroImage").src,"/outfit.png");assert.equal(h.get("wardrobeHeroMedium").src,"/outfit-medium.png");
  await h.get("editWardrobeSkin").fire("click");
  assert.equal(h.get("wardrobeSkinDialog").open,true);assert.equal(h.get("wardrobeSkinName").value,"Outfit");
  assert.equal(h.get("wardrobeMediumPreview").src,"/outfit-medium.png");
});

test("wardrobe and character scene follow Medium eligibility from the server",async()=>{
  for (const [type,mediumAllowed] of [["NPC",true],["President",true],["Director",true],["NPC",false]]) {
    const h=fixture({type,mediumAllowed});
    await h.core.loadWardrobe();
    assert.equal(h.get("sceneMediumButton").hidden,!mediumAllowed,type);
    h.loadUi().open();
    await h.get("editWardrobeSkin").fire("click");
    assert.equal(h.get("wardrobeMediumSection").hidden,!mediumAllowed,type);
  }
});

test("remove and reselect companion artwork without clearing the title, description, framing or other images",async()=>{
  const h=fixture({remembered:"outfit",runFrames:true});
  await h.core.loadWardrobe();h.loadUi().open();
  await h.get("editWardrobeSkin").fire("click");
  const form=h.get("wardrobeSkinForm"), name=h.get("wardrobeSkinName"), description=h.get("wardrobeSkinDescription");
  name.value="New name";description.value="Keep this description";
  const png=new File([new Uint8Array([137,80,78,71,13,10,26,10,0])],"same.png",{type:"image/png"});
  const invalid=new File(["unreadable"],"broken.png",{type:"image/png"});
  const pick=async(id,file)=>{
    const input=h.get(id);input.files=[file];input.value=file.name;
    await input.fire("change");assert.equal(input.value,"");
  };
  const medium=h.get("wardrobeMediumPreview"),chibi=h.get("wardrobeChibiPreview");
  await h.get("removeWardrobeMedium").fire("click");
  assert.equal(medium.hidden,true);assert.equal(chibi.src,"/outfit-chibi.png");
  await pick("wardrobeSkinMedium",png);
  const firstPreview=medium.src;
  await pick("wardrobeSkinMedium",invalid);
  assert.equal(medium.src,firstPreview);assert.equal(h.get("wardrobeFormStatus").dataset.state,"error");
  await h.get("removeWardrobeMedium").fire("click");
  await pick("wardrobeSkinMedium",png);
  assert.ok(medium.src.startsWith("blob:"));assert.notEqual(medium.src,firstPreview);
  await h.get("removeWardrobeChibi").fire("click");
  await pick("wardrobeSkinChibi",png);
  await pick("wardrobeSkinImage",png);
  assert.equal(h.get("wardrobeImageScale").value,"150");
  await form.fire("submit");
  const saved=h.fetched.at(-1).init.body;
  assert.equal(saved.get("name"),"New name");assert.equal(saved.get("description"),"Keep this description");
  assert.equal(saved.get("imageScale"),"150");assert.equal(saved.get("imageOffsetX"),"10");assert.equal(saved.get("imageOffsetY"),"-5");
  for(const slot of ["image","chibi","medium"])assert.ok(saved.get(slot) instanceof File,slot);
  assert.equal(saved.has("removeChibi"),false);assert.equal(saved.has("removeMedium"),false);
});

test("opening while metadata is loading shares the request and paints both scenes when it finishes",async()=>{
  const pending=deferred();const h=fixture({response:()=>pending.promise});const ui=h.loadUi();ui.open();
  assert.equal(h.fetched.length,1);
  pending.resolve({ok:true,json:async()=>({canEdit:true,canHaveMedium:true,skins:h.skins})});
  await h.core.loadWardrobe();await flush();
  assert.equal(h.get("sceneChibiImage").src,"/chibi.png");assert.equal(h.get("wardrobeHeroChibi").src,"/chibi.png");
  assert.equal(h.get("retryWardrobe").hidden,true);
});

test("a failed initial metadata request can retry; Humans never display a Medium",async()=>{
  let attempts=0;const h=fixture({type:"Human",response:async()=>{
    if(++attempts===1)throw new Error("offline");
    return {ok:true,json:async()=>({canEdit:true,canHaveMedium:false,skins:h.skins})};
  }});
  await h.core.loadWardrobe();assert.equal(h.core.getState().loadError,"offline");
  const ui=h.loadUi();ui.open();await flush();
  assert.equal(attempts,2);assert.equal(h.get("sceneChibiImage").hidden,false);
  assert.equal(h.get("sceneMediumImage").hidden,true);assert.equal(h.get("wardrobeHeroMedium").hidden,true);
});

test("late artwork cannot overwrite the most recent outfit or its companions",async()=>{
  const h=fixture({deferImages:true});await flush();
  const first=h.images.find(image=>image.src==="/portrait.png");first.onload();await h.core.loadWardrobe();
  const old=h.core.applySkin(h.skins[1],true),current=h.core.applySkin(h.skins[0],true);
  h.images.at(-1).onload();await current;h.images.find(image=>image.src==="/outfit.png").onload();
  assert.equal(await old,false);assert.equal(h.core.activeSkin().id,"default");
  assert.equal(h.get("sceneChibiImage").src,"/chibi.png");assert.equal(h.get("sceneMediumImage").src,"/medium.png");
});

test("unsigned characters keep their companions and require the same signature gate after lazy loading",async()=>{
  const h=fixture({signed:false});await h.core.loadWardrobe();const ui=h.loadUi();ui.open();
  assert.equal(h.get("wardrobeSignatureDialog").open,true);assert.equal(h.get("wardrobeScreen").hidden,true);
  assert.equal(h.get("sceneMediumImage").hidden,false);
  h.character.employeeCardSigned=true;
  h.window.dispatchEvent({type:"rnc:employee-signature-change",detail:{characterId:"hero",signed:true}});
  ui.open();assert.equal(h.get("wardrobeScreen").hidden,false);
});

test("a wardrobe deep link lazy-loads and opens once; leaving the hash while loading cancels the opening",async()=>{
  let h;
  h=fixture({hash:"#wardrobe",loadFeature:async()=>{await flush();h.loadUi();}});
  await flush();await flush();
  assert.deepEqual(h.features,["wardrobe"]);assert.equal(h.get("wardrobeScreen").hidden,false);
  let second;
  second=fixture({hash:"#wardrobe",loadFeature:async()=>{await flush();second.loadUi();}});
  second.location.hash="";await flush();await flush();
  assert.equal(second.get("wardrobeScreen").hidden,true);
});
