import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync(new URL('../public/community/rnc/site-cursor.js',import.meta.url),'utf8');
function setup({staff=false,fine=true,popover=true,failPopover=false}={}) {
  const nodes=[],documentEvents=new Map(),windowEvents=new Map(),frames=new Map();
  let observer=null,target=null,nextFrame=0;
  class Element {
    constructor(tag='div') {
      this.tagName=tag.toUpperCase();this.id='';this.parentElement=null;this.children=[];this.dataset={};this.style={};this.attributes={};this.open=false;this.popoverOpen=false;
      const classes=new Set();this.classList={add:(...items)=>items.forEach(item=>classes.add(item)),remove:(...items)=>items.forEach(item=>classes.delete(item)),contains:item=>classes.has(item),toggle:(item,on)=>{if(on)classes.add(item);else classes.delete(item);}};
      if(!popover)this.showPopover=undefined;
      nodes.push(this);
    }
    append(...items){for(const item of items){item.remove();item.parentElement=this;this.children.push(item);}}
    remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(item=>item!==this);this.parentElement=null;}this.popoverOpen=false;}
    setAttribute(key,value){this.attributes[key]=value;}
    closest(selector){
      for(let item=this;item;item=item.parentElement){
        if(selector==='dialog[open]'&&item.tagName==='DIALOG'&&item.open)return item;
        if(selector.startsWith('input:not')&&['INPUT','TEXTAREA','SELECT'].includes(item.tagName))return item;
        if(selector.startsWith('a, button')&&['A','BUTTON','SUMMARY'].includes(item.tagName))return item;
      }
      return null;
    }
    matches(selector){return selector===':popover-open'&&this.popoverOpen;}
    showPopover(){if(failPopover)throw Error('Unavailable top layer');this.popoverOpen=true;}
    hidePopover(){this.popoverOpen=false;}
  }
  const body=new Element('body');if(staff)body.dataset.staffMode='true';target=body;
  const document={body,hidden:false,createElement:tag=>new Element(tag),getElementById:id=>nodes.find(item=>item.id===id),elementFromPoint:()=>target,addEventListener:(name,fn)=>documentEvents.set(name,fn)};
  const mediaEvents=new Set();
  const pointerMedia={matches:fine,addEventListener:(name,fn)=>mediaEvents.add(fn),removeEventListener:(name,fn)=>mediaEvents.delete(fn)};
  const window={innerWidth:1000,innerHeight:700,matchMedia:query=>query.includes('any-hover')?pointerMedia:{matches:true},requestAnimationFrame:fn=>{frames.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id),addEventListener:(name,fn)=>windowEvents.set(name,fn)};
  vm.runInNewContext(source,{window,document,Element,MutationObserver:class{constructor(fn){observer=fn;}observe(){}}});
  const make=(tag,parent=body)=>{const item=new Element(tag);parent.append(item);return item;};
  const emit=(element,kind='pointermove',pointerType='mouse')=>{target=element;documentEvents.get(kind)?.({target:element,pointerType,clientX:480,clientY:330});};
  const mutate=element=>{target=element;observer?.();};
  const flush=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(16));};
  const setFine=matches=>{pointerMedia.matches=matches;[...mediaEvents].forEach(fn=>fn({matches}));};
  return {body,document,window,make,emit,mutate,flush,setFine,frames,get layer(){return document.getElementById('site-cursor-layer');}};
}

test('cursor appears in the modal top layer and retains its screen position',()=>{
  const env=setup(),dialog=env.make('dialog');dialog.open=true;
  env.emit(env.make('button',dialog));env.flush();
  assert.equal(env.layer.parentElement,dialog);assert.equal(env.layer.popoverOpen,true);
  assert.equal(env.body.classList.contains('site-cursor-visible'),true);
  assert.equal(env.body.classList.contains('site-cursor-fallback'),false);
  assert.match(env.document.getElementById('cursor-dot').style.transform,/480\.00px,330\.00px/);
});

test('opening and closing a nested editor rehomes the cursor without mouse movement',()=>{
  const env=setup(),dialog=env.make('dialog');dialog.open=true;
  const board=env.make('div',dialog);env.emit(board);
  const editor=env.make('dialog');editor.open=true;env.mutate(env.make('button',editor));
  assert.equal(env.layer.parentElement,editor);assert.equal(env.layer.popoverOpen,true);
  editor.open=false;env.mutate(board);
  assert.equal(env.layer.parentElement,dialog);assert.equal(env.layer.popoverOpen,true);
  dialog.open=false;env.mutate(env.body);
  assert.equal(env.layer.parentElement,env.body);assert.equal(env.layer.popoverOpen,true);
});

test('cursor recovers when an editor replaces its content',()=>{
  const env=setup(),dialog=env.make('dialog');dialog.open=true;
  env.emit(env.make('div',dialog));env.layer.remove();env.mutate(env.make('button',dialog));
  assert.equal(env.layer.parentElement,dialog);assert.equal(env.layer.popoverOpen,true);
});

test('text fields retain the native cursor and board movement restores the custom cursor',()=>{
  const env=setup(),dialog=env.make('dialog');dialog.open=true;
  env.emit(env.make('input',dialog));
  assert.equal(env.body.classList.contains('site-cursor-native'),true);assert.equal(env.frames.size,0);
  env.emit(env.make('div',dialog));
  assert.equal(env.body.classList.contains('site-cursor-native'),false);assert.equal(env.frames.size,1);
});

test('staff mode and touch-only devices keep their existing cursor behavior',()=>{
  for(const options of [{staff:true},{fine:false}]){
    const env=setup(options);assert.equal(env.layer,undefined);assert.equal(env.body.classList.contains('has-site-cursor'),false);
  }
  const env=setup();env.emit(env.body,'pointermove','touch');
  assert.equal(env.body.classList.contains('site-cursor-visible'),false);
});

test('unavailable popovers fall back to the native cursor inside dialogs',()=>{
  for(const options of [{popover:false},{failPopover:true}]){
    const env=setup(options),dialog=env.make('dialog');dialog.open=true;env.emit(env.make('div',dialog));
    assert.equal(env.body.classList.contains('site-cursor-fallback'),true);assert.equal(env.frames.size,0);
  }
});

test('a page loaded in mobile emulation enables its cursor after returning to a mouse',()=>{
  const env=setup({fine:false});
  assert.equal(env.layer,undefined);
  env.setFine(true);env.emit(env.body);env.flush();
  const layer=env.layer;
  assert.ok(layer);
  assert.equal(env.body.classList.contains('site-cursor-visible'),true);
  assert.match(env.document.getElementById('cursor-dot').style.transform,/480\.00px,330\.00px/);
  env.setFine(false);
  assert.equal(env.body.classList.contains('site-cursor-visible'),false);
  assert.equal(env.frames.size,0);
  env.emit(env.body);
  assert.equal(env.body.classList.contains('site-cursor-visible'),false);
  env.setFine(true);env.emit(env.body);
  assert.equal(env.layer,layer);
  assert.equal(env.body.classList.contains('site-cursor-visible'),true);
});

test('touching a hybrid device hides the decoration until the next mouse movement',()=>{
  const env=setup();env.emit(env.body);env.flush();
  env.emit(env.body,'pointerdown','touch');
  assert.equal(env.body.classList.contains('site-cursor-visible'),false);
  assert.equal(env.body.classList.contains('site-cursor-pressed'),false);
  assert.equal(env.frames.size,0);
  env.emit(env.body);
  assert.equal(env.body.classList.contains('site-cursor-visible'),true);
});

test('a failed popover keeps the native pointer visible outside dialogs too',()=>{
  const env=setup({failPopover:true});env.emit(env.body);
  assert.equal(env.body.classList.contains('site-cursor-fallback'),true);
  assert.equal(env.frames.size,0);
});

test('unlocked staff keep the RNC cursor on public pages and the native pointer in staff tools',async()=>{
  const route=readFileSync(new URL('../app/community/[[...segments]]/route.ts',import.meta.url),'utf8');
  const compiled=ts.transpileModule(route,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const staffSession={userId:'staff-fixture',name:'Staff',isStaff:true};
  class NextResponse extends Response {
    static redirect(url,status){return new NextResponse(null,{status,headers:{Location:String(url)}});}
  }
  const dependencies={
    'node:fs/promises':{readFile:async()=>'<html><head></head><body></body></html>'},
    'node:path':{join:(...parts)=>parts.join('/')},
    'next/server':{NextResponse},
    '@/lib/community-auth':{getCommunitySession:async()=>({session:staffSession}),hasStaffUnlock:()=>true},
    '@/lib/community-management':{getCommunityContent:async()=>({})},
    '@/lib/db':{prisma:{communityRole:{findMany:async()=>[]},communityUser:{findMany:async()=>[]}}},
    '@/lib/community-collection':{listCharacterThemeSongs:async()=>[]},
    '@/lib/community-characters':{listCommunityCharacters:async()=>[],findCommunityCharacter:async()=>null},
  };
  const api={exports:{}};
  vm.runInNewContext(compiled,{exports:api.exports,require:name=>dependencies[name],URL,Response,process:{cwd:()=>'/web'},console});
  for(const [path,staffTool] of [
    ['/community/rnc',false],['/community/rnc/character',false],['/community/rnc/editor',false],
    ['/community/staff',true],['/community/rnc/editor?staff=1',true],['/community/staff/height',true],
  ]){
    const request=new Request('http://rnc.test'+path+(path.includes('?')?'&':'?')+'rnc_inner=1');
    const response=await api.exports.GET(request);
    assert.equal(response.status,200,path);
    const html=await response.text();
    assert.equal(html.includes('data-staff-mode="true"'),staffTool,path);
    assert.match(html,/site-cursor\.js\?v=site-cursor-recovery-20261116-v6/);
  }
});
