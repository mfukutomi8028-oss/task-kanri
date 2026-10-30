import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');

function makeMemoHarness(online = false) {
  const state = {
    roomId:'test-v539-room', db:{ source:'test' }, online, memos:{}
  };
  const calls = { ensure:0, persist:0, render:0, transaction:[], listeners:0 };
  const remote = new Map();
  const source = read('workspace-memo-v539.js');
  const window = {};
  vm.runInNewContext(source, { window }, { filename:'workspace-memo-v539.js' });
  const registered = window.WorkBoardMemoPersistenceV539;
  assert.equal(typeof registered.create, 'function');
  vm.runInNewContext(source, { window });
  assert.equal(window.WorkBoardMemoPersistenceV539, registered, 'install is idempotent');
  const firebaseModules = {
    ref(db, path) {
      assert.equal(db, state.db);
      return { path };
    },
    async runTransaction(target, updater) {
      const original = remote.get(target.path) ?? null;
      const next = updater(original ? { ...original } : null);
      calls.transaction.push({ path:target.path, prior:original, next });
      if (next === undefined) return { committed:false, snapshot:{ val:()=> original } };
      if (next === null) remote.delete(target.path);
      else remote.set(target.path, next);
      return { committed:true, snapshot:{ val:()=> next } };
    }
  };
  const owner = registered.create({
    getFeatureState:() => state,
    ensureFirebase: async () => {calls.ensure++;},
    firebaseModules,
    finiteRevision: n => {const v=Number(n);return Number.isSafeInteger(v)&&v>=0?v:0;},
    persistLocalMemos: () => {calls.persist++;},
    renderMemoView: () => {calls.render++;}
  });
  return { state, calls, remote, owner };
}

test('Ver.539 local memo create, edit, pin and delete retain revision and render behavior',async()=>{
  const h=makeMemoHarness();
  assert.equal(await h.owner.commit({id:'memo-a',title:'連絡先',body:'内線番号'},0),true);
  assert.equal(h.state.memos['memo-a'].revision,1);
  assert.equal(await h.owner.commit({id:'memo-a',title:'更新',body:'内線番号',pinned:true},1),true);
  assert.equal(h.state.memos['memo-a'].revision,2);
  assert.equal(h.state.memos['memo-a'].pinned,true);
  assert.equal(await h.owner.commit({id:'memo-a',title:'古い更新',body:'内容'},1),false);
  assert.equal(h.state.memos['memo-a'].title,'更新');
  assert.equal(await h.owner.remove('memo-a',2),true);
  assert.equal(h.state.memos['memo-a'],undefined);
  assert.deepEqual(h.calls,{ensure:4,persist:3,render:3,transaction:[],listeners:0});
});

test('Ver.539 remote memo commit rejects stale revision without writing or rerendering',async()=>{
  const h=makeMemoHarness(true);
  const path='rooms/test-v539-room/businessMemos/memo-a';
  h.remote.set(path,{id:'memo-a',title:'現行',body:'内容',revision:4});
  assert.equal(await h.owner.commit({id:'memo-a',title:'古い情報'},3),false);
  assert.equal(h.remote.get(path).title,'現行');
  assert.equal(h.calls.transaction.length,1);
  assert.equal(h.calls.transaction[0].next,undefined);
  assert.equal(h.calls.persist,0);
  assert.equal(h.calls.render,0);
  assert.equal(await h.owner.commit({id:'memo-a',title:'新しい情報',body:'内容'},4),true);
  assert.equal(h.remote.get(path).revision,5);
  assert.equal(h.remote.get(path).title,'新しい情報');
});

test('Ver.539 remote memo delete enforces exact revision and leaves other data alone',async()=>{
  const h=makeMemoHarness(true);
  const path='rooms/test-v539-room/businessMemos/memo-a';
  const other='rooms/test-v539-room/businessMemos/memo-other';
  h.remote.set(path,{id:'memo-a',title:'現行',revision:9});
  h.remote.set(other,{id:'memo-other',title:'維持',revision:3});
  assert.equal(await h.owner.remove('memo-a',8),false);
  assert.ok(h.remote.has(path));
  assert.equal(await h.owner.remove('memo-a',9),true);
  assert.equal(h.remote.has(path),false);
  assert.equal(h.remote.get(other).title,'維持');
  assert.equal(await h.owner.remove('memo-a',9),false);
  assert.equal(h.calls.persist,0);
  assert.equal(h.calls.render,0);
});

test('Ver.563 memo CAS never resurrects a deleted record or accepts stale local deletion',async()=>{
  for(const online of [false,true]){
    const h=makeMemoHarness(online);
    const id='memo-race';
    const path='rooms/test-v539-room/businessMemos/'+id;
    if(online)h.remote.set(path,{id,title:'old',revision:3});
    else h.state.memos[id]={id,title:'old',revision:3};
    const read=()=>online?h.remote.get(path):h.state.memos[id];
    // A peer deletes after a form captured revision 3.
    if(online)h.remote.delete(path);else delete h.state.memos[id];
    assert.equal(await h.owner.commit({id,title:'stale-update'},3),false);
    assert.equal(read(),undefined);
    assert.equal(await h.owner.remove(id,3),false);
    // A fresh create with expected revision 0 remains supported.
    assert.equal(await h.owner.commit({id,title:'fresh-create'},0),true);
    assert.equal(read().revision,1);
    assert.equal(await h.owner.remove(id,0),false);
    assert.equal(read().title,'fresh-create');
    assert.equal(await h.owner.remove(id,1),true);
    assert.equal(read(),undefined);
  }
});

test('Ver.539 uses the canonical writer once and never starts subscriptions or remote writes in local mode',async()=>{
  const h=makeMemoHarness();
  const r=await h.owner.commit({id:'memo-x',title:'業務メモ'},0);
  assert.equal(r,true);
  assert.equal(h.calls.transaction.length,0);
  assert.equal(h.calls.listeners,0);
  const code=read('workspace-memo-v539.js');
  assert.doesNotMatch(code,/\bonValue\s*\(/);
  assert.doesNotMatch(code,/\blocalStorage\b|\bdocument\b|firebaseConfig|fetch\s*\(/);
});

test('Ver.539 product memo sidecar delegates, with a single ordered script and no Modern data bridge',()=>{
  const sidecar=read('work-features-v167.js');
  const manifest=read('release-manifest.js');
  const modern=read('modern/preview/index.html');
  assert.match(sidecar,/window\.WorkBoardMemoPersistenceV539\.create\(/);
  assert.match(sidecar,/return memoRepository\.commit\(next, expectedRevision\)/);
  assert.match(sidecar,/const ok = await memoRepository\.remove\(id, expectedRevision\)/);
  assert.equal((manifest.match(/"workspace-memo-v539\.js"/g)||[]).length,2);
  const dynamic=manifest.slice(manifest.indexOf('dynamicScripts:'));
  const moduleIndex=dynamic.indexOf('"workspace-memo-v539.js"');
  const sidecarIndex=dynamic.indexOf('"work-features-v167.js"');
  assert.ok(moduleIndex>0&&sidecarIndex>moduleIndex,'module must load before canonical sidecar');
  assert.doesNotMatch(modern, /workspace-memo-v539|firebase|app\.js/i);
  assert.doesNotMatch(read('index.html'),/modern\/preview/);
});
