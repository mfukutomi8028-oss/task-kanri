// Ver.158: desktop auto-collapsing sidebar with hover/focus/drag reveal and optional pinning.
(function installDesktopSidebarV158() {
  const DESKTOP_QUERY = "(min-width: 861px)";
  const STORAGE_KEY = "work-board-desktop-sidebar-pinned-v158";
  const BODY_BASE_CLASS = "desktop-sidebar-v158";
  const BODY_EXPANDED_CLASS = "desktop-sidebar-expanded";
  const BODY_PINNED_CLASS = "desktop-sidebar-pinned";
  const media = window.matchMedia(DESKTOP_QUERY);

  let sidebar = null;
  let pinButton = null;
  let pinned = false;
  let expanded = false;
  let expandTimer = 0;
  let collapseTimer = 0;

  function readPinned() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  function writePinned(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {}
  }

  function clearTimers() {
    if (expandTimer) window.clearTimeout(expandTimer);
    if (collapseTimer) window.clearTimeout(collapseTimer);
    expandTimer = 0;
    collapseTimer = 0;
  }

  function updatePinButton() {
    if (!pinButton) return;
    pinButton.setAttribute("aria-pressed", pinned ? "true" : "false");
    pinButton.title = pinned
      ? "固定を解除して、通常は折りたたむ"
      : "左メニューを常に表示する";
    const label = pinButton.querySelector(".desktop-sidebar-pin-label-v158");
    if (label) label.textContent = pinned ? "固定を解除" : "メニューを固定";
    const icon = pinButton.querySelector(".desktop-sidebar-pin-icon-v158");
    if (icon) icon.textContent = pinned ? "📍" : "📌";
  }

  function applyState() {
    const body = document.body;
    if (!body) return;

    if (!media.matches) {
      body.classList.remove(BODY_BASE_CLASS, BODY_EXPANDED_CLASS, BODY_PINNED_CLASS);
      body.removeAttribute("data-desktop-sidebar-state");
      return;
    }

    body.classList.add(BODY_BASE_CLASS);
    body.classList.toggle(BODY_PINNED_CLASS, pinned);
    body.classList.toggle(BODY_EXPANDED_CLASS, !pinned && expanded);
    body.dataset.desktopSidebarState = pinned ? "pinned" : (expanded ? "expanded" : "collapsed");
    updatePinButton();
  }

  function setExpanded(value) {
    if (!media.matches || pinned) {
      expanded = false;
      applyState();
      return;
    }
    expanded = Boolean(value);
    applyState();
  }

  function scheduleExpand(delay = 80) {
    if (!media.matches || pinned) return;
    if (collapseTimer) window.clearTimeout(collapseTimer);
    collapseTimer = 0;
    if (expanded) return;
    if (expandTimer) window.clearTimeout(expandTimer);
    expandTimer = window.setTimeout(() => {
      expandTimer = 0;
      setExpanded(true);
    }, delay);
  }

  function scheduleCollapse(delay = 220) {
    if (!media.matches || pinned) return;
    if (expandTimer) window.clearTimeout(expandTimer);
    expandTimer = 0;
    if (collapseTimer) window.clearTimeout(collapseTimer);
    collapseTimer = window.setTimeout(() => {
      collapseTimer = 0;
      if (sidebar?.matches(":hover") || sidebar?.matches(":focus-within")) return;
      setExpanded(false);
    }, delay);
  }

  function setPinned(value) {
    pinned = Boolean(value);
    expanded = false;
    writePinned(pinned);
    clearTimers();
    applyState();
  }

  function ensurePinButton() {
    if (!sidebar) return;
    pinButton = sidebar.querySelector(".desktop-sidebar-pin-v158");
    if (pinButton) {
      updatePinButton();
      return;
    }

    pinButton = document.createElement("button");
    pinButton.type = "button";
    pinButton.className = "desktop-sidebar-pin-v158";
    pinButton.innerHTML = `
      <span class="desktop-sidebar-pin-icon-v158" aria-hidden="true">📌</span>
      <span class="desktop-sidebar-pin-label-v158">メニューを固定</span>
    `;
    pinButton.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      setPinned(!pinned);
      if (!pinned) scheduleCollapse(260);
    });

    const brand = sidebar.querySelector(".brand");
    if (brand) brand.insertAdjacentElement("afterend", pinButton);
    else sidebar.prepend(pinButton);
    updatePinButton();
  }

  function labelNavigationButtons() {
    sidebar?.querySelectorAll(".nav-item").forEach(button => {
      const label = String(button.textContent || "").replace(/\s+/g, " ").trim();
      if (!label) return;
      button.dataset.desktopSidebarLabel = label;
      if (!button.hasAttribute("title")) button.title = label;
      if (!button.hasAttribute("aria-label")) button.setAttribute("aria-label", label);
    });
  }

  function bindEvents() {
    if (!sidebar || sidebar.dataset.desktopSidebarV158Bound === "true") return;
    sidebar.dataset.desktopSidebarV158Bound = "true";

    sidebar.addEventListener("pointerenter", event => {
      if (event.pointerType === "mouse" || event.pointerType === "pen") scheduleExpand(70);
    });
    sidebar.addEventListener("pointerleave", () => scheduleCollapse(220));

    sidebar.addEventListener("focusin", () => {
      if (!pinned) {
        clearTimers();
        setExpanded(true);
      }
    });
    sidebar.addEventListener("focusout", event => {
      if (event.relatedTarget && sidebar.contains(event.relatedTarget)) return;
      scheduleCollapse(160);
    });

    sidebar.addEventListener("dragenter", () => {
      if (!pinned) {
        clearTimers();
        setExpanded(true);
      }
    });
    sidebar.addEventListener("dragover", () => {
      if (!pinned && !expanded) setExpanded(true);
    });

    sidebar.addEventListener("click", event => {
      if (pinned || event.target.closest(".desktop-sidebar-pin-v158")) return;
      if (event.target.closest(".nav-item")) scheduleCollapse(160);
    });

    document.addEventListener("keydown", event => {
      if (event.key !== "Escape" || pinned) return;
      setExpanded(false);
    });

    document.addEventListener("dragend", () => scheduleCollapse(180), true);
    document.addEventListener("drop", () => scheduleCollapse(180), true);
  }

  function start() {
    sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;
    pinned = readPinned();
    ensurePinButton();
    labelNavigationButtons();
    bindEvents();
    applyState();
  }

  function onMediaChange() {
    clearTimers();
    expanded = false;
    applyState();
  }

  if (typeof media.addEventListener === "function") media.addEventListener("change", onMediaChange);
  else if (typeof media.addListener === "function") media.addListener(onMediaChange);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  window.addEventListener("pageshow", applyState);
})();
