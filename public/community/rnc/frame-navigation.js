(function(){
  "use strict";
  const links = document.querySelector(".top-links");
  if (links && !links.querySelector('a[href="/community/rnc/music"]')) {
    const music = document.createElement("a");
    music.href = "/community/rnc/music";
    music.className = "hide-small";
    music.textContent = "MUSIC";
    const archive = links.querySelector(".archive-nav-menu") || links.querySelector('a[href="/community/rnc"]');
    if (archive) archive.after(music); else links.prepend(music);
  }
  const archiveOptions = document.querySelector(".archive-menu-options");
  if (archiveOptions && !archiveOptions.querySelector('a[href="/community/rnc/music"]')) {
    const music = document.createElement("a");
    music.href = "/community/rnc/music";
    music.className = "archive-view-option";
    music.style.textDecoration = "none";
    music.innerHTML = '<span class="archive-option-number">04</span><span class="archive-option-copy"><strong>Music Archive</strong><small>Character theme songs</small></span>';
    archiveOptions.append(music);
  }
  window.RNCNavigate = function(url){
    let destination;try{destination=new URL(url,location.href);}catch{return;}
    if(destination.origin!==location.origin||!destination.pathname.startsWith("/community"))return;
    if(window.parent!==window){window.parent.postMessage({type:"RNC_APP_NAVIGATE",url:destination.href},location.origin);return;}
    location.assign(destination.href);
  };
  if(window.parent===window)return;
  window.parent.postMessage({type:"RNC_THEME_DOCK_REQUEST"},location.origin);
  document.addEventListener("click",event=>{
    const link=event.target.closest?.("a[href]");if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target||link.hasAttribute("download"))return;
    let destination;try{destination=new URL(link.href,location.href);}catch{return;}
    if(destination.origin!==location.origin||!destination.pathname.startsWith("/community"))return;
    if(destination.pathname===location.pathname&&destination.search===location.search&&destination.hash){return;}
    event.preventDefault();window.RNCNavigate(destination.href);
  });
  window.addEventListener("hashchange",()=>window.parent.postMessage({type:"RNC_APP_HASH",url:location.href},location.origin));
})();
