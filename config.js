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

// v107: 再帰監視を廃止し、安全な順序で補正ファイルを読み込む
(function loadWorkBoardFixes() {
  const VERSION = "107";
  const SCRIPT_CHAIN = [
    ["mobile-fixes.js?v=101", "v101"],
    ["mobile-board-scroll-fix.js?v=102", "v102"],
    ["mobile-scroll-unlock-v103.js?v=103", "v103"],
    ["mobile-interaction-filter-v104.js?v=104", "v104"],
    ["mobile-native-tabs-today-filter-v105.js?v=105", "v105"],
    [`mobile-safe-final-v107.js?v=${VERSION}`, "v107"]
  ];

  function setVersion() {
    const expected = `Ver.${VERSION}`;
    window.WORK_BOARD_VERSION = VERSION;
    document.querySelectorAll(".app-version").forEach((element) => {
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
    document.querySelectorAll(".brand-mark img").forEach((img) => { img.src = brandIcon; });
    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach((link) => link.remove());
    upsertIconLink("icon", brandIcon, { type: "image/png" });
    upsertIconLink("shortcut icon", brandIcon, { type: "image/png" });
    upsertIconLink("apple-touch-icon", brandIcon, { type: "image/png" });
  }

  function patchNotificationIcon() {
    try {
      if (!("Notification" in window) || window.Notification.__workBoardPatchedV107) return;
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
      BoardNotification.__workBoardPatchedV107 = true;
      window.Notification = BoardNotification;
    } catch (error) {
      console.warn("Notification icon patch skipped", error);
    }
  }

  function loadScript(src, marker) {
    return new Promise((resolve) => {
      const selector = `script[data-workboard-fix="${marker}"]`;
      const existing = document.querySelector(selector);
      if (existing) {
        if (existing.dataset.loaded === "true") resolve();
        else existing.addEventListener("load", resolve, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.dataset.workboardFix = marker;
      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve();
      }, { once: true });
      script.addEventListener("error", resolve, { once: true });
      document.head.appendChild(script);
    });
  }

  async function loadScriptsInOrder() {
    for (const [src, marker] of SCRIPT_CHAIN) {
      await loadScript(src, marker);
    }
    setVersion();
  }

  function start() {
    setVersion();
    patchBrandIcons();
    patchNotificationIcon();
    loadScriptsInOrder();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  setTimeout(setVersion, 300);
  setTimeout(setVersion, 1200);
  setTimeout(setVersion, 3000);
})();