// Ver.223: Today and Schedule final DOM are canonical in app.js. This sidecar remains active only as a compatibility shell for one release before manifest retirement audit.
(function installCoreViewDensityV188() {
  'use strict';

  const VERSION = '223';

  function patchAll() {}

  function start() {
    window.__WB_CORE_VIEW_DENSITY_V188__ = Object.freeze({
      version: VERSION,
      patchAll,
      observers: Object.freeze({ today: null, schedule: null })
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
