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

// v95: brand.png 統一・スマホ版タイトル重なり補正
// 前回のMutationObserverによる再帰的なstyle更新を廃止し、スマホで白画面になる事象を防ぎます。
(function applyWorkBoardUiPatch() {
  const VERSION = "95";
  const BRAND_ICON = `assets/brand.png?v=${VERSION}`;
  const MOBILE_QUERY = "(max-width: 860px)";

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
    try {
      if (!("Notification" in window) || window.Notification.__workBoardPatched) return;

      const NativeNotification = window.Notification;
      if (typeof NativeNotification !== "function") return;

      function BoardNotification(title, options) {
        const baseOptions = options && typeof options === "object" ? options : {};
        return new NativeNotification(title, { ...baseOptions, icon: BRAND_ICON });
      }

      if (typeof NativeNotification.requestPermission === "function") {
        BoardNotification.requestPermission = NativeNotification.requestPermission.bind(NativeNotification);
      }
      Object.defineProperty(BoardNotification, "permission", {
        configurable: true,
        get() {
          return NativeNotification.permission;
        }
      });
      BoardNotification.prototype = NativeNotification.prototype;
      BoardNotification.__workBoardPatched = true;
      window.Notification = BoardNotification;
    } catch (error) {
      console.warn("Notification icon patch skipped", error);
    }
  }

  function installMobileHeroStyle() {
    if (document.getElementById("workBoardV95MobileHeroStyle")) return;

    const style = document.createElement("style");
    style.id = "workBoardV95MobileHeroStyle";
    style.textContent = `
      @media ${MOBILE_QUERY} {
        .main {
          overflow-x: hidden !important;
        }

        .hero {
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          justify-content: flex-start !important;
          gap: 14px !important;
          min-height: auto !important;
          padding: 22px 20px 24px !important;
        }

        .hero-title-area {
          position: relative !important;
          z-index: 2 !important;
          width: 100% !important;
          max-width: none !important;
          padding-right: 0 !important;
        }

        .hero .eyebrow {
          margin-bottom: 6px !important;
          font-size: 11px !important;
        }

        .hero h2 {
          margin: 0 !important;
          font-size: clamp(27px, 8.6vw, 39px) !important;
          line-height: 1.08 !important;
          max-width: 100% !important;
          white-space: normal !important;
        }

        .hero-room-badge,
        #roomNameBadge.hero-room-badge,
        .hero #roomNameBadge {
          position: relative !important;
          inset: auto !important;
          right: auto !important;
          left: auto !important;
          top: auto !important;
          bottom: auto !important;
          transform: none !important;
          z-index: 3 !important;
          display: inline-flex !important;
          align-self: flex-start !important;
          margin: 0 !important;
          max-width: 100% !important;
          width: auto !important;
          white-space: normal !important;
          overflow: visible !important;
          text-overflow: clip !important;
          font-size: 14px !important;
          line-height: 1.35 !important;
          padding: 8px 12px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function forceMobileHeroLayout() {
    const isMobile = window.matchMedia(MOBILE_QUERY).matches;
    const hero = document.querySelector(".hero");
    const titleArea = document.querySelector(".hero-title-area");
    const title = document.querySelector(".hero h2");
    const roomBadge = document.querySelector("#roomNameBadge.hero-room-badge, .hero-room-badge");

    if (!hero || !roomBadge) return;

    if (!isMobile) {
      hero.style.removeProperty("display");
      hero.style.removeProperty("flex-direction");
      hero.style.removeProperty("align-items");
      hero.style.removeProperty("justify-content");
      hero.style.removeProperty("gap");
      hero.style.removeProperty("min-height");
      hero.style.removeProperty("padding");
      roomBadge.style.removeProperty("position");
      roomBadge.style.removeProperty("inset");
      roomBadge.style.removeProperty("right");
      roomBadge.style.removeProperty("left");
      roomBadge.style.removeProperty("top");
      roomBadge.style.removeProperty("bottom");
      roomBadge.style.removeProperty("transform");
      roomBadge.style.removeProperty("margin");
      roomBadge.style.removeProperty("max-width");
      roomBadge.style.removeProperty("white-space");
      roomBadge.style.removeProperty("overflow");
      roomBadge.style.removeProperty("text-overflow");
      return;
    }

    hero.style.setProperty("display", "flex", "important");
    hero.style.setProperty("flex-direction", "column", "important");
    hero.style.setProperty("align-items", "flex-start", "important");
    hero.style.setProperty("justify-content", "flex-start", "important");
    hero.style.setProperty("gap", "14px", "important");
    hero.style.setProperty("min-height", "auto", "important");
    hero.style.setProperty("padding", "22px 20px 24px", "important");

    if (titleArea) {
      titleArea.style.setProperty("width", "100%", "important");
      titleArea.style.setProperty("max-width", "none", "important");
      titleArea.style.setProperty("padding-right", "0", "important");
    }

    if (title) {
      title.style.setProperty("font-size", "clamp(27px, 8.6vw, 39px)", "important");
      title.style.setProperty("line-height", "1.08", "important");
      title.style.setProperty("white-space", "normal", "important");
      title.style.setProperty("max-width", "100%", "important");
    }

    roomBadge.style.setProperty("position", "relative", "important");
    roomBadge.style.setProperty("inset", "auto", "important");
    roomBadge.style.setProperty("right", "auto", "important");
    roomBadge.style.setProperty("left", "auto", "important");
    roomBadge.style.setProperty("top", "auto", "important");
    roomBadge.style.setProperty("bottom", "auto", "important");
    roomBadge.style.setProperty("transform", "none", "important");
    roomBadge.style.setProperty("z-index", "3", "important");
    roomBadge.style.setProperty("align-self", "flex-start", "important");
    roomBadge.style.setProperty("margin", "0", "important");
    roomBadge.style.setProperty("max-width", "100%", "important");
    roomBadge.style.setProperty("white-space", "normal", "important");
    roomBadge.style.setProperty("overflow", "visible", "important");
    roomBadge.style.setProperty("text-overflow", "clip", "important");
    roomBadge.style.setProperty("font-size", "14px", "important");
    roomBadge.style.setProperty("line-height", "1.35", "important");
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
    forceMobileHeroLayout();
  }

  installNotificationIconPatch();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyPatch, { once: true });
  } else {
    applyPatch();
  }

  window.addEventListener("resize", forceMobileHeroLayout);
  window.addEventListener("orientationchange", () => setTimeout(forceMobileHeroLayout, 150));
  setTimeout(forceMobileHeroLayout, 300);
  setTimeout(forceMobileHeroLayout, 1000);
})();