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

// Ver.132: dynamic assets expose load failures to the application and diagnostics.
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

  async function start() {
    setVersion();
    patchBrandIcons();
    for (const [href, marker] of STYLES) {
      await loadStylesheet(href, marker);
    }
    for (const [src, marker] of SCRIPTS) {
      await loadScript(src, marker);
    }
    setVersion();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  setTimeout(setVersion, 300);
  setTimeout(setVersion, 1200);
})();
