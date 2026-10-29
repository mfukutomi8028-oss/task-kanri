import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { projectWorkspaceReadV550, createWorkspaceReadFacadeV550 } from '../workspace-read-v550.js';
import { selectModernTodosV552 } from '../modern/product/todo-list-contract-v552.mjs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const local = (day, hour = 10) => new Date(2026, 9, day, hour, 30).getTime();
const mk = (id, owner, order, text, extra = {}) => ({
  id, owner, order, text, memo: 'メモ-' + id, createdAt: 1000 + order,
  completed: false, completedAt: 0, updatedAt: 2000, revision: 2, ...extra
});
function owner() {
  return {
    roomId:'test-v552', selectedUser:'佐藤', selectedUserReady:true,
    connectionMode:'local-only',
    collectionState:{tasks:'loading',todos:'loading',schedules:'loading',knowledge:'loading',meta:'loading'},
    today:new Date(2026,9,29), todayISO:'2026-10-29',
    tasks:[], schedules:[],
    isCompleted:s=>s==='完了',isMine:()=>false,parseDueDate:x=>new Date(x+'T00:00:00'),
    todoRaw:{
      a: mk('a','佐藤',10,'未完了：後', {memo:'後続'}),
      b: mk('b','佐藤',-10,'未完了：先', {memo:'先頭'}),
      d1: mk('d1','佐藤',9,'本日完了：後', {completed:true,completedAt:local(29,9)}),
      d2: mk('d2','佐藤',-4,'本日完了：先', {completed:true,completedAt:local(29,10)}),
      h1: mk('h1','佐藤',8,'古い履歴', {completed:true,completedAt:local(1),memo:'数週間前の内容'}),
      h2: mk('h2','佐藤',7,'新しい履歴', {completed:true,completedAt:local(28),memo:'履歴の本文'}),
      h0: mk('h0','佐藤',2,'日時がない履歴', {completed:true,completedAt:0}),
      other: mk('other','福冨',-100,'別の人の情報', {memo:'他の利用者の非公開メモ',completed:true,completedAt:local(28)}),
      'bad/key': mk('bad/key','佐藤',-200,'不正キー', {completed:true,completedAt:local(28)})
    }
  };
}

test('Ver.552 preserves canonical open-first / completed-today order, with separate full historic segment', () => {
  const raw=owner();
  const snapshot=projectWorkspaceReadV550(raw);
  assert.equal(snapshot.version,'550','legacy consumers retain the version contract');
  assert.deepEqual(snapshot.todos.map(t=>t.id),['b','a','d2','d1']);
  assert.deepEqual(snapshot.todoHistory.map(t=>t.id),['h2','h1','h0'],
    'history is newest first, and older completions are not silently limited to 7 days');
  assert.deepEqual(snapshot.todos.filter(t=>t.completed).map(t=>t.id),['d2','d1']);
  const model=selectModernTodosV552(snapshot);
  assert.equal(model.ready,true);
  assert.equal(model.source,'local-only');
  assert.deepEqual(model.totals,{open:2,completedToday:2,history:3});
  assert.deepEqual(model.open.map(t=>t.id),['b','a']);
  assert.deepEqual(model.completedToday.map(t=>t.id),['d2','d1']);
  assert.deepEqual(model.history.map(t=>t.id),['h2','h1','h0']);
  assert.equal(model.history[1].memo,'数週間前の内容');
  assert.equal(model.history[2].completedAt,0);
});

test('Ver.552 excludes other owners and invalid Firebase ToDo keys in every segment', () => {
  const raw=owner();
  let snapshot=projectWorkspaceReadV550(raw);
  let model=selectModernTodosV552(snapshot);
  assert.equal(model.open.some(t=>t.id==='other'),false);
  assert.equal(model.completedToday.some(t=>t.id==='other'),false);
  assert.equal(model.history.some(t=>t.id==='other' || t.id==='bad/key'),false);
  const facade=createWorkspaceReadFacadeV550(()=>raw);
  raw.selectedUser='福冨';
  snapshot=facade.read();
  model=selectModernTodosV552(snapshot);
  assert.equal(model.ready,true);
  assert.deepEqual(model.open,[]);
  assert.deepEqual(model.completedToday,[]);
  assert.deepEqual(model.history.map(t=>t.id),['other']);
  assert.equal(model.history[0].memo,'他の利用者の非公開メモ');
  raw.selectedUser='佐藤';
  assert.equal(facade.read().selectedUser,'佐藤','reads always use latest selected Classic owner');
  assert.deepEqual(selectModernTodosV552(facade.read()).history.map(t=>t.id),['h2','h1','h0']);
});

test('Ver.552 searches text and memo without reordering or mutating the canonical records', () => {
  const raw=owner(); const before=structuredClone(raw.todoRaw);
  const snapshot=projectWorkspaceReadV550(raw);
  const memo=selectModernTodosV552(snapshot,{query:'数週間前'});
  assert.deepEqual(memo.history.map(t=>t.id),['h1']);
  assert.deepEqual(memo.open,[]);
  assert.deepEqual(memo.visible,{open:0,completedToday:0,history:1});
  assert.deepEqual(memo.totals,{open:2,completedToday:2,history:3});
  const matching=selectModernTodosV552(snapshot,{query:'本日完了'});
  assert.deepEqual(matching.completedToday.map(t=>t.id),['d2','d1']);
  assert.deepEqual(raw.todoRaw,before,'no API write or in-memory mutation');
});

test('Ver.552 returned groups, counts and records are immutable and detached from Classic memory', () => {
  const raw=owner();
  const snapshot=projectWorkspaceReadV550(raw);
  const model=selectModernTodosV552(snapshot);
  for(const value of [snapshot,snapshot.todoHistory,snapshot.todoHistory[0],model,model.totals,model.visible,
    model.open,model.completedToday,model.history,model.history[0]])assert.ok(Object.isFrozen(value));
  assert.throws(()=>{model.history[0].text='changed';},TypeError);
  assert.throws(()=>model.history.push({id:'x'}),TypeError);
  raw.todoRaw.h2.memo='owner edited';
  assert.equal(model.history[0].memo,'履歴の本文');
  assert.equal(snapshot.todoHistory[0].memo,'履歴の本文');
});

test('Ver.552 rejects wrong owner, duplicate IDs, mixed segment order and forged record state', () => {
  const snapshot=projectWorkspaceReadV550(owner());
  const spoof={...snapshot,todoHistory:[...snapshot.todoHistory,{...snapshot.todoHistory[0],owner:'福冨',id:'leak'}]};
  assert.equal(selectModernTodosV552(spoof).ready,false);
  assert.deepEqual(selectModernTodosV552(spoof).history,[]);
  const dup={...snapshot,todoHistory:[...snapshot.todoHistory,{...snapshot.todos[0],completed:true}]};
  assert.equal(selectModernTodosV552(dup).reason,'invalid-snapshot');
  const wrongOrder={...snapshot,todos:[snapshot.todos[2],snapshot.todos[0]]};
  assert.equal(selectModernTodosV552(wrongOrder).ready,false);
  const wrongHistory={...snapshot,todoHistory:[{...snapshot.todoHistory[0],completed:false}]};
  assert.equal(selectModernTodosV552(wrongHistory).ready,false);
});

test('Ver.552 fails closed during loading, degraded connections, absent owners or invalid cache', () => {
  const raw=owner();
  for(const mode of ['initializing','remote-degraded','remote-loading']) {
    raw.connectionMode=mode;
    const read=projectWorkspaceReadV550(raw);
    assert.deepEqual(read.todoHistory,[]);
    const model=selectModernTodosV552(read);
    assert.equal(model.ready,false);
    assert.deepEqual(model.open,[]);
    assert.deepEqual(model.completedToday,[]);
    assert.deepEqual(model.history,[]);
  }
  raw.connectionMode='remote-online'; raw.collectionState.todos='loading';
  assert.equal(selectModernTodosV552(projectWorkspaceReadV550(raw)).reason,'loading');
  raw.connectionMode='local-only';raw.selectedUserReady=false;
  assert.equal(selectModernTodosV552(projectWorkspaceReadV550(raw)).reason,'identity-not-selected');
  assert.equal(selectModernTodosV552(null).reason,'invalid-snapshot');
});

test('Ver.552 remote-ready snapshot is allowed only after every Classic collection is synchronized', () => {
  const raw=owner();
  raw.connectionMode='remote-online';
  raw.collectionState=Object.fromEntries(Object.keys(raw.collectionState).map(k=>[k,'ready']));
  let snapshot=projectWorkspaceReadV550(raw);
  assert.equal(snapshot.ready,true);
  let view=selectModernTodosV552(snapshot);
  assert.equal(view.ready,true);
  assert.equal(view.source,'remote-online');
  assert.deepEqual(view.history.map(t=>t.id),['h2','h1','h0']);
  raw.collectionState.schedules='loading';
  snapshot=projectWorkspaceReadV550(raw);
  view=selectModernTodosV552(snapshot);
  assert.equal(view.ready,false);
  assert.deepEqual(view.history,[]);
  assert.deepEqual(view.open,[]);
});

test('Ver.552 preserves potentially unsafe text literally but exports no extra raw fields', () => {
  const raw=owner();
  raw.todoRaw.h2.text='<img src=x onerror=alert(1)>';
  raw.todoRaw.h2.memo='<script>danger</script>';
  raw.todoRaw.h2.internalPassword='private';
  const model=selectModernTodosV552(projectWorkspaceReadV550(raw));
  assert.equal(model.history[0].text,'<img src=x onerror=alert(1)>');
  assert.equal(model.history[0].memo,'<script>danger</script>');
  assert.equal(model.history[0].internalPassword,undefined);
  assert.equal(model.history[0].updatedBy,undefined);
});

test('Ver.552 product has no second Firebase/storage owner and is explicitly localhost-test only', () => {
  const app=read('app.js');
  const facade=read('workspace-read-v550.js');
  const script=read('modern/product/todo-list-v552.mjs');
  const contract=read('modern/product/todo-list-contract-v552.mjs');
  const html=read('modern/product/todo-list-read-v552.html');
  const preview=read('modern/preview/index.html');
  const release=read('release-manifest.js');
  assert.match(facade,/todoHistory: Object\.freeze\(history\.map\(todoRow\)\)/);
  assert.match(facade,/sortTodos\(owner\.todoRaw, selectedUser\)/);
  assert.match(script,/WorkBoardReadV550/);
  assert.match(script,/selectModernTodosV552/);
  assert.match(script,/event\.key === 'systemTaskUser'/);
  assert.match(script,/textContent/);
  assert.doesNotMatch(script,/\binnerHTML\b|insertAdjacentHTML/);
  for(const source of [script,contract]) {
    assert.doesNotMatch(source,/\b(?:initializeApp|getDatabase|runTransaction|onValue|onChildAdded|localStorage|sessionStorage|fetch)\s*\(/);
    assert.doesNotMatch(source,/window\.Demo|(?:import|from)[^\n]*demo-store/);
    assert.doesNotMatch(source,/\b(?:postMessage|setInterval|setTimeout)\s*\(/);
  }
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/\.\.\/layout\.css/);
  assert.match(html,/\.\.\/palettes\.css/);
  assert.doesNotMatch(html,/demo-store|firebaseConfig|app\.js/);
  assert.match(app,/function openModernReadOnlyTodoTestV552\(\)/);
  assert.match(app,/ROOM_ID\.startsWith\('test-'\)/);
  assert.match(app,/flags\?\.modernReadV552 !== true/);
  assert.match(app,/modernReadV552/);
  assert.doesNotMatch(preview,/todo-list-read-v552/);
  assert.doesNotMatch(release,/todo-list-v552|todo-list-read-v552|todo-list-contract-v552/);
  assert.doesNotMatch(read('index.html'),/todo-list-read-v552/);
});
