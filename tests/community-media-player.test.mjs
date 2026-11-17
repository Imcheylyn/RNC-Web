import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/community/rnc/character-media.js',import.meta.url),'utf8');
function harness(){const audios=[],timers=new Set();class Audio{constructor(){this.listeners={};this.currentTime=0;this.duration=60;this.paused=true;audios.push(this);}addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}emit(type){for(const fn of this.listeners[type]||[])fn();}async play(){this.emit('loadedmetadata');this.paused=false;this.emit('play');}pause(){this.paused=true;this.emit('pause');}load(){this.emit('loadedmetadata');}}
 const document={hidden:false,addEventListener(){},createElement(tag){return tag==='audio'?new Audio():{className:'',textContent:''};}};
 const window={addEventListener(){}};const context=vm.createContext({window,document,location:{origin:'http://localhost:3002'},setInterval(fn){timers.add(fn);return fn;},clearInterval(fn){timers.delete(fn);},setTimeout,clearTimeout,URL,AbortSignal,crypto:globalThis.crypto,fetch(){throw Error('Unexpected network access');}});vm.runInContext(source,context);
 const mount=()=>({hidden:true,children:[],classList:{add(){},remove(){}},replaceChildren(){this.children=[];},append(child){this.children.push(child);}});
 return {api:window.RNCCharacterMedia,audios,timers,mount,window};}
test('media module never autoplays at page load and formats milliseconds consistently',()=>{const h=harness();assert.equal(h.audios.length,0);assert.equal(h.api.formatTime(84.125),'1:24.125');assert.equal(h.api.formatTime(59.9999),'1:00');});
test('starting a voice line stops the theme; seeking stays inside the selected clip',async()=>{const h=harness(),m=h.mount();await h.api.play({id:'theme',sourceType:'UPLOAD',audioUrl:'/test.wav',startSeconds:5,endSeconds:12},{mount:m});const first=h.audios[0];assert.equal(first.currentTime,5);first.currentTime=2;for(const fn of h.timers)fn();assert.equal(first.currentTime,5);first.currentTime=12.1;for(const fn of h.timers)fn();assert.equal(first.paused,true);
 await h.api.play({id:'voice',sourceType:'UPLOAD',audioUrl:'/voice.wav',startSeconds:1,endSeconds:8},{mount:h.mount()});assert.equal(first.paused,true);assert.equal(m.hidden,true);assert.equal(h.audios[1].currentTime,1);h.api.stop();assert.equal(h.timers.size,0);});
test('play button pauses and resumes the same track without creating competing players',async()=>{const h=harness(),m=h.mount(),track={id:'one',sourceType:'UPLOAD',audioUrl:'/one.wav'};await h.api.play(track,{mount:m});await h.api.play(track,{mount:m});assert.equal(h.audios[0].paused,true);assert.equal(h.audios.length,1);await h.api.play(track,{mount:m});assert.equal(h.audios[0].paused,false);h.api.stop();});


test('cassette transport reports clip-relative time and clamps seeking to the chosen range',async()=>{
 const h=harness(),updates=[],mount=h.mount();
 await h.api.play({id:'cassette',sourceType:'UPLOAD',audioUrl:'/tape.wav',startSeconds:5,endSeconds:12},{mount,controls:false,onProgress:value=>updates.push(value)});
 assert.equal(h.audios[0].controls,false);
 assert.equal(updates[0].current,0);assert.equal(updates[0].duration,7);
 h.api.seek(3);assert.equal(h.audios[0].currentTime,8);assert.equal(updates.at(-1).current,3);
 h.api.seek(100);assert.equal(h.audios[0].currentTime,12);
 h.api.seek(-100);assert.equal(h.audios[0].currentTime,5);
 h.api.seek(NaN);assert.equal(h.audios[0].currentTime,5);
 h.api.stop();assert.doesNotThrow(()=>h.api.seek(3));
 await h.api.play({id:'native',audioUrl:'/native.wav'},{mount:h.mount()});assert.equal(h.audios[1].controls,true);h.api.stop();
});


test('preparing and reloading metadata never plays audio or creates competing players',async()=>{
 const h=harness(),m=h.mount(),lengths=[],track={id:'trim',sourceType:'UPLOAD',audioUrl:'/trim.wav',startSeconds:0,endSeconds:null};
 const options={mount:m,autoplay:false,controls:false,onMetadata:value=>lengths.push(value)};
 await h.api.play(track,options);assert.equal(h.audios[0].paused,true);assert.equal(lengths[0],60);
 await h.api.play(track,options);assert.equal(h.audios.length,1);assert.equal(lengths.at(-1),60);assert.equal(lengths.length,2);assert.equal(h.audios[0].paused,true);
 h.api.setClip(12,18,m);assert.equal(h.audios[0].currentTime,12);
 h.api.setClip(30,35,h.mount());assert.equal(h.audios[0].currentTime,12);
 await h.api.play({...track,startSeconds:12,endSeconds:18},{mount:m,controls:false});assert.equal(h.audios.length,1);assert.equal(h.audios[0].paused,false);
 h.audios[0].currentTime=18.1;for(const fn of h.timers)fn();assert.equal(h.audios[0].paused,true);h.api.stop();
});
test('YouTube metadata is cued without autoplay and a changed clip uses the same player',async()=>{
 const h=harness(),m=h.mount(),players=[],lengths=[];
 h.window.YT={Player:class{constructor(target,options){this.options=options;this.at=0;this.cues=0;this.loads=0;players.push(this);setTimeout(()=>options.events.onReady({target:this}),0);}getDuration(){return 120;}getCurrentTime(){return this.at;}cueVideoById(cue){this.cues++;this.at=cue.startSeconds;this.options.events.onStateChange({data:5});}loadVideoById(){this.loads++;}seekTo(at){this.at=at;}playVideo(){this.options.events.onStateChange({data:1});}pauseVideo(){this.options.events.onStateChange({data:2});}destroy(){this.destroyed=true;}}};
 const track={id:'yt',sourceType:'YOUTUBE',youtubeId:'M7lc1UVf-VE',startSeconds:0,endSeconds:null};
 await h.api.play(track,{mount:m,autoplay:false,onMetadata:value=>lengths.push(value)});await new Promise(resolve=>setTimeout(resolve,5));assert.equal(players[0].cues,1);assert.equal(players[0].loads,0);assert.equal(lengths[0],120);
 h.api.setClip(30,40,m);assert.equal(players[0].at,30);
 await h.api.play({...track,startSeconds:30,endSeconds:40},{mount:m});assert.equal(players.length,1);players[0].at=40.1;for(const fn of h.timers)fn();assert.equal(h.api.currentTime(m),40.1);h.api.stop();assert.equal(players[0].destroyed,true);
});
