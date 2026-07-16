// v104: 状態分類の横スクロールと、今日ビュー「空き時間」の担当者絞り込みを修正
(function applyMobileInteractionAndTodayFilterFix() {
  const VERSION = "104";
  const MOBILE_QUERY = "(max-width: 860px)";
  let scheduled = false;

  function isMobile() {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  function normalize(value) {
    return String(value || "").normalize("NFKC").trim().replace(/\s+/g, "").toLowerCase();
  }

  function installStyle() {
    if (document.getElementById("mobileInteractionFilterV104")) return;

    const style = document.createElement("style");
    style.id = "mobileInteractionFilterV104";
    style.textContent = `
      @media ${MOBILE_QUERY} {
        html,
        body:not(.work-mobile-menu-open) {
          touch-action: pan-x pan-y !important;
        }

        .work-mobile-status-tabs {
          overflow-x: auto !important;
          overflow-y: hidden !important;
          touch-action: pan-x !important;
          overscroll-behavior-x: contain !important;
          overscroll-behavior-y: none !important;
          -webkit-overflow-scrolling: touch !important;
          scroll-behavior: smooth !important;
          scroll-snap-type: x proximity !important;
          cursor: grab !important;
        }

        .work-mobile-status-tabs.is-dragging {
          cursor: grabbing !important;
          scroll-behavior: auto !important;
        }

        .work-mobile-status-tab {
          touch-action: pan-x !important;
          scroll-snap-align: start !important;
          user-select: none !important;
          -webkit-user-select: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function bindHorizontalStatusScroll() {
    if (!isMobile()) return;

    document.querySelectorAll(".work-mobile-status-tabs").forEach(row => {
      if (row.dataset.horizontalTouchV104 === "true") return;
      row.dataset.horizontalTouchV104 = "true";

      let startX = 0;
      let startY = 0;
      let startScrollLeft = 0;
      let direction = "";

      row.addEventListener("touchstart", event => {
        if (event.touches.length !== 1) return;
        const touch = event.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        startScrollLeft = row.scrollLeft;
        direction = "";
        row.classList.remove("is-dragging");
      }, { passive: true });

      row.addEventListener("touchmove", event => {
        if (event.touches.length !== 1) return;
        const touch = event.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        if (!direction) {
          if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
          direction = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
        }

        if (direction !== "horizontal") return;

        row.classList.add("is-dragging");
        row.scrollLeft = startScrollLeft - dx;
        event.preventDefault();
      }, { passive: false });

      const finish = () => {
        direction = "";
        row.classList.remove("is-dragging");
      };

      row.addEventListener("touchend", finish, { passive: true });
      row.addEventListener("touchcancel", finish, { passive: true });
    });
  }

  function getRoomId() {
    try {
      const queryRoom = new URLSearchParams(location.search).get("room");
      if (queryRoom) return String(queryRoom).replace(/[.#$/\[\]]/g, "-").slice(0, 60);
    } catch {}

    return localStorage.getItem("systemTaskRoomId") || "";
  }

  function loadTaskMap() {
    const roomId = getRoomId();
    const candidateKeys = [];

    if (roomId) candidateKeys.push(`system-task-tasks:${roomId}`);

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index) || "";
      if (key.startsWith("system-task-tasks:") && !candidateKeys.includes(key)) {
        candidateKeys.push(key);
      }
    }

    for (const key of candidateKeys) {
      try {
        const tasks = JSON.parse(localStorage.getItem(key) || "[]");
        if (!Array.isArray(tasks)) continue;
        return new Map(tasks.map(task => [String(task?.id || ""), task]));
      } catch {}
    }

    return new Map();
  }

  function isMineFilterActive() {
    return document.querySelector('.nav-item[data-filter="mine"]')?.classList.contains("active") === true;
  }

  function getCurrentUser() {
    return document.getElementById("currentUserSelect")?.value
      || localStorage.getItem("systemTaskUser")
      || document.getElementById("currentUserLabel")?.textContent?.trim()
      || "";
  }

  function isAllowedMineAssignee(assignee, currentUser) {
    const normalizedAssignee = normalize(assignee);
    const normalizedUser = normalize(currentUser);

    if (!normalizedAssignee) return false;
    if (normalizedUser && normalizedAssignee === normalizedUser) return true;

    return ["システム課", "システム", "全員", "共通"].some(group => {
      const normalizedGroup = normalize(group);
      return normalizedAssignee === normalizedGroup || normalizedAssignee.includes(normalizedGroup);
    });
  }

  function readAssigneeFromCard(card) {
    const selectors = [
      ".user-badge",
      ".task-assignee",
      "[data-assignee]",
      ".badge.assignee"
    ];

    for (const selector of selectors) {
      const element = card.querySelector(selector);
      if (!element) continue;
      return element.getAttribute("data-assignee") || element.textContent || "";
    }

    return "";
  }

  function patchSpareTimeMineFilter() {
    const todayView = document.getElementById("todayView");
    if (!todayView) return;

    const sparePanel = [...todayView.querySelectorAll(".today-panel")].find(panel => {
      return panel.querySelector("h4")?.textContent?.includes("空き時間にやるタスク");
    });

    if (!sparePanel) return;

    const mineActive = isMineFilterActive();
    const currentUser = getCurrentUser();
    const taskMap = loadTaskMap();

    sparePanel.querySelectorAll(".task-card[data-task-id]").forEach(card => {
      const taskId = String(card.getAttribute("data-task-id") || "");
      const task = taskMap.get(taskId);
      const assignee = task?.assignee || readAssigneeFromCard(card);
      const shouldHide = mineActive && !isAllowedMineAssignee(assignee, currentUser);

      if (shouldHide) {
        card.hidden = true;
        card.setAttribute("data-workboard-mine-hidden-v104", "true");
        return;
      }

      if (card.getAttribute("data-workboard-mine-hidden-v104") === "true") {
        card.removeAttribute("data-workboard-mine-hidden-v104");
        if (card.getAttribute("data-workboard-auto-hidden") !== "true") {
          card.hidden = false;
        }
      }
    });
  }

  function setVersion() {
    document.querySelectorAll(".app-version").forEach(element => {
      element.textContent = `Ver.${VERSION}`;
      element.title = `現在のバージョン Ver.${VERSION}`;
    });
  }

  function applyFixes() {
    installStyle();
    bindHorizontalStatusScroll();
    patchSpareTimeMineFilter();
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
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  };

  if (document.body) startObserver();
  else document.addEventListener("DOMContentLoaded", startObserver, { once: true });

  window.addEventListener("storage", scheduleFixes);
  window.addEventListener("resize", scheduleFixes);
  window.addEventListener("orientationchange", () => setTimeout(scheduleFixes, 120));
  setTimeout(scheduleFixes, 300);
  setTimeout(scheduleFixes, 1000);
})();