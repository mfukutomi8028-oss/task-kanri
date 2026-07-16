// v108: 安定版補正（再帰監視なし・標準スクロール・今日ビュー担当者絞り込み）
(function applyStableFixesV108() {
  const VERSION = "108";
  const MOBILE_QUERY = "(max-width: 860px)";
  const GROUP_ASSIGNEES = ["システム課", "システム担当", "システム", "全員", "共通"];
  let scheduled = false;

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
          display: flex !important;
          flex-wrap: nowrap !important;
          gap: 8px !important;
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          touch-action: auto !important;
          -webkit-overflow-scrolling: touch !important;
          overscroll-behavior: auto !important;
          scroll-behavior: auto !important;
          scroll-snap-type: none !important;
          scrollbar-width: none !important;
        }
        .work-mobile-status-tabs::-webkit-scrollbar {
          display: none !important;
        }
        .work-mobile-status-tab {
          flex: 0 0 auto !important;
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
        #todayView [data-v108-mine-hidden="true"] {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function setVersion() {
    const expected = `Ver.${VERSION}`;
    window.WORK_BOARD_VERSION = VERSION;
    document.querySelectorAll(".app-version").forEach(element => {
      if (element.textContent !== expected) element.textContent = expected;
      element.title = `現在のバージョン ${expected}`;
    });
  }

  function patchStatusTabAutoScroll() {
    document.querySelectorAll(".work-mobile-status-tab").forEach(button => {
      if (button.__stableScrollIntoViewV108) return;
      button.__stableScrollIntoViewV108 = true;
      button.scrollIntoView = function scrollTabOnlyHorizontally() {
        const row = button.closest(".work-mobile-status-tabs");
        if (!row) return;
        const left = button.offsetLeft - ((row.clientWidth - button.offsetWidth) / 2);
        row.scrollLeft = Math.max(0, left);
      };
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

  function setMineVisibility(element, allowed, mineActive) {
    if (mineActive && !allowed) {
      element.hidden = true;
      element.setAttribute("data-v108-mine-hidden", "true");
      return;
    }
    if (element.getAttribute("data-v108-mine-hidden") === "true") {
      element.removeAttribute("data-v108-mine-hidden");
      element.hidden = false;
    }
  }

  function applyMineFilterAcrossTodayView() {
    const todayView = document.getElementById("todayView");
    if (!todayView || todayView.hidden) return;

    const mineActive = mineFilterIsActive();
    const currentUser = getCurrentUser();
    const taskMap = new Map(readStoredArray("system-task-tasks").map(item => [String(item?.id || ""), item]));
    const scheduleMap = new Map(readStoredArray("system-task-schedules").map(item => [String(item?.id || ""), item]));

    todayView.querySelectorAll(".task-card[data-task-id]").forEach(card => {
      const task = taskMap.get(String(card.getAttribute("data-task-id") || ""));
      setMineVisibility(card, task ? isAllowedAssignee(task.assignee, currentUser) : true, mineActive);
    });

    todayView.querySelectorAll(".schedule-card[data-schedule-id]").forEach(card => {
      const schedule = scheduleMap.get(String(card.getAttribute("data-schedule-id") || ""));
      setMineVisibility(card, schedule ? isAllowedAssignee(schedule.assignee, currentUser) : true, mineActive);
    });
  }

  function applyFixes() {
    installStyle();
    patchStatusTabAutoScroll();
    applyMineFilterAcrossTodayView();
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyFixes, { once: true });
  } else {
    applyFixes();
  }

  const startObserver = () => {
    if (!document.body) return;
    new MutationObserver(scheduleFixes).observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  if (document.body) startObserver();
  else document.addEventListener("DOMContentLoaded", startObserver, { once: true });

  document.addEventListener("click", event => {
    if (event.target.closest('.nav-filter[data-filter="mine"], .nav-item[data-layout], .work-mobile-status-tab')) {
      setTimeout(scheduleFixes, 0);
      setTimeout(scheduleFixes, 120);
    }
  }, true);

  document.addEventListener("change", event => {
    if (event.target.matches("#currentUserSelect, #startupUser")) setTimeout(scheduleFixes, 0);
  }, true);

  window.addEventListener("resize", scheduleFixes);
  window.addEventListener("orientationchange", () => setTimeout(scheduleFixes, 120));
  window.addEventListener("pageshow", scheduleFixes);
  setTimeout(scheduleFixes, 300);
  setTimeout(scheduleFixes, 1200);
})();