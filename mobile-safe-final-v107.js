// v107: 再帰監視を使わず、状態タブとバージョン表示を安定化
(function applySafeFinalV107() {
  const VERSION = "107";
  const MOBILE_QUERY = "(max-width: 860px)";

  function installStyle() {
    if (document.getElementById("workBoardSafeFinalV107")) return;
    const style = document.createElement("style");
    style.id = "workBoardSafeFinalV107";
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
          padding: 8px 0 10px !important;
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
      }
    `;
    document.head.appendChild(style);
  }

  function activateColumn(row, index) {
    const board = document.querySelector(".board-view");
    if (!board) return;
    const columns = [...board.querySelectorAll(".board-column")];
    if (!columns.length) return;
    const safeIndex = Math.max(0, Math.min(columns.length - 1, Number(index) || 0));
    localStorage.setItem("workBoardMobileBoardStatusIndex", String(safeIndex));
    columns.forEach((column, columnIndex) => {
      column.classList.toggle("work-mobile-active-column", columnIndex === safeIndex);
    });
    row.querySelectorAll(".work-mobile-status-tab").forEach((button, buttonIndex) => {
      button.classList.toggle("active", buttonIndex === safeIndex);
    });
  }

  function cleanStatusTabs() {
    if (!window.matchMedia(MOBILE_QUERY).matches) return;
    const current = document.querySelector(".work-mobile-status-tabs");
    if (!current || current.dataset.safeFinalV107 === "true") return;

    const previousLeft = current.scrollLeft;
    const replacement = current.cloneNode(true);
    replacement.dataset.safeFinalV107 = "true";
    replacement.dataset.horizontalTouchV104 = "true";
    replacement.dataset.nativeScrollV105 = "true";
    replacement.classList.remove("is-dragging");

    replacement.addEventListener("click", (event) => {
      const button = event.target.closest(".work-mobile-status-tab[data-board-tab-index]");
      if (!button) return;
      activateColumn(replacement, button.getAttribute("data-board-tab-index"));
    });

    current.replaceWith(replacement);
    replacement.scrollLeft = previousLeft;
  }

  function setVersion() {
    const expected = `Ver.${VERSION}`;
    window.WORK_BOARD_VERSION = VERSION;
    document.querySelectorAll(".app-version").forEach((element) => {
      if (element.textContent !== expected) element.textContent = expected;
      element.title = `現在のバージョン ${expected}`;
    });
  }

  function apply() {
    installStyle();
    cleanStatusTabs();
    setVersion();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply, { once: true });
  } else {
    apply();
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-task-layout], .nav-item[data-layout='tasks']")) {
      setTimeout(apply, 0);
      setTimeout(apply, 200);
    }
  }, true);

  window.addEventListener("resize", apply);
  window.addEventListener("orientationchange", () => setTimeout(apply, 150));
  window.addEventListener("pageshow", apply);
  setTimeout(apply, 300);
  setTimeout(apply, 1200);
  setInterval(apply, 2000);
})();