// Firebase設定
window.firebaseConfig = {
  apiKey: atob("QUl6YVN5QXN3WHg1ako1YjF2MUJkSWpyaTFFTHZqMHEzWUJNdkxN"),
  authDomain: "task-kanri-2ad16.firebaseapp.com",
  databaseURL: "https://task-kanri-2ad16-default-rtdb.firebaseio.com",
  projectId: "task-kanri-2ad16",
  storageBucket: "task-kanri-2ad16.firebasestorage.app",
  messagingSenderId: "872313738387",
  appId: "1:872313738387:web:5adcc567025b4945cd2966",
  measurementId: "G-R0GQ65214Z"
};

// Ver.241: CSSは宣言順を保ったまま並列読込し、JSは依存順を守って逐次読込する。
// version表示はrelease manifestを唯一の値ソースとして、通常起動・復帰時ともこのloaderが同期する。
// desktop起動後に860px以下へ遷移した場合も、conditional mobile scriptを既存loaderから一度だけ補完する。
(function loadStableWorkBoard() {
  const VERSION = window.WORK_BOARD_RELEASE?.version;
  const INVENTORY = window.WORK_BOARD_RELEASE;
  if (!/^(?:0|[1-9]\d*)$/.test(String(VERSION || ''))) {
    console.error('Work board release manifest is unavailable.');
    return;
  }
  const MOBILE_QUERY = "(max-width: 860px)";
  const mobileMedia = window.matchMedia(MOBILE_QUERY);
  const isMobile = mobileMedia.matches;
  const assetUrl = name => `${name}?v=${VERSION}`;
  const INITIAL_MODE = document.documentElement.dataset.wbDisplay || 'classic';
  // Only large, self-contained display assets are deferred. Shared style and
  // mode-switch controls stay in the first paint path on every display.
  const VIEW_ASSETS = INVENTORY.deferredDisplayAssets || {};
  const deferredStyleModes = new Map();
  const deferredScriptModes = new Map();
  for (const [mode, assets] of Object.entries(VIEW_ASSETS)) {
    for (const name of assets.styles || []) deferredStyleModes.set(name, mode);
    for (const name of assets.scripts || []) deferredScriptModes.set(name, mode);
  }
  const ALL_STYLES = (INVENTORY.dynamicStyles || []).map(name => [assetUrl(name), name]);
  const ALL_SCRIPTS = (INVENTORY.dynamicScripts || []).map(name => [assetUrl(name), name]);
  const STYLES = ALL_STYLES.filter(([, name]) =>
    !deferredStyleModes.has(name) || deferredStyleModes.get(name) === INITIAL_MODE);
  const MOBILE_SCRIPTS = (INVENTORY.mobileScripts || []).map(name => [assetUrl(name), name]);
  const SCRIPTS = [
    ...(isMobile ? MOBILE_SCRIPTS : []),
    ...ALL_SCRIPTS.filter(([, name]) =>
      !deferredScriptModes.has(name) || deferredScriptModes.get(name) === INITIAL_MODE)
  ];
  let initialLoadComplete = false;
  let mobileScriptsLoadPromise = null;

  function setVersion() {
    const expected = `Ver.${VERSION}`;
    const expectedTitle = `現在のバージョン ${expected}`;
    window.WORK_BOARD_RELEASE_VERSION = VERSION;
    window.WORK_BOARD_VERSION = VERSION;
    document.querySelectorAll(".app-version, .workboard-version-display").forEach(element => {
      if (element.classList.contains("app-version")) element.classList.remove("app-version");
      if (!element.classList.contains("workboard-version-display")) element.classList.add("workboard-version-display");
      if (element.textContent !== expected) element.textContent = expected;
      if (element.title !== expectedTitle) element.title = expectedTitle;
      if (element.dataset.releaseVersion !== VERSION) element.dataset.releaseVersion = VERSION;
    });
  }

  // Prefetch a small window without changing dependency-sensitive script execution order.
  const SCRIPT_PRELOAD_AHEAD = 6;
  const scriptPreloads = new Map();
  function preloadUpcomingScripts(fromIndex) {
    const end = Math.min(SCRIPTS.length, fromIndex + SCRIPT_PRELOAD_AHEAD);
    for (let index = fromIndex; index < end; index += 1) {
      const [src, marker] = SCRIPTS[index];
      if (scriptPreloads.has(marker)) continue;
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'script';
      link.href = src;
      scriptPreloads.set(marker, link);
      document.head.appendChild(link);
    }
  }
  // Keep each CSS file's original cascade slot even if its mode loads later.
  // Comment anchors do not trigger a network request for inactive displays.
  const styleSlots = new Map();
  function preserveStyleOrder() {
    for (const [, marker] of ALL_STYLES) {
      const slot = document.createComment('workboard-style:' + marker);
      styleSlots.set(marker, slot);
      document.head.appendChild(slot);
    }
  }
  const ASSET_TIMEOUT_MS = 12000;

  function reportAsset(kind, url, ok, reason = ok ? "loaded" : "error") {
    const result = { kind, url, ok, reason, release: VERSION, at: Date.now() };
    (window.WORK_BOARD_ASSET_RESULTS ||= []).push(result);
    if (!ok) console.warn("Work board asset failed", result);
    window.dispatchEvent(new CustomEvent("workboardasset", { detail: result }));
  }

  function loadStylesheet(href, marker) {
    return new Promise(resolve => {
      let link = document.querySelector(`link[data-workboard-style="${marker}"]`);
      if (link) {
        if (link.dataset.loaded === "true") resolve(true);
        else if (link.dataset.failed) resolve(false);
        else waitForAsset(link, "style", href, resolve);
        return;
      }

      link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.workboardStyle = marker;
      waitForAsset(link, "style", href, resolve);
      document.head.insertBefore(link, styleSlots.get(marker) || null);
    });
  }

  function loadScript(src, marker) {
    return new Promise(resolve => {
      const existing = document.querySelector(`script[data-workboard-stable="${marker}"]`);
      if (existing) {
        if (existing.dataset.loaded === "true") resolve(true);
        else if (existing.dataset.failed) resolve(false);
        else waitForAsset(existing, "script", src, resolve);
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.dataset.workboardStable = marker;
      waitForAsset(script, "script", src, resolve);
      document.head.appendChild(script);
    });
  }

  function waitForAsset(element, kind, url, resolve) {
    let settled = false;
    const finish = (ok, reason) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (ok) element.dataset.loaded = "true";
      else element.dataset.failed = reason;
      reportAsset(kind, url, ok, reason);
      resolve(ok);
    };
    const timeoutId = setTimeout(() => finish(false, "timeout"), ASSET_TIMEOUT_MS);
    element.addEventListener("load", () => finish(true, "loaded"), { once: true });
    element.addEventListener("error", () => finish(false, "error"), { once: true });
  }

  async function ensureMobileScripts() {
    if (!mobileMedia.matches || !MOBILE_SCRIPTS.length) return [];
    if (mobileScriptsLoadPromise) return mobileScriptsLoadPromise;
    mobileScriptsLoadPromise = (async () => {
      const results = [];
      for (const [src, marker] of MOBILE_SCRIPTS) {
        results.push(await loadScript(src, marker));
      }
      return results;
    })();
    return mobileScriptsLoadPromise;
  }

  // Mode changes after startup bring in only that display's optional assets.
  // The same loadScript/loadStylesheet contracts prevent duplicate requests.
  const displayLoads = new Map();
  function ensureDisplayAssets(mode) {
    if (!initialLoadComplete || !Object.hasOwn(VIEW_ASSETS, mode)) return Promise.resolve(true);
    if (displayLoads.has(mode)) return displayLoads.get(mode);
    const loading = (async () => {
      const styles = ALL_STYLES.filter(([, marker]) => deferredStyleModes.get(marker) === mode);
      const scripts = ALL_SCRIPTS.filter(([, marker]) => deferredScriptModes.get(marker) === mode);
      const styleResults = await Promise.all(
        styles.map(([href, marker]) => loadStylesheet(href, marker))
      );
      const scriptResults = [];
      for (const [src, marker] of scripts) scriptResults.push(await loadScript(src, marker));
      return styleResults.every(Boolean) && scriptResults.every(Boolean);
    })();
    displayLoads.set(mode, loading);
    return loading;
  }

  function handleDisplayChange() {
    if (initialLoadComplete) void ensureDisplayAssets(document.documentElement.dataset.wbDisplay);
  }

  function handleMobileChange(event) {
    if (!event.matches || !initialLoadComplete) return;
    void ensureMobileScripts();
  }

  function notifyAssetsReady(styleResults, scriptResults) {
    const detail = {
      release: VERSION,
      styles: { total: STYLES.length, failed: styleResults.filter(ok => !ok).length },
      scripts: { total: SCRIPTS.length, failed: scriptResults.filter(ok => !ok).length }
    };
    window.WORK_BOARD_ASSETS_READY = true;
    window.WORK_BOARD_ASSET_SUMMARY = detail;
    document.documentElement.dataset.workboardAssetsReady = VERSION;
    window.dispatchEvent(new CustomEvent("workboard:assets-ready", { detail }));
  }

  async function start() {
    const styleResults = [];
    const scriptResults = [];
    try {
      setVersion();
      preserveStyleOrder();
      preloadUpcomingScripts(0);

      // CSS links are appended in cascade order, but CSS download and the
      // dependency-sensitive script chain can overlap. Keep the first-paint
      // guard until BOTH groups settle; do not expose partially styled UI.
      const stylesReady = Promise.all(
        STYLES.map(([href, marker]) => loadStylesheet(href, marker))
      );

      // Network requests overlap, but existing script execution remains strictly serial.
      let scriptIndex = 0;
      for (const [src, marker] of SCRIPTS) {
        preloadUpcomingScripts(scriptIndex++);
        scriptResults.push(await loadScript(src, marker));
        scriptPreloads.get(marker)?.remove();
        scriptPreloads.delete(marker);
      }

      // Wait for all styles before the ready event, even though JS was
      // allowed to execute while styles were still downloading.
      styleResults.push(...await stylesReady);

      // desktop cold boot中にmobileへ入った場合は初回表示を解放する前にshellを補完する。
      if (!isMobile && mobileMedia.matches) {
        await ensureMobileScripts();
      }
    } catch (error) {
      console.error("Work board asset loader failed", error);
    } finally {
      initialLoadComplete = true;
      notifyAssetsReady(styleResults, scriptResults);
      // A display changed during boot must still obtain its selected assets.
      if (document.documentElement.dataset.wbDisplay !== INITIAL_MODE) handleDisplayChange();
      // ready直前のresize競合も現在幅から回収する。
      if (!isMobile && mobileMedia.matches) void ensureMobileScripts();
    }
  }

  mobileMedia.addEventListener("change", handleMobileChange);
  new MutationObserver(handleDisplayChange).observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-wb-display']
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  window.addEventListener("pageshow", setVersion);
  window.addEventListener("focus", setVersion);
})();