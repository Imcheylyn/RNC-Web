(() => {
  "use strict";

  const svg = document.querySelector("[data-community-graph]");
  const summary = document.querySelector("[data-relationship-count]");
  const empty = document.querySelector("[data-relationship-empty]");
  const legend = document.querySelector("[data-relationship-legend]");
  const board = document.querySelector("[data-board-container]");
  const searchInput = document.querySelector("[data-relationship-search]");
  const typeFilter = document.querySelector("[data-relationship-filter]");
  const fitBtn = document.querySelector("[data-map-fit]");
  const zoomInBtn = document.querySelector("[data-map-zoom-in]");
  const zoomOutBtn = document.querySelector("[data-map-zoom-out]");
  const dossierCard = document.querySelector("[data-dossier-card]");
  const dossierClose = document.querySelector("[data-dossier-close]");

  const NS = "http://www.w3.org/2000/svg";

  const palette = {
    friend: { label: "เพื่อน", color: "#79b9a2" },
    family: { label: "ครอบครัว", color: "#d6ad6a" },
    love: { label: "คนรัก", color: "#df91ac" },
    colleague: { label: "เพื่อนร่วมงาน", color: "#80a8d4" },
    rival: { label: "คู่แข่ง", color: "#b299d6" },
    enemy: { label: "ศัตรู", color: "#d87868" },
    other: { label: "อื่น ๆ", color: "#a6a5a0" }
  };

  let rawData = null;
  let activeFilter = "all";
  let activeSearch = "";
  let selectedNodeId = null;
  let isManualView = false;
  let pan = { x: 0, y: 0, zoom: 1 };
  let pointers = new Map();
  let world = null;
  let cordsLayer = null;
  let nodesLayer = null;
  let pinsLayer = null;
  let boardBounds = null;

  const element = (tag, attrs = {}) => {
    const item = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key, value]) => item.setAttribute(key, String(value)));
    return item;
  };

  // Deterministic Force-Directed Graph Layout with AABB Clearance
  function solveGraphLayout(nodes, edges) {
    const count = nodes.length;
    if (!count) return [];

    const GOLDEN_ANGLE = 2.3999632;
    // Initial Sunflower Placement
    const positions = nodes.map((node, index) => {
      const angle = index * GOLDEN_ANGLE;
      const radius = 90 + 55 * Math.sqrt(index + 1);
      return {
        id: node.id,
        x: Math.round(Math.cos(angle) * radius * 1.3),
        y: Math.round(Math.sin(angle) * radius),
        vx: 0,
        vy: 0
      };
    });

    const indexMap = new Map(nodes.map((item, index) => [item.id, index]));
    const links = edges
      .map(edge => [indexMap.get(edge.sourceId), indexMap.get(edge.targetId)])
      .filter(([a, b]) => a !== undefined && b !== undefined && a !== b);

    const cardW = 104, cardH = 130;
    const reqX = cardW + 36, reqY = cardH + 36;
    const idealSpring = Math.max(180, Math.min(320, 750 / Math.sqrt(Math.max(1, count / 2))));

    const iterations = 80;
    for (let step = 0; step < iterations; step++) {
      const alpha = 1 - step / iterations;

      // 1. Repulsion & Box collision avoidance between all nodes
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const a = positions[i], b = positions[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.max(1, Math.hypot(dx, dy));

          // AABB Box overlap check
          const overlapX = reqX - Math.abs(dx);
          const overlapY = reqY - Math.abs(dy);

          if (overlapX > 0 && overlapY > 0) {
            const pushX = (dx >= 0 ? 1 : -1) * overlapX * 0.45 * alpha;
            const pushY = (dy >= 0 ? 1 : -1) * overlapY * 0.45 * alpha;
            a.vx += pushX; a.vy += pushY;
            b.vx -= pushX; b.vy -= pushY;
          } else if (dist < idealSpring * 1.4) {
            const rep = (idealSpring * idealSpring) / (dist * dist) * 0.7 * alpha;
            const fx = (dx / dist) * rep;
            const fy = (dy / dist) * rep;
            a.vx += fx; a.vy += fy;
            b.vx -= fx; b.vy -= fy;
          }
        }
      }

      // 2. Spring attraction along relationships
      for (const [aIdx, bIdx] of links) {
        const a = positions[aIdx], b = positions[bIdx];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const force = (dist - idealSpring) * 0.015 * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }

      // 3. Center gravity & velocity dampening
      for (let i = 0; i < count; i++) {
        const p = positions[i];
        p.vx -= p.x * 0.0016;
        p.vy -= p.y * 0.0016;
        p.x += Math.max(-16, Math.min(16, p.vx));
        p.y += Math.max(-16, Math.min(16, p.vy));
        p.vx *= 0.65;
        p.vy *= 0.65;
      }
    }

    return positions.map(p => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y) }));
  }

  function updateTransform() {
    if (world) {
      world.setAttribute("transform", `translate(${pan.x} ${pan.y}) scale(${pan.zoom})`);
    }
  }

  function getBoardBounds(positions) {
    if (!positions || !positions.length) {
      return { width: 800, height: 600, centerX: 0, centerY: 0 };
    }
    const pad = 90;
    const left = Math.min(...positions.map(p => p.x)) - pad;
    const right = Math.max(...positions.map(p => p.x)) + pad;
    const top = Math.min(...positions.map(p => p.y)) - pad;
    const bottom = Math.max(...positions.map(p => p.y)) + pad;
    const width = Math.max(100, right - left);
    const height = Math.max(100, bottom - top);
    return {
      left, right, top, bottom,
      width, height,
      centerX: (left + right) / 2,
      centerY: (top + bottom) / 2
    };
  }

  function syncViewport() {
    const rect = svg.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      svg.setAttribute("viewBox", `${-rect.width / 2} ${-rect.height / 2} ${rect.width} ${rect.height}`);
    }
  }

  function fitViewport() {
    if (!svg || !boardBounds) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 80) return;

    const isSmall = rect.width < 640;
    const pad = isSmall ? Math.max(12, Math.min(24, rect.width * 0.05)) : 50;
    const availW = Math.max(80, rect.width - pad * 2);
    const availH = Math.max(80, rect.height - pad * 2);
    const scale = Math.min(availW / boardBounds.width, availH / boardBounds.height);
    // Keep case files readable on phones; larger maps can be explored by dragging.
    const nodeCount = (rawData?.characters || []).length;
    const minZoom = isSmall ? (nodeCount <= 20 ? 0.7 : 0.56) : 0.35;
    const zoom = Math.max(minZoom, Math.min(1.2, scale));

    pan = {
      x: -boardBounds.centerX * zoom,
      y: -boardBounds.centerY * zoom,
      zoom
    };
    isManualView = false;
    updateTransform();
  }

  function svgPoint(clientX, clientY) {
    const matrix = svg.getScreenCTM();
    return matrix ? new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
  }

  function zoomAt(clientX, clientY, targetZoom) {
    isManualView = true;
    const p = svgPoint(clientX, clientY);
    const nextZoom = Math.max(0.25, Math.min(2.5, targetZoom));
    const factor = nextZoom / pan.zoom;
    pan.x = p.x - (p.x - pan.x) * factor;
    pan.y = p.y - (p.y - pan.y) * factor;
    pan.zoom = nextZoom;
    updateTransform();
  }

  // Highlight connections for a specific character
  function highlightCharacter(charId) {
    if (!rawData) return;
    const allEdges = svg.querySelectorAll("[data-edge-key]");
    const allNodes = svg.querySelectorAll("[data-node-id]");
    const allPins = svg.querySelectorAll("[data-pin-id]");

    if (!charId) {
      allEdges.forEach(el => el.classList.remove("is-dimmed", "is-highlighted"));
      allNodes.forEach(el => el.classList.remove("is-dimmed", "is-highlighted"));
      allPins.forEach(el => el.classList.remove("is-dimmed"));
      return;
    }

    const connectedNodeIds = new Set([charId]);
    rawData.relationships.forEach(rel => {
      if (rel.sourceId === charId) connectedNodeIds.add(rel.targetId);
      if (rel.targetId === charId) connectedNodeIds.add(rel.sourceId);
    });

    allNodes.forEach(nodeEl => {
      const id = nodeEl.dataset.nodeId;
      if (connectedNodeIds.has(id)) {
        nodeEl.classList.add("is-highlighted");
        nodeEl.classList.remove("is-dimmed");
      } else {
        nodeEl.classList.add("is-dimmed");
        nodeEl.classList.remove("is-highlighted");
      }
    });

    allPins.forEach(pinEl => {
      const id = pinEl.dataset.pinId;
      pinEl.classList.toggle("is-dimmed", !connectedNodeIds.has(id));
    });

    allEdges.forEach(edgeEl => {
      const [s, t] = (edgeEl.dataset.edgeKey || "").split("::");
      const isRelated = s === charId || t === charId;
      edgeEl.classList.toggle("is-highlighted", isRelated);
      edgeEl.classList.toggle("is-dimmed", !isRelated);
    });
  }

  // Open Dossier Panel
  function showDossier(character) {
    if (!dossierCard || !rawData) return;
    selectedNodeId = character.id;
    highlightCharacter(character.id);

    // Update active node styling
    svg.querySelectorAll(".community-case-node").forEach(n => {
      n.classList.toggle("is-selected", n.dataset.nodeId === character.id);
    });

    const photoImg = dossierCard.querySelector("[data-dossier-image]");
    const nameEl = dossierCard.querySelector("[data-dossier-name]");
    const typeEl = dossierCard.querySelector("[data-dossier-type]");
    const linkEl = dossierCard.querySelector("[data-dossier-link]");
    const countEl = dossierCard.querySelector("[data-dossier-relation-count]");
    const listEl = dossierCard.querySelector("[data-dossier-relations]");

    nameEl.textContent = character.name;
    typeEl.textContent = character.characterType || "Character";
    if (character.image) {
      photoImg.src = character.image;
      photoImg.hidden = false;
    } else {
      photoImg.hidden = true;
    }
    linkEl.href = `/community/rnc/character?id=${encodeURIComponent(character.id)}`;

    // Build connections list
    const nodeMap = new Map(rawData.characters.map(c => [c.id, c]));
    const connections = [];

    rawData.relationships.forEach(rel => {
      if (rel.sourceId === character.id) {
        const partner = nodeMap.get(rel.targetId);
        if (partner) connections.push({ rel, partner, isOutgoing: true });
      } else if (rel.targetId === character.id) {
        const partner = nodeMap.get(rel.sourceId);
        if (partner) connections.push({ rel, partner, isOutgoing: false });
      }
    });

    countEl.textContent = String(connections.length);
    listEl.replaceChildren();

    if (!connections.length) {
      const emptyLi = document.createElement("li");
      emptyLi.className = "dossier-relation-item";
      emptyLi.textContent = "ยังไม่มีบันทึกสายสัมพันธ์ของบุคคลนี้";
      listEl.append(emptyLi);
    } else {
      connections.forEach(({ rel, partner, isOutgoing }) => {
        const li = document.createElement("li");
        li.className = "dossier-relation-item";

        const partnerLink = document.createElement("a");
        partnerLink.className = "dossier-relation-partner";
        partnerLink.textContent = partner.name;
        partnerLink.href = "#";
        partnerLink.addEventListener("click", ev => {
          ev.preventDefault();
          showDossier(partner);
        });

        const badge = document.createElement("span");
        badge.className = "dossier-relation-badge";
        const info = palette[rel.type] || palette.other;
        badge.style.setProperty("--badge-color", info.color);
        badge.textContent = rel.label || info.label;

        li.append(partnerLink, badge);
        listEl.append(li);
      });
    }

    dossierCard.hidden = false;
  }

  function closeDossier() {
    selectedNodeId = null;
    highlightCharacter(null);
    svg.querySelectorAll(".community-case-node").forEach(n => n.classList.remove("is-selected"));
    if (dossierCard) dossierCard.hidden = true;
  }

  // Render the entire network
  function render() {
    if (!rawData) return;
    const allNodes = rawData.characters || [];
    let allEdges = rawData.relationships || [];

    // Filter by relationship type
    if (activeFilter !== "all") {
      allEdges = allEdges.filter(e => e.type === activeFilter);
    }

    // Filter by character search query
    let filteredNodes = allNodes;
    if (activeSearch.trim()) {
      const query = activeSearch.trim().toLowerCase();
      filteredNodes = allNodes.filter(c => c.name.toLowerCase().includes(query));
    }

    // Summary count
    summary.textContent = `${allNodes.length} DOSSIERS · ${allEdges.length} RELATIONSHIPS`;

    // Render legend
    legend.replaceChildren();
    Object.entries(palette).forEach(([key, info]) => {
      const li = document.createElement("li");
      const dot = document.createElement("i");
      dot.style.setProperty("--relation-color", info.color);
      li.append(dot, document.createTextNode(info.label));
      legend.append(li);
    });

    if (!allNodes.length) {
      empty.hidden = false;
      svg.replaceChildren();
      return;
    }
    empty.hidden = true;

    // Viewport SVG coordinates
    syncViewport();

    svg.replaceChildren();

    // Defs (Pins gradient & filters)
    const defs = element("defs");
    const pinGrad = element("radialGradient", {
      id: "communityPin",
      cx: "34%", cy: "28%", r: "75%"
    });
    [
      ["0%", "#f5c5a2"],
      ["30%", "#d06a4a"],
      ["66%", "#9c402d"],
      ["100%", "#5a271d"]
    ].forEach(([offset, color]) => {
      pinGrad.append(element("stop", { offset, "stop-color": color }));
    });
    defs.append(pinGrad);
    svg.append(defs);

    // Calculate layout
    const positions = solveGraphLayout(allNodes, allEdges);
    const posMap = new Map(positions.map(p => [p.id, p]));
    boardBounds = getBoardBounds(positions);

    // World root group
    world = element("g", { class: "community-world" });
    cordsLayer = element("g", { class: "community-cords-layer" });
    nodesLayer = element("g", { class: "community-nodes-layer" });
    pinsLayer = element("g", { class: "community-pins-layer" });
    world.append(cordsLayer, nodesLayer, pinsLayer);
    svg.append(world);

    // Group multiple edges between same pair
    const groupedEdges = new Map();
    allEdges.forEach(edge => {
      const pairKey = [edge.sourceId, edge.targetId].sort().join("::");
      const list = groupedEdges.get(pairKey) || [];
      list.push(edge);
      groupedEdges.set(pairKey, list);
    });

    // Draw Cords
    groupedEdges.forEach((group, pairKey) => {
      group.forEach((edge, idx) => {
        const from = posMap.get(edge.sourceId);
        const to = posMap.get(edge.targetId);
        if (!from || !to) return;

        const dx = to.x - from.x, dy = to.y - from.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        const normal = { x: -dy / length, y: dx / length };

        // Archival gravity sag + lane offset for multiple relations
        const laneOffset = (idx - (group.length - 1) / 2) * 24;
        const slack = Math.max(25, Math.min(80, length * 0.16));
        const ctrlX = (from.x + to.x) / 2 + normal.x * laneOffset;
        const ctrlY = (from.y + to.y) / 2 + slack + normal.y * laneOffset;

        const pathD = `M ${from.x} ${from.y - 48} Q ${ctrlX} ${ctrlY} ${to.x} ${to.y - 48}`;
        const info = palette[edge.type] || palette.other;

        const cordGroup = element("g", { "data-edge-key": pairKey });

        // Shadow & Outline
        cordGroup.append(
          element("path", { d: pathD, class: "community-cord-shadow" }),
          element("path", { d: pathD, class: "community-cord-outline" })
        );

        // Main colored string
        const mainLine = element("path", {
          d: pathD,
          class: "community-cord-line",
          stroke: info.color
        });
        const hitLine = element("path", {
          d: pathD,
          class: "community-cord-hit"
        });

        const chooseEdge = ev => {
          ev.stopPropagation();
          const sourceChar = allNodes.find(c => c.id === edge.sourceId);
          if (sourceChar) showDossier(sourceChar);
        };
        hitLine.addEventListener("click", chooseEdge);
        mainLine.addEventListener("click", chooseEdge);

        cordGroup.append(mainLine, hitLine);

        // Paper Tag Label
        if (edge.label || group.length > 1) {
          const text = edge.label || info.label;
          // Curve point at t = 0.5
          const tagX = 0.25 * from.x + 0.5 * ctrlX + 0.25 * to.x;
          const tagY = 0.25 * (from.y - 48) + 0.5 * ctrlY + 0.25 * (to.y - 48);
          const tagW = Math.min(100, Math.max(34, text.length * 9 + 14));
          const tagH = 18;

          const foreign = element("foreignObject", {
            x: tagX - tagW / 2,
            y: tagY - tagH / 2,
            width: tagW,
            height: tagH,
            class: "community-thread-label"
          });
          const tagSpan = document.createElement("span");
          tagSpan.className = "community-thread-tag";
          tagSpan.textContent = text;
          foreign.style.setProperty("--tag-tilt", (idx % 2 ? 3 : -3) + "deg");
          tagSpan.title = text;
          tagSpan.addEventListener("click", chooseEdge);

          foreign.append(tagSpan);
          foreign.style.pointerEvents = "none";
          const labelHit = element("rect", { x: tagX - tagW / 2, y: tagY - tagH / 2, width: tagW, height: tagH, fill: "transparent", class: "community-thread-label", "aria-hidden": "true" });
          labelHit.style.setProperty("--tag-tilt", foreign.style.getPropertyValue("--tag-tilt"));
          labelHit.style.pointerEvents = "all";
          labelHit.addEventListener("click", chooseEdge);
          cordGroup.append(labelHit, foreign);
        }

        cordsLayer.append(cordGroup);
      });
    });

    // Draw Character Polaroid Nodes
    allNodes.forEach((char, index) => {
      const pos = posMap.get(char.id);
      if (!pos) return;

      const nodeGroup = element("g", {
        class: "community-case-node",
        transform: `translate(${pos.x} ${pos.y})`,
        "data-node-id": char.id,
        role: "button",
        tabindex: "0",
        "aria-label": `แฟ้มตัวละคร: ${char.name}`
      });

      const cardW = 96, cardH = 122;
      const foreign = element("foreignObject", {
        x: -cardW / 2,
        y: -cardH / 2,
        width: cardW,
        height: cardH
      });

      const cardBox = document.createElement("div");
      cardBox.className = "community-card-box";
      const tiltDeg = ((index % 5) - 2) * 1.2;
      foreign.style.setProperty("--case-tilt", `${tiltDeg}deg`);

      // Photo
      const photoBox = document.createElement("div");
      photoBox.className = "community-card-photo";
      if (char.image) {
        const img = document.createElement("img");
        img.src = char.image;
        img.alt = char.name;
        img.loading = "lazy";
        photoBox.append(img);
      } else {
        const initial = document.createElement("span");
        initial.className = "community-card-avatar-fallback";
        initial.textContent = (char.name || "✦").slice(0, 1);
        photoBox.append(initial);
      }

      // Name & type
      const infoBox = document.createElement("div");
      infoBox.className = "community-card-info";
      const nameEl = document.createElement("strong");
      nameEl.textContent = char.name;
      nameEl.title = char.name;
      const typeEl = document.createElement("span");
      typeEl.textContent = char.characterType || "Character";
      infoBox.append(nameEl, typeEl);

      cardBox.append(photoBox, infoBox);
      foreign.append(cardBox);
      foreign.style.pointerEvents = "none";
      nodeGroup.append(element("rect", { x: -cardW / 2, y: -cardH / 2, width: cardW, height: cardH, fill: "transparent", "pointer-events": "all", "aria-hidden": "true" }), foreign);

      // Node Event Listeners
      nodeGroup.addEventListener("mouseenter", () => {
        if (!selectedNodeId) highlightCharacter(char.id);
      });
      nodeGroup.addEventListener("mouseleave", () => {
        if (!selectedNodeId) highlightCharacter(null);
      });
      const onSelect = ev => {
        ev.stopPropagation();
        showDossier(char);
      };
      nodeGroup.addEventListener("click", onSelect);
      nodeGroup.addEventListener("keydown", ev => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          onSelect(ev);
        }
      });

      nodesLayer.append(nodeGroup);

      // Bronze / lacquer push-pin on top of card
      const pin = element("circle", {
        cx: pos.x,
        cy: pos.y - 56,
        r: 5.5,
        fill: "url(#communityPin)",
        "data-pin-id": char.id
      });
      pinsLayer.append(pin);
    });

    if (!isManualView) {
      fitViewport();
    } else {
      updateTransform();
    }
  }

  // Pointer panning & zoom handlers
  function bindBoardControls() {
    if (!svg || !board) return;

    svg.addEventListener("wheel", ev => {
      ev.preventDefault();
      zoomAt(ev.clientX, ev.clientY, pan.zoom * Math.exp(-ev.deltaY * 0.0015));
    }, { passive: false });

    svg.addEventListener("pointerdown", ev => {
      if (ev.target.closest(".community-case-node, .community-cord-line, .community-thread-label") || ev.button > 0) {
        return;
      }
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      svg.setPointerCapture(ev.pointerId);
      board.classList.add("is-panning");
    });

    svg.addEventListener("pointermove", ev => {
      if (!pointers.has(ev.pointerId)) return;
      const previousPoints = [...pointers.values()];
      const prev = pointers.get(ev.pointerId);
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

      if (pointers.size === 1) {
        isManualView = true;
        const before = svgPoint(prev.x, prev.y);
        const after = svgPoint(ev.clientX, ev.clientY);
        pan.x += after.x - before.x;
        pan.y += after.y - before.y;
        updateTransform();
      } else if (pointers.size === 2) {
        const pts = [...pointers.values()];
        const oldDist = Math.hypot(previousPoints[1].x - previousPoints[0].x, previousPoints[1].y - previousPoints[0].y);
        const newDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        if (oldDist > 0) {
          zoomAt((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2, pan.zoom * (newDist / oldDist));
        }
      }
    });

    const endPan = ev => {
      pointers.delete(ev.pointerId);
      if (!pointers.size) board.classList.remove("is-panning");
    };
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(type => svg.addEventListener(type, endPan));

    // Deselect dossier on clicking empty board
    svg.addEventListener("click", ev => {
      if (!ev.target.closest(".community-case-node, .community-dossier-card, .community-cord-line, .community-thread-label")) {
        closeDossier();
      }
    });

    // Toolbar buttons
    fitBtn?.addEventListener("click", () => {
      isManualView = false;
      fitViewport();
    });
    zoomInBtn?.addEventListener("click", () => {
      isManualView = true;
      const rect = svg.getBoundingClientRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, pan.zoom * 1.25);
    });
    zoomOutBtn?.addEventListener("click", () => {
      isManualView = true;
      const rect = svg.getBoundingClientRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, pan.zoom / 1.25);
    });

    // Search input
    let searchDebounce = 0;
    searchInput?.addEventListener("input", ev => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        activeSearch = ev.target.value;
        render();
      }, 200);
    });

    // Type filter
    typeFilter?.addEventListener("change", ev => {
      activeFilter = ev.target.value;
      render();
    });

    // Dossier close
    dossierClose?.addEventListener("click", closeDossier);

    // Resize observer
    let resizeTimer = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(resizeTimer);
      resizeTimer = requestAnimationFrame(() => {
        syncViewport();
        if (!isManualView) fitViewport();
        else updateTransform();
      });
    }).observe(board);
  }

  // Load from API
  async function load() {
    try {
      summary.textContent = "กำลังอ่านแฟ้มสายสัมพันธ์…";
      const response = await fetch("/api/community/characters?view=relationships", {
        credentials: "same-origin",
        cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "โหลดความสัมพันธ์ไม่สำเร็จ");
      rawData = data;
      render();
    } catch (error) {
      summary.textContent = "เชื่อมต่อแฟ้มไม่สำเร็จ";
      empty.querySelector("h3").textContent = "โหลดแผนผังไม่สำเร็จ";
      empty.querySelector("p").textContent = error.message;
      empty.hidden = false;
    }
  }

  bindBoardControls();
  load();
})();
