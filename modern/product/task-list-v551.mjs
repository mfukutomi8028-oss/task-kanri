// Ver.551: opt-in localhost/test-room view. DOM is Modern-only, values come
// exclusively from the existing Classic WorkBoardReadV550.read() facade.
// No Firebase client, data cache, polling, storage, demo source, or write path.
import { selectModernTaskListV551 } from './task-list-contract-v551.mjs';
import { readProductionClassicV580 } from '../production-owner-v580.mjs?v=309';

const $ = id => document.getElementById(id);
const tbody = $('taskRowsV551');
const statusSelect = $('taskStatusV551');
const input = $('taskSearchV551');
const message = $('sourceV551');
const count = $('countV551');
const empty = $('emptyV551');

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
function renderTask(task, { writable = false, advanced = false, statuses = [], roomId = '', selectedUser = '' } = {}) {
  const tr = document.createElement('tr');
  tr.dataset.taskId = task.id;
  tr.dataset.revision = String(task.revision);
  if (writable) {
    tr.dataset.roomId = roomId;
    tr.dataset.selectedUser = selectedUser;
  }
  const indicator = cell(tr, 'select-cell');
  span(indicator, 'readonly-dot', '•').setAttribute('aria-hidden', 'true');
  const title = cell(tr, 'title-cell');
  const titleBody = span(title, 'task-open', '');
  const strong = document.createElement('strong');
  strong.className = 'readonly-title';
  strong.textContent = task.title || '名称未設定';
  titleBody.appendChild(strong);
  span(titleBody, 'readonly-subtitle', task.category || '分類未設定');
  if (writable) {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'btn small task-edit-v560';
    edit.dataset.taskActV560 = 'edit';
    edit.setAttribute('aria-label', '編集：' + task.title);
    edit.textContent = '編集';
    if (advanced) {
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
      title.appendChild(controls);
    } else {
      title.appendChild(edit);
    }
  }
  const owner = cell(tr, 'owner-cell');
  const badge = span(owner, 'owner', '');
  span(badge, 'avatar', task.assignee.slice(0,1) || '―');
  span(badge, '', task.assignee || '担当未設定');
  const status = cell(tr, 'status-cell');
  const statusClass = task.completed ? 'done' : task.status === '対応中' ? 'working' : task.status === '確認待ち' ? 'waiting' : '';
  if (writable) {
    const select = document.createElement('select');
    select.className = 'task-status-v560';
    select.dataset.taskStatusV560 = task.id;
    select.setAttribute('aria-label', '状態を変更：' + task.title);
    const choices = statuses.includes(task.status) ? statuses : [task.status, ...statuses];
    for (const name of choices) select.add(new Option(name, name));
    select.value = task.status;
    status.appendChild(select);
  } else {
    span(status, 'status ' + statusClass, task.status || '状態未設定');
  }
  const priority = cell(tr, 'priority-cell');
  span(priority, 'priority' + (task.priority === '高' || task.priority === '緊急' ? ' high' : ''), task.priority || '未設定');
  const due = cell(tr, 'date-cell');
  span(due, 'tiny-date' + (task.overdue ? ' late' : ''), task.dueDate || '期限なし');
  return tr;
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
  tbody.replaceChildren(...shown.rows.map(row => renderTask(row, {
    writable, advanced, statuses: statusesForEdit, roomId: shown.roomId, selectedUser: shown.selectedUser
  })));
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
tbody.addEventListener('click', async event => {
  const button = event.target?.closest?.('[data-task-act-v560]');
  const row = button?.closest?.('tr[data-task-id]');
  const action = button?.dataset.taskActV560;
  if (!button || !row || !tbody.contains(row)
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
  render();
  showTaskResultV560(result, action === 'remove'
    ? result?.alreadyDeleted ? 'すでに削除されています。最新一覧を確認してください。' : 'タスクを削除しました。'
    : '操作を完了しました。');
  if (operation) leaveClassicTaskSurfaceV584();
});
tbody.addEventListener('change', async event => {
  const select = event.target?.closest?.('select[data-task-status-v560]');
  const row = select?.closest?.('tr[data-task-id]');
  if (!select || !row || !tbody.contains(row)) return;
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
  render();
  showTaskResultV560(result);
  if (operation) leaveClassicTaskSurfaceV584();
});
window.addEventListener('workboard:modern-tasks-resume', render);
window.addEventListener('storage', event => {
  // Selecting another Classic user invalidates the old operation controls.
  if (event.key === 'systemTaskUser') {
    $('taskActionStatusV560').hidden = true;
    render();
  }
});

$('refreshV551').addEventListener('click', render);
input.addEventListener('input', render);
statusSelect.addEventListener('change', render);
$('closeReadonly').addEventListener('click', () => {
  if (window.frameElement) window.frameElement.remove();
});
render();
