// Ver.319: targeted user-reported stability and task-editor usability fixes.
(function installUserReportedStabilityV319() {
  'use strict';

  const VERSION = '319';
  const FUTURE_HIDDEN_CLASS = 'future-task-v167-hidden';
  const NOTIFICATION_ICON = `assets/notification-brand-v319.svg?v=${VERSION}`;
  const knownFutureTaskIds = new Set();
  let boardObserver = null;
  let taskDialogObserver = null;
  let detailHome = null;
  let detailNextSibling = null;

  function resolveNativeNotification(current) {
    const ctor = current?.prototype?.constructor;
    return typeof ctor === 'function' && ctor !== current ? ctor : current;
  }

  function patchNotificationIcon() {
    if (!('Notification' in window)) return;
    const current = window.Notification;
    if (!current || current.__workBoardNotificationSafeVersion === VERSION) return;

    const NativeNotification = resolveNativeNotification(current);
    if (typeof NativeNotification !== 'function') return;

    function WorkBoardSafeNotification(title, options) {
      const nextOptions = options && typeof options === 'object'
        ? { ...options, icon: NOTIFICATION_ICON }
        : { icon: NOTIFICATION_ICON };
      return new NativeNotification(title, nextOptions);
    }

    const requestPermission = NativeNotification.requestPermission || current.requestPermission;
    if (typeof requestPermission === 'function') {
      WorkBoardSafeNotification.requestPermission = requestPermission.bind(NativeNotification);
    }

    Object.defineProperty(WorkBoardSafeNotification, 'permission', {
      configurable: true,
      get() {
        return NativeNotification.permission ?? current.permission;
      }
    });
    WorkBoardSafeNotification.prototype = NativeNotification.prototype;

    // Preserve the existing brand marker so brand-v185 does not re-wrap this
    // notification constructor on BFCache restoration and restore the cropped icon.
    if (current.__workBoardBrandVersion) {
      Object.defineProperty(WorkBoardSafeNotification, '__workBoardBrandVersion', {
        value: current.__workBoardBrandVersion,
        configurable: false,
        enumerable: false
      });
    }
    Object.defineProperty(WorkBoardSafeNotification, '__workBoardNotificationSafeVersion', {
      value: VERSION,
      configurable: false,
      enumerable: false
    });
    window.Notification = WorkBoardSafeNotification;
  }

  function addHiddenTaskIdsFrom(root) {
    if (!(root instanceof Element)) return;
    const candidates = [];
    if (root.matches?.(`[data-task-id].${FUTURE_HIDDEN_CLASS}`)) candidates.push(root);
    root.querySelectorAll?.(`[data-task-id].${FUTURE_HIDDEN_CLASS}`).forEach(node => candidates.push(node));
    candidates.forEach(node => {
      const id = String(node.getAttribute('data-task-id') || '');
      if (id) knownFutureTaskIds.add(id);
    });
  }

  function syncHiddenTaskId(node) {
    if (!(node instanceof Element) || !node.matches?.('[data-task-id]')) return;
    const id = String(node.getAttribute('data-task-id') || '');
    if (!id) return;
    if (node.classList.contains(FUTURE_HIDDEN_CLASS)) knownFutureTaskIds.add(id);
    else knownFutureTaskIds.delete(id);
  }

  function reconcileBoardVisibleCounts() {
    const board = document.getElementById('boardView');
    if (!board) return;

    board.querySelectorAll('[data-task-id]').forEach(node => {
      const id = String(node.getAttribute('data-task-id') || '');
      if (!id || !knownFutureTaskIds.has(id) || node.classList.contains(FUTURE_HIDDEN_CLASS)) return;
      node.classList.add(FUTURE_HIDDEN_CLASS);
    });

    board.querySelectorAll('.board-column').forEach(column => {
      const visibleCount = [...column.querySelectorAll('.task-list > [data-task-id]')]
        .filter(node => !node.classList.contains(FUTURE_HIDDEN_CLASS)).length;
      const output = column.querySelector('.column-head em');
      const next = String(visibleCount);
      if (output && output.textContent !== next) output.textContent = next;
    });
  }

  function installBoardCountStabilizer() {
    const board = document.getElementById('boardView');
    if (!board || boardObserver) return;

    document.querySelectorAll(`[data-task-id].${FUTURE_HIDDEN_CLASS}`).forEach(node => addHiddenTaskIdsFrom(node));
    reconcileBoardVisibleCounts();

    boardObserver = new MutationObserver(records => {
      // Core board redraws replace complete columns. Capture future IDs from the
      // detached old columns first, then transfer the hidden state to new cards
      // in this MutationObserver microtask (before the next paint).
      records.forEach(record => {
        if (record.type === 'childList') {
          record.removedNodes.forEach(addHiddenTaskIdsFrom);
          record.addedNodes.forEach(addHiddenTaskIdsFrom);
        } else if (record.type === 'attributes') {
          syncHiddenTaskId(record.target);
        }
      });
      reconcileBoardVisibleCounts();
    });
    boardObserver.observe(board, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  function detailMatchesTask(taskId) {
    const detail = document.getElementById('detailBody');
    if (!detail || !taskId || detail.classList.contains('empty')) return false;
    const operationKey = detail.querySelector('[data-action="delete"]')?.dataset?.operationKey || '';
    return operationKey === `task-delete:${taskId}`;
  }

  function restoreDetailHome() {
    const detail = document.getElementById('detailBody');
    if (!detail || !detailHome || detail.parentNode === detailHome) return;
    if (detailNextSibling?.parentNode === detailHome) detailHome.insertBefore(detail, detailNextSibling);
    else detailHome.appendChild(detail);
  }

  function moveDetailIntoDialog(panel) {
    const detail = document.getElementById('detailBody');
    if (!detail || !panel || detail.parentNode === panel) return;
    panel.appendChild(detail);
  }

  function installTaskDialogTabs() {
    const dialog = document.getElementById('taskDialog');
    const form = document.getElementById('taskForm');
    if (!dialog || !form || dialog.dataset.viewEditTabsV319 === 'true') return;
    const head = form.querySelector(':scope > .dialog-head');
    const detail = document.getElementById('detailBody');
    if (!head || !detail) return;

    detailHome = detail.parentNode;
    detailNextSibling = detail.nextSibling;

    const tabs = document.createElement('div');
    tabs.className = 'task-dialog-view-tabs-v319';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'タスクの表示切替');
    tabs.innerHTML = `
      <button type="button" class="task-dialog-view-tab-v319" id="taskDialogDetailTabV319" data-task-dialog-tab-v319="detail" role="tab" aria-controls="taskDialogDetailPanelV319">詳細</button>
      <button type="button" class="task-dialog-view-tab-v319" id="taskDialogEditTabV319" data-task-dialog-tab-v319="edit" role="tab" aria-controls="taskForm">編集</button>`;

    const detailPanel = document.createElement('section');
    detailPanel.id = 'taskDialogDetailPanelV319';
    detailPanel.className = 'task-dialog-detail-panel-v319';
    detailPanel.setAttribute('role', 'tabpanel');
    detailPanel.setAttribute('aria-labelledby', 'taskDialogDetailTabV319');
    detailPanel.hidden = true;

    head.remove();
    dialog.prepend(head);
    head.insertAdjacentElement('afterend', tabs);
    tabs.insertAdjacentElement('afterend', detailPanel);
    form.classList.add('task-dialog-edit-panel-v319');
    form.setAttribute('role', 'tabpanel');
    form.setAttribute('aria-labelledby', 'taskDialogEditTabV319');
    dialog.classList.add('task-dialog-tabs-enabled-v319');
    dialog.dataset.viewEditTabsV319 = 'true';

    const detailTab = tabs.querySelector('[data-task-dialog-tab-v319="detail"]');
    const editTab = tabs.querySelector('[data-task-dialog-tab-v319="edit"]');

    function activate(name, focus = false) {
      const taskId = String(document.getElementById('taskId')?.value || '');
      const canShowDetail = Boolean(taskId && detailMatchesTask(taskId));
      const target = name === 'detail' && canShowDetail ? 'detail' : 'edit';
      const detailActive = target === 'detail';

      detailTab.hidden = !canShowDetail;
      detailTab.classList.toggle('active', detailActive);
      detailTab.setAttribute('aria-selected', detailActive ? 'true' : 'false');
      detailTab.tabIndex = detailActive ? 0 : -1;
      editTab.classList.toggle('active', !detailActive);
      editTab.setAttribute('aria-selected', detailActive ? 'false' : 'true');
      editTab.tabIndex = detailActive ? -1 : 0;
      detailPanel.hidden = !detailActive;
      form.hidden = detailActive;

      if (detailActive) moveDetailIntoDialog(detailPanel);
      if (focus) {
        if (detailActive) detailTab.focus();
        else (document.getElementById('taskTitle') || editTab).focus();
      }
    }

    tabs.addEventListener('click', event => {
      const button = event.target.closest?.('[data-task-dialog-tab-v319]');
      if (!button) return;
      activate(button.dataset.taskDialogTabV319, true);
    });

    tabs.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const available = [...tabs.querySelectorAll('[data-task-dialog-tab-v319]:not([hidden])')];
      const current = event.target.closest?.('[data-task-dialog-tab-v319]');
      const index = available.indexOf(current);
      if (index < 0 || !available.length) return;
      event.preventDefault();
      let next = index;
      if (event.key === 'ArrowLeft') next = (index - 1 + available.length) % available.length;
      if (event.key === 'ArrowRight') next = (index + 1) % available.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = available.length - 1;
      activate(available[next].dataset.taskDialogTabV319, true);
    });

    // The canonical detail renderer already owns the Edit action. When that same
    // detail DOM is shown inside this dialog, convert Edit into a tab switch so
    // openTaskDialog() is never invoked on an already-open <dialog>.
    detailPanel.addEventListener('click', event => {
      if (!event.target.closest?.('[data-action="edit"]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      activate('edit', true);
    }, true);

    function syncOpenState() {
      if (!dialog.open) {
        restoreDetailHome();
        return;
      }
      const taskId = String(document.getElementById('taskId')?.value || '');
      const existing = Boolean(taskId && detailMatchesTask(taskId));
      tabs.hidden = !existing;
      detailTab.hidden = !existing;
      activate('edit', false);
    }

    dialog.addEventListener('close', () => {
      restoreDetailHome();
      tabs.hidden = true;
      detailPanel.hidden = true;
      form.hidden = false;
    });
    taskDialogObserver = new MutationObserver(syncOpenState);
    taskDialogObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] });
    syncOpenState();
  }

  function start() {
    patchNotificationIcon();
    installBoardCountStabilizer();
    installTaskDialogTabs();
    document.documentElement.dataset.userReportedStabilityVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.addEventListener('pageshow', event => {
    if (event.persisted) patchNotificationIcon();
  });
})();
