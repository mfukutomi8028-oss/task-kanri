// Ver.240: explicit dialog backdrop-close delegation and task-editor discard guard.
(function installDialogLifecycleV239() {
  'use strict';

  const DISCARD_MESSAGE = '入力内容が変更されています。保存せずに閉じますか？';
  const BACKDROP_CLOSE_CONTROL_BY_DIALOG = Object.freeze({
    userManageDialog: '#closeUserManage',
    statusManageDialog: '#closeStatusManage',
    categoryManageDialog: '#closeCategoryManage',
    scheduleDialog: '#closeScheduleDialog',
    scheduleCopyDialog: '#closeScheduleCopyDialog',
    // The app-owned close button checks recurringDeleteBusy before dismissing.
    recurringDeleteDialog: '#closeRecurringDelete',
    templateManageDialog: '#closeTemplateManage',
    taskDialog: '#closeTaskDialog',
    workMemoDialogV167: '[data-memo-close]',
    timelineMoveDialog: '#closeTimelineMoveDialog',
    activityDialog: '#closeActivityDialog',
    deleteConflictDialog: '#cancelDeleteConflict'
  });
  let taskDialogDirty = false;
  let memoDialogDirty = false;
  function memoDialog() {
    return document.getElementById('workMemoDialogV167');
  }

  function taskDialog() {
    return document.getElementById('taskDialog');
  }

  function confirmTaskDiscard(dirty = taskDialogDirty) {
    // Both task and dynamically created memo dialogs have independent
    // unsaved-change states. Never reuse the task flag for memo decisions.
    return !dirty || window.confirm(DISCARD_MESSAGE);
  }

  // Only trusted user edits mark the editor dirty. Programmatic hydration and
  // quick-status submissions dispatch synthetic events and must not prompt.
  function markTaskDialogDirty(event) {
    // Native user edits are required for task-editor discard prompts; task
    // hydration may dispatch synthetic events. Memo initialization assigns
    // values before showModal(), so even automation-assisted input/change must
    // count as a memo edit to avoid silent loss when clicking the backdrop.
    if (taskDialog()?.open && event.isTrusted && event.target?.closest?.('#taskForm')) {
      taskDialogDirty = true;
    }
    if (memoDialog()?.open && event.target?.closest?.('#workMemoFormV167')) {
      memoDialogDirty = true;
    }
  }

  document.addEventListener('input', markTaskDialogDirty, true);
  document.addEventListener('change', markTaskDialogDirty, true);

  // app.js owns the actual task-dialog close button. This guard runs first so
  // explicit close and backdrop-delegated close share one discard decision.
  document.addEventListener('click', event => {
    const closeButton = event.target?.closest?.('#closeTaskDialog');
    const dialog = taskDialog();
    if (closeButton && dialog?.open && taskDialogDirty && !confirmTaskDiscard()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    // Memo modal is created by work-features-v167.js after app startup.
    // Delegate to its existing close button instead of adding another
    // backdrop handler or bypassing its data ownership.
    const memoClose = event.target?.closest?.('#workMemoDialogV167 [data-memo-close]');
    if (memoClose && memoDialog()?.open && memoDialogDirty && !confirmTaskDiscard(memoDialogDirty)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  // Native Escape emits cancel before close and can be vetoed without replacing
  // app.js cleanup listeners.
  document.addEventListener('cancel', event => {
    const dirty = event.target === taskDialog()
      ? taskDialogDirty
      : event.target === memoDialog() ? memoDialogDirty : false;
    if (!dirty || !event.target?.open || confirmTaskDiscard(dirty)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('close', event => {
    if (event.target === taskDialog()) taskDialogDirty = false;
    if (event.target === memoDialog()) memoDialogDirty = false;
  }, true);

  // Native <dialog> backdrop clicks target the dialog itself. Only current,
  // audited dialogs delegate to their existing app-owned close/cancel control.
  // Unknown/future dialogs are intentionally left untouched so feature-specific
  // cleanup cannot be bypassed by a generic dialog.close() fallback.
  document.addEventListener('click', event => {
    const dialog = event.target;
    if (!(dialog instanceof HTMLDialogElement) || !dialog.open) return;

    const closeSelector = BACKDROP_CLOSE_CONTROL_BY_DIALOG[dialog.id];
    if (!closeSelector) return;

    const rect = dialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (inside) return;

    const preferred = dialog.querySelector(closeSelector);
    if (!preferred) return;
    event.preventDefault();
    preferred.click();
  });
})();
