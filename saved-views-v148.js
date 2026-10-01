// Ver.336 saved views: primary task sort persistence only.
(function installSavedViewsV336() {
  const W = window.WorkBoardWorkflowV148;
  if (!W) return;

  const baseSortKey = `work-board-base-sort:${W.ROOM_ID}`;
  const VALID_BASE_SORTS = new Set(['smart', 'due', 'updated', 'priority']);

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

  function handleBaseSortEvent(event) {
    if (event.target?.matches?.('#sortSelect')) persistBaseSort();
  }

  document.addEventListener('input', handleBaseSortEvent, true);
  document.addEventListener('change', handleBaseSortEvent, true);

  function start() {
    restoreBaseSort();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
