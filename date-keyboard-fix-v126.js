// v126: date/datetime controls keep their native picker while allowing keyboard entry.
(function installDateKeyboardFixV126() {
  const SELECTOR = 'input[type="date"], input[type="datetime-local"]';
  const DATE_MIN = "1900-01-01";
  const DATE_MAX = "9999-12-31";
  let scheduled = false;

  function patchInput(input) {
    if (!input || !input.matches?.(SELECTOR)) return;

    // maxlength is unsupported on native date controls and can interfere with
    // segmented keyboard entry in some Chromium environments.
    input.removeAttribute("maxlength");
    input.removeAttribute("readonly");
    input.readOnly = false;
    input.inputMode = "numeric";

    if (input.type === "date") {
      input.min = DATE_MIN;
      input.max = DATE_MAX;
    } else {
      input.min = `${DATE_MIN}T00:00`;
      input.max = `${DATE_MAX}T23:59`;
    }
  }

  function patchAll(root = document) {
    if (root.matches?.(SELECTOR)) patchInput(root);
    root.querySelectorAll?.(SELECTOR).forEach(patchInput);
  }

  // Legacy v101/v108 handlers clamp the value on every input event. Native
  // date controls update segmented values during typing, so that per-keystroke
  // clamp can make the field appear keyboard-locked. Stop only those input
  // events before they reach the old target listeners. change/blur events are
  // left intact, so validation, recurrence updates, and schedule syncing still
  // run when the value is committed.
  if (!window.__workBoardDateKeyboardGuardV126) {
    window.__workBoardDateKeyboardGuardV126 = true;
    document.addEventListener("input", event => {
      if (!event.target?.matches?.(SELECTOR)) return;
      event.stopImmediatePropagation();
    }, true);
  }

  function schedulePatch() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      patchAll();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => patchAll(), { once: true });
  } else {
    patchAll();
  }

  if (document.body) {
    new MutationObserver(schedulePatch).observe(document.body, {
      childList: true,
      subtree: true
    });
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      new MutationObserver(schedulePatch).observe(document.body, {
        childList: true,
        subtree: true
      });
    }, { once: true });
  }

  window.addEventListener("pageshow", schedulePatch);
  setTimeout(schedulePatch, 300);
  setTimeout(schedulePatch, 1200);
})();
