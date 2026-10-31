// Ver.574: READ-ONLY inventory of Classic /rooms data for manual migration review.
// Does not transform records, write to either database, or expose names/IDs in output.
import { TODO_MAX_LENGTH, TODO_MEMO_MAX_LENGTH } from '../todo-sync-v136.js';

const record = v => v !== null && typeof v === 'object'
  && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const newKey = v => /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(v)
  && !['__proto__', 'constructor', 'prototype'].includes(v);
const futureTaskFields = new Set(['title', 'description', 'revision']);
const otherCollections = Object.freeze(['schedules', 'knowledge', 'meta', 'workflowV148', 'workflowV152']);
const resultUnavailable = reason => ({
  result: 'NO_GO', scope: 'legacy-read-only', reason,
  // Never infer that an inaccessible or malformed snapshot means empty.
  countsVerified: false
});

export function auditLegacyRoomForV574(snapshot) {
  if (!record(snapshot)) return resultUnavailable('snapshot-unavailable');
  if ((snapshot.tasks !== undefined && snapshot.tasks !== null && !record(snapshot.tasks))
    || (snapshot.todos !== undefined && snapshot.todos !== null && !record(snapshot.todos))) {
    return resultUnavailable('unrecognized-legacy-schema');
  }
  const tasks = Object.entries(snapshot.tasks ?? {});
  const todos = Object.entries(snapshot.todos ?? {});
  if (tasks.length > 5000 || todos.length > 5000) {
    return resultUnavailable('inventory-size-limit');
  }
  const taskStats = { total: tasks.length, extraFields: 0, missingTitle: 0, incompatibleKey: 0 };
  const todoStats = {
    total: todos.length, displayNameOwners: 0, missingUidOwner: 0,
    incompatibleKey: 0, invalidRevision: 0, tooLong: 0
  };
  for (const [key, item] of tasks) {
    if (!record(item)) return resultUnavailable('unrecognized-task');
    if (!newKey(key)) taskStats.incompatibleKey++;
    if (typeof item.title !== 'string' || !item.title.trim()) taskStats.missingTitle++;
    if (Object.keys(item).some(field => !futureTaskFields.has(field))) taskStats.extraFields++;
  }
  for (const [key, item] of todos) {
    if (!record(item)) return resultUnavailable('unrecognized-todo');
    if (!newKey(key)) todoStats.incompatibleKey++;
    if (typeof item.owner === 'string' && item.owner.length) todoStats.displayNameOwners++;
    if (typeof item.ownerUid !== 'string' || !item.ownerUid.length) todoStats.missingUidOwner++;
    if (!Number.isSafeInteger(item.revision) || item.revision < 1) todoStats.invalidRevision++;
    if (typeof item.text !== 'string' || item.text.length > TODO_MAX_LENGTH
      || typeof item.memo === 'string' && item.memo.length > TODO_MEMO_MAX_LENGTH) todoStats.tooLong++;
  }
  const collections = Object.fromEntries(otherCollections.map(key => [
    key, snapshot[key] !== undefined && snapshot[key] !== null
  ]));
  // Always NO_GO even when the counts look clean. Verified UID mapping,
  // complete task schema + relations, rollback and actual applied Rules are
  // separate mandatory gates (not inferred from anonymous JSON).
  return {
    result: 'NO_GO', scope: 'legacy-read-only', countsVerified: true,
    tasks: taskStats, todos: todoStats, otherCollectionsPresent: collections,
    requiresUidMapping: true, requiresLosslessTaskSchema: true,
    requiresRulesAndOldClientCutover: true,
    requiresBackupRestoreAndReconciliation: true
  };
}
