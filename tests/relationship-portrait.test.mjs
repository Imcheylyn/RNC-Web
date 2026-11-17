import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const scope = {window:{}, document:{createElementNS:(_ns,tag)=>({tag,attributes:{},children:[],setAttribute(key,value){this.attributes[key]=String(value);},append(child){this.children.push(child);}})}};
vm.runInNewContext(readFileSync(new URL("../public/community/rnc/relationship-portrait.js",import.meta.url),"utf8"),scope);
vm.runInNewContext(readFileSync(new URL("../public/community/rnc/image-layout.js",import.meta.url),"utf8"),scope);
const portrait=scope.window.RNCRelationshipPortrait, layouts=scope.window.RNCImageLayout;
const source={url:"/api/community/assets/original",width:1600,height:2400,crop:{x:500,y:100,size:600}};
test("existing characters keep their automatic face crop until staff adjusts it",()=>{
  const crop=portrait.geometry(source,layouts.get({},"relationships"));
  assert.equal(crop.x,source.crop.x);assert.equal(crop.y,source.crop.y);assert.equal(crop.size,source.crop.size);
});
test("zoom preserves the automatic face center and can also zoom out",()=>{
  const zoom=portrait.geometry(source,{scale:2,x:50,y:50});
  assert.equal(zoom.size,300);assert.equal(zoom.x+zoom.size/2,800);assert.equal(zoom.y+zoom.size/2,400);
  assert.equal(portrait.geometry(source,{scale:.5}).size,1200);
});
test("staff can reach every edge without exposing space outside the original",()=>{
  for(const scale of [.5,1,2])for(const x of [0,50,100])for(const y of [0,50,100]){
    const crop=portrait.geometry(source,{scale,x,y});
    assert.ok(crop.x>=0&&crop.y>=0);assert.ok(crop.x+crop.size<=source.width);assert.ok(crop.y+crop.size<=source.height);
    if(x===0)assert.equal(crop.x,0);if(x===100)assert.equal(crop.x+crop.size,source.width);
    if(y===0)assert.equal(crop.y,0);if(y===100)assert.equal(crop.y+crop.size,source.height);
  }
});
test("the same saved layout renders the original image in previews, cards, and reports",()=>{
  const layout={scale:1.5,x:65,y:20};
  const preview=portrait.render(source,layout),card=portrait.render(source,layout);
  assert.equal(preview.attributes.viewBox,card.attributes.viewBox);
  assert.equal(card.attributes.preserveAspectRatio,"xMidYMid slice");
  assert.equal(card.children[0].attributes.href,source.url);
  assert.equal(card.children[0].attributes.width,"1600");assert.equal(card.children[0].attributes.height,"2400");
});
test("relationship layout is independent of gallery settings and reset restores automatic",()=>{
  const layout=layouts.normalize({relationships:{scale:1.7,x:72,y:8},galleryDesktop:{scale:1.2,x:13,y:90}});
  assert.equal(layout.relationships.scale,1.7);assert.equal(layout.galleryDesktop.x,13);
  layout.relationships={...layouts.defaults.relationships};
  assert.equal(portrait.geometry(source,layout.relationships).x,source.crop.x);
});
