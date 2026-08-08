// Ver.137 ToDo protocol. This module deliberately has no DOM/Firebase imports so
// listener ordering and promotion boundaries can be unit-tested in Node.
export const TODO_MAX_LENGTH = 100;
export const TODO_MEMO_MAX_LENGTH = 1000;
const STALE_SNAPSHOT_LIMIT = 2;
const INVALID_TODO_KEY = /[.#$\[\]\/]/;

export function isCanonicalTodoId(value) {
  const id = String(value || '');
  return Boolean(id) && id.length <= 768 && !INVALID_TODO_KEY.test(id);
}

export function normalizeTodo(value = {}) {
  const text = String(value.text || '').trim().slice(0, TODO_MAX_LENGTH);
  const memo = String(value.memo || '').trim().slice(0, TODO_MEMO_MAX_LENGTH);
  const revision = Number.isSafeInteger(Number(value.revision)) && Number(value.revision) >= 0 ? Number(value.revision) : 0;
  const completed = value.completed === true;
  return { id: String(value.id || ''), text, memo, completed, order: Number.isFinite(Number(value.order)) ? Number(value.order) : 0,
    owner: String(value.owner || ''), revision, createdAt: Number(value.createdAt) || 0, updatedAt: Number(value.updatedAt) || 0,
    completedAt: completed ? (Number(value.completedAt) || 0) : 0 };
}

// The Firebase map key is the only trusted identifier. A record's id field is
// normalized to that key before it reaches rendering or a write path.
export function canonicalTodoRecord(key, value) {
  if (!isCanonicalTodoId(key) || !value || typeof value !== 'object') return null;
  const todo = normalizeTodo({ ...value, id: key });
  return todo.id && todo.text ? todo : null;
}

export function canonicalTodoMap(records) {
  return Object.fromEntries(Object.entries(records || {}).flatMap(([key, value]) => {
    const todo = canonicalTodoRecord(key, value);
    return todo ? [[key, todo]] : [];
  }));
}

export function sortTodos(records, owner) {
  return Object.entries(records || {}).flatMap(([key, value]) => {
    const todo = canonicalTodoRecord(key, value);
    return todo ? [todo] : [];
  }).filter(todo => todo.owner === owner)
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

export function todoSegment(records, owner, segment, today) {
  return sortTodos(records, owner).filter(todo => segment === 'completed-today'
    ? todo.completed && todoLocalDate(todo.completedAt) === today
    : !todo.completed);
}

function todoLocalDate(timestamp) {
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function makeBarrier(change, record) {
  const baseRevision = Number.isSafeInteger(Number(change.baseRevision)) && Number(change.baseRevision) >= 0
    ? Number(change.baseRevision) : Number(record?.revision || 0);
  return {
    expected: record,
    revision: Number(record?.revision || 0),
    baseRevision,
    remainingStaleSnapshots: STALE_SNAPSHOT_LIMIT
  };
}

// Only a Todo id behind a pending local commit is protected. Other remote records
// are always authoritative, avoiding whole-collection replacement protection.
export function reduceTodoSync(previous, action) {
  const base = previous || { roomId: '', raw: {}, barriers: {} };
  if (action?.type === 'reset-room' || (action?.roomId && action.roomId !== base.roomId)) return { roomId: action?.roomId || '', raw: {}, barriers: {} };
  const raw = canonicalTodoMap(base.raw); const barriers = { ...(base.barriers || {}) };
  if (action?.type === 'apply-commit') {
    for (const change of action.changes || []) {
      const id = String(change.id || ''); if (!isCanonicalTodoId(id)) continue;
      const record = change.record == null ? null : canonicalTodoRecord(id, change.record);
      if (change.record != null && !record) continue;
      if (record == null) delete raw[id]; else raw[id] = record;
      barriers[id] = makeBarrier(change, record);
    }
    return { roomId: base.roomId || action.roomId || '', raw, barriers };
  }
  if (action?.type !== 'receive-authoritative-snapshot') return base;
  const incoming = canonicalTodoMap(action.value);
  const ids = new Set([...Object.keys(raw), ...Object.keys(incoming), ...Object.keys(barriers)]);
  for (const id of ids) {
    const next = incoming[id] ?? null; const barrier = barriers[id];
    if (!barrier) { if (next == null) delete raw[id]; else raw[id] = next; continue; }
    const expected = barrier.expected;
    const nextRevision = Number(next?.revision || 0);
    const expectedRevision = Number(barrier.revision || 0);
    const baseRevision = Number(barrier.baseRevision || 0);
    if (expected == null) {
      // A delayed pre-delete record cannot revive a locally committed delete.
      // A confirmed absence, or a genuinely newer re-creation, ends protection.
      if (next == null) { delete raw[id]; delete barriers[id]; continue; }
      if (nextRevision > baseRevision) { raw[id] = next; delete barriers[id]; continue; }
      const remaining = Number(barrier.remainingStaleSnapshots ?? STALE_SNAPSHOT_LIMIT) - 1;
      if (remaining <= 0) delete barriers[id];
      else barriers[id] = { ...barrier, remainingStaleSnapshots: remaining };
      continue;
    }
    if (next != null && (nextRevision === expectedRevision || nextRevision > expectedRevision)) {
      raw[id] = next; delete barriers[id]; continue;
    }
    // A remote deletion is authoritative after a bounded acknowledgement window.
    // Older records never overwrite the local commit; their barrier merely expires.
    const remaining = Number(barrier.remainingStaleSnapshots ?? STALE_SNAPSHOT_LIMIT) - 1;
    if (remaining <= 0) {
      if (next == null) delete raw[id];
      delete barriers[id];
    } else barriers[id] = { ...barrier, remainingStaleSnapshots: remaining };
  }
  return { roomId: base.roomId || action.roomId || '', raw, barriers };
}

export function canPromoteTodo(context, todo) {
  return Boolean(context && todo && context.todoId === todo.id && context.owner === todo.owner && Number(context.baseRevision) === Number(todo.revision));
}
