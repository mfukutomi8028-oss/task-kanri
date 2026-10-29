import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { projectWorkspaceReadV550, createWorkspaceReadFacadeV550 } from '../workspace-read-v550.js';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const localDate = value => new Date(value + 'T00:00:00');
const today = new Date(2026, 9, 29);
const completedAt = new Date(2026, 9, 29, 9, 30).getTime();
const oldCompletedAt = new Date(2026, 9, 27, 9, 30).getTime();

function owner() {
  return {
    roomId: 'sandbox-v550', selectedUser: '佐藤', selectedUserReady: true,
    connectionMode: 'remote-online',
    collectionState: {
      tasks: 'ready', schedules: 'ready', todos: 'ready',
      knowledge: 'ready', meta: 'ready'
    },
    today, todayISO: '2026-10-29',
    isCompleted: status => status === '完了',
    isMine: assignee => assignee === '佐藤' || assignee === '共有ルーム',
    parseDueDate: localDate,
    tasks: [
      { id:'t1', title:'期限超過', status:'対応中', assignee:'佐藤',
        dueDate:'2026-10-28', priority:'高', category:'PC', revision:2,
        description:'端末確認', tags:['重要'], internalToken:'should-not-appear' },
      { id:'t2', title:'今日', status:'未着手', assignee:'共有ルーム', dueDate:'2026-10-29', revision:1 },
      { id:'t3', title:'完了', status:'完了', assignee:'佐藤', dueDate:'2026-10-21', revision:3 },
      { id:'t4', title:'別担当', status:'保留', assignee:'福冨', dueDate:'2026-10-31', revision:1 }
    ],
    todoRaw: {
      selected: { id:'stale-inner', owner:'佐藤', text:'自分のToDo', memo:'未完了', completed:false, order:0, revision:3 },
      doneToday: { id:'doneToday', owner:'佐藤', text:'今日完了', completed:true, completedAt, order:1, revision:4 },
      doneBefore: { id:'doneBefore', owner:'佐藤', text:'過去完了', completed:true, completedAt:oldCompletedAt, order:2, revision:1 },
      other: { id:'other', owner:'福冨', text:'別人のToDo', completed:false, order:0, revision:1 },
      invalid: { id:'invalid', owner:'佐藤', text:'', completed:false, order:3 }
    },
    schedules: [
      { id:'s1', title:'打合せ', startAt:'2026-10-29T00:30:00.000Z',
        endAt:'2026-10-29T01:00:00.000Z', assignee:'佐藤', location:'会議室',
        category:'運用', memo:'確認', relatedTaskId:'t1', revision:4, privateCache:'not-exported' }
    ]
  };
}

test('Ver.550 uses existing Classic counters and canonical selected-user ToDo segment', () => {
  const base=owner();
  const before=structuredClone({
    tasks:base.tasks, todoRaw:base.todoRaw, schedules:base.schedules
  });
  const result=projectWorkspaceReadV550(base);
  assert.equal(result.version,'550');
  assert.equal(result.ready,true);
  assert.equal(result.source,'remote-online');
  assert.deepEqual(result.summary,{open:3,overdue:1,today:1,mine:2});
  assert.deepEqual(result.todos.map(todo=>todo.id),['selected','doneToday']);
  assert.equal(result.todos[0].id,'selected','key, not embedded record ID, is canonical');
  assert.equal(result.todos[0].owner,'佐藤');
  assert.ok(result.todos.every(todo=>todo.owner==='佐藤'));
  assert.equal(result.todos.some(todo=>todo.text==='別人のToDo'),false);
  assert.equal(result.todos.some(todo=>todo.text==='過去完了'),false,
    'historical completed ToDos require a separately reviewed contract');
  assert.equal(result.tasks.length,4);
  assert.equal(result.schedules.length,1);
  assert.deepEqual({tasks:base.tasks,todoRaw:base.todoRaw,schedules:base.schedules},before,
    'projection must not mutate or normalize the canonical owner');
});

test('Ver.550 projects real task and schedule field names without exposing unrelated internals', () => {
  const result=projectWorkspaceReadV550(owner());
  assert.equal(result.tasks[0].dueDate,'2026-10-28');
  assert.equal(result.tasks[0].assignee,'佐藤');
  assert.equal(result.tasks[0].description,'端末確認');
  assert.equal(result.tasks[0].revision,2);
  assert.equal(result.tasks[0].internalToken,undefined);
  assert.equal(result.tasks[0].tags,undefined);
  assert.equal(result.schedules[0].startAt,'2026-10-29T00:30:00.000Z');
  assert.equal(result.schedules[0].relatedTaskId,'t1');
  assert.equal(result.schedules[0].privateCache,undefined);
});

test('Ver.550 returned arrays and projected records are immutable independent copies', () => {
  const base=owner();
  const result=projectWorkspaceReadV550(base);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.summary));
  for(const key of ['tasks','todos','schedules']) {
    assert.ok(Object.isFrozen(result[key]));
    assert.ok(Object.isFrozen(result[key][0]));
    assert.throws(()=>result[key].push('injection'),TypeError);
  }
  assert.throws(()=>{result.tasks[0].title='modified';},TypeError);
  base.tasks[0].title='changed in owner';
  base.todoRaw.selected.text='updated in owner';
  assert.equal(result.tasks[0].title,'期限超過');
  assert.equal(result.todos[0].text,'自分のToDo');
});

test('Ver.550 explicitly distinguishes local-only mode from remote synchronization', () => {
  const base=owner();
  base.connectionMode='local-only';
  base.collectionState=Object.fromEntries(Object.keys(base.collectionState).map(k=>[k,'loading']));
  const result=projectWorkspaceReadV550(base);
  assert.equal(result.ready,true);
  assert.equal(result.source,'local-only');
  assert.equal(result.tasks.length,4);
});

test('Ver.550 never exports partial remote-loading or degraded cached business data', () => {
  for (const connectionMode of ['initializing','remote-loading','remote-degraded']) {
    const base=owner();
    base.connectionMode=connectionMode;
    const result=projectWorkspaceReadV550(base);
    assert.equal(result.ready,false);
    assert.equal(result.source,null);
    assert.deepEqual(result.tasks,[]);
    assert.deepEqual(result.todos,[]);
    assert.deepEqual(result.schedules,[]);
    assert.equal(result.summary,null);
    assert.equal(result.reason,connectionMode==='remote-degraded'?'degraded':'loading');
  }
  const base=owner(); base.collectionState.todos='loading';
  const result=projectWorkspaceReadV550(base);
  assert.equal(result.ready,false);
  assert.equal(result.reason,'loading');
  assert.deepEqual(result.tasks,[]);
});

test('Ver.550 refuses access before explicit local user selection', () => {
  const base=owner();
  base.selectedUserReady=false;
  const result=projectWorkspaceReadV550(base);
  assert.equal(result.ready,false);
  assert.equal(result.reason,'identity-not-selected');
  assert.deepEqual(result.todos,[]);
  base.selectedUserReady=true; base.selectedUser='';
  assert.equal(projectWorkspaceReadV550(base).ready,false);
});

test('Ver.550 fails closed on missing owner, invalid collection or duplicate canonical IDs', () => {
  assert.equal(projectWorkspaceReadV550(null).reason,'owner-unavailable');
  const a=owner(); a.schedules={}; assert.equal(projectWorkspaceReadV550(a).reason,'invalid-owner-state');
  const b=owner(); b.tasks.push({...b.tasks[0]}); assert.equal(projectWorkspaceReadV550(b).reason,'invalid-owner-state');
  const c=owner(); c.todayISO='not-a-date'; assert.equal(projectWorkspaceReadV550(c).reason,'invalid-owner-state');
  const d=owner(); d.todoRaw=[]; assert.equal(projectWorkspaceReadV550(d).reason,'invalid-owner-state');
});

test('Ver.550 facade reads the latest canonical room/user rather than maintaining a second cache', () => {
  const base=owner();
  let reads=0;
  const facade=createWorkspaceReadFacadeV550(()=>{reads++;return base;});
  assert.ok(Object.isFrozen(facade));
  assert.deepEqual(Object.keys(facade),['read']);
  assert.equal(typeof facade.subscribe,'undefined');
  const first=facade.read();
  base.roomId='another-test-room';
  base.selectedUser='福冨';
  base.isMine=assignee=>assignee==='福冨';
  const second=facade.read();
  assert.equal(reads,2);
  assert.equal(first.roomId,'sandbox-v550');
  assert.equal(second.roomId,'another-test-room');
  assert.deepEqual(second.todos.map(todo=>todo.id),['other']);
  assert.equal(second.selectedUser,'福冨');
  assert.throws(()=>createWorkspaceReadFacadeV550(),/canonical data-owner provider/);
});

test('Ver.550 empty ready snapshot remains explicit rather than pretending to be loading', () => {
  const base=owner();
  base.tasks=[];base.todoRaw={};base.schedules=[];
  const result=projectWorkspaceReadV550(base);
  assert.equal(result.ready,true);
  assert.deepEqual(result.summary,{open:0,overdue:0,today:0,mine:0});
  assert.deepEqual(result.todos,[]);
  assert.deepEqual(result.tasks,[]);
  assert.deepEqual(result.schedules,[]);
});

test('Ver.550 product routes reads through one Classic owner and does not connect Modern mock to Firebase', () => {
  const source=read('workspace-read-v550.js');
  const app=read('app.js');
  const manifest=read('release-manifest.js');
  const modern=read('modern/preview/index.html');
  const demo=read('modern/preview/demo-store.js');
  assert.match(source,/from '.\/workspace-core-v537\.js'/);
  assert.doesNotMatch(source,/\bonValue\s*\(|runTransaction\s*\(|initializeApp\s*\(|getDatabase\s*\(|localStorage|document\.|fetch\s*\(/);
  assert.match(app,/import \{ createWorkspaceReadFacadeV550 \} from '\.\/workspace-read-v550\.js';/);
  assert.match(app,/window, 'WorkBoardReadV550'/);
  assert.match(app,/getCanonicalOwner/);
  assert.match(app,/selectedUserReady: Boolean\(sanitizeUser\(state\.currentUser\)\)/);
  assert.match(app,/todoRaw: state\.todoRaw/);
  assert.match(app,/schedules: state\.schedules/);
  const asset=manifest.match(/requiredAssets:\s*\[([\s\S]*?)\],\s*optionalAssets/)?.[1]||'';
  assert.equal((asset.match(/"workspace-read-v550\.js"/g)||[]).length,1);
  assert.doesNotMatch(manifest.match(/dynamicScripts:\s*\[[^\]]+\]/)?.[0]||'',/workspace-read-v550/);
  assert.doesNotMatch(modern,/workspace-read-v550|app\.js|config\.js/);
  assert.match(demo,/Isolated mock data/);
  assert.doesNotMatch(read('index.html'),/modern\/preview/);
});
