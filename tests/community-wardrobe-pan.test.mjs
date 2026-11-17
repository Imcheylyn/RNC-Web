import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const source=readFileSync(new URL("../public/community/rnc/wardrobe.js",import.meta.url),"utf8");
const handlers=source.slice(source.indexOf("  function stopOutfitPan("),source.indexOf("  async function chooseImage("));
function fixture(){
  const classes=new Set(),stage={dataset:{panEnabled:"true"},capture:null,focused:false,classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)},focus(){this.focused=true;},closest:()=>null,getBoundingClientRect:()=>({width:400,height:200}),setPointerCapture(id){this.capture=id;},hasPointerCapture(id){return this.capture===id;},releasePointerCapture(){this.capture=null;}};
  const context={outfitStage:stage,outfitPan:null,imageOffsetX:0,imageOffsetY:0,imageDisplayScale:200,busy:false,processing:{image:false},outfitPreviewMode:"scene",fitOutfitArtwork(){}};
  vm.runInNewContext(handlers,context);
  const event=(values={})=>({pointerId:1,pointerType:"mouse",isPrimary:true,button:0,clientX:200,clientY:100,target:stage,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...values});
  return {context,stage,classes,event};
}

test("dragging shifts artwork by viewport distance independently of zoom, with pointer capture",()=>{
  const {context:c,stage,classes,event}=fixture();c.startOutfitPan(event());
  assert.equal(stage.capture,1);assert.equal(stage.focused,true);assert.equal(classes.has("is-panning"),true);
  c.moveOutfitPan(event({clientX:250,clientY:150}));assert.equal(c.imageOffsetX,12.5);assert.equal(c.imageOffsetY,25);assert.equal(c.imageDisplayScale,200);
  c.moveOutfitPan(event({pointerId:2,clientX:100}));assert.equal(c.imageOffsetX,12.5);
  c.endOutfitPan(event({type:"pointerup"}));assert.equal(c.imageOffsetX,12.5);assert.equal(c.imageOffsetY,25);assert.equal(stage.capture,null);assert.equal(classes.has("is-panning"),false);
});

test("small clicks do not change the position and upload buttons never start a drag",()=>{
  const {context:c,event}=fixture();c.startOutfitPan(event({target:{closest:()=>({tagName:"BUTTON"})}}));assert.equal(c.outfitPan,null);
  c.startOutfitPan(event({button:2}));assert.equal(c.outfitPan,null);
  c.startOutfitPan(event());c.moveOutfitPan(event({clientX:202,clientY:101}));assert.equal(c.imageOffsetX,0);
});

test("canceled gestures and Escape restore the starting position without exiting the editor",()=>{
  for(const reason of ["pointercancel","lostpointercapture","Escape"]){
    const {context:c,event}=fixture();c.imageOffsetX=7;c.imageOffsetY=-9;c.startOutfitPan(event());c.moveOutfitPan(event({clientX:250,clientY:150}));assert.equal(c.imageOffsetX,19.5);assert.equal(c.imageOffsetY,16);
    if(reason === "Escape"){const key=event({key:"Escape"});c.keyOutfitPan(key);assert.equal(key.prevented,true);assert.equal(key.stopped,true);}else c.endOutfitPan(event({type:reason}));
    assert.equal(c.imageOffsetX,7);assert.equal(c.imageOffsetY,-9);assert.equal(c.outfitPan,null);
  }
});

test("touch users can drag vertically as well as horizontally inside the preview",()=>{
  const {context:c,event}=fixture();c.startOutfitPan(event({pointerType:"touch"}));c.moveOutfitPan(event({pointerType:"touch",clientX:150,clientY:103}));assert.equal(c.imageOffsetX,-12.5);
  c.endOutfitPan(event({type:"pointerup"}));c.startOutfitPan(event({pointerType:"touch"}));c.moveOutfitPan(event({pointerType:"touch",clientX:200,clientY:125}));assert.equal(c.imageOffsetX,-12.5);assert.equal(c.imageOffsetY,14);assert.ok(c.outfitPan);
});

test("keyboard positioning, centering, and range limits are predictable",()=>{
  const {context:c,event}=fixture();c.keyOutfitPan(event({key:"ArrowRight"}));assert.equal(c.imageOffsetX,1);
  c.keyOutfitPan(event({key:"ArrowLeft",shiftKey:true}));assert.equal(c.imageOffsetX,-4);
  c.keyOutfitPan(event({key:"ArrowUp"}));assert.equal(c.imageOffsetY,-1);
  c.keyOutfitPan(event({key:"ArrowDown",shiftKey:true}));assert.equal(c.imageOffsetY,4);
  c.keyOutfitPan(event({key:"Home"}));assert.equal(c.imageOffsetX,0);assert.equal(c.imageOffsetY,0);
  c.startOutfitPan(event());c.moveOutfitPan(event({clientX:10000,clientY:10000}));assert.equal(c.imageOffsetX,100);assert.equal(c.imageOffsetY,100);c.moveOutfitPan(event({clientX:-10000,clientY:-10000}));assert.equal(c.imageOffsetX,-100);assert.equal(c.imageOffsetY,-100);
});

test("Full image is read-only and saving stops active positioning",()=>{
  const {context:c,stage,event}=fixture();stage.dataset.panEnabled="false";c.outfitPreviewMode="full";
  c.startOutfitPan(event());c.keyOutfitPan(event({key:"ArrowRight"}));assert.equal(c.imageOffsetX,0);assert.equal(c.outfitPan,null);
  stage.dataset.panEnabled="true";c.outfitPreviewMode="scene";c.startOutfitPan(event());c.busy=true;c.moveOutfitPan(event({clientX:250}));assert.equal(c.imageOffsetX,0);assert.equal(c.outfitPan,null);
});

test("a vertical-only mouse drag changes only the vertical position",()=>{
  const {context:c,event}=fixture();c.startOutfitPan(event());c.moveOutfitPan(event({clientY:140}));c.endOutfitPan(event({type:"pointerup"}));
  assert.equal(c.imageOffsetX,0);assert.equal(c.imageOffsetY,20);
});
