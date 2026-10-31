import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { projectWorkspaceReadV550 } from '../workspace-read-v550.js';
import { selectModernSchedulesV553 as select } from '../modern/product/schedule-list-contract-v553.mjs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const when = (year,month,day,hour=9,minute=0) =>
  new Date(year,month-1,day,hour,minute).toISOString();
const date = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const dateISO = (year,month,day) => date(new Date(year,month-1,day));
const task = (id,title) => ({id,title,status:'未着手',revision:1});
function entry(id,title,startAt,endAt,add={}) {
  return {id,title,startAt,endAt,assignee:'佐藤',category:'PC',
    location:'会議室',memo:'説明文',relatedTaskId:'task1',revision:2,...add};
}
function owner() {
  return {
    roomId:'test-modern-schedule-v553', selectedUser:'佐藤', selectedUserReady:true,
    connectionMode:'local-only',
    collectionState:{tasks:'loading',todos:'loading',schedules:'loading',knowledge:'loading',meta:'loading'},
    today:new Date(2026,9,29), todayISO:'2026-10-29',
    todoRaw:{},
    tasks:[task('task1','関連する準備作業'),task('task2','月次確認')],
    schedules:[
      entry('before','前日の予定',when(2026,10,28,23,30),when(2026,10,29,0,45)),
      entry('morning','朝の確認',when(2026,10,29,8,5),when(2026,10,29,9,0)),
      entry('afternoon','午後の確認',when(2026,10,29,13,30),when(2026,10,29,14,0),
        {assignee:'福冨',category:'運用',location:'会議室B',memo:'手順レビュー',relatedTaskId:'missing'}),
      entry('cross','日をまたぐ予定',when(2026,10,29,23,40),when(2026,10,30,1,0),
        {relatedTaskId:'task2'}),
      entry('endUnknown','終了未設定',when(2026,10,29,16,0),'invalid-end',{relatedTaskId:''}),
      entry('monthEnd','月末',when(2026,10,31,10,0),when(2026,10,31,11,0)),
      entry('nextMonth','翌月',when(2026,11,1,9,0),when(2026,11,1,9,30)),
      entry('weekLast','7日目',when(2026,11,4,11,0),when(2026,11,4,12,0)),
      entry('nextWeek','8日目',when(2026,11,5,0,0),when(2026,11,5,1,0)),
      entry('invalidStart','不正開始日','invalid-start',when(2026,10,29,15,0))
    ],
    isCompleted:status=>status==='完了',
    isMine:assignee=>assignee==='佐藤',
    parseDueDate:value=>new Date(value+'T00:00:00')
  };
}
const view = (raw=owner(),opts={}) => select(projectWorkspaceReadV550(raw),opts);

test('Ver.553 today range follows the Classic local startAt, not endAt, across midnight',()=>{
  const model=view();
  assert.equal(model.ready,true);
  assert.equal(model.source,'local-only');
  assert.equal(model.anchorISO,'2026-10-29');
  assert.equal(model.startISO,'2026-10-29');
  assert.equal(model.endISO,'2026-10-30');
  assert.deepEqual(model.rows.map(x=>x.id),['morning','afternoon','endUnknown','cross']);
  assert.equal(model.total,4);
  assert.equal(model.visible,4);
  assert.deepEqual(model.days.map(x=>x.dateISO),['2026-10-29']);
  assert.equal(model.rows.find(x=>x.id==='cross').endDateISO,'2026-10-30');
  assert.equal(model.rows.find(x=>x.id==='cross').endMinute,60);
  assert.equal(model.rows.find(x=>x.id==='morning').startMinute,8*60+5);
  assert.equal(model.rows.find(x=>x.id==='endUnknown').endKnown,false);
});

test('Ver.553 seven-day window includes exact local 7 days, excludes next midnight',()=>{
  const model=view(owner(),{anchorISO:'2026-10-29',range:'week'});
  assert.equal(model.ready,true);
  assert.equal(model.startISO,'2026-10-29');
  assert.equal(model.endISO,'2026-11-05');
  assert.equal(model.total,7);
  assert.ok(model.rows.some(x=>x.id==='weekLast'));
  assert.ok(model.rows.some(x=>x.id==='nextMonth'));
  assert.ok(!model.rows.some(x=>x.id==='before' || x.id==='nextWeek'));
  assert.deepEqual(model.days.map(x=>x.dateISO),
    ['2026-10-29','2026-10-31','2026-11-01','2026-11-04']);
});

test('Ver.553 month boundaries and calendar grid use local dates and Sunday-first layout',()=>{
  const model=view(owner(),{anchorISO:'2026-10-29',range:'month',mode:'calendar'});
  assert.equal(model.startISO,'2026-10-01');
  assert.equal(model.endISO,'2026-11-01');
  assert.equal(model.total,6);
  assert.equal(model.calendar.length,35);
  assert.equal(model.calendar[0].dateISO,'2026-09-27');
  assert.equal(model.calendar[0].inMonth,false);
  const day=model.calendar.find(x=>x.dateISO==='2026-10-29');
  assert.ok(day.today);
  assert.deepEqual(day.rows.map(x=>x.id),['morning','afternoon','endUnknown','cross']);
  const end=model.calendar.find(x=>x.dateISO==='2026-10-31');
  assert.equal(end.rows.length,1);
  assert.ok(!model.calendar.some(x=>x.rows.some(e=>e.id==='nextMonth')));
  const list=view(owner(),{anchorISO:'2026-10-29',range:'month',mode:'list'});
  assert.deepEqual(list.rows.map(x=>x.id),model.rows.map(x=>x.id));
  assert.deepEqual(list.calendar,[]);
});

test('Ver.553 date anchors follow calendar months including leap February',()=>{
  const base=owner();
  base.schedules=[entry('leap','うるう年',when(2024,2,29,12),when(2024,2,29,13)),
    entry('march','翌月境界',when(2024,3,1,0),when(2024,3,1,1))];
  const model=view(base,{anchorISO:'2024-02-29',range:'month'});
  assert.equal(model.startISO,'2024-02-01');
  assert.equal(model.endISO,'2024-03-01');
  assert.deepEqual(model.rows.map(r=>r.id),['leap']);
  assert.equal(select(projectWorkspaceReadV550(base),{anchorISO:'2026-02-30'}).reason,'invalid-selection');
});

test('Ver.553 exact assignee/category filtering and search reuse true related-task titles',()=>{
  const snapshot=projectWorkspaceReadV550(owner());
  const all=select(snapshot);
  assert.deepEqual(all.categories,['PC','運用']);
  assert.deepEqual(all.assignees,['佐藤','福冨']);
  assert.equal(all.rows.find(r=>r.id==='morning').relatedTaskTitle,'関連する準備作業');
  assert.equal(all.rows.find(r=>r.id==='afternoon').relatedTaskMissing,true);
  assert.equal(all.rows.find(r=>r.id==='afternoon').relatedTaskTitle,'');
  assert.deepEqual(select(snapshot,{assignee:'福冨'}).rows.map(r=>r.id),['afternoon']);
  assert.deepEqual(select(snapshot,{category:'運用'}).rows.map(r=>r.id),['afternoon']);
  assert.deepEqual(select(snapshot,{query:'手順　レビュー'}).rows.map(r=>r.id),['afternoon']);
  assert.deepEqual(select(snapshot,{query:'関連する準備作業'}).rows.map(r=>r.id),['morning']);
  assert.deepEqual(select(snapshot,{query:'会議室B'}).rows.map(r=>r.id),['afternoon']);
  assert.equal(select(snapshot,{query:'該当なし'}).visible,0);
  assert.equal(select(snapshot,{query:'該当なし'}).total,4);
});

test('Ver.553 remains immutable, detached from Classic, and does not invent relation names',()=>{
  const base=owner();
  const before=structuredClone({schedules:base.schedules,tasks:base.tasks});
  const snapshot=projectWorkspaceReadV550(base);
  const model=select(snapshot,{range:'month',mode:'calendar'});
  for(const obj of [model,model.rows,model.rows[0],model.days,model.days[0],
    model.days[0].rows,model.calendar,model.calendar[0],model.categories,model.assignees])
    assert.ok(Object.isFrozen(obj));
  assert.throws(()=>{model.rows[0].title='altered'},TypeError);
  assert.throws(()=>model.rows.push({id:'unsafe'}),TypeError);
  assert.equal(model.rows.find(r=>r.id==='afternoon').relatedTaskTitle,'');
  base.schedules[0].title='modified after reading';
  assert.equal(model.rows.find(r=>r.id==='before').title,'前日の予定');
  before.schedules[0].title='modified after reading';
  assert.deepEqual(base.schedules,before.schedules);
  assert.deepEqual(base.tasks,before.tasks);
});

test('Ver.553 retains only whitelisted fields, including hostile text as literal data',()=>{
  const base=owner();
  base.schedules[1].title='<img src=x onerror=alert(1)>';
  base.schedules[1].memo='<script>not-executed</script>';
  base.schedules[1].privateToken='secret';
  const row=view(base).rows.find(r=>r.id==='morning');
  assert.equal(row.title,'<img src=x onerror=alert(1)>');
  assert.equal(row.memo,'<script>not-executed</script>');
  assert.equal(row.privateToken,undefined);
  assert.equal(row.updatedBy,undefined);
  assert.ok(!('comments' in row));
});

test('Ver.553 rejects invalid source state and duplicate IDs instead of leaking stale schedules',()=>{
  const base=owner();
  for(const mode of ['initializing','remote-loading','remote-degraded']){
    base.connectionMode=mode;
    const model=view(base);
    assert.equal(model.ready,false);
    assert.deepEqual(model.rows,[]);
    assert.deepEqual(model.calendar,[]);
    assert.equal(model.source,null);
  }
  base.connectionMode='remote-online';
  base.collectionState=Object.fromEntries(Object.keys(base.collectionState).map(k=>[k,'ready']));
  assert.equal(view(base).ready,true);
  base.collectionState.todos='loading';
  assert.deepEqual(view(base).rows,[]);
  base.connectionMode='local-only';base.selectedUserReady=false;
  assert.equal(view(base).ready,false);
  assert.deepEqual(view(base).rows,[]);
  base.selectedUserReady=true;base.schedules.push({...base.schedules[0]});
  assert.equal(view(base).ready,false);
  assert.equal(select(null).reason,'invalid-snapshot');
  assert.equal(select({...projectWorkspaceReadV550(owner()),roomId:''}).ready,false);
});

test('Ver.553 switching users updates provenance but preserves shared schedule scope',()=>{
  const base=owner();
  let first=view(base);
  assert.equal(first.selectedUser,'佐藤');
  assert.deepEqual(first.rows.map(r=>r.id),['morning','afternoon','endUnknown','cross']);
  base.selectedUser='福冨';
  const next=view(base);
  assert.equal(next.selectedUser,'福冨');
  assert.deepEqual(next.rows.map(r=>r.id),first.rows.map(r=>r.id));
  assert.equal(first.selectedUser,'佐藤','old immutable view cannot mutate');
});

test('Ver.553 product uses existing owner and Modern CSS, not Firebase/mock or product design switch',()=>{
  const core=read('modern/product/schedule-list-contract-v553.mjs');
  const ui=read('modern/product/schedule-list-v553.mjs');
  const html=read('modern/product/schedule-list-read-v553.html');
  const app=read('app.js');
  const preview=read('modern/preview/index.html');
  const release=read('release-manifest.js');
  for(const src of [core,ui]){
    assert.doesNotMatch(src,/\b(?:initializeApp|getDatabase|runTransaction|onValue|onChildAdded|localStorage|sessionStorage|fetch)\s*\(/);
    assert.doesNotMatch(src,/\b(?:postMessage|setInterval|setTimeout)\s*\(/);
    assert.doesNotMatch(src,/window\.Demo|(?:import|from)[^\n]*demo-store/);
  }
  assert.match(ui,/WorkBoardReadV550/);
  assert.match(ui,/selectModernSchedulesV553/);
  assert.match(ui,/textContent/);
  // Ver.562: verify the Classic badge selector actually exists in the HTML.
  assert.match(html,/class="readonly-flag"/);
  assert.ok(ui.includes("document.querySelector('.readonly-flag').textContent"));
  assert.ok(!ui.includes("document.querySelector('.read-only-flag')"));
  assert.doesNotMatch(ui,/\binnerHTML\b|insertAdjacentHTML/);
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/\.\.\/layout\.css/);
  assert.match(html,/\.\.\/palettes\.css/);
  assert.doesNotMatch(html,/demo-store|firebaseConfig|app\.js/);
  assert.match(app,/function openModernTestViewV566\(target=null\)/);
  assert.match(app,/version:'553',attribute:'data-modern-schedule-v553'/);
  assert.match(app,/ROOM_ID\.startsWith\('test-'\)/);
  assert.match(app,/flags\?\.\['modernReadV'\+view\.version\]===true/);
  assert.match(release,/schedule-list-read-v553|schedule-list-v553|schedule-list-contract-v553/);
  assert.doesNotMatch(preview,/schedule-list-read-v553|workspace-read-v550/);
  assert.doesNotMatch(read('index.html'),/schedule-list-read-v553/);
});
