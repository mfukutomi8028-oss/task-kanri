// Ver.220: keep Today/Schedule compact presentation, move schedule notification control to the sidebar, and keep observers feature-scoped.
(function installCoreViewDensityV188() {
  'use strict';

  const VERSION = '220';
  let patchQueued = false;
  let restoreScheduleFocus = null;

  function schedulePatch() {
    if (patchQueued) return;
    patchQueued = true;
    requestAnimationFrame(() => {
      patchQueued = false;
      patchAll();
    });
  }

  function ensureSidebarNotification(root) {
    const connection = document.getElementById('connectionPill');
    if (!connection) return;

    let host = document.getElementById('scheduleNotificationSidebarV220');
    if (!host) {
      host = document.createElement('div');
      host.id = 'scheduleNotificationSidebarV220';
      host.className = 'schedule-notification-sidebar-v220';
      host.setAttribute('aria-label', '予定通知');
      connection.insertAdjacentElement('afterend', host);
    } else if (connection.nextElementSibling !== host) {
      connection.insertAdjacentElement('afterend', host);
    }

    const source = root.querySelector('.activity-panel [data-enable-schedule-notifications], .activity-panel .notification-status');
    if (!source) return;
    if (host.firstElementChild !== source || host.childElementCount !== 1) host.replaceChildren(source);
  }

  function ensureTodayActionDivider(activityActions) {
    if (!activityActions) return;
    const scheduleAction = [...activityActions.querySelectorAll(':scope > .today-compact-action-v176')]
      .find(button => button.matches('[data-layout-jump="schedule"]')) || null;
    let divider = activityActions.querySelector(':scope > .today-action-divider-v220');

    if (!scheduleAction) {
      divider?.remove();
      return;
    }
    if (!divider) {
      divider = document.createElement('span');
      divider.className = 'today-action-divider-v220';
      divider.setAttribute('aria-hidden', 'true');
    }
    if (scheduleAction.previousElementSibling !== divider) activityActions.insertBefore(divider, scheduleAction);
  }

  function patchToday() {
    const root = document.getElementById('todayView');
    if (!root || root.hidden) return;

    const activityActions = root.querySelector('.activity-panel .activity-actions');
    ensureSidebarNotification(root);

    const redundant = root.querySelector('.today-head');
    if (redundant) {
      const actions = redundant.querySelector('.today-head-actions');
      if (actions && activityActions) {
        [...actions.children].forEach(button => {
          button.classList.add('today-compact-action-v176');
          activityActions.appendChild(button);
        });
      }
      redundant.remove();
    }

    ensureTodayActionDivider(activityActions);
  }

  function makeScheduleSearch() {
    const original = document.getElementById('searchInput');
    const box = document.createElement('label');
    box.className = 'schedule-search-v176';
    box.innerHTML = `
      <span aria-hidden="true">⌕</span>
      <input type="search" autocomplete="off" aria-label="予定を検索" placeholder="予定名・メモ・場所・分類で検索" />
    `;

    const input = box.querySelector('input');
    input.value = original?.value || '';

    input.addEventListener('input', () => {
      if (!original) return;
      restoreScheduleFocus = {
        start: input.selectionStart ?? input.value.length,
        end: input.selectionEnd ?? input.value.length
      };
      original.value = input.value;
      original.dispatchEvent(new Event('input', { bubbles: true }));
      schedulePatch();
    });

    input.addEventListener('search', () => {
      if (!original) return;
      original.value = input.value;
      original.dispatchEvent(new Event('input', { bubbles: true }));
      schedulePatch();
    });

    return box;
  }

  function controlGroupByLabel(actions, label) {
    return [...(actions?.querySelectorAll('.schedule-control-group') || [])]
      .find(group => group.querySelector(':scope > span')?.textContent?.trim() === label) || null;
  }

  function patchSchedule() {
    const root = document.getElementById('scheduleView');
    if (!root || root.hidden) return;

    const head = root.querySelector('.schedule-head');
    if (!head || head.dataset.denseV188 === VERSION) return;

    const titleBlock = head.querySelector('.schedule-title-block');
    const rangeLabel = titleBlock?.querySelector('.schedule-range-label');
    const actions = head.querySelector('.schedule-actions');
    if (!actions) return;

    const newButton = actions.querySelector('[data-new-schedule]');
    const period = controlGroupByLabel(actions, '表示期間');
    const move = controlGroupByLabel(actions, '表示日を移動');
    const mode = controlGroupByLabel(actions, '表示形式');

    const toolbar = document.createElement('div');
    toolbar.className = 'schedule-toolbar-v176';

    const controls = document.createElement('div');
    controls.className = 'schedule-toolbar-controls-v176';
    [newButton, period, move, mode].filter(Boolean).forEach(node => controls.appendChild(node));

    const utility = document.createElement('div');
    utility.className = 'schedule-toolbar-utility-v176';

    if (rangeLabel) {
      const date = document.createElement('div');
      date.className = 'schedule-date-v176';
      date.setAttribute('aria-label', '現在の表示日');
      date.appendChild(rangeLabel);
      utility.appendChild(date);
    }
    utility.appendChild(makeScheduleSearch());

    toolbar.append(controls, utility);
    head.replaceChildren(toolbar);
    head.dataset.denseV188 = VERSION;

    if (restoreScheduleFocus) {
      const selection = restoreScheduleFocus;
      restoreScheduleFocus = null;
      requestAnimationFrame(() => {
        const input = root.querySelector('.schedule-search-v176 input');
        if (!input) return;
        input.focus({ preventScroll: true });
        try { input.setSelectionRange(selection.start, selection.end); } catch (_) {}
      });
    }
  }

  function patchAll() {
    patchToday();
    patchSchedule();
  }

  function observeRoot(id) {
    const root = document.getElementById(id);
    if (!root) return null;
    const observer = new MutationObserver(mutations => {
      if (mutations.some(mutation =>
        mutation.type === 'childList' ||
        (mutation.type === 'attributes' && mutation.attributeName === 'hidden')
      )) schedulePatch();
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden']
    });
    return observer;
  }

  function start() {
    const todayObserver = observeRoot('todayView');
    const scheduleObserver = observeRoot('scheduleView');
    patchAll();

    window.__WB_CORE_VIEW_DENSITY_V188__ = Object.freeze({
      version: VERSION,
      patchAll,
      observers: Object.freeze({ today: todayObserver, schedule: scheduleObserver })
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
