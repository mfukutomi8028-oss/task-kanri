// Ver.237: semantic favorite terminology + retired control cleanup.
(function installFavoriteUiV237() {
  'use strict';

  let patchScheduled = false;

  function retireRemovedControls() {
    // Keep the favorite checkbox as the existing filter state hook, but remove it
    // from the visible sidebar because the left navigation is the canonical entry.
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

    // Cache clear was retired from the product UI. The underlying app guard remains
    // harmless when these optional elements are absent.
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

  function runPatch() {
    patchScheduled = false;
    retireRemovedControls();
    patchFavoriteLabels(document);
    patchFavoriteToast();
  }

  function schedulePatch() {
    if (patchScheduled) return;
    patchScheduled = true;
    requestAnimationFrame(runPatch);
  }

  function installObservers() {
    [
      document.querySelector('.sidebar'),
      document.getElementById('mainContent'),
      document.getElementById('detailBody')
    ].filter(Boolean).forEach(root => {
      new MutationObserver(records => {
        if (records.some(record => record.addedNodes.length || record.removedNodes.length)) schedulePatch();
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

  document.addEventListener('click', event => {
    if (event.target?.closest?.('[data-star-task], [data-action="favorite"], .nav-item[data-filter="favorite"]')) {
      schedulePatch();
    }
  }, true);

  function start() {
    runPatch();
    installObservers();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
