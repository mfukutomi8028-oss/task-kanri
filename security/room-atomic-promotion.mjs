// Ver.570: future-only, trusted-service transaction planner (never a browser writer).
// A verified Auth UID and server-generated task ID MUST be supplied by a trusted
// backend. Execute this pure function inside ONE room-scoped RTDB transaction.
import { createHash } from 'node:crypto';

const isMap = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const idPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const validId = value => typeof value === 'string' && idPattern.test(value)
  && !['constructor', 'prototype', '__proto__'].includes(value);
const deny = reason => ({ action: 'deny', reason });

export function planRoomTodoPromotionV570(room, intent, trusted) {
  if (!isMap(room)) return deny('room-unavailable');
  if (!isMap(intent) || !isMap(trusted)) return deny('invalid-intent');
  const allowed = ['todoId', 'expectedRevision', 'requestId', 'title', 'description'];
  if (Object.keys(intent).some(key => !allowed.includes(key))) return deny('invalid-intent');
  if (!validId(trusted.uid) || !validId(trusted.generatedTaskId)
    || !Number.isSafeInteger(trusted.now) || trusted.now <= 0) return deny('unverified-server-context');
  const { uid, generatedTaskId, now } = trusted;
  if (!validId(intent.todoId) || !validId(intent.requestId)
    || !Number.isSafeInteger(intent.expectedRevision) || intent.expectedRevision < 1
    || typeof intent.title !== 'string' || typeof (intent.description ?? '') !== 'string') {
    return deny('invalid-intent');
  }
  const title = intent.title.trim();
  const description = (intent.description ?? '').trim();
  if (!title || title.length > 120 || description.length > 2000) return deny('invalid-intent');
  const role = room.access?.members?.[uid];
  if (role !== 'editor' && role !== 'admin') return deny('not-authorized');
  const digest = createHash('sha256').update(JSON.stringify([
    intent.todoId, intent.expectedRevision, title, description
  ])).digest('hex');
  const past = room.operations?.promotions?.[uid]?.[intent.requestId];
  if (past !== undefined) {
    if (!isMap(past) || past.digest !== digest || !validId(past.taskId)) {
      return deny('request-id-reused');
    }
    const replayTask = room.shared?.tasks?.[past.taskId];
    const replayTodo = room.personal?.[uid]?.todos?.[intent.todoId];
    if (!isMap(replayTask) || !isMap(replayTodo) || replayTodo.completed !== true
      || !Number.isSafeInteger(replayTodo.revision)
      || replayTodo.revision < intent.expectedRevision + 1) return deny('replay-state-inconsistent');
    return { action: 'replayed', taskId: past.taskId, room };
  }
  const todo = room.personal?.[uid]?.todos?.[intent.todoId];
  if (!isMap(todo) || todo.ownerUid !== uid || todo.completed === true
    || todo.revision !== intent.expectedRevision) return deny('stale-or-foreign-todo');
  if (room.shared?.tasks?.[generatedTaskId] !== undefined) return deny('task-id-collision');
  // Intentionally only the three fields allowed by the candidate task schema.
  // Production task fields/history will require a separate schema review.
  const task = { title, description, revision: 1 };
  const done = {
    ...todo, completed: true, completedAt: now, updatedAt: now,
    updatedByUid: uid, revision: todo.revision + 1
  };
  const shared = isMap(room.shared) ? room.shared : {};
  const personal = isMap(room.personal) ? room.personal : {};
  const person = isMap(personal[uid]) ? personal[uid] : {};
  const operations = isMap(room.operations) ? room.operations : {};
  const promotions = isMap(operations.promotions) ? operations.promotions : {};
  const userOperations = isMap(promotions[uid]) ? promotions[uid] : {};
  const nextRoom = {
    ...room,
    shared: { ...shared, tasks: { ...(shared.tasks ?? {}), [generatedTaskId]: task } },
    personal: { ...personal, [uid]: { ...person, todos: { ...(person.todos ?? {}), [intent.todoId]: done } } },
    operations: { ...operations, promotions: { ...promotions, [uid]: {
      ...userOperations, [intent.requestId]: {
        taskId: generatedTaskId, todoId: intent.todoId, digest, committedAt: now
      }
    } } }
  };
  return { action: 'commit', taskId: generatedTaskId, room: nextRoom };
}
