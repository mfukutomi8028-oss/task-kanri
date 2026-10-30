// Ver.552: Modern ToDo is a one-shot, owner-scoped read projection from
// Classic's singleton facade. It does not create a database client, cache,
// timer, writer, or new source of truth; explicit refresh rereads the owner.
import { selectModernTodosV552 } from './todo-list-contract-v552.mjs';

const $ = id => document.getElementById(id);
const emptyMessages = {
  'identity-not-selected': '利用者が選択されていません。クラシック側で選択してください。',
  loading: '正本の読込が終わっていません。クラシック側を確認してから再読込してください。',
  degraded: '共同データの同期に失敗しています。古いキャッシュは表示しません。',
  'invalid-owner-state': '正本のデータを検証できません。表示を中止しました。',
  'invalid-snapshot': '個人ToDoの所有者またはレコードを検証できません。表示を中止しました。',
  'not-test-context': 'localhostの明示的なテストルームでのみ表示できます。'
};

function readOwner() {
  try {
    if (window.parent === window || !['localhost', '127.0.0.1'].includes(location.hostname)) {
      return { ready: false, reason: 'not-test-context' };
    }
    const host = window.parent;
    const params = new URL(host.location.href).searchParams;
    const room = params.get('room') || '';
    const flags = host.WORK_BOARD_TEST;
    const local = !host.firebaseConfig?.apiKey || !host.firebaseConfig?.databaseURL;
    if (host.location.origin !== location.origin
      || params.get('modernReadV552') !== '1'
      || !room.startsWith('test-') || flags?.modernReadV552 !== true
      || !(local || flags?.emulator === true)) {
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

// The same-origin parent remains the only data owner. This optional command
// entry is never installed in production or in the normal Ver.552 read test.
function todoWriteActionsV557() {
  try {
    const host = window.parent;
    if (host === window || host.location.origin !== location.origin) return null;
    const query = new URL(host.location.href).searchParams;
    if (query.get('modernWriteV557') !== '1' || host.WORK_BOARD_TEST?.modernWriteV557 !== true) return null;
    return typeof host.WorkBoardTodoActionsV557?.toggle === 'function'
      ? host.WorkBoardTodoActionsV557 : null;
  } catch {
    return null;
  }
}

function span(parent, className, text) {
  const el = document.createElement('span');
  if (className) el.className = className;
  el.textContent = String(text ?? '');
  parent.appendChild(el);
  return el;
}

function completedDate(timestamp) {
  const date = new Date(Number(timestamp));
  if (!(Number(timestamp) > 0) || !Number.isFinite(date.getTime())) return '完了日時不明';
  const year = date.getFullYear();
  const pad = value => String(value).padStart(2, '0');
  return year + '/' + pad(date.getMonth() + 1) + '/' + pad(date.getDate())
    + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}

function todoRow(todo, group, writable = false, roomId = '', manageable = false, index = 0, rows = []) {
  const row = document.createElement('div');
  row.className = 'todo-row' + (todo.completed ? ' readonly-done' : '');
  row.dataset.todoId = todo.id;
  row.dataset.revision = String(todo.revision);
  if (writable) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'readonly-check check modern-todo-toggle-v557';
    toggle.dataset.todoToggleV557 = todo.id;
    toggle.dataset.roomId = roomId;
    toggle.dataset.selectedUser = todo.owner;
    toggle.dataset.expectedRevision = String(todo.revision);
    toggle.dataset.completed = String(!todo.completed);
    toggle.setAttribute('aria-label', todo.completed ? '未完了に戻す' : '完了にする');
    toggle.setAttribute('aria-pressed', todo.completed ? 'true' : 'false');
    toggle.textContent = todo.completed ? '✓' : '';
    row.appendChild(toggle);
  } else {
    const symbol = span(row, 'readonly-check check', todo.completed ? '✓' : '');
    symbol.setAttribute('aria-hidden', 'true');
    if (todo.completed) symbol.setAttribute('aria-checked', 'true');
  }
  const body = document.createElement('div');
  span(body, 'todo-title', todo.text);
  if (todo.memo) span(body, 'todo-note readonly-memo', todo.memo);
  if (todo.completed && group !== 'open') {
    span(body, 'readonly-time', '完了：' + completedDate(todo.completedAt));
  }
  row.appendChild(body);
  span(row, 'readonly-status', group === 'open' ? '未完了' : group === 'today' ? '本日完了' : '過去完了');
  if (manageable) {
    const tools = document.createElement('div');
    tools.className = 'modern-todo-row-tools-v558';
    const addTool = (action, label, text, settings = {}) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'modern-todo-tool-v558';
      button.dataset.todoActV558 = action;
      button.dataset.roomId = roomId;
      button.dataset.selectedUser = todo.owner;
      button.dataset.expectedRevision = String(todo.revision);
      button.setAttribute('aria-label', label + '：' + todo.text);
      button.textContent = text;
      if (settings.segment) {
        button.dataset.segment = settings.segment;
        button.dataset.direction = String(settings.direction);
        button.dataset.neighborId = settings.neighbor?.id || '';
        button.dataset.neighborRevision = String(settings.neighbor?.revision ?? -1);
        button.disabled = !settings.neighbor;
      }
      tools.appendChild(button);
    };
    addTool('update', '編集', '編集');
    // A filtered list is not the canonical adjacent order. Never offer an
    // ambiguous move that could target a hidden neighboring item.
    if (group !== 'history' && !$('todoSearchV552').value.trim()) {
      const segment = group === 'today' ? 'completed-today' : 'open';
      addTool('reorder', '上へ移動', '↑', { segment, direction: -1, neighbor: rows[index - 1] });
      addTool('reorder', '下へ移動', '↓', { segment, direction: 1, neighbor: rows[index + 1] });
    }
    addTool('remove', '削除', '削除');
    row.appendChild(tools);
  }
  return row;
}

function replaceList(group, rows, container, emptyId, countId, writable = false, roomId = '', manageable = false) {
  const items = rows.map((item, index) => todoRow(item, group, writable, roomId, manageable, index, rows));
  $(container).replaceChildren(...items);
  $(emptyId).hidden = items.length > 0;
  $(countId).textContent = String(items.length);
}

let todoDraftV558 = null;

function closeTodoEditorV558() {
  todoDraftV558 = null;
  $('todoFormHostV558').replaceChildren();
  $('todoFormHostV558').hidden = true;
}

function render() {
  const model = selectModernTodosV552(readOwner(), { query: $('todoSearchV552').value });
  if (!model.ready) {
    document.body.dataset.readState = 'unavailable';
    document.body.dataset.todoWriteV557 = 'readonly';
    document.body.dataset.todoManageV558 = 'readonly';
    $('todoNewV558').hidden = true;
    $('todoFormHostV558').hidden = true;
    $('todoActionStatusV557').hidden = true;
    const flag = document.querySelector('.readonly-flag');
    if (flag) flag.textContent = '閲覧専用';
    const warning = emptyMessages[model.reason] || 'この検証画面では個人ToDoを表示できません。';
    $('sourceV552').textContent = warning;
    $('countsV552').textContent = '';
    $('failureV552').hidden = false;
    $('failureV552').textContent = warning;
    $('openSectionV552').hidden = true;
    $('todaySectionV552').hidden = true;
    $('historyV552').hidden = true;
    for (const name of ['openRowsV552', 'todayRowsV552', 'historyRowsV552']) $(name).replaceChildren();
    return;
  }
  document.body.dataset.readState = 'ready';
  const actions = todoWriteActionsV557();
  const writable = Boolean(actions);
  const manageable = Boolean(actions && ['create', 'update', 'remove', 'reorder']
    .every(method => typeof actions[method] === 'function'));
  document.body.dataset.todoWriteV557 = writable ? 'enabled' : 'readonly';
  document.body.dataset.todoManageV558 = manageable ? 'enabled' : 'readonly';
  $('todoNewV558').hidden = !manageable;
  if (todoDraftV558 && (todoDraftV558.roomId !== model.roomId
    || todoDraftV558.selectedUser !== model.selectedUser)) {
    // Classic user was changed outside the iframe. Do not expose another
    // user's unsaved draft inside the newly selected user's workspace.
    closeTodoEditorV558();
    showTodoActionResultV557({ ok: false, error: 'owner-mismatch' });
  }
  $('todoFormHostV558').hidden = !manageable || !todoDraftV558;
  const flag = document.querySelector('.readonly-flag');
  if (flag) flag.textContent = manageable ? 'ToDo操作のテスト'
    : writable ? '完了操作のテスト' : '閲覧専用';
  const intro = document.querySelector('.heading > div > p');
  if (intro) intro.textContent = manageable
    ? 'Classicの保存処理で個人ToDoを管理する検証画面です。'
    : writable ? 'Classicの既存保存処理を使う完了・未完了切替のテスト画面です。'
    : 'クラシックの正本を参照する読み取り専用画面です。';
  const mobileNote = document.querySelector('.readonly-mobile-note');
  if (mobileNote) mobileNote.textContent = manageable
    ? 'Modern v2 / 作成・編集・完了・削除・上下移動を検証中。ドラッグ・タスク化はクラシックを使用してください。'
    : writable ? 'Modern v2 / テスト用ToDoの完了切替だけが操作可能です。'
    : 'Modern v2 / ToDoの閲覧のみ。編集・並び替え・タスク化はクラシックで行ってください。';
  const railNote = document.querySelector('.readonly-rail-label');
  if (railNote) railNote.textContent = manageable
    ? 'テスト用ルームだけで作成・編集・完了・削除・上下移動が可能です。保存はClassicが担当します。'
    : writable ? '検証用ルームに限定し、Classicの既存保存処理で完了・未完了を切り替えます。その他の操作はできません。'
    : '閲覧専用の検証画面です。追加・完了操作・削除はできません。';
  $('sourceV552').textContent =
    (model.source === 'local-only' ? '端末内保存（共同同期ではありません）' : '共同データ同期済み')
    + ' ／ ルーム：' + model.roomId
    + ' ／ 利用者：' + model.selectedUser
    + ' ／ 正本から表示';
  $('failureV552').hidden = true;
  $('openSectionV552').hidden = false;
  $('todaySectionV552').hidden = false;
  $('historyV552').hidden = false;
  replaceList('open', model.open, 'openRowsV552', 'openEmptyV552', 'openCountV552', writable, model.roomId, manageable);
  replaceList('today', model.completedToday, 'todayRowsV552', 'todayEmptyV552', 'todayCountV552', writable, model.roomId, manageable);
  replaceList('history', model.history, 'historyRowsV552', 'historyEmptyV552', 'historyCountV552', writable, model.roomId, manageable);
  const total = model.totals.open + model.totals.completedToday + model.totals.history;
  const visible = model.visible.open + model.visible.completedToday + model.visible.history;
  $('countsV552').textContent = '表示 ' + visible + '件 / 全 ' + total
    + '件（未完了 ' + model.totals.open + '件・本日完了 '
    + model.totals.completedToday + '件・過去完了 ' + model.totals.history + '件）';
}


function showTodoActionResultV557(result, successText = '完了状態を保存しました。') {
  const status = $('todoActionStatusV557');
  status.hidden = false;
  const cancelled = result?.error === 'cancelled';
  const ok = result?.ok === true;
  status.dataset.error = ok || cancelled ? 'false' : 'true';
  status.textContent = ok ? successText : cancelled ? '削除をキャンセルしました。'
    : result?.error === 'owner-mismatch'
      ? '利用者またはルームが変更されたため操作を中止しました。'
      : '保存できませんでした。編集中の内容は保持しています。Classic側の最新状態を確認してください。';
}

// One editor owned by Modern presentation; the Classic writer owns persistence.
// The form is created only when the additional Ver.558 test flag is present.
function openTodoEditorV558(id = '') {
  const actions = todoWriteActionsV557();
  if (!actions || typeof actions.create !== 'function') return;
  const model = selectModernTodosV552(readOwner());
  if (!model.ready) return;
  const current = id ? [...model.open, ...model.completedToday, ...model.history]
    .find(todo => todo.id === id) : null;
  if (id && !current) {
    showTodoActionResultV557({ ok: false, error: 'not-found' });
    return;
  }
  closeTodoEditorV558();
  todoDraftV558 = {
    roomId: model.roomId, selectedUser: model.selectedUser,
    id: current?.id || '', expectedRevision: current?.revision ?? 0
  };
  const host = $('todoFormHostV558');
  host.hidden = false;
  // Only create native DOM elements and assign persisted text via .value.
  const form = document.createElement('form');
  form.id = 'todoFormV558';
  form.noValidate = true;
  const heading = document.createElement('strong');
  heading.id = 'todoFormTitleV558';
  heading.textContent = current ? 'ToDoを編集' : 'ToDoを追加';
  form.appendChild(heading);

  const addField = (id, caption, elementName, maximum) => {
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = caption;
    const field = document.createElement(elementName);
    field.id = id;
    field.maxLength = maximum;
    if (elementName === 'input') {
      field.type = 'text';
      field.required = true;
      field.autocomplete = 'off';
    } else {
      field.rows = 3;
    }
    form.append(label, field);
  };
  addField('todoTextV558', 'ToDoの名称（100文字以内）', 'input', 100);
  addField('todoMemoV558', 'メモ（1000文字以内）', 'textarea', 1000);

  const buttons = document.createElement('div');
  buttons.className = 'modern-todo-form-actions-v558';
  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'btn';
  save.id = 'todoSaveV558';
  save.textContent = '保存';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn';
  cancel.id = 'todoCancelV558';
  cancel.textContent = 'キャンセル';
  buttons.append(save, cancel);
  form.appendChild(buttons);
  host.replaceChildren(form);
  $('todoTextV558').value = current?.text || '';
  $('todoMemoV558').value = current?.memo || '';
  $('todoTextV558').focus();
}

$('todoNewV558').addEventListener('click', () => openTodoEditorV558());
$('todoFormHostV558').addEventListener('click', event => {
  if (event.target.closest?.('#todoCancelV558')) closeTodoEditorV558();
});
$('todoFormHostV558').addEventListener('submit', async event => {
  if (event.target?.id !== 'todoFormV558') return;
  event.preventDefault();
  const draft = todoDraftV558;
  const actions = todoWriteActionsV557();
  if (!draft || !actions || typeof actions.create !== 'function') return;
  const submit = $('todoSaveV558');
  const text = $('todoTextV558').value;
  const memo = $('todoMemoV558').value;
  if (!text.trim() || text.trim().length > 100 || memo.trim().length > 1000) {
    showTodoActionResultV557({ ok: false, error: 'invalid-todo-input' });
    return;
  }
  submit.disabled = true;
  let result;
  try {
    const request = {
      roomId: draft.roomId, selectedUser: draft.selectedUser,
      text, memo, id: draft.id, expectedRevision: draft.expectedRevision
    };
    result = draft.id ? await actions.update(request) : await actions.create(request);
  } catch {
    result = { ok: false, error: 'owner-error' };
  }
  if (result?.ok) closeTodoEditorV558();
  render();
  showTodoActionResultV557(result, draft.id ? 'ToDoの変更を保存しました。' : 'ToDoを追加しました。');
  if (submit.isConnected) submit.disabled = false;
});

// Replace Ver.557's per-action listener with ONE delegated row-control handler.
$('main').addEventListener('click', async event => {
  const button = event.target?.closest?.('button[data-todo-toggle-v557], button[data-todo-act-v558]');
  if (!button || !event.currentTarget.contains(button) || button.disabled) return;
  const actions = todoWriteActionsV557();
  if (!actions) return;
  const type = button.dataset.todoActV558 || 'toggle';
  if (type === 'update') {
    openTodoEditorV558(button.closest('.todo-row[data-todo-id]')?.dataset.todoId);
    return;
  }
  if (type !== 'toggle' && typeof actions[type] !== 'function') return;
  const request = {
    roomId: button.dataset.roomId, selectedUser: button.dataset.selectedUser,
    id: button.closest('.todo-row[data-todo-id]')?.dataset.todoId,
    expectedRevision: Number(button.dataset.expectedRevision),
    completed: button.dataset.completed === 'true',
    segment: button.dataset.segment, direction: Number(button.dataset.direction),
    neighborId: button.dataset.neighborId,
    expectedNeighborRevision: Number(button.dataset.neighborRevision)
  };
  button.disabled = true;
  let result;
  try {
    result = type === 'toggle' ? await actions.toggle(request) : await actions[type](request);
  } catch {
    result = { ok: false, error: 'owner-error' };
  }
  render();
  showTodoActionResultV557(result, type === 'remove' ? 'ToDoを削除しました。'
    : type === 'reorder' ? 'ToDoの並び順を保存しました。'
    : '完了状態を保存しました。');
});

$('refreshV552').addEventListener('click', render);
$('todoSearchV552').addEventListener('input', render);
// Classic updates systemTaskUser when explicitly switching owner. The browser
// delivers the storage event to this separate same-origin iframe, so data from
// the prior owner is cleared on the next event instead of waiting for a click.
window.addEventListener('storage', event => {
  if (event.key === 'systemTaskUser') render();
});
$('closeV552').addEventListener('click', () => {
  if (window.frameElement) window.frameElement.remove();
});
render();
