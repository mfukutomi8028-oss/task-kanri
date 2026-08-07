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
