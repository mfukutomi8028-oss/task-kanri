// Ver.553: pure read-only schedule projection from Classic Ver.550.
// Date boundaries match Classic: browser-local midnight and startAt inclusion.
// No Firebase, clock, DOM, storage, subscriber or writer here.
const EMPTY = Object.freeze([]);
const text = value => String(value ?? '');
const norm = value => text(value).normalize('NFKC').toLowerCase().replace(/\s+/g, '');
const isDateISO = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
};
const localDay = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0')].join('-');
const atMidnight = iso => {
  const [y,m,d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const dateValue = value => {
  if (typeof value !== 'string' || !value) return NaN;
  return new Date(value).getTime();
};
const strCompare = (a,b) => a.localeCompare(b, 'ja');
const fail = reason => Object.freeze({
  ready: false, reason, source: null, roomId: '', selectedUser: '',
  anchorISO: '', range: '', mode: '', startISO: '', endISO: '',
  total: 0, visible: 0, categories: EMPTY, assignees: EMPTY,
  rows: EMPTY, days: EMPTY, calendar: EMPTY
});

export function selectModernSchedulesV553(snapshot, {
  anchorISO, range = 'today', mode = 'list', query = '', assignee = '', category = ''
} = {}) {
  if (!snapshot || snapshot.ready !== true || snapshot.version !== '550'
    || !['local-only', 'remote-online'].includes(snapshot.source)
    || typeof snapshot.roomId !== 'string' || !snapshot.roomId
    || typeof snapshot.selectedUser !== 'string' || !snapshot.selectedUser
    || !isDateISO(snapshot.todayISO) || !Array.isArray(snapshot.tasks)
    || !Array.isArray(snapshot.schedules)) {
    return fail(snapshot?.reason || 'invalid-snapshot');
  }
  const anchor = anchorISO === undefined ? snapshot.todayISO : anchorISO;
  if (!isDateISO(anchor) || !['today','week','month'].includes(range)
    || !['list','calendar'].includes(mode) || (mode === 'calendar' && range !== 'month')) {
    return fail('invalid-selection');
  }
  const tasks = new Map();
  const taskIds = new Set();
  for (const task of snapshot.tasks) {
    if (!task || typeof task.id !== 'string' || !task.id || taskIds.has(task.id)
      || typeof task.title !== 'string') return fail('invalid-snapshot');
    tasks.set(task.id, task.title);
    taskIds.add(task.id);
  }
  const seen = new Set(), parsed = [];
  for (const schedule of snapshot.schedules) {
    if (!schedule || typeof schedule.id !== 'string' || !schedule.id || seen.has(schedule.id)
      || typeof schedule.startAt !== 'string') return fail('invalid-snapshot');
    seen.add(schedule.id);
    const startMs = dateValue(schedule.startAt);
    if (!Number.isFinite(startMs)) continue; // Same as Classic's invalid-start filter.
    const start = new Date(startMs);
    const endMs = dateValue(schedule.endAt);
    const relation = text(schedule.relatedTaskId);
    parsed.push(Object.freeze({
      id: schedule.id,
      title: text(schedule.title), assignee: text(schedule.assignee),
      category: text(schedule.category), location: text(schedule.location),
      memo: text(schedule.memo), relatedTaskId: relation,
      relatedTaskTitle: tasks.has(relation) ? tasks.get(relation) : '',
      relatedTaskMissing: Boolean(relation && !tasks.has(relation)),
      startAt: schedule.startAt, endAt: text(schedule.endAt),
      dateISO: localDay(start),
      endDateISO: Number.isFinite(endMs) ? localDay(new Date(endMs)) : '',
      startMinute: start.getHours() * 60 + start.getMinutes(),
      endMinute: Number.isFinite(endMs)
        ? new Date(endMs).getHours() * 60 + new Date(endMs).getMinutes() : null,
      endKnown: Number.isFinite(endMs),
      revision: schedule.revision
    }));
  }

  const anchorDate = atMidnight(anchor);
  const start = range === 'month'
    ? new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1) : anchorDate;
  const end = range === 'month'
    ? new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 1)
    : new Date(start.getFullYear(), start.getMonth(), start.getDate() + (range === 'week' ? 7 : 1));
  const inRange = parsed.filter(row => {
    const ms = dateValue(row.startAt);
    return ms >= start.getTime() && ms < end.getTime();
  });
  const categories = Object.freeze([...new Set(inRange.map(row => row.category).filter(Boolean))].sort(strCompare));
  const assignees = Object.freeze([...new Set(inRange.map(row => row.assignee).filter(Boolean))].sort(strCompare));
  const needle = norm(query), selectedAssignee = text(assignee), selectedCategory = text(category);
  const matching = inRange.filter(row =>
    (!selectedAssignee || row.assignee === selectedAssignee)
    && (!selectedCategory || row.category === selectedCategory)
    && (!needle || norm([
      row.title,row.memo,row.location,row.category,row.assignee,row.relatedTaskTitle
    ].join(' ')).includes(needle)));
  matching.sort((a,b) => dateValue(a.startAt) - dateValue(b.startAt)
    || strCompare(a.title,b.title) || strCompare(a.id,b.id));
  const grouped = new Map();
  for (const row of matching) {
    if (!grouped.has(row.dateISO)) grouped.set(row.dateISO, []);
    grouped.get(row.dateISO).push(row);
  }
  const days = Object.freeze([...grouped].map(([iso,rows]) =>
    Object.freeze({dateISO: iso, rows: Object.freeze(rows)})));
  const calendar = [];
  if (range === 'month' && mode === 'calendar') {
    const first = new Date(start);
    first.setDate(first.getDate() - first.getDay()); // Sunday-first as in Classic.
    const total = Math.ceil((start.getDay() + new Date(start.getFullYear(),
      start.getMonth() + 1, 0).getDate()) / 7) * 7;
    for (let i=0; i<total; i++) {
      const day = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i);
      const dayISO = localDay(day);
      calendar.push(Object.freeze({
        dateISO: dayISO, day: day.getDate(),
        inMonth: day.getMonth() === start.getMonth(),
        today: dayISO === snapshot.todayISO,
        rows: Object.freeze(grouped.get(dayISO) || [])
      }));
    }
  }

  return Object.freeze({
    ready: true, reason: null, source: snapshot.source,
    roomId: snapshot.roomId, selectedUser: snapshot.selectedUser,
    todayISO: snapshot.todayISO, anchorISO: anchor, range, mode,
    startISO: localDay(start), endISO: localDay(end),
    total: inRange.length, visible: matching.length,
    categories, assignees, rows: Object.freeze(matching),
    days, calendar: Object.freeze(calendar)
  });
}
