import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureRecurringDelete,
  recurringDeleteTargets,
  planRecurringDelete,
  isRecurringDeleteCandidate
} from '../recurrence-series-v354.js';

function event(id, series, date, title = '繰り返し会議') {
  return {
    id, title, recurrenceSeriesId: series, recurrenceDate: date,
    startAt: date + 'T10:00:00.000Z',
    endAt: date + 'T11:00:00.000Z',
    relatedTaskId: '', revision: 1
  };
}
function task(id, seriesId, occurrenceDate, parentId = '') {
  return {
    id, title: '月次点検', status: parentId ? '未着手' : '完了',
    recurrence: 'monthlyDay', recurrenceRule: {
      seriesId, anchorDate: '2026-11-01', occurrenceDate,
      endMode: 'count', count: 4, generatedCount: parentId ? 1 : 0
    },
    recurringParentId: parentId,
    nextRecurringTaskId: '', revision: 1, history: []
  };
}
function schedules() {
  return {
    schedules: {
      a: event('a', 'group-A', '2026-11-04'),
      b: event('b', 'group-A', '2026-12-04'),
      c: event('c', 'group-A', '2027-01-04'),
      other: event('other', 'group-B', '2026-12-04'),
      old: { id:'old', title: '繰り返し会議', startAt: '2026-12-04T10:00:00Z', revision:1 }
    }
  };
}

test('schedule: this only, following and entire series never touch other copies or same-title events', () => {
  const root = schedules();
  const selection = captureRecurringDelete('schedule', root, 'b');
  assert.deepEqual(selection.memberIds, ['a', 'b', 'c']);
  assert.deepEqual(recurringDeleteTargets(selection, 'one'), ['b']);
  assert.deepEqual(recurringDeleteTargets(selection, 'following'), ['b', 'c']);
  assert.deepEqual(recurringDeleteTargets(selection, 'all'), ['a', 'b', 'c']);
  for (const [scope, kept] of [
    ['one', ['a', 'c', 'other', 'old']],
    ['following', ['a', 'other', 'old']],
    ['all', ['other', 'old']]
  ]) {
    const plan = planRecurringDelete(selection, scope, root);
    assert.equal(plan.action, 'commit', scope);
    assert.deepEqual(Object.keys(plan.nextRoot.schedules).sort(), kept.sort(), scope);
  }
  assert.equal(isRecurringDeleteCandidate('schedule', root.schedules.old), false);
  assert.equal(captureRecurringDelete('schedule', root, 'old'), null);
});

test('schedule: original occurrence identity is stable even when a single time changes', () => {
  const root = schedules();
  root.schedules.b.startAt = '2028-04-20T08:00:00Z';
  const selection = captureRecurringDelete('schedule', root, 'b');
  assert.deepEqual(recurringDeleteTargets(selection, 'following'), ['b', 'c']);
  const plan = planRecurringDelete(selection, 'following', root);
  assert.equal(plan.action, 'commit');
});

test('schedule: abort if membership, revision or content changed while modal was open', () => {
  const root = schedules();
  const selection = captureRecurringDelete('schedule', root, 'b');
  assert.equal(planRecurringDelete(selection, 'all',
    { schedules: { ...root.schedules, d: event('d', 'group-A', '2027-02-04') } }).reason,
  'series-membership-changed');
  assert.equal(planRecurringDelete(selection, 'all',
    { schedules: { ...root.schedules, c: { ...root.schedules.c, revision: 2 } } }).reason,
  'series-content-changed');
  assert.equal(planRecurringDelete(selection, 'one',
    { schedules: { ...root.schedules, c: { ...root.schedules.c, title: '変更済み' } } }).reason,
  'series-content-changed');
});

test('task: one child preserves the other occurrences, and following keeps earlier history', () => {
  const root = {
    tasks: {
      master: task('master', 'master', ''),
      next: task('next', 'master', '2026-12-01', 'master'),
      future: task('future', 'master', '2027-01-01', 'next'),
      independent: { ...task('independent', 'independent', ''), title: '月次点検' }
    }, schedules: {}, knowledge: {}
  };
  root.tasks.master.nextRecurringTaskId = 'next';
  root.tasks.next.nextRecurringTaskId = 'future';
  const selection = captureRecurringDelete('task', root, 'next');
  assert.deepEqual(selection.memberIds, ['master', 'next', 'future']);
  const one = planRecurringDelete(selection, 'one', root);
  assert.equal(one.action, 'commit');
  assert.deepEqual(Object.keys(one.nextRoot.tasks).sort(), ['master', 'future', 'independent'].sort());
  const following = planRecurringDelete(selection, 'following', root);
  assert.equal(following.action, 'commit');
  assert.deepEqual(Object.keys(following.nextRoot.tasks).sort(), ['master', 'independent'].sort());
  const all = planRecurringDelete(selection, 'all', root);
  assert.deepEqual(Object.keys(all.nextRoot.tasks), ['independent']);
});

test('task: one active occurrence can create the next child instead of breaking recurrence', () => {
  const root = {
    tasks: { selected: { ...task('selected', 'selected', ''), status:'未着手' } },
    schedules: {}, knowledge: {}
  };
  const selection = captureRecurringDelete('task', root, 'selected');
  const child = {
    id:'rec-selected-2026-12-01', task: task('rec-selected-2026-12-01',
      'selected', '2026-12-01', 'selected')
  };
  const plan = planRecurringDelete(selection, 'one', root, () => child);
  assert.equal(plan.action, 'commit');
  assert.equal(plan.createdTaskId, child.id);
  assert.equal(plan.nextRoot.tasks.selected, undefined);
  assert.equal(plan.nextRoot.tasks[child.id].revision, 1);
  assert.equal(plan.nextRoot.tasks[child.id].operationId, child.id);
  assert.deepEqual(plan.affectedPaths.sort(), ['tasks/selected', 'tasks/' + child.id].sort());
  const collision = planRecurringDelete(selection, 'one',
    { ...root, tasks: { ...root.tasks, [child.id]: task(child.id, 'unrelated', '2026-12-01') } },
    () => child);
  assert.notEqual(collision.action, 'commit');
});

test('task: canonical dependency cleanup unlinks related schedules and removes knowledge', () => {
  const root = {
    tasks: { master: { ...task('master', 'master', ''), knowledgeId:'k1' } },
    schedules: { appointment: { ...event('appointment', '', '2026-11-04'), relatedTaskId:'master' } },
    knowledge: { k1: { id:'k1',taskId:'master',content:'対応履歴',revision:1 } }
  };
  const selection = captureRecurringDelete('task', root, 'master');
  const plan = planRecurringDelete(selection, 'all', root);
  assert.equal(plan.action, 'commit');
  assert.equal(plan.nextRoot.tasks.master, undefined);
  assert.equal(plan.nextRoot.schedules.appointment.relatedTaskId, '');
  assert.equal(plan.nextRoot.schedules.appointment.revision, 2);
  assert.equal(plan.nextRoot.knowledge.k1, undefined);
  assert.deepEqual(plan.affectedPaths.sort(),
    ['tasks/master','schedules/appointment','knowledge/k1'].sort());
  const changedRelated = {
    ...root, schedules: { appointment: { ...root.schedules.appointment, revision:2 } }
  };
  assert.equal(planRecurringDelete(selection, 'all', changedRelated).action, 'abort');
});

test('task: no recurrence scope if the item has never belonged to a series', () => {
  const ordinary = { id:'plain', title:'一般タスク',recurrence:'none',revision:1 };
  assert.equal(isRecurringDeleteCandidate('task', ordinary), false);
  assert.equal(captureRecurringDelete('task', { tasks:{plain:ordinary} }, 'plain'), null);
  assert.equal(planRecurringDelete(null, 'all', {}, null).action, 'abort');
});
