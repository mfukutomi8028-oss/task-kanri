// Ver.169: unify navigation and task summary icons around the Ver.168 ToDo/business-memo visual language.
(function installIconSystemV169() {
  'use strict';

  const VERSION = '169';
  const asset = name => `assets/${name}?v=${VERSION}`;

  const NAV_ICONS = [
    ['.nav-item[data-layout="today"] .nav-icon img', 'nav-today-v169.svg'],
    ['.nav-item[data-layout="todos"] .nav-icon img', 'nav-todo-v168.svg'],
    ['.nav-item[data-layout="tasks"] .nav-icon img', 'nav-task-v169.svg'],
    ['.nav-item[data-layout="schedule"] .nav-icon img', 'nav-schedule-v169.svg'],
    ['.nav-item[data-filter="mine"] .nav-icon img', 'nav-mine-v169.svg'],
    ['.nav-item[data-filter="favorite"] .nav-icon img', 'nav-star-v169.svg'],
    ['.nav-item[data-filter="done"] .nav-icon img', 'nav-done-v169.svg'],
    ['.work-memo-nav-v167 .nav-icon img', 'nav-memo-v168.svg']
  ];

  const SUMMARY_ICONS = [
    ['openCount', 'summary-open-v169.svg'],
    ['overdueCount', 'summary-overdue-v169.svg'],
    ['todayCount', 'nav-today-v169.svg'],
    ['myCount', 'nav-mine-v169.svg']
  ];

  function replaceSource(img, file) {
    if (!img) return;
    const next = asset(file);
    if (!img.getAttribute('src')?.includes(file)) img.setAttribute('src', next);
    img.setAttribute('draggable', 'false');
  }

  function applyIcons() {
    NAV_ICONS.forEach(([selector, file]) => replaceSource(document.querySelector(selector), file));
    SUMMARY_ICONS.forEach(([countId, file]) => {
      const card = document.getElementById(countId)?.closest('.summary-card');
      replaceSource(card?.querySelector('.summary-icon img'), file);
    });
  }

  function start() {
    applyIcons();
    let attempts = 0;
    const timer = window.setInterval(() => {
      applyIcons();
      attempts += 1;
      if (attempts >= 24) window.clearInterval(timer);
    }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
