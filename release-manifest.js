// Ver.132 の意味的なリリース正本。HTMLの初期読込値は release-check.ps1 で照合する。
window.WORK_BOARD_RELEASE = Object.freeze({
  version: "132",
  requiredAssets: ["style.css", "app.js", "config.js", "release-manifest.js"],
  optionalAssets: ["mobile-fixes.js", "activity-dialog-v130.css", "list-sort-v131.js", "list-sort-v131.css"]
});
window.WORK_BOARD_RELEASE_VERSION = window.WORK_BOARD_RELEASE.version;
window.WORK_BOARD_VERSION = window.WORK_BOARD_RELEASE.version;
