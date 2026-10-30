import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { projectWorkspaceReadV550 } from '../workspace-read-v550.js';
import { selectModernMemosV555 as select } from '../modern/product/memo-list-contract-v555.mjs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const record=(id,title,category='手順',pinned=false,updatedAt=100,extra={})=>({
  id,title,body:'本文 '+id,category,tags:['引継ぎ',id],
  pinned,createdBy:'佐藤',updatedBy:'福冨',createdAt:updatedAt-10,
  updatedAt,revision:2,...extra
});
function classic(selectedUser='佐藤',source='local-only',roomId='test-memo-v555'){
  return {version:'550',ready:true,reason:null,source,roomId,selectedUser,
    todayISO:'2026-10-29',summary:{open:0,overdue:0,today:0,mine:0},
    tasks:[],todos:[],todoHistory:[],schedules:[]};
}
const rows=[
  record('pin-old','先の固定','手順',true,50),
  record('pin-new','後の固定','URL・リンク',true,150),
  record('normal-old','先の通常','その他',false,30),
  record('normal-new','後の通常','定型情報',false,300)
];
const cat=['定型情報','宛先・連絡先','手順','URL・リンク','その他'];
const snapshot=(list=rows,user='佐藤',source='local-only',roomId='test-memo-v555')=>({
  version:'555',ready:true,reason:null,roomId,selectedUser:user,source,
  categories:cat,rows:list
});
function memoryStore(initial){
  const map=new Map(Object.entries(initial));
  return {
    map,
    getItem:k=>map.has(k)?map.get(k):null,
    setItem:(key,value)=>map.set(key,String(value)),
    removeItem:k=>map.delete(k)
  };
}
async function createRealOwnerSidecar(initial) {
  const storage=memoryStore(initial);
  const listeners=new Map(), events=[];
  const window={
    WorkBoardMemoPersistenceV539:{create:()=>({commit:async()=>true,remove:async()=>true})},
    WorkBoardStartDatePersistenceV548:{create:()=>({
      save:async()=>({ok:false}),cleanupOrphans:async()=>{}
    })},
    firebaseConfig:null,
    addEventListener:(type,handler,capture)=>{ if(type==='click')listeners.set('window:'+type,{handler,capture}); },
    dispatchEvent:event=>events.push(event.type)
  };
  const document={
    readyState:'loading',
    addEventListener:(name,fn)=>listeners.set(name,fn),
    querySelector:()=>null,
    querySelectorAll:()=>[],
    getElementById:()=>null
  };
  const sandbox={window,document,localStorage:storage,location:{search:'?room=test-memo-v555'},
    URLSearchParams,Event:class{constructor(type){this.type=type}},
    setTimeout:()=>1,clearTimeout:()=>{},console:{warn:()=>{}},Date,Math};
  vm.runInNewContext(read('work-features-v167.js'),sandbox,
    {filename:'work-features-v167.js'});
  const facade=window.WorkBoardBusinessMemoReadV555;
  assert.equal(typeof facade?.read,'function');
  const before=facade.read();
  assert.equal(before.ready,false,'no unconfirmed local cache is exposed before source decision');
  assert.equal(before.reason,'identity-not-selected');
  listeners.get('DOMContentLoaded')();
  assert.equal(listeners.get('window:click')?.capture,true,'memo navigation uses one early capture listener');
  for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));
  return {facade,storage,events};
}

test('Ver.555 sidecar keeps the Classic owner: pinned first + per-user saved order + shared scope',async()=>{
  const room='test-memo-v555';
  const saved=[
    ['pin-new',rows[1]],['normal-new',rows[3]],
    ['pin-old',rows[0]],['normal-old',rows[2]]
  ];
  const fixture={
    'systemTaskUser':'佐藤',
    ['system-business-memos:'+room]:JSON.stringify(Object.fromEntries(saved)),
    ['workBoardMemoOrderV531:'+room+':佐藤']:JSON.stringify(['pin-old','pin-new','normal-old','normal-new']),
    ['workBoardMemoOrderV531:'+room+':福冨']:JSON.stringify(['pin-new','pin-old','normal-new','normal-old'])
  };
  const {facade,storage,events}=await createRealOwnerSidecar(fixture);
  assert.ok(Object.isFrozen(facade));
  assert.equal(facade.commit,undefined);
  assert.equal(facade.remove,undefined);
  const a=facade.read();
  assert.equal(a.ready,true);
  assert.equal(a.source,'local-only');
  assert.equal(a.roomId,room);
  assert.equal(a.selectedUser,'佐藤');
  assert.deepEqual(Array.from(a.rows,r=>r.id),['pin-old','pin-new','normal-old','normal-new']);
  assert.equal(a.rows[0].pinned,true);
  assert.equal(a.rows[2].pinned,false);
  assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.rows)&&Object.isFrozen(a.rows[0])&&Object.isFrozen(a.rows[0].tags));
  assert.ok(events.includes('workboard-memo-state-v555'));
  storage.setItem('systemTaskUser','福冨');
  const b=facade.read();
  assert.equal(b.selectedUser,'福冨');
  assert.deepEqual(Array.from(b.rows,r=>r.id),['pin-new','pin-old','normal-new','normal-old']);
  assert.equal(b.rows.length,a.rows.length,'all memos belong to the shared room, not a personal owner');
  assert.equal(fixture['system-business-memos:'+room],storage.getItem('system-business-memos:'+room));
  assert.equal(fixture['workBoardMemoOrderV531:'+room+':佐藤'],storage.getItem('workBoardMemoOrderV531:'+room+':佐藤'));
  assert.equal(fixture['workBoardMemoOrderV531:'+room+':福冨'],storage.getItem('workBoardMemoOrderV531:'+room+':福冨'));
  assert.deepEqual(Array.from(select(a,classic()).rows,m=>m.id),['pin-old','pin-new','normal-old','normal-new']);
  assert.deepEqual(Array.from(select(b,classic('福冨')).rows,m=>m.id),['pin-new','pin-old','normal-new','normal-old']);
});

test('Ver.555 preserves source order without resorting, pin counts, revisions and all display fields',()=>{
  const view=select(snapshot(),classic());
  assert.equal(view.ready,true);
  assert.equal(view.total,4);
  assert.equal(view.visible,4);
  assert.equal(view.pinnedCount,2);
  assert.deepEqual(view.rows.map(x=>x.id),['pin-old','pin-new','normal-old','normal-new']);
  assert.equal(view.rows[0].revision,2);
  assert.equal(view.rows[0].updatedBy,'福冨');
  assert.equal(view.rows[0].createdBy,'佐藤');
  assert.equal(view.rows[0].body,'本文 pin-old');
  assert.deepEqual(view.rows[0].tags,['引継ぎ','pin-old']);
  assert.deepEqual(view.categories,cat);
});

test('Ver.555 category filter and case/width/space-normalized search use the Classic fields',()=>{
  const list=[...rows,record('search','連絡 先','宛先・連絡先',false,0,{
    body:'PC 交 換  手順',tags:['ＵＲＬ　引き継ぎ']
  })];
  assert.deepEqual(select(snapshot(list),classic(),{category:'手順'}).rows.map(x=>x.id),['pin-old']);
  assert.deepEqual(select(snapshot(list),classic(),{query:'ｐｃ   交 換'}).rows.map(x=>x.id),['search']);
  assert.deepEqual(select(snapshot(list),classic(),{query:'url 引き継ぎ'}).rows.map(x=>x.id),['search']);
  assert.deepEqual(select(snapshot(list),classic(),{query:'連絡 先',category:'手順'}).rows,[]);
  assert.equal(select(snapshot(list),classic(),{query:'不一致'}).total,5);
  assert.equal(select(snapshot(list),classic(),{query:'不一致'}).visible,0);
});

test('Ver.555 all returned objects and tags are detached/immutable',()=>{
  const original=snapshot();
  const result=select(original,classic());
  for(const value of [result,result.rows,result.rows[0],result.rows[0].tags,result.categories])
    assert.ok(Object.isFrozen(value));
  assert.throws(()=>{result.rows[0].title='改ざん';},TypeError);
  assert.throws(()=>result.rows[0].tags.push('追加'),TypeError);
  original.rows[0].title='原本修正';
  assert.equal(result.rows[0].title,'先の固定');
});

test('Ver.555 rejects room/user/source drift and never exposes cross-room cached memos',()=>{
  for(const x of [
    select(snapshot(rows,'佐藤','local-only','test-other'),classic()),
    select(snapshot(rows,'福冨'),classic()),
    select(snapshot(rows,'佐藤','remote-online'),classic()),
    select(snapshot(rows,'佐藤','local-only'),classic('佐藤','remote-online'))
  ]){
    assert.equal(x.ready,false);
    assert.equal(x.reason,'inconsistent-owner');
    assert.deepEqual(x.rows,[]);
    assert.equal(x.source,null);
  }
});

test('Ver.555 loading/degraded/identity errors fail closed and expose no cached rows',()=>{
  for(const reason of ['loading','degraded','invalid-owner-state','identity-not-selected']){
    const x=select({version:'555',ready:false,reason,rows},classic());
    assert.equal(x.ready,false);
    assert.equal(x.reason,reason);
    assert.equal(x.total,0);
    assert.deepEqual(x.rows,[]);
  }
  assert.equal(select(snapshot(),{...classic(),ready:false,reason:'loading'}).reason,'loading');
  assert.equal(select(snapshot(),null).ready,false);
});

test('Ver.555 malformed, duplicated or unsorted pinned data is rejected, not silently repaired',()=>{
  const malformed=[
    snapshot([...rows,rows[0]]),
    snapshot([rows[2],rows[0]]),
    snapshot([{...rows[0],tags:[{},'tag']}]),
    snapshot([{...rows[0],revision:-1}]),
    snapshot([{...rows[0],id:'bad/key'}])
  ];
  for(const snap of malformed){
    const m=select(snap,classic());
    assert.equal(m.ready,false);
    assert.deepEqual(m.rows,[]);
  }
});

test('Ver.555 HTML-like data is preserved literally and unsafe hidden fields are not projected',()=>{
  const row=record('hostile','<svg onload=alert(1)>','その他',true,10,{
    body:'<img src=x onerror=window.__injected=true>',
    tags:['<script>alert(1)</script>'],credential:'not-exported'
  });
  const result=select(snapshot([row]),classic());
  assert.equal(result.ready,true);
  assert.equal(result.rows[0].body,row.body);
  assert.equal(result.rows[0].tags[0],row.tags[0]);
  assert.equal(result.rows[0].credential,undefined);
});

test('Ver.555 empty valid memo owner is ready and does not invent demo content',()=>{
  const view=select(snapshot([]),classic());
  assert.equal(view.ready,true);
  assert.equal(view.total,0);
  assert.equal(view.visible,0);
  assert.equal(view.pinnedCount,0);
  assert.deepEqual(view.rows,[]);
});

test('Ver.563 memo command facade remains test-only and delegates to single Classic owner',()=>{
  const sidecar=read('work-features-v167.js');
  const writer=read('workspace-memo-v539.js');
  const ui=read('modern/product/memo-list-v555.mjs');
  const html=read('modern/product/memo-list-read-v555.html');
  assert.match(sidecar,/function isModernMemoWriteTestV563\(\)/);
  assert.match(sidecar,/modernReadV555/);
  assert.match(sidecar,/modernWriteV563/);
  assert.match(sidecar,/roomId\.startsWith\('test-'\)/);
  assert.match(sidecar,/WorkBoardBusinessMemoActionsV563/);
  assert.match(sidecar,/return memoRepository\.commit\(next, expectedRevision\)/);
  assert.match(sidecar,/memoRepository\.remove\(id, expectedRevision\)/);
  assert.match(sidecar,/moveMemoV531\(request\.id, request\.targetId/);
  assert.match(ui,/WorkBoardBusinessMemoActionsV563/);
  assert.match(ui,/document\.querySelector\('\.readonly-flag'\)/);
  assert.match(html,/class="readonly-flag"/);
  assert.match(html,/id="memoNewV563"/);
  assert.match(html,/id="memoActionStatusV563"/);
  assert.match(ui,/function closeMemoFrameV555\(\)/);
  assert.match(ui,/removeEventListener\('workboard-memo-state-v555',render\)/);
  assert.match(ui,/closeMemoFrameV555\(\)/);
  assert.doesNotMatch(ui,/\b(?:runTransaction|onValue|localStorage|sessionStorage)\s*\(/);
  assert.doesNotMatch(ui,/window\.Demo|(?:import|from)[^\n]*demo-store/);
  assert.doesNotMatch(writer,/\bonValue\s*\(/);
});

test('Ver.555 owner remains a read-only sidecar and Classic memoList uses the same sort comparator',()=>{
  const app=read('app.js'),sidecar=read('work-features-v167.js');
  const ui=read('modern/product/memo-list-v555.mjs');
  const core=read('modern/product/memo-list-contract-v555.mjs');
  const html=read('modern/product/memo-list-read-v555.html');
  const preview=read('modern/preview/index.html'),release=read('release-manifest.js');
  assert.match(sidecar,/Object\.defineProperty\(window, 'WorkBoardBusinessMemoReadV555'/);
  assert.match(sidecar,/memoReadPhaseV555 = 'remote-online'/);
  assert.match(sidecar,/memoReadPhaseV555 = 'local-only'/);
  assert.match(sidecar,/memoReadPhaseV555 = 'degraded'/);
  assert.match(sidecar,/function compareMemoDisplayV555/);
  assert.match(sidecar,/sort\(\(a, b\) => compareMemoDisplayV555\(a, b, memoOrder\)\)/);
  assert.match(ui,/WorkBoardBusinessMemoReadV555/);
  assert.match(ui,/WorkBoardReadV550/);
  assert.match(ui,/workboard-memo-state-v555/);
  assert.match(ui,/textContent/);
  assert.match(ui,/replaceChildren/);
  assert.doesNotMatch(ui,/\binnerHTML\b|insertAdjacentHTML/);
  for(const source of [ui,core]){
    assert.doesNotMatch(source,/\b(?:initializeApp|getDatabase|runTransaction|onValue|onChildAdded|localStorage|sessionStorage|fetch)\s*\(/);
    assert.doesNotMatch(source,/\b(?:postMessage|setInterval|setTimeout)\s*\(/);
    assert.doesNotMatch(source,/window\.Demo|(?:import|from)[^\n]*demo-store/);
  }
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/\.\.\/layout\.css/);
  assert.match(html,/\.\.\/palettes\.css/);
  assert.match(html,/readonly-copy/);
  assert.doesNotMatch(html,/demo-store|firebaseConfig|app\.js/);
  assert.match(app,/function openModernTestViewV566\(target=null\)/);
  assert.match(app,/version:'555',attribute:'data-modern-memo-v555'/);
  assert.match(app,/ROOM_ID\.startsWith\('test-'\)/);
  assert.match(app,/flags\?\.\['modernReadV'\+view\.version\]===true/);
  assert.doesNotMatch(preview,/memo-list-read-v555/);
  assert.doesNotMatch(release,/memo-list-read-v555|memo-list-v555|memo-list-contract-v555/);
  assert.doesNotMatch(read('index.html'),/memo-list-read-v555/);
});
