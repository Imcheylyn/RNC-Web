(function () {
  "use strict";
  const form=document.getElementById("characterForm"), media=window.RNCCharacterMedia;
  if(!form || !media)return;
  const id=new URLSearchParams(location.search).get("id"), character=window.RNCCharacterStore.getById(id), initial=character?.themeSong || null;
  const section=document.createElement("section");section.className="editor-section theme-editor-section";section.id="themeSong";
  section.innerHTML="<div class=\"theme-heading-row\"><div class=\"section-heading\"><span>07</span><div><p>CHARACTER SOUNDTRACK</p><h2>Theme Song</h2></div></div><label class=\"theme-enable\"><input type=\"checkbox\" data-theme-enabled><span>เพิ่มเพลงประจำตัวละคร</span><small>ไม่บังคับ</small></label></div><div class=\"theme-editor-shell\" data-theme-fields hidden><aside class=\"theme-editor-art\"><div class=\"theme-record-preview\"><span class=\"theme-record\" aria-hidden=\"true\"></span><div class=\"theme-cover-preview\"><img data-theme-cover alt=\"ตัวอย่างปกเพลง\" hidden><span data-theme-cover-empty>R:NC</span></div></div><p data-theme-preview-title>Theme Song</p><div class=\"theme-cover-actions\"><label class=\"media-file-pick\"><span>เลือกรูปปก</span><input data-theme-cover-file type=\"file\" accept=\"image/png,image/jpeg,image/webp\"></label><button type=\"button\" data-theme-remove-cover>เอาปกออก</button></div><p class=\"media-upload-status\" data-theme-cover-status role=\"status\"></p></aside><div class=\"theme-editor-content\"><div class=\"theme-editor-meta media-two-fields\"><label><span class=\"theme-field-label\">ชื่อเพลง</span><input data-theme-title maxlength=\"160\" placeholder=\"ชื่อเพลงประจำตัวละคร\"></label><label><span class=\"theme-field-label\">ศิลปิน <small>ไม่บังคับ</small></span><input data-theme-artist maxlength=\"160\" placeholder=\"ชื่อศิลปิน\"></label></div><div class=\"theme-source-panel\"><div class=\"theme-source-heading\"><div><small>TRACK SOURCE</small><h3>เสียงเพลง</h3></div><p>เลือกไฟล์จากเครื่องหรือลิงก์เสียง แล้วกำหนดช่วงที่ต้องการ</p></div><div data-theme-source></div></div></div></div>";
  form.querySelector(".editor-actions").before(section);
  const $=selector=>section.querySelector(selector),enabled=$("[data-theme-enabled]"),title=$("[data-theme-title]"),artist=$("[data-theme-artist]"),fields=$("[data-theme-fields]"),cover=$("[data-theme-cover]");
  let dirty=false,initializing=true,coverBusy=false,sourceBusy=false,coverAssetId=initial?.coverAssetId || null,coverUrl=initial?.coverUrl || "";
  enabled.checked=Boolean(initial);title.value=initial?.title || "";artist.value=initial?.artist || "";
  function change(){if(!initializing)dirty=true;$("[data-theme-preview-title]").textContent=title.value.trim() || "เพลงประจำตัวละคร";}
  const source=media.sourceEditor($("[data-theme-source]"),{initial,characterId:character?.id,onChange:change,onBusy(value){sourceBusy=value;}});
  function coverPresentation(){cover.hidden=!coverUrl;$("[data-theme-cover-empty]").hidden=Boolean(coverUrl);if(coverUrl)cover.src=coverUrl;$("[data-theme-remove-cover]").hidden=!coverUrl;}
  function presentation(){fields.hidden=!enabled.checked;fields.querySelectorAll("input,select,button").forEach(control=>{control.disabled=!enabled.checked;});title.required=enabled.checked;source.setDisabled(!enabled.checked);change();}
  enabled.addEventListener("change",presentation);title.addEventListener("input",change);artist.addEventListener("input",change);
  $("[data-theme-remove-cover]").addEventListener("click",()=>{coverAssetId=null;coverUrl="";coverPresentation();change();});
  $("[data-theme-cover-file]").addEventListener("change",async event=>{
    const file=event.target.files[0];if(!file||coverBusy)return;coverBusy=true;enabled.disabled=true;event.target.disabled=true;$("[data-theme-remove-cover]").disabled=true;$("[data-theme-cover-status]").textContent="กำลังเตรียมปก…";
    try{const result=await media.upload(file,"COVER",character?.id,percent=>{$("[data-theme-cover-status]").textContent="กำลังอัปโหลดปก " + percent + "%";});coverAssetId=result.id;coverUrl=result.url;coverPresentation();change();$("[data-theme-cover-status]").textContent="เพิ่มปกเพลงแล้ว";}
    catch(error){$("[data-theme-cover-status]").textContent=error.message;}
    finally{coverBusy=false;enabled.disabled=false;event.target.disabled=false;$("[data-theme-remove-cover]").disabled=false;event.target.value="";}
  });
  coverPresentation();presentation();initializing=false;dirty=false;
  window.RNCThemeEditor={payload(){
    if(coverBusy||sourceBusy)throw new Error("รอให้อัปโหลดไฟล์เพลงและปกเสร็จก่อนบันทึก");
    if(!dirty)return undefined;
    if(!enabled.checked)return initial ? {remove:true,version:initial.version} : undefined;
    if(!title.value.trim())throw new Error("กรอกชื่อ Theme Song ก่อนบันทึก");
    return {...source.value(),title:title.value.trim(),artist:artist.value.trim(),coverAssetId,version:initial?.version || 0};
  }};
})();
