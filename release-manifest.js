// Ver.143 のリリース正本。全配布資産と動的 loader はこの inventory を参照する。
window.WORK_BOARD_RELEASE = Object.freeze({
  version: "143",
  requiredAssets: [
    "index.html", "style.css", "todo-ui-v142.css", "mine-icon-fix-v121.css", "app.js", "todo-sync-v136.js", "task-delete-v134.js", "config.js", "release-manifest.js",
    "activity-dialog-v130.css", "list-sort-v131.css", "stable-fixes-v108.js", "date-keyboard-fix-v127.js",
    "schedule-today-lock-v129.js", "list-sort-v131.js", "version-display-lock.js",
    "assets/brand.png", "assets/nav-done.png", "assets/nav-schedule-v87.png", "assets/nav-star-menu.png",
    "assets/nav-task-v87.png", "assets/nav-today-v87.png", "assets/summary-mine.png", "assets/summary-open.png",
    "assets/summary-overdue.png", "assets/summary-today.png", "assets/nav-todo-v142.svg"
  ],
  optionalAssets: ["mobile-fixes.js"],
  dynamicStyles: ["activity-dialog-v130.css", "list-sort-v131.css"],
  dynamicScripts: ["stable-fixes-v108.js", "date-keyboard-fix-v127.js", "schedule-today-lock-v129.js", "list-sort-v131.js", "version-display-lock.js"],
  mobileScripts: ["mobile-fixes.js"]
});
window.WORK_BOARD_RELEASE_VERSION = window.WORK_BOARD_RELEASE.version;
window.WORK_BOARD_VERSION = window.WORK_BOARD_RELEASE.version;
