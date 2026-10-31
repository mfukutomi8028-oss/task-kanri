import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { selectModernTaskListV551 } from '../modern/product/task-list-contract-v551.mjs';
import { projectWorkspaceReadV550 } from '../workspace-read-v550.js';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const makeRaw = () => ({
  roomId: 'test-v551', selectedUser: '佐藤', selectedUserReady: true,
  connectionMode: 'local-only', collectionState: {
    tasks:'loading', schedules:'loading', knowledge:'loading', todos:'loading', meta:'loading'
  },
  today: new Date(2026, 9, 29), todayISO:'2026-10-29',
  isCompleted: status => status === '完了',
  isMine: assignee => assignee === '佐藤',
  parseDueDate: value => new Date(value + 'T00:00:00'),
  todoRaw: {a:{id:'a',owner:'佐藤',text:'自分',completed:false},b:{id:'b',owner:'福冨',text:'別人',completed:false}},
  schedules: [],
  tasks: [
    {id:'t3',title:'完了済み',status:'完了',assignee:'福冨',category:'その他',dueDate:'2026-10-23',priority:'低',revision:3},
    {id:'t2',title:'共有 予定',status:'未着手',assignee:'佐藤',category:'PC',dueDate:'2026-10-29',priority:'中',revision:2},
    {id:'t4',title:'未設定期日',status:'確認待ち',assignee:'佐藤',category:'ネットワーク',dueDate:'',priority:'緊急',revision:1},
    {id:'t1',title:'期限 超過',status:'対応中',assignee:'福冨',category:'プリンタ',dueDate:'2026-10-28',priority:'高',revision:5}
  ]
});

test('Ver.551 consumes Ver.550 canonical fields and preserves overdue, completed, and owner meanings', () => {
  const raw=makeRaw();
  const before=structuredClone(raw.tasks);
  const view=selectModernTaskListV551(projectWorkspaceReadV550(raw));
  assert.equal(view.ready,true);
  assert.equal(view.source,'local-only');
  assert.equal(view.roomId,'test-v551');
  assert.equal(view.selectedUser,'佐藤');
  assert.equal(view.total,4);
  assert.equal(view.visible,4);
  assert.deepEqual(view.rows.map(row=>row.id),['t1','t2','t4','t3']);
  assert.deepEqual(view.rows.map(row=>row.overdue),[true,false,false,false]);
  assert.deepEqual(view.rows.map(row=>row.completed),[false,false,false,true]);
  assert.deepEqual(view.rows.map(row=>row.revision),[5,2,1,3]);
  assert.deepEqual(raw.tasks,before);
  assert.equal(view.rows[0].assignee,'福冨','shared task list includes any assignee');
});

test('Ver.551 local search and status filter never mutate canonical state or change display labels', () => {
  const raw=makeRaw();
  const snapshot=projectWorkspaceReadV550(raw);
  const first=selectModernTaskListV551(snapshot,{query:'期限　超過'});
  assert.deepEqual(first.rows.map(x=>x.id),['t1']);
  const second=selectModernTaskListV551(snapshot,{status:'完了'});
  assert.deepEqual(second.rows.map(x=>x.id),['t3']);
  assert.equal(second.visible,1);
  assert.deepEqual(selectModernTaskListV551(snapshot,{status:'not-configured'}).rows,[]);
  assert.deepEqual(raw.tasks,makeRaw().tasks);
  assert.deepEqual(snapshot.tasks.map(x=>x.id),['t3','t2','t4','t1']);
});

test('Ver.551 returns fully frozen detached view records and rejects noncanonical IDs', () => {
  const raw=makeRaw();
  const model=selectModernTaskListV551(projectWorkspaceReadV550(raw));
  assert.ok(Object.isFrozen(model));
  assert.ok(Object.isFrozen(model.rows));
  assert.ok(Object.isFrozen(model.rows[0]));
  assert.ok(Object.isFrozen(model.statuses));
  assert.throws(()=>{model.rows[0].title='corrupt';},TypeError);
  assert.throws(()=>model.rows.push({id:'unsafe'}),TypeError);
  assert.equal(raw.tasks[3].title,'期限 超過');
  const snapshot=projectWorkspaceReadV550(raw);
  const duplicate={...snapshot,tasks:[...snapshot.tasks,{...snapshot.tasks[0]}]};
  assert.equal(selectModernTaskListV551(duplicate).ready,false);
  assert.deepEqual(selectModernTaskListV551(duplicate).rows,[]);
});

test('Ver.551 loading, degraded and unselected source fail closed with no leaked task rows', () => {
  const raw=makeRaw();
  for(const mode of ['remote-loading','remote-degraded','initializing']){
    raw.connectionMode=mode;
    const result=selectModernTaskListV551(projectWorkspaceReadV550(raw));
    assert.equal(result.ready,false);
    assert.equal(result.total,0);
    assert.deepEqual(result.rows,[]);
    assert.equal(result.source,null);
  }
  raw.connectionMode='local-only';
  raw.selectedUserReady=false;
  assert.deepEqual(selectModernTaskListV551(projectWorkspaceReadV550(raw)).rows,[]);
  assert.equal(selectModernTaskListV551(null).ready,false);
});

test('Ver.551 project never interprets mock state or any unapproved fields', () => {
  const raw=makeRaw();
  raw.tasks[0].debugPassword='should-not-copy';
  raw.tasks[0].title='<img src=x onerror=alert(1)>';
  const view=selectModernTaskListV551(projectWorkspaceReadV550(raw));
  const task=view.rows.find(x=>x.id==='t3');
  assert.equal(task.title,'<img src=x onerror=alert(1)>');
  assert.equal(task.debugPassword,undefined);
  assert.equal(task.description,undefined);
  assert.equal(task.history,undefined);
});

test('Ver.551 product is a localhost/test-room opt-in iframe, not a new product store or design switch', () => {
  const script=read('modern/product/task-list-v551.mjs');
  const html=read('modern/product/task-list-read-v551.html');
  const model=read('modern/product/task-list-contract-v551.mjs');
  const app=read('app.js');
  const demo=read('modern/preview/demo-store.js');
  const preview=read('modern/preview/index.html');
  const release=read('release-manifest.js');
  for(const source of [script,model]){
    assert.doesNotMatch(source,/\b(?:initializeApp|getDatabase|runTransaction|onValue|onChildAdded|localStorage|sessionStorage|fetch)\s*\(/);
    assert.doesNotMatch(source,/\b(?:addEventListener\(['"]message|postMessage|setInterval)\s*\(/);
    assert.doesNotMatch(source,/window\.Demo|(?:import|from)[^\n]*demo-store/);
  }
  assert.match(script,/WorkBoardReadV550/);
  assert.match(script,/selectModernTaskListV551/);
  assert.match(script,/textContent/);
  assert.doesNotMatch(script,/innerHTML|insertAdjacentHTML/);
  assert.match(html,/modern v2|Modern v2/i);
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/\.\.\/layout\.css/);
  assert.match(html,/\.\.\/palettes\.css/);
  assert.doesNotMatch(html,/demo-store|firebaseConfig|app\.js/);
  assert.match(app,/function openModernTestViewV566\(target=null\)/);
  assert.match(app,/version:'551',attribute:'data-modern-task-v551'/);
  assert.match(app,/localhost/);
  assert.match(app,/ROOM_ID\.startsWith\('test-'\)/);
  assert.match(app,/flags\?\.\['modernReadV'\+view\.version\]===true/);
  assert.match(release,/task-list-read-v551|task-list-v551|task-list-contract-v551/);
  assert.match(demo,/Isolated mock data/);
  assert.doesNotMatch(preview,/task-list-read-v551|workspace-read-v550/);
  assert.doesNotMatch(read('index.html'),/task-list-read-v551/);
});


test('Ver.560 reuses the Classic task dialog and status writer behind independent test gates', () => {
  const app = read('app.js');
  const html = read('modern/product/task-list-read-v551.html');
  const view = read('modern/product/task-list-v551.mjs');
  const release = read('release-manifest.js');

  assert.match(app, /function isModernTaskWriteTestV560\(\)/);
  assert.match(app, /query\.get\('modernReadV551'\) === '1'/);
  assert.match(app, /query\.get\('modernWriteV560'\) === '1'/);
  assert.match(app, /flags\?\.modernWriteV560 === true/);
  assert.match(app, /ROOM_ID\.startsWith\('test-'\)/);
  assert.match(app, /ns=demo-/);
  assert.match(app, /function installModernTaskActionsV560\(\)/);
  assert.match(app, /Object\.defineProperty\(window, 'WorkBoardTaskActionsV560'/);
  assert.match(app, /openTaskDialog\(current\)/);
  assert.match(app, /openTaskDialog\(\)/);
  assert.match(app, /await completeTaskWithMemo\(current\.id\)/);
  assert.match(app, /await changeStatus\(current\.id, request\.status\)/);
  assert.match(app, /async function commitTaskDraft\(/);
  assert.match(app, /return transitionTaskStatus\(task, COMPLETED_STATUS, memo\.trim\(\)\)/);
  assert.match(view, /function taskActionsV560\(\)/);
  assert.match(view, /actions\.statuses\(ownerRequest\(shown\)\)/);
  assert.match(view, /document\.createElement\('select'\)/);
  assert.match(view, /textContent/);
  assert.doesNotMatch(view, /innerHTML|insertAdjacentHTML|runTransaction\s*\(|initializeApp\s*\(|getDatabase\s*\(|localStorage\s*\./);
  assert.doesNotMatch(view, /(?:import|from)[^\n]*demo-store/);
  assert.match(html, /id="taskNewV560"/);
  assert.match(html, /id="taskActionStatusV560"/);
  assert.doesNotMatch(release, /taskNewV560|task-status-v560/);
});


test('Ver.561 extends the existing task owner, reuses Classic delete and detail, and retires unreachable delete source', () => {
  const app = read('app.js');
  const view = read('modern/product/task-list-v551.mjs');
  const html = read('modern/product/task-list-read-v551.html');
  const release = read('release-manifest.js');
  assert.match(app, /function isModernTaskAdvancedTestV561\(\)/);
  assert.match(app, /query\.get\('modernWriteV561'\) === '1'/);
  assert.match(app, /window\.WORK_BOARD_TEST\?\.modernWriteV561 === true/);
  assert.match(app, /return isModernTaskWriteTestV560\(\)/);
  assert.match(app, /Object\.assign\(actions, \{/);
  assert.match(app, /Object\.freeze\(actions\)/);
  assert.match(app, /selectTask\(current\.id\)/);
  assert.match(app, /const base = captureDeleteBase\(current\.id\)/);
  assert.match(app, /const result = await requestTaskDelete\(current\.id, base\)/);
  assert.match(app, /result\?\.error === 'remote-content-changed'/);
  assert.match(app, /async function deleteTaskV134\(id, base, options = \{\}\)/);
  assert.match(app, /return deleteTaskV134\(id, base, options\)/);
  assert.doesNotMatch(app, /Pre-Ver\.134 implementation retained below/);
  assert.doesNotMatch(app, /const deleteOnce = async/);
  assert.doesNotMatch(app, /function classifyDeleteConflict\(/);
  assert.match(view, /const advanced = writable && typeof actions\?\.detail === 'function'/);
  assert.match(view, /detail\.dataset\.taskActV560 = 'detail'/);
  assert.match(view, /remove\.dataset\.taskActV560 = 'remove'/);
  assert.match(view, /window\.frameElement\?\.remove\(\)/);
  assert.doesNotMatch(view, /innerHTML|insertAdjacentHTML|runTransaction\s*\(|getDatabase\s*\(|localStorage\s*\./);
  assert.match(html, /task-row-tools-v561/);
  assert.doesNotMatch(release, /modernWriteV561|task-delete-v561/);
});
