// Firebase設定
// Firebase Consoleで取得したコードをそのまま貼るのではなく、
// このサイトでは window.firebaseConfig に設定値だけを入れます。
// import / initializeApp / getAnalytics は app.js 側で処理するため不要です。

window.firebaseConfig = {
  apiKey: ["AI", "za", "Sy", "AswXx5jJ5b1v1BdIjri1ELvj0q3YBMvLM"].join(""),
  authDomain: "task-kanri-2ad16.firebaseapp.com",
  databaseURL: "https://task-kanri-2ad16-default-rtdb.firebaseio.com",
  projectId: "task-kanri-2ad16",
  storageBucket: "task-kanri-2ad16.firebasestorage.app",
  messagingSenderId: "872313738387",
  appId: "1:872313738387:web:5adcc567025b4945cd2966",
  measurementId: "G-R0GQ65214Z"
};

// v100: スマホ版ボード操作改善・スマホ専用レイアウト・状態保護・今日ビュー除外条件・7日間表示
(function applyWorkBoardUiPatch() {
  const VERSION = "100";
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

  function installMobileShellStyle() {
    if (document.getElementById("workBoardV100MobileShellStyle")) return;
    const style = document.createElement("style");
    style.id = "workBoardV100MobileShellStyle";
    style.textContent = `
      .work-mobile-header,
      .work-mobile-overlay,
      .work-mobile-status-tabs {
        display: none;
      }

      @media ${MOBILE_QUERY} {
        html,
        body {
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: hidden !important;
          background: #eaf7fb !important;
        }

        body {
          padding-top: 68px !important;
        }

        body.work-mobile-menu-open {
          overflow: hidden !important;
        }

        .work-mobile-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1200;
          height: 64px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          background: rgba(238, 250, 253, .94);
          border-bottom: 1px solid rgba(33, 82, 116, .12);
          box-shadow: 0 10px 26px rgba(19, 68, 98, .12);
          backdrop-filter: blur(14px);
        }

        .work-mobile-menu-button,
        .work-mobile-action-button {
          border: 1px solid rgba(33, 82, 116, .14);
          border-radius: 16px;
          background: #fff;
          color: #16344e;
          font-weight: 1000;
          box-shadow: 0 8px 18px rgba(17, 65, 97, .08);
          cursor: pointer;
        }

        .work-mobile-menu-button {
          width: 44px;
          height: 44px;
          font-size: 21px;
          line-height: 1;
        }

        .work-mobile-title {
          min-width: 0;
          flex: 1;
          display: flex;
          align-items: center;
          gap: 9px;
          color: #15334d;
          font-weight: 1000;
        }

        .work-mobile-title img {
          width: 34px;
          height: 34px;
          border-radius: 12px;
          object-fit: cover;
          flex: 0 0 34px;
        }

        .work-mobile-title-text {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .work-mobile-action-button {
          height: 44px;
          padding: 0 13px;
          background: linear-gradient(145deg, #ffe66a, #ffb33f);
        }

        .work-mobile-overlay {
          display: block;
          position: fixed;
          inset: 0;
          z-index: 1090;
          background: rgba(5, 30, 48, .42);
          opacity: 0;
          pointer-events: none;
          transition: opacity .2s ease;
        }

        body.work-mobile-menu-open .work-mobile-overlay {
          opacity: 1;
          pointer-events: auto;
        }

        .app-shell,
        .app-shell.detail-open {
          display: block !important;
          grid-template-columns: none !important;
          width: 100% !important;
          min-height: 100vh !important;
        }

        .sidebar {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          bottom: 0 !important;
          z-index: 1100 !important;
          width: min(88vw, 360px) !important;
          max-width: 360px !important;
          height: 100dvh !important;
          padding: 78px 18px 24px !important;
          overflow-y: auto !important;
          transform: translateX(-112%) !important;
          transition: transform .24s ease !important;
          border-radius: 0 28px 28px 0 !important;
          box-shadow: 18px 0 50px rgba(7, 44, 68, .28) !important;
        }

        body.work-mobile-menu-open .sidebar {
          transform: translateX(0) !important;
        }

        .sidebar .brand {
          margin-bottom: 18px !important;
        }

        .sidebar .brand-mark {
          width: 46px !important;
          height: 46px !important;
        }

        .sidebar .brand h1 {
          font-size: 20px !important;
        }

        .nav {
          gap: 8px !important;
        }

        .nav-item {
          min-height: 56px !important;
          padding: 10px 12px !important;
          border-radius: 17px !important;
          font-size: 15px !important;
        }

        .nav-icon {
          width: 42px !important;
          height: 42px !important;
          flex: 0 0 42px !important;
        }

        .side-card {
          padding: 13px !important;
          border-radius: 20px !important;
          margin-bottom: 14px !important;
        }

        .main {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          padding: 12px 12px 28px !important;
          overflow: visible !important;
        }

        .hero {
          min-height: 132px !important;
          border-radius: 26px !important;
          padding: 22px 20px 24px !important;
          margin: 0 0 14px !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          justify-content: flex-start !important;
          gap: 12px !important;
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
          font-size: 10px !important;
        }

        .hero h2 {
          margin: 0 !important;
          font-size: clamp(28px, 9vw, 38px) !important;
          line-height: 1.08 !important;
          max-width: 100% !important;
          white-space: normal !important;
        }

        .hero-room-badge,
        #roomNameBadge.hero-room-badge,
        .hero #roomNameBadge {
          position: relative !important;
          inset: auto !important;
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
          font-size: 13px !important;
          line-height: 1.35 !important;
          padding: 7px 11px !important;
        }

        .summary-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 10px !important;
          margin: 12px 0 !important;
        }

        .summary-card {
          min-width: 0 !important;
          padding: 13px !important;
          border-radius: 19px !important;
          gap: 10px !important;
        }

        .summary-icon {
          width: 48px !important;
          height: 48px !important;
          border-radius: 16px !important;
          flex: 0 0 48px !important;
        }

        .summary-card p {
          font-size: 12px !important;
        }

        .summary-card strong {
          font-size: 24px !important;
        }

        .toolbar {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 10px !important;
          margin: 12px 0 !important;
        }

        .toolbar-new-task,
        .toolbar .primary-button,
        .toolbar .ghost-button,
        .toolbar select,
        .quick-add,
        .search-box {
          width: 100% !important;
          max-width: 100% !important;
        }

        .quick-add {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          gap: 8px !important;
        }

        .quick-add input,
        .search-box input,
        .toolbar select {
          min-width: 0 !important;
        }

        .task-control-row,
        .schedule-actions,
        .segmented-buttons,
        .task-view-switcher,
        .stat-switcher {
          max-width: 100% !important;
        }

        .task-control-row {
          display: flex !important;
          gap: 10px !important;
          overflow-x: auto !important;
          padding: 2px 0 10px !important;
          margin-bottom: 10px !important;
          scrollbar-width: none !important;
        }

        .task-control-row::-webkit-scrollbar {
          display: none !important;
        }

        .task-view-switcher,
        .stat-switcher,
        .task-color-legend {
          flex: 0 0 auto !important;
        }

        .today-head {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 12px !important;
          padding: 18px !important;
          border-radius: 22px !important;
        }

        .today-head-actions {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 10px !important;
          width: 100% !important;
        }

        .today-head-actions button {
          width: 100% !important;
          min-height: 52px !important;
        }

        .today-grid {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 14px !important;
        }

        .today-panel {
          border-radius: 22px !important;
          overflow: hidden !important;
        }

        .today-panel h4 {
          padding: 15px 16px !important;
          font-size: 17px !important;
        }

        .today-panel-body {
          padding: 12px !important;
        }

        .activity-head {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 12px !important;
        }

        .activity-actions {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 10px !important;
        }

        .work-mobile-status-tabs {
          position: sticky !important;
          top: 68px !important;
          z-index: 8 !important;
          display: flex !important;
          gap: 8px !important;
          overflow-x: auto !important;
          padding: 8px 0 10px !important;
          margin: -2px 0 8px !important;
          background: linear-gradient(180deg, rgba(234,247,251,.98), rgba(234,247,251,.86)) !important;
          backdrop-filter: blur(10px) !important;
          scrollbar-width: none !important;
        }

        .work-mobile-status-tabs::-webkit-scrollbar {
          display: none !important;
        }

        .work-mobile-status-tab {
          flex: 0 0 auto !important;
          border: 1px solid rgba(30,84,120,.14) !important;
          border-radius: 999px !important;
          padding: 10px 13px !important;
          background: #fff !important;
          color: #254b66 !important;
          font-size: 13px !important;
          font-weight: 1000 !important;
          box-shadow: 0 8px 18px rgba(24,62,95,.07) !important;
        }

        .work-mobile-status-tab.active {
          background: linear-gradient(145deg, #ffe66a, #ffb33f) !important;
          color: #17304a !important;
          border-color: rgba(255,188,63,.55) !important;
        }

        .board-view {
          display: flex !important;
          grid-template-columns: none !important;
          flex-wrap: nowrap !important;
          gap: 12px !important;
          overflow-x: auto !important;
          overflow-y: visible !important;
          padding: 0 2px 14px !important;
          scroll-snap-type: x mandatory !important;
          -webkit-overflow-scrolling: touch !important;
          scrollbar-width: thin !important;
        }

        .board-view .board-column,
        .board-view .add-status-column {
          flex: 0 0 calc(100vw - 32px) !important;
          width: calc(100vw - 32px) !important;
          min-width: calc(100vw - 32px) !important;
          max-width: calc(100vw - 32px) !important;
          scroll-snap-align: start !important;
        }

        .column-head {
          position: sticky !important;
          top: 120px !important;
          z-index: 4 !important;
          background: rgba(248, 252, 255, .96) !important;
          backdrop-filter: blur(10px) !important;
        }

        .task-list {
          min-height: 0 !important;
          max-height: calc(100dvh - 260px) !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          padding-bottom: 16px !important;
        }

        .task-card {
          padding: 13px !important;
          border-radius: 18px !important;
        }

        .task-title {
          font-size: 16px !important;
          line-height: 1.45 !important;
        }

        .task-meta {
          gap: 7px !important;
          margin-bottom: 8px !important;
        }

        .badge,
        .user-badge {
          max-width: 100% !important;
        }

        .list-view {
          border: 0 !important;
          background: transparent !important;
          overflow: visible !important;
        }

        .task-table,
        .task-table tbody {
          display: block !important;
          width: 100% !important;
        }

        .task-table thead {
          display: none !important;
        }

        .task-table tbody {
          display: grid !important;
          gap: 10px !important;
        }

        .task-table tr {
          display: grid !important;
          grid-template-columns: 30px 34px minmax(0, 1fr) !important;
          gap: 7px 10px !important;
          align-items: center !important;
          background: rgba(255,255,255,.94) !important;
          border: 1px solid rgba(30,84,120,.12) !important;
          border-left: 5px solid #3f92df !important;
          border-radius: 18px !important;
          padding: 12px !important;
          box-shadow: 0 10px 22px rgba(24,62,95,.07) !important;
        }

        .task-table td {
          display: block !important;
          border: 0 !important;
          padding: 0 !important;
          min-width: 0 !important;
          font-size: 12px !important;
          word-break: break-word !important;
        }

        .task-table td:nth-child(1) { grid-column: 1; grid-row: 1; }
        .task-table td:nth-child(2) { grid-column: 2; grid-row: 1; }
        .task-table td:nth-child(3) { grid-column: 3; grid-row: 1; font-size: 15px !important; font-weight: 1000 !important; line-height: 1.45 !important; }
        .task-table td:nth-child(4) { grid-column: 3; grid-row: 2; justify-self: start; }
        .task-table td:nth-child(5) { grid-column: 3; grid-row: 3; justify-self: start; }
        .task-table td:nth-child(6) { grid-column: 3; grid-row: 4; justify-self: start; }
        .task-table td:nth-child(7) { grid-column: 3; grid-row: 5; justify-self: start; }
        .task-table td:nth-child(n+8) { display: none !important; }

        .task-table td:nth-child(4),
        .task-table td:nth-child(5),
        .task-table td:nth-child(6),
        .task-table td:nth-child(7) {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 6px !important;
          align-items: center !important;
        }

        .timeline-view {
          border-radius: 22px !important;
          overflow: hidden !important;
        }

        .timeline-toolbar {
          align-items: stretch !important;
          gap: 12px !important;
        }

        .timeline-actions {
          display: grid !important;
          grid-template-columns: repeat(3, 1fr) !important;
          width: 100% !important;
        }

        .timeline-scroller {
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch !important;
        }

        .timeline-grid {
          min-width: 720px !important;
          grid-template-columns: 100px repeat(var(--timeline-days), minmax(74px, 1fr)) !important;
        }

        .timeline-corner,
        .timeline-row-label {
          width: 100px !important;
          padding: 10px !important;
        }

        .timeline-row-label {
          font-size: 13px !important;
          min-height: 72px !important;
          display: grid !important;
        }

        .timeline-cell {
          min-height: 72px !important;
          padding: 6px !important;
        }

        .timeline-undated-list {
          grid-template-columns: 1fr !important;
        }

        .schedule-head {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 14px !important;
        }

        .schedule-actions {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 13px !important;
        }

        .schedule-control-group {
          min-width: 0 !important;
        }

        .schedule-control-group .segmented-buttons {
          display: grid !important;
          grid-template-columns: repeat(3, 1fr) !important;
          width: 100% !important;
        }

        .schedule-control-group .segmented-buttons button,
        .schedule-new-button {
          width: 100% !important;
          min-height: 50px !important;
        }

        .schedule-list {
          display: grid !important;
          gap: 12px !important;
        }

        .schedule-card {
          grid-template-columns: 72px minmax(0, 1fr) !important;
          border-radius: 18px !important;
          padding: 12px !important;
        }

        .schedule-calendar {
          overflow-x: auto !important;
          border-radius: 22px !important;
          -webkit-overflow-scrolling: touch !important;
        }

        .calendar-head,
        .calendar-weekdays,
        .calendar-grid {
          min-width: 520px !important;
        }

        .calendar-cell {
          min-height: 92px !important;
          padding: 7px !important;
        }

        .calendar-schedule {
          max-width: 100% !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .dialog {
          width: calc(100vw - 20px) !important;
          max-width: calc(100vw - 20px) !important;
          border-radius: 22px !important;
        }

        .dialog form {
          padding: 20px !important;
        }

        .form-grid,
        .template-row,
        .detail-grid {
          grid-template-columns: 1fr !important;
        }

        .dialog-actions {
          display: grid !important;
          grid-template-columns: 1fr !important;
        }

        .detail-panel {
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100dvh !important;
          z-index: 1300 !important;
          border-left: 0 !important;
        }

        .toast {
          left: 12px !important;
          right: 12px !important;
          bottom: 14px !important;
          text-align: center !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function installMobileShellControls() {
    if (document.getElementById("workMobileHeader")) return;
    if (!document.body) return;

    const overlay = document.createElement("button");
    overlay.type = "button";
    overlay.className = "work-mobile-overlay";
    overlay.setAttribute("aria-label", "メニューを閉じる");
    overlay.addEventListener("click", closeMobileMenu);

    const header = document.createElement("header");
    header.id = "workMobileHeader";
    header.className = "work-mobile-header";
    header.innerHTML = `
      <button type="button" class="work-mobile-menu-button" aria-label="メニューを開く" aria-expanded="false">☰</button>
      <div class="work-mobile-title">
        <img src="${BRAND_ICON}" alt="" />
        <span class="work-mobile-title-text">業務管理ボード</span>
      </div>
      <button type="button" class="work-mobile-action-button">＋</button>
    `;

    document.body.prepend(overlay);
    document.body.prepend(header);

    header.querySelector(".work-mobile-menu-button")?.addEventListener("click", () => {
      document.body.classList.toggle("work-mobile-menu-open");
      syncMobileMenuButton();
    });
    header.querySelector(".work-mobile-action-button")?.addEventListener("click", () => {
      document.getElementById("newTask")?.click();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMobileMenu();
    });
  }

  function closeMobileMenu() {
    document.body?.classList.remove("work-mobile-menu-open");
    syncMobileMenuButton();
  }

  function syncMobileMenuButton() {
    const button = document.querySelector(".work-mobile-menu-button");
    if (!button) return;
    const open = document.body?.classList.contains("work-mobile-menu-open");
    button.setAttribute("aria-expanded", open ? "true" : "false");
    button.textContent = open ? "×" : "☰";
  }

  function syncMobileHeaderTitle() {
    const title = document.querySelector(".work-mobile-title-text");
    const icon = document.querySelector(".work-mobile-title img");
    if (!title) return;
    const active = document.querySelector(".nav-item.active");
    const activeIcon = active?.querySelector("img")?.getAttribute("src");
    const activeText = active?.textContent?.trim() || "業務管理ボード";
    title.textContent = activeText;
    if (icon) icon.src = activeIcon || BRAND_ICON;
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
    hero.style.setProperty("gap", "12px", "important");
    hero.style.setProperty("min-height", "132px", "important");
    hero.style.setProperty("padding", "22px 20px 24px", "important");

    if (titleArea) {
      titleArea.style.setProperty("width", "100%", "important");
      titleArea.style.setProperty("max-width", "none", "important");
      titleArea.style.setProperty("padding-right", "0", "important");
    }
    if (title) {
      title.style.setProperty("font-size", "clamp(28px, 9vw, 38px)", "important");
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
    roomBadge.style.setProperty("font-size", "13px", "important");
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

  function getBoardColumnLabel(column) {
    const titleNode = column.querySelector(".column-title span:last-child") || column.querySelector(".column-head strong") || column.querySelector(".column-head");
    const raw = titleNode?.textContent || "状態";
    return raw.replace(/☰/g, "").replace(/\s+/g, " ").trim() || "状態";
  }

  function patchMobileBoardTabs() {
    const board = document.querySelector(".board-view");
    const isMobile = window.matchMedia(MOBILE_QUERY).matches;
    let tabs = document.querySelector(".work-mobile-status-tabs");

    if (!isMobile || !board || board.offsetParent === null) {
      if (tabs) tabs.remove();
      return;
    }

    const columns = [...board.querySelectorAll(".board-column")];
    if (!columns.length) {
      if (tabs) tabs.remove();
      return;
    }

    if (!tabs) {
      tabs = document.createElement("div");
      tabs.className = "work-mobile-status-tabs";
      board.parentNode?.insertBefore(tabs, board);
    } else if (tabs.nextElementSibling !== board) {
      board.parentNode?.insertBefore(tabs, board);
    }

    const signature = columns.map(column => `${getBoardColumnLabel(column)}:${column.querySelectorAll(".task-card").length}`).join("|");
    if (tabs.dataset.signature !== signature) {
      tabs.dataset.signature = signature;
      tabs.innerHTML = columns.map((column, index) => {
        const label = getBoardColumnLabel(column);
        const count = column.querySelectorAll(".task-card").length;
        return `<button type="button" class="work-mobile-status-tab ${index === 0 ? "active" : ""}" data-board-tab-index="${index}">${label} ${count}</button>`;
      }).join("");
      tabs.querySelectorAll("[data-board-tab-index]").forEach((button) => {
        button.addEventListener("click", () => {
          const index = Number(button.getAttribute("data-board-tab-index") || 0);
          columns[index]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
          tabs.querySelectorAll(".work-mobile-status-tab").forEach(item => item.classList.remove("active"));
          button.classList.add("active");
        });
      });
    }
  }

  function installRuntimeGuards() {
    if (window.__workBoardRuntimeGuardsInstalled) return;
    window.__workBoardRuntimeGuardsInstalled = true;

    document.addEventListener("click", (event) => {
      resetScheduleAnchorBeforeRollingWeek(event);

      if (event.target?.closest?.(".nav-item")) {
        setTimeout(closeMobileMenu, 0);
      }

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
        patchMobileBoardTabs();
        syncMobileHeaderTitle();
        syncMobileMenuButton();
      });
    };

    const startObserver = () => {
      if (!document.body) return;
      new MutationObserver(schedulePatch).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });
      schedulePatch();
    };

    if (document.body) startObserver();
    else document.addEventListener("DOMContentLoaded", startObserver, { once: true });

    window.addEventListener("storage", schedulePatch);
    window.addEventListener("resize", schedulePatch);
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

    installMobileShellStyle();
    installMobileShellControls();
    forceMobileHeroLayout();
    installRuntimeGuards();
    patchStatusManager();
    patchTodayView();
    patchDateInputs();
    patchScheduleRangeButtons();
    patchMobileBoardTabs();
    syncMobileHeaderTitle();
    syncMobileMenuButton();
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