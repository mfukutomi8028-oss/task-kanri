// v101: スマホ版の操作性改善（ボード切替、一覧操作列、タスク/予定追加）
(function applyMobileUsabilityFixes() {
  const VERSION = "101";
  const MOBILE_QUERY = "(max-width: 860px)";
  const STORAGE_ACTIVE_STATUS = "workBoardMobileBoardStatusIndex";

  function isMobile() {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  function installStyle() {
    if (document.getElementById("mobileUsabilityFixV101")) return;

    const style = document.createElement("style");
    style.id = "mobileUsabilityFixV101";
    style.textContent = `
      .work-mobile-create-menu {
        display: none;
      }

      @media ${MOBILE_QUERY} {
        .work-mobile-action-button {
          width: 48px !important;
          padding: 0 !important;
          font-size: 22px !important;
        }

        .work-mobile-create-menu {
          position: fixed !important;
          top: 58px !important;
          right: 10px !important;
          z-index: 1210 !important;
          width: min(260px, calc(100vw - 20px)) !important;
          padding: 10px !important;
          border: 1px solid rgba(33, 82, 116, .12) !important;
          border-radius: 20px !important;
          background: rgba(255,255,255,.98) !important;
          box-shadow: 0 20px 44px rgba(16, 54, 80, .20) !important;
          backdrop-filter: blur(14px) !important;
        }

        .work-mobile-create-menu.open {
          display: grid !important;
          gap: 8px !important;
        }

        .work-mobile-create-menu button {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          width: 100% !important;
          min-height: 48px !important;
          padding: 12px 14px !important;
          border: 1px solid rgba(33, 82, 116, .14) !important;
          border-radius: 16px !important;
          background: #fff !important;
          color: #16344e !important;
          font-weight: 1000 !important;
          text-align: left !important;
          box-shadow: none !important;
        }

        .work-mobile-create-menu small {
          display: block !important;
          margin-top: 3px !important;
          color: #6e8495 !important;
          font-size: 11px !important;
          font-weight: 900 !important;
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
          display: block !important;
          grid-template-columns: none !important;
          width: 100% !important;
          max-width: 100% !important;
          overflow: visible !important;
          padding: 0 !important;
        }

        .board-view .board-column,
        .board-view .add-status-column {
          display: none !important;
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          margin: 0 !important;
          scroll-snap-align: none !important;
        }

        .board-view .board-column.work-mobile-active-column,
        .board-view .add-status-column.work-mobile-active-column {
          display: block !important;
        }

        .board-view .column-head {
          position: sticky !important;
          top: 118px !important;
          z-index: 4 !important;
          background: rgba(248, 252, 255, .96) !important;
          backdrop-filter: blur(10px) !important;
        }

        .board-view .task-list {
          min-height: 0 !important;
          max-height: none !important;
          overflow: visible !important;
          padding: 12px !important;
          padding-bottom: 16px !important;
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
          grid-template-columns: 42px minmax(0, 1fr) auto !important;
          gap: 7px 10px !important;
          align-items: start !important;
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

        .task-table td:nth-child(1) {
          grid-column: 1 !important;
          grid-row: 1 !important;
          align-self: start !important;
          justify-self: center !important;
        }

        .task-table td:nth-child(2) {
          grid-column: 1 !important;
          grid-row: 2 !important;
          align-self: start !important;
          justify-self: center !important;
        }

        .task-table td:nth-child(1) input[type="checkbox"] {
          width: 22px !important;
          height: 22px !important;
          min-width: 22px !important;
          min-height: 22px !important;
          transform: scale(1.18) !important;
          accent-color: #3f92df !important;
        }

        .task-table td:nth-child(2) button,
        .task-table td:nth-child(2) .pin,
        .task-table td:nth-child(2) [data-favorite-task] {
          width: 34px !important;
          height: 34px !important;
          min-width: 34px !important;
          display: inline-grid !important;
          place-items: center !important;
        }

        .task-table td:nth-child(3) {
          grid-column: 2 / 4 !important;
          grid-row: 1 !important;
          font-size: 15px !important;
          font-weight: 1000 !important;
          line-height: 1.45 !important;
          padding-right: 4px !important;
        }

        .task-table td:nth-child(4) { grid-column: 2 / 4 !important; grid-row: 2 !important; justify-self: start; }
        .task-table td:nth-child(5) { grid-column: 2 !important; grid-row: 3 !important; justify-self: start; }
        .task-table td:nth-child(6) { grid-column: 3 !important; grid-row: 3 !important; justify-self: end; }
        .task-table td:nth-child(7) { grid-column: 2 / 4 !important; grid-row: 4 !important; justify-self: start; }
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
      }
    `;
    document.head.appendChild(style);
  }

  function getBoardColumnLabel(column) {
    const titleNode = column.querySelector(".column-title span:last-child") || column.querySelector(".column-head strong") || column.querySelector(".column-head");
    const raw = titleNode?.textContent || "状態";
    return raw.replace(/☰/g, "").replace(/\s+/g, " ").trim() || "状態";
  }

  function getActiveIndex(columns) {
    const saved = Number(localStorage.getItem(STORAGE_ACTIVE_STATUS) || 0);
    if (Number.isNaN(saved)) return 0;
    return Math.max(0, Math.min(columns.length - 1, saved));
  }

  function setActiveIndex(index) {
    localStorage.setItem(STORAGE_ACTIVE_STATUS, String(index));
  }

  function patchMobileBoardTabs() {
    const board = document.querySelector(".board-view");
    let tabs = document.querySelector(".work-mobile-status-tabs");

    if (!isMobile() || !board || board.offsetParent === null) {
      if (tabs) tabs.remove();
      document.querySelectorAll(".work-mobile-active-column").forEach(column => column.classList.remove("work-mobile-active-column"));
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
        return `<button type="button" class="work-mobile-status-tab" data-board-tab-index="${index}">${label} ${count}</button>`;
      }).join("");
      tabs.querySelectorAll("[data-board-tab-index]").forEach(button => {
        button.addEventListener("click", () => {
          const index = Number(button.getAttribute("data-board-tab-index") || 0);
          setActiveIndex(index);
          applyActiveColumn(index, true);
        });
      });
    }

    applyActiveColumn(getActiveIndex(columns), false);
  }

  function applyActiveColumn(activeIndex, scrollToTabs) {
    const board = document.querySelector(".board-view");
    const tabs = document.querySelector(".work-mobile-status-tabs");
    if (!board || !tabs) return;
    const columns = [...board.querySelectorAll(".board-column")];
    if (!columns.length) return;

    activeIndex = Math.max(0, Math.min(columns.length - 1, activeIndex));
    columns.forEach((column, index) => column.classList.toggle("work-mobile-active-column", index === activeIndex));
    tabs.querySelectorAll(".work-mobile-status-tab").forEach((button, index) => button.classList.toggle("active", index === activeIndex));
    tabs.querySelector(`.work-mobile-status-tab[data-board-tab-index="${activeIndex}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    if (scrollToTabs) tabs.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function ensureCreateMenu() {
    const header = document.getElementById("workMobileHeader");
    const actionButton = document.querySelector(".work-mobile-action-button");
    if (!header || !actionButton || document.getElementById("workMobileCreateMenu")) return;

    actionButton.setAttribute("aria-expanded", "false");
    actionButton.setAttribute("aria-controls", "workMobileCreateMenu");

    const menu = document.createElement("div");
    menu.id = "workMobileCreateMenu";
    menu.className = "work-mobile-create-menu";
    menu.innerHTML = `
      <button type="button" data-mobile-create="task"><span>＋ 新しいタスク<small>作業・依頼を登録</small></span><strong>›</strong></button>
      <button type="button" data-mobile-create="schedule"><span>＋ 新しい予定<small>時間指定の予定を登録</small></span><strong>›</strong></button>
    `;
    header.appendChild(menu);

    actionButton.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const open = !menu.classList.contains("open");
      menu.classList.toggle("open", open);
      actionButton.setAttribute("aria-expanded", open ? "true" : "false");
    }, true);

    menu.querySelector("[data-mobile-create='task']")?.addEventListener("click", () => {
      closeCreateMenu();
      openNewTask();
    });

    menu.querySelector("[data-mobile-create='schedule']")?.addEventListener("click", () => {
      closeCreateMenu();
      openNewSchedule();
    });

    document.addEventListener("click", event => {
      if (!event.target?.closest?.("#workMobileHeader")) closeCreateMenu();
    });
  }

  function closeCreateMenu() {
    document.getElementById("workMobileCreateMenu")?.classList.remove("open");
    document.querySelector(".work-mobile-action-button")?.setAttribute("aria-expanded", "false");
  }

  function openNewTask() {
    const selectors = ["[data-new-task]", "#newTask", ".toolbar-new-task"];
    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button) {
        button.click();
        return;
      }
    }
  }

  function openNewSchedule() {
    const tryOpen = () => {
      const button = document.querySelector("[data-new-schedule]");
      if (button) {
        button.click();
        return true;
      }
      return false;
    };

    if (tryOpen()) return;
    document.querySelector(".nav-item[data-layout='schedule'], [data-layout='schedule']")?.click();
    setTimeout(tryOpen, 80);
    setTimeout(tryOpen, 220);
    setTimeout(tryOpen, 500);
  }

  function patchVersion() {
    document.querySelectorAll(".app-version").forEach(element => {
      element.textContent = `Ver.${VERSION}`;
      element.title = `現在のバージョン Ver.${VERSION}`;
    });
  }

  function patchAll() {
    installStyle();
    patchMobileBoardTabs();
    ensureCreateMenu();
    patchVersion();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", patchAll, { once: true });
  } else {
    patchAll();
  }

  let scheduled = false;
  const schedulePatch = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      patchAll();
    });
  };

  const startObserver = () => {
    if (!document.body) return;
    new MutationObserver(schedulePatch).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });
  };

  if (document.body) startObserver();
  else document.addEventListener("DOMContentLoaded", startObserver, { once: true });

  window.addEventListener("resize", schedulePatch);
  window.addEventListener("orientationchange", () => setTimeout(schedulePatch, 150));
  setTimeout(schedulePatch, 300);
  setTimeout(schedulePatch, 1000);
})();