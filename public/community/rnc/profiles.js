// Character archive UI backed by Community records and Staff display settings.
const ARCANA_ICONS = {
  NATURAL: "Neutral.png",
  BEAST: "Beast.png",
  PLANT: "Plant.png",
  STAR: "Star.png",
  MINERAL: "Mineral.png",
  SPIRIT: "Spirit.png",
  INTELLECT: "Intel.png",
  UNKNOWN: "Unknown.png",
};
const ARCANA_TONES = {
  NATURAL:   { hover: "rgba(138, 129, 135, .66)" },
  BEAST:     { hover: "rgba(174, 43, 51, .68)" },
  PLANT:     { hover: "rgba(35, 112, 60, .68)" },
  STAR:      { hover: "rgba(59, 111, 165, .7)" },
  MINERAL:   { hover: "rgba(129, 94, 50, .7)" },
  SPIRIT:    { hover: "rgba(120, 57, 129, .7)" },
  INTELLECT: { hover: "rgba(137, 122, 48, .7)" },
  UNKNOWN:   { hover: "rgba(163, 164, 172, .7)" },
};
const FRAME_STYLES = window.__RNC_BOOTSTRAP__?.content?.frameStyles || [];
const RANK_TONES = {
  4: { edge: "#a47bc0", glow: "rgba(157, 105, 186, .5)" },
  5: { edge: "#e1bd58", glow: "rgba(218, 176, 64, .48)" },
  6: { edge: "#e78c48", glow: "rgba(222, 112, 47, .5)" },
};
const UNRANKED_TONE = { edge: "#77716b", glow: "rgba(119, 113, 107, .25)" };

let characters = window.RNCCharacterStore.getAll();
const archiveCategories = ["President", "Director", "Arcanist", "Human", "NPC", "Magus", "Enemy"];
const archiveViews = {
  all: archiveCategories,
  "character-index": ["Arcanist"],
  npc: ["President", "Director", "NPC"],
  "magus-enemy": ["Magus", "Enemy"],
};

const state = {
  member: false,
  owned: [],
  filters: { arcana: "all", race: "all", rank: "all" },
  query: "",
  archiveView: "all",
  enemyBossOnly: false,
};
const overlay = document.getElementById("modalOverlay");
const modalIds = ["loginModal", "deniedModal", "chooseModal"];
const memberMenu = document.getElementById("memberMenu");
const memberButton = document.getElementById("memberButton");
const memberMenuPanel = document.getElementById("memberMenuPanel");

function characterArcana(character) {
  if (character.arcana === "UNKNOWN" && ["President", "Magus"].includes(character.characterType)) return "UNKNOWN";
  return character.race === "Human" ? "NATURAL" : character.arcana;
}

function archiveCategory(character) {
  if (character.characterType === "Human") return "Human";
  if (character.characterType === "Monster") return "Enemy";
  const candidate = character.archiveCategory || character.archiveType || character.category;
  if (candidate === "Character" || candidate === "Acranist") return "Arcanist";
  if (candidate === "Monster") return "Enemy";
  if (archiveCategories.includes(candidate)) return candidate;
  const role = character.staffRole || character.communityRole || character.position;
  if (role === "President" || role === "Director") return role;
  return "Arcanist";
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function showModal(id) {
  closeMemberMenu();
  modalIds.forEach(function(modalId) {
    document.getElementById(modalId).hidden = modalId !== id;
  });
  overlay.hidden = false;
}

function closeModal() {
  overlay.hidden = true;
}

function closeMemberMenu(restoreFocus = false) {
  memberMenuPanel.hidden = true;
  memberButton.setAttribute("aria-expanded", "false");
  if (restoreFocus) memberButton.focus();
}

function openMemberMenu() {
  closeFilters();
  closeArchiveMenu();
  memberMenuPanel.hidden = false;
  memberButton.setAttribute("aria-expanded", "true");
}

function makeCharacterCard(character) {
  const cell = element("div", "card-cell");
  cell.dataset.characterId = String(character.id);
  const button = element("button", "character-card");
  const isEnemy = character.characterType === "Monster";
  cell.classList.toggle("enemy-card-cell", isEnemy);
  button.classList.toggle("enemy-card", isEnemy);
  button.classList.toggle("enemy-boss-card", isEnemy && character.enemyData?.isBoss === true);
  button.type = "button";
  const arcana = characterArcana(character);
  const tone = ARCANA_TONES[arcana] || ARCANA_TONES.NATURAL;
  const rank = Number.isInteger(Number(character.rank)) && Number(character.rank) >= 1 && Number(character.rank) <= 7 ? Number(character.rank) : null;
  const rankTone = RANK_TONES[rank] || UNRANKED_TONE;
  const frame = FRAME_STYLES.find(item => item.key === character.frameKey);
  if (frame?.glowMode === "rainbow") button.classList.add("president-card");
  button.dataset.arcana = arcana;
  button.dataset.rank = rank == null ? "" : String(rank);
  button.style.setProperty("--arcana-hover", tone.hover);
  button.style.setProperty("--rank-edge", frame?.borderColor || "#8a8270");
  button.style.setProperty("--rank-glow", frame ? frame.glowColor + "38" : rankTone.glow);
  button.style.setProperty("--frame-glow", frame ? frame.glowColor + "80" : "transparent");
  button.setAttribute("aria-label", "ดูโปรไฟล์ " + character.name);

  const art = element("span", "card-art");
  art.style.setProperty("--portrait-position", character.art || "0%");
  const galleryArt = character.cardImage || (isEnemy ? character.image || character.detailImage || character.galleryImage : character.galleryImage || character.image);
  const detailArt = character.image || character.detailImage;
  let portraitPreload;
  let portraitReady;
  const preloadPortrait = function() {
    if (!detailArt || detailArt === galleryArt) return Promise.resolve();
    if (!portraitReady) {
      portraitPreload = new Image();
      portraitPreload.src = detailArt;
      portraitReady = portraitPreload.decode().catch(function() {});
    }
    return portraitReady;
  };
  if (detailArt && detailArt !== galleryArt) {
    button.addEventListener("pointerenter", preloadPortrait, { once: true });
    button.addEventListener("focus", preloadPortrait, { once: true });
  }
  if (!galleryArt) art.classList.add("empty-portrait");
  if (galleryArt) {
    art.style.backgroundImage = "url(" + JSON.stringify(galleryArt) + ")";
  }
  window.RNCImageLayout?.apply(art, character, "galleryDesktop");
  window.RNCImageLayout?.apply(art, character, "galleryMobile", "rnc-mobile-image");
  if (character.tint) art.style.filter = character.tint;
  const rankFrame = document.createElement("img");
  rankFrame.className = "card-rank-frame";
  rankFrame.alt = "";
  rankFrame.setAttribute("aria-hidden", "true");
  if (frame && character.frameAsset) { rankFrame.src = character.frameAsset; window.RNCFrameArt?.apply(rankFrame, frame); }
  const affinity = element("span", "card-affinity");
  affinity.dataset.arcana = arcana;
  const icon = document.createElement("img");
  icon.alt = "";
  icon.src = "/assets/RNCelement/" + (ARCANA_ICONS[arcana] || ARCANA_ICONS.NATURAL);
  affinity.appendChild(icon);

  const text = element("span", "card-name-wrap");
  const byname = String(character.byname || "").trim();
  const hasByname = !isEnemy && Boolean(byname);
  button.classList.toggle("has-byname", hasByname);
  if (isEnemy) {
    text.appendChild(element("span", "card-byname", character.enemyData?.subtype || (["Critter", "Arcanoid", "Magus Sacramentum"].includes(byname) ? byname : "Enemy")));
  } else if (hasByname) {
    text.appendChild(element("span", "card-byname card-fullname", character.name));
  }
  const enemyNameParts = isEnemy ? String(character.name).split("|").map(part => part.trim()) : [];
  text.appendChild(element("span", "card-name", isEnemy ? enemyNameParts[0] : hasByname ? byname : character.name));
  if (enemyNameParts.length > 1) text.appendChild(element("span", "card-enemy-local-name", enemyNameParts.slice(1).join(" | ")));
  if (isEnemy && Number.isFinite(Number(character.enemyData?.hp))) text.appendChild(element("span", "card-enemy-hp", "HP: " + Number(character.enemyData.hp)));
  if (character.owner) text.appendChild(element("span", "card-owner", character.owner));
  if (character.publicationState && character.publicationState !== "PUBLISHED") text.append(element("span", "card-review-state", { DRAFT: "ฉบับร่าง", PENDING: "รอตรวจ", CHANGES_REQUESTED: "กรุณาแก้ไข", ARCHIVED: "เก็บเข้าคลัง" }[character.publicationState] || ""));
  button.append(art, affinity, text);
  if (isEnemy && character.enemyData?.isBoss === true) button.appendChild(element("span", "enemy-boss-stamp", "BOSS"));
  if (frame && character.frameAsset) button.insertBefore(rankFrame, affinity);
  else if (rank != null) text.append(element("span", "card-review-state", "★".repeat(rank)));
  button.addEventListener("click", function() {
    const destination = "/community/rnc/character?id=" + encodeURIComponent(character.id);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.RNCNavigate ? window.RNCNavigate(destination) : (location.href = destination);
      return;
    }
    if (document.body.classList.contains("archive-opening")) return;
    document.body.classList.add("archive-opening");
    cell.classList.add("is-opening");
    button.classList.add("is-opening");
    preloadPortrait();
    new Promise(function(resolve) { window.setTimeout(resolve, 140); }).then(function() {
      try {
        const bounds = button.getBoundingClientRect();
        const artworkStyle = getComputedStyle(art);
        sessionStorage.removeItem("rnc-gallery-entry-visual");
        sessionStorage.setItem("rnc-gallery-entry", String(character.id));
        sessionStorage.setItem("rnc-gallery-entry-visual", JSON.stringify({
          id: String(character.id),
          left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height,
          image: artworkStyle.backgroundImage,
          size: artworkStyle.backgroundSize,
          position: artworkStyle.backgroundPosition,
          filter: artworkStyle.filter,
          edge: rankTone.edge,
        }));
      } catch {}
      window.RNCNavigate ? window.RNCNavigate(destination) : (location.href = destination);
    });
  });
  cell.appendChild(button);
  return cell;
}

function renderCards(onlyCategories = null) {
  const matches = characters.filter(function(character) {
    return (state.filters.arcana === "all" || characterArcana(character) === state.filters.arcana)
      && (character.characterType !== "Monster" || !state.enemyBossOnly || character.enemyData?.isBoss === true)
      && (state.filters.race === "all" || character.race === state.filters.race)
      && (state.filters.rank === "all" || character.rank === Number(state.filters.rank))
      && (!state.query || (character.name + " " + character.byname + " " + (character.enemyData?.subtype || "")).toLowerCase().includes(state.query));
  });
  const visibleCategories = archiveViews[state.archiveView] || archiveViews.all;
  document.querySelectorAll("[data-archive-section]").forEach(function(section) {
    const category = section.dataset.archiveSection;
    if (onlyCategories && !onlyCategories.includes(category)) return;
    section.hidden = !visibleCategories.includes(category);
    const categoryMatches = matches.filter(function(character) { return archiveCategory(character) === category; });
    const grid = section.querySelector("[data-card-grid]");
    const empty = section.querySelector(".archive-section-empty");
    const hasCategoryProfiles = characters.some(function(character) { return archiveCategory(character) === category; });
    section.classList.toggle("is-empty-section", !hasCategoryProfiles);
    const cardsById = new Map(Array.from(grid.children, function(card) { return [card.dataset.characterId, card]; }));
    const nextIds = new Set(categoryMatches.map(function(character) { return String(character.id); }));
    cardsById.forEach(function(card, id) {
      if (!nextIds.has(id)) card.remove();
    });
    categoryMatches.forEach(function(character, index) {
      const id = String(character.id);
      let card = cardsById.get(id);
      if (!card) {
        card = makeCharacterCard(character);
        card.style.setProperty("--archive-card-index", String(index));
      }
      const currentCard = grid.children[index] || null;
      if (currentCard !== card) grid.insertBefore(card, currentCard);
    });
    section.querySelector("[data-section-count]").textContent = String(categoryMatches.length);
    empty.hidden = categoryMatches.length > 0 || !hasCategoryProfiles;
    if (!categoryMatches.length && hasCategoryProfiles) empty.textContent = "No profiles match the current filters.";
  });
  document.querySelectorAll("[data-archive-target]").forEach(function(tab) {
    tab.hidden = !visibleCategories.includes(tab.dataset.archiveTarget);
  });
  syncActiveArchiveTab();
}

function setActiveArchiveTab(category) {
  document.querySelectorAll("[data-archive-target]").forEach(function(tab) {
    if (tab.hidden) return;
    if (tab.dataset.archiveTarget === category) tab.setAttribute("aria-current", "location");
    else tab.removeAttribute("aria-current");
  });
}

function syncActiveArchiveTab() {
  const scroller = document.getElementById("cardScroll");
  if (!scroller) return;
  const sections = Array.from(document.querySelectorAll("[data-archive-section]:not([hidden])"));
  if (!sections.length) return;
  const maxScrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  if (maxScrollTop > 4 && scroller.scrollTop >= maxScrollTop - 4) {
    setActiveArchiveTab(sections[sections.length - 1].dataset.archiveSection);
    return;
  }
  const anchor = scroller.getBoundingClientRect().top + 52;
  let active = sections[0];
  sections.forEach(function(section) {
    if (section.getBoundingClientRect().top <= anchor) {
      active = section;
    }
  });
  if (active) setActiveArchiveTab(active.dataset.archiveSection);
}

function renderSlots() {
  const grid = document.getElementById("slotGrid");
  grid.replaceChildren();
  document.getElementById("chooseCopy").textContent = state.owned.length
    ? "\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e15\u0e31\u0e27\u0e25\u0e30\u0e04\u0e23\u0e02\u0e2d\u0e07\u0e04\u0e38\u0e13 \u0e2b\u0e23\u0e37\u0e2d\u0e01\u0e14 Add Slot \u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e2a\u0e25\u0e47\u0e2d\u0e15\u0e43\u0e2b\u0e21\u0e48"
    : "\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e15\u0e31\u0e27\u0e25\u0e30\u0e04\u0e23\u0e02\u0e2d\u0e07\u0e04\u0e38\u0e13 \u0e40\u0e25\u0e37\u0e2d\u0e01 Add Slot \u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e15\u0e31\u0e27\u0e25\u0e30\u0e04\u0e23\u0e41\u0e23\u0e01";
  state.owned.forEach(function(id) {
    const character = characters.find(function(item) { return item.id === id; });
    if (!character) return;
    const button = element("button", "slot-card");
    button.type = "button";
    const art = element("span", "card-art");
    art.style.setProperty("--portrait-position", character.art || "0%");
    const galleryArt = character.cardImage || character.galleryImage || character.image;
    if (!galleryArt) art.classList.add("empty-portrait");
    if (galleryArt) {
      art.style.backgroundImage = "url(" + JSON.stringify(galleryArt) + ")";
    }
    window.RNCImageLayout?.apply(art, character, "galleryDesktop");
    button.append(art, element("span", "", character.name));
    button.addEventListener("click", function() {
      const destination = "/community/rnc/character?id=" + encodeURIComponent(id);
      window.RNCNavigate ? window.RNCNavigate(destination) : (location.href = destination);
    });
    grid.appendChild(button);
  });
  const add = element("button", "slot-card add");
  add.type = "button";
  add.append(element("span", "", "+"), element("span", "", "Add Slot"));
  add.addEventListener("click", function() { window.RNCNavigate ? window.RNCNavigate("/community/rnc/editor") : (location.href = "/community/rnc/editor"); });
  grid.appendChild(add);
}

function showChoose() {
  if (!state.member) {
    location.href = "/community";
    return;
  }
  renderSlots();
  showModal("chooseModal");
}

async function importLegacyDrafts() {
  const store = window.RNCCharacterStore;
  for (const draft of store.getLegacyDrafts()) {
    try {
      const response = await fetch("/api/community/characters", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, legacyId: draft.id }),
      });
      if (!response.ok) return;
      const result = await response.json();
      if (!result.character) return;
      store.removeLegacyDraft(draft.id);
      store.add(result.character);
    } catch {
      return;
    }
  }
  characters = store.getAll();
}

async function applyMemberSession(session) {
  state.member = true;
  document.getElementById("memberButtonName").textContent = "@" + session.name;
  memberButton.title = "@" + session.name;
  await importLegacyDrafts();
  state.owned = window.RNCCharacterStore.getOwned();
  renderCards();
  closeModal();
  if (state.owned.length === 0) showChoose();
}

function closeFilters(except) {
  document.querySelectorAll(".filter-group").forEach(function(group) {
    if (group === except) return;
    group.classList.remove("open");
    group.querySelector(".filter-popover").hidden = true;
    group.querySelector("button").setAttribute("aria-expanded", "false");
  });
}

const archiveFilterButton = document.getElementById("archiveFilterButton");
const archiveFilterMenu = document.getElementById("archiveFilterMenu");
const cardScroll = document.getElementById("cardScroll");
const archiveIndexTabs = document.getElementById("archiveIndexTabs");

if ("IntersectionObserver" in window) {
  // Long archives may never reach a percentage threshold; reveal as they enter.
  const archiveRevealObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      archiveRevealObserver.unobserve(entry.target);
    });
  }, { root: cardScroll, threshold: 0, rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".archive-section").forEach(function(section) {
    archiveRevealObserver.observe(section);
  });
} else {
  document.querySelectorAll(".archive-section").forEach(function(section) {
    section.classList.add("is-visible");
  });
}

function scrollToArchiveCategory(category) {
  const section = document.querySelector('[data-archive-section="' + category + '"]');
  if (!section || section.hidden) return;
  const offset = section.getBoundingClientRect().top - cardScroll.getBoundingClientRect().top;
  cardScroll.scrollTo({ top: cardScroll.scrollTop + offset - 12, behavior: "smooth" });
  setActiveArchiveTab(category);
}

function closeArchiveMenu() {
  if (archiveFilterMenu.open) archiveFilterMenu.close();
  archiveFilterButton.setAttribute("aria-expanded", "false");
}

archiveFilterButton.addEventListener("click", function() {
  closeMemberMenu();
  const shouldOpen = !archiveFilterMenu.open;
  closeFilters();
  if (shouldOpen) archiveFilterMenu.showModal();
  else closeArchiveMenu();
  archiveFilterButton.setAttribute("aria-expanded", String(shouldOpen));
});

archiveFilterMenu.addEventListener("close", function() {
  archiveFilterButton.setAttribute("aria-expanded", "false");
});
archiveFilterMenu.querySelector("[data-archive-close]").addEventListener("click", closeArchiveMenu);
archiveFilterMenu.addEventListener("click", function(event) {
  if (event.target === archiveFilterMenu) closeArchiveMenu();
});

archiveFilterMenu.querySelectorAll("[data-archive-view]").forEach(function(option) {
  option.addEventListener("click", function() {
    state.archiveView = option.dataset.archiveView;
    archiveFilterMenu.querySelectorAll("[data-archive-view]").forEach(function(item) {
      const selected = item === option;
      item.classList.toggle("selected", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    closeArchiveMenu();
    cardScroll.scrollTop = 0;
    renderCards();
  });
});

archiveIndexTabs.querySelectorAll("[data-archive-target]").forEach(function(tab) {
  tab.addEventListener("click", function() {
    scrollToArchiveCategory(tab.dataset.archiveTarget);
  });
});
let archiveRailPointerActive = false;
archiveIndexTabs.addEventListener("pointerdown", function(event) {
  const star = event.target.closest(".archive-star-button");
  if (!star || (event.pointerType === "mouse" && event.button !== 0)) return;
  event.preventDefault();
  archiveRailPointerActive = true;
  archiveIndexTabs.classList.add("is-dragging");
  archiveIndexTabs.setPointerCapture(event.pointerId);
  scrollToArchiveCategory(star.dataset.archiveTarget);
});
archiveIndexTabs.addEventListener("pointermove", function(event) {
  if (!archiveRailPointerActive) return;
  const hovered = document.elementFromPoint(event.clientX, event.clientY);
  const star = hovered && hovered.closest(".archive-star-button");
  if (star && star.getAttribute("aria-current") !== "location") {
    scrollToArchiveCategory(star.dataset.archiveTarget);
  }
});
function releaseArchiveRailPointer() {
  archiveRailPointerActive = false;
  archiveIndexTabs.classList.remove("is-dragging");
}
archiveIndexTabs.addEventListener("pointerup", releaseArchiveRailPointer);
archiveIndexTabs.addEventListener("pointercancel", releaseArchiveRailPointer);
archiveIndexTabs.addEventListener("lostpointercapture", releaseArchiveRailPointer);
let archiveWheelCooldown = 0;
archiveIndexTabs.addEventListener("wheel", function(event) {
  const direction = Math.sign(event.deltaY);
  if (!direction) return;
  event.preventDefault();
  const tabs = Array.from(archiveIndexTabs.querySelectorAll("[data-archive-target]:not([hidden])"));
  const activeIndex = tabs.findIndex(function(tab) { return tab.getAttribute("aria-current") === "location"; });
  const nextIndex = Math.max(0, Math.min(tabs.length - 1, (activeIndex < 0 ? 0 : activeIndex) + direction));
  const now = performance.now();
  if (nextIndex === activeIndex || now < archiveWheelCooldown) return;
  archiveWheelCooldown = now + 360;
  scrollToArchiveCategory(tabs[nextIndex].dataset.archiveTarget);
}, { passive: false });
cardScroll.addEventListener("scroll", syncActiveArchiveTab, { passive: true });

document.querySelectorAll(".filter-group").forEach(function(group) {
  const opener = group.querySelector("button");
  const popover = group.querySelector(".filter-popover");
  opener.addEventListener("click", function() {
    const shouldOpen = popover.hidden;
    closeFilters();
    group.classList.toggle("open", shouldOpen);
    popover.hidden = !shouldOpen;
    opener.setAttribute("aria-expanded", String(shouldOpen));
  });
  popover.querySelectorAll("[data-option]").forEach(function(option) {
    option.addEventListener("click", function() {
      state.filters[group.dataset.filterGroup] = option.dataset.option;
      popover.querySelectorAll("[data-option]").forEach(function(item) {
        item.classList.toggle("selected", item === option);
      });
      closeFilters();
      renderCards();
      document.getElementById("cardScroll").scrollTop = 0;
    });
  });
});

document.addEventListener("click", function(event) {
  if (!event.target.closest(".filter-group")) closeFilters();
  if (!memberMenu.contains(event.target)) closeMemberMenu();
});
memberButton.addEventListener("click", function() {
  if (!state.member) { location.href = "/community"; return; }
  if (memberMenuPanel.hidden) openMemberMenu();
  else closeMemberMenu();
});
memberButton.addEventListener("keydown", function(event) {
  if (!state.member || !["ArrowDown", "ArrowUp"].includes(event.key)) return;
  event.preventDefault();
  openMemberMenu();
  const options = memberMenuPanel.querySelectorAll("button");
  options[event.key === "ArrowUp" ? options.length - 1 : 0].focus();
});
memberMenuPanel.addEventListener("keydown", function(event) {
  if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
  event.preventDefault();
  const options = Array.from(memberMenuPanel.querySelectorAll("button"));
  const index = options.indexOf(document.activeElement);
  options[(index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length].focus();
});
memberMenu.addEventListener("focusout", function(event) {
  if (!memberMenu.contains(event.relatedTarget)) closeMemberMenu();
});
document.getElementById("myCharactersButton").addEventListener("click", function() {
  closeMemberMenu();
  showChoose();
});
document.getElementById("discordButton").addEventListener("click", function() { location.href = "/community"; });
document.getElementById("deniedBackButton").addEventListener("click", function() { location.href = "/community"; });
document.querySelectorAll("[data-close]").forEach(function(button) {
  button.addEventListener("click", closeModal);
});
document.getElementById("searchButton").addEventListener("click", function() {
  const field = document.getElementById("searchField");
  field.hidden = !field.hidden;
  this.setAttribute("aria-expanded", String(!field.hidden));
  if (field.hidden) {
    field.value = "";
    state.query = "";
    renderCards();
  } else field.focus();
});
document.getElementById("searchField").addEventListener("input", function(event) {
  state.query = event.target.value.trim().toLowerCase();
  renderCards();
});
document.querySelectorAll("[data-enemy-filter]").forEach(function(button) {
  button.addEventListener("click", function() {
    const nextBossOnly = button.dataset.enemyFilter === "boss";
    if (state.enemyBossOnly === nextBossOnly) return;
    state.enemyBossOnly = nextBossOnly;
    document.querySelectorAll("[data-enemy-filter]").forEach(function(item) {
      item.setAttribute("aria-pressed", String(item === button));
    });
    // Boss is a local Enemy-only filter. Keep all other archive sections mounted
    // so their cards don't replay their entrance animation on every toggle.
    renderCards(["Enemy"]);
  });
});
document.getElementById("titleButton").addEventListener("click", function() {
  document.getElementById("cardScroll").scrollTop = 0;
});
document.addEventListener("keydown", function(event) {
  if (event.key === "Escape") {
    closeMemberMenu(!memberMenuPanel.hidden);
    closeArchiveMenu();
    closeFilters();
    if (state.member) closeModal();
  }
});

window.addEventListener("pageshow", function() {
  document.body.classList.remove("archive-opening");
  document.querySelectorAll(".is-opening").forEach(function(item) { item.classList.remove("is-opening"); });
});

const galleryMember = window.__RNC_BOOTSTRAP__?.currentUser;
const gallerySession = galleryMember
  ? Promise.resolve({ ...galleryMember, authenticated: true })
  : fetch("/api/community/session", { credentials: "same-origin" }).then(function(response) { return response.json(); });
gallerySession
  .then(async function(session) {
    if (!session.authenticated) { location.replace("/community"); return; }
    await applyMemberSession(session);
  })
  .catch(function() { location.replace("/community"); });
