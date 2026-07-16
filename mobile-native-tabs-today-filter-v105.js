// v105: 状態タブをブラウザ標準の横スクロールへ戻し、今日ビュー全体へ自分の担当を適用
(function applyNativeTabsAndTodayMineFilter() {
  const VERSION = "105";
  const MOBILE_QUERY = "(max-width: 860px)";
  const ACTIVE_STATUS_KEY = "workBoardMobileBoardStatusIndex";
  const GROUP_ASSIGNEES = ["システム課", "システム担当", "システム", "全員", "共通"];
  let scheduled = false;

  function isMobile() {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  function normalize(value) {
    return String(value || "").normalize("NFKC").trim().replace(/\s+/g, "").toLowerCase();
  }

  function installStyle() {
    if (document.getElementById("nativeTabsTodayFilterV105")) return;

    const style = document.createElement("style");
    style.id = "nativeTabsTodayFilterV105";
    style.textContent = `
      @media ${MOBILE_QUERY} {
        .work-mobile-status-tabs {
          display: flex !important;
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          touch-action: pan-x !important;
          -webkit-overflow-scrolling: touch !important;
          overscroll-behavior-x: contain !important;
          overscroll-behavior-y: none !important;
          scroll-behavior: auto !important;
          scroll-snap-type: none !important;
          scrollbar-width: none !important;
          user-select: none !important;
          -webkit-user-select: none !important;
        }

        .work-mobile-status-tabs::-webkit-scrollbar {
          display: none !important;
        }

        .work-mobile-status-tab {
          flex: 0 0 auto !important;
          touch-action: manipulation !important;
          scroll-snap-align: none !important;
          -webkit-user-select: none !important;
          user-select: none !important;
        }

        .work-mobile-status-tabs.is-dragging {
          cursor: auto !important;
        }

        #todayView [data-v105-mine-hidden="true"] {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function activateBoardColumn(index, row) {
    const board = document.querySelector(".board-view");
    if (!board || !row) return;

    const columns = [...board.querySelectorAll(".board-column")];
    if (!columns.length) return;

    const safeIndex = Math.max(0, Math.min(columns.length - 1, Number(index) || 0));
    localStorage.setItem(ACTIVE_STATUS_KEY, String(safeIndex));

    columns.forEach((column, columnIndex) => {
      column.classList.toggle("work-mobile-active-column", columnIndex === safeIndex);
    });

    row.querySelectorAll(".work-mobile-status-tab").forEach((button, buttonIndex) => {
      button.classList.toggle("active", buttonIndex === safeIndex);
    });

    const activeButton = row.querySelector(`.work-mobile-status-tab[data-board-tab-index="${safeIndex}"]`);
    if (activeButton) {
      const left = activeButton.offsetLeft - ((row.clientWidth - activeButton.offsetWidth) / 2);
      row.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    }
  }

  function restoreNativeStatusTabs() {
    if (!isMobile()) return;

    const currentRow = document.querySelector(".work-mobile-status-tabs");
    if (!currentRow || currentRow.dataset.nativeScrollV105 === "true") return;

    const previousScrollLeft = currentRow.scrollLeft;
    const replacement = currentRow.cloneNode(true);

    // v104の自前touchmoveが再登録されないよう、登録済み印を引き継ぎます。
    replacement.dataset.horizontalTouchV104 = "true";
    replacement.dataset.nativeScrollV105 = "true";
    replacement.classList.remove("is-dragging");

    replacement.addEventListener("click", event => {
      const button = event.target.closest(".work-mobile-status-tab[data-board-tab-index]");
      if (!button) return;
      const index = Number(button.getAttribute("data-board-tab-index") || 0);
      activateBoardColumn(index, replacement);
    });

    currentRow.replaceWith(replacement);
    replacement.scrollLeft = previousScrollLeft;
  }

  function getRoomId() {
    try {
      const queryRoom = new URLSearchParams(location.search).get("room");
      if (queryRoom) return String(queryRoom).replace(/[.#$/\[\]]/g, "-").slice(0, 60);
    } catch {}

    const saved = localStorage.getItem("systemTaskRoomId");
    if (saved) return saved;

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index) || "";
      if (key.startsWith("system-task-tasks:")) return key.replace("system-task-tasks:", "");
    }
    return "";
  }

  function readStoredArray(prefix) {
    const roomId = getRoomId();
    const keys = roomId ? [`${prefix}:${roomId}`] : [];

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index) || "";
      if (key.startsWith(`${prefix}:`) && !keys.includes(key)) keys.push(key);
    }

    for (const key of keys) {
      try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(value)) return value;
      } catch {}
    }
    return [];
  }

  function getCurrentUser() {
    return document.getElementById("currentUserSelect")?.value
      || localStorage.getItem("systemTaskUser")
      || document.getElementById("currentUserLabel")?.textContent
      || "";
  }

  function mineFilterIsActive() {
    return Boolean(document.querySelector('.nav-filter[data-filter="mine"].active'));
  }

  function isAllowedMineAssignee(assignee, currentUser) {
    const normalizedAssignee = normalize(assignee);
    if (!normalizedAssignee) return false;
    if (normalizedAssignee === normalize(currentUser)) return true;
    return GROUP_ASSIGNEES.some(group => normalizedAssignee === normalize(group));
  }

  function setMineVisibility(element, allowed, mineActive) {
    if (mineActive && !allowed) {
      element.hidden = true;
      element.setAttribute("data-v105-mine-hidden", "true");
      return;
    }

    if (element.getAttribute("data-v105-mine-hidden") === "true") {
      element.removeAttribute("data-v105-mine-hidden");
      element.hidden = false;
    }
  }

  function applyMineFilterAcrossTodayView() {
    const todayView = document.getElementById("todayView");
    if (!todayView || todayView.hidden) return;

    const mineActive = mineFilterIsActive();
    const currentUser = getCurrentUser();
    const tasks = readStoredArray("system-task-tasks");
    const schedules = readStoredArray("system-task-schedules");
    const taskMap = new Map(tasks.map(task => [String(task?.id || ""), task]));
    const scheduleMap = new Map(schedules.map(schedule => [String(schedule?.id || ""), schedule]));

    todayView.querySelectorAll(".task-card[data-task-id]").forEach(card => {
      const task = taskMap.get(String(card.getAttribute("data-task-id") || ""));
      const allowed = task ? isAllowedMineAssignee(task.assignee, currentUser) : true;
      setMineVisibility(card, allowed, mineActive);
    });

    todayView.querySelectorAll(".schedule-card[data-schedule-id]").forEach(card => {
      const schedule = scheduleMap.get(String(card.getAttribute("data-schedule-id") || ""));
      const allowed = schedule ? isAllowedMineAssignee(schedule.assignee, currentUser) : true;
      setMineVisibility(card, allowed, mineActive);
    });
  }

  function setVersion() {
    document.querySelectorAll(".app-version").forEach(element => {
      element.textContent = `Ver.${VERSION}`;
      element.title = `現在のバージョン Ver.${VERSION}`;
    });
  }

  function applyFix() {
    installStyle();
    restoreNativeStatusTabs();
    applyMineFilterAcrossTodayView();
    setVersion();
  }

  function scheduleFix() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyFix();
    });
  }

  document.addEventListener("click", event => {
    if (event.target.closest('.nav-filter[data-filter="mine"], .nav-item[data-layout], .work-mobile-status-tab')) {
      setTimeout(scheduleFix, 0);
      setTimeout(scheduleFix, 120);
    }
  }, true);

  document.addEventListener("change", event => {
    if (event.target.matches("#currentUserSelect, #startupUser")) setTimeout(scheduleFix, 0);
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyFix, { once: true });
  } else {
    applyFix();
  }

  const startObserver = () => {
    if (!document.body) return;
    new MutationObserver(scheduleFix).observe(document.body, { childList: true, subtree: true });
  };

  if (document.body) startObserver();
  else document.addEventListener("DOMContentLoaded", startObserver, { once: true });

  window.addEventListener("resize", scheduleFix);
  window.addEventListener("orientationchange", () => setTimeout(scheduleFix, 120));
  window.addEventListener("storage", scheduleFix);
  setTimeout(scheduleFix, 300);
  setTimeout(scheduleFix, 1000);
})();