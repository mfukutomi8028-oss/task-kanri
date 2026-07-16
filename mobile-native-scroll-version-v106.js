// v106: 状態タブを表示形式と同じ標準横スクロールに統一し、表示バージョンを固定
(function applyV106FinalFix() {
  const VERSION = "106";
  const MOBILE_QUERY = "(max-width: 860px)";
  let scheduled = false;

  function isMobile() {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  function installStyle() {
    if (document.getElementById("workBoardV106FinalStyle")) return;
    const style = document.createElement("style");
    style.id = "workBoardV106FinalStyle";
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
          overscroll-behavior-x: auto !important;
          overscroll-behavior-y: auto !important;
          scroll-behavior: auto !important;
          scroll-snap-type: none !important;
          scrollbar-width: none !important;
          cursor: auto !important;
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

  function activateColumn(index, row) {
    const board = document.querySelector(".board-view");
    if (!board || !row) return;
    const columns = [...board.querySelectorAll(".board-column")];
    if (!columns.length) return;
    const safeIndex = Math.max(0, Math.min(columns.length - 1, Number(index) || 0));
    localStorage.setItem("workBoardMobileBoardStatusIndex", String(safeIndex));
    columns.forEach((column, i) => column.classList.toggle("work-mobile-active-column", i === safeIndex));
    row.querySelectorAll(".work-mobile-status-tab").forEach((button, i) => button.classList.toggle("active", i === safeIndex));
  }

  function replaceTabsWithCleanNativeScroller() {
    if (!isMobile()) return;
    const current = document.querySelector(".work-mobile-status-tabs");
    if (!current || current.dataset.nativeV106 === "true") return;

    const scrollLeft = current.scrollLeft;
    const replacement = current.cloneNode(true);
    replacement.dataset.nativeV106 = "true";
    replacement.dataset.horizontalTouchV104 = "true";
    replacement.dataset.nativeScrollV105 = "true";
    replacement.classList.remove("is-dragging");

    replacement.addEventListener("click", event => {
      const button = event.target.closest(".work-mobile-status-tab[data-board-tab-index]");
      if (!button) return;
      activateColumn(button.getAttribute("data-board-tab-index"), replacement);
    });

    current.replaceWith(replacement);
    replacement.scrollLeft = scrollLeft;
  }

  function lockVersion() {
    document.querySelectorAll(".app-version").forEach(element => {
      const expected = `Ver.${VERSION}`;
      if (element.textContent !== expected) element.textContent = expected;
      element.title = `現在のバージョン ${expected}`;
    });
    window.WORK_BOARD_VERSION = VERSION;
  }

  function applyFix() {
    installStyle();
    replaceTabsWithCleanNativeScroller();
    lockVersion();
  }

  function scheduleFix() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyFix();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyFix, { once: true });
  } else {
    applyFix();
  }

  const startObserver = () => {
    if (!document.body) return;
    new MutationObserver(scheduleFix).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  };

  if (document.body) startObserver();
  else document.addEventListener("DOMContentLoaded", startObserver, { once: true });

  window.addEventListener("resize", scheduleFix);
  window.addEventListener("orientationchange", () => setTimeout(scheduleFix, 120));
  window.addEventListener("pageshow", scheduleFix);
  setTimeout(scheduleFix, 250);
  setTimeout(scheduleFix, 1000);
  setTimeout(scheduleFix, 3000);
})();