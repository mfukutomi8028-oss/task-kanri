// Ver.550: on-demand, read-only projection from the existing Classic data owner.
// This module never initializes Firebase, subscribes, writes, opens a UI, or reads storage.
// It is not an authorization boundary; the product still requires server-side access control.
import { selectVisibleTodos, summarizeTaskCounters } from './workspace-core-v537.js';

const EMPTY_ROWS = Object.freeze([]);
const text = value => String(value ?? '');
const timestamp = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const revision = value => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0;

function unavailable(reason, roomId = '', selectedUser = '') {
  return Object.freeze({
    version: '550', ready: false, reason, source: null,
    roomId, selectedUser, summary: null,
    tasks: EMPTY_ROWS, todos: EMPTY_ROWS, schedules: EMPTY_ROWS
  });
}

function isCanonicalList(items) {
  if (!Array.isArray(items)) return false;
  const ids = new Set();
  for (const item of items) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id || ids.has(item.id)) return false;
    ids.add(item.id);
  }
  return true;
}

function taskRow(task) {
  return Object.freeze({
    id: task.id, title: text(task.title), description: text(task.description),
    status: text(task.status), priority: text(task.priority),
    assignee: text(task.assignee), category: text(task.category),
    requester: text(task.requester), dueDate: text(task.dueDate),
    dueTime: text(task.dueTime), pinned: Boolean(task.pinned),
    revision: revision(task.revision), createdAt: timestamp(task.createdAt),
    updatedAt: timestamp(task.updatedAt), completedAt: timestamp(task.completedAt)
  });
}

function todoRow(todo) {
  return Object.freeze({
    id: todo.id, text: todo.text, memo: todo.memo, owner: todo.owner,
    completed: todo.completed, order: todo.order, revision: todo.revision,
    createdAt: todo.createdAt, updatedAt: todo.updatedAt,
    completedAt: todo.completedAt
  });
}

function scheduleRow(schedule) {
  return Object.freeze({
    id: schedule.id, title: text(schedule.title),
    startAt: text(schedule.startAt), endAt: text(schedule.endAt),
    assignee: text(schedule.assignee), category: text(schedule.category),
    location: text(schedule.location), memo: text(schedule.memo),
    relatedTaskId: text(schedule.relatedTaskId), revision: revision(schedule.revision),
    updatedAt: timestamp(schedule.updatedAt)
  });
}

export function projectWorkspaceReadV550(owner) {
  if (!owner || typeof owner !== 'object') return unavailable('owner-unavailable');
  const roomId = text(owner.roomId);
  const selectedUser = text(owner.selectedUser);
  if (!roomId || !selectedUser || owner.selectedUserReady !== true) {
    return unavailable('identity-not-selected');
  }
  if (owner.connectionMode !== 'local-only' && owner.connectionMode !== 'remote-online') {
    return unavailable(owner.connectionMode === 'remote-degraded' ? 'degraded' : 'loading', roomId, selectedUser);
  }
  if (owner.connectionMode === 'remote-online') {
    const phases = owner.collectionState && typeof owner.collectionState === 'object'
      ? Object.values(owner.collectionState) : [];
    if (phases.length < 5 || !phases.every(phase => phase === 'ready')) {
      return unavailable('loading', roomId, selectedUser);
    }
  }
  if (!isCanonicalList(owner.tasks) || !isCanonicalList(owner.schedules)
    || !owner.todoRaw || typeof owner.todoRaw !== 'object' || Array.isArray(owner.todoRaw)
    || !(owner.today instanceof Date) || !Number.isFinite(owner.today.getTime())
    || !/^\d{4}-\d{2}-\d{2}$/.test(text(owner.todayISO))
    || [owner.isCompleted, owner.isMine, owner.parseDueDate].some(fn => typeof fn !== 'function')) {
    return unavailable('invalid-owner-state', roomId, selectedUser);
  }

  // Reuse Classic selectors rather than making a Modern-specific interpretation.
  // The canonical ToDo selector exposes only the selected user's open and
  // completed-today records; historical ToDos require a later separate contract.
  const summary = Object.freeze(summarizeTaskCounters(owner.tasks, {
    today: owner.today,
    isCompleted: owner.isCompleted,
    isMine: owner.isMine,
    parseDueDate: owner.parseDueDate
  }));
  const todos = selectVisibleTodos(owner.todoRaw, selectedUser, owner.todayISO);
  return Object.freeze({
    version: '550', ready: true, reason: null, source: owner.connectionMode,
    roomId, selectedUser, todayISO: owner.todayISO,
    summary,
    tasks: Object.freeze(owner.tasks.map(taskRow)),
    todos: Object.freeze(todos.map(todoRow)),
    schedules: Object.freeze(owner.schedules.map(scheduleRow))
  });
}

export function createWorkspaceReadFacadeV550(getCanonicalOwner) {
  if (typeof getCanonicalOwner !== 'function') {
    throw new TypeError('An existing canonical data-owner provider is required');
  }
  // Every call reads the current owner state; it never retains another cache.
  return Object.freeze({
    read() { return projectWorkspaceReadV550(getCanonicalOwner()); }
  });
}
