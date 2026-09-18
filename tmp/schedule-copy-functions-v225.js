const SCHEDULE_COPY_MAX = 200;
let scheduleCopySourceId = "";
let scheduleCopySelectedDates = new Set();

function scheduleCopySource() {
  return state.schedules.find(item => item.id === scheduleCopySourceId) || null;
}

function scheduleCopyDefaultStart(source) {
  const start = new Date(source?.startAt || defaultScheduleStart());
  return toISODate(addDays(start, 1));
}

function openScheduleCopyDialog(source) {
  if (!source?.id) return;
  scheduleCopySourceId = source.id;
  scheduleCopySelectedDates = new Set();

  const sourceStart = new Date(source.startAt);
  const defaultStart = scheduleCopyDefaultStart(source);
  $("scheduleCopySourceTitle").textContent = source.title || "名称未設定の予定";
  $("scheduleCopySourceTime").textContent = formatScheduleDateTimeRange(source);
  $("scheduleCopyMethod").value = "once";
  $("scheduleCopyStartDate").value = defaultStart;
  $("scheduleCopyDateInput").value = defaultStart;
  $("scheduleCopyInterval").value = "1";
  $("scheduleCopyCount").value = "4";
  $("scheduleCopyEndMode").value = "count";
  $("scheduleCopyEndDate").value = toISODate(addMonths(parseISODate(defaultStart) || startOfToday(), 3));

  if (!Number.isNaN(sourceStart.getTime())) {
    $("scheduleCopyMonthDay").value = String(sourceStart.getDate());
    $("scheduleCopyNth").value = String(Math.min(5, getNthWeekInMonth(sourceStart)));
    $("scheduleCopyNthWeekday").value = String(sourceStart.getDay());
    document.querySelectorAll("[data-copy-weekday]").forEach(input => {
      input.checked = Number(input.value) === sourceStart.getDay();
    });
  }

  $("scheduleCopySubmit").dataset.operationKey = operationKey("schedule-copy", source.id);
  renderScheduleCopySelectedDates();
  syncScheduleCopyUi();
  $("scheduleCopyDialog").showModal();
}

function closeScheduleCopyDialog(reopenSource = false) {
  const source = scheduleCopySource();
  $("scheduleCopyDialog")?.close();
  scheduleCopySelectedDates = new Set();
  scheduleCopySourceId = "";
  if (reopenSource && source) openScheduleDialog(source);
}

function syncScheduleCopyUi() {
  const method = $("scheduleCopyMethod").value;
  const recurring = !["once", "dates"].includes(method);
  const intervalMethods = ["daily", "weekly", "monthlyDay", "monthlyNth", "monthEnd", "lastWeekday", "yearly"];
  const unitMap = {
    daily: "日ごと",
    weekly: "週ごと",
    monthlyDay: "か月ごと",
    monthlyNth: "か月ごと",
    monthEnd: "か月ごと",
    lastWeekday: "か月ごと",
    yearly: "年ごと"
  };

  $("scheduleCopyStartRow").hidden = method === "dates";
  const startText = $("scheduleCopyStartRow").childNodes[0];
  if (startText) startText.textContent = method === "once" ? "コピー先の日付 " : "開始日 ";
  $("scheduleCopyIntervalRow").hidden = !intervalMethods.includes(method);
  $("scheduleCopyIntervalUnit").textContent = unitMap[method] || "";
  $("scheduleCopyWeekdayRow").hidden = method !== "weekly";
  $("scheduleCopyMonthDayRow").hidden = method !== "monthlyDay";
  $("scheduleCopyNthRow").hidden = method !== "monthlyNth";
  $("scheduleCopyDatesRow").hidden = method !== "dates";
  $("scheduleCopyEndRow").hidden = !recurring;

  const endByDate = $("scheduleCopyEndMode").value === "date";
  $("scheduleCopyCountRow").hidden = !recurring || endByDate;
  $("scheduleCopyEndDateRow").hidden = !recurring || !endByDate;
  syncScheduleCopyPreview();
}

function addScheduleCopyDateFromInput() {
  const value = $("scheduleCopyDateInput").value;
  if (!parseISODate(value)) return toast("追加する日付を選択してください", true);
  scheduleCopySelectedDates.add(value);
  renderScheduleCopySelectedDates();
  syncScheduleCopyPreview();
}

function renderScheduleCopySelectedDates() {
  const host = $("scheduleCopyDateList");
  if (!host) return;
  const dates = [...scheduleCopySelectedDates].sort();
  host.innerHTML = dates.length
    ? dates.map(date => `<button type="button" class="schedule-copy-date-chip" data-remove-copy-date="${escapeHtml(date)}" title="この日付を外す">${escapeHtml(formatScheduleCopyDate(date))}<span>×</span></button>`).join("")
    : '<span class="schedule-copy-empty">日付を追加するとここに表示されます。</span>';
}

function formatScheduleCopyDate(isoDate) {
  const date = parseISODate(isoDate);
  if (!date) return isoDate;
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${isoDate}（${weekday}）`;
}

function scheduleCopyDateSerial(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
}

function scheduleCopyNthWeekday(year, monthIndex, nth, weekday) {
  const lastDay = daysInMonth(new Date(year, monthIndex, 1));
  if (nth === "last") {
    const date = new Date(year, monthIndex, lastDay);
    while (date.getDay() !== weekday) date.setDate(date.getDate() - 1);
    return date;
  }
  const number = clampNumber(nth, 1, 5, 1);
  const first = new Date(year, monthIndex, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  const day = 1 + offset + (number - 1) * 7;
  return day <= lastDay ? new Date(year, monthIndex, day) : null;
}

function scheduleCopyLastWeekday(year, monthIndex) {
  const date = new Date(year, monthIndex, daysInMonth(new Date(year, monthIndex, 1)));
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() - 1);
  return date;
}

function readScheduleCopyConfig() {
  return {
    method: $("scheduleCopyMethod").value,
    startDate: $("scheduleCopyStartDate").value,
    interval: clampNumber($("scheduleCopyInterval").value, 1, 36, 1),
    weekdays: [...document.querySelectorAll("[data-copy-weekday]:checked")].map(input => Number(input.value)),
    monthDay: clampNumber($("scheduleCopyMonthDay").value, 1, 31, 1),
    nth: $("scheduleCopyNth").value,
    nthWeekday: clampWeekday($("scheduleCopyNthWeekday").value),
    endMode: $("scheduleCopyEndMode").value,
    count: clampNumber($("scheduleCopyCount").value, 1, SCHEDULE_COPY_MAX, 4),
    endDate: $("scheduleCopyEndDate").value,
    selectedDates: [...scheduleCopySelectedDates].sort()
  };
}

function buildScheduleCopyDates(source, config = readScheduleCopyConfig()) {
  const result = { dates: [], truncated: false, error: "" };
  if (!source) {
    result.error = "コピー元の予定が見つかりません";
    return result;
  }

  if (config.method === "dates") {
    result.dates = [...new Set(config.selectedDates.filter(date => parseISODate(date)))].sort();
    if (!result.dates.length) result.error = "コピーする日付を追加してください";
    return result;
  }

  const start = parseISODate(config.startDate);
  if (!start) {
    result.error = "開始日を指定してください";
    return result;
  }
  start.setHours(0, 0, 0, 0);

  if (config.method === "once") {
    result.dates = [toISODate(start)];
    return result;
  }

  const end = config.endMode === "date" ? parseISODate(config.endDate) : null;
  if (config.endMode === "date") {
    if (!end) {
      result.error = "終了日を指定してください";
      return result;
    }
    end.setHours(0, 0, 0, 0);
    if (end < start) {
      result.error = "終了日は開始日以降にしてください";
      return result;
    }
  }

  if (config.method === "weekly" && !config.weekdays.length) {
    result.error = "曜日を1つ以上選択してください";
    return result;
  }

  const seen = new Set();
  const targetCount = config.endMode === "count" ? config.count : SCHEDULE_COPY_MAX + 1;
  const pushCandidate = candidate => {
    if (!candidate || Number.isNaN(candidate.getTime())) return false;
    candidate.setHours(0, 0, 0, 0);
    if (candidate < start) return false;
    if (end && candidate > end) return "stop";
    const iso = toISODate(candidate);
    if (!seen.has(iso)) {
      seen.add(iso);
      result.dates.push(iso);
    }
    if (result.dates.length > SCHEDULE_COPY_MAX) {
      result.truncated = true;
      result.dates = result.dates.slice(0, SCHEDULE_COPY_MAX);
      return "stop";
    }
    if (config.endMode === "count" && result.dates.length >= targetCount) return "stop";
    return false;
  };

  if (config.method === "daily") {
    let cursor = new Date(start);
    for (let guard = 0; guard < 100000; guard += 1) {
      if (pushCandidate(new Date(cursor)) === "stop") break;
      cursor = addDays(cursor, config.interval);
    }
  } else if (config.method === "weekdays") {
    let cursor = new Date(start);
    for (let guard = 0; guard < 100000; guard += 1) {
      if (cursor.getDay() >= 1 && cursor.getDay() <= 5) {
        if (pushCandidate(new Date(cursor)) === "stop") break;
      } else if (end && cursor > end) break;
      cursor = addDays(cursor, 1);
    }
  } else if (config.method === "weekly") {
    const anchorWeek = startOfWeekMonday(start);
    const weekdays = new Set(config.weekdays);
    let cursor = new Date(start);
    for (let guard = 0; guard < 100000; guard += 1) {
      if (end && cursor > end) break;
      const weekStart = startOfWeekMonday(cursor);
      const weekIndex = Math.floor((scheduleCopyDateSerial(weekStart) - scheduleCopyDateSerial(anchorWeek)) / 7);
      if (weekIndex >= 0 && weekIndex % config.interval === 0 && weekdays.has(cursor.getDay())) {
        if (pushCandidate(new Date(cursor)) === "stop") break;
      }
      cursor = addDays(cursor, 1);
    }
  } else if (["monthlyDay", "monthlyNth", "monthEnd", "lastWeekday"].includes(config.method)) {
    let monthCursor = new Date(start.getFullYear(), start.getMonth(), 1);
    for (let guard = 0; guard < 10000; guard += 1) {
      let candidate = null;
      const year = monthCursor.getFullYear();
      const month = monthCursor.getMonth();
      if (config.method === "monthlyDay") {
        const lastDay = daysInMonth(monthCursor);
        if (config.monthDay <= lastDay) candidate = new Date(year, month, config.monthDay);
      } else if (config.method === "monthlyNth") {
        candidate = scheduleCopyNthWeekday(year, month, config.nth, config.nthWeekday);
      } else if (config.method === "monthEnd") {
        candidate = new Date(year, month, daysInMonth(monthCursor));
      } else {
        candidate = scheduleCopyLastWeekday(year, month);
      }
      const outcome = pushCandidate(candidate);
      if (outcome === "stop") break;
      if (end && monthCursor > end) break;
      monthCursor = addMonths(monthCursor, config.interval);
    }
  } else if (config.method === "yearly") {
    const sourceStart = new Date(source.startAt);
    const month = sourceStart.getMonth();
    const day = sourceStart.getDate();
    let year = start.getFullYear();
    for (let guard = 0; guard < 1000; guard += 1) {
      const candidate = new Date(year, month, day);
      if (candidate.getMonth() === month && candidate.getDate() === day) {
        const outcome = pushCandidate(candidate);
        if (outcome === "stop") break;
      }
      if (end && candidate > end && year > end.getFullYear()) break;
      year += config.interval;
    }
  } else {
    result.error = "コピー方法を選択してください";
  }

  if (!result.error && !result.dates.length) result.error = "条件に該当する日付がありません";
  return result;
}

function scheduleCopyDraftForDate(source, isoDate, id, timestamp = Date.now()) {
  const sourceStart = new Date(source.startAt);
  const sourceEnd = new Date(source.endAt);
  const day = parseISODate(isoDate);
  if (!day || Number.isNaN(sourceStart.getTime()) || Number.isNaN(sourceEnd.getTime())) return null;
  day.setHours(sourceStart.getHours(), sourceStart.getMinutes(), sourceStart.getSeconds(), sourceStart.getMilliseconds());
  const duration = Math.max(60000, sourceEnd.getTime() - sourceStart.getTime());
  const draft = normalizeSchedule({
    id,
    title: source.title,
    startAt: day.toISOString(),
    endAt: new Date(day.getTime() + duration).toISOString(),
    assignee: source.assignee,
    location: source.location,
    category: source.category,
    memo: source.memo,
    relatedTaskId: source.relatedTaskId,
    revision: 0,
    createdAt: timestamp,
    createdBy: getCurrentUser(),
    updatedAt: timestamp,
    updatedBy: getCurrentUser()
  });
  draft.lastChange = makeScheduleChangeInfo(null, draft);
  return draft;
}

function scheduleCopyConflicts(source, dates) {
  return dates.flatMap((isoDate, index) => {
    const draft = scheduleCopyDraftForDate(source, isoDate, `preview-copy-${index}`, Date.now());
    if (!draft) return [];
    return getScheduleConflicts(draft).map(conflict => ({ date: isoDate, conflict }));
  });
}

function syncScheduleCopyPreview() {
  const source = scheduleCopySource();
  const result = buildScheduleCopyDates(source);
  const summary = $("scheduleCopyPreviewSummary");
  const datesHost = $("scheduleCopyPreviewDates");
  const note = $("scheduleCopyPreviewNote");
  if (!summary || !datesHost || !note) return;

  if (result.error) {
    summary.textContent = result.error;
    datesHost.innerHTML = "";
    note.textContent = "";
    return;
  }

  const conflicts = scheduleCopyConflicts(source, result.dates);
  summary.textContent = `${result.dates.length}件の予定を作成`;
  datesHost.innerHTML = result.dates.slice(0, 8).map(date => `<span>${escapeHtml(formatScheduleCopyDate(date))}</span>`).join("")
    + (result.dates.length > 8 ? `<span>ほか${result.dates.length - 8}件</span>` : "");
  const notes = [];
  if (result.truncated) notes.push(`最大${SCHEDULE_COPY_MAX}件を超えています。期間または間隔を調整してください。`);
  if (["monthlyDay", "yearly"].includes($("scheduleCopyMethod").value)) notes.push("存在しない日付（例：2月30日）は自動でスキップします。");
  if (conflicts.length) notes.push(`既存予定と時間が重なるコピー先が${new Set(conflicts.map(item => item.date)).size}日あります。`);
  note.textContent = notes.join(" ");
}

async function copyScheduleOccurrences(source, dates) {
  const timestamp = Date.now();
  const items = dates.map((date, index) => scheduleCopyDraftForDate(source, date, generateScheduleId(), timestamp + index)).filter(Boolean);
  if (items.length !== dates.length) return { ok: false, error: "invalid-copy-date" };
  const affectedPaths = items.map(item => `rooms/${ROOM_ID}/schedules/${item.id}`);

  return executeWrite("schedule-copy", source.id, () => transactionRoom(root => {
    const currentSource = root.schedules?.[source.id];
    if (!currentSource || normalizeRevision(currentSource.revision) !== normalizeRevision(source.revision)) throw new Error("conflict");
    root.schedules ||= {};
    for (const item of items) {
      if (root.schedules[item.id]) throw new Error("conflict");
      root.schedules[item.id] = { ...item, revision: 1 };
    }
    return root;
  }, affectedPaths));
}

async function submitScheduleCopy() {
  const source = scheduleCopySource();
  if (!source) return toast("コピー元の予定が見つかりません", true);
  const result = buildScheduleCopyDates(source);
  if (result.error) return toast(result.error, true);
  if (result.truncated || result.dates.length > SCHEDULE_COPY_MAX) return toast(`一度にコピーできるのは${SCHEDULE_COPY_MAX}件までです`, true);

  const conflicts = scheduleCopyConflicts(source, result.dates);
  if (conflicts.length) {
    const targetDates = [...new Set(conflicts.map(item => item.date))];
    const details = conflicts.slice(0, 5).map(item => `・${formatScheduleCopyDate(item.date)}：${item.conflict.title}`).join("\n");
    if (!confirm(`既存予定と時間が重なるコピー先が${targetDates.length}日あります。\n\n${details}${conflicts.length > 5 ? `\nほか${conflicts.length - 5}件` : ""}\n\nこのままコピーしますか？`)) return;
  }

  const copyResult = await copyScheduleOccurrences(source, result.dates);
  if (!copyResult.ok) return showWriteFailure(copyResult, "予定をコピーできませんでした。条件はそのままです。");
  const count = result.dates.length;
  closeScheduleCopyDialog(false);
  toast(`${count}件の予定をコピーしました`);
}
