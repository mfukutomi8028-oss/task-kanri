// Ver.214: 安定版補正。Today最終可視性の意味論と data-v108-hidden の付与・解除は本ファイル、最終非表示CSSは ui-core-density-v188.css、状態タブの通常レイアウト・保護CSS・横スクロールは mobile-fixes.js、version表示は release-manifest.js + version-display-lock.js、native日付制約・segmented入力は date-keyboard-fix-v127.js、状態削除保護は app.js、スケジュール表示ラベルは schedule-today-lock-v129.js が所有する。native hidden書込はVer.214で退役し、Today表示制御は data-v108-hidden + core CSSを正本とする。
(function applyStableFixesV108() {
  const GROUP_ASSIGNEES = ["システム課", "システム担当", "システム", "全員", "共通"];
  let todayScheduled = false;

  function normalize(value) {
    return String(value || "").normalize("NFKC").trim().replace(/\s+/g, "").toLowerCase();
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
      card.toggleAttribute("data-v108-hidden", shouldHide);
    });

    todayView.querySelectorAll(".schedule-card[data-schedule-id]").forEach(card => {
      const schedule = scheduleMap.get(String(card.getAttribute("data-schedule-id") || ""));
      const shouldHide = Boolean(mineActive && schedule && !isAllowedAssignee(schedule.assignee, currentUser));
      card.toggleAttribute("data-v108-hidden", shouldHide);
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
    document.addEventListener("DOMContentLoaded", applyTodayFilters, { once: true });
  } else {
    applyTodayFilters();
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
      setTimeout(scheduleTodayFilters, 0);
      setTimeout(scheduleTodayFilters, 120);
    }
  }, true);

  document.addEventListener("change", event => {
    if (event.target.matches?.("#currentUserSelect, #startupUser")) setTimeout(scheduleTodayFilters, 0);
  }, true);
})();