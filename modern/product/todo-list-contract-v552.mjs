// Ver.552: render-only ToDo contract. Reuse Classic's exact owner-scoped,
// open-first/completed-today selector order. Historical records are a separate
// owner-scoped Ver.552 read projection, never mixed into today's Classic segment.
const EMPTY = Object.freeze([]);
const emptyCounts = Object.freeze({ open: 0, completedToday: 0, history: 0 });
const norm = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const iso = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''));
const str = value => String(value ?? '');

function unavailable(reason) {
  return Object.freeze({
    ready: false, reason, source: null, roomId: '', selectedUser: '',
    todayISO: '', totals: emptyCounts, visible: emptyCounts,
    open: EMPTY, completedToday: EMPTY, history: EMPTY
  });
}

function normalizedRow(todo) {
  return Object.freeze({
    id: todo.id,
    text: str(todo.text),
    memo: str(todo.memo),
    owner: todo.owner,
    completed: todo.completed,
    order: todo.order,
    revision: todo.revision,
    createdAt: todo.createdAt,
    completedAt: todo.completedAt
  });
}

export function selectModernTodosV552(snapshot, { query = '' } = {}) {
  if (!snapshot || snapshot.ready !== true || snapshot.version !== '550'
    || !['local-only', 'remote-online'].includes(snapshot.source)
    || !snapshot.roomId || typeof snapshot.roomId !== 'string'
    || !snapshot.selectedUser || typeof snapshot.selectedUser !== 'string'
    || !iso(snapshot.todayISO)
    || !Array.isArray(snapshot.todos) || !Array.isArray(snapshot.todoHistory)) {
    return unavailable(snapshot?.reason || 'invalid-snapshot');
  }

  const ids = new Set();
  const open = [], completedToday = [], history = [];
  let inCompletedSegment = false;
  for (const todo of snapshot.todos) {
    if (!todo || typeof todo.id !== 'string' || !todo.id || ids.has(todo.id)
      || todo.owner !== snapshot.selectedUser || typeof todo.text !== 'string'
      || !todo.text || typeof todo.completed !== 'boolean') {
      return unavailable('invalid-snapshot');
    }
    ids.add(todo.id);
    if (todo.completed) {
      inCompletedSegment = true;
      completedToday.push(normalizedRow(todo));
    } else {
      if (inCompletedSegment) return unavailable('invalid-snapshot');
      open.push(normalizedRow(todo));
    }
  }
  for (const todo of snapshot.todoHistory) {
    if (!todo || typeof todo.id !== 'string' || !todo.id || ids.has(todo.id)
      || todo.owner !== snapshot.selectedUser || todo.completed !== true
      || typeof todo.text !== 'string' || !todo.text) {
      return unavailable('invalid-snapshot');
    }
    ids.add(todo.id);
    history.push(normalizedRow(todo));
  }

  const totals = Object.freeze({
    open: open.length, completedToday: completedToday.length, history: history.length
  });
  const term = norm(query);
  const matches = todo => !term || norm([todo.text, todo.memo].join(' ')).includes(term);
  const openVisible = Object.freeze(open.filter(matches));
  const doneVisible = Object.freeze(completedToday.filter(matches));
  const historyVisible = Object.freeze(history.filter(matches));
  return Object.freeze({
    ready: true, reason: null, source: snapshot.source,
    roomId: snapshot.roomId, selectedUser: snapshot.selectedUser,
    todayISO: snapshot.todayISO, totals,
    visible: Object.freeze({
      open: openVisible.length, completedToday: doneVisible.length, history: historyVisible.length
    }),
    open: openVisible, completedToday: doneVisible, history: historyVisible
  });
}
