// v127: segmented keyboard entry for native date and datetime-local controls.
(function installDateSegmentControlsV127() {
  const SELECTOR = 'input[type="date"], input[type="datetime-local"]';
  const DATE_MIN = "1900-01-01";
  const DATE_MAX = "9999-12-31";

  function installStyle() {
    if (document.getElementById("dateSegmentControlStyleV127")) return;
    const style = document.createElement("style");
    style.id = "dateSegmentControlStyleV127";
    style.textContent = `
      .date-segment-control-v127 {
        position: relative !important;
        display: flex !important;
        align-items: center !important;
        width: 100% !important;
        min-width: 0 !important;
        min-height: 52px !important;
        padding: 4px 8px 4px 12px !important;
        gap: 3px !important;
        border: 1px solid #cbddeb !important;
        border-radius: 16px !important;
        background: #f7fbff !important;
        box-sizing: border-box !important;
        transition: border-color .16s ease, box-shadow .16s ease, background .16s ease !important;
      }
      .date-segment-control-v127:focus-within {
        border-color: #6aaee3 !important;
        background: #fff !important;
        box-shadow: 0 0 0 3px rgba(65, 146, 209, .13) !important;
      }
      .date-segment-control-v127.is-invalid {
        border-color: #df6b6b !important;
        box-shadow: 0 0 0 3px rgba(223, 107, 107, .12) !important;
      }
      .date-segment-input-v127 {
        flex: 0 0 auto !important;
        width: auto !important;
        min-width: 0 !important;
        height: 40px !important;
        min-height: 40px !important;
        margin: 0 !important;
        padding: 0 2px !important;
        border: 0 !important;
        border-radius: 7px !important;
        outline: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
        color: inherit !important;
        font: inherit !important;
        font-size: 16px !important;
        font-weight: 800 !important;
        line-height: 40px !important;
        text-align: center !important;
        letter-spacing: .02em !important;
        appearance: none !important;
        -webkit-appearance: none !important;
      }
      .date-segment-input-v127:focus {
        background: rgba(78, 157, 218, .10) !important;
      }
      .date-segment-year-v127 { width: 5.2ch !important; }
      .date-segment-two-v127 { width: 3.0ch !important; }
      .date-segment-separator-v127 {
        flex: 0 0 auto !important;
        color: #73899a !important;
        font-size: 15px !important;
        font-weight: 800 !important;
        line-height: 1 !important;
        user-select: none !important;
      }
      .date-segment-spacer-v127 { width: 5px !important; }
      .date-segment-picker-v127 {
        flex: 0 0 38px !important;
        width: 38px !important;
        height: 38px !important;
        min-width: 38px !important;
        min-height: 38px !important;
        margin: 0 0 0 auto !important;
        padding: 0 !important;
        display: inline-grid !important;
        place-items: center !important;
        border: 0 !important;
        border-radius: 11px !important;
        background: transparent !important;
        color: #132b3d !important;
        box-shadow: none !important;
        cursor: pointer !important;
      }
      .date-segment-picker-v127:hover,
      .date-segment-picker-v127:focus-visible {
        background: rgba(46, 130, 195, .10) !important;
        outline: none !important;
      }
      .date-segment-picker-v127 svg {
        width: 19px !important;
        height: 19px !important;
        display: block !important;
      }
      .date-native-source-v127 {
        position: absolute !important;
        right: 42px !important;
        bottom: 1px !important;
        width: 1px !important;
        height: 1px !important;
        min-width: 1px !important;
        min-height: 1px !important;
        padding: 0 !important;
        margin: 0 !important;
        border: 0 !important;
        opacity: 0 !important;
        pointer-events: none !important;
        clip-path: inset(50%) !important;
      }
      @media (max-width: 520px) {
        .date-segment-control-v127 {
          padding-left: 8px !important;
          gap: 1px !important;
        }
        .date-segment-year-v127 { width: 4.8ch !important; }
        .date-segment-two-v127 { width: 2.7ch !important; }
        .date-segment-picker-v127 {
          flex-basis: 34px !important;
          width: 34px !important;
          min-width: 34px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function digits(value, maxLength) {
    return String(value || "").normalize("NFKC").replace(/\D/g, "").slice(0, maxLength);
  }

  function pad2(value) {
    const clean = digits(value, 2);
    return clean ? clean.padStart(2, "0") : "";
  }

  function isValidDateParts(year, month, day) {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    if (!/^\d{4}$/.test(year) || y < 1900 || y > 9999) return false;
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y
      && date.getUTCMonth() === m - 1
      && date.getUTCDate() === d;
  }

  function isValidTimeParts(hour, minute) {
    return /^\d{2}$/.test(hour)
      && /^\d{2}$/.test(minute)
      && Number(hour) >= 0
      && Number(hour) <= 23
      && Number(minute) >= 0
      && Number(minute) <= 59;
  }

  function pickerIcon() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 2.75v3M17 2.75v3M4.5 8.25h15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        <rect x="3.5" y="4.75" width="17" height="15.75" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8" />
        <path d="M7.5 11.75h.01M12 11.75h.01M16.5 11.75h.01M7.5 15.75h.01M12 15.75h.01M16.5 15.75h.01" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
      </svg>`;
  }

  function makeField(className, maxLength, placeholder, ariaLabel) {
    const field = document.createElement("input");
    field.type = "text";
    field.className = `date-segment-input-v127 ${className}`;
    field.maxLength = maxLength;
    field.inputMode = "numeric";
    field.autocomplete = "off";
    field.spellcheck = false;
    field.placeholder = placeholder;
    field.setAttribute("aria-label", ariaLabel);
    return field;
  }

  function makeSeparator(text, extraClass = "") {
    const separator = document.createElement("span");
    separator.className = `date-segment-separator-v127 ${extraClass}`.trim();
    separator.textContent = text;
    separator.setAttribute("aria-hidden", "true");
    return separator;
  }

  function getBaseLabel(input) {
    const label = input.closest("label");
    if (!label) return "日付";
    const directText = [...label.childNodes]
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return directText || "日付";
  }

  function buildControl(source) {
    if (!source || source.dataset.dateSegmentV127 === "true") return;
    source.dataset.dateSegmentV127 = "true";

    const kind = source.type;
    const hasTime = kind === "datetime-local";
    const baseLabel = getBaseLabel(source);
    const wrapper = document.createElement("div");
    wrapper.className = "date-segment-control-v127";
    wrapper.dataset.dirty = "false";
    wrapper.setAttribute("role", "group");
    wrapper.setAttribute("aria-label", baseLabel);

    const year = makeField("date-segment-year-v127", 4, "年", `${baseLabel} 年`);
    const month = makeField("date-segment-two-v127", 2, "月", `${baseLabel} 月`);
    const day = makeField("date-segment-two-v127", 2, "日", `${baseLabel} 日`);
    const fields = [year, month, day];

    wrapper.append(
      year,
      makeSeparator("/"),
      month,
      makeSeparator("/"),
      day
    );

    let hour = null;
    let minute = null;
    if (hasTime) {
      hour = makeField("date-segment-two-v127", 2, "時", `${baseLabel} 時`);
      minute = makeField("date-segment-two-v127", 2, "分", `${baseLabel} 分`);
      fields.push(hour, minute);
      wrapper.append(
        makeSeparator("", "date-segment-spacer-v127"),
        hour,
        makeSeparator(":"),
        minute
      );
    }

    const pickerButton = document.createElement("button");
    pickerButton.type = "button";
    pickerButton.className = "date-segment-picker-v127";
    pickerButton.innerHTML = pickerIcon();
    pickerButton.title = "カレンダーから選択";
    pickerButton.setAttribute("aria-label", `${baseLabel}をカレンダーから選択`);
    wrapper.appendChild(pickerButton);

    source.parentNode.insertBefore(wrapper, source);
    wrapper.appendChild(source);
    source.classList.add("date-native-source-v127");
    source.removeAttribute("maxlength");
    source.removeAttribute("readonly");
    source.readOnly = false;
    source.tabIndex = -1;
    source.min = kind === "date" ? DATE_MIN : `${DATE_MIN}T00:00`;
    source.max = kind === "date" ? DATE_MAX : `${DATE_MAX}T23:59`;

    function syncFromSource(force = false) {
      if (!force && wrapper.dataset.dirty === "true") return;
      const value = String(source.value || "");
      const match = hasTime
        ? value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
        : value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      year.value = match?.[1] || "";
      month.value = match?.[2] || "";
      day.value = match?.[3] || "";
      if (hasTime) {
        hour.value = match?.[4] || "";
        minute.value = match?.[5] || "";
      }
      wrapper.dataset.dirty = "false";
      wrapper.classList.remove("is-invalid");
    }

    function dispatchSourceEvents(previousValue) {
      if (source.value === previousValue) return;
      source.dispatchEvent(new Event("input", { bubbles: true }));
      source.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function commitSegments({ pad = false } = {}) {
      if (pad) {
        month.value = pad2(month.value);
        day.value = pad2(day.value);
        if (hasTime) {
          hour.value = pad2(hour.value);
          minute.value = pad2(minute.value);
        }
      }

      const allEmpty = fields.every(field => !field.value);
      if (allEmpty) {
        const previousValue = source.value;
        source.value = "";
        wrapper.dataset.dirty = "false";
        wrapper.classList.remove("is-invalid");
        dispatchSourceEvents(previousValue);
        return true;
      }

      const validDate = isValidDateParts(year.value, month.value, day.value);
      const validTime = !hasTime || isValidTimeParts(hour.value, minute.value);
      if (!validDate || !validTime) {
        source.value = "";
        wrapper.classList.toggle("is-invalid", pad);
        return false;
      }

      const nextValue = hasTime
        ? `${year.value}-${month.value}-${day.value}T${hour.value}:${minute.value}`
        : `${year.value}-${month.value}-${day.value}`;
      const previousValue = source.value;
      source.value = nextValue;
      wrapper.dataset.dirty = "false";
      wrapper.classList.remove("is-invalid");
      dispatchSourceEvents(previousValue);
      return true;
    }

    fields.forEach((field, index) => {
      field.addEventListener("focus", () => {
        if (wrapper.dataset.dirty !== "true") syncFromSource(true);
        requestAnimationFrame(() => field.select());
      });

      field.addEventListener("input", () => {
        field.value = digits(field.value, field.maxLength);
        wrapper.dataset.dirty = "true";
        wrapper.classList.remove("is-invalid");

        const complete = fields.every(item => item.value.length === item.maxLength);
        if (complete) commitSegments();

        if (field.value.length === field.maxLength && index < fields.length - 1) {
          fields[index + 1].focus();
        }
      });

      field.addEventListener("keydown", event => {
        if (["/", "-", ".", ":", " "].includes(event.key)) {
          event.preventDefault();
          fields[Math.min(index + 1, fields.length - 1)].focus();
          return;
        }
        if (event.key === "ArrowRight" && field.selectionStart === field.value.length && index < fields.length - 1) {
          event.preventDefault();
          fields[index + 1].focus();
          return;
        }
        if (event.key === "ArrowLeft" && field.selectionStart === 0 && index > 0) {
          event.preventDefault();
          fields[index - 1].focus();
          return;
        }
        if (event.key === "Backspace" && !field.value && index > 0) {
          event.preventDefault();
          const previous = fields[index - 1];
          previous.focus();
          previous.value = previous.value.slice(0, -1);
          wrapper.dataset.dirty = "true";
        }
      });

      field.addEventListener("paste", event => {
        const raw = event.clipboardData?.getData("text") || "";
        const clean = digits(raw, hasTime ? 12 : 8);
        const requiredLength = hasTime ? 12 : 8;
        if (clean.length !== requiredLength) return;
        event.preventDefault();
        year.value = clean.slice(0, 4);
        month.value = clean.slice(4, 6);
        day.value = clean.slice(6, 8);
        if (hasTime) {
          hour.value = clean.slice(8, 10);
          minute.value = clean.slice(10, 12);
        }
        wrapper.dataset.dirty = "true";
        commitSegments();
      });
    });

    wrapper.addEventListener("focusout", () => {
      setTimeout(() => {
        if (!wrapper.contains(document.activeElement) && wrapper.dataset.dirty === "true") {
          commitSegments({ pad: true });
        }
      }, 0);
    });

    pickerButton.addEventListener("click", () => {
      if (wrapper.dataset.dirty === "true") commitSegments({ pad: true });
      try {
        if (typeof source.showPicker === "function") source.showPicker();
        else source.click();
      } catch {
        source.click();
      }
    });

    source.addEventListener("change", () => syncFromSource(true));
    source.addEventListener("invalid", event => {
      event.preventDefault();
      wrapper.classList.add("is-invalid");
      const target = fields.find(field => !field.value) || fields[0];
      target.focus();
    });

    wrapper.__syncDateSegmentsV127 = () => syncFromSource(true);
    syncFromSource(true);
  }

  function patchAll() {
    installStyle();
    document.querySelectorAll(SELECTOR).forEach(buildControl);
  }

  function syncAll() {
    document.querySelectorAll(".date-segment-control-v127").forEach(wrapper => {
      wrapper.__syncDateSegmentsV127?.();
    });
  }

  function observeDialogs() {
    document.querySelectorAll("dialog").forEach(dialog => {
      if (dialog.__dateSegmentObserverV127) return;
      dialog.__dateSegmentObserverV127 = true;
      new MutationObserver(() => {
        if (dialog.open) requestAnimationFrame(syncAll);
      }).observe(dialog, { attributes: true, attributeFilter: ["open"] });
    });
  }

  function start() {
    patchAll();
    observeDialogs();
    setTimeout(syncAll, 0);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  window.addEventListener("pageshow", () => setTimeout(syncAll, 0));
})();
