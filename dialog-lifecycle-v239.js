// Ver.239 preparation: canonical dialog backdrop-close behavior and task-editor discard guard.
(function installDialogLifecycleV239() {
  'use strict';

  const DISCARD_MESSAGE = '入力内容が変更されています。保存せずに閉じますか？';
  let taskDialogDirty = false;

  function taskDialog() {
    return document.getElementById('taskDialog');
  }

  function confirmTaskDiscard() {
    return !taskDialogDirty || window.confirm(DISCARD_MESSAGE);
  }

  // Only trusted user edits mark the editor dirty. Programmatic hydration and
  // quick-status submissions dispatch synthetic events and must not prompt.
  function markTaskDialogDirty(event) {
    const dialog = taskDialog();
    if (!dialog?.open || !event.isTrusted) return;
    if (!event.target?.closest?.('#taskForm')) return;
    taskDialogDirty = true;
  }

  document.addEventListener('input', markTaskDialogDirty, true);
  document.addEventListener('change', markTaskDialogDirty, true);

  // app.js owns the actual task-dialog close button. This guard runs first so
  // explicit close and backdrop-delegated close share one discard decision.
  document.addEventListener('click', event => {
    const closeButton = event.target?.closest?.('#closeTaskDialog');
    const dialog = taskDialog();
    if (!closeButton || !dialog?.open || !taskDialogDirty) return;
    if (confirmTaskDiscard()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  // Native Escape emits cancel before close and can be vetoed without replacing
  // app.js cleanup listeners.
  document.addEventListener('cancel', event => {
    const dialog = taskDialog();
    if (event.target !== dialog || !dialog?.open || !taskDialogDirty) return;
    if (confirmTaskDiscard()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('close', event => {
    if (event.target !== taskDialog()) return;
    taskDialogDirty = false;
  }, true);

  // Native <dialog> backdrop clicks target the dialog itself. Only clicks outside
  // its visual rectangle should delegate to each dialog's existing close/cancel path.
  document.addEventListener('click', event => {
    const dialog = event.target;
    if (!(dialog instanceof HTMLDialogElement) || !dialog.open) return;
    if (dialog.id === 'userDialog') return; // startup user selection is required

    const rect = dialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (inside) return;

    event.preventDefault();
    const preferred = dialog.querySelector([
      '#closeTaskDialog', '#closeScheduleDialog', '#closeTimelineMoveDialog', '#closeActivityDialog',
      '#closeUserManage', '#closeStatusManage', '#closeCategoryManage', '#closeTemplateManage',
      '#cancelDeleteConflict', '#cancelTimelineMove', '.dialog-head .icon-button'
    ].join(','));
    if (preferred) preferred.click();
    else dialog.close();
  });
})();
