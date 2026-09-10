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

// Ver.177: CSSは宣言順を保ったまま並列読込し、JSは依存順を守って逐次読込する。
(function loadStableWorkBoard() {
  const VERSION = window.WORK_BOARD_RELEASE?.version;
  const INVENTORY = window.WORK_BOARD_RELEASE;
  if (!/^(?:0|[1-9]\d*)$/.test(String(VERSION || ''))) {
    console.error('Work board release manifest is unavailable.');
    return;
  }
  const isMobile = window.matchMedia("(max-width: 860px)").matches;
  const assetUrl = name => `${name}?v=${VERSION}`;
  const STYLES = (INVENTORY.dynamicStyles || []).map(name => [assetUrl(name), name]);
  const SCRIPTS = [
    ...(isMobile ? (INVENTORY.mobileScripts || []).map(name => [assetUrl(name), name]) : []),
    ...(INVENTORY.dynamicScripts || []).map(name => [assetUrl(name), name])
  ];

  function setVersion() {
    const expected = `Ver.${VERSION}`;
    window.WORK_BOARD_RELEASE_VERSION = VERSION;
    window.WORK_BOARD_VERSION = VERSION;
    document.querySelectorAll(".app-version, .workboard-version-display").forEach(element => {
      if (element.textContent !== expected) element.textContent = expected;
      element.title = `現在のバージョン ${expected}`;
    });
  }

  function upsertIconLink(rel, href, attrs = {}) {
    let link = document.querySelector(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement("link");
      link.rel = rel;
      document.head.appendChild(link);
    }
    Object.entries(attrs).forEach(([key, value]) => link.setAttribute(key, value));
    link.href = href;
  }

  function patchBrandIcons() {
    const brandIcon = assetUrl('assets/brand.png');
    document.querySelectorAll(".brand-mark img").forEach(img => { img.src = brandIcon; });
    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach(link => link.remove());
    upsertIconLink("icon", brandIcon, { type: "image/png" });
    upsertIconLink("shortcut icon", brandIcon, { type: "image/png" });
    upsertIconLink("apple-touch-icon", brandIcon, { type: "image/png" });
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
      document.head.appendChild(link);
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
      patchBrandIcons();

      // link要素はmapの評価順でDOMへ追加されるためCSSのカスケード順は維持される。
      // 読込待ちだけをまとめることで、世代別CSSを1本ずつ待つ直列遅延をなくす。
      styleResults.push(...await Promise.all(
        STYLES.map(([href, marker]) => loadStylesheet(href, marker))
      ));

      // 後付けJSは前世代のpatchを前提にするものがあるため、順序を変更しない。
      for (const [src, marker] of SCRIPTS) {
        scriptResults.push(await loadScript(src, marker));
      }
      setVersion();
    } catch (error) {
      console.error("Work board asset loader failed", error);
    } finally {
      notifyAssetsReady(styleResults, scriptResults);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  setTimeout(setVersion, 300);
  setTimeout(setVersion, 1200);
})();
