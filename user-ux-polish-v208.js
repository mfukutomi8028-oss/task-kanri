// Ver.208: user-requested UX polish without changing the underlying star, pin, cache, or inbox data models.
(function installUserUxPolishV208() {
  'use strict';

  const DISCARD_MESSAGE = '入力内容が変更されています。保存せずに閉じますか？';
  const inboxBusy = new Set();
  let taskDialogDirty = false;
  let allowCloseButtonOnce = false;

  function hideRemovedUi() {
    // Keep the internal favorite checkbox so the left navigation Star filter and saved views continue to work.
    const favorite = document.getElementById('favoriteOnly');
    const favoriteRow = favorite?.closest?.('.check-row');
    if (favoriteRow) {
      favoriteRow.hidden = true;
      favoriteRow.setAttribute('aria-hidden', 'true');
    }

    // The cache-clear action is intentionally removed from the product UI.
    document.getElementById('roomCacheHelp')?.remove();
    document.getElementById('clearRoomCache')?.remove();
  }

  function stripQuickPinEmoji(root = document) {
    root.querySelectorAll?.('.detail-quick-pin-v154').forEach(button => {
      const current = button.textContent || '';
      const next = current.replace(/^\s*📌\s*/, '');
      if (next !== current) button.textContent = next;
    });
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

  // Use one stable delegated handler for per-item read/unread. The inbox list is re-rendered frequently,
  // so binding handlers to transient buttons can lose clicks during a redraw.
  document.addEventListener('click', async event => {
    const button = event.target?.closest?.('[data-inbox-read-v153]');
    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const workflow = window.WorkBoardWorkflowV152;
    const id = String(button.dataset.inboxReadV153 || '');
    if (!workflow?.markInboxRead || !id || inboxBusy.has(id)) return;

    const item = (workflow.inboxFor?.() || {})[id];
    if (!item) {
      workflow.notify?.('通知の既読状態を更新できませんでした。', true);
      return;
    }

    inboxBusy.add(id);
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
      const result = await workflow.markInboxRead(id, !Boolean(item.readAt));
      if (!result?.ok) workflow.notify?.('通知の既読状態を更新できませんでした。通信状態を確認してください。', true);
    } catch (error) {
      console.warn('Ver.208 inbox read toggle failed', error);
      workflow.notify?.('通知の既読状態を更新できませんでした。', true);
    } finally {
      inboxBusy.delete(id);
      window.dispatchEvent(new CustomEvent('workflow-v152-update'));
    }
  }, true);

  function start() {
    hideRemovedUi();
    const detail = document.getElementById('detailBody');
    if (detail) {
      new MutationObserver(() => stripQuickPinEmoji(detail)).observe(detail, { childList: true, subtree: true });
      stripQuickPinEmoji(detail);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
