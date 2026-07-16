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

// v105: スマホ版改善ファイルを順番に読み込み
(function loadMobileFixes() {
  const VERSION = "105";

  function setVersion() {
    document.querySelectorAll(".app-version").forEach((element) => {
      element.textContent = `Ver.${VERSION}`;
      element.title = `現在のバージョン Ver.${VERSION}`;
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
    document.querySelectorAll(".brand-mark img").forEach((img) => { img.src = brandIcon; });
    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach((link) => link.remove());
    upsertIconLink("icon", brandIcon, { type: "image/png" });
    upsertIconLink("shortcut icon", brandIcon, { type: "image/png" });
    upsertIconLink("apple-touch-icon", brandIcon, { type: "image/png" });
  }

  function patchNotificationIcon() {
    try {
      if (!("Notification" in window) || window.Notification.__workBoardPatchedV105) return;
      const NativeNotification = window.Notification;
      if (typeof NativeNotification !== "function") return;

      function BoardNotification(title, options) {
        const baseOptions = options && typeof options === "object" ? options : {};
        return new NativeNotification(title, { ...baseOptions, icon: `assets/brand.png?v=${VERSION}` });
      }

      if (typeof NativeNotification.requestPermission === "function") {
        BoardNotification.requestPermission = NativeNotification.requestPermission.bind(NativeNotification);
      }
      Object.defineProperty(BoardNotification, "permission", {
        configurable: true,
        get() { return NativeNotification.permission; }
      });
      BoardNotification.prototype = NativeNotification.prototype;
      BoardNotification.__workBoardPatchedV105 = true;
      window.Notification = BoardNotification;
    } catch (error) {
      console.warn("Notification icon patch skipped", error);
    }
  }

  function loadScriptOnce(src, marker, onload) {
    const existing = document.querySelector(`script[data-mobile-fixes="${marker}"]`);
    if (existing) {
      if (onload) {
        if (existing.dataset.loaded === "true") onload();
        else existing.addEventListener("load", onload, { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.dataset.mobileFixes = marker;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      if (onload) onload();
    }, { once: true });
    document.head.appendChild(script);
  }

  function loadScripts() {
    loadScriptOnce("mobile-fixes.js?v=101", "v101", () => {
      loadScriptOnce("mobile-board-scroll-fix.js?v=102", "v102", () => {
        loadScriptOnce("mobile-scroll-unlock-v103.js?v=103", "v103", () => {
          loadScriptOnce("mobile-interaction-filter-v104.js?v=104", "v104", () => {
            loadScriptOnce(`mobile-native-tabs-today-filter-v105.js?v=${VERSION}`, "v105");
          });
        });
      });
    });
  }

  function patchAll() {
    setVersion();
    patchBrandIcons();
    patchNotificationIcon();
    loadScripts();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", patchAll, { once: true });
  } else {
    patchAll();
  }

  setTimeout(patchAll, 300);
  setTimeout(patchAll, 1000);
})();