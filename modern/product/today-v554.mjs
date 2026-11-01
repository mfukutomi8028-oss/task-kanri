// Ver.554: one-shot, read-only Today view. Exactly one Classic owner read
// per render, shared by all task/ToDo/schedule panels. No new Firebase client,
// storage, polling, writes or mock-data source.
import { selectModernTodayV554 } from './today-contract-v554.mjs';
import { readProductionClassicV580 } from '../production-owner-v580.mjs?v=321';

const $ = id => document.getElementById(id);
let todayNavContextV564 = null;
let noticeReturnFocusV317 = null;
// Read-only by default. Ver.564 local tests navigate to Classic;
// opted-in production uses the existing Modern router and Classic UI owner.
function todayNavigationV564() {
  try {
    if(window.parent===window)return null;
    const host=window.parent;
    if(host.location.origin!==location.origin)return null;
    const production=host.WorkBoardModernProductionV580?.allowRead('today',location.origin)===true;
    const q=new URL(host.location.href).searchParams;
    const isolatedTest=['localhost','127.0.0.1'].includes(location.hostname)
      && q.get('modernReadV554')==='1'&&q.get('modernNavigateV564')==='1'
      && host.WORK_BOARD_TEST?.modernReadV554===true
      && host.WORK_BOARD_TEST?.modernNavigateV564===true;
    if(!production&&!isolatedTest)return null;
    const actions=host.WorkBoardTodayNavigationV564;
    return typeof actions?.available==='function'&&typeof actions?.open==='function'
      ?actions:null;
  }catch{return null;}
}
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
  const live = readProductionClassicV580('today');
  if (live) return live;
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
function renderTask(task,index,canNavigate=false) {
  const row=create('div','readonly-task-row');
  row.dataset.taskId=task.id;
  row.dataset.revision=String(task.revision);
  append(row,'span','index',pad(index+1));
  const content=append(row,'div','');
  append(content,'strong','readonly-task-title',task.title||'名称未設定');
  append(content,'span','readonly-task-meta',
    [task.assignee,task.category,task.status,task.priority?('優先度：'+task.priority):''].filter(Boolean).join(' ／ '));
  if(canNavigate){
    const button=append(content,'button','btn small today-open-v564','タスク詳細');
    button.type='button';
    button.dataset.todayNavigationV564='task';
    button.setAttribute('aria-label',(task.title||'タスク')+'の詳細をClassicで開く');
  }
  append(row,'span','readonly-due',task.dueDate||'期限未設定');
  return row;
}
function renderTodo(todo,canNavigate=false) {
  const row=create('div','readonly-todo-row');
  row.dataset.todoId=todo.id;
  row.dataset.revision=String(todo.revision);
  const check=append(row,'span','check','');
  check.setAttribute('aria-hidden','true');
  const content=append(row,'div','');
  append(content,'strong','readonly-todo-title',todo.text);
  if(todo.memo)append(content,'span','readonly-todo-memo',todo.memo);
  if(canNavigate){
    const button=append(content,'button','btn small today-open-v564','ToDoを開く');
    button.type='button';
    button.dataset.todayNavigationV564='todo';
    button.setAttribute('aria-label',todo.text+'をClassicで開く');
  }
  return row;
}
function renderSchedule(item,canNavigate=false) {
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
  if(canNavigate){
    const button=append(content,'button','btn small today-open-v564','予定を確認・編集');
    button.type='button';
    button.dataset.todayNavigationV564='schedule';
    button.setAttribute('aria-label',(item.title||'予定')+'をClassicの編集画面で開く');
  }
  return row;
}
function renderList(container,items,renderer,empty) {
  $(container).replaceChildren(...items.map(renderer));
  $(empty).hidden=items.length!==0;
}
function clearData() {
  todayNavContextV564=null;
  document.body.dataset.todayNavigationV564='readonly';
  // The body also carries data-today-navigation-v564 for status. Filter to
  // controls only: hiding body would blank the entire read-only view.
  document.querySelectorAll('button[data-today-navigation-v564]').forEach(button=>button.hidden=true);
  $('todayNavStatusV564').hidden=true;
  $('todayNavNoteV564').textContent='一覧や詳細を開くには正本を再読込してください。';
  $('todayNavRailV564').textContent='閲覧専用の検証画面です。保存・削除・完了操作はできません。';
  document.querySelector('.readonly-flag').textContent='閲覧専用';
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
  $('todayNavStatusV564').hidden=true;
  todayNavContextV564={roomId:model.roomId,selectedUser:model.selectedUser,todayISO:model.todayISO};
  const navigation=todayNavigationV564();
  const canNavigate=Boolean(navigation?.available(todayNavContextV564)?.ok);
  const production=Boolean(canNavigate && window.parent.WorkBoardModernProductionV580
    ?.allowRead('today',location.origin));
  document.body.dataset.todayNavigationV564=canNavigate?'enabled':'readonly';
  document.querySelectorAll('button[data-today-navigation-v564]').forEach(button=>{
    const target=button.dataset.todayNavigationV564;
    button.hidden=!canNavigate || (['activity','inbox'].includes(target)&&!production);
  });
  $('todayNavNoteV564').textContent=canNavigate
    ?(production?'各一覧はModernで、タスク詳細・予定編集はClassicの既存画面で開きます。'
      :'Classicの既存画面を開きます。詳細を開いただけでは保存されません。')
    :'操作するにはClassicで利用者を選択し、正本を再読込してください。';
  document.querySelector('.readonly-flag').textContent=canNavigate
    ?(production?'一覧・詳細へ移動':'Classic連携の検証'):'閲覧専用';
  $('todayNavRailV564').textContent=canNavigate
    ?(production?'各一覧にはModern内で移動できます。詳細・編集はClassicの既存処理を利用します。'
      :'この画面では保存しません。詳細・一覧はClassicの既存画面に移動します。')
    :'閲覧専用：この画面では保存・削除・完了操作はできません。';
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
  renderList('overdueRowsV554',model.overdue,(item,i)=>renderTask(item,i,canNavigate),'overdueEmptyV554');
  renderList('todayTaskRowsV554',model.dueToday,(item,i)=>renderTask(item,i,canNavigate),'todayTaskEmptyV554');
  renderList('todoRowsV554',model.openTodos,item=>renderTodo(item,canNavigate),'todoEmptyV554');
  renderList('scheduleRowsV554',model.schedules,item=>renderSchedule(item,canNavigate),'scheduleEmptyV554');
  $('dataV554').hidden=false;
}
// One delegated listener covers panels and their dynamically refreshed rows.
$('dataV554').addEventListener('click',event=>{
  const button=event.target?.closest?.('button[data-today-navigation-v564]');
  if(!button||button.hidden||!$('dataV554').contains(button)||!todayNavContextV564)return;
  const actions=todayNavigationV564();
  if(!actions)return;
  const kind=button.dataset.todayNavigationV564;
  const request={...todayNavContextV564,kind};
  if(['task','todo','schedule'].includes(kind)){
    const row=button.closest('[data-task-id],[data-todo-id],[data-schedule-id]');
    if(!row)return;
    request.id=row.dataset.taskId||row.dataset.todoId||row.dataset.scheduleId;
    request.expectedRevision=Number(row.dataset.revision);
  }
  let result;
  try{result=actions.open(request);}
  catch{result={ok:false,error:'classic-navigation-failed'};}
  if(result?.ok&&result?.navigated)return; // Existing Modern router replaced this frame.
  if(result?.ok&&result?.pending){
    if(result.modernHandoff&&['activity','inbox'].includes(kind))noticeReturnFocusV317=button;
    if(!result.modernHandoff)window.frameElement?.remove(); // Local Ver.564 fallback.
    return;
  }
  const message=result?.error==='owner-mismatch'
    ?'利用者・ルーム・日付が変更されました。再読込してください。'
    :result?.error==='revision-or-state-mismatch'
      ?'対象の内容が更新・削除されました。再読込してください。'
      :result?.error==='dialog-open'
        ?'Classicで入力中の画面があります。そちらの入力を確認してください。'
        :result?.error==='navigation-unavailable'
          ?'画面を切り替えられませんでした。編集中の画面を閉じてから再試行してください。'
          :'対象を開けませんでした。同期状態を確認して再読込してください。';
  $('todayNavStatusV564').textContent=message;
  $('todayNavStatusV564').hidden=false;
});
window.addEventListener('workboard:modern-today-resume',()=>{
  render();
  const target=noticeReturnFocusV317;
  noticeReturnFocusV317=null;
  if(target?.isConnected&&!target.hidden)target.focus({preventScroll:true});
});
$('refreshV554').addEventListener('click',render);
window.addEventListener('storage',event=>{
  if(event.key==='systemTaskUser')render();
});
$('closeV554').addEventListener('click',()=>{
  if(window.frameElement)window.frameElement.remove();
});
render();
