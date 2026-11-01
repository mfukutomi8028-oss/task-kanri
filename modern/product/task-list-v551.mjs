// Ver.592: Classic-owned task records in opted-in Modern and isolated tests.
// All three layouts consume only the existing Classic WorkBoardReadV550.read() facade.
// No Firebase client, data cache, polling, storage, demo source, or write path.
import { selectModernTaskListV551 } from './task-list-contract-v551.mjs';
import { readProductionClassicV580 } from '../production-owner-v580.mjs?v=323';

const $ = id => document.getElementById(id);
const tbody = $('taskRowsV551');
const statusSelect = $('taskStatusV551');
const input = $('taskSearchV551');
const message = $('sourceV551');
const count = $('countV551');
const empty = $('emptyV551');
const taskTableV318 = $('taskTableV318');
const taskBoardV318 = $('taskBoardV318');
const taskTimelineV318 = $('taskTimelineV318');
const taskModeButtonsV318 = [...document.querySelectorAll('[data-task-mode-v318]')];
// Purely a view choice in this frame. The Classic task snapshot and writer
// remain the only owners; no second cache, localStorage, or Firebase client.
let taskModeV318 = 'list';
const taskBulkPanelV593 = $('taskBulkV593');
const taskBulkActionV593 = $('taskBulkActionV593');
const taskBulkTargetV593 = $('taskBulkTargetV593');
const taskBulkApplyV593 = $('taskBulkApplyV593');
const taskBulkSelectedV593 = new Map();
let taskBulkIdentityV593 = '';
let taskBulkOptionsV593 = null;
let taskBulkModelV593 = null;
let taskBulkBusyV593 = false;

function unavailable(reason) {
  const labels = {
    'identity-not-selected': '利用者を選択するとタスクを表示できます。',
    loading: 'クラシックの共同データを読み込み中です。読込完了後に再読込してください。',
    degraded: '同期に失敗しました。古いキャッシュは表示せず、クラシックで接続を確認してください。',
    'invalid-owner-state': '正本の状態を確認できません。クラシックの表示を確認してください。',
    'invalid-snapshot': '読み取り結果を検証できません。表示を中止しました。'
  };
  return labels[reason] || 'この画面はlocalhostのテストルームからだけ起動できます。';
}

function readFromCanonicalOwner() {
  const live = readProductionClassicV580('tasks');
  if (live) return live;
  try {
    if (window.parent === window || !['localhost','127.0.0.1'].includes(location.hostname)) {
      return { ready: false, reason: 'not-test-context' };
    }
    const host = window.parent;
    const params = new URL(host.location.href).searchParams;
    const room = params.get('room') || '';
    const explicitTest = host.WORK_BOARD_TEST?.modernReadV551 === true;
    const isEmulator = host.WORK_BOARD_TEST?.emulator === true;
    const isLocalOnly = !host.firebaseConfig?.apiKey || !host.firebaseConfig?.databaseURL;
    if (host.location.origin !== location.origin
      || params.get('modernReadV551') !== '1'
      || !room.startsWith('test-') || !explicitTest
      || !(isLocalOnly || isEmulator)) {
      return { ready: false, reason: 'not-test-context' };
    }
    const facade = host.WorkBoardReadV550;
    if (!facade || typeof facade.read !== 'function') {
      return { ready: false, reason: 'loading' };
    }
    const snapshot = facade.read();
    if (!snapshot || typeof snapshot !== 'object'
      || (snapshot.ready && snapshot.roomId !== room)) {
      return { ready: false, reason: 'invalid-snapshot' };
    }
    return snapshot;
  } catch {
    return { ready: false, reason: 'not-test-context' };
  }
}

// Ver.560 operates only through the same-origin Classic owner's task
// command facade. Modern never reads localStorage or accesses Firebase.
function taskActionsV560() {
  try {
    const parent = window.parent;
    if (parent === window || parent.location.origin !== location.origin) return null;
    const query = new URL(parent.location.href).searchParams;
    const production = parent.WorkBoardModernProductionV580?.allowRead('tasks',location.origin) === true;
    const isolatedTest = query.get('modernReadV551') === '1' && query.get('modernWriteV560') === '1'
      && parent.WORK_BOARD_TEST?.modernReadV551 === true
      && parent.WORK_BOARD_TEST?.modernWriteV560 === true;
    if (!production && !isolatedTest) return null;
    const actions = parent.WorkBoardTaskActionsV560;
    return ['statuses', 'create', 'edit', 'status'].every(
      method => typeof actions?.[method] === 'function') ? actions : null;
  } catch {
    return null;
  }
}

function ownerRequest(model) {
  return { roomId: model.roomId, selectedUser: model.selectedUser };
}

function showTaskResultV560(result, successText = 'タスクの状態を保存しました。') {
  const label = $('taskActionStatusV560');
  label.hidden = false;
  const cancelled = result?.error === 'cancelled';
  const warnings = Boolean(result?.cleanupWarnings?.length);
  label.dataset.error = result?.ok === true && !warnings || cancelled ? 'false' : 'true';
  label.textContent = warnings
    ? 'タスクは削除しましたが、一部の関連情報を解除できませんでした。Classicで関連予定を確認してください。'
    : result?.ok ? successText
    : cancelled ? '操作をキャンセルしました。'
    : result?.error === 'owner-mismatch'
      ? 'ルームまたは利用者が変更されたため、操作を中止しました。'
      : '操作できませんでした。Classicの最新状態を確認し、再読込してください。';
}

function cell(row, className = '') {
  const td = document.createElement('td');
  if (className) td.className = className;
  row.appendChild(td);
  return td;
}
function span(parent, className, value) {
  const element = document.createElement('span');
  if (className) element.className = className;
  element.textContent = String(value ?? '');
  parent.appendChild(element);
  return element;
}

function taskControlsV318(task, advanced) {
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'btn small task-edit-v560';
  edit.dataset.taskActV560 = 'edit';
  edit.setAttribute('aria-label', '編集：' + task.title);
  edit.textContent = '編集';
  if (!advanced) return edit;
  const controls = document.createElement('div');
  controls.className = 'task-row-tools-v561';
  const detail = document.createElement('button');
  detail.type = 'button';
  detail.className = 'btn small';
  detail.dataset.taskActV560 = 'detail';
  detail.textContent = '詳細';
  detail.setAttribute('aria-label', '詳細：' + task.title);
  controls.appendChild(detail);
  controls.appendChild(edit);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'btn small task-delete-v561';
  remove.dataset.taskActV560 = 'remove';
  remove.textContent = '削除';
  remove.setAttribute('aria-label', '削除：' + task.title);
  controls.appendChild(remove);
  return controls;
}

// The same native select is used by list, board and deadline views; its
// change event is routed to the single existing Classic status action.
function taskStatusControlV318(task, statuses) {
  const select = document.createElement('select');
  select.className = 'task-status-v560';
  select.dataset.taskStatusV560 = task.id;
  select.setAttribute('aria-label', '状態を変更：' + task.title);
  const choices = statuses.includes(task.status) ? statuses : [task.status, ...statuses];
  for (const name of choices) select.add(new Option(name, name));
  select.value = task.status;
  return select;
}

function renderTaskCardV318(task, { writable, advanced, statuses, roomId, selectedUser }) {
  const card = document.createElement('article');
  card.className = 'task-modern-card-v318' + (task.overdue ? ' is-overdue' : '');
  card.dataset.taskId = task.id;
  card.dataset.revision = String(task.revision);
  if (writable) {
    card.dataset.roomId = roomId;
    card.dataset.selectedUser = selectedUser;
  }
  span(card, 'task-modern-title-v318', task.title || '名称未設定');
  const meta = document.createElement('div');
  meta.className = 'task-modern-meta-v318';
  span(meta, '', '担当：' + (task.assignee || '未設定'));
  span(meta, '', '分類：' + (task.category || '未設定'));
  span(meta, '', '優先度：' + (task.priority || '未設定'));
  span(meta, '', '期限：' + (task.dueDate || '未設定') + (task.overdue ? '（期限超過）' : ''));
  card.appendChild(meta);
  if (writable) card.appendChild(taskStatusControlV318(task, statuses));
  else span(card, 'status', '状態：' + (task.status || '未設定'));
  if (writable) card.appendChild(taskControlsV318(task, advanced));
  return card;
}

function taskGroupV318(title, tasks, options) {
  const section = document.createElement('section');
  section.className = 'task-modern-group-v318';
  const header = document.createElement('div');
  header.className = 'task-modern-group-head-v318';
  const h2 = document.createElement('h2');
  h2.textContent = title;
  const number = document.createElement('span');
  number.className = 'task-modern-count-v318';
  number.textContent = tasks.length + '件';
  header.append(h2, number);
  const cards = document.createElement('div');
  cards.className = 'task-modern-cards-v318';
  cards.replaceChildren(...tasks.map(task => renderTaskCardV318(task, options)));
  section.append(header, cards);
  return section;
}

function renderTaskModesV318(model, options) {
  taskTableV318.hidden = taskModeV318 !== 'list';
  taskBoardV318.hidden = taskModeV318 !== 'board';
  taskTimelineV318.hidden = taskModeV318 !== 'timeline';
  for (const button of taskModeButtonsV318) {
    button.setAttribute('aria-pressed', String(button.dataset.taskModeV318 === taskModeV318));
  }
  tbody.replaceChildren(...(model.ready && taskModeV318 === 'list'
    ? model.rows.map(row => renderTask(row, options)) : []));
  taskBoardV318.replaceChildren();
  taskTimelineV318.replaceChildren();
  if (taskModeV318 === 'list') return;
  const root = taskModeV318 === 'board' ? taskBoardV318 : taskTimelineV318;
  if (!model.ready || !model.rows.length) {
    const note = document.createElement('p');
    note.className = 'task-modern-empty-v318';
    note.textContent = model.ready
      ? '該当するタスクはありません。検索・状態の条件を変更してください。'
      : unavailable(model.reason);
    root.appendChild(note);
    return;
  }
  const groups = new Map();
  for (const task of model.rows) {
    const label = taskModeV318 === 'board'
      ? (task.status || '状態未設定')
      : (/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) ? task.dueDate : '期限未設定');
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(task);
  }
  const keys = [...groups.keys()];
  if (taskModeV318 === 'timeline') {
    keys.sort((a,b) => a === '期限未設定' ? 1 : b === '期限未設定' ? -1 : a.localeCompare(b));
  }
  root.replaceChildren(...keys.map(key => taskGroupV318(key, groups.get(key), options)));
}

function renderTask(task, { writable = false, advanced = false, statuses = [], roomId = '', selectedUser = '', bulkEnabled = false } = {}) {
  const tr = document.createElement('tr');
  tr.dataset.taskId = task.id;
  tr.dataset.revision = String(task.revision);
  if (writable) {
    tr.dataset.roomId = roomId;
    tr.dataset.selectedUser = selectedUser;
  }
  const indicator = cell(tr, 'select-cell');
  if (writable && bulkEnabled) {
    const checkbox=document.createElement('input');
    checkbox.type='checkbox';
    checkbox.className='task-bulk-select-v593';
    checkbox.dataset.taskSelectV593=task.id;
    checkbox.setAttribute('aria-label','一括操作の対象にする：'+task.title);
    checkbox.checked=taskBulkSelectedV593.get(task.id)===task.revision;
    const hit=document.createElement('label');
    hit.className='task-bulk-hit-v593';
    hit.appendChild(checkbox);
    indicator.appendChild(hit);
  } else {
    span(indicator,'readonly-dot','•').setAttribute('aria-hidden','true');
  }
  const title = cell(tr, 'title-cell');
  const titleBody = span(title, 'task-open', '');
  const strong = document.createElement('strong');
  strong.className = 'readonly-title';
  strong.textContent = task.title || '名称未設定';
  titleBody.appendChild(strong);
  span(titleBody, 'readonly-subtitle', task.category || '分類未設定');
  if (writable) title.appendChild(taskControlsV318(task, advanced));
  const owner = cell(tr, 'owner-cell');
  const badge = span(owner, 'owner', '');
  span(badge, 'avatar', task.assignee.slice(0,1) || '―');
  span(badge, '', task.assignee || '担当未設定');
  const status = cell(tr, 'status-cell');
  const statusClass = task.completed ? 'done' : task.status === '対応中' ? 'working' : task.status === '確認待ち' ? 'waiting' : '';
  if (writable) {
    status.appendChild(taskStatusControlV318(task, statuses));
  } else {
    span(status, 'status ' + statusClass, task.status || '状態未設定');
  }
  const priority = cell(tr, 'priority-cell');
  span(priority, 'priority' + (task.priority === '高' || task.priority === '緊急' ? ' high' : ''), task.priority || '未設定');
  const due = cell(tr, 'date-cell');
  span(due, 'tiny-date' + (task.overdue ? ' late' : ''), task.dueDate || '期限なし');
  return tr;
}

// A selection is short-lived presentation state. It is discarded on owner
// changes, filters, view changes and data revisions; it is never persisted.
function clearTaskBulkV593() {
  taskBulkSelectedV593.clear();
}
function showTaskBulkNoticeV593(message, error=false) {
  const notice=$('taskActionStatusV560');
  notice.hidden=false;
  notice.dataset.error=error?'true':'false';
  notice.textContent=message;
}
function bulkChoicesV593() {
  const action=taskBulkActionV593.value;
  return action==='status' ? taskBulkOptionsV593?.statuses
    : action==='assignee' ? taskBulkOptionsV593?.assignees
    : action==='category' ? taskBulkOptionsV593?.categories : null;
}
function refreshTaskBulkV593({rebuildTargets=false}={}) {
  const values=bulkChoicesV593();
  if (rebuildTargets) {
    const previous=taskBulkTargetV593.value;
    taskBulkTargetV593.replaceChildren(...(values||[]).map(value=>new Option(value,value)));
    if(values?.includes(previous))taskBulkTargetV593.value=previous;
  }
  taskBulkTargetV593.hidden=!values;
  taskBulkPanelV593.querySelector('[data-bulk-count-v593]').textContent=
    taskBulkSelectedV593.size+'件選択中';
  const available=Boolean(taskBulkModelV593?.ready && taskBulkOptionsV593?.ok);
  $('taskBulkSelectAllV593').disabled=taskBulkBusyV593||!available
    || !taskBulkModelV593.rows.length || taskBulkModelV593.rows.length>taskBulkOptionsV593.limit;
  $('taskBulkClearV593').disabled=taskBulkBusyV593||!taskBulkSelectedV593.size;
  taskBulkActionV593.disabled=taskBulkBusyV593||!available;
  taskBulkTargetV593.disabled=taskBulkBusyV593||!available;
  taskBulkApplyV593.disabled=taskBulkBusyV593||!available
    || !taskBulkSelectedV593.size || !taskBulkActionV593.value
    || (Boolean(values)&&!values.includes(taskBulkTargetV593.value));
  taskBulkPanelV593.setAttribute('aria-busy',String(taskBulkBusyV593));
  document.body.dataset.taskBulkBusyV593=String(taskBulkBusyV593);
  for(const control of [input,statusSelect,$('taskNewV560'),$('refreshV551'),
    $('closeReadonly'),...taskModeButtonsV318,
    ...document.querySelectorAll('[data-task-select-v593],[data-task-act-v560],[data-task-status-v560]')]){
    if(control)control.disabled=taskBulkBusyV593;
  }
}
function render() {
  const selectedStatus = statusSelect.value || 'all';
  const snapshot = readFromCanonicalOwner();
  const model = selectModernTaskListV551(snapshot, {
    query: input.value, status: selectedStatus
  });
  const statuses = model.ready ? model.statuses : [];
  statusSelect.replaceChildren(new Option('すべて', 'all'));
  for (const value of statuses) statusSelect.add(new Option(value, value));
  statusSelect.value = statuses.includes(selectedStatus) ? selectedStatus : 'all';
  // If a remote status was deleted, do not accidentally keep an invisible
  // filter. The next query is always against the owner, never a local cache.
  const shown = statusSelect.value === selectedStatus ? model
    : selectModernTaskListV551(snapshot, { query: input.value, status: 'all' });
  const actions = taskActionsV560();
  const choiceResult = shown.ready && actions ? actions.statuses(ownerRequest(shown)) : null;
  const writable = Boolean(shown.ready && actions && choiceResult?.ok === true);
  const advanced = writable && typeof actions?.detail === 'function'
    && typeof actions?.remove === 'function';
  const statusesForEdit = writable ? choiceResult.values : [];
  const bulkOptions=shown.ready && advanced && typeof actions?.bulkOptions==='function'
    ? actions.bulkOptions(ownerRequest(shown)) : null;
  const bulkEnabled=Boolean(bulkOptions?.ok);
  const identity=shown.ready ? shown.roomId+'\\u0000'+shown.selectedUser : '';
  if(identity!==taskBulkIdentityV593 || !bulkEnabled || taskModeV318!=='list')
    clearTaskBulkV593();
  taskBulkIdentityV593=identity;
  if(taskBulkSelectedV593.size) {
    const current=new Map(shown.rows.map(row=>[row.id,row.revision]));
    if([...taskBulkSelectedV593].some(([id,revision])=>current.get(id)!==revision))
      clearTaskBulkV593();
  }
  taskBulkModelV593=shown.ready ? shown : null;
  taskBulkOptionsV593=bulkOptions;
  taskBulkPanelV593.hidden=!bulkEnabled||taskModeV318!=='list';
  if(bulkEnabled)refreshTaskBulkV593({rebuildTargets:true});
  document.body.dataset.taskWriteV560 = writable ? 'enabled' : 'readonly';
  document.body.dataset.taskAdvancedV561 = advanced ? 'enabled' : 'readonly';
  const production = document.body.dataset.modernProductionV580 === 'classic-actions';
  $('taskNewV560').hidden = !writable;
  $('taskWriteNoteV560').textContent = production && advanced
    ? '作成・編集・状態変更・詳細表示・削除はClassicの既存処理で実行します。'
    : advanced ? 'Classicの削除処理と詳細画面に接続しています。関連データの削除結果を確認してください。'
    : writable ? 'Classicの保存処理を利用して新規作成・編集・状態変更が可能です。'
    : '保存・編集・削除はできません';
  const flag = document.querySelector('.read-only-flag');
  if (flag) flag.textContent = production && writable ? 'タスク操作（先行公開）'
    : advanced ? '詳細・削除の検証'
    : writable ? 'タスク操作のテスト' : '閲覧専用';
  const rail = document.querySelector('.readonly-rail-label');
  if (rail) rail.textContent = production && writable
    ? 'タスク操作はClassicと同じデータ・競合チェックを使用します。詳細を閉じるとModernに戻ります。'
    : advanced ? '詳細はClassicの詳細パネルへ移ります。削除では関連予定・ナレッジの整合もClassicが確認します。'
    : writable ? '新規作成・編集はClassicの入力画面を開きます。状態の変更はClassicの既存処理で保存します。'
    : '読み取り専用の検証画面です。保存・削除はできません。';
  renderTaskModesV318(shown, {
    writable, advanced, bulkEnabled, statuses: statusesForEdit,
    roomId: shown.roomId, selectedUser: shown.selectedUser
  });
  count.textContent = shown.ready ? ('表示 ' + shown.visible + '件 / 全 ' + shown.total + '件') : '表示 0件';
  if (!shown.ready) {
    document.body.dataset.readState = 'unavailable';
    message.textContent = unavailable(shown.reason);
    empty.hidden = false;
    empty.querySelector('strong').textContent = 'タスクを表示できません';
    empty.querySelector('span').textContent = unavailable(shown.reason);
    return;
  }
  document.body.dataset.readState = 'ready';
  message.textContent = (shown.source === 'local-only' ? '端末内保存（共同データではありません）' : '共同データ同期済み')
    + ' ／ ルーム：' + shown.roomId + ' ／ 利用者：' + shown.selectedUser + ' ／ 手動更新';
  empty.hidden = shown.visible !== 0;
  empty.querySelector('strong').textContent = '該当するタスクはありません';
  empty.querySelector('span').textContent = '検索条件を変更するか、クラシックのデータを確認してください。';
}


// A single delegated handler for edit and status controls; no duplicate
// data mutation paths are installed inside Modern.
// V584: The one parent bridge handles both task and schedule Classic surfaces.
function enterClassicTaskSurfaceV584(mode) {
  return window.parent.WorkBoardModernProductionV580?.enterClassicSurface?.('tasks',location.origin,mode) === true;
}
function leaveClassicTaskSurfaceV584() {
  window.parent.WorkBoardModernProductionV580?.leaveClassicSurface?.('tasks',location.origin);
}
function showClassicTaskSurfaceV584(mode) {
  if (enterClassicTaskSurfaceV584(mode)) return;
  // Original isolated tests close their iframe, preserving the Ver.560/561 contract.
  window.frameElement?.remove();
}
$('taskNewV560').addEventListener('click', () => {
  const model = selectModernTaskListV551(readFromCanonicalOwner());
  const actions = taskActionsV560();
  if (!model.ready || !actions) return;
  const result = actions.create(ownerRequest(model));
  if (result?.ok && result?.pending) {
    showClassicTaskSurfaceV584('dialog');
    return;
  }
  showTaskResultV560(result);
});
$('main').addEventListener('click', async event => {
  if(taskBulkBusyV593)return;
  const button = event.target?.closest?.('[data-task-act-v560]');
  const row = button?.closest?.('[data-task-id]');
  const action = button?.dataset.taskActV560;
  if (!button || !row || !$('main').contains(row) || row.closest('[hidden]')
    || !['edit', 'detail', 'remove'].includes(action)) return;
  const actions = taskActionsV560();
  if (!actions || typeof actions[action] !== 'function') return;
  const request = {
    roomId: row.dataset.roomId, selectedUser: row.dataset.selectedUser,
    id: row.dataset.taskId, expectedRevision: Number(row.dataset.revision)
  };
  button.disabled = true;
  const operation = action === 'remove' && enterClassicTaskSurfaceV584('operation');
  let result;
  try {
    result = await actions[action](request);
  } catch {
    result = { ok: false, error: 'owner-error' };
  }
  if (result?.ok && result?.pending) {
    showClassicTaskSurfaceV584(action === 'detail' ? 'detail' : 'dialog');
    return;
  }
  if (result?.needsClassic && !operation) {
    // The original isolated test presents Classic's conflict dialog.
    window.frameElement?.remove();
    return;
  }
  clearTaskBulkV593();
  render();
  showTaskResultV560(result, action === 'remove'
    ? result?.alreadyDeleted ? 'すでに削除されています。最新一覧を確認してください。' : 'タスクを削除しました。'
    : '操作を完了しました。');
  if (operation) leaveClassicTaskSurfaceV584();
});
$('main').addEventListener('change', async event => {
  if(taskBulkBusyV593)return;
  const checkbox=event.target?.closest?.('input[data-task-select-v593]');
  if(checkbox && taskTableV318.contains(checkbox) && !taskBulkBusyV593) {
    const row=checkbox.closest('[data-task-id]');
    if(!row || !taskBulkOptionsV593?.ok || taskModeV318!=='list')return;
    const revision=Number(row.dataset.revision);
    if(checkbox.checked) {
      if(taskBulkSelectedV593.size>=taskBulkOptionsV593.limit) {
        checkbox.checked=false;
        showTaskBulkNoticeV593('一括操作は最大'+taskBulkOptionsV593.limit+'件です。',true);
      } else taskBulkSelectedV593.set(row.dataset.taskId,revision);
    } else taskBulkSelectedV593.delete(row.dataset.taskId);
    refreshTaskBulkV593();
    return;
  }
  const select = event.target?.closest?.('select[data-task-status-v560]');
  const row = select?.closest?.('[data-task-id]');
  if (!select || !row || !$('main').contains(row) || row.closest('[hidden]')) return;
  const actions = taskActionsV560();
  if (!actions) { render(); return; }
  const request = {
    roomId: row.dataset.roomId, selectedUser: row.dataset.selectedUser,
    id: row.dataset.taskId, expectedRevision: Number(row.dataset.revision),
    status: select.value
  };
  select.disabled = true;
  // Classic completion memo and write-conflict dialogs must remain visible.
  const operation = enterClassicTaskSurfaceV584('operation');
  let result;
  try {
    result = await actions.status(request);
  } catch {
    result = { ok: false, error: 'owner-error' };
  }
  clearTaskBulkV593();
  render();
  showTaskResultV560(result);
  if (operation) leaveClassicTaskSurfaceV584();
});
window.addEventListener('workboard:modern-tasks-resume',()=>{
  clearTaskBulkV593();
  render();
});
window.addEventListener('storage', event => {
  // Selecting another Classic user invalidates the old operation controls.
  if (event.key === 'systemTaskUser') {
    $('taskActionStatusV560').hidden = true;
    render();
  }
});

for (const button of taskModeButtonsV318) {
  button.addEventListener('click', () => {
    if(taskBulkBusyV593)return;
    const mode = button.dataset.taskModeV318;
    if (!['list','board','timeline'].includes(mode) || mode === taskModeV318) return;
    clearTaskBulkV593();
    taskModeV318 = mode;
    render(); // Re-read the Classic owner; no persistent second view state.
  });
}
$('taskBulkSelectAllV593').addEventListener('click',()=>{
  if(!taskBulkModelV593?.ready||!taskBulkOptionsV593?.ok||taskBulkBusyV593)return;
  if(taskBulkModelV593.rows.length>taskBulkOptionsV593.limit){
    showTaskBulkNoticeV593('表示中の'+taskBulkModelV593.rows.length+
      '件は上限を超えています。50件以内に絞り込んでください。',true);
    return;
  }
  clearTaskBulkV593();
  for(const row of taskBulkModelV593.rows)taskBulkSelectedV593.set(row.id,row.revision);
  render();
});
$('taskBulkClearV593').addEventListener('click',()=>{
  if(taskBulkBusyV593)return;
  clearTaskBulkV593();
  render();
});
taskBulkActionV593.addEventListener('change',()=>refreshTaskBulkV593({rebuildTargets:true}));
taskBulkTargetV593.addEventListener('change',()=>refreshTaskBulkV593());
taskBulkApplyV593.addEventListener('click',async()=>{
  if(taskBulkBusyV593||!taskBulkOptionsV593?.ok||!taskBulkSelectedV593.size)return;
  const actions=taskActionsV560();
  const current=selectModernTaskListV551(readFromCanonicalOwner(),{
    query:input.value,status:statusSelect.value||'all'
  });
  const revisions=new Map(current.rows.map(row=>[row.id,row.revision]));
  if(!current.ready||[...taskBulkSelectedV593].some(([id,rev])=>revisions.get(id)!==rev)){
    clearTaskBulkV593();
    render();
    showTaskBulkNoticeV593('対象が変更されました。最新の一覧から選び直してください。',true);
    return;
  }
  const intent={
    ...ownerRequest(current),items:[...taskBulkSelectedV593].map(([id,expectedRevision])=>({id,expectedRevision})),
    action:taskBulkActionV593.value,target:taskBulkTargetV593.hidden?'':taskBulkTargetV593.value
  };
  taskBulkBusyV593=true;refreshTaskBulkV593();
  let result;
  try{result=await actions?.bulk?.(intent) || {ok:false,error:'not-test-context'};}
  catch{result={ok:false,error:'owner-error'};}
  finally{taskBulkBusyV593=false;}
  if(result.ok){
    clearTaskBulkV593();
    render();
    showTaskBulkNoticeV593(result.pendingSync
      ? result.count+'件を保存しましたが、画面への同期を確認できません。正本を再読込してください。'
      : result.count+'件の一括操作が完了しました。');
  }else if(result.error==='cancelled'){
    refreshTaskBulkV593();
    showTaskBulkNoticeV593('一括操作をキャンセルしました。');
  }else{
    clearTaskBulkV593();
    render();
    showTaskBulkNoticeV593('一括操作を中止しました。競合・権限・通信状態を確認し、最新一覧で選び直してください。',true);
  }
});
$('refreshV551').addEventListener('click',()=>{clearTaskBulkV593();render();});
input.addEventListener('input',()=>{clearTaskBulkV593();render();});
statusSelect.addEventListener('change',()=>{clearTaskBulkV593();render();});
$('closeReadonly').addEventListener('click', () => {
  if (window.frameElement) window.frameElement.remove();
});
render();
