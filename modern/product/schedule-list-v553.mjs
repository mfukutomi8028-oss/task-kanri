// Ver.553: a read-only Modern schedule view from Classic WorkBoardReadV550.
// No Firebase, writes, independent schedule cache, timers, storage or demo data.
import { selectModernSchedulesV553 } from './schedule-list-contract-v553.mjs';
import { readProductionClassicV580 } from '../production-owner-v580.mjs';

const $ = id => document.getElementById(id);
let range = 'today';
let mode = 'list';
let anchorISO = null; // presentation-only navigation, never a business-data cache.
let lastModel = null;

const errors = {
  loading: 'クラシックの予定を読み込み中です。完了後に「正本を再読込」を押してください。',
  degraded: '共同データの同期に失敗しています。古いキャッシュは表示しません。',
  'identity-not-selected': 'クラシックで利用者を選択してください。',
  'invalid-owner-state': '正本のデータを確認できないため表示を中止しました。',
  'invalid-snapshot': '予定データまたは関連タスクを検証できません。表示を中止しました。',
  'invalid-selection': '表示期間を確認できません。',
  'not-test-context': 'localhostの明示的テストルームからのみ表示できます。'
};
const pad = number => String(number).padStart(2, '0');
const dateISO = d => [d.getFullYear(),pad(d.getMonth() + 1),pad(d.getDate())].join('-');
const dayLabel = iso => {
  const day = new Date(iso + 'T12:00:00');
  return iso + '（' + ['日','月','火','水','木','金','土'][day.getDay()] + '）';
};
const time = minute => minute === null ? '不明' : pad(Math.floor(minute/60))+':'+pad(minute%60);

function readOwner() {
  const live = readProductionClassicV580('schedules');
  if (live) return live;
  try {
    if (window.parent === window || !['localhost','127.0.0.1'].includes(location.hostname)) {
      return { ready:false, reason:'not-test-context' };
    }
    const host = window.parent;
    const query = new URL(host.location.href).searchParams;
    const room = query.get('room') || '';
    const test = host.WORK_BOARD_TEST;
    const local = !host.firebaseConfig?.apiKey || !host.firebaseConfig?.databaseURL;
    if (host.location.origin !== location.origin
      || query.get('modernReadV553') !== '1' || query.has('modernReadV551') || query.has('modernReadV552')
      || !room.startsWith('test-') || test?.modernReadV553 !== true
      || !(local || test?.emulator === true)) {
      return { ready:false, reason:'not-test-context' };
    }
    const facade = host.WorkBoardReadV550;
    if (!facade || typeof facade.read !== 'function') return {ready:false,reason:'loading'};
    const snapshot = facade.read();
    if (!snapshot || typeof snapshot !== 'object'
      || (snapshot.ready && snapshot.roomId !== room)) {
      return {ready:false,reason:'invalid-snapshot'};
    }
    return snapshot;
  } catch {
    return {ready:false,reason:'not-test-context'};
  }
}

function element(tag, className, label) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (label !== undefined) node.textContent = String(label);
  return node;
}
function add(parent, tag, className, value) {
  const node = element(tag,className,value);
  parent.appendChild(node);
  return node;
}
function scheduleActionsV562() {
  try {
    const host = window.parent;
    if (host === window || host.location.origin !== location.origin) return null;
    const q = new URL(host.location.href).searchParams;
    const production = host.WorkBoardModernProductionV580?.allowRead('schedules',location.origin) === true;
    const isolatedTest = q.get('modernReadV553') === '1' && q.get('modernWriteV562') === '1'
      && host.WORK_BOARD_TEST?.modernReadV553 === true
      && host.WORK_BOARD_TEST?.modernWriteV562 === true;
    if (!production && !isolatedTest) return null;
    const actions = host.WorkBoardScheduleActionsV562;
    return ['available','create','edit','copy','remove'].every(k => typeof actions?.[k] === 'function')
      ? actions : null;
  } catch { return null; }
}
function scheduleToolsV562(holder, schedule) {
  const tools = add(holder, 'div', 'schedule-tools-v562');
  for (const [action,label] of [['edit','編集'],['copy','繰り返し・コピー'],['remove','削除']]) {
    const button = add(tools, 'button', 'btn small', label);
    button.type = 'button';
    button.dataset.scheduleActionV562 = action;
    button.setAttribute('aria-label', label + '：' + schedule.title);
  }
}
function rowView(schedule) {
  const row = element('div','agenda-row');
  row.dataset.scheduleId = schedule.id;
  row.dataset.revision = String(schedule.revision);
  add(row,'time','agenda-time',time(schedule.startMinute));
  const axis = add(row,'span','axis');
  axis.setAttribute('aria-hidden','true');
  const info = add(row,'div','agenda-info');
  add(info,'strong','readonly-title',schedule.title || '名称未設定の予定');
  const ending = schedule.endKnown
    ? (schedule.endDateISO !== schedule.dateISO ? schedule.endDateISO + ' ' : '') + time(schedule.endMinute)
    : '終了時刻不明';
  add(info,'small','readonly-compact','終了：'+ending);
  const meta = [schedule.assignee,schedule.category,schedule.location].filter(Boolean).join(' ／ ');
  if (meta) add(info,'small','readonly-meta',meta);
  if (schedule.relatedTaskTitle) add(info,'small','readonly-related','関連タスク：'+schedule.relatedTaskTitle);
  else if (schedule.relatedTaskMissing) add(info,'small','readonly-related-missing','関連タスク：現在のタスク一覧で確認できません');
  if (schedule.memo) add(info,'p','readonly-note',schedule.memo);
  if (document.body.dataset.scheduleWriteV562 === 'enabled') scheduleToolsV562(info,schedule);
  return row;
}
function calendarEvent(schedule) {
  const event = element('div','calendar-event');
  event.dataset.scheduleId = schedule.id;
  add(event,'span','',''+time(schedule.startMinute)+' ');
  add(event,'span','',schedule.title);
  event.title = schedule.title;
  if (document.body.dataset.scheduleWriteV562 === 'enabled') {
    const edit = add(event,'button','btn small','編集');
    edit.type='button';
    edit.dataset.scheduleActionV562='edit';
  }
  return event;
}

function drawDays(model) {
  const holder = $('daysV553');
  const fragment = document.createDocumentFragment();
  for (const group of model.days) {
    add(fragment,'h3','readonly-day-heading',dayLabel(group.dateISO));
    const agenda = add(fragment,'div','agenda');
    for(const item of group.rows) agenda.appendChild(rowView(item));
  }
  holder.replaceChildren(fragment);
  $('listEmptyV553').hidden = model.visible !== 0;
  $('listCountV553').textContent = String(model.visible);
}

function drawCalendar(model) {
  const holder = $('calendarDaysV553');
  const fragment = document.createDocumentFragment();
  for(const weekday of ['日','月','火','水','木','金','土']) add(fragment,'div','weekday',weekday);
  for(const day of model.calendar) {
    const cell = add(fragment,'div','calendar-day'+(!day.inMonth?' outside':'')+(day.today?' today':''));
    cell.dataset.date = day.dateISO;
    add(cell,'span','day-number',day.day);
    for(const item of day.rows.slice(0,3)) cell.appendChild(calendarEvent(item));
    if(day.rows.length>3) add(cell,'span','readonly-overflow','ほか'+(day.rows.length-3)+'件');
  }
  holder.replaceChildren(fragment);
  $('calendarCountV553').textContent = String(model.visible);
  $('calendarTitleV553').textContent = model.startISO.slice(0,4)+'年'+Number(model.startISO.slice(5,7))+'月';
}

function options(select, values) {
  const current = select.value;
  select.replaceChildren(new Option('すべて',''));
  for(const value of values) select.add(new Option(value,value));
  select.value = values.includes(current) ? current : '';
  return select.value !== current;
}

function disableData() {
  $('failureV553').hidden = false;
  $('listV553').hidden = true;
  $('calendarV553').hidden = true;
  $('daysV553').replaceChildren();
  $('calendarDaysV553').replaceChildren();
  $('countV553').textContent = '';
  $('rangeLabelV553').textContent = '';
  options($('assigneeV553'),[]);
  options($('categoryV553'),[]);
  document.body.dataset.scheduleWriteV562='readonly';
  $('scheduleNewV562').hidden=true;
  lastModel=null;
}

function render() {
  const snapshot = readOwner();
  if (snapshot.ready && !anchorISO) anchorISO = snapshot.todayISO;
  if (range==='today' && snapshot.ready) anchorISO = snapshot.todayISO;
  const opts = () => ({
    anchorISO, range, mode, query: $('searchV553').value,
    assignee: $('assigneeV553').value, category: $('categoryV553').value
  });
  let model = selectModernSchedulesV553(snapshot,opts());
  if(!model.ready) {
    document.body.dataset.readState='unavailable';
    const warning = errors[model.reason] || '予定を表示できません。';
    $('sourceV553').textContent = warning;
    $('failureV553').textContent = warning;
    disableData();
    return;
  }
  document.body.dataset.readState='ready';
  const actions = scheduleActionsV562();
  const canWrite = Boolean(actions && actions.available({roomId:model.roomId,selectedUser:model.selectedUser})?.ok);
  document.body.dataset.scheduleWriteV562=canWrite?'enabled':'readonly';
  $('scheduleNewV562').hidden=!canWrite;
  $('scheduleWriteNoteV562').textContent=canWrite
    ? '新規・編集・削除・繰り返しコピーはClassicの既存処理を利用します。'
    : '閲覧専用：保存・編集・削除はできません。';
  const production = document.body.dataset.modernProductionV580 === 'classic-actions';
  document.querySelector('.readonly-flag').textContent=canWrite
    ? (production?'予定操作（先行公開）':'予定操作のテスト') : '閲覧専用';
  document.querySelector('.readonly-rail-label').textContent=canWrite
    ? (production?'Classicの既存フォームと保存処理を使用します。':'Classicのフォームと保存処理を使用します。テストルーム限定です。')
    : '閲覧専用の検証画面です。予定の追加・編集・削除はできません。';
  $('failureV553').hidden=true;
  let changed = options($('assigneeV553'),model.assignees);
  changed = options($('categoryV553'),model.categories) || changed;
  if(changed) model = selectModernSchedulesV553(snapshot,opts());
  $('sourceV553').textContent =
    (model.source==='local-only'?'端末内保存（共同同期ではありません）':'共同データ同期済み')
    +' ／ ルーム：'+model.roomId+' ／ 利用者：'+model.selectedUser+' ／ 正本を参照';
  let displayRange;
  if (model.range === 'month') {
    displayRange = Number(model.startISO.slice(5,7))+'月 ('+model.startISO.slice(0,4)+'年)';
  } else if (model.range === 'week') {
    const last = new Date(model.endISO+'T12:00:00');
    last.setDate(last.getDate()-1);
    displayRange = model.startISO+' ～ '+dateISO(last);
  } else {
    displayRange = dayLabel(model.startISO);
  }
  lastModel=model;
  $('rangeLabelV553').textContent = displayRange;
  $('countV553').textContent='表示 '+model.visible+'件 / 期間内 '+model.total+'件';
  for(const btn of document.querySelectorAll('[data-range-v553]'))
    btn.setAttribute('aria-pressed',String(btn.dataset.rangeV553===range));
  for(const btn of document.querySelectorAll('[data-mode-v553]'))
    btn.setAttribute('aria-pressed',String(btn.dataset.modeV553===mode));
  $('prevV553').disabled = range==='today';
  $('nextV553').disabled = range==='today';
  $('listV553').hidden = mode !== 'list';
  $('calendarV553').hidden = mode !== 'calendar';
  if(mode==='list'){drawDays(model);$('calendarDaysV553').replaceChildren();}
  else {drawCalendar(model);$('daysV553').replaceChildren();}
}

function shiftAnchor(delta) {
  if(range==='today')return;
  const d = new Date(anchorISO+'T12:00:00');
  if(range==='month') d.setMonth(d.getMonth()+delta,1);
  else d.setDate(d.getDate()+delta*7);
  anchorISO = dateISO(d);
  render();
}
for(const button of document.querySelectorAll('[data-range-v553]')) {
  button.addEventListener('click',()=>{
    range=button.dataset.rangeV553;
    if(range!=='month')mode='list';
    if(range==='today')anchorISO=null;
    render();
  });
}
for(const button of document.querySelectorAll('[data-mode-v553]')) {
  button.addEventListener('click',()=>{
    mode=button.dataset.modeV553;
    if(mode==='calendar')range='month';
    render();
  });
}
$('prevV553').addEventListener('click',()=>shiftAnchor(-1));
$('nextV553').addEventListener('click',()=>shiftAnchor(1));
$('resetV553').addEventListener('click',()=>{anchorISO=null;render();});
$('refreshV553').addEventListener('click',render);
$('searchV553').addEventListener('input',render);
$('assigneeV553').addEventListener('change',render);
$('categoryV553').addEventListener('change',render);
// Only production keeps its selected Modern screen during Classic's modal.
// Local isolated Ver.562 tests retain the previous iframe-removal behavior.
function showClassicScheduleFormV582() {
  if(window.parent.WorkBoardModernProductionV580?.enterScheduleForm?.(location.origin))return;
  window.frameElement?.remove();
}
function showScheduleResultV562(result, action) {
  const label=$('scheduleActionStatusV562');
  label.hidden=false;
  label.dataset.error=result?.ok || result?.error==='cancelled' ? 'false' : 'true';
  label.textContent=result?.error==='cancelled' ? '操作をキャンセルしました。'
    : result?.ok ? (action==='remove'?'予定を削除しました。':'操作を完了しました。')
    : result?.error==='owner-mismatch' ? 'ルームまたは利用者が変更されました。'
    : '処理できませんでした。最新の予定を確認して再読込してください。';
}
$('scheduleNewV562').addEventListener('click',()=>{
  const actions=scheduleActionsV562(), model=lastModel;
  if(!actions||!model?.ready)return;
  const result=actions.create({roomId:model.roomId,selectedUser:model.selectedUser});
  if(result?.ok&&result?.pending){showClassicScheduleFormV582();return;}
  showScheduleResultV562(result,'create');
});
async function handleScheduleActionV562(event) {
  const button=event.target?.closest?.('[data-schedule-action-v562]');
  const row=button?.closest?.('[data-schedule-id]');
  if(!button||!row)return;
  const action=button.dataset.scheduleActionV562;
  const model=lastModel,actions=scheduleActionsV562();
  const current=model?.rows?.find(item=>item.id===row.dataset.scheduleId);
  if(!actions||!model?.ready||!current||typeof actions[action]!=='function')return;
  button.disabled=true;
  let result;
  try {
    result=await actions[action]({
      roomId:model.roomId,selectedUser:model.selectedUser,
      id:current.id,expectedRevision:current.revision
    });
  } catch { result={ok:false,error:'owner-error'}; }
  if(result?.ok&&result?.pending){showClassicScheduleFormV582();return;}
  render();
  showScheduleResultV562(result,action);
}
$('daysV553').addEventListener('click',handleScheduleActionV562);
$('calendarDaysV553').addEventListener('click',handleScheduleActionV562);
window.addEventListener('workboard:modern-schedule-resume',render);
window.addEventListener('storage',event=>{
  if(event.key==='systemTaskUser'){$('scheduleActionStatusV562').hidden=true;render();}
});
$('closeV553').addEventListener('click',()=>{
  if(window.frameElement)window.frameElement.remove();
});
render();
