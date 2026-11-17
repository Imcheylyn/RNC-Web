(function () {
  "use strict";
  const apiRoot = "/api/community/";
  async function request(path, options = {}) {
    const response = await fetch(path.startsWith("/") ? path : apiRoot + path, {credentials:"same-origin",cache:"no-store",...options,headers:{Accept:"application/json",...(options.body ? {"Content-Type":"application/json"} : {}),...options.headers},signal:options.signal || AbortSignal.timeout(60000)});
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(body.error || "โหลดข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง"); error.status = response.status; throw error; }
    return body;
  }
  function time(value) {
    if (value === "" || value === undefined || value === null) return null;
    const parts = String(value).trim().split(":");
    if (parts.length > 3 || !parts.every(item => /^\d+(?:\.\d+)?$/.test(item)) || parts.slice(1).some(item => Number(item) >= 60)) throw new Error("ระบุเวลาเป็นนาที:วินาที เช่น 01:24");
    return parts.reduce((total,item) => total * 60 + Number(item),0);
  }
  function formatTime(value) {
    const milliseconds = Math.max(0,Math.round((Number(value) || 0)*1000)), seconds=Math.floor(milliseconds/1000);
    const fraction=milliseconds%1000 ? "."+String(milliseconds%1000).padStart(3,"0").replace(/0+$/,"") : "";
    return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2,"0")+fraction;
  }
  function youtubeId(value) {
    if (/^[\w-]{11}$/.test(value || "")) return value;
    try {
      const url = new URL(value), host = url.hostname.replace(/^(www\.|m\.)/,"");
      const id = host === "youtu.be" ? url.pathname.split("/")[1] : ["youtube.com","youtube-nocookie.com"].includes(host) ? url.searchParams.get("v") || url.pathname.split("/")[2] : "";
      if (/^[\w-]{11}$/.test(id || "")) return id;
    } catch {}
    throw new Error("กรุณาใช้ลิงก์วิดีโอ YouTube ที่ถูกต้อง");
  }

  let youtubeReady, active = null, playerSerial = 0;
  function loadYouTube() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (!youtubeReady) youtubeReady = new Promise((resolve,reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      const timer = setTimeout(() => { youtubeReady = null; reject(new Error("โหลดเครื่องเล่น YouTube ไม่สำเร็จ")); },20000);
      window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); if (typeof previous === "function") previous(); resolve(window.YT); };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) { const script = document.createElement("script"); script.src = "https://www.youtube.com/iframe_api"; script.onerror = () => {clearTimeout(timer);youtubeReady = null;script.remove();reject(new Error("โหลดเครื่องเล่น YouTube ไม่สำเร็จ"));}; document.head.append(script); }
    });
    return youtubeReady;
  }
  function notify(item,state) { if(active!==item && state!=="stopped")return;item.state=state;item.onState?.(state); }
  function stop() {
    if(!active)return;const old=active;active=null;clearInterval(old.timer);
    old.audio?.pause();old.youtube?.destroy();old.mount.replaceChildren();old.mount.hidden=true;
    old.mount.classList.remove("is-youtube");old.mount.removeAttribute?.("aria-hidden");notify(old,"stopped");
  }
  function readTime(item) { try{return Number(item?.audio?.currentTime??item?.youtube?.getCurrentTime?.())||0;}catch{return 0;} }
  function readDuration(item) { try{const value=Number(item?.audio?.duration??item?.youtube?.getDuration?.());return Number.isFinite(value)&&value>0?value:0;}catch{return 0;} }
  function currentTime(mount) { return mount&&active?.mount!==mount?0:readTime(active); }
  function clipProgress(item) {
    const total=readDuration(item),until=item.end===null?total:Math.min(item.end,total||item.end),duration=Math.max(0,until-item.start),absolute=readTime(item);
    return {current:Math.max(0,Math.min(duration,absolute-item.start)),duration,absolute,total};
  }
  function reportProgress(item) {
    if(active!==item)return;const total=readDuration(item);
    if(total&&total!==item.duration){item.duration=total;item.onMetadata?.(total);}
    item.onProgress?.(clipProgress(item));
  }
  function seekAbsolute(item,at) {
    item.seekUntil=Date.now()+500;if(item.audio)item.audio.currentTime=at;else item.youtube?.seekTo(at,true);
  }
  function seek(offset,mount) {
    if(!active||(mount&&active.mount!==mount)||!Number.isFinite(offset))return;
    const item=active,progress=clipProgress(item);if(!progress.duration)return;
    seekAbsolute(item,item.start+Math.max(0,Math.min(progress.duration,offset)));reportProgress(item);
  }
  function setClip(start,end,mount) {
    if(!active||(mount&&active.mount!==mount))return;
    if(!Number.isFinite(start)||start<0||(end!==null&&(!Number.isFinite(end)||end<=start)))throw new Error("ช่วงเวลาไม่ถูกต้อง");
    const item=active,total=readDuration(item);if(total&&(start>=total||(end!==null&&end>total+.05)))throw new Error("ช่วงเวลาเกินความยาวเสียง");
    item.start=start;item.end=end;const at=readTime(item);if(at<start||(end!==null&&at>=end))seekAbsolute(item,start);reportProgress(item);
  }
  async function play(source,options={}) {
    const start=time(source.startSeconds)||0,end=time(source.endSeconds),autoplay=options.autoplay!==false;
    if(end!==null&&end<=start)throw new Error("เวลาจบต้องอยู่หลังเวลาเริ่ม");
    const sourceKey=JSON.stringify([source.sourceType,source.audioUrl||source.sourceUrl||"",source.youtubeId||"",source.audioAssetId||"",source.id||""]);
    if(active?.sourceKey===sourceKey&&active.mount===options.mount&&active.state!=="error"){
      const item=active;item.onState=options.onState;item.onProgress=options.onProgress;item.onMetadata=options.onMetadata;
      const knownDuration=readDuration(item);if(knownDuration)item.onMetadata?.(knownDuration);
      setClip(start,end,item.mount);if(!autoplay){reportProgress(item);return;}
      if(item.state==="playing"){item.audio?.pause();item.youtube?.pauseVideo();return;}
      if((item.end!==null&&readTime(item)>=item.end-.05)||item.state==="ended")seekAbsolute(item,item.start);
      if(item.audio)await item.audio.play();else item.youtube?.playVideo();return;
    }
    stop();const item={sourceKey,mount:options.mount,onState:options.onState,onProgress:options.onProgress,onMetadata:options.onMetadata,state:"loading",start,end,audio:null,youtube:null,timer:0,duration:0,seekUntil:0,serial:++playerSerial};
    active=item;item.mount.hidden=false;item.mount.replaceChildren();notify(item,"loading");
    const fail=message=>{if(active!==item)return;item.audio?.pause();notify(item,"error");const p=document.createElement("p");p.className="collection-error";p.textContent=message;item.mount.append(p);};
    try{
      if(source.sourceType==="YOUTUBE"){
        const id=youtubeId(source.youtubeId||source.sourceUrl),YT=await loadYouTube();if(active!==item)return;
        const target=document.createElement("div");item.mount.append(target);item.mount.classList.add("is-youtube");item.mount.setAttribute?.("aria-hidden","true");
        item.youtube=new YT.Player(target,{width:200,height:200,videoId:id,playerVars:{playsinline:1,origin:location.origin,controls:0,disablekb:1,fs:0},events:{
          onReady(event){if(active!==item)return;const cue={videoId:id,startSeconds:item.start};if(autoplay)event.target.loadVideoById(cue);else event.target.cueVideoById(cue);reportProgress(item);},
          onStateChange(event){if(active!==item)return;notify(item,({1:"playing",2:"paused",3:"loading",0:"ended",5:"paused"})[event.data]||"paused");reportProgress(item);},
          onError(){fail("YouTube นี้ไม่พร้อมเล่น กรุณาตรวจลิงก์หรือใช้ไฟล์เสียง");}
        }});
      }else{
        const src=source.audioUrl||source.sourceUrl;if(!src)throw new Error("เพิ่มไฟล์เสียงหรือลิงก์ก่อนทดลองฟัง");
        const audio=document.createElement("audio");item.audio=audio;item.mount.classList.remove("is-youtube");audio.controls=options.controls!==false;audio.preload="metadata";
        audio.addEventListener("loadedmetadata",()=>{if(active!==item)return;reportProgress(item);if(item.start>=audio.duration||(item.end!==null&&item.end>audio.duration+.5)){fail("ช่วงเวลาเกินความยาวเสียง");return;}audio.currentTime=item.start;if(!autoplay)notify(item,"paused");});
        audio.addEventListener("timeupdate",()=>reportProgress(item));
        for(const [event,state] of [["play","playing"],["pause","paused"],["waiting","loading"],["playing","playing"],["ended","ended"]])audio.addEventListener(event,()=>{if(item.state!=="error")notify(item,state);});
        audio.addEventListener("error",()=>fail("เล่นเสียงไม่ได้ กรุณาตรวจลิงก์หรือรูปแบบไฟล์"));audio.src=src;item.mount.append(audio);
        if(autoplay)await audio.play();else audio.load?.();
      }
      if(active!==item)return;
      item.timer=setInterval(()=>{if(active!==item)return;reportProgress(item);if(item.state!=="playing")return;const at=readTime(item);
        if(at<item.start-.25&&Date.now()>item.seekUntil)seekAbsolute(item,item.start);
        if(item.end!==null&&at>=item.end){item.audio?.pause();item.youtube?.pauseVideo();notify(item,"ended");}
      },80);
    }catch(error){if(active===item){stop();options.onState?.("error");}throw error;}
  }

  window.addEventListener("pagehide",stop);
  document.addEventListener("visibilitychange",() => {if(document.hidden)stop();});

  async function prepareCover(file,maximum=1600) {
    let decoded;
    try {
      if (typeof createImageBitmap === "function") {
        try {
          const bitmap = await createImageBitmap(file);
          decoded = { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
        } catch {}
      }
      if (!decoded) {
        const url = URL.createObjectURL(file), image = new Image();
        try {
          await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error("เบราว์เซอร์เปิดรูปนี้ไม่ได้ กรุณาลอง PNG, JPG หรือ WebP"));image.src=url;});
          decoded = { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
        } catch (error) { URL.revokeObjectURL(url); throw error; }
      }
      if (!decoded.width || !decoded.height) throw new Error("เบราว์เซอร์เปิดรูปนี้ไม่ได้ กรุณาลอง PNG, JPG หรือ WebP");
      const ratio = Math.min(1,maximum / Math.max(decoded.width,decoded.height));
      const canvas = document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(decoded.width*ratio));canvas.height=Math.max(1,Math.round(decoded.height*ratio));
      const context=canvas.getContext("2d");if(!context)throw new Error("เตรียมปกไม่สำเร็จ");
      context.drawImage(decoded.source,0,0,canvas.width,canvas.height);
      const encode=type=>new Promise((resolve,reject)=>canvas.toBlob(result=>result ? resolve(result) : reject(new Error("เตรียมปกไม่สำเร็จ")),type,.9));
      let blob=await encode("image/webp");
      if(blob.type!=="image/webp"&&blob.type!=="image/png")blob=await encode("image/png");
      const type=blob.type==="image/webp"?"webp":blob.type==="image/png"?"png":"";
      if(!type)throw new Error("เบราว์เซอร์แปลงรูปไม่สำเร็จ กรุณาลอง PNG หรือ JPG");
      return new File([blob],"cover."+type,{type:blob.type});
    } finally {decoded?.release();}
  }
  function durationOf(file) {
    return new Promise((resolve,reject)=>{
      const audio=document.createElement("audio"),url=URL.createObjectURL(file);
      let finished=false;const timer=setTimeout(()=>finish(null),12000);
      function finish(result,error){if(finished)return;finished=true;clearTimeout(timer);audio.onloadedmetadata=null;audio.onerror=null;audio.removeAttribute("src");audio.load();URL.revokeObjectURL(url);error ? reject(error) : resolve(result);}
      audio.preload="metadata";audio.onloadedmetadata=()=>finish(Number.isFinite(audio.duration) ? audio.duration : null);audio.onerror=()=>finish(null,new Error("เบราว์เซอร์อ่านไฟล์เสียงนี้ไม่ได้ ลองใช้ MP3, M4A หรือ WAV"));audio.src=url;
    });
  }
  function guessType(file) {
    return file.type || ({mp3:"audio/mpeg",m4a:"audio/mp4",aac:"audio/aac",wav:"audio/wav",ogg:"audio/ogg",webm:"audio/webm",flac:"audio/flac",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp"})[file.name.split(".").pop().toLowerCase()] || "";
  }
  async function upload(original,purpose,characterId,progress) {
    const file=purpose==="COVER" || purpose==="EVIDENCE" ? await prepareCover(original,purpose==="EVIDENCE"?2600:1600) : original;
    const durationSeconds=purpose==="AUDIO" ? await durationOf(file) : null;
    const ticket=await request("media/uploads",{method:"POST",body:JSON.stringify({characterId:characterId || null,purpose,contentType:guessType(file),byteSize:file.size,originalName:original.name,durationSeconds})});
    try {
      await new Promise((resolve,reject)=>{
        const xhr=new XMLHttpRequest();xhr.open("PUT",ticket.uploadUrl);xhr.timeout=15*60000;
        Object.entries(ticket.headers).forEach(([key,value])=>xhr.setRequestHeader(key,value));
        xhr.upload.onprogress=event=>{if(event.lengthComputable)progress?.(Math.round(event.loaded/event.total*100));};
        xhr.onload=()=>xhr.status>=200&&xhr.status<300 ? resolve() : reject(new Error("R2 รับไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง"));
        xhr.onerror=()=>reject(new Error("อัปโหลดตรงเข้า R2 ไม่สำเร็จ กรุณาตรวจการเชื่อมต่อและการตั้งค่า CORS ของที่เก็บไฟล์"));
        xhr.ontimeout=()=>reject(new Error("อัปโหลดใช้เวลานาน กรุณาลองอีกครั้ง"));xhr.send(file);
      });
      const asset=await request("media/uploads",{method:"PUT",body:JSON.stringify({id:ticket.id})});
      return {...asset,name:original.name};
    } catch(error) {
      await request("media/uploads",{method:"DELETE",body:JSON.stringify({id:ticket.id})}).catch(()=>{});
      throw error;
    }
  }

  function sourceEditor(container,options={}) {
    const initial=options.initial||{},key="source-"+crypto.randomUUID();container.classList.add("media-source-editor","media-mapper");
    const noAudio=options.allowNoAudio?'<button type="button" data-source-method="NONE" aria-pressed="false">ไม่มีไฟล์เสียง</button>':'';
    container.innerHTML=`<input type="hidden" data-source-type><div class="media-method-row"><span class="media-method-label">รูปแบบเสียง</span><div class="media-methods" role="group" aria-label="รูปแบบเสียง">${noAudio}<button type="button" data-source-method="UPLOAD" aria-pressed="false">ไฟล์จากเครื่อง</button><button type="button" data-source-method="LINK" aria-pressed="false">ลิงก์เสียง</button></div></div>
      <div class="media-source-entry"><p data-source-note class="media-source-note" hidden>เพิ่มบทพูดได้โดยไม่ต้องแนบเสียง</p><div data-source-upload hidden><label class="media-file-pick"><span data-source-file-label>เลือกไฟล์เสียง</span><input data-source-file type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac,.webm"></label><label data-source-reuse-label hidden>ใช้ไฟล์ที่มีอยู่<select data-source-reuse><option value="">เลือกไฟล์เสียงเดิม</option></select></label></div><div data-source-link hidden><label for="${key}-url">YouTube / ลิงก์ไฟล์เสียง</label><div class="media-link-entry"><input id="${key}-url" data-source-url type="url" placeholder="วางลิงก์ YouTube หรือไฟล์เสียง"><button type="button" data-source-load>โหลดเสียง</button></div></div><p class="media-upload-status" data-source-upload-status role="status"></p><progress data-source-progress max="100" value="0" hidden></progress></div>
      <section class="media-clip-editor" data-source-timing aria-label="เลือกช่วงเสียง"><header class="media-clip-heading"><span>เลือกช่วงเสียง</span><span data-source-duration>ยังไม่ได้โหลดเสียง</span></header><div class="media-clip-rail is-disabled" data-clip-rail><svg class="media-clip-wave" viewBox="0 0 600 72" preserveAspectRatio="none" aria-hidden="true" data-clip-wave></svg><div class="media-clip-selection" data-clip-selection><button type="button" class="media-clip-handle is-start" data-clip-start role="slider" aria-label="จุดเริ่มเสียง" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0"></button><div class="media-clip-grip" data-clip-move title="ลากเพื่อเลื่อนช่วงเสียง"></div><button type="button" class="media-clip-handle is-end" data-clip-end role="slider" aria-label="จุดจบเสียง" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0"></button></div><i class="media-clip-playhead" data-clip-playhead></i><span class="media-clip-placeholder" data-clip-placeholder>เพิ่มเสียงเพื่อเลือกช่วงที่ต้องการ</span></div><div class="media-clip-ruler" data-clip-ruler aria-hidden="true"></div><div class="media-clip-footer"><button type="button" data-source-preview class="media-clip-preview" aria-label="ฟังช่วงที่เลือก" title="ฟังช่วงที่เลือก"></button><time data-source-current>0:00.0</time><div class="media-clip-fields"><label>เริ่ม<input data-source-start type="text" inputmode="decimal" value="0:00" aria-label="เวลาเริ่ม"></label><span class="media-clip-separator">/</span><label>จบ<input data-source-end type="text" inputmode="decimal" placeholder="จนจบ" aria-label="เวลาจบ"></label></div><span class="media-clip-length" data-clip-length>เลือกช่วงด้วยการลากขอบ</span></div></section><div class="character-media-player" data-source-player hidden></div><p class="media-source-message" data-source-message role="status" aria-live="polite"></p>`;
    const $=s=>container.querySelector(s),type=$("[data-source-type]"),url=$("[data-source-url]"),start=$("[data-source-start]"),end=$("[data-source-end]"),status=$("[data-source-upload-status]"),progress=$("[data-source-progress]"),mount=$("[data-source-player]"),preview=$("[data-source-preview]"),rail=$("[data-clip-rail]"),selection=$("[data-clip-selection]"),message=$("[data-source-message]");
    const icons={play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7z"/></svg>',pause:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm7 0h4v14h-4z"/></svg>'};
    let method=initial.sourceType==="UPLOAD"?"UPLOAD":initial.sourceType&&initial.sourceType!=="NONE"?"LINK":options.allowNoAudio?"NONE":"LINK";
    let assetId=initial.audioAssetId||"",assetUrl=initial.audioUrl||"",localUrl="",duration=0,rangeStart=Number(initial.startSeconds)||0,rangeEnd=initial.endSeconds==null?null:Number(initial.endSeconds),uploading=false,loading=false,externalBusy=false,disposed=false,loadSerial=0,loadTimer=0,metadataTimer=0,drag=null,playing=false;
    url.value=initial.sourceType==="YOUTUBE"&&initial.youtubeId?"https://www.youtube.com/watch?v="+initial.youtubeId:initial.sourceUrl||"";
    const clock=n=>{const rounded=Math.max(0,Math.floor((Number(n)||0)*10));return Math.floor(rounded/600)+":"+String(Math.floor(rounded/10)%60).padStart(2,"0")+"."+(rounded%10);};
    const changed=()=>options.onChange?.();
    const reuse=$("[data-source-reuse]"),used=new Set();(options.reusable||[]).forEach(item=>{if(!item.audioAssetId||used.has(item.audioAssetId))return;used.add(item.audioAssetId);const option=new Option(item.title,item.audioAssetId);option.dataset.url=item.audioUrl;reuse.add(option);});$("[data-source-reuse-label]").hidden=!used.size;
    function getSource(forSave=false){
      if(method==="NONE")return{sourceType:"NONE",startSeconds:0,endSeconds:null,audioAssetId:null,sourceUrl:null,youtubeId:null};
      const result={id:key,startSeconds:rangeStart,endSeconds:rangeEnd,sourceType:method==="UPLOAD"?"UPLOAD":"AUDIO_URL",audioAssetId:method==="UPLOAD"?assetId:null,audioUrl:method==="UPLOAD"?(forSave?assetUrl:localUrl||assetUrl):"",sourceUrl:method==="LINK"?url.value.trim():null,youtubeId:null};
      if(method==="UPLOAD"&&!(forSave?assetId:result.audioUrl))throw new Error("เลือกไฟล์เสียงก่อน");
      if(method==="LINK"){let parsed;try{parsed=new URL(result.sourceUrl);}catch{throw new Error("วางลิงก์ YouTube หรือไฟล์เสียง");}try{result.youtubeId=youtubeId(result.sourceUrl);result.sourceType="YOUTUBE";}catch{if(parsed.protocol!=="https:")throw new Error("ใช้ลิงก์ไฟล์เสียงแบบ HTTPS");}}
      type.value=result.sourceType;return result;
    }
    function locks(){
      options.onBusy?.(uploading||loading);
      const locked=externalBusy||uploading;container.querySelectorAll("[data-source-method], [data-source-file], [data-source-load], [data-source-reuse]").forEach(el=>el.disabled=locked);url.disabled=locked;
      const ready=duration>0&&!externalBusy&&method!=="NONE";[start,end,preview,$("[data-clip-start]"),$("[data-clip-end]")].forEach(el=>el.disabled=!ready);rail.classList.toggle("is-disabled",!ready);rail.setAttribute("aria-disabled",String(!ready));preview.disabled=!ready||loading;
    }
    function render(){
      const last=rangeEnd??duration,ready=duration>0,left=ready?rangeStart/duration*100:0,right=ready?last/duration*100:100;
      selection.style.left=left+"%";selection.style.width=(right-left)+"%";selection.hidden=!ready;
      start.value=formatTime(rangeStart);end.value=last?formatTime(last):"";
      $("[data-source-duration]").textContent=loading?"กำลังอ่านความยาวเสียง…":ready?"ความยาว "+formatTime(duration):method==="NONE"?"ไม่มีไฟล์เสียง":"ยังไม่ได้โหลดเสียง";
      $("[data-clip-length]").textContent=ready?"ใช้ "+(last-rangeStart).toFixed(1)+" วินาที":"ลากขอบเพื่อเลือกช่วง";
      $("[data-clip-placeholder]").hidden=ready;$("[data-clip-placeholder]").textContent=loading?"กำลังเตรียมแถบเสียง…":"เพิ่มเสียงเพื่อเลือกช่วงที่ต้องการ";
      const ruler=$("[data-clip-ruler]");ruler.replaceChildren();for(let i=0;i<5;i++){const tick=document.createElement("span");tick.textContent=ready?formatTime(duration*i/4).split(".")[0]:"—";ruler.append(tick);}
      for(const [handle,value,min,max] of [[$("[data-clip-start]"),rangeStart,0,Math.max(0,last-.1)],[$("[data-clip-end]"),last,rangeStart+.1,duration]]){handle.setAttribute("aria-valuenow",String(value));handle.setAttribute("aria-valuemin",String(min));handle.setAttribute("aria-valuemax",String(max));handle.setAttribute("aria-valuetext",formatTime(value));}
      preview.innerHTML=icons[playing?"pause":"play"];preview.setAttribute("aria-label",playing?"พักเสียง":"ฟังช่วงที่เลือก");preview.title=playing?"พักเสียง":"ฟังช่วงที่เลือก";locks();
    }
    function updateRange(a,b,dirty=true,precision=1000){
      const total=duration||Math.max(b||0,a+.1);rangeStart=Math.round(Math.max(0,Math.min(total-.1,a))*precision)/precision;rangeEnd=b==null?null:Math.min(total,Math.round(Math.max(rangeStart+.1,Math.min(total,b))*precision)/precision);
      if(active?.mount===mount)setClip(rangeStart,rangeEnd,mount);render();if(dirty)changed();
    }
    function reset(){
      ++loadSerial;clearTimeout(loadTimer);clearTimeout(metadataTimer);if(active?.mount===mount)stop();duration=0;loading=false;playing=false;$("[data-clip-wave]").replaceChildren();$("[data-clip-playhead]").style.left="0%";$("[data-source-current]").textContent="0:00.0";message.textContent="";
    }
    function state(next){if(disposed)return;playing=next==="playing";if(next==="error"){clearTimeout(metadataTimer);loading=false;message.textContent="โหลดเสียงไม่ได้ ตรวจลิงก์แล้วกดโหลดเสียงอีกครั้ง";}render();}
    function metadata(total){if(disposed||!total)return;clearTimeout(metadataTimer);loading=false;duration=total;if(rangeStart>=total)rangeStart=0;if(rangeEnd!==null)rangeEnd=Math.min(total,Math.max(rangeStart+.1,rangeEnd));message.textContent="";render();}
    const playerOptions=()=>({mount,controls:false,onState:state,onMetadata:metadata,onProgress:clip=>{if(disposed)return;$("[data-source-current]").textContent=clock(clip.absolute);$("[data-clip-playhead]").style.left=(duration?Math.max(0,Math.min(100,clip.absolute/duration*100)):0)+"%";}});
    async function prepare(){
      if(disposed||method==="NONE")return;const serial=++loadSerial;clearTimeout(metadataTimer);message.textContent="";let source;try{source=getSource();}catch(error){message.textContent=error.message;return;}
      loading=true;render();metadataTimer=setTimeout(()=>{if(disposed||serial!==loadSerial||duration)return;loading=false;message.textContent="ยังอ่านความยาวเสียงไม่ได้ ตรวจลิงก์แล้วกดโหลดเสียงอีกครั้ง";render();},25000);
      try{await play(source,{...playerOptions(),autoplay:false});}catch(error){if(serial!==loadSerial||disposed)return;loading=false;clearTimeout(metadataTimer);message.textContent=error.message;render();}
    }
    function presentation(){
      $("[data-source-note]").hidden=method!=="NONE";$("[data-source-upload]").hidden=method!=="UPLOAD";$("[data-source-link]").hidden=method!=="LINK";$("[data-source-timing]").hidden=method==="NONE";type.value=method==="NONE"?"NONE":method==="UPLOAD"?"UPLOAD":"YOUTUBE";
      container.querySelectorAll("[data-source-method]").forEach(button=>{const selected=button.dataset.sourceMethod===method;button.setAttribute("aria-pressed",String(selected));button.classList.toggle("is-selected",selected);});render();
    }
    container.querySelectorAll("[data-source-method]").forEach(button=>button.addEventListener("click",()=>{if(button.dataset.sourceMethod===method)return;reset();method=button.dataset.sourceMethod;rangeStart=0;rangeEnd=null;status.textContent="";presentation();changed();if(method==="UPLOAD"&&assetUrl||method==="LINK"&&url.value.trim())prepare();}));
    url.addEventListener("input",()=>{reset();rangeStart=0;rangeEnd=null;render();changed();if(url.validity.valid&&url.value.trim())loadTimer=setTimeout(prepare,650);});$("[data-source-load]").addEventListener("click",prepare);url.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();clearTimeout(loadTimer);prepare();}});
    reuse.addEventListener("change",()=>{if(!reuse.value)return;reset();if(localUrl){URL.revokeObjectURL(localUrl);localUrl="";}assetId=reuse.value;assetUrl=reuse.selectedOptions[0].dataset.url;rangeStart=0;rangeEnd=null;status.textContent="ใช้ไฟล์เสียงเดิม";changed();prepare();});
    async function waveform(file,serial){
      const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext||file.size>30*1024*1024)return;let context;
      try{context=new AudioContext();const buffer=await context.decodeAudioData(await file.arrayBuffer());if(disposed||serial!==loadSerial)return;const channel=buffer.getChannelData(0),count=120,svg=$("[data-clip-wave]");svg.replaceChildren();for(let i=0;i<count;i++){const from=Math.floor(i*channel.length/count),to=Math.floor((i+1)*channel.length/count),stride=Math.max(1,Math.floor((to-from)/150));let peak=0;for(let p=from;p<to;p+=stride)peak=Math.max(peak,Math.abs(channel[p]));const height=Math.max(2,peak*58),bar=document.createElementNS("http://www.w3.org/2000/svg","rect");bar.setAttribute("x",String(i*5+1));bar.setAttribute("y",String(36-height/2));bar.setAttribute("width","3");bar.setAttribute("height",String(height));bar.setAttribute("rx","1.5");svg.append(bar);}}catch{}finally{context?.close();}
    }
    $("[data-source-file]").addEventListener("change",async event=>{
      const file=event.target.files[0];if(!file)return;reset();if(localUrl)URL.revokeObjectURL(localUrl);localUrl=URL.createObjectURL(file);assetId="";assetUrl="";rangeStart=0;rangeEnd=null;uploading=true;progress.hidden=false;progress.value=0;status.textContent="กำลังอัปโหลด "+file.name;$("[data-source-file-label]").textContent=file.name;options.onBusy?.(true);changed();locks();prepare();const serial=loadSerial;waveform(file,serial);
      try{const result=await upload(file,"AUDIO",options.characterId,percent=>{if(disposed)return;progress.value=percent;status.textContent="กำลังอัปโหลด "+percent+"%";});if(disposed)return;assetId=result.id;assetUrl=result.url;status.textContent="อัปโหลดแล้ว · "+file.name;options.onUploaded?.(result);changed();}catch(error){if(!disposed){status.textContent=error.message;message.textContent="อัปโหลดไม่สำเร็จ เลือกไฟล์อีกครั้งก่อนบันทึก";}}finally{uploading=false;if(!disposed){progress.hidden=true;event.target.value="";options.onBusy?.(false);locks();}}
    });
    preview.addEventListener("click",async()=>{try{message.textContent="";await play(getSource(),playerOptions());}catch(error){message.textContent=error.message;}});
    for(const input of [start,end]){input.addEventListener("change",()=>{try{const a=time(start.value)||0,b=time(end.value);if(b!==null&&b<=a)throw new Error("เวลาจบต้องอยู่หลังเวลาเริ่ม");if(duration&&(a>=duration||b>duration+.05))throw new Error("ช่วงเวลาเกินความยาวเสียง");updateRange(a,b);message.textContent="";}catch(error){message.textContent=error.message;render();}});input.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();input.blur();}});}
    rail.addEventListener("pointerdown",event=>{
      if(!duration||externalBusy||event.button>0)return;event.preventDefault();if(active?.mount===mount){active.audio?.pause();active.youtube?.pauseVideo();}
      const mode=event.target.closest("[data-clip-start]")?"start":event.target.closest("[data-clip-end]")?"end":event.target.closest("[data-clip-move]")?"move":"seek";
      if(mode==="seek"){if(active?.mount===mount)seek(Math.max(0,Math.min((rangeEnd??duration)-rangeStart,(event.clientX-rail.getBoundingClientRect().left)/rail.clientWidth*duration-rangeStart)),mount);return;}
      drag={id:event.pointerId,mode,x:event.clientX,start:rangeStart,end:rangeEnd??duration,width:rail.getBoundingClientRect().width};rail.setPointerCapture(event.pointerId);rail.classList.add("is-dragging");
    });
    rail.addEventListener("pointermove",event=>{if(drag?.id!==event.pointerId)return;const delta=(event.clientX-drag.x)/drag.width*duration;if(drag.mode==="start")updateRange(Math.min(drag.end-.1,drag.start+delta),drag.end,true,10);else if(drag.mode==="end")updateRange(drag.start,Math.max(drag.start+.1,drag.end+delta),true,10);else{const length=drag.end-drag.start,a=Math.max(0,Math.min(duration-length,drag.start+delta));updateRange(a,a+length,true,10);}});
    const endDrag=event=>{if(drag?.id!==event.pointerId)return;drag=null;rail.classList.remove("is-dragging");if(rail.hasPointerCapture(event.pointerId))rail.releasePointerCapture(event.pointerId);};for(const name of ["pointerup","pointercancel","lostpointercapture"])rail.addEventListener(name,endDrag);
    for(const [selector,isStart] of [["[data-clip-start]",true],["[data-clip-end]",false]])$(selector).addEventListener("keydown",event=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key)||!duration)return;event.preventDefault();const value=isStart?rangeStart:rangeEnd??duration,step=event.shiftKey?1:.1,next=event.key==="Home"?0:event.key==="End"?duration:value+(event.key==="ArrowLeft"?-step:step);if(isStart)updateRange(Math.min((rangeEnd??duration)-.1,next),rangeEnd);else updateRange(rangeStart,Math.max(rangeStart+.1,next));});
    presentation();if(method==="UPLOAD"&&assetUrl||method==="LINK"&&url.value.trim())prepare();
    return{value(){const a=time(start.value)||0,b=time(end.value);if(method!=="NONE"){if(b!==null&&b<=a)throw new Error("เวลาจบต้องอยู่หลังเวลาเริ่ม");if(duration&&(a>=duration||b>duration+.05))throw new Error("ช่วงเวลาเกินความยาวเสียง");rangeStart=a;rangeEnd=b;}return getSource(true);},isBusy:()=>uploading||loading,setDisabled(value){externalBusy=value;locks();},destroy(){disposed=true;++loadSerial;clearTimeout(loadTimer);clearTimeout(metadataTimer);if(active?.mount===mount)stop();if(localUrl)URL.revokeObjectURL(localUrl);},key};
  }

  window.RNCCharacterMedia={request,upload,sourceEditor,play,stop,seek,setClip,currentTime,formatTime,youtubeId};
})();
