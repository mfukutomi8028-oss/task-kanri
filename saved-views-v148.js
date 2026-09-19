// Ver.229 saved views: filters, primary sort persistence, layout, and list-column sort metadata.
(function installSavedViewsV229() {
  const W = window.WorkBoardWorkflowV148;
  if (!W) return;

  const savedKey = `system-task-saved-filters:${W.ROOM_ID}`;
  const layoutKey = `system-task-layout:${W.ROOM_ID}`;
  const baseSortKey = `work-board-base-sort:${W.ROOM_ID}`;
  const columnKey = `work-board-list-column-sort:${W.ROOM_ID}`;
  const VALID_BASE_SORTS = new Set(['smart', 'due', 'updated', 'priority']);
  let ctx = null;

  function ids() {
    const value = W.safeJson(localStorage.getItem(savedKey) || '[]', []);
    return new Set((Array.isArray(value) ? value : [])
      .map(item => String(item?.id || ''))
      .filter(Boolean));
  }

  function currentBaseSort() {
    const select = document.getElementById('sortSelect');
    return select && VALID_BASE_SORTS.has(select.value) ? select.value : '';
  }

  function persistBaseSort() {
    const value = currentBaseSort();
    if (value) localStorage.setItem(baseSortKey, value);
  }

  function restoreBaseSort() {
    const select = document.getElementById('sortSelect');
    if (!select) return false;
    const saved = localStorage.getItem(baseSortKey) || '';
    if (VALID_BASE_SORTS.has(saved) && select.value !== saved) {
      select.value = saved;
      select.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return true;
  }

  function snapshot() {
    const active = document.querySelector('[data-task-layout].active')?.dataset?.taskLayout
      || localStorage.getItem(layoutKey)
      || 'board';
    return {
      taskLayout: ['board', 'list', 'timeline'].includes(active) ? active : 'board',
      columnSort: W.safeJson(localStorage.getItem(columnKey) || 'null', null),
      updatedAt: Date.now()
    };
  }

  function begin() {
    ctx = { before: ids(), view: snapshot() };
  }

  function finish() {
    if (!ctx) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const created = [...ids()].find(id => !ctx.before.has(id));
      if (created) {
        const view = ctx.view;
        clearInterval(timer);
        ctx = null;
        W.writeSavedView(created, view);
        W.notify('絞り込み・並び順・表示形式を保存しました。');
      } else if (attempts >= 24) {
        clearInterval(timer);
        ctx = null;
      }
    }, 250);
  }

  function apply(id) {
    const view = W.workflow.savedViews?.[String(id)];
    if (!view) return;
    persistBaseSort();
    if (view.columnSort) localStorage.setItem(columnKey, JSON.stringify(view.columnSort));
    else localStorage.removeItem(columnKey);
    const button = view.taskLayout
      ? document.querySelector(`[data-task-layout="${CSS.escape(view.taskLayout)}"]`)
      : null;
    setTimeout(() => button?.click(), 40);
  }

  function label() {
    const button = document.getElementById('saveCurrentFilter');
    if (!button) return;
    if (button.textContent !== '現在の表示を保存') button.textContent = '現在の表示を保存';
    button.title = '絞り込み・基本並び順・タスク表示形式をまとめて保存します';
  }

  function handleBaseSortEvent(event) {
    if (event.target?.matches?.('#sortSelect')) persistBaseSort();
  }

  document.addEventListener('input', handleBaseSortEvent, true);
  document.addEventListener('change', handleBaseSortEvent, true);

  document.addEventListener('click', event => {
    if (event.target.closest?.('#saveCurrentFilter')) {
      begin();
      setTimeout(finish, 0);
      return;
    }
    const filter = event.target.closest?.('[data-apply-filter]');
    if (filter) setTimeout(() => apply(filter.dataset.applyFilter || ''), 0);
  }, true);

  new MutationObserver(label).observe(document.body, { childList: true, subtree: true });

  function start() {
    restoreBaseSort();
    label();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
