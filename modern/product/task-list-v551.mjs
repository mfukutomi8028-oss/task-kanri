// Ver.551: opt-in localhost/test-room view. DOM is Modern-only, values come
// exclusively from the existing Classic WorkBoardReadV550.read() facade.
// No Firebase client, data cache, polling, storage, demo source, or write path.
import { selectModernTaskListV551 } from './task-list-contract-v551.mjs';

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
function renderTask(row) {
  const tr = document.createElement('tr');
  tr.dataset.taskId = row.id;
  tr.dataset.revision = String(row.revision);
  const indicator = cell(tr, 'select-cell');
  span(indicator, 'readonly-dot', '•').setAttribute('aria-hidden', 'true');
  const title = cell(tr, 'title-cell');
  const titleBody = span(title, 'task-open', '');
  const strong = document.createElement('strong');
  strong.className = 'readonly-title';
  strong.textContent = row.title || '名称未設定';
  titleBody.appendChild(strong);
  span(titleBody, 'readonly-subtitle', row.category || '分類未設定');
  const owner = cell(tr, 'owner-cell');
  const badge = span(owner, 'owner', '');
  span(badge, 'avatar', row.assignee.slice(0,1) || '―');
  span(badge, '', row.assignee || '担当未設定');
  const status = cell(tr, 'status-cell');
  const statusClass = row.completed ? 'done' : row.status === '対応中' ? 'working' : row.status === '確認待ち' ? 'waiting' : '';
  span(status, 'status ' + statusClass, row.status || '状態未設定');
  const priority = cell(tr, 'priority-cell');
  span(priority, 'priority' + (row.priority === '高' || row.priority === '緊急' ? ' high' : ''), row.priority || '未設定');
  const due = cell(tr, 'date-cell');
  span(due, 'tiny-date' + (row.overdue ? ' late' : ''), row.dueDate || '期限なし');
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
  tbody.replaceChildren(...shown.rows.map(renderTask));
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

$('refreshV551').addEventListener('click', render);
input.addEventListener('input', render);
statusSelect.addEventListener('change', render);
$('closeReadonly').addEventListener('click', () => {
  if (window.frameElement) window.frameElement.remove();
});
render();
