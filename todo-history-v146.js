// Ver.146: lightweight, read-only history for recently completed personal ToDos.
(function installTodoHistoryV146() {
  const HISTORY_DAYS = 7;
  const COLLAPSE_KEY = 'workBoardTodoHistoryCollapsedV146';
  let collapsed = true;
  let scheduled = false;

  try {
    const saved = localStorage.getItem(COLLAPSE_KEY);
    collapsed = saved == null ? true : saved === '1';
  } catch (_) {}

  function sanitizeRoomId(value) {
    return String(value || 'default').replace(/[.#$/\[\]]/g, '-').slice(0, 60);
  }

  function roomId() {
    try {
      const query = new URLSearchParams(location.search).get('room');
      if (query) return sanitizeRoomId(query);
    } catch (_) {}
    try { return sanitizeRoomId(localStorage.getItem('systemTaskRoomId') || 'default'); }
    catch (_) { return 'default'; }
  }

  function todosKey() {
    return `system-task-todos:${roomId()}`;
  }

  function currentUser() {
    try { return String(localStorage.getItem('systemTaskUser') || '').trim(); }
    catch (_) { return ''; }
  }

  function localDate(timestamp) {
    const date = new Date(Number(timestamp));
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function todayISO() {
    return localDate(Date.now());
  }

  function historyStart() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - HISTORY_DAYS);
    return date.getTime();
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function formatCompletedAt(timestamp) {
    const date = new Date(Number(timestamp));
    if (Number.isNaN(date.getTime())) return '';
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    return `${date.getMonth() + 1}/${date.getDate()}（${weekdays[date.getDay()]}） ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function readHistory() {
    let records = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(todosKey()) || '[]');
      records = Array.isArray(parsed) ? parsed : [];
    } catch (_) {}
    const owner = currentUser();
    const today = todayISO();
    const start = historyStart();
    return records
      .filter(todo => todo && todo.completed === true && String(todo.owner || '') === owner)
      .filter(todo => Number(todo.completedAt || 0) >= start && localDate(todo.completedAt) !== today)
      .sort((a, b) => Number(b.completedAt || 0) - Number(a.completedAt || 0));
  }

  function searchActive() {
    return Boolean(document.querySelector('#todoView .todo-search-input-v145')?.value?.trim());
  }

  function persistCollapse() {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); }
    catch (_) {}
  }

  function itemHtml(todo) {
    const title = escapeHtml(todo.text || '名称未設定');
    const memo = String(todo.memo || '').trim();
    const memoHtml = memo ? `<p class="todo-history-memo-v146">${escapeHtml(memo)}</p>` : '';
    const searchMemo = memo ? `<span class="todo-history-search-only-v146"> ${escapeHtml(memo)}</span>` : '';
    return `<li class="todo-item todo-history-item-v146" data-history-todo-id="${escapeHtml(todo.id || '')}">
      <div class="todo-history-main-v146">
        <div class="todo-history-title-row-v146">
          <span class="todo-history-done-v146" aria-hidden="true">✓</span>
          <span class="todo-text"><span>${title}</span>${searchMemo}</span>
        </div>
        ${memoHtml}
      </div>
      <time class="todo-history-date-v146" datetime="${escapeHtml(new Date(Number(todo.completedAt || 0)).toISOString())}">${escapeHtml(formatCompletedAt(todo.completedAt))}</time>
    </li>`;
  }

  function patch() {
    const root = document.getElementById('todoView');
    const lists = root?.querySelector('[data-todo-lists]');
    if (!lists) return;
    const history = readHistory();
    const signature = `${currentUser()}|${todayISO()}|${history.map(todo => `${todo.id}:${todo.revision}:${todo.completedAt}`).join(',')}`;

    let section = lists.querySelector('.todo-history-v146');
    if (!section) {
      section = document.createElement('section');
      section.className = 'todo-list todo-history-v146';
      lists.appendChild(section);
    }

    if (section.dataset.signature !== signature) {
      section.dataset.signature = signature;
      section.innerHTML = `
        <div class="todo-list-heading todo-history-heading-v146">
          <div>
            <h5>過去の完了</h5>
            <small>直近${HISTORY_DAYS}日・閲覧用</small>
          </div>
          <span class="todo-list-heading-actions-v146">
            <span class="todo-count">${history.length}件</span>
            <button type="button" class="todo-history-toggle-v146"></button>
          </span>
        </div>
        <div class="todo-history-body-v146">
          ${history.length ? `<ul class="todo-items todo-history-items-v146">${history.map(itemHtml).join('')}</ul>` : '<p class="todo-empty">直近7日に完了したToDoはありません。</p>'}
        </div>
      `;
      section.querySelector('.todo-history-toggle-v146')?.addEventListener('click', () => {
        collapsed = !collapsed;
        persistCollapse();
        applyVisibility(section);
      });
    }

    applyVisibility(section);
  }

  function applyVisibility(section) {
    const forceOpen = searchActive();
    const hidden = !forceOpen && collapsed;
    section.classList.toggle('is-collapsed-v146', hidden);
    const body = section.querySelector('.todo-history-body-v146');
    if (body) body.hidden = hidden;
    const button = section.querySelector('.todo-history-toggle-v146');
    if (button) {
      button.textContent = hidden ? '履歴を表示' : '履歴を隠す';
      button.setAttribute('aria-expanded', hidden ? 'false' : 'true');
    }
  }

  function schedulePatch() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      patch();
    });
  }

  function start() {
    const root = document.getElementById('todoView');
    if (!root) return;
    new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.type === 'childList' && (mutation.addedNodes.length || mutation.removedNodes.length))) schedulePatch();
    }).observe(root, { childList: true, subtree: true });
    root.addEventListener('input', event => {
      if (event.target?.matches?.('.todo-search-input-v145')) schedulePatch();
    });
    window.addEventListener('storage', event => {
      if (event.key === todosKey() || event.key === 'systemTaskUser') schedulePatch();
    });
    window.setInterval(schedulePatch, 60000);
    patch();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
