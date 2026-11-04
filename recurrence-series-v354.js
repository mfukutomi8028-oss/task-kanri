// Recurring-deletion scope and atomic mutation planner.
// No DOM/Firebase access. Uses the existing V134 task-delete protocol to
// preserve linked schedules, knowledge ownership, and revision conflict rules.
import {
  captureDeleteBaseFromRoot,
  planDeleteMutation,
  normalizeRevision,
  semanticProjection
} from './task-delete-v134.js';

const SCOPES = new Set(['one', 'following', 'all']);
const validId = value => typeof value === 'string' && value.length > 0;
const isoAt = value => {
  const date = new Date(Number(value || 0));
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
};

function taskSeriesId(task) {
  if (!task) return '';
  const direct = String(task.recurrenceRule?.seriesId || '');
  if (direct) return direct;
  if (task.recurrence && task.recurrence !== 'none') return String(task.id || '');
  return '';
}

function taskMembers(root, selectedId) {
  const tasks = root?.tasks || {};
  const selected = tasks[selectedId];
  if (!selected) return [];
  // A completed series can have descendants even if recurrence was later
  // disabled on one occurrence. Follow real parent/child links as well as
  // series IDs; never infer a series from matching titles.
  const members = new Set([selectedId]);
  const directId = taskSeriesId(selected);
  const parentOf = task => String(task?.recurringParentId || '');
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, task] of Object.entries(tasks)) {
      if (members.has(id)) continue;
      const idSeries = taskSeriesId(task);
      if ((directId && idSeries === directId)
        || (validId(parentOf(task)) && members.has(parentOf(task)))
        || [...members].some(otherId => tasks[otherId]?.nextRecurringTaskId === id
          || (tasks[otherId]?.recurringParentId === id && task?.nextRecurringTaskId === otherId))) {
        members.add(id);
        changed = true;
      }
    }
  }
  // Follow series ID links through a discovered ancestor if the selected
  // occurrence no longer has its own recurrence metadata.
  const foundSeries = new Set([...members].map(id => taskSeriesId(tasks[id])).filter(Boolean));
  if (foundSeries.size) {
    for (const [id, task] of Object.entries(tasks)) {
      if (foundSeries.has(taskSeriesId(task))) members.add(id);
    }
  }
  return [...members].map(id => ({ id, record: tasks[id] }));
}

function sortTaskMembers(members, selectedId) {
  const selected = members.find(item => item.id === selectedId);
  const selectedSeries = taskSeriesId(selected?.record);
  const orderKey = item => {
    const rule = item.record.recurrenceRule || {};
    // The series root precedes every generated task regardless of the anchor.
    if (!item.record.recurringParentId && item.id === selectedSeries) return '0000-00-00';
    return String(rule.occurrenceDate || rule.anchorDate || isoAt(item.record.createdAt) || '9999-12-31');
  };
  return [...members].sort((a, b) => orderKey(a).localeCompare(orderKey(b))
    || Number(a.record.createdAt || 0) - Number(b.record.createdAt || 0)
    || a.id.localeCompare(b.id));
}

function scheduleMembers(root, selectedId) {
  const schedules = root?.schedules || {};
  const selected = schedules[selectedId];
  const seriesId = String(selected?.recurrenceSeriesId || '');
  if (!selected || !seriesId) return [];
  return Object.entries(schedules)
    .filter(([, item]) => String(item?.recurrenceSeriesId || '') === seriesId)
    .map(([id, record]) => ({ id, record }))
    .sort((a, b) => String(a.record.recurrenceDate || a.record.startAt || '').localeCompare(
      String(b.record.recurrenceDate || b.record.startAt || '')) || a.id.localeCompare(b.id));
}

export function isRecurringDeleteCandidate(kind, record) {
  if (!record) return false;
  if (kind === 'schedule') return Boolean(record.recurrenceSeriesId);
  return Boolean((record.recurrence && record.recurrence !== 'none') ||
    record.recurringParentId || record.nextRecurringTaskId || record.recurrenceRule?.seriesId);
}

function collectionFor(kind) { return kind === 'schedule' ? 'schedules' : 'tasks'; }
function collect(kind, root, selectedId) {
  return kind === 'schedule' ? scheduleMembers(root, selectedId)
    : sortTaskMembers(taskMembers(root, selectedId), selectedId);
}

export function captureRecurringDelete(kind, root, selectedId) {
  if (!['task', 'schedule'].includes(kind) || !validId(selectedId)) return null;
  const collection = collectionFor(kind);
  const selected = root?.[collection]?.[selectedId];
  if (!isRecurringDeleteCandidate(kind, selected)) return null;
  const items = collect(kind, root, selectedId);
  if (!items.some(item => item.id === selectedId)) return null;
  return {
    kind, selectedId, collection,
    memberIds: items.map(item => item.id),
    fingerprints: Object.fromEntries(items.map(item => [item.id, {
      revision: normalizeRevision(item.record.revision),
      semantic: semanticProjection(item.record)
    }])),
    // Capture the same dependency graph checked by the canonical single
    // task deletion; no linked schedule/knowledge is silently left behind.
    deleteBases: kind === 'task'
      ? Object.fromEntries(items.map(item => [item.id, captureDeleteBaseFromRoot(item.id, root)]))
      : {},
    title: String(selected.title || ''),
    date: kind === 'schedule'
      ? String(selected.recurrenceDate || selected.startAt || '').slice(0, 10)
      : String(selected.recurrenceRule?.occurrenceDate || selected.recurrenceRule?.anchorDate || '').slice(0, 10)
  };
}

export function recurringDeleteTargets(selection, scope) {
  if (!selection || !SCOPES.has(scope)) return [];
  const ordered = selection.memberIds;
  const index = ordered.indexOf(selection.selectedId);
  if (index < 0) return [];
  if (scope === 'one') return [selection.selectedId];
  return scope === 'following' ? ordered.slice(index) : [...ordered];
}

export function planRecurringDelete(selection, scope, root, makeNextTask = null) {
  if (!selection || !SCOPES.has(scope) || !['schedule','task'].includes(selection.kind)) {
    return { action: 'abort', reason: 'invalid-scope' };
  }
  const collection = selection.collection;
  const currentItems = collect(selection.kind, root, selection.selectedId);
  if (currentItems.map(item => item.id).join('\n') !== selection.memberIds.join('\n')) {
    return { action: 'abort', reason: 'series-membership-changed' };
  }
  for (const item of currentItems) {
    const expected = selection.fingerprints[item.id];
    if (!expected || normalizeRevision(item.record.revision) !== expected.revision
      || semanticProjection(item.record) !== expected.semantic) {
      return { action: 'abort', reason: 'series-content-changed' };
    }
  }
  const targetIds = recurringDeleteTargets(selection, scope);
  if (!targetIds.length) return { action: 'abort', reason: 'not-found' };
  let nextRoot = { ...root, [collection]: { ...(root[collection] || {}) } };
  const changed = new Set(targetIds.map(id => `${collection}/${id}`));
  let createdTaskId = '';

  if (selection.kind === 'schedule') {
    for (const id of targetIds) delete nextRoot.schedules[id];
  } else {
    // Canonical V134 protocol handles dependent schedules/knowledge, with
    // the revision-and-semantic base captured before the user's confirmation.
    for (const id of targetIds) {
      const canonical = planDeleteMutation(selection.deleteBases[id], nextRoot);
      if (canonical.action !== 'commit') return {
        action: 'abort', reason: canonical.kind || 'related-content-changed'
      };
      nextRoot = canonical.nextRoot;
      canonical.affectedPaths.forEach(path => changed.add(path));
    }
    if (scope === 'one' && typeof makeNextTask === 'function') {
      const selected = root.tasks?.[selection.selectedId];
      // "Only this" skips one pending occurrence, but continues the series.
      // An already generated child must not be recreated.
      if (selected && !selected.nextRecurringTaskId) {
        const next = makeNextTask(selected);
        if (next) {
          if (!validId(next.id) || nextRoot.tasks?.[next.id]) {
            return { action: 'abort', reason: 'next-task-conflict' };
          }
          nextRoot.tasks[next.id] = { ...next.task, revision: 1, operationId: next.id };
          changed.add(`tasks/${next.id}`);
          createdTaskId = next.id;
        }
      }
    }
  }

  return {
    action: 'commit', nextRoot, deletedIds: targetIds,
    createdTaskId, affectedPaths: [...changed], scope
  };
}
