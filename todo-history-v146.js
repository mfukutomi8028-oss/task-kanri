// Personal ToDo archive: existing completed records are retained; render in bounded pages.
(function installTodoHistoryV146() {
  const PAGE_SIZE = 50;
  let visibleCount = PAGE_SIZE;
  let activeNeedle = '';
  const COLLAPSE_KEY = 'workBoardTodoHistoryCollapsedV146';
  let collapsed = true;
  let dateBoundaryTimer = 0;
  let lastLocalDate = '';

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
    // 完了日は表示対象の区分に使うだけで、保存済みデータは削除しない。
    return records
      .filter(todo => todo && todo.completed === true && String(todo.owner || '') === owner)
      .filter(todo => Number(todo.completedAt || 0) > 0 && localDate(todo.completedAt) !== today)
      .sort((a, b) => Number(b.completedAt || 0) - Number(a.completedAt || 0));
  }

  function historyNeedle() {
    const input = document.querySelector('#todoView .todo-search-input-v145');
    return String(input?.value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function historyMatches(todo, needle) {
    if (!needle) return true;
    return String([todo.text, todo.memo].join(' ')).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').includes(needle);
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
    const needle = historyNeedle();
    if (needle !== activeNeedle) { activeNeedle = needle; visibleCount = PAGE_SIZE; }
    const history = readHistory().filter(todo => historyMatches(todo, needle));
    const shown = history.slice(0, visibleCount);
    const signature = `${currentUser()}|${todayISO()}|${needle}|${visibleCount}|${history.length}|${shown.map(todo => `${todo.id}:${todo.revision}:${todo.completedAt}`).join(',')}`;

    let section = lists.querySelector('.todo-history-v146');
    if (!section) {
      section = document.createElement('section');
      section.className = 'todo-list todo-history-v146';
      lists.appendChild(section);
    }

    if (section.dataset.signature !== signature) {
      section.dataset.signature = signature;
      section.dataset.matchCount = String(history.length);
      section.innerHTML = `
        <div class="todo-list-heading todo-history-heading-v146">
          <div>
            <h5>過去の完了</h5>
            <small>保存済みの全履歴・50件ずつ表示</small>
          </div>
          <span class="todo-list-heading-actions-v146">
            <span class="todo-count">${history.length}件</span>
            <button type="button" class="todo-history-toggle-v146"></button>
          </span>
        </div>
        <div class="todo-history-body-v146">
          ${history.length ? `<ul class="todo-items todo-history-items-v146">${shown.map(itemHtml).join('')}</ul>` : `<p class="todo-empty">${needle ? '条件に合う完了履歴はありません。' : '過去に完了したToDoはありません。'}</p>`}
          ${history.length > shown.length ? `<button class="todo-history-more-v531 ghost-button" type="button">さらに${Math.min(PAGE_SIZE, history.length - shown.length)}件表示（残り${history.length - shown.length}件）</button>` : ''}
        </div>
      `;
      section.querySelector('.todo-history-toggle-v146')?.addEventListener('click', () => {
        collapsed = !collapsed;
        persistCollapse();
        applyVisibility(section);
      });
      section.querySelector('.todo-history-more-v531')?.addEventListener('click', () => {
        visibleCount += PAGE_SIZE;
        patch();
      });
      // DOMを作り直した場合だけ検索側のフィルタを再適用する。
      root.dispatchEvent(new CustomEvent('todo-history-updated-v531'));
    }

    applyVisibility(section);
  }
  function applyVisibility(section) {
    const forceOpen = searchActive();
    const hidden = !forceOpen && collapsed;
    if (section.classList.contains('is-collapsed-v146') !== hidden) {
      section.classList.toggle('is-collapsed-v146', hidden);
    }
    const body = section.querySelector('.todo-history-body-v146');
    if (body && body.hidden !== hidden) body.hidden = hidden;
    const button = section.querySelector('.todo-history-toggle-v146');
    if (button) {
      const label = hidden ? '履歴を表示' : '履歴を隠す';
      if (button.textContent !== label) button.textContent = label;
      const expanded = hidden ? 'false' : 'true';
      if (button.getAttribute('aria-expanded') !== expanded) button.setAttribute('aria-expanded', expanded);
    }
  }

  function containsTodoLists(node) {
    if (!node || node.nodeType !== 1) return false;
    return Boolean(node.matches?.('[data-todo-lists]') || node.querySelector?.('[data-todo-lists]'));
  }

  function scheduleDateBoundary() {
    if (dateBoundaryTimer) window.clearTimeout(dateBoundaryTimer);
    const now = new Date();
    const next = new Date(now.getTime());
    next.setHours(24, 0, 0, 100);
    const delay = Math.max(1000, next.getTime() - now.getTime());
    dateBoundaryTimer = window.setTimeout(() => {
      lastLocalDate = todayISO();
      patch();
      scheduleDateBoundary();
    }, delay);
  }

  function refreshAfterResume() {
    const current = todayISO();
    if (current === lastLocalDate) return;
    lastLocalDate = current;
    patch();
    scheduleDateBoundary();
  }

  function start() {
    const root = document.getElementById('todoView');
    if (!root) return;
    new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.type === 'childList'
        && Array.from(mutation.addedNodes || []).some(containsTodoLists))) patch();
    }).observe(root, { childList: true });
    root.addEventListener('input', event => {
      if (!event.target?.matches?.('.todo-search-input-v145')) return;
      const section = root.querySelector('.todo-history-v146');
      if (section) applyVisibility(section);
      patch();
    });
    window.addEventListener('storage', event => {
      if (event.key === todosKey() || event.key === 'systemTaskUser') patch();
    });
    window.addEventListener('pageshow', refreshAfterResume);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshAfterResume();
    });
    lastLocalDate = todayISO();
    scheduleDateBoundary();
    patch();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
