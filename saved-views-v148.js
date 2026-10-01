// Ver.338 saved views: primary task sort persistence with direct canonical input binding.
(function installSavedViewsV338() {
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

  function start() {
    const select = document.getElementById('sortSelect');
    if (!select) return;
    select.addEventListener('input', persistBaseSort);
    restoreBaseSort();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
