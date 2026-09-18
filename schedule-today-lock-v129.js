// Ver.225: Schedule Today lifecycle is canonical in app.js.
// This compatibility shell remains active for one release so cached loaders stay harmless.
(function installScheduleTodayLockCompatibilityV129() {
  window.__WB_SCHEDULE_TODAY_LOCK_V129__ = Object.freeze({
    version: "225",
    retired: true
  });
})();
