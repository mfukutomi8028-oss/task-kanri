// Ver.210: 安定版補正。Today最終可視性と状態タブ保護は本ファイル、native日付制約・segmented入力は date-keyboard-fix-v127.js、状態削除保護は app.js、状態タブの通常レイアウトと横スクロールは mobile-fixes.js、スケジュール表示ラベルは schedule-today-lock-v129.js が所有する。非意味的なviewport/pageshow/遅延/status-tab full passは退役済み。
(function applyStableFixesV108() {
  const MOBILE_QUERY = "(max-width: 860px)";
  const GROUP_ASSIGNEES = ["システム課", "システム担当", "システム", "全員", "共通"];
  let scheduled = false;
  let todayScheduled = false;

  function normalize(value) {
    return String(value || "").normalize("NFKC").trim().replace(/\s+/g, "").toLowerCase();
  }

  function installStyle() {
    if (document.getElementById("stableFixesV108Style")) return;
    const style = document.createElement("style");
    style.id = "stableFixesV108Style";
    style.textContent = `
      @media ${MOBILE_QUERY} {
        .work-mobile-status-tabs {
          flex-wrap: nowrap !important;
          width: 100% !important;
          max-width: 100% !important;
          overflow-y: hidden !important;
          touch-action: auto !important;
          -webkit-overflow-scrolling: touch !important;
          overscroll-behavior: auto !important;
          scroll-behavior: auto !important;
          scroll-snap-type: none !important;
        }
        .work-mobile-status-tab {
          touch-action: auto !important;
          scroll-snap-align: none !important;
          user-select: none !important;
          -webkit-user-select: none !important;
        }
        .board-view .column-head {
          position: static !important;
          top: auto !important;
          inset: auto !important;
        }
        .board-view,
        .board-view .board-column,
        .board-view .task-list {
          height: auto !important;
          max-height: none !important;
          overflow-y: visible !important;
        }
      }
      #todayView [data-v108-hidden] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function setVersion() {
    const version = String(window.WORK_BOARD_RELEASE?.version || "");
    if (!/^(?:0|[1-9]\d*)$/.test(version)) return;
    const expected = `Ver.${version}`;
    document.querySelectorAll(".app-version").forEach(element => {
      if (element.textContent !== expected) element.textContent = expected;
      element.title = `現在のバージョン ${expected}`;
    });
  }

  function getRoomId() {
    try {
      const queryRoom = new URLSearchParams(location.search).get("room");
      if (queryRoom) return String(queryRoom).replace(/[.#$/\[\]]/g, "-").slice(0, 60);
    } catch {}
    return localStorage.getItem("systemTaskRoomId") || "";
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

  function isAllowedAssignee(assignee, currentUser) {
    const normalizedAssignee = normalize(assignee);
    if (!normalizedAssignee) return false;
    if (normalizedAssignee === normalize(currentUser)) return true;
    return GROUP_ASSIGNEES.some(group => normalizedAssignee === normalize(group));
  }

  function applyTodayFilters() {
    const todayView = document.getElementById("todayView");
    if (!todayView || todayView.hidden) return;

    const mineActive = mineFilterIsActive();
    const currentUser = getCurrentUser();
    const taskMap = new Map(readStoredArray("system-task-tasks").map(item => [String(item?.id || ""), item]));
    const scheduleMap = new Map(readStoredArray("system-task-schedules").map(item => [String(item?.id || ""), item]));

    todayView.querySelectorAll(".task-card[data-task-id]").forEach(card => {
      const task = taskMap.get(String(card.getAttribute("data-task-id") || ""));
      const panelTitle = card.closest(".today-panel")?.querySelector("h4")?.textContent || "";
      const status = normalize(task?.status);
      const hiddenByStatus = status === normalize("保留")
        || (panelTitle.includes("空き時間") && status === normalize("確認待ち"));
      const hiddenByMine = mineActive && task && !isAllowedAssignee(task.assignee, currentUser);
      const shouldHide = Boolean(hiddenByStatus || hiddenByMine);
      card.hidden = shouldHide;
      card.toggleAttribute("data-v108-hidden", shouldHide);
    });

    todayView.querySelectorAll(".schedule-card[data-schedule-id]").forEach(card => {
      const schedule = scheduleMap.get(String(card.getAttribute("data-schedule-id") || ""));
      const shouldHide = Boolean(mineActive && schedule && !isAllowedAssignee(schedule.assignee, currentUser));
      card.hidden = shouldHide;
      card.toggleAttribute("data-v108-hidden", shouldHide);
    });
  }

  function applyFixes() {
    installStyle();
    applyTodayFilters();
    setVersion();
  }

  function scheduleFixes() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyFixes();
    });
  }

  function scheduleTodayFilters() {
    if (todayScheduled) return;
    todayScheduled = true;
    requestAnimationFrame(() => {
      todayScheduled = false;
      applyTodayFilters();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyFixes, { once: true });
  } else {
    applyFixes();
  }

  const startObservers = () => {
    const todayView = document.getElementById("todayView");
    if (todayView) {
      new MutationObserver(scheduleTodayFilters).observe(todayView, {
        childList: true,
        subtree: true
      });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObservers, { once: true });
  } else {
    startObservers();
  }

  document.addEventListener("click", event => {
    if (event.target.closest?.('.nav-filter[data-filter="mine"], .nav-item[data-layout]')) {
      setTimeout(scheduleFixes, 0);
      setTimeout(scheduleFixes, 120);
    }
  }, true);

  document.addEventListener("change", event => {
    if (event.target.matches?.("#currentUserSelect, #startupUser")) setTimeout(scheduleFixes, 0);
  }, true);
})();