// Ver.292: Ver.291監査で独立価値がないことを確認したstartup後300ms/1000msの全体再補正を退役する。
// resize/orientationchange、board-scoped Observer、conditional loader、schedule作成retryは維持する。
// Ver.234: 860px以下のモバイルシェル、作成導線、状態タブ、限定Observerを所有する。
// 表示CSSは ui-mobile-shell-v234.css、version同期は config.js、Schedule Today意味論は app.js が所有する。
(function applyMobileShellV234() {
  const VERSION = String(window.WORK_BOARD_RELEASE_VERSION || window.WORK_BOARD_RELEASE?.version || "234");
  const MOBILE_QUERY = "(max-width: 860px)";
  const STORAGE_ACTIVE_STATUS = "workBoardMobileBoardStatusIndex";

  function isMobile() {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  function ensureMobileHeader() {
    if (document.getElementById("workMobileHeader") || !document.body) return;

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
        <img src="assets/brand.png?v=${VERSION}" alt="" />
        <span class="work-mobile-title-text">業務管理ボード</span>
      </div>
      <button type="button" class="work-mobile-action-button" aria-label="新しいタスクまたは予定を作成" aria-expanded="false" aria-controls="workMobileCreateMenu">＋</button>
      <div id="workMobileCreateMenu" class="work-mobile-create-menu">
        <button type="button" data-mobile-create="task"><span>＋ 新しいタスク<small>作業・依頼を登録</small></span><strong>›</strong></button>
        <button type="button" data-mobile-create="schedule"><span>＋ 新しい予定<small>時間指定の予定を登録</small></span><strong>›</strong></button>
      </div>
    `;

    document.body.prepend(overlay);
    document.body.prepend(header);

    header.querySelector(".work-mobile-menu-button")?.addEventListener("click", () => {
      document.body.classList.toggle("work-mobile-menu-open");
      closeCreateMenu();
      syncMobileMenuButton();
    });

    header.querySelector(".work-mobile-action-button")?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      toggleCreateMenu();
    }, true);

    header.querySelector("[data-mobile-create='task']")?.addEventListener("click", () => {
      closeCreateMenu();
      openNewTask();
    });

    header.querySelector("[data-mobile-create='schedule']")?.addEventListener("click", () => {
      closeCreateMenu();
      openNewSchedule();
    });

    document.addEventListener("click", event => {
      if (!event.target?.closest?.("#workMobileHeader")) closeCreateMenu();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeMobileMenu();
        closeCreateMenu();
      }
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

  function toggleCreateMenu() {
    const menu = document.getElementById("workMobileCreateMenu");
    const button = document.querySelector(".work-mobile-action-button");
    if (!menu) return;
    const open = !menu.classList.contains("open");
    menu.classList.toggle("open", open);
    button?.setAttribute("aria-expanded", open ? "true" : "false");
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

  function syncMobileHeaderTitle() {
    const title = document.querySelector(".work-mobile-title-text");
    const icon = document.querySelector(".work-mobile-title img");
    if (!title) return;
    const active = document.querySelector(".nav-item.active");
    const activeIcon = active?.querySelector("img")?.getAttribute("src");
    title.textContent = active?.textContent?.trim() || "業務管理ボード";
    if (icon) icon.src = activeIcon || `assets/brand.png?v=${VERSION}`;
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
      const buttons = columns.map((column, index) => {
        const label = getBoardColumnLabel(column);
        const count = column.querySelectorAll(".task-card").length;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "work-mobile-status-tab";
        button.dataset.boardTabIndex = String(index);
        button.setAttribute("aria-pressed", "false");
        button.textContent = `${label} ${count}`;
        button.addEventListener("click", () => {
          const selectedIndex = Number(button.dataset.boardTabIndex || 0);
          setActiveIndex(selectedIndex);
          applyActiveColumn(selectedIndex, true);
        });
        return button;
      });
      tabs.replaceChildren(...buttons);
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
    tabs.querySelectorAll(".work-mobile-status-tab").forEach((button, index) => {
      const active = index === activeIndex;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    const activeButton = tabs.querySelector(`.work-mobile-status-tab[data-board-tab-index="${activeIndex}"]`);
    if (activeButton) {
      const left = activeButton.offsetLeft - ((tabs.clientWidth - activeButton.offsetWidth) / 2);
      tabs.scrollLeft = Math.max(0, left);
    }
    // 状態切替時もページの縦位置は変更しない。
  }

  function bindGlobalClicks() {
    if (window.__workBoardMobileFixClicksV101) return;
    window.__workBoardMobileFixClicksV101 = true;
    document.addEventListener("click", event => {
      if (event.target?.closest?.(".nav-item")) {
        setTimeout(() => {
          closeMobileMenu();
          syncMobileHeaderTitle();
          patchMobileBoardTabs();
        }, 0);
      }
    }, true);
  }

  function patchAll() {
    ensureMobileHeader();
    patchMobileBoardTabs();
    syncMobileHeaderTitle();
    syncMobileMenuButton();
    bindGlobalClicks();
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

  let boardTabsScheduled = false;
  const scheduleBoardTabs = () => {
    if (boardTabsScheduled) return;
    boardTabsScheduled = true;
    requestAnimationFrame(() => {
      boardTabsScheduled = false;
      patchMobileBoardTabs();
    });
  };

  const startObserver = () => {
    const boardView = document.getElementById("boardView");
    if (!boardView) return;
    new MutationObserver(scheduleBoardTabs).observe(boardView, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  } else {
    startObserver();
  }

  window.addEventListener("resize", schedulePatch);
  window.addEventListener("orientationchange", () => setTimeout(schedulePatch, 150));
})();
