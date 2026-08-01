// Keep the visible version independent from legacy fix scripts.
(function lockWorkBoardVersionDisplay() {
  const STYLE_ID = "workBoardVersionDisplayStyle";

  function releaseVersion() {
    return String(window.WORK_BOARD_RELEASE_VERSION || window.WORK_BOARD_VERSION || "131");
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .workboard-version-display {
        display: block;
        width: fit-content;
        margin: 12px auto 0;
        padding: 5px 10px;
        border: 1px solid rgba(255,255,255,.16);
        border-radius: 999px;
        background: rgba(255,255,255,.08);
        color: #bfeaff;
        font-size: 11px;
        font-weight: 900;
        line-height: 1.2;
      }
    `;
    document.head.appendChild(style);
  }

  function apply() {
    installStyle();
    const version = releaseVersion();
    document.querySelectorAll(".app-version, .workboard-version-display").forEach(element => {
      element.classList.remove("app-version");
      element.classList.add("workboard-version-display");
      element.textContent = `Ver.${version}`;
      element.title = `現在のバージョン Ver.${version}`;
      element.dataset.releaseVersion = version;
    });
    window.WORK_BOARD_VERSION = version;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply, { once: true });
  else apply();

  window.addEventListener("pageshow", apply);
  window.addEventListener("focus", apply);
  setTimeout(apply, 250);
  setTimeout(apply, 1200);
})();
