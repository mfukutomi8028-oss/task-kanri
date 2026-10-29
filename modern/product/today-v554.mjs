// Ver.554: one-shot, read-only Today view. Exactly one Classic owner read
// per render, shared by all task/ToDo/schedule panels. No new Firebase client,
// storage, polling, writes or mock-data source.
import { selectModernTodayV554 } from './today-contract-v554.mjs';

const $ = id => document.getElementById(id);
const messages = {
  'identity-not-selected':'クラシックで利用者を選択してください。',
  loading:'正本の読み込みが完了していません。クラシックを確認して再読込してください。',
  degraded:'共同データの同期に失敗しています。古いデータは表示しません。',
  'invalid-owner-state':'正本の状態を確認できません。表示を中止しました。',
  'invalid-snapshot':'読み取り結果を検証できません。表示を中止しました。',
  'inconsistent-summary':'クラシックの集計と一覧が一致しないため表示を中止しました。',
  'inconsistent-owner':'利用者またはルームが一致しないため表示を中止しました。',
  'inconsistent-date':'表示日が一致しないため表示を中止しました。',
  'not-test-context':'localhostの明示的テストルームからのみ表示できます。'
};
const pad = n => String(n).padStart(2,'0');
const shortDay = iso => {
  const d = new Date(iso+'T12:00:00');
  return Number(iso.slice(5,7))+'月'+Number(iso.slice(8,10))+'日（'+
    ['日','月','火','水','木','金','土'][d.getDay()]+'）';
};
const time = n => n===null?'不明':pad(Math.floor(n/60))+':'+pad(n%60);

function readOwner() {
  try {
    if(window.parent===window||!['localhost','127.0.0.1'].includes(location.hostname))
      return {ready:false,reason:'not-test-context'};
    const host=window.parent;
    const params=new URL(host.location.href).searchParams;
    const room=params.get('room')||'';
    const test=host.WORK_BOARD_TEST;
    const localOnly=!host.firebaseConfig?.apiKey||!host.firebaseConfig?.databaseURL;
    if(host.location.origin!==location.origin
      ||params.get('modernReadV554')!=='1'
      ||['modernReadV551','modernReadV552','modernReadV553'].some(key=>params.has(key))
      ||!room.startsWith('test-')||test?.modernReadV554!==true
      ||!(localOnly||test?.emulator===true))return {ready:false,reason:'not-test-context'};
    const facade=host.WorkBoardReadV550;
    if(!facade||typeof facade.read!=='function')return {ready:false,reason:'loading'};
    const snapshot=facade.read();
    if(!snapshot||typeof snapshot!=='object'
      ||(snapshot.ready&&snapshot.roomId!==room))
      return {ready:false,reason:'invalid-snapshot'};
    return snapshot;
  } catch {
    return {ready:false,reason:'not-test-context'};
  }
}

function create(tag,className,value) {
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(value!==undefined)node.textContent=String(value);
  return node;
}
function append(parent,tag,style,text) {
  const node=create(tag,style,text);
  parent.appendChild(node);
  return node;
}
function renderTask(task,index) {
  const row=create('div','readonly-task-row');
  row.dataset.taskId=task.id;
  row.dataset.revision=String(task.revision);
  append(row,'span','index',pad(index+1));
  const content=append(row,'div','');
  append(content,'strong','readonly-task-title',task.title||'名称未設定');
  append(content,'span','readonly-task-meta',
    [task.assignee,task.category,task.status,task.priority?('優先度：'+task.priority):''].filter(Boolean).join(' ／ '));
  append(row,'span','readonly-due',task.dueDate||'期限未設定');
  return row;
}
function renderTodo(todo) {
  const row=create('div','readonly-todo-row');
  row.dataset.todoId=todo.id;
  row.dataset.revision=String(todo.revision);
  const check=append(row,'span','check','');
  check.setAttribute('aria-hidden','true');
  const content=append(row,'div','');
  append(content,'strong','readonly-todo-title',todo.text);
  if(todo.memo)append(content,'span','readonly-todo-memo',todo.memo);
  return row;
}
function renderSchedule(item) {
  const row=create('div','agenda-row');
  row.dataset.scheduleId=item.id;
  row.dataset.revision=String(item.revision);
  append(row,'time','agenda-time',time(item.startMinute));
  append(row,'span','axis').setAttribute('aria-hidden','true');
  const content=append(row,'div','agenda-info');
  append(content,'strong','',item.title||'名称未設定の予定');
  const end=item.endKnown
    ? (item.endDateISO!==item.dateISO?item.endDateISO+' ':'')+time(item.endMinute)
    : '不明';
  append(content,'small','readonly-schedule-meta',
    '終了：'+end+' ／ '+[item.assignee,item.location,item.category].filter(Boolean).join('・'));
  if(item.relatedTaskTitle)
    append(content,'small','readonly-schedule-related','関連タスク：'+item.relatedTaskTitle);
  if(item.relatedTaskMissing)
    append(content,'small','readonly-schedule-missing','関連タスクは現在のタスク一覧で確認できません');
  return row;
}
function renderList(container,items,renderer,empty) {
  $(container).replaceChildren(...items.map(renderer));
  $(empty).hidden=items.length!==0;
}
function clearData() {
  for(const id of ['overdueRowsV554','todayTaskRowsV554','todoRowsV554','scheduleRowsV554'])
    $(id).replaceChildren();
  for(const id of [
    'overdueCountV554','todayTaskCountV554','todoOpenCountV554','scheduleCountV554',
    'statOpenV554','statOverdueV554','statTodayV554','statMineV554',
    'briefDateV554','briefTitleV554','todoProgressV554','todoOwnerV554','todoDoneV554'
  ])$(id).textContent='';
  $('todoBarV554').style.width='0%';
  $('dataV554').hidden=true;
}

function render() {
  const snapshot=readOwner(); // one coherent Classic snapshot for every panel.
  const model=selectModernTodayV554(snapshot);
  if(!model.ready){
    document.body.dataset.readState='unavailable';
    const warning=messages[model.reason]||'この画面で業務データを表示できません。';
    clearData(); // Do not retain previous owner's private ToDos in hidden DOM.
    $('failureV554').hidden=false;
    $('failureV554').textContent=warning;
    $('sourceV554').textContent=warning;
    return;
  }
  document.body.dataset.readState='ready';
  $('failureV554').hidden=true;
  $('sourceV554').textContent=
    (model.source==='local-only'?'端末内保存（共同同期ではありません）':'共同データ同期済み')
    +' ／ ルーム：'+model.roomId+' ／ 利用者：'+model.selectedUser
    +' ／ 手動再読込';
  $('briefDateV554').textContent=model.todayISO+' '+shortDay(model.todayISO);
  $('briefTitleV554').textContent=model.counts.actionableOverdue
    ?model.counts.actionableOverdue+'件の優先対応を確認してください。'
    :'対応対象の期限超過はありません。';
  const todoTotal=model.counts.openTodos+model.counts.completedTodayTodos;
  const percent=todoTotal?Math.round(model.counts.completedTodayTodos/todoTotal*100):0;
  $('todoProgressV554').textContent=model.counts.completedTodayTodos+' / '+todoTotal+'件';
  $('todoBarV554').style.width=percent+'%';
  $('statOpenV554').textContent=model.stats.openTasks;
  $('statOverdueV554').textContent=model.stats.overdueTasks;
  $('statTodayV554').textContent=model.stats.todayTasks;
  $('statMineV554').textContent=model.stats.mineTasks;
  $('overdueCountV554').textContent=model.counts.actionableOverdue;
  $('todayTaskCountV554').textContent=model.counts.actionableToday;
  $('todoOpenCountV554').textContent=model.counts.openTodos;
  $('scheduleCountV554').textContent=model.counts.todaySchedules;
  $('todoOwnerV554').textContent='利用者：'+model.selectedUser;
  $('todoDoneV554').textContent='本日完了 '+model.counts.completedTodayTodos+'件';
  renderList('overdueRowsV554',model.overdue,renderTask,'overdueEmptyV554');
  renderList('todayTaskRowsV554',model.dueToday,renderTask,'todayTaskEmptyV554');
  renderList('todoRowsV554',model.openTodos,renderTodo,'todoEmptyV554');
  renderList('scheduleRowsV554',model.schedules,renderSchedule,'scheduleEmptyV554');
  $('dataV554').hidden=false;
}
$('refreshV554').addEventListener('click',render);
window.addEventListener('storage',event=>{
  if(event.key==='systemTaskUser')render();
});
$('closeV554').addEventListener('click',()=>{
  if(window.frameElement)window.frameElement.remove();
});
render();
