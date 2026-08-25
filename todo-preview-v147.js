// Ver.147: make Today-view ToDo text open details; completion is explicit-only.
(function installTodayTodoPreviewV147() {
  let scheduled = false;

  function detailButtonFor(line) {
    return line?.closest?.('.todo-preview-item')?.querySelector?.('[data-open-todo]') || null;
  }

  function patchLine(line) {
    if (!(line instanceof HTMLElement) || line.dataset.todoPreviewOpenV147 === 'true') return;
    line.dataset.todoPreviewOpenV147 = 'true';
    line.classList.add('todo-preview-open-line-v147');
    line.title = 'クリックで詳細を開く';

    const title = line.querySelector('.todo-preview-text');
    if (!title) return;
    title.tabIndex = 0;
    title.setAttribute('role', 'button');
    title.setAttribute('aria-label', `${title.textContent?.trim() || 'ToDo'}の詳細を開く`);
    title.addEventListener('keydown', event => {
      if (!['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      detailButtonFor(line)?.click();
    });
  }

  function patch() {
    document.querySelectorAll('#todayView .todo-preview-checkline').forEach(patchLine);
  }

  function schedulePatch() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      patch();
    });
  }

  // The preview still uses a <label> around completion + title for backward
  // compatibility. Intercept every click on that line except the explicit
  // completion affordance, and route it to the existing "詳細を見る" button.
  document.addEventListener('click', event => {
    const line = event.target?.closest?.('#todayView .todo-preview-checkline');
    if (!line) return;
    if (event.target.closest('.todo-preview-state-hint-v144, .todo-preview-check')) return;

    event.preventDefault();
    event.stopPropagation();
    detailButtonFor(line)?.click();
  }, true);

  function start() {
    const root = document.getElementById('todayView');
    if (root) {
      new MutationObserver(mutations => {
        if (mutations.some(mutation => mutation.type === 'childList' && (mutation.addedNodes.length || mutation.removedNodes.length))) {
          schedulePatch();
        }
      }).observe(root, { childList: true, subtree: true });
    }
    patch();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
