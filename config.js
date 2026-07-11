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

// v101: スマホ版改善ファイルを読み込み
(function loadMobileFixes() {
  const VERSION = "101";

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
      if (!("Notification" in window) || window.Notification.__workBoardPatchedV101) return;
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
      BoardNotification.__workBoardPatchedV101 = true;
      window.Notification = BoardNotification;
    } catch (error) {
      console.warn("Notification icon patch skipped", error);
    }
  }

  function loadScript() {
    if (document.querySelector('script[data-mobile-fixes="v101"]')) return;
    const script = document.createElement("script");
    script.src = `mobile-fixes.js?v=${VERSION}`;
    script.defer = true;
    script.dataset.mobileFixes = "v101";
    document.head.appendChild(script);
  }

  function patchAll() {
    setVersion();
    patchBrandIcons();
    patchNotificationIcon();
    loadScript();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", patchAll, { once: true });
  } else {
    patchAll();
  }

  setTimeout(patchAll, 300);
  setTimeout(patchAll, 1000);
})();