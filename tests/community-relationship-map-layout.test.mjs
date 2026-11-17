import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context={window:{}};vm.runInNewContext(readFileSync(new URL('../public/community/rnc/relationship-map-layout.js',import.meta.url),'utf8'),context);const layout=context.window.RNCRelationshipThreadLayout;
function cards(x,y){return [{x:-109,y:-152,width:218,height:304},{x:x-100,y:y-137,width:200,height:274}];}
test('reciprocal labels stay on their own curve without overlapping each other or either portrait',()=>{
 for(const [x,y] of [[-265,-170],[265,-170],[-275,190],[275,190],[0,500],[0,-480],[260,-45]]){
  const obstacles=cards(x,y),tracks=layout.layout({x,y,reciprocal:true,labels:[{direction:'outgoing',width:42},{direction:'incoming',width:58}],obstacles});assert.equal(tracks.length,2);
  for(const track of tracks){const p=layout.point(track.curve,track.label.t);assert.ok(Math.abs(p.x-track.label.x)<1e-8);assert.ok(Math.abs(p.y-track.label.y)<1e-8);assert.ok(!obstacles.some(card=>layout.overlaps(track.label.bounds,card)),JSON.stringify({x,y,direction:track.direction}));}
  assert.equal(layout.overlaps(tracks[0].label.bounds,tracks[1].label.bounds),false,JSON.stringify({x,y}));
 }
});
test('long reciprocal labels also clear portraits and retain the correct direction',()=>{
 for(const [x,y] of [[-265,-170],[265,-170],[0,500],[260,-45]]){const obstacles=cards(x,y),tracks=layout.layout({x,y,reciprocal:true,labels:[{direction:'outgoing',width:126},{direction:'incoming',width:126}],obstacles});assert.equal(tracks[0].direction,'outgoing');assert.equal(tracks[1].direction,'incoming');assert.ok(!layout.overlaps(tracks[0].label.bounds,tracks[1].label.bounds));for(const track of tracks)assert.ok(!obstacles.some(card=>layout.overlaps(card,track.label.bounds)),JSON.stringify({x,y,direction:track.direction}));}
});
test('filtering to one direction and zooming keep label anchors attached to that curve',()=>{
 const [track]=layout.layout({x:-265,y:-170,labels:[{direction:'incoming',width:54}],obstacles:cards(-265,-170)});assert.equal(track.direction,'incoming');
 for(const zoom of [.25,.5,1,2.5]){const transform=p=>({x:p.x*zoom+35,y:p.y*zoom-18}),curve={start:transform(track.curve.start),control:transform(track.curve.control),end:transform(track.curve.end)},p=layout.point(curve,track.label.t),expected=transform(track.label);assert.ok(Math.abs(p.x-expected.x)<1e-8);assert.ok(Math.abs(p.y-expected.y)<1e-8);}
});
test('labels from neighboring relationships reserve their occupied space',()=>{
 const positions=[[-265,-170],[265,-170],[-275,190],[275,190]],obstacles=[{x:-109,y:-152,width:218,height:304},...positions.map(([x,y])=>({x:x-100,y:y-137,width:200,height:274}))],occupied=[];
 positions.forEach(([x,y],index)=>{const tracks=layout.layout({x,y,index,reciprocal:true,labels:[{direction:'outgoing',width:48},{direction:'incoming',width:60}],obstacles,occupied});for(const track of tracks){assert.ok(!occupied.some(other=>layout.overlaps(track.label.bounds,other)));occupied.push(track.label.bounds);}});
});

test('incoming-only filter preserves the incoming lane of a reciprocal relationship',()=>{
 const obstacles=cards(-265,-170);
 const [track]=layout.layout({x:-265,y:-170,reciprocal:true,labels:[{direction:'incoming',width:58}],obstacles});
 assert.equal(track.direction,'incoming');
 const anchor=layout.point(track.curve,track.label.t);
 assert.equal(anchor.x,track.label.x);
 assert.equal(anchor.y,track.label.y);
 assert.ok(!obstacles.some(card=>layout.overlaps(card,track.label.bounds)));
});

test('both perspectives terminate on the same photograph pins',()=>{
 const tracks=layout.layout({x:-265,y:-170,reciprocal:true,labels:[{direction:'outgoing',width:42},{direction:'incoming',width:58}],obstacles:cards(-265,-170)});
 for(const {curve} of tracks){
  assert.equal(curve.start.x,0);assert.equal(curve.start.y,layout.pins.primary);
  assert.equal(curve.end.x,-265);assert.equal(curve.end.y,-170+layout.pins.secondary);
 }
});

test('standard cords sag with gravity while retaining both pin endpoints',()=>{
 for(const [x,y] of [[-265,-170],[265,-170],[260,-45],[0,500]]){
  const tracks=layout.layout({x,y,reciprocal:true,labels:[{direction:'outgoing',width:42},{direction:'incoming',width:58}]});
  for(const {curve} of tracks){
   const middle=layout.point(curve,.5);
   assert.ok(middle.y>(curve.start.y+curve.end.y)/2,JSON.stringify({x,y}));
  }
 }
});

test('woven fibers remain continuous, finite and close to the main cord',()=>{
 const [track]=layout.layout({x:265,y:-170,labels:[{direction:'outgoing',width:42}]});
 const strands=layout.fibers(track.curve);
 assert.equal(strands.length,2);
 for(const strand of strands){
  assert.equal((strand.match(/M /g)||[]).length,1);
  assert.ok(!strand.includes('NaN'));
  const coordinates=[...strand.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/g)].map(match=>({x:Number(match[1]),y:Number(match[2])}));
  coordinates.forEach((p,index)=>{
   const center=layout.point(track.curve,index/(coordinates.length-1));
   assert.ok(Math.hypot(p.x-center.x,p.y-center.y)<.66);
  });
 }
});

test('layoutPeople organically distributes 1, 4, 8, 9, 15, 30, and 50 characters without card overlap',()=>{
  const primary = { x: 0, y: 0, width: 236, height: 326 };
  const cardW = 212, cardH = 290;

  for (const count of [1, 4, 8, 9, 15, 30, 50]) {
    const chars = Array.from({ length: count }, (_, i) => ({ id: 'agent-char-' + (i + 1) }));
    const positions = layout.layoutPeople(chars);
    assert.equal(positions.length, count);

    // Verify alias placeNodes works identically
    const aliasPositions = layout.placeNodes(chars);
    assert.deepEqual(positions, aliasPositions);

    // Verify no card overlaps primary card at (0, 0)
    for (const card of positions) {
      const overlapX = (primary.width + cardW) / 2 - Math.abs(card.x - primary.x);
      const overlapY = (primary.height + cardH) / 2 - Math.abs(card.y - primary.y);
      assert.ok(overlapX <= 0 || overlapY <= 0, `Card ${card.id} overlaps primary card at count ${count}`);
    }

    // Verify no cards overlap each other
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i];
        const b = positions[j];
        const overlapX = cardW - Math.abs(a.x - b.x);
        const overlapY = cardH - Math.abs(a.y - b.y);
        assert.ok(overlapX <= 0 || overlapY <= 0, `Cards ${a.id} and ${b.id} overlap at count ${count}`);
      }
    }
  }
});

test('layoutPeople is deterministic and stable when adding characters',()=>{
  const chars4 = Array.from({ length: 4 }, (_, i) => ({ id: 'stable-char-' + (i + 1) }));
  const run1 = layout.layoutPeople(chars4);
  const run2 = layout.layoutPeople(chars4);
  assert.deepEqual(run1, run2, 'Identical input must produce identical positions');

  // Adding a 5th character with existing positions preserves positions of first 4
  const existing = {};
  run1.forEach(c => { existing[c.id] = { x: c.x, y: c.y }; });

  const chars5 = [...chars4, { id: 'stable-char-5' }];
  const runWith5 = layout.layoutPeople(chars5, { existing });

  for (const c of run1) {
    const updated = runWith5.find(item => item.id === c.id);
    assert.ok(updated, `Card ${c.id} should exist in updated layout`);
    const drift = Math.hypot(updated.x - c.x, updated.y - c.y);
    assert.ok(drift < 25, `Card ${c.id} should remain stable (drift was ${drift}px)`);
  }
});
