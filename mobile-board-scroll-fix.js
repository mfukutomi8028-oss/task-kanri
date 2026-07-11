// v102: スマホ版タスクボードの見出し重なり・縦スクロール修正
(function applyMobileBoardScrollFix() {
  const VERSION = "102";
  const MOBILE_QUERY = "(max-width: 860px)";

  function installStyle() {
    if (document.getElementById("mobileBoardScrollFixV102")) return;

    const style = document.createElement("style");
    style.id = "mobileBoardScrollFixV102";
    style.textContent = `
      @media ${MOBILE_QUERY} {
        html {
          height: auto !important;
          min-height: 100% !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          overscroll-behavior-y: auto !important;
        }

        body:not(.work-mobile-menu-open) {
          height: auto !important;
          min-height: 100vh !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          touch-action: pan-y !important;
          overscroll-behavior-y: auto !important;
        }

        .app-shell,
        .app-shell.detail-open,
        .main,
        .board-view,
        .board-view .board-column,
        .board-view .add-status-column,
        .board-view .task-list {
          height: auto !important;
          max-height: none !important;
          overflow-y: visible !important;
          overscroll-behavior-y: auto !important;
        }

        .main,
        .board-view,
        .board-view .board-column,
        .board-view .task-list,
        .board-view .task-card {
          touch-action: pan-y !important;
        }

        .board-view {
          position: relative !important;
          display: block !important;
          overflow-x: hidden !important;
          padding: 0 !important;
        }

        .board-view .board-column.work-mobile-active-column {
          display: block !important;
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          overflow: visible !important;
          border-radius: 20px !important;
        }

        .board-view .column-head {
          position: static !important;
          inset: auto !important;
          top: auto !important;
          left: auto !important;
          right: auto !important;
          z-index: auto !important;
          width: 100% !important;
          min-height: 54px !important;
          margin: 0 !important;
          padding: 13px 14px !important;
          border-radius: 20px 20px 0 0 !important;
          background: #f8fcff !important;
          backdrop-filter: none !important;
          box-shadow: none !important;
          transform: none !important;
        }

        .board-view .column-title {
          min-width: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 8px !important;
        }

        .board-view .column-title > span:last-child {
          overflow: visible !important;
          text-overflow: clip !important;
          white-space: nowrap !important;
        }

        .board-view .task-list {
          display: grid !important;
          min-height: 0 !important;
          padding: 12px !important;
          padding-bottom: 20px !important;
          overflow: visible !important;
        }

        .board-view .task-card {
          position: relative !important;
          z-index: 1 !important;
        }

        .board-view .column-drag-handle,
        .board-view .drag-handle {
          touch-action: none !important;
        }

        .work-mobile-status-tabs {
          margin-bottom: 10px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function releaseStuckScrollLock() {
    if (!window.matchMedia(MOBILE_QUERY).matches) return;
    if (!document.body?.classList.contains("work-mobile-menu-open")) {
      document.documentElement.style.removeProperty("overflow");
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("height");
    }
  }

  function setVersion() {
    document.querySelectorAll(".app-version").forEach(element => {
      element.textContent = `Ver.${VERSION}`;
      element.title = `現在のバージョン Ver.${VERSION}`;
    });
  }

  function applyFix() {
    installStyle();
    releaseStuckScrollLock();
    setVersion();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyFix, { once: true });
  } else {
    applyFix();
  }

  window.addEventListener("resize", applyFix);
  window.addEventListener("orientationchange", () => setTimeout(applyFix, 120));
  setTimeout(applyFix, 300);
  setTimeout(applyFix, 1000);
})();