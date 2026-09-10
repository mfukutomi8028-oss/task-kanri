// Ver.170 のリリース正本。全配布資産と動的 loader はこの inventory を参照する。
window.WORK_BOARD_RELEASE = Object.freeze({
  version: "170",
  requiredAssets: [
    "index.html", "style.css", "todo-ui-v142.css", "ui-v144.css", "ui-v145.css", "ui-v146.css", "ui-v147.css", "ui-v148.css", "ui-v149.css", "ui-v150.css", "ui-v151.css", "ui-v152.css", "ui-v153.css", "ui-v154.css", "ui-v156.css", "ui-v157.css", "ui-v158.css", "ui-v159.css", "ui-v160.css", "ui-v162.css", "ui-v163.css", "ui-v164.css", "ui-v165.css", "ui-v167.css", "ui-v168.css", "ui-v169.css", "ui-v170.css", "mine-icon-fix-v121.css", "app.js", "todo-sync-v136.js", "task-delete-v134.js", "todo-controls-v144.js", "todo-tools-v145.js", "todo-history-v146.js", "task-ux-v146.js", "todo-preview-v147.js", "workflow-core-v150.js", "workflow-v152.js", "dependencies-v149.js", "saved-views-v148.js", "insights-v148.js", "comments-tabs-v149.js", "completion-unpin-v150.js", "relationships-v152.js", "reminders-v152.js", "inbox-v153.js", "archive-duplicate-v153.js", "detail-layout-v154.js", "user-add-fix-v155.js", "mention-picker-v156.js", "comment-reactions-v165.js", "work-features-v167.js", "work-features-ui-v168.js", "icon-system-v169.js", "desktop-sidebar-v158.js", "desktop-sidebar-compat-v159.js", "sidebar-polish-v160.js", "config.js", "release-manifest.js",
    "activity-dialog-v130.css", "list-sort-v131.css", "stable-fixes-v108.js", "date-keyboard-fix-v127.js",
    "schedule-today-lock-v129.js", "list-sort-v131.js", "version-display-lock.js",
    "assets/brand.png", "assets/nav-done.png", "assets/nav-schedule-v87.png", "assets/nav-star-menu.png",
    "assets/nav-task-v87.png", "assets/nav-today-v87.png", "assets/summary-mine.png", "assets/summary-open.png",
    "assets/summary-overdue.png", "assets/summary-today.png", "assets/nav-todo-v142.svg", "assets/nav-memo-v167.svg", "assets/nav-todo-v168.svg", "assets/nav-memo-v168.svg",
    "assets/nav-today-v169.svg", "assets/nav-task-v169.svg", "assets/nav-schedule-v169.svg", "assets/nav-mine-v169.svg", "assets/nav-star-v169.svg", "assets/nav-done-v169.svg", "assets/summary-open-v169.svg", "assets/summary-overdue-v169.svg"
  ],
  optionalAssets: ["mobile-fixes.js"],
  dynamicStyles: ["activity-dialog-v130.css", "list-sort-v131.css", "ui-v144.css", "ui-v145.css", "ui-v146.css", "ui-v147.css", "ui-v148.css", "ui-v149.css", "ui-v150.css", "ui-v151.css", "ui-v152.css", "ui-v153.css", "ui-v154.css", "ui-v156.css", "ui-v157.css", "ui-v158.css", "ui-v159.css", "ui-v160.css", "ui-v162.css", "ui-v163.css", "ui-v164.css", "ui-v165.css", "ui-v167.css", "ui-v168.css", "ui-v169.css", "ui-v170.css"],
  dynamicScripts: ["desktop-sidebar-v158.js", "desktop-sidebar-compat-v159.js", "sidebar-polish-v160.js", "stable-fixes-v108.js", "date-keyboard-fix-v127.js", "schedule-today-lock-v129.js", "list-sort-v131.js", "version-display-lock.js", "todo-controls-v144.js", "todo-tools-v145.js", "todo-history-v146.js", "task-ux-v146.js", "todo-preview-v147.js", "workflow-core-v150.js", "workflow-v152.js", "dependencies-v149.js", "saved-views-v148.js", "insights-v148.js", "comments-tabs-v149.js", "completion-unpin-v150.js", "relationships-v152.js", "reminders-v152.js", "inbox-v153.js", "archive-duplicate-v153.js", "detail-layout-v154.js", "user-add-fix-v155.js", "mention-picker-v156.js", "comment-reactions-v165.js", "work-features-v167.js", "work-features-ui-v168.js", "icon-system-v169.js"],
  mobileScripts: ["mobile-fixes.js"]
});
window.WORK_BOARD_RELEASE_VERSION = window.WORK_BOARD_RELEASE.version;
window.WORK_BOARD_VERSION = window.WORK_BOARD_RELEASE.version;
