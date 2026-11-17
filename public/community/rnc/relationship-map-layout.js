(function (root) {
  "use strict";
  const pins=Object.freeze({primary:-146,secondary:-128});
  // Labels use a point on the quadratic curve, not its off-curve control point.
  function point(curve,t) {
    const u=1-t;
    return {x:u*u*curve.start.x+2*u*t*curve.control.x+t*t*curve.end.x,y:u*u*curve.start.y+2*u*t*curve.control.y+t*t*curve.end.y};
  }
  function overlaps(a,b) { return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y; }
  function overlapArea(a,b) { return Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)); }
  function curveFor(x,y,bend) {
    const dx=x,dy=y+pins.secondary-pins.primary,length=Math.max(1,Math.hypot(dx,dy)),normal={x:-dy/length,y:dx/length};
    const start={x:0,y:pins.primary},end={x,y:y+pins.secondary};
    // Gravity gives every cord some slack; reciprocal lanes still share the same pins.
    const slack=Math.max(46,Math.min(145,length*.29));
    return {start,end,control:{x:(start.x+end.x)/2+normal.x*bend,y:(start.y+end.y)/2+slack+normal.y*bend}};
  }
  // Two fine continuous strands suggest cotton twist without raster textures or animation.
  function fibers(curve) {
    const estimate=Math.hypot(curve.control.x-curve.start.x,curve.control.y-curve.start.y)+Math.hypot(curve.end.x-curve.control.x,curve.end.y-curve.control.y);
    const steps=Math.max(16,Math.ceil(estimate/2)),paths=[[],[]];
    let previous=curve.start,distance=0;
    for(let step=0;step<=steps;step++) {
      const t=step/steps,center=point(curve,t);
      distance+=Math.hypot(center.x-previous.x,center.y-previous.y);previous=center;
      const dx=2*((1-t)*(curve.control.x-curve.start.x)+t*(curve.end.x-curve.control.x));
      const dy=2*((1-t)*(curve.control.y-curve.start.y)+t*(curve.end.y-curve.control.y));
      const length=Math.max(1,Math.hypot(dx,dy)),twist=Math.sin(distance*Math.PI/3.4)*.64;
      for(let strand=0;strand<2;strand++) {
        const offset=twist*(strand?-1:1),x=center.x-dy/length*offset,y=center.y+dx/length*offset;
        paths[strand].push((step?'L ':'M ')+x.toFixed(2)+' '+y.toFixed(2));
      }
    }
    return paths.map(points=>points.join(' '));
  }
  function bounds(center,width,height) { return {x:center.x-width/2-4,y:center.y-height/2-4,width:width+8,height:height+8}; }
  function layout({x,y,reciprocal=false,index=0,labels,obstacles=[],occupied=[]}) {
    const taken=occupied.slice(),result=[];
    for(const label of labels) {
      // Keep reciprocal labels on separate lanes and stagger their preferred anchors.
      const side=label.direction==="incoming"?1:-1,preferred=reciprocal?(side<0?.38:.64):.5;
      const width=label.width,height=label.height||22,sign=reciprocal?side:(index%2?1:-1);
      const bends=reciprocal?[44,80,120,180,260,-80,-140,-220]:[5,60,120,-60,-120];
      let selected=null,fallback=null;
      for(const amount of bends) {
        const curve=curveFor(x,y,amount*sign),candidates=[];
        for(let step=4;step<=76;step++) {
          const t=step/80,center=point(curve,t),rect=bounds(center,width,height);
          const collisions=obstacles.filter(item=>overlaps(rect,item)),tags=taken.filter(item=>overlaps(rect,item));
          const candidate={direction:label.direction,curve,label:{x:center.x,y:center.y,width,height,t,bounds:rect},score:Math.abs(t-preferred)};
          if(!collisions.length&&!tags.length)candidates.push(candidate);
          else {
            candidate.overlap=collisions.reduce((sum,item)=>sum+overlapArea(rect,item)*4,0)+tags.reduce((sum,item)=>sum+overlapArea(rect,item),0);
            if(!fallback||candidate.overlap<fallback.overlap||(candidate.overlap===fallback.overlap&&candidate.score<fallback.score))fallback=candidate;
          }
        }
        if(candidates.length){candidates.sort((a,b)=>a.score-b.score);selected=candidates[0];break;}
      }
      // Crowded boards may have no clear space: minimize overlap without detaching the tag.
      const placed=selected||fallback;
      if(placed){const c=placed.curve;placed.d="M "+c.start.x+" "+c.start.y+" Q "+c.control.x+" "+c.control.y+" "+c.end.x+" "+c.end.y;taken.push(placed.label.bounds);result.push(placed);}
    }
    return result;
  }
  // Deterministic Organic Layout:
  // Places connected characters in expanding organic shells around the primary character at (0, 0),
  // resolving AABB card collisions with iterative relaxation while maintaining ID-based determinism and stability.
  function hashId(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0);
  }

  function layoutPeople(characters, options = {}) {
    if (!Array.isArray(characters) || !characters.length) return [];
    const primary = Object.assign({ x: 0, y: 0, width: 236, height: 326 }, options.primaryCard);
    const cardW = (options.card && options.card.width) || 212;
    const cardH = (options.card && options.card.height) || 290;
    const gapX = options.gapX !== undefined ? options.gapX : 36;
    const gapY = options.gapY !== undefined ? options.gapY : 32;
    const existing = options.existing || {};

    if (characters.length === 1) {
      const item = characters[0];
      const id = typeof item === "string" ? item : (item.id || (item.person && item.person.id) || "0");
      return [{ id, x: 265, y: -45 }];
    }

    const tierCaps = [6, 10, 14, 20];
    const tierRx = [320, 590, 860, 1140];
    const tierRy = [250, 480, 710, 950];
    const tierPhases = [-0.65, 0.25, -0.4, 0.3];

    function getSlot(index) {
      let acc = 0;
      for (let t = 0; t < tierCaps.length; t++) {
        const cap = tierCaps[t];
        if (index < acc + cap) {
          return { tier: t, indexInTier: index - acc, cap };
        }
        acc += cap;
      }
      return { tier: tierCaps.length, indexInTier: index - acc, cap: 24 };
    }

    const tier0Count = Math.min(characters.length, 6);

    const nodes = characters.map((item, i) => {
      const id = typeof item === "string" ? item : (item.id || (item.person && item.person.id) || String(i));
      if (existing[id] && typeof existing[id].x === "number" && typeof existing[id].y === "number") {
        return { id, x: existing[id].x, y: existing[id].y, hasAnchor: true };
      }
      const h = hashId(id || String(i));
      const jitterAngle = ((h % 1000) / 1000 - 0.5) * 0.16;
      const jitterR = ((Math.floor(h / 1000) % 1000) / 1000 - 0.5) * 20;

      let rx, ry, baseAngle;
      if (i < 6) {
        rx = tierRx[0] + jitterR;
        ry = tierRy[0] + jitterR * 0.8;
        const count = tier0Count;
        const startAngle = count === 4 ? -Math.PI * 0.7 : tierPhases[0];
        baseAngle = startAngle + (i / count) * (Math.PI * 2) + jitterAngle;
      } else {
        const slot = getSlot(i);
        const t = Math.min(slot.tier, tierCaps.length - 1);
        rx = (tierRx[t] || (1140 + (t - 3) * 280)) + jitterR;
        ry = (tierRy[t] || (950 + (t - 3) * 240)) + jitterR * 0.8;
        const cap = slot.cap;
        const phase = tierPhases[t] || 0;
        baseAngle = phase + (slot.indexInTier / cap) * (Math.PI * 2) + jitterAngle;
      }

      const x = Math.round(rx * Math.cos(baseAngle));
      const y = Math.round(ry * Math.sin(baseAngle));
      return { id, x, y, hasAnchor: false };
    });

    const iterations = 60;
    for (let it = 0; it < iterations; it++) {
      const alpha = 1 - it / iterations;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        let fx = 0, fy = 0;

        if (a.hasAnchor && existing[a.id]) {
          fx += (existing[a.id].x - a.x) * 0.2;
          fy += (existing[a.id].y - a.y) * 0.2;
        }

        // Repulsion from primary card at (0, 0)
        const pReqX = (primary.width + cardW) / 2 + gapX;
        const pReqY = (primary.height + cardH) / 2 + gapY;
        const pDx = a.x - primary.x;
        const pDy = a.y - primary.y;
        const pOverlapX = pReqX - Math.abs(pDx);
        const pOverlapY = pReqY - Math.abs(pDy);
        if (pOverlapX > 0 && pOverlapY > 0) {
          if (pOverlapX / pReqX < pOverlapY / pReqY) {
            fx += (pDx >= 0 ? 1 : -1) * pOverlapX * 0.7;
          } else {
            fy += (pDy >= 0 ? 1 : -1) * pOverlapY * 0.7;
          }
        }

        // Collision avoidance & proximity repulsion between cards
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const b = nodes[j];
          const reqX = cardW + gapX;
          const reqY = cardH + gapY;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const overlapX = reqX - Math.abs(dx);
          const overlapY = reqY - Math.abs(dy);

          if (overlapX > 0 && overlapY > 0) {
            const signX = (dx > 0 || (dx === 0 && i > j)) ? 1 : -1;
            const signY = (dy > 0 || (dy === 0 && i < j)) ? 1 : -1;
            if (overlapX / reqX < overlapY / reqY) {
              fx += signX * overlapX * 0.55;
            } else {
              fy += signY * overlapY * 0.55;
            }
          } else {
            const dist = Math.hypot(dx / 1.25, dy);
            if (dist > 0 && dist < 360) {
              const rep = ((360 - dist) / 360) * 8;
              fx += (dx / dist) * rep;
              fy += (dy / dist) * rep;
            }
          }
        }

        a.x += fx * alpha;
        a.y += fy * alpha;
      }
    }

    return nodes.map(n => ({ id: n.id, x: Math.round(n.x), y: Math.round(n.y) }));
  }

  root.RNCRelationshipThreadLayout=Object.freeze({point,overlaps,layout,pins,fibers,layoutPeople,placeNodes:layoutPeople});
})(typeof window!=="undefined"?window:globalThis);
