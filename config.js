// Firebase設定
// Firebase Consoleで取得したコードをそのまま貼るのではなく、
// このサイトでは window.firebaseConfig に設定値だけを入れます。
// import / initializeApp / getAnalytics は app.js 側で処理するため不要です。

window.firebaseConfig = {
  apiKey: "AIzaSyAswXx5jJ5b1v1BdIjri1ELvj0q3YBMvLM",
  authDomain: "task-kanri-2ad16.firebaseapp.com",

  // Realtime Databaseを使うため必須です。
  // Firebase Console > Realtime Database > データ に表示されるURLと違う場合は、
  // この1行だけ実際のURLへ置き換えてください。
  databaseURL: "https://task-kanri-2ad16-default-rtdb.firebaseio.com",

  projectId: "task-kanri-2ad16",
  storageBucket: "task-kanri-2ad16.firebasestorage.app",
  messagingSenderId: "872313738387",
  appId: "1:872313738387:web:5adcc567025b4945cd2966",
  measurementId: "G-R0GQ65214Z"
};

// v93: brand.png 統一・スマホ版タイトル重なり補正
// index.html 側に古い参照が残っていても、読み込み後に補正します。
(function applyWorkBoardUiPatch() {
  const VERSION = "93";
  const BRAND_ICON = `assets/brand.png?v=${VERSION}`;

  function upsertIconLink(rel, attributes = {}) {
    let link = document.querySelector(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement("link");
      link.rel = rel;
      document.head.appendChild(link);
    }
    Object.entries(attributes).forEach(([key, value]) => link.setAttribute(key, value));
    link.href = BRAND_ICON;
  }

  function installNotificationIconPatch() {
    if (!("Notification" in window) || window.Notification.__workBoardPatched) return;

    const NativeNotification = window.Notification;

    function BoardNotification(title, options) {
      const nextOptions = options && typeof options === "object"
        ? { ...options, icon: BRAND_ICON }
        : { icon: BRAND_ICON };
      return new NativeNotification(title, nextOptions);
    }

    BoardNotification.requestPermission = NativeNotification.requestPermission.bind(NativeNotification);
    Object.defineProperty(BoardNotification, "permission", {
      get() {
        return NativeNotification.permission;
      }
    });
    BoardNotification.prototype = NativeNotification.prototype;
    BoardNotification.__workBoardPatched = true;
    window.Notification = BoardNotification;
  }

  function installMobileHeroStyle() {
    if (document.getElementById("workBoardV93MobileHeroStyle")) return;

    const style = document.createElement("style");
    style.id = "workBoardV93MobileHeroStyle";
    style.textContent = `
      @media (max-width: 860px) {
        .hero {
          display: grid !important;
          grid-template-columns: 1fr !important;
          align-items: flex-start !important;
          gap: 14px !important;
          min-height: auto !important;
          padding: 22px 20px 24px !important;
        }
        .hero-title-area {
          max-width: none !important;
        }
        .hero .eyebrow {
          margin-bottom: 6px !important;
        }
        .hero h2 {
          font-size: clamp(28px, 9vw, 40px) !important;
          line-height: 1.08 !important;
        }
        .hero-room-badge {
          position: static !important;
          display: inline-flex !important;
          align-self: flex-start !important;
          margin-top: 4px !important;
          max-width: 100% !important;
          white-space: normal !important;
          overflow: visible !important;
          text-overflow: clip !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function applyPatch() {
    document.querySelectorAll(".app-version").forEach((element) => {
      element.textContent = `Ver.${VERSION}`;
      element.title = `現在のバージョン Ver.${VERSION}`;
    });

    document.querySelectorAll(".brand-mark img").forEach((img) => {
      img.src = BRAND_ICON;
    });

    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach((link) => link.remove());
    upsertIconLink("icon", { type: "image/png" });
    upsertIconLink("shortcut icon", { type: "image/png" });
    upsertIconLink("apple-touch-icon", { type: "image/png" });

    let theme = document.querySelector('meta[name="theme-color"]');
    if (!theme) {
      theme = document.createElement("meta");
      theme.name = "theme-color";
      document.head.appendChild(theme);
    }
    theme.content = "#255f9f";

    installMobileHeroStyle();
  }

  installNotificationIconPatch();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyPatch, { once: true });
  } else {
    applyPatch();
  }
})();
