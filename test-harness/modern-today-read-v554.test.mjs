import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { projectWorkspaceReadV550, createWorkspaceReadFacadeV550 } from '../workspace-read-v550.js';
import { selectModernTodayV554 as select } from '../modern/product/today-contract-v554.mjs';

const read = path => fs.readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const local = (y,m,d,h=9) => new Date(y,m-1,d,h,0).toISOString();
const doneToday = new Date(2026,9,29,10,30).getTime();
const doneBefore = new Date(2026,9,8,10,30).getTime();
const task=(id,title,dueDate,status,assignee,priority='中',extra={})=>({
  id,title,dueDate,status,assignee,priority,category:'PC',dueTime:'13:00',
  pinned:false,revision:1,updatedAt:100,createdAt:50,...extra
});
const todo=(id,owner,text,order,extra={})=>({
  id,owner,text,memo:'メモ-'+id,order,completed:false,completedAt:0,revision:2,...extra
});
const event=(id,title,startAt,endAt,assignee='佐藤',extra={})=>({
  id,title,startAt,endAt,assignee,category:'運用',location:'会議室',
  relatedTaskId:'late1',revision:1,...extra
});
function owner(){
  return {
    roomId:'test-v554',selectedUser:'佐藤',selectedUserReady:true,
    connectionMode:'local-only',
    collectionState:{tasks:'loading',todos:'loading',schedules:'loading',knowledge:'loading',meta:'loading'},
    today:new Date(2026,9,29),todayISO:'2026-10-29',
    isCompleted:status=>String(status).normalize('NFKC').replace(/\s+/g,'')==='完了',
    isMine:assignee=>['佐藤','共有ルーム'].includes(assignee),
    parseDueDate:value=>new Date(value+'T00:00:00'),
    tasks:[
      task('late1','緊急期限超過','2026-10-28','対応中','佐藤','緊急'),
      task('latePinned','固定・期限超過','2026-10-27','未着手','共有ルーム','低',{pinned:true}),
      task('holdLate','保留の期限超過','2026-10-26','保留','福冨','高'),
      task('dueToday','本日締切','2026-10-29','確認待ち','佐藤','高'),
      task('holdToday','保留の今日締切','2026-10-29','保留','福冨','低'),
      task('doneLate','完了した期限超過','2026-10-25','完了','佐藤','緊急'),
      task('future','将来の予定','2026-10-30','未着手','佐藤'),
      task('withoutDue','期限なし','', '未着手','共有ルーム')
    ],
    todoRaw:{
      open2:todo('open2','佐藤','あとから登録',8),
      open1:todo('open1','佐藤','先に登録',-3),
      done:todo('done','佐藤','今日完了',1,{completed:true,completedAt:doneToday}),
      history:todo('history','佐藤','過去完了',2,{completed:true,completedAt:doneBefore}),
      foreign:todo('foreign','福冨','別利用者の個人ToDo',-100,{completed:false})
    },
    schedules:[
      event('yesterday','昨日開始',local(2026,10,28,23),local(2026,10,29,1)),
      event('todayMorning','朝の予定',local(2026,10,29,8),local(2026,10,29,9)),
      event('todayEvening','夜の予定',local(2026,10,29,23),local(2026,10,30,1),'福冨'),
      event('tomorrow','明日の予定',local(2026,10,30,8),local(2026,10,30,9))
    ]
  };
}
const project = (raw=owner())=>projectWorkspaceReadV550(raw);

test('Ver.554 single snapshot shows Classic global KPI scope and hold-excluding action panels',()=>{
  const model=select(project());
  assert.equal(model.ready,true);
  assert.equal(model.roomId,'test-v554');
  assert.equal(model.todayISO,'2026-10-29');
  assert.deepEqual(model.stats,{openTasks:7,overdueTasks:3,todayTasks:2,mineTasks:5});
  assert.deepEqual(model.counts,{
    actionableOverdue:2,actionableToday:1,openTodos:2,
    completedTodayTodos:1,todaySchedules:2
  });
  assert.deepEqual(model.overdue.map(x=>x.id),['latePinned','late1']);
  assert.deepEqual(model.dueToday.map(x=>x.id),['dueToday']);
  assert.equal(model.overdue.some(x=>x.id==='holdLate'),false);
  assert.equal(model.dueToday.some(x=>x.id==='holdToday'),false);
});

test('Ver.554 preserves personal open ToDo order and excludes past-completed and other owners',()=>{
  const model=select(project());
  assert.deepEqual(model.openTodos.map(x=>x.id),['open1','open2']);
  assert.deepEqual(model.completedTodayTodos.map(x=>x.id),['done']);
  assert.equal(model.openTodos.some(x=>x.owner==='福冨'),false);
  assert.equal(model.openTodos.some(x=>x.id==='history'),false);
  assert.equal(model.counts.completedTodayTodos,1);
});

test('Ver.554 today schedules follow local start date and include all assignees',()=>{
  const model=select(project());
  assert.deepEqual(model.schedules.map(x=>x.id),['todayMorning','todayEvening']);
  assert.equal(model.schedules[1].assignee,'福冨');
  assert.equal(model.schedules[1].endDateISO,'2026-10-30');
  assert.equal(model.schedules[0].relatedTaskTitle,'緊急期限超過');
  assert.equal(model.counts.todaySchedules,2);
});

test('Ver.554 returns fully immutable detached snapshot, no second cache or write',()=>{
  const raw=owner();
  const before=structuredClone({tasks:raw.tasks,todoRaw:raw.todoRaw,schedules:raw.schedules});
  const result=select(project(raw));
  for(const item of [result,result.stats,result.counts,result.overdue,result.overdue[0],
    result.dueToday,result.dueToday[0],result.openTodos,result.openTodos[0],result.schedules,result.schedules[0]])
    assert.ok(Object.isFrozen(item));
  assert.throws(()=>{result.openTodos[0].text='altered';},TypeError);
  assert.throws(()=>result.schedules.push({id:'injected'}),TypeError);
  assert.deepEqual({tasks:raw.tasks,todoRaw:raw.todoRaw,schedules:raw.schedules},before);
  raw.todoRaw.open1.text='modified after read';
  raw.tasks[0].title='modified after read';
  assert.equal(result.openTodos[0].text,'先に登録');
  assert.equal(result.overdue.find(x=>x.id==='late1').title,'緊急期限超過');
});

test('Ver.554 selected-user change replaces only personal ToDo while task/schedule counts remain shared',()=>{
  const raw=owner();
  let calls=0;
  const facade=createWorkspaceReadFacadeV550(()=>{calls++;return raw});
  const first=select(facade.read());
  raw.selectedUser='福冨';raw.isMine=value=>value==='福冨';
  const next=select(facade.read());
  assert.equal(calls,2);
  assert.equal(first.selectedUser,'佐藤');
  assert.equal(next.selectedUser,'福冨');
  assert.deepEqual(next.openTodos.map(x=>x.id),['foreign']);
  assert.deepEqual(next.completedTodayTodos,[]);
  assert.equal(next.stats.mineTasks,2);
  assert.deepEqual(next.overdue.map(x=>x.id),first.overdue.map(x=>x.id));
  assert.deepEqual(next.schedules.map(x=>x.id),first.schedules.map(x=>x.id));
  assert.equal(next.openTodos.some(x=>x.id==='open1'),false);
});

test('Ver.554 fails closed when owner is loading, degraded, malformed or user unselected',()=>{
  const raw=owner();
  for(const mode of ['initializing','remote-loading','remote-degraded']){
    raw.connectionMode=mode;
    const model=select(project(raw));
    assert.equal(model.ready,false);
    assert.equal(model.source,null);
    assert.equal(model.stats,null);
    assert.deepEqual(model.openTodos,[]);
    assert.deepEqual(model.schedules,[]);
  }
  raw.connectionMode='remote-online';
  raw.collectionState.todos='loading';
  assert.equal(select(project(raw)).reason,'loading');
  raw.connectionMode='local-only';
  raw.selectedUserReady=false;
  assert.equal(select(project(raw)).reason,'identity-not-selected');
  const malformed=project(owner());
  assert.equal(select({...malformed,todoHistory:[{id:'leak',owner:'福冨',text:'secret',completed:true}]}).ready,false);
  assert.equal(select(null).reason,'invalid-snapshot');
});

test('Ver.554 remote-ready is supported, but partial remote collection always fails closed',()=>{
  const raw=owner();
  raw.connectionMode='remote-online';
  raw.collectionState=Object.fromEntries(Object.keys(raw.collectionState).map(k=>[k,'ready']));
  const model=select(project(raw));
  assert.equal(model.ready,true);
  assert.equal(model.source,'remote-online');
  raw.collectionState.schedules='loading';
  const missing=select(project(raw));
  assert.equal(missing.ready,false);
  assert.deepEqual(missing.overdue,[]);
  assert.deepEqual(missing.schedules,[]);
});

test('Ver.554 rejects tampered global counters instead of presenting inconsistent dashboard numbers',()=>{
  const snapshot=project();
  const forged={...snapshot,summary:{...snapshot.summary,overdue:0}};
  assert.equal(select(forged).reason,'inconsistent-summary');
  assert.equal(select({...snapshot,summary:{...snapshot.summary,mine:99}}).reason,'invalid-summary');
  const duplicate={...snapshot,tasks:[...snapshot.tasks,{...snapshot.tasks[0]}]};
  assert.equal(select(duplicate).ready,false);
  const other={...snapshot,selectedUser:'福冨'};
  assert.equal(select(other).ready,false);
});

test('Ver.554 does not display historical ToDos, announcements or business memos as fake daily data',()=>{
  const raw=owner();
  raw.tasks[0].title='<img src=x onerror=alert(1)>';
  raw.todoRaw.open1.memo='<script>danger</script>';
  raw.schedules[1].title='<svg onload=alert(1)>';
  const model=select(project(raw));
  assert.equal(model.overdue.find(x=>x.id==='late1').title,'<img src=x onerror=alert(1)>');
  assert.equal(model.openTodos[0].memo,'<script>danger</script>');
  assert.equal(model.schedules[0].title,'<svg onload=alert(1)>');
  assert.equal(model.announcements,undefined);
  assert.equal(model.memos,undefined);
  assert.equal(model.openTodos.some(x=>x.id==='history'),false);
});

test('Ver.554 preview limits never change the authoritative full counts',()=>{
  const raw=owner();
  for(let i=0;i<12;i++){
    raw.tasks.push(task('extra'+i,'追加期限超過 '+i,'2026-10-27','未着手','佐藤','低'));
    raw.todoRaw['extraTodo'+i]=todo('extraTodo'+i,'佐藤','追加ToDo '+i,i+40);
    raw.schedules.push(event('extraSchedule'+i,'追加予定 '+i,local(2026,10,29,14),local(2026,10,29,15)));
  }
  const model=select(project(raw));
  assert.equal(model.ready,true);
  assert.equal(model.overdue.length,6);
  assert.equal(model.openTodos.length,4);
  assert.equal(model.schedules.length,6);
  assert.equal(model.counts.actionableOverdue,14);
  assert.equal(model.counts.openTodos,14);
  assert.equal(model.counts.todaySchedules,14);
});

test('Ver.554 product boundary remains an explicit localhost-only readonly iframe',()=>{
  const core=read('modern/product/today-contract-v554.mjs');
  const ui=read('modern/product/today-v554.mjs');
  const html=read('modern/product/today-read-v554.html');
  const app=read('app.js');
  const release=read('release-manifest.js');
  const mock=read('modern/preview/index.html');
  assert.match(core,/selectModernTaskListV551/);
  assert.match(core,/selectModernTodosV552/);
  assert.match(core,/selectModernSchedulesV553/);
  assert.match(ui,/WorkBoardReadV550/);
  assert.match(ui,/const snapshot=readOwner\(\)/);
  assert.match(ui,/event\.key==='systemTaskUser'/);
  assert.match(ui,/clearData\(\)/);
  assert.match(ui,/textContent/);
  assert.doesNotMatch(ui,/\binnerHTML\b|insertAdjacentHTML/);
  for(const file of [core,ui]){
    assert.doesNotMatch(file,/\b(?:initializeApp|getDatabase|runTransaction|onValue|onChildAdded|localStorage|sessionStorage|fetch)\s*\(/);
    assert.doesNotMatch(file,/\b(?:postMessage|setInterval|setTimeout)\s*\(/);
    assert.doesNotMatch(file,/window\.Demo|(?:import|from)[^\n]*demo-store/);
  }
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/\.\.\/layout\.css/);
  assert.match(html,/\.\.\/palettes\.css/);
  assert.doesNotMatch(html,/demo-store|firebaseConfig|app\.js/);
  assert.match(html,/お知らせ・業務メモ/);
  assert.match(html,/未接続/);
  assert.match(app,/function openModernReadOnlyTodayTestV554\(\)/);
  assert.match(app,/ROOM_ID\.startsWith\('test-'\)/);
  assert.match(app,/test\?\.modernReadV554 !== true/);
  assert.doesNotMatch(release,/today-read-v554|today-v554|today-contract-v554/);
  assert.doesNotMatch(mock,/today-read-v554|workspace-read-v550/);
  assert.doesNotMatch(read('index.html'),/today-read-v554/);
});


test('Ver.564 Today navigation delegates to Classic only, retaining guarded read-only defaults',()=>{
  const app=read('app.js');
  const ui=read('modern/product/today-v554.mjs');
  const html=read('modern/product/today-read-v554.html');
  const manifest=read('release-manifest.js');
  assert.match(app,/function isModernTodayNavigationTestV564\(\)/);
  assert.match(app,/function installModernTodayNavigationV564\(\)/);
  assert.match(app,/Object\.defineProperty\(window, 'WorkBoardTodayNavigationV564'/);
  assert.match(app,/modernNavigateV564/);
  assert.match(app,/modernTodayNavigationCurrentV564\(owner\.snapshot, request\)/);
  assert.match(app,/selectTask\(current\.id\)/);
  assert.match(app,/openTodoWorkspace\(current\.id\)/);
  assert.match(app,/openScheduleDialog\(current\)/);
  assert.match(app,/nav\.click\(\)/);
  assert.match(ui,/WorkBoardTodayNavigationV564/);
  assert.match(ui,/document\.body\.dataset\.todayNavigationV564=canNavigate\?'enabled':'readonly'/);
  assert.match(ui,/request\.expectedRevision=Number\(row\.dataset\.revision\)/);
  assert.match(ui,/window\.frameElement\?\.remove\(\)/);
  assert.match(html,/data-today-navigation-v564="tasks" hidden/);
  assert.match(html,/data-today-navigation-v564="todos" hidden/);
  assert.match(html,/data-today-navigation-v564="schedules" hidden/);
  assert.match(html,/data-today-navigation-v564="memos" hidden/);
  assert.doesNotMatch(ui,/\b(?:initializeApp|getDatabase|runTransaction|onValue|localStorage|sessionStorage|fetch)\s*\(/);
  assert.doesNotMatch(ui,/\b(?:postMessage|setTimeout|setInterval)\s*\(/);
  assert.doesNotMatch(manifest,/modern\/product\/today-v554/);
});
