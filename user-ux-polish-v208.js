// Ver.208: user-requested UX polish without changing the underlying star, pin, cache, or inbox data models.
(function installUserUxPolishV208() {
  'use strict';

  const DISCARD_MESSAGE = '入力内容が変更されています。保存せずに閉じますか？';
  let taskDialogDirty = false;
  let allowCloseButtonOnce = false;

  function hideRemovedUi() {
    // Keep the internal favorite checkbox so the left navigation Star filter and saved views continue to work.
    const favorite = document.getElementById('favoriteOnly');
    const favoriteRow = favorite?.closest?.('.check-row');
    if (favorite) {
      favorite.hidden = true;
      favorite.style.setProperty('display', 'none', 'important');
      favorite.setAttribute('aria-hidden', 'true');
    }
    if (favoriteRow) {
      favoriteRow.hidden = true;
      favoriteRow.style.setProperty('display', 'none', 'important');
      favoriteRow.setAttribute('aria-hidden', 'true');
    }

    // The cache-clear action is intentionally removed from the product UI.
    document.getElementById('roomCacheHelp')?.remove();
    document.getElementById('clearRoomCache')?.remove();
  }

  function taskDialog() {
    return document.getElementById('taskDialog');
  }

  function confirmTaskDiscard() {
    return !taskDialogDirty || window.confirm(DISCARD_MESSAGE);
  }

  function isOutsideDialogClick(dialog, event) {
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  }

  // Mark only genuine user changes as dirty. Programmatic form hydration and the quick-status bridge must not prompt.
  function markTaskDialogDirty(event) {
    const dialog = taskDialog();
    if (!dialog?.open || !event.isTrusted) return;
    if (!event.target?.closest?.('#taskForm')) return;
    taskDialogDirty = true;
  }

  document.addEventListener('input', markTaskDialogDirty, true);
  document.addEventListener('change', markTaskDialogDirty, true);

  // Intercept the explicit × close before app.js closes the dialog.
  document.addEventListener('click', event => {
    const dialog = taskDialog();
    if (!dialog?.open) return;

    const closeButton = event.target?.closest?.('#closeTaskDialog');
    if (closeButton) {
      if (allowCloseButtonOnce) {
        allowCloseButtonOnce = false;
        return;
      }
      if (!confirmTaskDiscard()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }

    // task-ux-v146.js owns the actual backdrop close. Confirm here in capture phase,
    // then let its existing close route continue when the user accepts.
    if (event.target === dialog && isOutsideDialogClick(dialog, event) && taskDialogDirty) {
      if (!confirmTaskDiscard()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      allowCloseButtonOnce = true;
    }
  }, true);

  // Native dialog Escape emits cancel before the dialog closes, so it can be safely vetoed.
  document.addEventListener('cancel', event => {
    const dialog = taskDialog();
    if (event.target !== dialog || !dialog?.open || !taskDialogDirty) return;
    if (!confirmTaskDiscard()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('close', event => {
    if (event.target !== taskDialog()) return;
    taskDialogDirty = false;
    allowCloseButtonOnce = false;
  }, true);

  function start() {
    hideRemovedUi();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
