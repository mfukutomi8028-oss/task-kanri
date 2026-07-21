// v110: 安定版補正（再帰監視なし・標準スクロール・共通の安全制御）
(function applyStableFixesV108() {
  const VERSION = "110";
  const MOBILE_QUERY = "(max-width: 860px)";
  const GROUP_ASSIGNEES = ["システム課", "システム担当", "システム", "全員", "共通"];
  const PROTECTED_STATUSES = ["未着手", "対応中", "確認待ち", "保留", "完了"];
  const DATE_MIN = "1900-01-01";
  const DATE_MAX = "9999-12-31";
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
      }
      #todayView [data-v108-hidden="true"] {
        display: none !important;
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

  function isProtectedStatus(status) {
    return PROTECTED_STATUSES.some(item => normalize(item) === normalize(status));
  }

  function patchStatusManager() {
    document.querySelectorAll("[data-delete-status]").forEach(button => {
      const status = button.getAttribute("data-delete-status") || "";
      if (!isProtectedStatus(status)) return;
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
      button.title = `${status}は基本状態のため削除できません`;
    });
  }

  function patchDateInputs() {
    document.querySelectorAll('input[type="date"], input[type="datetime-local"]').forEach(input => {
      if (input.type === "date") {
        input.min = DATE_MIN;
        input.max = DATE_MAX;
        input.setAttribute("maxlength", "10");
      } else {
        input.min = `${DATE_MIN}T00:00`;
        input.max = `${DATE_MAX}T23:59`;
      }
      if (input.__stableDateV108) return;
      input.__stableDateV108 = true;
      const clamp = () => {
        const match = String(input.value || "").match(/^(\d{4,})(-\d{2}-\d{2})(.*)$/);
        if (!match) return;
        input.value = `${match[1].slice(0, 4)}${match[2]}${match[3] || ""}`;
      };
      input.addEventListener("input", clamp);
      input.addEventListener("change", clamp);
    });
  }

  function patchScheduleRangeLabel() {
    document.querySelectorAll('[data-schedule-range="week"]').forEach(button => {
      if (button.textContent.trim() !== "7日間") button.textContent = "7日間";
      button.title = "今日から7日間を表示します";
    });
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
    patchStatusTabAutoScroll();
    patchStatusManager();
    patchDateInputs();
    patchScheduleRangeLabel();
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
    const deleteButton = event.target.closest?.("[data-delete-status]");
    if (deleteButton) {
      const status = deleteButton.getAttribute("data-delete-status") || "";
      if (isProtectedStatus(status)) {
        event.preventDefault();
        event.stopPropagation();
        alert(`${status}は基本状態のため削除できません。`);
        return;
      }
    }

    if (event.target.closest?.('.nav-filter[data-filter="mine"], .nav-item[data-layout], .work-mobile-status-tab')) {
      setTimeout(scheduleFixes, 0);
      setTimeout(scheduleFixes, 120);
    }
  }, true);

  document.addEventListener("change", event => {
    if (event.target.matches?.("#currentUserSelect, #startupUser")) setTimeout(scheduleFixes, 0);
  }, true);

  window.addEventListener("resize", scheduleFixes);
  window.addEventListener("orientationchange", () => setTimeout(scheduleFixes, 120));
  window.addEventListener("pageshow", scheduleFixes);
  setTimeout(scheduleFixes, 300);
  setTimeout(scheduleFixes, 1200);
})();