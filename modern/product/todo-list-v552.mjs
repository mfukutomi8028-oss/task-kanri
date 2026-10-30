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

function todoRow(todo, group, writable = false, roomId = '') {
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
  return row;
}

function replaceList(group, rows, container, emptyId, countId, writable = false, roomId = '') {
  const items = rows.map(item => todoRow(item, group, writable, roomId));
  $(container).replaceChildren(...items);
  $(emptyId).hidden = items.length > 0;
  $(countId).textContent = String(items.length);
}

function render() {
  const model = selectModernTodosV552(readOwner(), { query: $('todoSearchV552').value });
  if (!model.ready) {
    document.body.dataset.readState = 'unavailable';
    document.body.dataset.todoWriteV557 = 'readonly';
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
  const writable = Boolean(todoWriteActionsV557());
  document.body.dataset.todoWriteV557 = writable ? 'enabled' : 'readonly';
  const flag = document.querySelector('.readonly-flag');
  if (flag) flag.textContent = writable ? '完了操作のテスト' : '閲覧専用';
  const intro = document.querySelector('.heading > div > p');
  if (intro) intro.textContent = writable
    ? 'Classicの既存保存処理を使う完了・未完了切替のテスト画面です。'
    : 'クラシックの正本を参照する読み取り専用画面です。';
  const mobileNote = document.querySelector('.readonly-mobile-note');
  if (mobileNote) mobileNote.textContent = writable
    ? 'Modern v2 / テスト用ToDoの完了切替だけが操作可能です。'
    : 'Modern v2 / ToDoの閲覧のみ。編集・並び替え・タスク化はクラシックで行ってください。';
  const railNote = document.querySelector('.readonly-rail-label');
  if (railNote) railNote.textContent = writable
    ? '検証用ルームに限定し、Classicの既存保存処理で完了・未完了を切り替えます。その他の操作はできません。'
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
  replaceList('open', model.open, 'openRowsV552', 'openEmptyV552', 'openCountV552', writable, model.roomId);
  replaceList('today', model.completedToday, 'todayRowsV552', 'todayEmptyV552', 'todayCountV552', writable, model.roomId);
  replaceList('history', model.history, 'historyRowsV552', 'historyEmptyV552', 'historyCountV552', writable, model.roomId);
  const total = model.totals.open + model.totals.completedToday + model.totals.history;
  const visible = model.visible.open + model.visible.completedToday + model.visible.history;
  $('countsV552').textContent = '表示 ' + visible + '件 / 全 ' + total
    + '件（未完了 ' + model.totals.open + '件・本日完了 '
    + model.totals.completedToday + '件・過去完了 ' + model.totals.history + '件）';
}


function showTodoActionResultV557(result) {
  const status = $('todoActionStatusV557');
  status.hidden = false;
  const ok = result?.ok === true;
  status.dataset.error = ok ? 'false' : 'true';
  status.textContent = ok ? '完了状態を保存しました。'
    : '保存できませんでした。Classic側の最新状態を確認し、必要に応じて再読込してください。';
}

// One Modern presentation listener delegates to the Classic data-owner command.
$('main').addEventListener('click', async event => {
  const button = event.target?.closest?.('button[data-todo-toggle-v557]');
  if (!button || !event.currentTarget.contains(button)) return;
  const actions = todoWriteActionsV557();
  if (!actions || button.disabled) return;
  button.disabled = true;
  let result;
  try {
    result = await actions.toggle({
      roomId: button.dataset.roomId,
      selectedUser: button.dataset.selectedUser,
      id: button.dataset.todoToggleV557,
      expectedRevision: Number(button.dataset.expectedRevision),
      completed: button.dataset.completed === 'true'
    });
  } catch {
    result = { ok: false, error: 'owner-error' };
  }
  render();
  showTodoActionResultV557(result);
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
