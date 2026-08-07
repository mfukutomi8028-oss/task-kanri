// Ver.134 deletion protocol.  This file has no Firebase or DOM dependency so the
// non-production harness can exercise exactly the conflict decisions used by app.js.

export function normalizeRevision(value) {
  const revision = typeof value === 'number'
    ? value
    : (typeof value === 'string' && /^(?:0|[1-9]\d*)$/.test(value) ? Number(value) : NaN);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
}

export function isValidRevision(value) {
  return (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
    || (typeof value === 'string' && /^(?:0|[1-9]\d*)$/.test(value) && Number.isSafeInteger(Number(value)));
}

// Ver.133 data did not always persist revision.  Missing is the legacy zero;
// malformed values are still rejected rather than being silently repaired.
export function isCanonicalRevision(value) {
  return typeof value === 'undefined' || isValidRevision(value);
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function semanticProjection(record) {
  const internal = new Set(['revision', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'operationId', 'history', 'lastChange', 'id']);
  const source = record && typeof record === 'object' ? record : {};
  const projection = {};
  for (const key of Object.keys(source).sort()) {
    if (!internal.has(key)) projection[key] = source[key];
  }
  return stableJson(projection);
}

function taskDescriptor(id, value) {
  return { id, revision: normalizeRevision(value?.revision), projection: semanticProjection(value) };
}

function relatedDescriptor(id, value, relationName) {
  return {
    id,
    revision: normalizeRevision(value?.revision),
    relation: String(value?.[relationName] || ''),
    projection: semanticProjection(value)
  };
}

function sameDescriptors(left, right, includeRevision) {
  const fields = includeRevision ? ['id', 'revision', 'relation', 'projection'] : ['id', 'relation', 'projection'];
  return left.length === right.length && left.every(item => right.some(other => fields.every(field => item[field] === other[field])));
}

export function captureDeleteBaseFromRoot(id, root) {
  const task = root?.tasks?.[id];
  if (!task) return { id, task: null, schedules: [], knowledge: [] };
  return {
    id,
    task: taskDescriptor(id, task),
    schedules: Object.entries(root?.schedules || {})
      .filter(([, value]) => value?.relatedTaskId === id)
      .map(([scheduleId, value]) => relatedDescriptor(scheduleId, value, 'relatedTaskId')),
    knowledge: Object.entries(root?.knowledge || {})
      .filter(([, value]) => value?.taskId === id)
      .map(([knowledgeId, value]) => relatedDescriptor(knowledgeId, value, 'taskId'))
  };
}

function hasKnowledgeOwnershipMismatch(taskId, task, knowledge) {
  const knowledgeId = String(task?.knowledgeId || '');
  if (!knowledgeId) return false;
  const linked = knowledge?.[knowledgeId];
  return Boolean(linked && String(linked.taskId || '') !== taskId);
}

// ready-to-delete: the complete observed record set is unchanged.
// stale-local-state: only revision metadata changed, so a single refreshed retry is safe.
// remote-content-changed: a user-visible field, relation, unknown field, or record set changed.
export function classifyDeleteConflict(base, root) {
  const current = captureDeleteBaseFromRoot(base.id, root);
  if (!current.task) return { kind: 'already-deleted', changes: ['task'] };
  if (!base.task || !isCanonicalRevision(root?.tasks?.[base.id]?.revision)) {
    return { kind: 'transaction-aborted-or-invariant-failure', changes: ['invalid task revision'] };
  }
  if (hasKnowledgeOwnershipMismatch(base.id, root?.tasks?.[base.id], root?.knowledge)) {
    return { kind: 'transaction-aborted-or-invariant-failure', changes: ['knowledge ownership mismatch'] };
  }
  const invalidRelatedRevision = [
    ...Object.entries(root?.schedules || {}).filter(([, value]) => value?.relatedTaskId === base.id),
    ...Object.entries(root?.knowledge || {}).filter(([, value]) => value?.taskId === base.id)
  ].some(([, value]) => !isCanonicalRevision(value?.revision));
  if (invalidRelatedRevision) return { kind: 'transaction-aborted-or-invariant-failure', changes: ['invalid related revision'] };

  const sameTaskSemantic = current.task.projection === base.task?.projection;
  const sameScheduleSemantic = sameDescriptors(base.schedules || [], current.schedules, false);
  const sameKnowledgeSemantic = sameDescriptors(base.knowledge || [], current.knowledge, false);
  if (!sameTaskSemantic || !sameScheduleSemantic || !sameKnowledgeSemantic) {
    const changes = [];
    if (!sameTaskSemantic) changes.push('task');
    if (!sameScheduleSemantic) changes.push('related schedules');
    if (!sameKnowledgeSemantic) changes.push('linked knowledge');
    return { kind: 'remote-content-changed', changes };
  }

  const sameTaskRevision = current.task.revision === base.task?.revision;
  const sameScheduleRevision = sameDescriptors(base.schedules || [], current.schedules, true);
  const sameKnowledgeRevision = sameDescriptors(base.knowledge || [], current.knowledge, true);
  return sameTaskRevision && sameScheduleRevision && sameKnowledgeRevision
    ? { kind: 'ready-to-delete', changes: [], current }
    : { kind: 'stale-local-state', changes: [], current };
}

export function planDeleteMutation(base, root) {
  const source = root && typeof root === 'object' ? root : {};
  const classification = classifyDeleteConflict(base, source);
  if (classification.kind !== 'ready-to-delete') return { action: 'abort', ...classification, latestRoot: source };

  const task = source.tasks?.[base.id];
  const nextRoot = {
    ...source,
    tasks: { ...(source.tasks || {}) },
    schedules: { ...(source.schedules || {}) },
    knowledge: { ...(source.knowledge || {}) }
  };
  delete nextRoot.tasks[base.id];

  const affectedPaths = [`tasks/${base.id}`];
  for (const [scheduleId, schedule] of Object.entries(source.schedules || {})) {
    if (schedule?.relatedTaskId !== base.id) continue;
    nextRoot.schedules[scheduleId] = {
      ...schedule,
      relatedTaskId: '',
      revision: normalizeRevision(schedule.revision) + 1
    };
    affectedPaths.push(`schedules/${scheduleId}`);
  }
  for (const [knowledgeId, knowledge] of Object.entries(source.knowledge || {})) {
    if (knowledge?.taskId !== base.id) continue;
    delete nextRoot.knowledge[knowledgeId];
    affectedPaths.push(`knowledge/${knowledgeId}`);
  }
  return { action: 'commit', kind: 'committed', nextRoot, affectedPaths, latestRoot: source };
}

const DELETE_COLLECTIONS = ['tasks', 'schedules', 'knowledge'];

function cloneCollections(collections = {}) {
  return Object.fromEntries(DELETE_COLLECTIONS.map(collection => [collection, { ...(collections[collection] || {}) }]));
}

function pathParts(path) {
  const parts = String(path || '').split('/');
  const collectionIndex = parts.findIndex(part => DELETE_COLLECTIONS.includes(part));
  return collectionIndex < 0 ? null : { collection: parts[collectionIndex], id: parts[collectionIndex + 1] || '' };
}

function barrierKey(collection, id) {
  return `${collection}/${id}`;
}

function isAcknowledged(entry, value) {
  if (entry.expected == null) return typeof value === 'undefined';
  // A related schedule is acknowledged by the committed link-clear, or by a
  // causally later revision.  The latter may legitimately relink or delete
  // the schedule before this client observes the committed value.
  if (entry.collection === 'schedules') {
    if (typeof value === 'undefined') return true;
    if (!value) return false;
    const expectedRevision = normalizeRevision(entry.expected.revision);
    const receivedRevision = normalizeRevision(value.revision);
    return (String(value.relatedTaskId || '') === '' && receivedRevision >= expectedRevision)
      || receivedRevision > expectedRevision;
  }
  return Boolean(value) && stableJson(value) === stableJson(entry.expected);
}

function withCollections(state, collections, barrier) {
  return {
    ...state,
    collections,
    deleteBaseRoot: cloneCollections(collections),
    barrier
  };
}

// This reducer is intentionally Firebase/DOM-free.  A commit may update only
// affected paths.  Until each such path is observed by its own collection
// listener, an old, partial, or empty listener value cannot remove unrelated
// display/cache/raw-base records or resurrect the committed deletion.
export function reduceDeleteSync(state, action) {
  const current = state && typeof state === 'object' ? state : {};
  const type = action?.type;
  if (type === 'abort-delete') return current;
  if (type === 'reset-room') {
    return action.roomId === current.roomId ? current : { ...current, roomId: action.roomId, barrier: null };
  }

  if (type === 'apply-delete-commit' || type === 'apply-already-deleted' || type === 'apply-delete-target') {
    const collections = cloneCollections(current.collections || current.deleteBaseRoot);
    const root = action.snapshot && typeof action.snapshot === 'object' ? action.snapshot : {};
    const affected = { ...(current.barrier?.affected || {}) };
    for (const path of action.affectedPaths || []) {
      const parsed = pathParts(path);
      if (!parsed?.id) continue;
      const source = root?.[parsed.collection]?.[parsed.id];
      if (source == null) delete collections[parsed.collection][parsed.id];
      else collections[parsed.collection][parsed.id] = source;
      if (type !== 'apply-delete-target') {
        affected[barrierKey(parsed.collection, parsed.id)] = {
          collection: parsed.collection,
          id: parsed.id,
          expected: source == null ? null : source,
          acknowledged: false
        };
      }
    }
    const barrier = type !== 'apply-delete-target'
      ? { roomId: action.roomId || current.roomId, phase: 'committed-awaiting-ack', affected }
      : current.barrier || null;
    return withCollections(current, collections, barrier);
  }

  if (type !== 'receive-subscription' || action.roomId !== current.roomId || !DELETE_COLLECTIONS.includes(action.collection)) return current;
  const collection = action.collection;
  const incoming = action.value && typeof action.value === 'object' ? action.value : {};
  const collections = cloneCollections(current.collections || current.deleteBaseRoot);
  const next = { ...collections[collection] };
  const barrier = current.barrier?.roomId === current.roomId && current.barrier.phase === 'committed-awaiting-ack'
    ? { ...current.barrier, affected: { ...current.barrier.affected } }
    : null;
  const hasBarrier = Boolean(barrier);

  for (const [id, value] of Object.entries(incoming)) {
    const entry = barrier?.affected[barrierKey(collection, id)];
    if (entry && !isAcknowledged(entry, value)) continue;
    next[id] = value;
    if (entry) barrier.affected[barrierKey(collection, id)] = { ...entry, acknowledged: true };
  }
  for (const id of Object.keys(next)) {
    if (Object.prototype.hasOwnProperty.call(incoming, id)) continue;
    const key = barrierKey(collection, id);
    const entry = barrier?.affected[key];
    if (entry && action.complete !== false && isAcknowledged(entry, undefined)) {
      delete next[id];
      barrier.affected[key] = { ...entry, acknowledged: true };
    } else if (!hasBarrier && action.complete !== false) {
      delete next[id];
    }
  }
  if (barrier && action.complete !== false) {
    for (const [key, entry] of Object.entries(barrier.affected)) {
      if (entry.collection !== collection || Object.prototype.hasOwnProperty.call(incoming, entry.id)) continue;
      if (isAcknowledged(entry, undefined)) {
        delete next[entry.id];
        barrier.affected[key] = { ...entry, acknowledged: true };
      }
    }
  }

  collections[collection] = next;
  let nextBarrier = barrier;
  if (barrier && Object.values(barrier.affected).every(entry => entry.acknowledged)) {
    nextBarrier = { ...barrier, phase: 'acknowledged', affected: {} };
  }
  return withCollections(current, collections, nextBarrier);
}
