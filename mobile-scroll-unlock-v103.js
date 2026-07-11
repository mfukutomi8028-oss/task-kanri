// v103: スマホ版タスクボードの縦スクロールを優先し、位置の引き戻しを防止
(function applyMobileScrollUnlock() {
  const VERSION = "103";
  const MOBILE_QUERY = "(max-width: 860px)";
  let observerScheduled = false;

  function isMobile() {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  function installStyle() {
    if (document.getElementById("mobileScrollUnlockV103")) return;

    const style = document.createElement("style");
    style.id = "mobileScrollUnlockV103";
    style.textContent = `
      @media ${MOBILE_QUERY} {
        html {
          position: static !important;
          height: auto !important;
          min-height: 100% !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          touch-action: pan-y !important;
          overscroll-behavior-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
        }

        body:not(.work-mobile-menu-open) {
          position: static !important;
          top: auto !important;
          width: 100% !important;
          height: auto !important;
          min-height: 100vh !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          touch-action: pan-y !important;
          overscroll-behavior-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
        }

        body:not(.work-mobile-menu-open) .app-shell,
        body:not(.work-mobile-menu-open) .main,
        body:not(.work-mobile-menu-open) #boardView,
        body:not(.work-mobile-menu-open) .board-view,
        body:not(.work-mobile-menu-open) .board-view .board-column,
        body:not(.work-mobile-menu-open) .board-view .task-list {
          height: auto !important;
          max-height: none !important;
          overflow-y: visible !important;
          overscroll-behavior-y: auto !important;
          touch-action: pan-y !important;
          -webkit-overflow-scrolling: touch !important;
        }

        .board-view,
        .board-view .board-column,
        .board-view .task-list,
        .board-view .task-card,
        .board-view .task-card * {
          touch-action: pan-y !important;
        }

        .board-view [draggable="true"],
        .board-view [draggable="false"] {
          -webkit-user-drag: none !important;
        }

        .board-view .column-drag-handle,
        .board-view .drag-handle {
          touch-action: pan-y !important;
        }

        .work-mobile-overlay {
          pointer-events: none !important;
        }

        body.work-mobile-menu-open .work-mobile-overlay {
          pointer-events: auto !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function menuIsActuallyOpen() {
    const button = document.querySelector(".work-mobile-menu-button");
    return button?.getAttribute("aria-expanded") === "true";
  }

  function releaseBodyScrollLock() {
    if (!isMobile() || !document.body) return;

    if (!menuIsActuallyOpen()) {
      document.body.classList.remove("work-mobile-menu-open");
      [document.documentElement, document.body].forEach(element => {
        element.style.removeProperty("overflow");
        element.style.removeProperty("overflow-y");
        element.style.removeProperty("height");
        element.style.removeProperty("position");
        element.style.removeProperty("top");
        element.style.removeProperty("width");
      });
    }
  }

  function disableTouchDragging() {
    const draggableItems = document.querySelectorAll(".board-view [draggable]");

    if (isMobile()) {
      draggableItems.forEach(element => {
        if (!element.hasAttribute("data-desktop-draggable")) {
          element.setAttribute("data-desktop-draggable", element.getAttribute("draggable") || "false");
        }
        element.setAttribute("draggable", "false");
        element.draggable = false;
      });
      return;
    }

    draggableItems.forEach(element => {
      const previous = element.getAttribute("data-desktop-draggable");
      if (previous === null) return;
      element.setAttribute("draggable", previous);
      element.draggable = previous === "true";
      element.removeAttribute("data-desktop-draggable");
    });
  }

  function patchAutomaticTabScrolling() {
    document.querySelectorAll(".work-mobile-status-tab").forEach(button => {
      if (button.__workBoardScrollIntoViewV103) return;

      button.__workBoardScrollIntoViewV103 = true;
      button.scrollIntoView = function scrollStatusTabHorizontally() {
        const tabRow = button.closest(".work-mobile-status-tabs");
        if (!tabRow) return;

        const left = button.offsetLeft - ((tabRow.clientWidth - button.offsetWidth) / 2);
        tabRow.scrollTo({
          left: Math.max(0, left),
          behavior: "smooth"
        });
      };
    });
  }

  function protectVerticalTouchScroll() {
    if (window.__workBoardVerticalTouchProtectedV103) return;
    window.__workBoardVerticalTouchProtectedV103 = true;

    const isBoardNonInteractiveTarget = target => {
      if (!isMobile() || !(target instanceof Element)) return false;
      if (!target.closest(".board-view")) return false;
      return !target.closest("button, input, select, textarea, a, label, [role='button']");
    };

    document.addEventListener("touchmove", event => {
      if (!isBoardNonInteractiveTarget(event.target)) return;
      event.stopImmediatePropagation();
    }, { capture: true, passive: true });

    document.addEventListener("pointermove", event => {
      if (event.pointerType !== "touch" || !isBoardNonInteractiveTarget(event.target)) return;
      event.stopImmediatePropagation();
    }, { capture: true, passive: true });
  }

  function setVersion() {
    document.querySelectorAll(".app-version").forEach(element => {
      element.textContent = `Ver.${VERSION}`;
      element.title = `現在のバージョン Ver.${VERSION}`;
    });
  }

  function applyFix() {
    installStyle();
    releaseBodyScrollLock();
    disableTouchDragging();
    patchAutomaticTabScrolling();
    protectVerticalTouchScroll();
    setVersion();
  }

  function scheduleFix() {
    if (observerScheduled) return;
    observerScheduled = true;
    requestAnimationFrame(() => {
      observerScheduled = false;
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
      subtree: true
    });
  };

  if (document.body) startObserver();
  else document.addEventListener("DOMContentLoaded", startObserver, { once: true });

  window.addEventListener("resize", scheduleFix);
  window.addEventListener("orientationchange", () => setTimeout(scheduleFix, 120));
  window.addEventListener("pageshow", scheduleFix);
  setTimeout(scheduleFix, 300);
  setTimeout(scheduleFix, 1000);
})();