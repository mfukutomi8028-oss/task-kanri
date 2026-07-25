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

// v128: keep segmented schedule datetime controls within their form columns
(function loadStableWorkBoard() {
  const VERSION = "128";
  const isMobile = window.matchMedia("(max-width: 860px)").matches;
  const SCRIPTS = [
    ...(isMobile ? [[`mobile-fixes.js?v=${VERSION}`, "mobile-base-v128"]] : []),
    [`stable-fixes-v108.js?v=${VERSION}`, "stable-v128"],
    [`date-keyboard-fix-v127.js?v=${VERSION}`, "date-segments-v128"]
  ];

  function setVersion() {
    const expected = `Ver.${VERSION}`;
    window.WORK_BOARD_VERSION = VERSION;
    document.querySelectorAll(".app-version").forEach(element => {
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
    const brandIcon = `assets/brand.png?v=${VERSION}`;
    document.querySelectorAll(".brand-mark img").forEach(img => { img.src = brandIcon; });
    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach(link => link.remove());
    upsertIconLink("icon", brandIcon, { type: "image/png" });
    upsertIconLink("shortcut icon", brandIcon, { type: "image/png" });
    upsertIconLink("apple-touch-icon", brandIcon, { type: "image/png" });
  }

  function loadScript(src, marker) {
    return new Promise(resolve => {
      const existing = document.querySelector(`script[data-workboard-stable="${marker}"]`);
      if (existing) {
        if (existing.dataset.loaded === "true") resolve();
        else existing.addEventListener("load", resolve, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.dataset.workboardStable = marker;
      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve();
      }, { once: true });
      script.addEventListener("error", resolve, { once: true });
      document.head.appendChild(script);
    });
  }

  async function start() {
    setVersion();
    patchBrandIcons();
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