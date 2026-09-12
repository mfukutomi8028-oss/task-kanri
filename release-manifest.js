// Ver.201 のリリース正本。全配布資産と動的 loader はこの inventory を参照する。
// 初回描画では旧HTMLに残る過去アイコンや未補正UIを見せず、現行資産へ置換してから表示する。
(function installFirstPaintGuardV201() {
  'use strict';

  const VERSION = '201';
  const root = document.documentElement;
  const bootClass = 'wb-first-paint-v201';
  const legacyIconMap = new Map([
    ['assets/brand.png', 'assets/brand-v184.svg'],
    ['assets/nav-today-v87.png', 'assets/nav-today-v169.svg'],
    ['assets/nav-todo-v142.svg', 'assets/nav-todo-v168.svg'],
    ['assets/nav-task-v87.png', 'assets/nav-task-v169.svg'],
    ['assets/nav-schedule-v87.png', 'assets/nav-schedule-v169.svg'],
    ['assets/nav-memo-v167.svg', 'assets/nav-memo-v168.svg'],
    ['assets/summary-mine.png', 'assets/nav-mine-v169.svg'],
    ['assets/nav-star-menu.png', 'assets/nav-star-v169.svg'],
    ['assets/nav-done.png', 'assets/nav-done-v169.svg'],
    ['assets/summary-open.png', 'assets/summary-open-v169.svg'],
    ['assets/summary-overdue.png', 'assets/summary-overdue-v169.svg'],
    ['assets/summary-today.png', 'assets/nav-today-v169.svg']
  ]);

  root.classList.add(bootClass);

  const guardStyle = document.createElement('style');
  guardStyle.id = 'wb-first-paint-style-v201';
  guardStyle.textContent = `
    html.${bootClass} { background: #eef7fb; }
    html.${bootClass} body { visibility: hidden !important; }
  `;
  (document.head || root).appendChild(guardStyle);

  function assetKey(value) {
    const raw = String(value || '').split('?')[0].replace(/\\/g, '/');
    const index = raw.lastIndexOf('assets/');
    return index >= 0 ? raw.slice(index) : raw.replace(/^\.\//, '');
  }

  function upgradeImage(img) {
    if (!img || img.nodeType !== 1 || String(img.tagName).toLowerCase() !== 'img') return;
    const replacement = legacyIconMap.get(assetKey(img.getAttribute('src')));
    if (!replacement) return;
    const next = `${replacement}?v=${VERSION}`;
    if (img.getAttribute('src') !== next) img.setAttribute('src', next);
  }

  function patchNode(node) {
    if (!node || node.nodeType !== 1) return;
    if (String(node.tagName).toLowerCase() === 'img') upgradeImage(node);
    node.querySelectorAll?.('img').forEach(upgradeImage);
  }

  const iconObserver = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(patchNode));
  });
  iconObserver.observe(root, { childList: true, subtree: true });
  window.__WB_LEGACY_ICON_OBSERVER_V201__ = iconObserver;

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('img').forEach(upgradeImage);
    document.querySelectorAll('.app-version, .workboard-version-display').forEach(node => {
      node.textContent = `Ver.${VERSION}`;
    });
  }, { once: true });

  let revealed = false;
  function revealCurrentUi() {
    if (revealed) return;
    revealed = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.classList.remove(bootClass);
      guardStyle.remove();
      root.dataset.firstPaintVersion = VERSION;
    }));
  }

  // 動的CSS/JSが現行リリースまで読み終わった時点を第一の表示条件にする。
  // loaderが失敗しても永久に非表示にならないよう、4秒のフェイルセーフは維持する。
  if (window.WORK_BOARD_ASSETS_READY) revealCurrentUi();
  else window.addEventListener('workboard:assets-ready', revealCurrentUi, { once: true });

  window.setTimeout(revealCurrentUi, 4000);
})();

window.WORK_BOARD_RELEASE = Object.freeze({
  version: "201",
  requiredAssets: [
    "index.html", "style.css", "todo-ui-v142.css", "ui-todo-light-v189.css", "ui-task-light-v189.css", "ui-schedule-mobile-v189.css", "ui-workflow-insights-v192.css", "ui-task-prerequisites-comments-v192.css", "ui-task-relations-reminders-v192.css", "ui-task-detail-responsive-v192.css", "ui-workflow-detail-v186.css", "ui-inbox-archive-v186.css", "ui-task-detail-tools-v192.css", "ui-comment-mentions-v191.css", "ui-sidebar-v180.css", "ui-task-toolbar-v179.css", "ui-comment-reactions-v191.css", "ui-work-memo-v190.css", "ui-reserved-task-v190.css", "ui-icon-system-v178.css", "ui-core-density-v188.css", "ui-brand-v185.css", "mine-icon-fix-v121.css", "app.js", "todo-sync-v136.js", "task-delete-v134.js", "todo-controls-v144.js", "todo-tools-v145.js", "todo-history-v146.js", "task-ux-v146.js", "todo-preview-v147.js", "workflow-core-v150.js", "workflow-v152.js", "dependencies-v149.js", "saved-views-v148.js", "insights-v148.js", "comments-tabs-v149.js", "completion-unpin-v150.js", "relationships-v152.js", "reminders-v152.js", "inbox-ui-v183.js", "inbox-events-v183.js", "archive-ui-v182.js", "duplicate-merge-v182.js", "detail-layout-v154.js", "user-registration-v191.js", "comment-mentions-v191.js", "comment-reactions-v191.js", "work-features-v167.js", "work-features-ui-v190.js", "icon-system-v169.js", "bulk-actions-v174.js", "core-view-density-v188.js", "brand-v185.js", "desktop-sidebar-v181.js", "config.js", "release-manifest.js",
    "ui-activity-dialog-v193.css", "ui-task-list-sort-v193.css", "stable-fixes-v108.js", "date-keyboard-fix-v127.js",
    "schedule-today-lock-v129.js", "list-sort-v131.js", "version-display-lock.js",
    "assets/brand.png", "assets/brand-v184.png", "assets/brand-v184.svg", "assets/nav-todo-v168.svg", "assets/nav-memo-v168.svg",
    "assets/nav-today-v169.svg", "assets/nav-task-v169.svg", "assets/nav-schedule-v169.svg", "assets/nav-mine-v169.svg", "assets/nav-star-v169.svg", "assets/nav-done-v169.svg", "assets/summary-open-v169.svg", "assets/summary-overdue-v169.svg"
  ],
  optionalAssets: ["mobile-fixes.js"],
  dynamicStyles: ["ui-activity-dialog-v193.css", "ui-task-list-sort-v193.css", "ui-todo-light-v189.css", "ui-task-light-v189.css", "ui-schedule-mobile-v189.css", "ui-workflow-insights-v192.css", "ui-task-prerequisites-comments-v192.css", "ui-task-relations-reminders-v192.css", "ui-task-detail-responsive-v192.css", "ui-workflow-detail-v186.css", "ui-inbox-archive-v186.css", "ui-task-detail-tools-v192.css", "ui-comment-mentions-v191.css", "ui-sidebar-v180.css", "ui-task-toolbar-v179.css", "ui-comment-reactions-v191.css", "ui-work-memo-v190.css", "ui-reserved-task-v190.css", "ui-icon-system-v178.css", "ui-core-density-v188.css", "ui-brand-v185.css"],
  dynamicScripts: ["brand-v185.js", "desktop-sidebar-v181.js", "stable-fixes-v108.js", "date-keyboard-fix-v127.js", "schedule-today-lock-v129.js", "list-sort-v131.js", "version-display-lock.js", "todo-controls-v144.js", "todo-tools-v145.js", "todo-history-v146.js", "task-ux-v146.js", "todo-preview-v147.js", "workflow-core-v150.js", "workflow-v152.js", "dependencies-v149.js", "saved-views-v148.js", "insights-v148.js", "comments-tabs-v149.js", "completion-unpin-v150.js", "relationships-v152.js", "reminders-v152.js", "inbox-ui-v183.js", "inbox-events-v183.js", "archive-ui-v182.js", "duplicate-merge-v182.js", "detail-layout-v154.js", "user-registration-v191.js", "comment-mentions-v191.js", "comment-reactions-v191.js", "work-features-v167.js", "work-features-ui-v190.js", "icon-system-v169.js", "bulk-actions-v174.js", "core-view-density-v188.js"],
  mobileScripts: ["mobile-fixes.js"]
});
window.WORK_BOARD_RELEASE_VERSION = window.WORK_BOARD_RELEASE.version;
window.WORK_BOARD_VERSION = window.WORK_BOARD_RELEASE.version;