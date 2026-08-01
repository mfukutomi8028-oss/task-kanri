// v131: Persist the primary task sort and add secondary list-column sorting.
(function installListSortingV131() {
  const LIST_SELECTOR = "#listView";
  const SORT_SELECT_SELECTOR = "#sortSelect";
  const VALID_BASE_SORTS = new Set(["smart", "due", "updated", "priority"]);
  const COLUMNS = [
    { index: 1, key: "favorite", label: "スター" },
    { index: 2, key: "title", label: "件名" },
    { index: 3, key: "assignee", label: "担当" },
    { index: 4, key: "status", label: "状態" },
    { index: 5, key: "priority", label: "優先度" },
    { index: 6, key: "category", label: "分類" },
    { index: 7, key: "due", label: "期限" },
    { index: 8, key: "updated", label: "更新" }
  ];
  const COLUMN_BY_KEY = new Map(COLUMNS.map(column => [column.key, column]));
  const collator = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });
  const STATUS_ORDER = new Map(["未着手", "対応中", "確認待ち", "保留", "完了"].map((value, index) => [value, index]));
  const PRIORITY_ORDER = new Map([["低", 0], ["中", 1], ["高", 2], ["緊急", 3]]);

  let scheduled = false;
  let applying = false;
  let restoringBase = false;
  let lastBaseValue = "";

  function getRoomId() {
    try {
      const value = new URLSearchParams(location.search).get("room");
      if (value) return String(value).replace(/[.#$/\[\]]/g, "-").slice(0, 60);
    } catch {}
    return localStorage.getItem("systemTaskRoomId") || "default";
  }

  function baseSortStorageKey() {
    return `work-board-base-sort:${getRoomId()}`;
  }

  function columnSortStorageKey() {
    return `work-board-list-column-sort:${getRoomId()}`;
  }

  function taskStorageKey() {
    return `system-task-tasks:${getRoomId()}`;
  }

  function readColumnSort() {
    try {
      const value = JSON.parse(localStorage.getItem(columnSortStorageKey()) || "null");
      if (!value || !COLUMN_BY_KEY.has(value.key) || !["asc", "desc"].includes(value.direction)) return null;
      return value;
    } catch {
      return null;
    }
  }

  function writeColumnSort(value) {
    if (!value) localStorage.removeItem(columnSortStorageKey());
    else localStorage.setItem(columnSortStorageKey(), JSON.stringify(value));
  }

  function readTaskMap() {
    try {
      const tasks = JSON.parse(localStorage.getItem(taskStorageKey()) || "[]");
      if (!Array.isArray(tasks)) return new Map();
      return new Map(tasks.map(task => [String(task?.id || ""), task]));
    } catch {
      return new Map();
    }
  }

  function normalizeText(value) {
    return String(value || "").normalize("NFKC").trim();
  }

  function isMissing(value) {
    return value === null || value === undefined || value === "" || Number.isNaN(value);
  }

  function getCellText(row, index, selector = "") {
    const cell = row.cells[index];
    if (!cell) return "";
    return normalizeText(selector ? cell.querySelector(selector)?.textContent : cell.textContent);
  }

  function parseDisplayedDate(value) {
    const match = normalizeText(value).match(/^(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (!match) return null;
    const now = new Date();
    return new Date(now.getFullYear(), Number(match[1]) - 1, Number(match[2]), Number(match[3] || 0), Number(match[4] || 0)).getTime();
  }

  function valueFor(row, column, task) {
    switch (column.key) {
      case "favorite":
        return row.querySelector(".favorite-button.starred") ? 1 : 0;
      case "title":
        return normalizeText(task?.title || getCellText(row, column.index, "strong"));
      case "assignee":
        return normalizeText(task?.assignee || getCellText(row, column.index, ".user-badge"));
      case "status": {
        const value = normalizeText(task?.status || getCellText(row, column.index, ".badge"));
        return STATUS_ORDER.has(value) ? STATUS_ORDER.get(value) : value;
      }
      case "priority": {
        const value = normalizeText(task?.priority || getCellText(row, column.index, ".badge"));
        return PRIORITY_ORDER.has(value) ? PRIORITY_ORDER.get(value) : value;
      }
      case "category":
        return normalizeText(task?.category || getCellText(row, column.index));
      case "due": {
        if (task?.dueDate) {
          const time = task.dueTime || "00:00";
          const parsed = new Date(`${task.dueDate}T${time}`).getTime();
          return Number.isNaN(parsed) ? null : parsed;
        }
        return parseDisplayedDate(getCellText(row, column.index));
      }
      case "updated": {
        const updatedAt = Number(task?.updatedAt || 0);
        return updatedAt > 0 ? updatedAt : parseDisplayedDate(getCellText(row, column.index));
      }
      default:
        return "";
    }
  }

  function compareValues(a, b, direction) {
    const aMissing = isMissing(a);
    const bMissing = isMissing(b);
    if (aMissing || bMissing) {
      if (aMissing && bMissing) return 0;
      return aMissing ? 1 : -1;
    }

    let result;
    if (typeof a === "number" && typeof b === "number") result = a - b;
    else result = collator.compare(String(a), String(b));
    return direction === "desc" ? -result : result;
  }

  function sortRows(table, sort) {
    if (!sort || applying) return;
    const column = COLUMN_BY_KEY.get(sort.key);
    const tbody = table?.tBodies?.[0];
    if (!column || !tbody) return;

    const taskMap = readTaskMap();
    const rows = [...tbody.querySelectorAll("tr[data-task-id]")];
    if (rows.length < 2) return;

    const indexed = rows.map((row, index) => ({
      row,
      index,
      value: valueFor(row, column, taskMap.get(String(row.dataset.taskId || "")))
    }));
    indexed.sort((a, b) => compareValues(a.value, b.value, sort.direction) || (a.index - b.index));

    const current = rows.map(row => row.dataset.taskId).join("\u0000");
    const next = indexed.map(item => item.row.dataset.taskId).join("\u0000");
    if (current === next) return;

    applying = true;
    const fragment = document.createDocumentFragment();
    indexed.forEach(item => fragment.appendChild(item.row));
    tbody.appendChild(fragment);
    applying = false;
  }

  function makeHeaderSortable(th, column) {
    if (th.dataset.listSortReady === "true") return;
    const original = normalizeText(th.textContent) || column.label;
    th.dataset.listSortReady = "true";
    th.dataset.listSortKey = column.key;
    th.classList.add("list-sortable-header");
    th.tabIndex = 0;
    th.setAttribute("role", "button");
    th.setAttribute("aria-label", `${column.label}で並び替え`);
    th.innerHTML = `<span class="list-sort-heading"><span>${original}</span><span class="list-sort-arrow" aria-hidden="true">↕</span></span>`;
  }

  function ensureStatusBar(listView, table) {
    let bar = listView.querySelector(".list-column-sort-status");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "list-column-sort-status";
      bar.innerHTML = `<span data-list-sort-summary></span><button type="button" data-clear-list-column-sort hidden>見出し並び順を解除</button>`;
      table.before(bar);
    }
    return bar;
  }

  function updateHeaderState(table, sort) {
    table.querySelectorAll("thead th[data-list-sort-key]").forEach(th => {
      const active = Boolean(sort && th.dataset.listSortKey === sort.key);
      th.classList.toggle("active", active);
      th.setAttribute("aria-sort", active ? (sort.direction === "asc" ? "ascending" : "descending") : "none");
      const arrow = th.querySelector(".list-sort-arrow");
      if (arrow) arrow.textContent = active ? (sort.direction === "asc" ? "↑" : "↓") : "↕";
    });
  }

  function updateStatusBar(bar, sort) {
    const select = document.querySelector(SORT_SELECT_SELECTOR);
    const baseLabel = select?.selectedOptions?.[0]?.textContent?.trim() || "おすすめ順";
    const summary = bar.querySelector("[data-list-sort-summary]");
    const clearButton = bar.querySelector("[data-clear-list-column-sort]");
    if (!summary || !clearButton) return;

    if (!sort) {
      summary.textContent = `元の並び順：${baseLabel}　｜　列見出しをクリックすると追加で並び替えできます`;
      clearButton.hidden = true;
      return;
    }

    const column = COLUMN_BY_KEY.get(sort.key);
    summary.textContent = `元の並び順：${baseLabel}　｜　一覧見出し：${column?.label || sort.key}（${sort.direction === "asc" ? "昇順" : "降順"}）`;
    clearButton.hidden = false;
  }

  function restoreBaseSort() {
    const select = document.querySelector(SORT_SELECT_SELECTOR);
    if (!select) return;
    const saved = localStorage.getItem(baseSortStorageKey()) || "";
    const value = VALID_BASE_SORTS.has(saved) ? saved : select.value;
    if (VALID_BASE_SORTS.has(value) && select.value !== value) {
      restoringBase = true;
      select.value = value;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      restoringBase = false;
    }
    lastBaseValue = select.value;
  }

  function detectBaseSortChange() {
    const select = document.querySelector(SORT_SELECT_SELECTOR);
    if (!select) return;
    if (!lastBaseValue) {
      lastBaseValue = select.value;
      return;
    }
    if (select.value === lastBaseValue) return;
    lastBaseValue = select.value;
    if (VALID_BASE_SORTS.has(select.value)) localStorage.setItem(baseSortStorageKey(), select.value);
    if (!restoringBase) writeColumnSort(null);
  }

  function enhanceList() {
    if (applying) return;
    detectBaseSortChange();
    const listView = document.querySelector(LIST_SELECTOR);
    const table = listView?.querySelector("table.task-table");
    if (!listView || !table) return;

    const headerCells = table.tHead?.rows?.[0]?.cells || [];
    COLUMNS.forEach(column => {
      const th = headerCells[column.index];
      if (th) makeHeaderSortable(th, column);
    });

    const sort = readColumnSort();
    const bar = ensureStatusBar(listView, table);
    updateHeaderState(table, sort);
    updateStatusBar(bar, sort);
    sortRows(table, sort);
  }

  function scheduleEnhance() {
    if (scheduled || applying) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhanceList();
    });
  }

  function activateHeader(th) {
    const key = th?.dataset?.listSortKey;
    if (!COLUMN_BY_KEY.has(key)) return;
    const current = readColumnSort();
    const direction = current?.key === key && current.direction === "asc" ? "desc" : "asc";
    writeColumnSort({ key, direction });
    scheduleEnhance();
  }

  document.addEventListener("click", event => {
    const clearButton = event.target.closest("[data-clear-list-column-sort]");
    if (clearButton) {
      event.preventDefault();
      writeColumnSort(null);
      scheduleEnhance();
      return;
    }

    const th = event.target.closest(`${LIST_SELECTOR} th[data-list-sort-key]`);
    if (!th) return;
    event.preventDefault();
    activateHeader(th);
  });

  document.addEventListener("keydown", event => {
    const th = event.target.closest?.(`${LIST_SELECTOR} th[data-list-sort-key]`);
    if (!th || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    activateHeader(th);
  });

  document.addEventListener("input", event => {
    if (!event.target.matches?.(SORT_SELECT_SELECTOR)) return;
    if (VALID_BASE_SORTS.has(event.target.value)) localStorage.setItem(baseSortStorageKey(), event.target.value);
    lastBaseValue = event.target.value;
    if (!restoringBase) writeColumnSort(null);
    scheduleEnhance();
  }, true);

  document.addEventListener("change", event => {
    if (!event.target.matches?.(SORT_SELECT_SELECTOR)) return;
    if (VALID_BASE_SORTS.has(event.target.value)) localStorage.setItem(baseSortStorageKey(), event.target.value);
    lastBaseValue = event.target.value;
    if (!restoringBase) writeColumnSort(null);
    scheduleEnhance();
  }, true);

  function start() {
    restoreBaseSort();
    const listView = document.querySelector(LIST_SELECTOR);
    if (listView) new MutationObserver(scheduleEnhance).observe(listView, { childList: true, subtree: true });
    scheduleEnhance();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
