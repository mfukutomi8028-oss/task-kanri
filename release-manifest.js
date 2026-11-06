// Ver.304 のリリース正本。全配布資産と動的 loader はこの inventory を参照する。
// 初回描画では旧HTMLに残る過去アイコンや未補正UIを見せず、現行資産へ置換してから表示する。
(function installFirstPaintGuardV304() {
  'use strict';

  const VERSION = '448';
  const root = document.documentElement;
  // Restore the same per-room/user display preference before initial paint.
  const displayPrefix = 'workBoardDisplayV356:';
  const validModes = new Set(['classic','modern','palette','journal']);
  function storageKey() {
    let room = '', user = '';
    try {
      room = new URLSearchParams(location.search).get('room') || localStorage.getItem('systemTaskRoomId') || 'default';
      user = localStorage.getItem('systemTaskUser') || '';
    } catch { room = 'default'; }
    room = String(room).replace(/[.#$/\[\]]/g, '-').slice(0, 60);
    return displayPrefix + encodeURIComponent(room) + ':' + encodeURIComponent(String(user));
  }
  function savedMode() {
    try { const mode = localStorage.getItem(storageKey()); return validModes.has(mode) ? mode : 'classic'; }
    catch { return 'classic'; }
  }
  root.dataset.wbDisplay = savedMode();
  window.WorkBoardStartup = Object.freeze({storageKey, readMode: savedMode});
  const bootClass = 'wb-first-paint-v304';
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
  guardStyle.id = 'wb-first-paint-style-v304';
  guardStyle.textContent = `
    html.${bootClass} { background: #eef7fb; }
html.${bootClass} body { visibility: hidden !important; }
    html.${bootClass} #wbBootScreen {
      visibility: visible !important; display: grid !important; place-items: center;
      position: fixed; inset: 0; z-index: 2147483646; padding: 24px;
      box-sizing: border-box; background: #f7f9fb; color: #324358;
      font-family: -apple-system, BlinkMacSystemFont, "Noto Sans JP", "Yu Gothic", Meiryo, sans-serif;
    }
    html.${bootClass} #wbBootScreen .wb-boot-content {
      display: grid; justify-items: center; gap: 12px; text-align: center;
      max-width: 340px; line-height: 1.55; font-size: 14px;
    }
    html.${bootClass} #wbBootScreen .wb-boot-mark {
      width: 34px; height: 34px; border: 3px solid #dce5ed; border-top-color: #6089aa;
      border-radius: 50%; animation: wb-boot-spin 0.9s linear infinite;
    }
    html.${bootClass} #wbBootScreen strong { font-size: 19px; font-weight: 700; }
    html.${bootClass} #wbBootScreen p { margin: 0; color: #66798c; }
    html.${bootClass} #wbBootRetry:not([hidden]) {
      display: inline-flex; padding: 8px 17px; border-radius: 8px;
      border: 1px solid #b9c7d4; color: #344961; background: white; cursor: pointer;
    }
    @keyframes wb-boot-spin { to { transform: rotate(360deg); } }
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
  window.__WB_LEGACY_ICON_OBSERVER_V304__ = iconObserver;

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('img').forEach(upgradeImage);
    document.getElementById('wbBootRetry')?.addEventListener('click', () => location.reload());
  }, { once: true });

  let compatibilityFinalized = false;
  function finalizeLegacyIconCompatibility() {
    if (compatibilityFinalized) return;
    document.querySelectorAll('img').forEach(upgradeImage);
    iconObserver.disconnect();
    compatibilityFinalized = true;
  }

  let revealed = false;
  let assetsReady = Boolean(window.WORK_BOARD_ASSETS_READY);
  let coreReady = Boolean(window.WORK_BOARD_CORE_READY);
  let stallTimer = 0;
  function selectedDisplayReady() {
    const mode = root.dataset.wbDisplay || 'classic';
    if (mode === 'journal') return Boolean(document.getElementById('wbJournalHeaderV367'));
    if (mode === 'modern') return root.dataset.modernOriginReady === 'true'
      && Boolean(document.getElementById('modernOriginRoot'));
    if (mode === 'palette') return (root.dataset.wbPaletteNextPreview === 'true'
      && Boolean(document.getElementById('paletteNextRoot')))
      || root.dataset.wbPaletteNextFallback === 'true';
    return mode === 'classic';
  }
  function revealCurrentUi() {
    if (revealed || !assetsReady || !coreReady || !selectedDisplayReady()) return;
    revealed = true;
    window.clearTimeout(stallTimer);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.classList.remove(bootClass);
      guardStyle.remove();
      root.dataset.firstPaintVersion = VERSION;
    }));
  }
  function handleAssetsReady() {
    assetsReady = true;
    finalizeLegacyIconCompatibility();
    revealCurrentUi();
  }
  function handleCoreReady() { coreReady = true; revealCurrentUi(); }
  if (window.WORK_BOARD_ASSETS_READY) handleAssetsReady();
  else window.addEventListener('workboard:assets-ready', handleAssetsReady, { once: true });
  if (window.WORK_BOARD_CORE_READY) handleCoreReady();
  else window.addEventListener('workboard:core-ready', handleCoreReady, { once: true });
  window.addEventListener('workboard:display-ready', revealCurrentUi);
  // Never expose an incomplete Classic page on timeout; show a retry control.
  stallTimer = window.setTimeout(() => {
    if (revealed) return;
    const message = document.getElementById('wbBootMessage');
    if (message) message.textContent = '読み込みに時間がかかっています。通信状態をご確認ください。';
    const retry = document.getElementById('wbBootRetry');
    if (retry) retry.hidden = false;
  }, 18000);
})();

window.WORK_BOARD_RELEASE = Object.freeze({
  version: "448",
  requiredAssets: [
    "index.html", "style.css", "color-themes-v329.css", "color-themes-v329.js", "modern-display-v356.css", "modern-display-v356.js", "origin-modern-v372.js", "palette-display-v358.css", "palette-display-v358.js", "journal-display-v367.css", "journal-display-v367.js", "todo-ui-v142.css", "ui-todo-light-v189.css", "ui-task-light-v189.css", "ui-schedule-mobile-v189.css", "ui-schedule-copy-v225.css", "ui-workflow-insights-v192.css", "ui-task-prerequisites-comments-v192.css", "ui-task-relations-reminders-v192.css", "ui-task-detail-responsive-v192.css", "ui-workflow-detail-v186.css", "ui-inbox-archive-v186.css", "ui-task-detail-tools-v192.css", "ui-comment-mentions-v191.css", "ui-sidebar-v180.css", "ui-task-toolbar-v179.css", "ui-comment-reactions-v191.css", "ui-work-memo-v190.css", "ui-reserved-task-v190.css", "ui-icon-system-v178.css", "ui-core-density-v188.css", "ui-brand-v185.css", "mine-icon-fix-v121.css", "ui-motion-v533.css", "app.js", "workspace-core-v537.js", "workspace-write-v538.js", "todo-sync-v136.js", "task-delete-v134.js", "recurrence-series-v354.js", "todo-controls-v144.js", "todo-tools-v145.js", "todo-history-v146.js", "dialog-lifecycle-v239.js", "todo-preview-v147.js", "workflow-core-v150.js", "workspace-archive-v540.js", "workspace-reminder-v541.js", "workspace-inbox-read-v542.js", "workspace-inbox-event-v543.js", "workspace-duplicate-meta-v545.js", "workflow-v152.js", "dependencies-v149.js", "saved-views-v148.js", "list-column-sort-v229.js", "insights-v148.js", "comments-tabs-v149.js", "completion-unpin-v150.js", "relationships-v152.js", "reminders-v152.js", "inbox-ui-v183.js", "inbox-events-v183.js", "archive-ui-v182.js", "workspace-duplicate-atomic-v544.js", "workspace-duplicate-cleanup-v546.js", "duplicate-merge-v182.js", "detail-layout-v154.js", "user-registration-v191.js", "comment-mentions-v191.js", "comment-reactions-v191.js", "workspace-memo-v539.js", "workspace-start-date-v548.js", "work-features-v167.js", "work-features-ui-v190.js", "icon-system-v169.js", "workspace-bulk-update-v547.js", "bulk-actions-v243.js", "favorite-ui-v237.js", "brand-v185.js", "desktop-sidebar-v242.js", "config.js", "release-manifest.js",
    "ui-activity-dialog-v193.css", "ui-task-list-sort-v193.css", "ui-date-segment-controls-v230.css", "ui-version-display-v232.css", "ui-mobile-shell-v234.css", "date-segment-controls-v230.js",
    "assets/brand.png", "assets/brand-v184.png", "assets/brand-v184.svg", "assets/notification-brand-v319.svg", "assets/nav-todo-v168.svg", "assets/nav-memo-v168.svg",
    "assets/nav-today-v169.svg", "assets/nav-task-v169.svg", "assets/nav-schedule-v169.svg", "assets/nav-mine-v169.svg", "assets/nav-star-v169.svg", "assets/nav-done-v169.svg", "assets/summary-open-v169.svg", "assets/summary-overdue-v169.svg", "assets/journal-bookmark-seal-v440.svg", "assets/journal-atelier-cards-v441.svg", "assets/journal-todo-stationery-v442.svg", "assets/journal-schedule-botanical-v442.svg", "assets/journal-memo-linen-v442.svg"
  ],
  optionalAssets: ["mobile-shell-v234.js", "palette-next-v369.css", "palette-next-v369.js"],
  dynamicStyles: ["ui-activity-dialog-v193.css", "ui-task-list-sort-v193.css", "ui-date-segment-controls-v230.css", "ui-version-display-v232.css", "ui-todo-light-v189.css", "ui-task-light-v189.css", "ui-schedule-mobile-v189.css", "ui-schedule-copy-v225.css", "ui-workflow-insights-v192.css", "ui-task-prerequisites-comments-v192.css", "ui-task-relations-reminders-v192.css", "ui-task-detail-responsive-v192.css", "ui-workflow-detail-v186.css", "ui-inbox-archive-v186.css", "ui-task-detail-tools-v192.css", "ui-comment-mentions-v191.css", "ui-sidebar-v180.css", "ui-task-toolbar-v179.css", "ui-comment-reactions-v191.css", "ui-work-memo-v190.css", "ui-reserved-task-v190.css", "ui-icon-system-v178.css", "ui-core-density-v188.css", "ui-brand-v185.css", "color-themes-v329.css", "modern-display-v356.css", "palette-display-v358.css", "journal-display-v367.css", "ui-motion-v533.css", "ui-mobile-shell-v234.css"],
  dynamicScripts: ["brand-v185.js", "desktop-sidebar-v242.js", "date-segment-controls-v230.js", "todo-controls-v144.js", "todo-tools-v145.js", "todo-history-v146.js", "dialog-lifecycle-v239.js", "todo-preview-v147.js", "workflow-core-v150.js", "workspace-archive-v540.js", "workspace-reminder-v541.js", "workspace-inbox-read-v542.js", "workspace-inbox-event-v543.js", "workspace-duplicate-meta-v545.js", "workflow-v152.js", "dependencies-v149.js", "saved-views-v148.js", "list-column-sort-v229.js", "insights-v148.js", "comments-tabs-v149.js", "completion-unpin-v150.js", "relationships-v152.js", "reminders-v152.js", "inbox-ui-v183.js", "inbox-events-v183.js", "archive-ui-v182.js", "workspace-duplicate-atomic-v544.js", "workspace-duplicate-cleanup-v546.js", "duplicate-merge-v182.js", "detail-layout-v154.js", "user-registration-v191.js", "comment-mentions-v191.js", "comment-reactions-v191.js", "workspace-memo-v539.js", "workspace-start-date-v548.js", "work-features-v167.js", "work-features-ui-v190.js", "icon-system-v169.js", "workspace-bulk-update-v547.js", "bulk-actions-v243.js", "favorite-ui-v237.js", "origin-modern-v372.js", "color-themes-v329.js", "modern-display-v356.js", "palette-display-v358.js", "journal-display-v367.js"],
  mobileScripts: ["mobile-shell-v234.js"]
});
window.WORK_BOARD_RELEASE_VERSION = window.WORK_BOARD_RELEASE.version;
window.WORK_BOARD_VERSION = window.WORK_BOARD_RELEASE.version;
