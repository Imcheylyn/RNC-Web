(function () {
  "use strict";
  const media=window.RNCCharacterMedia, store=window.RNCCharacterStore;
  const character=store?.getById(new URLSearchParams(location.search).get("id")),trigger=document.getElementById("openCharacterCollection");
  if(!media||!character||!trigger)return;
  const endpoint="characters/"+encodeURIComponent(character.id), NS="http://www.w3.org/2000/svg";
  const enemyCharacter=["Monster","Enemy"].includes(character.characterType);
  let data=null,tab="relationships",selected=null,selectedDirection=null,reportOpen=false,filter="all",busy=false,editDirty=false,editBusy=false,editSource=null,searchAbort=null,searchTimer=0,loadingSerial=0,loadedAt=0;
  let pan={x:0,y:0,zoom:1}, pointers=new Map(),gesture=null,world=null,mapSvg=null;
  let isManualView=false,nodePositions=new Map(),boardBounds=null;
  let mapRenderKey="",loadingData=false;
  const node=(tag,text,className)=>{const element=document.createElement(tag);if(text!==undefined&&text!==null)element.textContent=text;if(className)element.className=className;return element;};
  const svgNode=(tag,attributes={})=>{const element=document.createElementNS(NS,tag);Object.entries(attributes).forEach(([key,value])=>element.setAttribute(key,String(value)));return element;};
  function action(text,handler,className){const button=node("button",text,className);button.type="button";button.addEventListener("click",handler);return button;}
  function status(text,error=false){statusElement.textContent=text || "";statusElement.classList.toggle("collection-error",error);}
  function face(person){
    const box=node("span",person.name?.slice(0,1)||"✦","collection-face");
    if(person.image)window.RNCRelationshipPortrait.load(person.image).then(source=>{
      if(source)box.replaceChildren(window.RNCRelationshipPortrait.render(source,window.RNCImageLayout.get(person,"relationships")));
    });
    return box;
  }
  function personHeading(person){const heading=node("div",null,"relationship-person-heading");heading.append(face(person),node("h3",person.byname||person.name));return heading;}
  const dialog=node("dialog",null,"collection-dialog");dialog.id="characterCollectionDialog";dialog.setAttribute("aria-label","Relationships");
  dialog.innerHTML=`
    <div class="collection-folder-bar">
      <button type="button" class="collection-back" data-collection-close aria-label="กลับหน้าตัวละคร" title="กลับหน้าตัวละคร"><span aria-hidden="true">◁</span></button>
      <nav class="collection-tabs" role="tablist" aria-label="รายละเอียดเสริม">
        <button type="button" role="tab" data-collection-tab="relationships" aria-selected="true" aria-controls="collectionRelations"><span>Relationships</span></button>
        <button type="button" role="tab" data-collection-tab="voices" aria-selected="false" aria-controls="collectionVoices"><span>Voice Line</span></button>
      </nav>
      <div class="collection-header-actions"><button type="button" class="collection-add" data-collection-add hidden>เพิ่มความสัมพันธ์</button></div>
    </div>
    <p class="collection-status" role="status" aria-live="polite"></p>
    <div class="collection-body">
      <section class="collection-relations" id="collectionRelations" role="tabpanel" aria-label="Relationships">
        <div class="constellation-workspace">

          <div class="constellation-tools"><select data-relation-filter aria-label="กรองความสัมพันธ์"><option value="all">ทุกสายสัมพันธ์</option><option value="outgoing">มุมมองของตัวละครนี้</option><option value="incoming">มุมมองจากอีกฝ่าย</option></select><button type="button" class="collection-fit" data-map-fit aria-label="ดูทั้งกระดาน" title="ดูทั้งกระดาน"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5"/><rect x="8" y="8" width="8" height="8" rx=".5"/></svg></button><button type="button" data-map-zoom-in aria-label="ขยายกระดาน">+</button><button type="button" data-map-zoom-out aria-label="ย่อกระดาน">−</button></div>
          <svg class="constellation-canvas" viewBox="-480 -320 960 640" aria-label="กระดานสายสัมพันธ์ตัวละคร"></svg>
          <div class="constellation-empty" hidden><p>ยังไม่มีสายสัมพันธ์<br>เพิ่มบุคคลแรกลงในแฟ้มนี้ได้เลย</p></div>

        </div>
        <button type="button" class="relationship-report-dismiss" data-report-dismiss aria-label="ปิดรายงาน" hidden></button>
        <aside class="relationship-detail" aria-label="รายละเอียดสายสัมพันธ์"></aside>
      </section>
      <section class="collection-voices" id="collectionVoices" role="tabpanel" aria-label="Voice Line" hidden></section>
    </div>`;
  document.body.append(dialog);
  const transportIcons={
    play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7Z"/></svg>',
    pause:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm7 0h4v14h-4z"/></svg>',
    previous:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h2v14H5zm14 0L8 12l11 7Z"/></svg>',
    next:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 5h2v14h-2zM5 5l11 7-11 7Z"/></svg>',
    loading:'<svg class="voice-loading-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/></svg>'
  };
  function cassetteFace(side){
    return '<div class="voice-cassette-face voice-cassette-'+(side==='A'?'front':'back')+'"><span class="voice-cassette-screw screw-tl"></span><span class="voice-cassette-screw screw-tr"></span><span class="voice-cassette-screw screw-bl"></span><span class="voice-cassette-screw screw-br"></span><div class="voice-player-sticker"><div class="voice-sticker-top"><small data-player-index></small><b>'+side+'</b></div><strong data-player-label></strong><span data-player-kind></span></div><div class="voice-player-window"><span class="voice-tape-path"></span><i class="voice-reel"><b></b></i><span class="voice-tape-bridge"></span><i class="voice-reel"><b></b></i></div><div class="voice-tape-footer"><span>REVERSE : NOIR CHRONICLE</span><span>STEREO / '+side+'</span></div><div class="voice-cassette-base"><i></i><span></span><i></i></div><span class="voice-cassette-sheen"></span></div>';
  }
  const voicePlayerDialog=node("dialog",null,"voice-player-dialog");
  voicePlayerDialog.setAttribute("aria-labelledby","voicePlayerTitle");
  voicePlayerDialog.innerHTML='<div class="voice-player-sheet"><div class="voice-player-stage" data-player-stage><div class="voice-player-tape" data-player-tape role="button" tabindex="0" aria-label="เทปคาสเซ็ต">'+cassetteFace('A')+cassetteFace('B')+'<span class="voice-cassette-core" style="--tape-depth:-8px" aria-hidden="true"></span><span class="voice-cassette-core" style="--tape-depth:-6px" aria-hidden="true"></span><span class="voice-cassette-core" style="--tape-depth:-4px" aria-hidden="true"></span><span class="voice-cassette-core" style="--tape-depth:-2px" aria-hidden="true"></span><span class="voice-cassette-core" style="--tape-depth:0px" aria-hidden="true"></span><span class="voice-cassette-core" style="--tape-depth:2px" aria-hidden="true"></span><span class="voice-cassette-core" style="--tape-depth:4px" aria-hidden="true"></span><span class="voice-cassette-core" style="--tape-depth:6px" aria-hidden="true"></span><span class="voice-cassette-core" style="--tape-depth:8px" aria-hidden="true"></span></div><span class="voice-player-stamp" data-player-stamp role="status" hidden>ไฟล์เสียงขัดข้อง</span></div><button type="button" class="voice-player-eject" data-player-eject aria-label="ดีดเทปและปิดเครื่องเล่น">EJECT</button><div class="voice-player-track"><h2 id="voicePlayerTitle" data-player-title></h2><p data-player-subtitle></p></div><div class="voice-player-timeline"><input type="range" data-player-seek min="0" max="1000" value="0" step="1" aria-label="ตำแหน่งการเล่นเสียง" disabled><div><time data-player-elapsed>0:00</time><time data-player-duration>–:––</time></div></div><div class="voice-player-controls"><button type="button" data-player-previous aria-label="เทปก่อนหน้า" title="เทปก่อนหน้า">'+transportIcons.previous+'</button><button type="button" class="voice-player-play" data-player-play aria-label="เล่นเสียง" title="เล่นเสียง" aria-pressed="false">'+transportIcons.play+'</button><button type="button" data-player-next aria-label="เทปถัดไป" title="เทปถัดไป">'+transportIcons.next+'</button></div><div class="voice-player-media character-media-player" data-player-mount hidden></div><details class="voice-player-transcript" data-player-transcript-section hidden><summary>บทพูดและเครดิต</summary><p data-player-transcript></p><small data-player-credit></small></details><p class="voice-player-status" data-player-status role="status" aria-live="polite"></p></div>';
  const voiceNoteDialog=node("dialog",null,"voice-player-dialog voice-note-dialog");
  voiceNoteDialog.setAttribute("aria-labelledby","voiceNoteTitle");
  voiceNoteDialog.innerHTML=`<div class="voice-player-sheet voice-note-sheet">
    <div class="voice-player-stage voice-note-stage is-entering">
      <article class="voice-note-paper">
        <span class="voice-note-category" data-voice-note-category></span>
        <h2 id="voiceNoteTitle"></h2>
        <div class="voice-note-reading" role="region" aria-label="บทพูดในโน้ต" tabindex="0">
          <p class="voice-note-body" data-voice-note-body></p>
          <p class="voice-note-credit" data-voice-note-credit hidden></p>
        </div>
      </article>
    </div>
    <button type="button" class="voice-player-eject voice-note-close" data-voice-note-close autofocus>ปิดโน้ต</button>
  </div>`;
  const noteTitle=voiceNoteDialog.querySelector("#voiceNoteTitle");
  const noteCategory=voiceNoteDialog.querySelector("[data-voice-note-category]");
  const noteBody=voiceNoteDialog.querySelector("[data-voice-note-body]");
  const noteCredit=voiceNoteDialog.querySelector("[data-voice-note-credit]");
  const noteReading=voiceNoteDialog.querySelector(".voice-note-reading");
  voiceNoteDialog.querySelector("[data-voice-note-close]").addEventListener("click",()=>voiceNoteDialog.close());
  voiceNoteDialog.addEventListener("click",event=>{if(event.target===voiceNoteDialog)voiceNoteDialog.close();});
  dialog.append(voicePlayerDialog,voiceNoteDialog);

  const isVoiceNote=line=>line.sourceType==="NONE";
  const noteLabel=line=>line.category ? "โน้ต · "+line.category : "โน้ต";
  function openVoiceNote(line){
    noteTitle.textContent=line.title;
    noteCategory.textContent=noteLabel(line);
    noteBody.textContent=line.transcript||"ยังไม่มีบทพูด";
    noteCredit.textContent=line.credit?"เครดิตเสียง · "+line.credit:"";
    noteCredit.hidden=!line.credit;
    voiceNoteDialog.showModal();
    voiceNoteDialog.scrollTop=0;
    noteReading.scrollTop=0;
  }
  const $=selector=>dialog.querySelector(selector),statusElement=$(".collection-status"),relationPanel=$(".collection-relations"),aside=$(".relationship-detail"),voicePanel=$(".collection-voices"),playerTitle=voicePlayerDialog.querySelector("[data-player-title]"),playerSubtitle=voicePlayerDialog.querySelector("[data-player-subtitle]"),playerTape=voicePlayerDialog.querySelector("[data-player-tape]"),playerPlay=voicePlayerDialog.querySelector("[data-player-play]"),playerMount=voicePlayerDialog.querySelector("[data-player-mount]"),playerStage=voicePlayerDialog.querySelector("[data-player-stage]"),playerSeek=voicePlayerDialog.querySelector("[data-player-seek]"),playerStamp=voicePlayerDialog.querySelector("[data-player-stamp]");
  const reportViewport=matchMedia("(max-width:760px)");
  reportViewport.addEventListener("change",()=>{syncReport();if(dialog.open&&tab==="relationships")renderMap();});
  $("[data-report-dismiss]").addEventListener("click",()=>closeReport());
  let playerIndex=-1,playerSession=0,playerDuration=0,tapeRotation={x:-8,y:-12},tapeDrag=null,playerSwipe=null,playerEjectTimer=0,playerEjectHandler=null,ignoreTapeClickUntil=0;
  const clipClock=value=>{const seconds=Math.max(0,Math.floor(Number(value)||0));return Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0");};
  function updateVoiceProgress(progress){
    playerDuration=progress.duration||0;const ratio=playerDuration?Math.min(1,Math.max(0,progress.current/playerDuration)):0;
    playerSeek.disabled=!playerDuration;playerSeek.value=String(Math.round(ratio*1000));playerSeek.style.setProperty("--voice-progress",ratio*100+"%");playerSeek.setAttribute("aria-valuetext",clipClock(progress.current)+" จาก "+clipClock(playerDuration));
    voicePlayerDialog.querySelector("[data-player-elapsed]").textContent=clipClock(progress.current);voicePlayerDialog.querySelector("[data-player-duration]").textContent=playerDuration?clipClock(playerDuration):"–:––";
  }
  function setVoiceState(state){
    const loading=state==="loading",playing=state==="playing",label=loading?"กำลังโหลดเสียง":playing?"พักเสียง":"เล่นเสียง";
    playerPlay.innerHTML=transportIcons[loading?"loading":playing?"pause":"play"];playerPlay.disabled=loading;playerPlay.setAttribute("aria-label",label);playerPlay.title=label;playerPlay.setAttribute("aria-pressed",String(playing));playerTape.classList.toggle("is-playing",playing);
    voicePlayerDialog.querySelector("[data-player-status]").textContent=loading?"กำลังเตรียมเสียง…":"";if(state==="stopped"||state==="error")playerSeek.disabled=true;
  }
  function applyTapeRotation(){playerTape.style.setProperty("--tape-rotate-x",tapeRotation.x+"deg");playerTape.style.setProperty("--tape-rotate-y",tapeRotation.y+"deg");}
  function flipTape(){tapeRotation.y+=180;applyTapeRotation();}
  function cancelPlayerEject(){if(playerEjectTimer){clearTimeout(playerEjectTimer);playerEjectTimer=0;}if(playerEjectHandler){playerStage.removeEventListener("animationend",playerEjectHandler);playerEjectHandler=null;}voicePlayerDialog.classList.remove("is-ejecting");}
  function closeVoicePlayer(eject=false){if(!voicePlayerDialog.open){media.stop();return;}if(!eject||window.matchMedia?.("(prefers-reduced-motion: reduce)").matches){cancelPlayerEject();voicePlayerDialog.close();return;}if(playerEjectTimer||playerEjectHandler)return;const session=playerSession,finish=()=>{cancelPlayerEject();if(voicePlayerDialog.open&&session===playerSession)voicePlayerDialog.close();};playerEjectHandler=event=>{if(event.target===playerStage&&event.animationName==="voice-cassette-eject")finish();};playerStage.addEventListener("animationend",playerEjectHandler);voicePlayerDialog.classList.add("is-ejecting");playerEjectTimer=window.setTimeout(finish,650);}
  function adjacentTape(index,step){
    const lines=data?.voiceLines||[];
    for(let i=index+step;i>=0&&i<lines.length;i+=step){
      if(!isVoiceNote(lines[i]))return i;
    }
    return -1;
  }
  function openVoicePlayer(index,autoplay=false){
    const line=data?.voiceLines[index];
    if(!line||isVoiceNote(line))return;
    cancelPlayerEject();playerSession++;media.stop();playerIndex=index;playerTitle.textContent=line.title;playerSubtitle.textContent=(line.category||"VOICE LINE")+" · "+(character.byname||character.name);
    voicePlayerDialog.querySelectorAll("[data-player-index]").forEach(label=>{label.textContent="TCF / VOICE · "+String(index+1).padStart(2,"0");});voicePlayerDialog.querySelectorAll("[data-player-label]").forEach(label=>{label.textContent=line.title;});voicePlayerDialog.querySelectorAll("[data-player-kind]").forEach(label=>{label.textContent=(line.category||"VOICE LINE").toUpperCase();});
    voicePlayerDialog.querySelector("[data-player-transcript]").textContent=line.transcript||"";const transcript=voicePlayerDialog.querySelector("[data-player-transcript-section]");transcript.hidden=!line.transcript&&!line.credit;transcript.open=false;voicePlayerDialog.querySelector("[data-player-credit]").textContent=line.credit?"เครดิตเสียง · "+line.credit:"";voicePlayerDialog.querySelector("[data-player-credit]").hidden=!line.credit;
    voicePlayerDialog.querySelector("[data-player-previous]").disabled=adjacentTape(index,-1)<0;voicePlayerDialog.querySelector("[data-player-next]").disabled=adjacentTape(index,1)<0;
    setVoiceState("stopped");playerStamp.hidden=true;playerStage.classList.remove("is-audio-missing");const hasAudio=line.sourceType==="YOUTUBE"?Boolean(line.youtubeId||line.sourceUrl):Boolean(line.audioAssetId||line.audioUrl||line.sourceUrl);updateVoiceProgress({current:0,duration:hasAudio&&line.endSeconds!=null?Math.max(0,Number(line.endSeconds)-Number(line.startSeconds||0)):0});playerSeek.disabled=true;tapeDrag=null;playerTape.classList.remove("is-dragging");tapeRotation={x:-8,y:-12};applyTapeRotation();
    if(!voicePlayerDialog.open)voicePlayerDialog.showModal();playerStage.classList.remove("is-entering");void playerStage.offsetWidth;playerStage.classList.add("is-entering");if(autoplay)playerPlay.click();
  }
  voicePlayerDialog.addEventListener("pointerdown",event=>{if(!["touch","pen"].includes(event.pointerType)||!event.target.closest("[data-player-tape]"))return;playerSwipe={id:event.pointerId,startX:event.clientX,startY:event.clientY};});
  voicePlayerDialog.addEventListener("pointerup",event=>{if(playerSwipe?.id!==event.pointerId)return;const swipe=playerSwipe;playerSwipe=null;const dx=event.clientX-swipe.startX,dy=event.clientY-swipe.startY;if(dy<-72&&Math.abs(dy)>Math.abs(dx)*1.2)closeVoicePlayer(true);});
  voicePlayerDialog.addEventListener("pointercancel",event=>{if(playerSwipe?.id===event.pointerId)playerSwipe=null;});
  voicePlayerDialog.querySelector("[data-player-eject]").addEventListener("click",()=>closeVoicePlayer(true));
  voicePlayerDialog.addEventListener("click",event=>{if(event.target===voicePlayerDialog)closeVoicePlayer(true);});
  voicePlayerDialog.addEventListener("close",()=>{cancelPlayerEject();playerSession++;media.stop();setVoiceState("stopped");});
  playerPlay.addEventListener("click",async()=>{const line=data?.voiceLines[playerIndex],session=playerSession;if(!line)return;const hasAudio=line.sourceType==="YOUTUBE"?Boolean(line.youtubeId||line.sourceUrl):Boolean(line.audioAssetId||line.audioUrl||line.sourceUrl);if(!hasAudio){playerStamp.hidden=false;playerStage.classList.add("is-audio-missing");setVoiceState("error");return;}playerStamp.hidden=true;playerStage.classList.remove("is-audio-missing");try{await media.play(line,{mount:playerMount,controls:false,onState:state=>{if(session===playerSession){setVoiceState(state);if(state==="error"){playerStamp.hidden=false;playerStage.classList.add("is-audio-missing");}}},onProgress:progress=>{if(session===playerSession)updateVoiceProgress(progress);}});}catch(error){if(session===playerSession)voicePlayerDialog.querySelector("[data-player-status]").textContent=error.message;}});
  playerSeek.addEventListener("input",()=>{media.seek(playerDuration*Number(playerSeek.value)/1000);});
  voicePlayerDialog.querySelector("[data-player-previous]").addEventListener("click",()=>openVoicePlayer(adjacentTape(playerIndex,-1)));voicePlayerDialog.querySelector("[data-player-next]").addEventListener("click",()=>openVoicePlayer(adjacentTape(playerIndex,1)));
  playerTape.addEventListener("pointerdown",event=>{if(event.button!==0||tapeDrag)return;tapeDrag={id:event.pointerId,startX:event.clientX,startY:event.clientY,x:tapeRotation.x,y:tapeRotation.y,moved:false};playerTape.setPointerCapture(event.pointerId);playerTape.classList.add("is-dragging");});
  playerTape.addEventListener("pointermove",event=>{if(tapeDrag?.id!==event.pointerId)return;const dx=event.clientX-tapeDrag.startX,dy=event.clientY-tapeDrag.startY;tapeDrag.moved ||= Math.hypot(dx,dy)>5;const sensitivity=300/Math.max(240,playerTape.offsetWidth);tapeRotation={x:Math.max(-65,Math.min(65,tapeDrag.x-dy*sensitivity)),y:tapeDrag.y+dx*sensitivity};applyTapeRotation();});
  function endTapeDrag(event){if(tapeDrag?.id!==event.pointerId)return;ignoreTapeClickUntil=tapeDrag.moved?performance.now()+200:0;tapeDrag=null;playerTape.classList.remove("is-dragging");if(playerTape.hasPointerCapture(event.pointerId))playerTape.releasePointerCapture(event.pointerId);}
  ["pointerup","pointercancel","lostpointercapture"].forEach(type=>playerTape.addEventListener(type,endTapeDrag));
  playerTape.addEventListener("click",()=>{if(performance.now()>=ignoreTapeClickUntil)flipTape();});
  playerTape.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();flipTape();}else if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home"].includes(event.key)){event.preventDefault();if(event.key==="Home")tapeRotation={x:-8,y:-12};else if(event.key==="ArrowLeft")tapeRotation.y-=20;else if(event.key==="ArrowRight")tapeRotation.y+=20;else tapeRotation.x=Math.max(-65,Math.min(65,tapeRotation.x+(event.key==="ArrowUp"?10:-10)));applyTapeRotation();}});
  const editDialog=node("dialog",null,"collection-edit-dialog");editDialog.setAttribute("aria-label","แก้ไขรายละเอียดตัวละคร");document.body.append(editDialog);
  const confirmDialog=node("dialog",null,"collection-confirm");confirmDialog.setAttribute("aria-label","ยืนยันการเปลี่ยนแปลง");document.body.append(confirmDialog);
  let resolveConfirmation=null;
  function confirmAction(title,message,proceed="ยืนยัน"){
    if(resolveConfirmation)return Promise.resolve(false);
    confirmDialog.replaceChildren(node("h3",title),node("p",message));const controls=node("div");
    controls.append(action("ยกเลิก",()=>finishConfirmation(false)),action(proceed,()=>finishConfirmation(true),"collection-danger"));confirmDialog.append(controls);confirmDialog.showModal();return new Promise(resolve=>{resolveConfirmation=resolve;});
  }
  function finishConfirmation(result){confirmDialog.close();const resolve=resolveConfirmation;resolveConfirmation=null;resolve?.(result);}
  confirmDialog.addEventListener("cancel",event=>{event.preventDefault();finishConfirmation(false);});
  async function closeEditor(){if(editBusy||editSource?.isBusy?.())return false;if(editDirty&&!await confirmAction("ออกโดยไม่บันทึก?","ข้อมูลที่แก้ไขในหน้าต่างนี้ยังไม่ได้บันทึก","ไม่บันทึกและออก"))return false;editSource?.destroy();editSource=null;editDialog.close();editDirty=false;return true;}
  editDialog.addEventListener("cancel",event=>{event.preventDefault();closeEditor();});
  async function closeCollection(updateHistory=true){if(editDialog.open&&!await closeEditor())return false;if(voiceNoteDialog.open)voiceNoteDialog.close();closeVoicePlayer();media.stop();reportOpen=false;syncReport();dialog.close();isManualView=false;if(updateHistory&&["#relationships","#voice-lines"].includes(location.hash))history.back();trigger.focus();return true;}
  dialog.addEventListener("cancel",event=>{if(event.target!==dialog)return;event.preventDefault();if(reportViewport.matches&&reportOpen&&tab==="relationships")closeReport();else closeCollection();});
  $("[data-collection-close]").addEventListener("click",()=>closeCollection());
  function selectTab(next,updateHash=true){if(enemyCharacter||data?.canHaveRelationships===false)next="voices";if(tab!==next){if(voiceNoteDialog.open)voiceNoteDialog.close();closeVoicePlayer();reportOpen=false;}tab=next;const voices=next==="voices";dialog.setAttribute("aria-label",voices?"Voice Line":"Relationships");relationPanel.hidden=voices;voicePanel.hidden=!voices;dialog.querySelectorAll("[data-collection-tab]").forEach(button=>button.setAttribute("aria-selected",String(button.dataset.collectionTab===next)));const addButton=$("[data-collection-add]");addButton.textContent=voices ? "เพิ่ม Voice Line" : "เพิ่มความสัมพันธ์";addButton.hidden=voices?!data?.canEdit:!data?.canEditRelationships;if(updateHash&&dialog.open)history.replaceState(history.state,"",location.pathname+location.search+(voices ? "#voice-lines" : "#relationships"));syncReport();media.stop();if(data&&dialog.open&&!loadingData){if(voices)renderVoices();else{renderMap();renderDetail();}}}
  dialog.querySelectorAll("[data-collection-tab]").forEach(button=>button.addEventListener("click",()=>selectTab(button.dataset.collectionTab)));
  $("[data-collection-add]").addEventListener("click",()=>tab==="voices" ? editVoice() : editRelationship());
  function collectionDataKey(value){if(!value)return "";const snapshot={...value};delete snapshot._fitted;return JSON.stringify(snapshot);}
  async function load(options={}){
    if(loadingData)return;const quiet=options.quiet===true,serial=++loadingSerial;loadingData=true;if(!quiet)status("กำลังเปิดแฟ้มตัวละคร…");
    try{
      const result=await media.request(endpoint+"/collection");if(serial!==loadingSerial)return;
      const changed=!data||collectionDataKey(data)!==collectionDataKey(result);if(changed&&!data){isManualView=false;nodePositions.clear();}data=result;loadedAt=Date.now();
      if(changed||!mapSvg.childElementCount){const relationTab=$("[data-collection-tab=relationships]");relationTab.hidden=!data.canHaveRelationships;const available=pairs();if(selected&&!available.some(item=>item.person.id===selected)){selected=null;selectedDirection=null;}if(!data.canHaveRelationships&&tab!=="voices")selectTab("voices");$("[data-collection-add]").hidden=tab==="voices"?!data.canEdit:!data.canEditRelationships;renderMap();renderDetail();if(tab==="voices")renderVoices();}
      if(!quiet)status("");
    }catch(error){if(serial===loadingSerial&&!quiet)status(error.message,true);}
    finally{if(serial===loadingSerial)loadingData=false;}
  }
  async function openCollection(next="relationships",push=true){media.stop();if(enemyCharacter)next="voices";selectTab(next,false);if(!dialog.open)dialog.showModal();if(push)history.pushState({rncCollection:true},"",location.pathname+location.search+(next==="voices" ? "#voice-lines":"#relationships"));if(!data)await load();else if(Date.now()-loadedAt>30000)void load({quiet:true});}
  window.addEventListener("popstate",async()=>{if(["#relationships","#voice-lines"].includes(location.hash)){if(!dialog.open)openCollection(location.hash==="#voice-lines" ? "voices" : "relationships",false);else selectTab(location.hash==="#voice-lines" ? "voices" : "relationships",false);}else if(dialog.open&&!await closeCollection(false))history.pushState({rncCollection:true},"",location.pathname+location.search+(tab==="voices" ? "#voice-lines" : "#relationships"));});
  if(["#relationships","#voice-lines"].includes(location.hash))openCollection(location.hash==="#voice-lines" ? "voices" : "relationships",false);

  function pairs(){const result=new Map();(data?.relationships||[]).forEach(item=>{const outgoing=item.sourceId===character.id,person=outgoing ? item.target : item.source;if(!result.has(person.id))result.set(person.id,{person,outgoing:null,incoming:null});result.get(person.id)[outgoing ? "outgoing" : "incoming"]=item;});return [...result.values()].filter(item=>filter==="all"||Boolean(item[filter])).sort((a,b)=>a.person.id.localeCompare(b.person.id));}
  function relationType(id){return data.types.find(item=>item.id===id)||data.types[data.types.length-1];}
  function getBoardBounds(obstacles,occupied){
    const cardPadding=32;
    const left=Math.min(...obstacles.map(r=>r.x-cardPadding),...occupied.map(r=>r.x-12));
    const right=Math.max(...obstacles.map(r=>r.x+r.width+cardPadding),...occupied.map(r=>r.x+r.width+12));
    const top=Math.min(...obstacles.map(r=>r.y-cardPadding),...occupied.map(r=>r.y-12));
    const bottom=Math.max(...obstacles.map(r=>r.y+r.height+cardPadding),...occupied.map(r=>r.y+r.height+12));
    return {
      left,right,top,bottom,
      width:Math.max(1,right-left),
      height:Math.max(1,bottom-top),
      centerX:(left+right)/2,
      centerY:(top+bottom)/2
    };
  }
  function fitViewport(area,bounds){
    if(!bounds||bounds.width<=0||bounds.height<=0){pan={x:0,y:0,zoom:1};}
    else{
      const pad=44;
      const availW=Math.max(120,area.width-pad*2);
      const availH=Math.max(120,area.height-pad*2);
      const scale=Math.min(availW/bounds.width,availH/bounds.height);
      const zoom=Math.max(.25,Math.min(1.05,scale));
      pan={
        x:-bounds.centerX*zoom,
        y:-bounds.centerY*zoom,
        zoom
      };
    }
    isManualView=false;
    updateMap();
  }
  function renderMap(force=false){
    if(!data)return;
    mapSvg=$(".constellation-canvas");if(relationPanel.hidden)return;
    const area=mapSvg.getBoundingClientRect();if(area.width<100||area.height<100)return;
    const threads=window.RNCRelationshipThreadLayout;if(!threads){status("โหลดแผนผังไม่สำเร็จ กรุณารีเฟรชหน้า",true);return;}
    const connections=pairs(),compact=matchMedia("(max-width:680px)").matches;
    const imageKey=value=>{const image=typeof value==="string"?value:"";return image.length+":"+image.slice(0,48)+":"+image.slice(-32);};
    const people=[data.character,...connections.map(item=>item.person)].filter(Boolean).map(person=>[person.id,person.name,person.byname,person.characterType,person.position,imageKey(person.image),person.imageLayout?.relationships]);
    const relationships=(data.relationships||[]).map(item=>[item.id,item.sourceId,item.targetId,item.type,item.label]);
    const aspect=Math.max(.6,area.width/Math.max(1,area.height)),renderKey=JSON.stringify([Math.round(aspect*20)/20,compact,filter,selected,people,relationships,(data.types||[]).map(item=>[item.id,item.label,item.color])]);

    // Stable screen-pixel SVG viewport centered at (0, 0)
    mapSvg.setAttribute("viewBox",`${-area.width/2} ${-area.height/2} ${area.width} ${area.height}`);
    mapSvg.setAttribute("preserveAspectRatio","xMidYMid meet");

    if(!force&&renderKey===mapRenderKey){updateMap();return;}
    mapSvg.replaceChildren();

    // Organic deterministic node positioning
    const layoutFn=threads.layoutPeople||threads.placeNodes;
    const placed=layoutFn ? layoutFn(connections.map(item=>({id:item.person.id,pair:item})),{existing:Object.fromEntries(nodePositions)}) : [];
    const locations=connections.map((pair,index)=>{
      const pos=placed.find(p=>p.id===pair.person.id)||placed[index]||{x:(index%2?-1:1)*270,y:190};
      nodePositions.set(pair.person.id,{x:pos.x,y:pos.y});
      return {pair,x:pos.x,y:pos.y};
    });
    const coordinates=[{x:0,y:0},...locations],obstacles=coordinates.map((p,index)=>({x:p.x-(index?106:118),y:p.y-(index?145:163),width:index?212:236,height:index?290:326}));
    const measure=document.createElement("canvas").getContext("2d");if(measure)measure.font="10px Sarabun, sans-serif";
    const occupied=[],routes=[];
    locations.forEach(({pair,x,y},index)=>{
      const labels=["outgoing","incoming"].filter(direction=>pair[direction]&&(filter==="all"||direction===filter)).map(direction=>{
        const item=pair[direction],text=item.label||relationType(item.type).label;
        return {direction,width:Math.min(126,Math.max(32,Math.ceil((measure?measure.measureText(text).width:text.length*6)+14))),height:22};
      });
      threads.layout({x,y,reciprocal:Boolean(pair.outgoing&&pair.incoming),index,labels,obstacles,occupied}).forEach(route=>{occupied.push(route.label.bounds);routes.push({...route,pair,index});});
    });
    boardBounds=getBoardBounds(obstacles,occupied);

    world=svgNode("g",{class:"case-board-world"+(selected?" has-selection":"")});const edgeLayer=svgNode("g",{class:"case-thread-lines"}),labelLayer=svgNode("g",{class:"case-thread-labels"});world.append(edgeLayer,labelLayer);mapSvg.append(world);
    routes.sort((a,b)=>Number(a.pair.person.id===selected)-Number(b.pair.person.id===selected)).forEach(({pair,index,d,direction,label,curve})=>{
      const item=pair[direction],type=relationType(item.type),text=item.label||type.label,muted=selected&&pair.person.id!==selected;
      edgeLayer.append(svgNode("path",{d,stroke:"#150c08","stroke-width":3.8,"stroke-opacity":.46,transform:"translate(.9 1.8)",class:"case-thread-shadow"+(muted?" is-muted":""),"aria-hidden":"true"}));
      edgeLayer.append(svgNode("path",{d,stroke:"#35271e","stroke-width":2.8,"stroke-opacity":.82,class:"case-thread-outline"+(muted?" is-muted":""),"aria-hidden":"true"}));
      const line=svgNode("path",{d,stroke:type.color,"stroke-width":1.9,"stroke-opacity":1,"stroke-linecap":"round","stroke-linejoin":"round",class:"constellation-edge"+(pair.person.id===selected?" is-selected":"")+(muted?" is-muted":""),"data-person-id":pair.person.id,"data-direction":direction,tabindex:0,role:"button","aria-pressed":String(pair.person.id===selected),"aria-label":(direction==="outgoing"?character.name:pair.person.name)+" มองอีกฝ่ายเป็น "+text});
      const choose=event=>{event.stopPropagation();selectPair(pair.person.id,direction);};
      const hit=svgNode("path",{d,class:"case-thread-hit",stroke:"transparent","stroke-width":14,"vector-effect":"non-scaling-stroke","aria-hidden":"true"});hit.addEventListener("click",choose);edgeLayer.append(hit);line.addEventListener("click",choose);line.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();choose(event);}});edgeLayer.append(line);
      threads.fibers(curve).forEach((fiber,strand)=>edgeLayer.append(svgNode("path",{d:fiber,stroke:strand?"#3e2b20":"#e9dfc6","stroke-opacity":strand?.24:.36,"stroke-width":.4,class:"case-thread-fiber"+(muted?" is-muted":""),"aria-hidden":"true"})));
      const tag=svgNode("foreignObject",{x:label.x-label.width/2,y:label.y-label.height/2,width:label.width,height:label.height,"aria-hidden":"true",class:"case-thread-label"+(pair.person.id===selected?" is-selected":"")+(muted?" is-muted":""),"data-direction":direction,"data-person-id":pair.person.id});
      const paper=node("span",text,"case-thread-tag");paper.title=(direction==="outgoing"?character.name:pair.person.name)+" มอง "+(direction==="outgoing"?pair.person.name:character.name)+" เป็น "+text;paper.style.setProperty("--thread-tilt",(index%2?3:-3)+"deg");tag.append(paper);tag.addEventListener("click",choose);labelLayer.append(tag);
    });
    locations.forEach(({pair,x,y},index)=>addEvidencePerson(pair.person,x,y,false,index,pair));addEvidencePerson(data.character,0,0,true,-1,null);
    // The cords sit on the photographs; pins cap their ends above every layer.
    const pins=svgNode("g",{class:"case-board-pins","aria-hidden":"true"});
    const defs=svgNode("defs"),gradient=svgNode("radialGradient",{id:"caseboardPin",cx:"34%",cy:"26%",r:"75%"});
    [["0%","#f3c4a0"],["30%","#ce6848"],["66%","#99402b"],["100%","#5e2b20"]].forEach(([offset,color])=>gradient.append(svgNode("stop",{offset,"stop-color":color})));defs.append(gradient);pins.append(defs);
    coordinates.forEach((p,index)=>pins.append(svgNode("circle",{cx:p.x,cy:p.y+threads.pins[index?"secondary":"primary"],r:7,fill:"url(#caseboardPin)",class:selected&&index&&p.pair.person.id!==selected?"is-muted":""})));
    world.append(edgeLayer,labelLayer,pins);$(".constellation-empty").hidden=connections.length>0;
    if(!isManualView)fitViewport(area,boardBounds);else updateMap();mapRenderKey=renderKey;
  }
  function addEvidencePerson(person,x,y,center,index,pair){
    const width=center?236:212,height=center?326:290,isSelected=center?selected===null:person.id===selected;
    const group=svgNode("g",{transform:"translate("+x+" "+y+")",class:"constellation-node"+(center?" is-primary-node":"")+(isSelected?" is-selected":"")+(selected&&!center&&!isSelected?" is-muted":""),"data-person-id":center?"":person.id,"aria-pressed":String(isSelected),tabindex:0,role:"button","aria-label":(center?"ตัวละครหลัก: ":"ตัวละครที่เชื่อมโยง: ")+person.name});
    const foreign=svgNode("foreignObject",{x:-width/2,y:-height/2,width,height}),content=node("div",null,"case-person"+(center?" is-primary":""));
    content.style.setProperty("--case-tilt",center?".4deg":(index%2?1.5:-1.5)+"deg");content.append(face(person));
    const record=node("div",null,"case-person-record"),title=node("strong",person.name);title.title=person.name;
    const relationship=pair?.outgoing||pair?.incoming;record.append(title,node("span",center?"ตัวละครเจ้าของแฟ้ม":relationship?(relationship.label||relationType(relationship.type).label):person.characterType));
    content.append(record);foreign.append(content);group.append(foreign);const choose=()=>selectPair(center?null:person.id);
    group.addEventListener("click",choose);group.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();choose();}});world.append(group);
  }
  function syncReport(){
    const mobile=reportViewport.matches,open=mobile&&reportOpen&&tab==="relationships";
    relationPanel.classList.toggle("has-open-report",open);
    $("[data-report-dismiss]").hidden=!open;
    aside.inert=mobile&&!open;
    if(mobile&&!open)aside.setAttribute("aria-hidden","true");else aside.removeAttribute("aria-hidden");
    $(".constellation-workspace").inert=open;
  }
  function closeReport(restoreFocus=true){
    reportOpen=false;syncReport();
    if(restoreFocus){const target=[...mapSvg.querySelectorAll(".constellation-node")].find(item=>item.dataset.personId===(selected||""));target?.focus({preventScroll:true});}
  }
  function selectPair(id,direction=null){
    selected=id;selectedDirection=direction;reportOpen=true;renderMap();renderDetail();aside.scrollTop=0;
    if(reportViewport.matches)requestAnimationFrame(()=>aside.querySelector(".relationship-report-close")?.focus({preventScroll:true}));
  }
  function reportAction(label,kind,handler){
    const paths={evidence:"M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6M8 15h8m-4-4v8",edit:"m4 16.5-.8 4.3 4.3-.8L19.7 7.8a2.1 2.1 0 0 0-3-3L4 16.5Zm10.9-9.9 2.8 2.8",delete:"M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 3v7m4-7v7"};
    const button=action("",handler,"relationship-report-action"+(kind==="delete"?" is-danger":""));button.setAttribute("aria-label",label);button.title=label;button.dataset.tooltip=label;
    const icon=svgNode("svg",{viewBox:"0 0 24 24","aria-hidden":"true",focusable:"false"});icon.append(svgNode("path",{d:paths[kind]}));button.append(icon);return button;
  }
  function reportAssessment(record,author,emptyText,own=false){
    const section=node("section",null,"relationship-report-assessment"),head=node("header");head.append(node("span",own?"มุมมองของเรา":"มุมมองของ "+author));head.title="มุมมองของ "+author;
    if(record?.type){const type=relationType(record.type),badge=node("span",record.label||type.label,"relationship-report-relation");badge.style.setProperty("--relationship-color",type.color);head.append(badge);}section.append(head);
    if(record?.note?.trim()){const quote=node("blockquote"),text=node("q",record.note.trim());quote.append(text);section.append(quote);}
    else if(emptyText)section.append(node("p",emptyText,"relationship-report-empty"));return section;
  }
  function reciprocalSummary(details,author,contentId){
    const summary=node("summary",null,"relationship-reciprocal-summary"),label=node("span",null,"relationship-reciprocal-label"),eye=node("span",null,"relationship-reciprocal-eye");
    label.append(node("small","มุมมองจากอีกฝ่าย"),node("span",author));eye.setAttribute("aria-hidden","true");
    eye.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" class="relationship-eye-open" aria-hidden="true" focusable="false"><path d="M0 0h24v24H0z" fill="none"/><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M21.257 10.962c.474.62.474 1.457 0 2.076C19.764 14.987 16.182 19 12 19s-7.764-4.013-9.257-5.962a1.69 1.69 0 0 1 0-2.076C4.236 9.013 7.818 5 12 5s7.764 4.013 9.257 5.962"/><circle cx="12" cy="12" r="3"/></g></svg><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" class="relationship-eye-closed" aria-hidden="true" focusable="false"><path d="M0 0h24v24H0z" fill="none"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 10s3.5 4 10 4s10-4 10-4M4 11.645L2 14m20 0l-1.996-2.352M8.914 13.68L8 16.5m7.063-2.812L16 16.5"/></svg>';
    summary.append(label,eye);summary.setAttribute("aria-controls",contentId);
    const sync=()=>{summary.setAttribute("aria-expanded",String(details.open));summary.setAttribute("aria-label",(details.open?"ซ่อน":"แสดง")+"มุมมองจาก "+author);summary.title=details.open?"ซ่อนมุมมอง":"แสดงมุมมอง";};details.addEventListener("toggle",sync);sync();return summary;
  }
  function renderDetail(){
    if(!data)return;aside.replaceChildren();const pair=pairs().find(item=>item.person.id===selected),person=pair?.person||data.character;
    relationPanel.classList.toggle("has-no-selection",!pair);aside.classList.toggle("is-empty",!pair);aside.classList.add("relationship-report-mode");
    const report=node("article",null,"relationship-report"),documentHead=node("header",null,"relationship-report-masthead");
    const documentTitle=node("div",null,"relationship-report-title");documentTitle.append(node("span","PERSONNEL REPORT"));documentHead.append(documentTitle);report.append(documentHead);
    const identity=node("section",null,"relationship-report-identity"),copy=node("div",null,"relationship-report-person");
    copy.append(node("h3",person.name));if(person.byname&&person.byname!==person.name)copy.append(node("p",person.byname,"relationship-report-byname"));
    const position=person.characterType==="President"?"President":person.position||(!pair?character.position:"")||"ไม่ระบุตำแหน่ง";
    copy.append(node("p",position,"relationship-report-position"));identity.append(face(person),copy);report.append(identity);
    if(!pair){
      if(character.quote?.trim())report.append(reportAssessment({note:character.quote},character.byname||character.name,""));
      const hint=pairs().length?"เลือกการ์ดบนกระดานเพื่ออ่านบันทึกของบุคคลนั้น":"ยังไม่มีสายสัมพันธ์ในแฟ้มนี้";
      report.append(node("p",hint,"relationship-report-empty relationship-report-map-hint"));
    }else{
      report.append(reportAssessment(pair.outgoing,character.byname||character.name,"ยังไม่มีบันทึกมุมมองจากฝั่งนี้",true));
      const evidence=pair.outgoing?.evidence||[];

      const reciprocal=pair.incoming;
      if(reciprocal){
        const incoming=node("details",null,"relationship-report-reciprocal"),author=pair.person.byname||pair.person.name,content=node("div",null,"relationship-reciprocal-content");content.id="relationship-incoming-"+pair.person.id;incoming.open=selectedDirection==="incoming"||!pair.outgoing;incoming.append(reciprocalSummary(incoming,author,content.id),content);
        content.append(reportAssessment(reciprocal,author,"ยังไม่มีบันทึกเพิ่มเติม"));
        (reciprocal.evidence||[]).forEach((entry,index)=>content.append(evidenceCard(entry,author,pair,false,index)));report.append(incoming);
      }
      if(evidence.length){const attachments=node("section",null,"relationship-report-attachments");attachments.append(node("h4","บันทึกและหลักฐาน"));evidence.forEach((entry,index)=>attachments.append(evidenceCard(entry,character.byname||character.name,pair,data.canEditRelationships,index)));report.append(attachments);}
      if(data.canEditRelationships){const controls=node("div",null,"relationship-report-actions");controls.setAttribute("role","group");controls.setAttribute("aria-label","จัดการสายสัมพันธ์");if(pair.outgoing)controls.append(reportAction("เพิ่มหลักฐาน","evidence",()=>editEvidence(pair)));controls.append(reportAction(pair.outgoing?"แก้ไขความสัมพันธ์":"เพิ่มมุมมองของฉัน","edit",()=>editRelationship(pair)));if(pair.outgoing)controls.append(reportAction("ลบความสัมพันธ์","delete",()=>removeRelationship(pair)));documentHead.append(controls);}
    }
    documentHead.append(action("ปิดรายงาน",()=>closeReport(),"relationship-report-close"));aside.append(report);syncReport();
  }
  function updateMap(){world?.setAttribute("transform",`translate(${pan.x} ${pan.y}) scale(${pan.zoom})`);}
  $("[data-relation-filter]").addEventListener("change",event=>{filter=event.target.value;if(selected&&!pairs().some(item=>item.person.id===selected)){selected=null;selectedDirection=null;}else if(selected&&filter!=="all")selectedDirection=filter;renderMap();renderDetail();});
  function fitMap(){if(data){isManualView=false;renderMap(true);}}
  $("[data-map-fit]").addEventListener("click",fitMap);$("[data-map-zoom-in]").addEventListener("click",()=>{isManualView=true;pan.zoom=Math.min(2.5,pan.zoom*1.2);updateMap();});$("[data-map-zoom-out]").addEventListener("click",()=>{isManualView=true;pan.zoom=Math.max(.25,pan.zoom/1.2);updateMap();});
  mapSvg=$(".constellation-canvas");
  let mapResizeFrame=0;new ResizeObserver(()=>{cancelAnimationFrame(mapResizeFrame);mapResizeFrame=requestAnimationFrame(()=>{if(dialog.open&&!loadingData&&tab==="relationships"){const area=mapSvg.getBoundingClientRect();if(area.width<100||area.height<100)return;mapSvg.setAttribute("viewBox",`${-area.width/2} ${-area.height/2} ${area.width} ${area.height}`);if(!isManualView&&boardBounds)fitViewport(area,boardBounds);else updateMap();}});}).observe($(".constellation-workspace"));
  function mapPoint(x,y){const matrix=mapSvg.getScreenCTM();return matrix?new DOMPoint(x,y).matrixTransform(matrix.inverse()):{x:0,y:0};}
  function zoomAt(x,y,next){isManualView=true;const point=mapPoint(x,y),zoom=Math.max(.25,Math.min(2.5,next)),factor=zoom/pan.zoom;pan.x=point.x-(point.x-pan.x)*factor;pan.y=point.y-(point.y-pan.y)*factor;pan.zoom=zoom;updateMap();}
  mapSvg.addEventListener("wheel",event=>{event.preventDefault();zoomAt(event.clientX,event.clientY,pan.zoom*Math.exp(-event.deltaY*.0015));},{passive:false});
  mapSvg.addEventListener("pointerdown",event=>{if(event.target.closest(".constellation-node")||event.target.closest(".constellation-edge,.case-thread-hit,.case-thread-label")||event.button>0)return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});mapSvg.setPointerCapture(event.pointerId);mapSvg.classList.add("is-panning");gesture={points:[...pointers.values()],pan:{...pan}};});
  mapSvg.addEventListener("pointermove",event=>{if(!pointers.has(event.pointerId)||!gesture)return;const previous=[...pointers.values()];pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});const points=[...pointers.values()];if(points.length===1){isManualView=true;const before=mapPoint(previous[0].x,previous[0].y),after=mapPoint(points[0].x,points[0].y);pan.x+=after.x-before.x;pan.y+=after.y-before.y;updateMap();}else{const distance=values=>Math.hypot(values[1].x-values[0].x,values[1].y-values[0].y);const old=distance(previous);if(old>0)zoomAt((points[0].x+points[1].x)/2,(points[0].y+points[1].y)/2,pan.zoom*distance(points)/old);}});
  function endPan(event){pointers.delete(event.pointerId);if(!pointers.size){gesture=null;mapSvg.classList.remove("is-panning");}else gesture={points:[...pointers.values()],pan:{...pan}};}
  ["pointerup","pointercancel","lostpointercapture"].forEach(type=>mapSvg.addEventListener(type,endPan));

  function beginEditor(title){
    editDialog.classList.remove("collection-evidence-editor","collection-relationship-editor","voice-line-editor");
    searchAbort?.abort();clearTimeout(searchTimer);
    editSource?.destroy();editSource=null;editDirty=false;editBusy=false;
    editDialog.innerHTML='<header class="collection-edit-header"><div><span class="collection-eyebrow">PERSONAL COLLECTION</span><h2></h2></div><button type="button" data-edit-close>ปิด</button></header><form><div data-edit-content></div><p class="collection-error" data-edit-error role="alert"></p><footer class="collection-form-footer"><button type="button" data-edit-cancel>ยกเลิก</button><button type="submit" class="collection-save">บันทึก</button></footer></form>';
    editDialog.querySelector("h2").textContent=title;editDialog.querySelector("[data-edit-close]").addEventListener("click",closeEditor);editDialog.querySelector("[data-edit-cancel]").addEventListener("click",closeEditor);
    const form=editDialog.querySelector("form");form.addEventListener("input",()=>{editDirty=true;});form.addEventListener("change",()=>{editDirty=true;});
    return {form,content:editDialog.querySelector("[data-edit-content]"),error:editDialog.querySelector("[data-edit-error]")};
  }
  async function commitEditor(form,error,save){
    if(editBusy)return;editBusy=true;error.textContent="";form.querySelectorAll("input,textarea,select,button").forEach(control=>{control.disabled=true;});editSource?.setDisabled(true);
    try{await save();editDirty=false;await load();editSource?.destroy();editDialog.close();status("บันทึกข้อมูลแล้ว");}
    catch(problem){error.textContent=problem.message;}
    finally{editBusy=false;form.querySelectorAll("input,textarea,select,button").forEach(control=>{control.disabled=false;});editSource?.setDisabled(false);}
  }
  function editRelationship(pair){
    if(!data?.canEditRelationships)return;
    const existing=pair?.outgoing,ui=beginEditor(existing?"แก้ไขความสัมพันธ์":"เพิ่มความสัมพันธ์");let target=pair?.person||null,searchSerial=0;
    editDialog.classList.add("collection-relationship-editor");
    editDialog.querySelector(".collection-eyebrow").textContent="RELATIONSHIP FILE";
    ui.content.innerHTML='<div class="relationship-editor-workspace"><section class="relationship-person-browser"><header class="relationship-editor-section-head"><span>01 / CHARACTER</span><h3 data-browser-title>เลือกตัวละคร</h3></header><label data-target-search-label><span class="relationship-sr-only">ค้นหาตัวละคร</span><span class="relationship-search-box"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input data-target-search placeholder="ค้นหาชื่อหรือฉายา" autocomplete="off"></span></label><p class="relationship-type-policy" data-target-policy></p><div class="relationship-search-results" data-target-results aria-label="ตัวละครในคอมมู"></div><div class="relationship-selected" data-target-selected hidden></div><p class="relationship-search-status" data-target-status role="status" aria-live="polite"></p></section><section class="relationship-record-panel"><header class="relationship-editor-section-head"><span>02 / RELATIONSHIP</span><h3>บันทึกสายสัมพันธ์</h3><p data-perspective-name></p></header><div class="relationship-target-preview" data-target-preview></div><div class="relationship-type-picker"><span class="relationship-field-title">ประเภทความสัมพันธ์</span><div class="relationship-type-options" data-type-options role="group" aria-label="ประเภทความสัมพันธ์"></div><select data-relation-type aria-label="ประเภทความสัมพันธ์" tabindex="-1" hidden></select></div><label class="relationship-form-field"><span class="relationship-field-title">คำเรียกความสัมพันธ์ <small>ไม่บังคับ</small></span><input data-relation-label maxlength="80" placeholder="เช่น เพื่อนคนสำคัญ"></label><label class="relationship-form-field relationship-note-field"><span class="relationship-field-title">บันทึกจากมุมมองของคุณ</span><textarea data-relation-note rows="5" maxlength="5000" placeholder="ความรู้สึกหรือเรื่องราวระหว่างตัวละครทั้งสอง…"></textarea></label></section></div>';
    const query=ui.content.querySelector("[data-target-search]"),results=ui.content.querySelector("[data-target-results]"),chosen=ui.content.querySelector("[data-target-selected]"),type=ui.content.querySelector("[data-relation-type]"),preview=ui.content.querySelector("[data-target-preview]"),searchState=ui.content.querySelector("[data-target-status]"),submit=ui.form.querySelector('[type="submit"]');
    const friendlyType=person=>({Character:"Arcanist",HeadDirector:"President",Monster:"Enemy"}[person.characterType]||person.characterType||"Community character");
    ui.content.querySelector("[data-perspective-name]").textContent="มุมมองของ "+(character.byname||character.name);
    const targetPolicy=ui.content.querySelector("[data-target-policy]");
    if(Array.isArray(data.relationshipTargetTypes))targetPolicy.textContent="Director · Arcanist · Human · NPC";else targetPolicy.hidden=true;
    const options=ui.content.querySelector("[data-type-options]");
    function syncTypes(){options.querySelectorAll("button").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.type===type.value)));}
    data.types.forEach(item=>{
      type.add(new Option(item.label,item.id));const button=action("",()=>{type.value=item.id;type.dispatchEvent(new Event("change",{bubbles:true}));syncTypes();},"relationship-type-option");button.dataset.type=item.id;button.style.setProperty("--relationship-color",item.color);button.append(node("i"),node("span",item.label));options.append(button);
    });
    type.value=existing?.type||"friend";syncTypes();
    ui.content.querySelector("[data-relation-label]").value=existing?.label||"";ui.content.querySelector("[data-relation-note]").value=existing?.note||"";
    function personCopy(person){const copy=node("span",null,"relationship-choice-copy");copy.append(node("strong",person.byname||person.name),node("small",person.byname?person.name:friendlyType(person)));return copy;}
    function showTarget(){
      chosen.replaceChildren();preview.replaceChildren();
      ui.content.querySelector("[data-target-search-label]").hidden=Boolean(existing);results.hidden=Boolean(existing);chosen.hidden=!existing;preview.hidden=Boolean(existing);
      if(existing){ui.content.querySelector("[data-browser-title]").textContent="บุคคลในแฟ้ม";targetPolicy.hidden=true;chosen.append(face(target),personCopy(target),node("span",friendlyType(target),"relationship-person-type"));}
      else if(target){preview.classList.add("has-person");preview.append(face(target),personCopy(target));}
      else{preview.classList.remove("has-person");preview.append(node("span","เลือกตัวละครจากรายชื่อ","relationship-selection-hint"));}
      results.querySelectorAll("[data-person-id]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.personId===target?.id)));
      submit.disabled=!target;submit.textContent=existing?"บันทึกการแก้ไข":"บันทึกความสัมพันธ์";
    }
    async function search(){
      searchAbort?.abort();searchAbort=new AbortController();const serial=++searchSerial;results.setAttribute("aria-busy","true");searchState.textContent="กำลังค้นหา…";
      try{
        const found=await media.request("characters/search?q="+encodeURIComponent(query.value.trim())+"&exclude="+encodeURIComponent(character.id)+"&sourceId="+encodeURIComponent(character.id),{signal:searchAbort.signal});
        if(serial!==searchSerial||!query.isConnected)return;results.replaceChildren();
        found.characters.forEach(person=>{const button=action("",()=>{target=person;editDirty=true;showTarget();},"relationship-character-choice");button.dataset.personId=person.id;button.setAttribute("aria-pressed",String(person.id===target?.id));button.append(face(person),personCopy(person));results.append(button);});
        searchState.textContent=found.characters.length?"":"ไม่พบตัวละคร ลองค้นหาชื่ออื่น";
      }catch(error){if(error.name!=="AbortError"&&query.isConnected){searchState.textContent="";ui.error.textContent=error.message;}}
      finally{if(serial===searchSerial)results.removeAttribute("aria-busy");}
    }
    query.addEventListener("input",()=>{clearTimeout(searchTimer);searchTimer=setTimeout(search,250);});showTarget();
    ui.form.addEventListener("submit",event=>{
      event.preventDefault();if(!target){ui.error.textContent="เลือกตัวละครก่อนบันทึก";return;}
      const payload={targetId:target.id,type:type.value,label:ui.content.querySelector("[data-relation-label]").value,note:ui.content.querySelector("[data-relation-note]").value,version:existing?.version||0};selected=target.id;
      commitEditor(ui.form,ui.error,()=>media.request(endpoint+"/relationships",{method:"POST",body:JSON.stringify(payload)}));
    });
    editDialog.showModal();if(!existing)search();editDirty=false;
  }
  let evidenceViewer=null;
  function viewEvidenceImage(entry){
    if(!entry.imageUrl)return;
    if(!evidenceViewer){evidenceViewer=node("dialog",null,"collection-evidence-viewer");document.body.append(evidenceViewer);evidenceViewer.addEventListener("click",event=>{if(event.target===evidenceViewer)evidenceViewer.close();});}
    evidenceViewer.replaceChildren();const header=node("header"),title=node("h2",entry.title||"รูปหลักฐาน");header.append(title,action("ปิด",()=>evidenceViewer.close()));const image=node("img");image.src=entry.imageUrl;image.alt=entry.title||"รูปหลักฐาน";evidenceViewer.append(header,image);if(entry.text)evidenceViewer.append(node("p",entry.text));evidenceViewer.showModal();
  }
  function evidenceCard(entry,owner,pair,editable,index){
    const card=node("article",null,"relationship-field-note relationship-evidence-card");const stamp=node("span","EXHIBIT / "+String(index+1).padStart(2,"0"));stamp.title=owner;card.append(stamp);
    if(entry.imageUrl){const preview=action("",()=>viewEvidenceImage(entry),"relationship-evidence-image"),image=node("img");image.src=entry.imageUrl;image.alt=entry.title||"รูปหลักฐาน";image.loading="lazy";preview.setAttribute("aria-label","ดูภาพเต็ม: "+(entry.title||"หลักฐาน"));preview.append(image);card.append(preview);}
    if(entry.title)card.append(node("h4",entry.title));if(entry.text)card.append(node("p",entry.text));
    if(editable){const controls=node("div",null,"relationship-evidence-actions");controls.append(action("แก้ไข",()=>editEvidence(pair,entry)),action("นำออก",()=>removeEvidence(pair,entry)));card.append(controls);}return card;
  }
  function evidencePayload(pair,evidence){
    const record=pair.outgoing;return {targetId:pair.person.id,type:record.type,label:record.label,note:record.note,version:record.version,evidence:evidence.map(entry=>({id:entry.id,title:entry.title||"",text:entry.text||"",imageAssetId:entry.imageAssetId||null}))};
  }
  function editEvidence(pair,entry=null){
    if(!data?.canEditRelationships||!pair.outgoing||busy||editBusy)return;
    const ui=beginEditor(entry?"แก้ไขหลักฐาน":"เพิ่มหลักฐาน");editDialog.classList.add("collection-evidence-editor");
    ui.content.innerHTML='<div class="evidence-editor-workspace"><section class="evidence-upload-panel"><span class="evidence-section-label">ภาพหลักฐาน</span><div class="evidence-image-preview"><img data-evidence-preview alt="รูปหลักฐานที่เลือก" hidden><button type="button" data-evidence-choose><span aria-hidden="true">+</span><strong>เพิ่มภาพหลักฐาน</strong><small>ไม่บังคับ</small></button></div><input data-evidence-file type="file" accept="image/*" hidden><div class="evidence-image-actions"><button type="button" data-evidence-change hidden>เปลี่ยนรูป</button><button type="button" data-evidence-remove-image hidden>เอารูปออก</button></div><progress data-evidence-progress max="100" value="0" hidden></progress><p data-evidence-upload-status role="status"></p></section><section class="evidence-editor-details"><span class="evidence-section-label">รายละเอียดหลักฐาน</span><label>ชื่อหลักฐาน <small>ไม่บังคับ</small><input data-evidence-title maxlength="160" placeholder="เช่น จดหมายฉบับแรก"></label><label>บันทึก / คำบรรยาย<textarea data-evidence-text rows="7" maxlength="5000" placeholder="เรื่องราวหรือรายละเอียดของหลักฐานชิ้นนี้…"></textarea></label></section></div>';
    const $=selector=>ui.content.querySelector(selector),title=$("[data-evidence-title]"),text=$("[data-evidence-text]"),file=$("[data-evidence-file]"),preview=$("[data-evidence-preview]"),choose=$("[data-evidence-choose]"),message=$("[data-evidence-upload-status]"),progress=$("[data-evidence-progress]");
    const submit=ui.form.querySelector('[type="submit"]');submit.textContent="บันทึกหลักฐาน";
    title.value=entry?.title||"";text.value=entry?.text||"";
    let imageAssetId=entry?.imageAssetId||null,imageUrl=entry?.imageUrl||"",uploading=false,locked=false,objectUrl="";
    const pending=new Set(),entryId=entry?.id||crypto.randomUUID();
    function refresh(){
      preview.hidden=!imageUrl;if(imageUrl)preview.src=imageUrl;else preview.removeAttribute("src");choose.hidden=Boolean(imageUrl);$("[data-evidence-change]").hidden=!imageUrl;$("[data-evidence-remove-image]").hidden=!imageUrl;
      editDialog.querySelectorAll("input,textarea,button").forEach(control=>{control.disabled=uploading||locked;});submit.disabled=uploading||locked||!(title.value.trim()||text.value.trim()||imageAssetId);
      progress.hidden=!uploading;editDialog.setAttribute("aria-busy",String(uploading||locked));
    }
    choose.addEventListener("click",()=>file.click());$("[data-evidence-change]").addEventListener("click",()=>file.click());
    $("[data-evidence-remove-image]").addEventListener("click",()=>{imageAssetId=null;imageUrl="";editDirty=true;refresh();});
    title.addEventListener("input",refresh);text.addEventListener("input",refresh);
    file.addEventListener("change",async()=>{
      const chosen=file.files?.[0];if(!chosen)return;const before={imageAssetId,imageUrl};uploading=true;editDirty=true;ui.error.textContent="";message.textContent="กำลังเตรียมรูป…";progress.value=0;
      objectUrl=URL.createObjectURL(chosen);imageUrl=objectUrl;refresh();
      try{const result=await media.upload(chosen,"EVIDENCE",character.id,percent=>{progress.value=percent;message.textContent="กำลังอัปโหลดรูป "+percent+"%";});pending.add(result.id);imageAssetId=result.id;imageUrl=result.url;message.textContent="รูปพร้อมบันทึกแล้ว";}
      catch(error){imageAssetId=before.imageAssetId;imageUrl=before.imageUrl;message.textContent="";ui.error.textContent=error.message;}
      finally{if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl="";uploading=false;file.value="";refresh();}
    });
    editSource={isBusy:()=>uploading,setDisabled(value){locked=value;refresh();},destroy(){if(objectUrl)URL.revokeObjectURL(objectUrl);pending.forEach(id=>media.request("media/uploads",{method:"DELETE",body:JSON.stringify({id})}).catch(()=>{}));pending.clear();}};
    ui.form.addEventListener("submit",event=>{
      event.preventDefault();if(uploading||locked)return;const item={id:entryId,title:title.value.trim(),text:text.value.trim(),imageAssetId};
      if(!item.title&&!item.text&&!imageAssetId){ui.error.textContent="เพิ่มข้อความหรือรูปก่อนบันทึก";return;}
      const evidence=(pair.outgoing.evidence||[]).slice(),index=evidence.findIndex(existing=>existing.id===entryId);if(index<0)evidence.push(item);else evidence[index]=item;
      commitEditor(ui.form,ui.error,()=>media.request(endpoint+"/relationships",{method:"POST",body:JSON.stringify(evidencePayload(pair,evidence))}));
    });refresh();editDialog.showModal();editDirty=false;
  }
  async function removeEvidence(pair,entry){
    if(busy||!data?.canEditRelationships||!pair.outgoing||!await confirmAction("นำหลักฐานชิ้นนี้ออก?",entry.title||"นำบันทึกและรูปชิ้นนี้ออกจากสายสัมพันธ์","นำหลักฐานออก"))return;
    busy=true;try{const evidence=(pair.outgoing.evidence||[]).filter(item=>item.id!==entry.id);await media.request(endpoint+"/relationships",{method:"POST",body:JSON.stringify(evidencePayload(pair,evidence))});await load();}catch(error){status(error.message,true);}finally{busy=false;}
  }

  async function removeRelationship(pair){if(busy||!await confirmAction("ลบมุมมองของคุณ?","ข้อมูลที่อีกฝ่ายมีต่อตัวละครนี้จะยังแสดงอยู่","ลบมุมมองนี้"))return;busy=true;try{await media.request(endpoint+"/relationships",{method:"DELETE",body:JSON.stringify({targetId:pair.person.id,version:pair.outgoing.version})});await load();}catch(error){status(error.message,true);}finally{busy=false;}}

  function renderVoices(){
    if(!data)return;voicePanel.replaceChildren();
    const artwork=node("div",null,"voice-archive-art"),imageUrl=character.image||character.detailImage;
    if(imageUrl){const image=node("img");image.src=imageUrl;image.alt=character.byname||character.name;image.loading="eager";image.decoding="async";window.RNCImageLayout?.apply(image,character,"profile");artwork.append(image);}else artwork.append(node("span",character.byname||character.name,"voice-archive-art-empty"));
    const list=node("div",null,"voice-archive-list"),listHead=node("header",null,"voice-archive-list-head");listHead.append(node("span","VOICE LINES"),node("span",String(data.voiceLines.length).padStart(2,"0")));list.append(listHead);
    if(!data.voiceLines.length){list.append(node("p",data.canEdit?"ยังไม่มี Voice Line หรือโน้ต":"ตัวละครนี้ยังไม่มี Voice Line หรือโน้ต","collection-empty-note"));voicePanel.append(artwork,list);return;}
    const entries=node("div",null,"voice-line-entries");
    data.voiceLines.forEach((line,index)=>{
      const note=isVoiceNote(line);
      const item=node("article",null,note?"voice-line-row voice-line-row-note":"voice-line-row");
      const copy=action("",()=>note?openVoiceNote(line):openVoicePlayer(index),"voice-line-copy");
      copy.setAttribute("aria-label",(note?"อ่านโน้ต ":"เปิดเทป ")+line.title);
      const heading=node("span",null,"voice-line-heading");heading.append(node("small",note?noteLabel(line):line.category||"VOICE LINE"),node("strong",line.title));
      const transcript=node("span",line.transcript||"","voice-line-transcript");if(!line.transcript)transcript.classList.add("is-empty");copy.append(heading,transcript);if(line.credit){copy.append(node("small","เครดิตเสียง · "+line.credit,"voice-line-credit"));}
      item.append(copy);
      if(!note){
        const play=action("",()=>openVoicePlayer(index,true),"voice-line-play");
        play.setAttribute("aria-label","เล่นเสียง "+line.title);
        play.title="เล่นเสียง";
        play.innerHTML=transportIcons.play;
        item.append(play);
      }
      if(data.canEdit){const manage=node("details",null,"voice-tape-manage voice-line-manage"),summary=node("summary","···");summary.setAttribute("aria-label",(note?"จัดการโน้ต ":"จัดการเสียง ")+line.title);manage.append(summary);const controls=node("div",null,"voice-line-actions");controls.append(action("แก้ไข",()=>editVoice(line)),action("ลบ",()=>removeVoice(line),"collection-danger"));if(index>0)controls.append(action("เลื่อนขึ้น",()=>moveVoice(index,-1)));if(index<data.voiceLines.length-1)controls.append(action("เลื่อนลง",()=>moveVoice(index,1)));manage.append(controls);item.append(manage);}
      entries.append(item);
    });list.append(entries);voicePanel.append(artwork,list);
  }
  function editVoice(line){
    if(!data?.canEdit)return;media.stop();const ui=beginEditor(line?"แก้ไข Voice Line":"เพิ่ม Voice Line");editDialog.classList.add("voice-line-editor");editDialog.querySelector(".collection-eyebrow").textContent="VOICE ARCHIVE";editDialog.querySelector(".collection-edit-header>div").append(node("p","บันทึกเสียง บทพูด และช่วงเวลาที่ต้องการเก็บไว้","voice-line-editor-subtitle"));ui.content.innerHTML='<div class="voice-line-editor-form"><section class="voice-line-editor-section voice-line-editor-meta"><header class="voice-line-section-heading"><span>01</span><div><small>RECORD DETAILS</small><h3>ข้อมูลรายการ</h3></div></header><div class="voice-line-meta-grid"><label class="voice-title-field">ชื่อ Voice Line<input data-voice-title maxlength="160" required placeholder="เช่น แนะนำตัว"></label><label><span class="voice-line-label-row">หมวดหมู่ <small>ไม่บังคับ</small></span><input data-voice-category maxlength="80" placeholder="ทักทาย / การต่อสู้"></label></div></section><section class="voice-line-editor-section voice-line-editor-audio"><header class="voice-line-section-heading"><span>02</span><div><small>AUDIO SOURCE</small><h3>แหล่งเสียง</h3></div><p>เพิ่มไฟล์เสียงหรือลิงก์ หรือบันทึกเป็นโน้ต</p></header><div data-voice-source></div></section><section class="voice-line-editor-section voice-line-editor-transcript"><header class="voice-line-section-heading"><span>03</span><div><small>TRANSCRIPT</small><h3>บทพูดและเครดิต</h3></div></header><div class="voice-line-transcript-grid"><label><span class="voice-line-label-row">บทพูด <small>ไม่บังคับ</small></span><textarea data-voice-transcript maxlength="5000" rows="4" placeholder="บันทึกข้อความที่ตัวละครพูด"></textarea></label><label><span class="voice-line-label-row">เครดิตเสียง <small>ไม่บังคับ</small></span><input data-voice-credit maxlength="160" placeholder="ชื่อผู้ให้เสียงหรือแหล่งที่มา"></label></div></section></div>';
    const title=ui.content.querySelector("[data-voice-title]");title.value=line?.title||"";ui.content.querySelector("[data-voice-category]").value=line?.category||"";ui.content.querySelector("[data-voice-transcript]").value=line?.transcript||"";ui.content.querySelector("[data-voice-credit]").value=line?.credit||"";
    const sourceContainer=ui.content.querySelector("[data-voice-source]");
    const saveButton=editDialog.querySelector(".collection-save");
    function updateVoiceSaveLabel(){
      const note=sourceContainer.querySelector("[data-source-type]").value==="NONE";
      saveButton.textContent=note?"บันทึกโน้ต":line?"บันทึกการแก้ไข":"บันทึก Voice Line";
    }
    editSource=media.sourceEditor(sourceContainer,{
      initial:line,characterId:character.id,reusable:data.voiceLines,allowNoAudio:true,
      onChange(){editDirty=true;updateVoiceSaveLabel();},
      onUploaded(file){if(!title.value)title.value=file.name.replace(/\.[^.]+$/,"");}
    });
    updateVoiceSaveLabel();
    const newId=crypto.randomUUID();
    ui.form.addEventListener("submit",event=>{event.preventDefault();try{if(editSource.isBusy())throw new Error("รออัปโหลดไฟล์เสียงให้เสร็จก่อนบันทึก");const payload={...editSource.value(),id:line?.id||newId,version:line?.version||0,title:title.value.trim(),category:ui.content.querySelector("[data-voice-category]").value,transcript:ui.content.querySelector("[data-voice-transcript]").value,credit:ui.content.querySelector("[data-voice-credit]").value,sortOrder:line?.sortOrder??Math.max(-1,...data.voiceLines.map(item=>item.sortOrder))+1};commitEditor(ui.form,ui.error,()=>media.request(endpoint+"/voice-lines",{method:line?"PUT":"POST",body:JSON.stringify(payload)}));}catch(error){ui.error.textContent=error.message;}});editDialog.showModal();editDirty=false;
  }
  async function removeVoice(line){if(busy||!await confirmAction("ลบ Voice Line?",line.title,"ลบ Voice Line"))return;busy=true;media.stop();try{await media.request(endpoint+"/voice-lines",{method:"DELETE",body:JSON.stringify({id:line.id,version:line.version})});await load();}catch(error){status(error.message,true);}finally{busy=false;}}
  async function moveVoice(index,step){if(busy)return;busy=true;const order=data.voiceLines.slice();[order[index],order[index+step]]=[order[index+step],order[index]];try{await media.request(endpoint+"/voice-lines",{method:"PUT",body:JSON.stringify({order:order.map(line=>({id:line.id,version:line.version}))})});await load();}catch(error){status(error.message,true);}finally{busy=false;}}

  window.RNCCharacterCollection = { open: openCollection };
})();
