// Ver.183 のリリース正本。全配布資産と動的 loader はこの inventory を参照する。
// 初回描画では旧HTMLに残る過去アイコンや未補正UIを見せず、現行資産へ置換してから表示する。
(function installFirstPaintGuardV183() {
  'use strict';

  const VERSION = '183';
  const root = document.documentElement;
  const bootClass = 'wb-first-paint-v183';
  const legacyIconMap = new Map([
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
  guardStyle.id = 'wb-first-paint-style-v183';
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
  window.__WB_LEGACY_ICON_OBSERVER_V183__ = iconObserver;

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
  version: "183",
  requiredAssets: [
    "index.html", "style.css", "todo-ui-v142.css", "ui-v144.css", "ui-v145.css", "ui-v146.css", "ui-v147.css", "ui-v148.css", "ui-v149.css", "ui-v150.css", "ui-v151.css", "ui-v152.css", "ui-v153.css", "ui-v154.css", "ui-v156.css", "ui-v157.css", "ui-sidebar-v180.css", "ui-task-toolbar-v179.css", "ui-v165.css", "ui-v167.css", "ui-v168.css", "ui-icon-system-v178.css", "ui-v173.css", "ui-v176.css", "mine-icon-fix-v121.css", "app.js", "todo-sync-v136.js", "task-delete-v134.js", "todo-controls-v144.js", "todo-tools-v145.js", "todo-history-v146.js", "task-ux-v146.js", "todo-preview-v147.js", "workflow-core-v150.js", "workflow-v152.js", "dependencies-v149.js", "saved-views-v148.js", "insights-v148.js", "comments-tabs-v149.js", "completion-unpin-v150.js", "relationships-v152.js", "reminders-v152.js", "inbox-ui-v183.js", "inbox-events-v183.js", "archive-ui-v182.js", "duplicate-merge-v182.js", "detail-layout-v154.js", "user-add-fix-v155.js", "mention-picker-v156.js", "comment-reactions-v165.js", "work-features-v167.js", "work-features-ui-v168.js", "icon-system-v169.js", "bulk-actions-v174.js", "workspace-density-v176.js", "desktop-sidebar-v181.js", "config.js", "release-manifest.js",
    "activity-dialog-v130.css", "list-sort-v131.css", "stable-fixes-v108.js", "date-keyboard-fix-v127.js",
    "schedule-today-lock-v129.js", "list-sort-v131.js", "version-display-lock.js",
    "assets/brand.png", "assets/nav-todo-v168.svg", "assets/nav-memo-v168.svg",
    "assets/nav-today-v169.svg", "assets/nav-task-v169.svg", "assets/nav-schedule-v169.svg", "assets/nav-mine-v169.svg", "assets/nav-star-v169.svg", "assets/nav-done-v169.svg", "assets/summary-open-v169.svg", "assets/summary-overdue-v169.svg"
  ],
  optionalAssets: ["mobile-fixes.js"],
  dynamicStyles: ["activity-dialog-v130.css", "list-sort-v131.css", "ui-v144.css", "ui-v145.css", "ui-v146.css", "ui-v147.css", "ui-v148.css", "ui-v149.css", "ui-v150.css", "ui-v151.css", "ui-v152.css", "ui-v153.css", "ui-v154.css", "ui-v156.css", "ui-v157.css", "ui-sidebar-v180.css", "ui-task-toolbar-v179.css", "ui-v165.css", "ui-v167.css", "ui-v168.css", "ui-icon-system-v178.css", "ui-v173.css", "ui-v176.css"],
  dynamicScripts: ["desktop-sidebar-v181.js", "stable-fixes-v108.js", "date-keyboard-fix-v127.js", "schedule-today-lock-v129.js", "list-sort-v131.js", "version-display-lock.js", "todo-controls-v144.js", "todo-tools-v145.js", "todo-history-v146.js", "task-ux-v146.js", "todo-preview-v147.js", "workflow-core-v150.js", "workflow-v152.js", "dependencies-v149.js", "saved-views-v148.js", "insights-v148.js", "comments-tabs-v149.js", "completion-unpin-v150.js", "relationships-v152.js", "reminders-v152.js", "inbox-ui-v183.js", "inbox-events-v183.js", "archive-ui-v182.js", "duplicate-merge-v182.js", "detail-layout-v154.js", "user-add-fix-v155.js", "mention-picker-v156.js", "comment-reactions-v165.js", "work-features-v167.js", "work-features-ui-v168.js", "icon-system-v169.js", "bulk-actions-v174.js", "workspace-density-v176.js"],
  mobileScripts: ["mobile-fixes.js"]
});
window.WORK_BOARD_RELEASE_VERSION = window.WORK_BOARD_RELEASE.version;
window.WORK_BOARD_VERSION = window.WORK_BOARD_RELEASE.version;
