// v129: Keep the schedule "today" range fixed to the actual current date.
(function installScheduleTodayLockV129() {
  const VIEW_SELECTOR = "#scheduleView";
  let correctionQueued = false;

  function localTodayISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getScheduleView() {
    return document.querySelector(VIEW_SELECTOR);
  }

  function isTodayRangeSelected(view = getScheduleView()) {
    return Boolean(view?.querySelector('[data-schedule-range="today"].active'));
  }

  function enforceTodayAnchor() {
    const view = getScheduleView();
    if (!view || !isTodayRangeSelected(view)) return;

    const currentLabel = view.querySelector(".schedule-range-label")?.textContent?.trim() || "";
    if (currentLabel === localTodayISO()) return;

    const todayButton = view.querySelector('[data-schedule-move="today"]');
    if (!todayButton || correctionQueued) return;

    correctionQueued = true;
    todayButton.click();
    setTimeout(() => {
      correctionQueued = false;
    }, 0);
  }

  function scheduleEnforcement() {
    setTimeout(enforceTodayAnchor, 0);
  }

  // While "today" is selected, previous/next must not move away from today.
  document.addEventListener("click", event => {
    const moveButton = event.target.closest(`${VIEW_SELECTOR} [data-schedule-move]`);
    if (moveButton && ["prev", "next"].includes(moveButton.dataset.scheduleMove)) {
      const view = getScheduleView();
      if (isTodayRangeSelected(view)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        scheduleEnforcement();
        return;
      }
    }

    // Selecting "today" first changes the range in app.js; then reset its anchor.
    if (event.target.closest(`${VIEW_SELECTOR} [data-schedule-range="today"]`)) {
      scheduleEnforcement();
    }
  }, true);

  function observeScheduleView() {
    const view = getScheduleView();
    if (!view || view.dataset.todayLockV129 === "true") return;

    view.dataset.todayLockV129 = "true";
    const observer = new MutationObserver(scheduleEnforcement);
    observer.observe(view, { childList: true, subtree: true });
    scheduleEnforcement();
  }

  function start() {
    observeScheduleView();
    window.addEventListener("pageshow", scheduleEnforcement);
    window.addEventListener("focus", scheduleEnforcement);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) scheduleEnforcement();
    });

    // Also follows the date changing while the page remains open overnight.
    setInterval(scheduleEnforcement, 60 * 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
