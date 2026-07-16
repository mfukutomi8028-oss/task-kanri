// v106 emergency fix: 再帰監視を廃止
(function () {
  const VERSION = "106";

  function setVersion() {
    const text = `Ver.${VERSION}`;
    document.querySelectorAll(".app-version").forEach((element) => {
      if (element.textContent !== text) element.textContent = text;
      element.title = `現在のバージョン ${text}`;
    });
  }

  function installStyle() {
    if (document.getElementById("workBoardV106SafeStyle")) return;
    const style = document.createElement("style");
    style.id = "workBoardV106SafeStyle";
    style.textContent = `
      @media (max-width: 860px) {
        .work-mobile-status-tabs {
          display: flex !important;
          flex-wrap: nowrap !important;
          width: 100% !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          touch-action: auto !important;
          -webkit-overflow-scrolling: touch !important;
          scroll-snap-type: none !important;
          scrollbar-width: none !important;
        }
        .work-mobile-status-tabs::-webkit-scrollbar { display: none !important; }
        .work-mobile-status-tab {
          flex: 0 0 auto !important;
          touch-action: auto !important;
          scroll-snap-align: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function apply() {
    installStyle();
    setVersion();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply, { once: true });
  } else {
    apply();
  }

  setTimeout(apply, 300);
  setTimeout(apply, 1200);
})();