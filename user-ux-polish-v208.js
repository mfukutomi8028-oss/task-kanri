// Ver.217: user-requested UX polish without changing the underlying favorite, pin, cache, or inbox data models.
(function installUserUxPolishV208() {
  'use strict';

  const DISCARD_MESSAGE = '入力内容が変更されています。保存せずに閉じますか？';
  let taskDialogDirty = false;
  let allowCloseButtonOnce = false;
  let favoritePatchScheduled = false;

  function hideRemovedUi() {
    // Keep the internal favorite checkbox so the left navigation favorite filter and saved views continue to work.
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

  function setTrailingText(node, text) {
    if (!node) return;
    const target = [...node.childNodes].find(child => child.nodeType === 3 && String(child.textContent || '').trim());
    if (target) {
      if (target.textContent !== text) target.textContent = text;
      return;
    }
    node.append(document.createTextNode(text));
  }

  function collect(root, selector) {
    if (!root) return [];
    const nodes = [];
    if (root.nodeType === 1 && root.matches?.(selector)) nodes.push(root);
    root.querySelectorAll?.(selector).forEach(node => nodes.push(node));
    return nodes;
  }

  function patchFavoriteLabels(root = document) {
    collect(root, '.nav-item[data-filter="favorite"]').forEach(button => {
      setTrailingText(button, 'お気に入り');
    });

    const favorite = document.getElementById('favoriteOnly');
    const favoriteRow = favorite?.closest?.('label.check-row');
    if (favoriteRow) setTrailingText(favoriteRow, 'お気に入りのみ');

    collect(root, '.detail-favorite-button[data-action="favorite"]').forEach(button => {
      const active = button.classList.contains('starred');
      const text = active ? 'お気に入り解除' : 'お気に入り';
      const label = active ? 'お気に入りを解除' : 'お気に入りに追加';
      if (button.textContent !== text) button.textContent = text;
      if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
      if (button.getAttribute('title') !== label) button.setAttribute('title', label);
    });

    collect(root, '.favorite-button[data-star-task]').forEach(button => {
      const active = button.classList.contains('starred') || button.getAttribute('aria-pressed') === 'true';
      const label = active ? 'お気に入りを解除' : 'お気に入りに追加';
      if (button.getAttribute('title') !== label) button.setAttribute('title', label);
      if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
    });
  }

  function patchFavoriteToast() {
    const toast = document.getElementById('toast');
    if (!toast) return;
    const current = String(toast.textContent || '');
    const next = current
      .replace('スターを付けました', 'お気に入りに追加しました')
      .replace('スターを外しました', 'お気に入りから外しました');
    if (next !== current) toast.textContent = next;
  }

  function runFavoritePatch() {
    favoritePatchScheduled = false;
    patchFavoriteLabels(document);
    patchFavoriteToast();
  }

  function scheduleFavoritePatch() {
    if (favoritePatchScheduled) return;
    favoritePatchScheduled = true;
    requestAnimationFrame(runFavoritePatch);
  }

  function installFavoriteObservers() {
    const roots = [
      document.querySelector('.sidebar'),
      document.getElementById('mainContent'),
      document.getElementById('detailBody')
    ].filter(Boolean);

    roots.forEach(root => {
      new MutationObserver(records => {
        if (records.some(record => record.addedNodes.length || record.removedNodes.length)) scheduleFavoritePatch();
      }).observe(root, { childList: true, subtree: true });
    });

    const toast = document.getElementById('toast');
    if (toast) {
      new MutationObserver(patchFavoriteToast).observe(toast, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
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
    const favoriteControl = event.target?.closest?.('[data-star-task], [data-action="favorite"], .nav-item[data-filter="favorite"]');
    if (favoriteControl) scheduleFavoritePatch();

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
    patchFavoriteLabels(document);
    patchFavoriteToast();
    installFavoriteObservers();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
