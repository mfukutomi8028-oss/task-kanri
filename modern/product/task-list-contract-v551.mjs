// Ver.551: strictly read-only Modern task-list presentation contract.
// The only source is a Ver.550 snapshot from Classic; this file never connects
// to Firebase, subscribes, persists, reads storage, or interprets demo-store.
const EMPTY = Object.freeze([]);
const norm = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const isIso = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''));
const completed = status => norm(status).replace(/\s/g, '') === '完了';
const display = value => String(value ?? '');

export function selectModernTaskListV551(snapshot, { query = '', status = 'all' } = {}) {
  if (!snapshot || snapshot.ready !== true || snapshot.version !== '550'
    || !['remote-online', 'local-only'].includes(snapshot.source)
    || !Array.isArray(snapshot.tasks) || !isIso(snapshot.todayISO)
    || typeof snapshot.roomId !== 'string' || !snapshot.roomId
    || typeof snapshot.selectedUser !== 'string' || !snapshot.selectedUser) {
    return Object.freeze({
      ready: false, reason: snapshot?.reason || 'invalid-snapshot',
      source: null, roomId: '', selectedUser: '',
      total: 0, visible: 0, statuses: EMPTY, rows: EMPTY
    });
  }
  const ids = new Set();
  const rows = [];
  for (const task of snapshot.tasks) {
    if (!task || typeof task.id !== 'string' || !task.id || ids.has(task.id)) {
      return Object.freeze({
        ready: false, reason: 'invalid-snapshot',
        source: null, roomId: '', selectedUser: '',
        total: 0, visible: 0, statuses: EMPTY, rows: EMPTY
      });
    }
    ids.add(task.id);
    const done = completed(task.status);
    const dueDate = display(task.dueDate);
    rows.push(Object.freeze({
      id: task.id,
      title: display(task.title),
      category: display(task.category),
      status: display(task.status),
      assignee: display(task.assignee),
      priority: display(task.priority),
      dueDate,
      revision: task.revision,
      completed: done,
      overdue: !done && isIso(dueDate) && dueDate < snapshot.todayISO
    }));
  }
  const statuses = Object.freeze([...new Set(rows.map(task => task.status).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja')));
  const needle = norm(query);
  const statusValue = display(status || 'all');
  const visible = rows.filter(row =>
    (statusValue === 'all' || row.status === statusValue)
    && (!needle || norm([row.title,row.category,row.assignee,row.status].join(' ')).includes(needle)));
  // Matching Classic "all tasks" scope: the list includes completed tasks.
  // Presentation sorting does not mutate Classic records or claim to be a
  // replacement for the Classic task-list ordering/personal view options.
  visible.sort((a,b) => Number(a.completed) - Number(b.completed)
    || Number(!isIso(a.dueDate)) - Number(!isIso(b.dueDate))
    || (isIso(a.dueDate) && isIso(b.dueDate) ? a.dueDate.localeCompare(b.dueDate) : 0)
    || a.title.localeCompare(b.title,'ja')
    || a.id.localeCompare(b.id));
  return Object.freeze({
    ready: true, reason: null,
    source: snapshot.source, roomId: snapshot.roomId,
    selectedUser: snapshot.selectedUser,
    total: rows.length, visible: visible.length,
    statuses, rows: Object.freeze(visible)
  });
}
