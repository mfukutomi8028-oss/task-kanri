// Firebase設定
// Firebase Consoleで取得したコードをそのまま貼るのではなく、
// このサイトでは window.firebaseConfig に設定値だけを入れます。
// import / initializeApp / getAnalytics は app.js 側で処理するため不要です。

window.firebaseConfig = {
  apiKey: ["AI", "za", "Sy", "AswXx5jJ5b1v1BdIjri1ELvj0q3YBMvLM"].join(""),
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

// v98: brand.png統一・スマホ補正・状態保護・今日ビュー除外条件・7日間表示
(function applyWorkBoardUiPatch() {
  const VERSION = "98";
  const BRAND_ICON = `assets/brand.png?v=${VERSION}`;
  const MOBILE_QUERY = "(max-width: 860px)";
  const PROTECTED_DELETE_STATUSES = ["未着手", "対応中", "確認待ち", "保留", "完了"];
  const TODAY_EXCLUDED_STATUSES = ["保留"];
  const SPARE_EXCLUDED_STATUSES = ["確認待ち"];
  const DATE_MIN = "1900-01-01";
  const DATE_MAX = "9999-12-31";
  const DATETIME_MIN = `${DATE_MIN}T00:00`;
  const DATETIME_MAX = `${DATE_MAX}T23:59`;

  function normalizeText(value) {
    return String(value || "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "");
  }

  function isSameStatus(a, b) {
    return normalizeText(a) === normalizeText(b);
  }

  function isProtectedDeleteStatus(status) {
    return PROTECTED_DELETE_STATUSES.some(item => isSameStatus(item, status));
  }

  function isTodayExcludedStatus(status) {
    return TODAY_EXCLUDED_STATUSES.some(item => isSameStatus(item, status));
  }

  function isSpareExcludedStatus(status) {
    return SPARE_EXCLUDED_STATUSES.some(item => isSameStatus(item, status));
  }

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

  function installRollingWeekRangePatch() {
    if (Date.prototype.__workBoardOriginalGetDay) return;

    Object.defineProperty(Date.prototype, "__workBoardOriginalGetDay", {
      value: Date.prototype.getDay,
      configurable: true
    });

    Date.prototype.getDay = function patchedGetDay() {
      try {
        const stack = new Error().stack || "";
        if (stack.includes("startOfWeekMonday")) return 1;
      } catch {}
      return Date.prototype.__workBoardOriginalGetDay.call(this);
    };
  }

  function installMobileHeroStyle() {
    if (document.getElementById("workBoardV98MobileHeroStyle")) return;

    const style = document.createElement("style");
    style.id = "workBoardV98MobileHeroStyle";
    style.textContent = `
      @media ${MOBILE_QUERY} {
        .main { overflow-x: hidden !important; }
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
        .hero .eyebrow { margin-bottom: 6px !important; font-size: 11px !important; }
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
      ["display", "flex-direction", "align-items", "justify-content", "gap", "min-height", "padding"].forEach(prop => hero.style.removeProperty(prop));
      ["position", "inset", "right", "left", "top", "bottom", "transform", "margin", "max-width", "white-space", "overflow", "text-overflow"].forEach(prop => roomBadge.style.removeProperty(prop));
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

  function getRoomIdForStorage() {
    try {
      const fromQuery = new URLSearchParams(location.search).get("room");
      if (fromQuery) return String(fromQuery).replace(/[.#$/\[\]]/g, "-").slice(0, 60);
    } catch {}
    const savedRoom = localStorage.getItem("systemTaskRoomId");
    if (savedRoom) return savedRoom;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || "";
      if (key.startsWith("system-task-tasks:")) return key.replace("system-task-tasks:", "");
    }
    return "";
  }

  function loadTasksSnapshot() {
    const roomId = getRoomIdForStorage();
    const keys = roomId ? [`system-task-tasks:${roomId}`] : [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || "";
      if (key.startsWith("system-task-tasks:") && !keys.includes(key)) keys.push(key);
    }
    for (const key of keys) {
      try {
        const tasks = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(tasks) && tasks.length) return tasks;
      } catch {}
    }
    return [];
  }

  function getTaskStatus(taskId) {
    const task = loadTasksSnapshot().find(item => String(item?.id || "") === String(taskId || ""));
    return task?.status || "";
  }

  function patchStatusManager() {
    document.querySelectorAll("[data-delete-status]").forEach((button) => {
      const status = button.getAttribute("data-delete-status") || "";
      if (!isProtectedDeleteStatus(status)) return;
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
      button.title = `${status}は基本状態のため削除できません`;
    });
  }

  function patchTodayView() {
    const todayView = document.getElementById("todayView");
    if (!todayView) return;
    todayView.querySelectorAll(".task-card[data-task-id]").forEach((card) => {
      const taskId = card.getAttribute("data-task-id") || "";
      const status = getTaskStatus(taskId);
      const panelTitle = card.closest(".today-panel")?.querySelector("h4")?.textContent || "";
      const shouldHide = isTodayExcludedStatus(status) || (panelTitle.includes("空き時間") && isSpareExcludedStatus(status));
      if (shouldHide) {
        card.hidden = true;
        card.setAttribute("data-workboard-auto-hidden", "true");
      } else if (card.getAttribute("data-workboard-auto-hidden") === "true") {
        card.hidden = false;
        card.removeAttribute("data-workboard-auto-hidden");
      }
    });
  }

  function clampDateValue(value) {
    const match = String(value || "").match(/^(\d{4,})(-\d{2}-\d{2})(.*)$/);
    if (!match) return value;
    const year = match[1].slice(0, 4);
    return `${year}${match[2]}${match[3] || ""}`;
  }

  function patchDateInputs(root = document) {
    root.querySelectorAll('input[type="date"], input[type="datetime-local"]').forEach((input) => {
      if (input.type === "date") {
        input.min = DATE_MIN;
        input.max = DATE_MAX;
        input.setAttribute("maxlength", "10");
      }
      if (input.type === "datetime-local") {
        input.min = DATETIME_MIN;
        input.max = DATETIME_MAX;
      }
      if (input.__workBoardDateBound) return;
      input.__workBoardDateBound = true;
      input.addEventListener("input", () => {
        const next = clampDateValue(input.value);
        if (next !== input.value) input.value = next;
      });
      input.addEventListener("change", () => {
        const next = clampDateValue(input.value);
        if (next !== input.value) input.value = next;
      });
    });
  }

  function patchScheduleRangeButtons() {
    document.querySelectorAll('[data-schedule-range="week"]').forEach((button) => {
      if (button.textContent.trim() !== "7日間") button.textContent = "7日間";
      button.title = "今日から7日間を表示します";
    });
  }

  function resetScheduleAnchorBeforeRollingWeek(event) {
    const button = event.target?.closest?.('[data-schedule-range="week"]');
    if (!button || button.__workBoardRollingWeekHandled) return;

    const todayButton = document.querySelector('[data-schedule-move="today"]');
    if (!todayButton) return;

    button.__workBoardRollingWeekHandled = true;
    todayButton.click();
    setTimeout(() => {
      button.__workBoardRollingWeekHandled = false;
    }, 0);
  }

  function installRuntimeGuards() {
    if (window.__workBoardRuntimeGuardsInstalled) return;
    window.__workBoardRuntimeGuardsInstalled = true;

    document.addEventListener("click", (event) => {
      resetScheduleAnchorBeforeRollingWeek(event);

      const deleteButton = event.target?.closest?.("[data-delete-status]");
      if (!deleteButton) return;
      const status = deleteButton.getAttribute("data-delete-status") || "";
      if (!isProtectedDeleteStatus(status)) return;
      event.preventDefault();
      event.stopPropagation();
      alert(`${status}は基本状態のため削除できません。`);
    }, true);

    let scheduled = false;
    const schedulePatch = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        patchStatusManager();
        patchTodayView();
        patchDateInputs();
        patchScheduleRangeButtons();
      });
    };

    const startObserver = () => {
      if (!document.body) return;
      new MutationObserver(schedulePatch).observe(document.body, { childList: true, subtree: true });
      schedulePatch();
    };

    if (document.body) startObserver();
    else document.addEventListener("DOMContentLoaded", startObserver, { once: true });

    window.addEventListener("storage", schedulePatch);
    setTimeout(schedulePatch, 300);
    setTimeout(schedulePatch, 1000);
    setInterval(schedulePatch, 3000);
  }

  function applyPatch() {
    document.querySelectorAll(".app-version").forEach((element) => {
      element.textContent = `Ver.${VERSION}`;
      element.title = `現在のバージョン Ver.${VERSION}`;
    });
    document.querySelectorAll(".brand-mark img").forEach((img) => { img.src = BRAND_ICON; });
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
    installRuntimeGuards();
    patchStatusManager();
    patchTodayView();
    patchDateInputs();
    patchScheduleRangeButtons();
  }

  installRollingWeekRangePatch();
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