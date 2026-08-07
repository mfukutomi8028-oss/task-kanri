import assert from 'node:assert/strict';
import test from 'node:test';
import { captureDeleteBaseFromRoot, classifyDeleteConflict, isCanonicalRevision, planDeleteMutation, reduceDeleteSync } from '../task-delete-v134.js';

const root = () => ({
  tasks: { t1: { title: 'Original', revision: 3, comments: [{ text: 'keep' }], checklist: [] } },
  schedules: { s1: { relatedTaskId: 't1', revision: 2, title: 'linked' } },
  knowledge: { k1: { taskId: 't1', revision: 4, title: 'knowledge' } }
});

const syncState = (value = root()) => ({
  roomId: 'test-delete-protocol',
  collections: structuredClone(value),
  deleteBaseRoot: structuredClone(value),
  barrier: null
});

const receive = (state, collection, value, complete = true) => reduceDeleteSync(state, {
  type: 'receive-subscription', roomId: 'test-delete-protocol', collection, value, complete
});

test('normal delete is a single root commit and preserves unrelated records', () => {
  const current = root();
  current.tasks.keep = { title: 'unrelated', revision: 7 };
  const plan = planDeleteMutation(captureDeleteBaseFromRoot('t1', current), current);
  assert.equal(plan.action, 'commit');
  assert.equal(plan.nextRoot.tasks.t1, undefined);
  assert.equal(plan.nextRoot.schedules.s1.relatedTaskId, '');
  assert.equal(plan.nextRoot.schedules.s1.revision, 3);
  assert.equal(plan.nextRoot.knowledge.k1, undefined);
  assert.deepEqual(plan.nextRoot.tasks.keep, current.tasks.keep);
});

test('revision-only difference is stale-local-state and the refreshed base commits once', () => {
  const original = root();
  const base = captureDeleteBaseFromRoot('t1', original);
  const latest = root();
  latest.tasks.t1.revision = 4;
  assert.equal(classifyDeleteConflict(base, latest).kind, 'stale-local-state');
  const refreshed = captureDeleteBaseFromRoot('t1', latest);
  assert.equal(planDeleteMutation(refreshed, latest).action, 'commit');
});

test('comments, checklist, recurrence, unknown fields, and relations are real conflicts', () => {
  for (const mutate of [
    value => { value.tasks.t1.comments.push({ text: 'new' }); },
    value => { value.tasks.t1.checklist.push({ text: 'new' }); },
    value => { value.tasks.t1.recurrence = 'weekly'; },
    value => { value.tasks.t1.futureField = 'must not be discarded'; },
    value => { value.schedules.s2 = { relatedTaskId: 't1', revision: 1 }; }
  ]) {
    const initial = root();
    const base = captureDeleteBaseFromRoot('t1', initial);
    const latest = root();
    mutate(latest);
    assert.equal(planDeleteMutation(base, latest).kind, 'remote-content-changed');
  }
});

test('missing task is intentionally classified as already-deleted', () => {
  const initial = root();
  const base = captureDeleteBaseFromRoot('t1', initial);
  delete initial.tasks.t1;
  assert.equal(classifyDeleteConflict(base, initial).kind, 'already-deleted');
});

test('invalid revision is an invariant failure, never a delete or stale retry', () => {
  const initial = root();
  const base = captureDeleteBaseFromRoot('t1', initial);
  initial.tasks.t1.revision = '01';
  assert.equal(planDeleteMutation(base, initial).kind, 'transaction-aborted-or-invariant-failure');
});

test('missing legacy revisions normalize to zero, while malformed values remain invalid', () => {
  const initial = root();
  delete initial.tasks.t1.revision;
  delete initial.schedules.s1.revision;
  delete initial.knowledge.k1.revision;
  const base = captureDeleteBaseFromRoot('t1', initial);
  const plan = planDeleteMutation(base, initial);
  assert.equal(isCanonicalRevision(undefined), true);
  assert.equal(isCanonicalRevision('4'), true);
  assert.equal(isCanonicalRevision('01'), false);
  assert.equal(plan.action, 'commit');
  assert.equal(plan.nextRoot.schedules.s1.revision, 1);
});

test('knowledge must be owned by the deleted task even when knowledgeId matches', () => {
  const current = root();
  current.tasks.t1.knowledgeId = 'k2';
  current.knowledge.k2 = { taskId: 'other-task', revision: 2, title: 'must keep' };
  const base = captureDeleteBaseFromRoot('t1', current);
  const plan = planDeleteMutation(base, current);
  assert.equal(plan.kind, 'transaction-aborted-or-invariant-failure');
  assert.equal(plan.changes[0], 'knowledge ownership mismatch');
  assert.deepEqual(current.knowledge.k2, { taskId: 'other-task', revision: 2, title: 'must keep' });
});

test('a raw legacy base does not conflict with its raw transaction root when display defaults are omitted', () => {
  const remoteRoot = root();
  delete remoteRoot.tasks.t1.description;
  delete remoteRoot.tasks.t1.knowledgeId;
  const displayStateRoot = structuredClone(remoteRoot);
  displayStateRoot.tasks.t1.description = '';
  displayStateRoot.tasks.t1.knowledgeId = '';

  // The old normalized-state base would have produced a false conflict.
  assert.equal(classifyDeleteConflict(captureDeleteBaseFromRoot('t1', displayStateRoot), remoteRoot).kind, 'remote-content-changed');
  // The production path now keeps the raw subscribed snapshot for both sides.
  assert.equal(planDeleteMutation(captureDeleteBaseFromRoot('t1', remoteRoot), remoteRoot).action, 'commit');
});

test('delete commit applies only affected paths and preserves unrelated state/cache bases', () => {
  const before = root();
  before.tasks.keep = { title: 'unrelated task', revision: 7 };
  before.schedules.keep = { relatedTaskId: '', revision: 8, title: 'unrelated schedule' };
  before.knowledge.keep = { taskId: 'other', revision: 9, title: 'unrelated knowledge' };
  const plan = planDeleteMutation(captureDeleteBaseFromRoot('t1', before), before);
  const next = reduceDeleteSync(syncState(before), {
    type: 'apply-delete-commit', roomId: 'test-delete-protocol', snapshot: plan.nextRoot, affectedPaths: plan.affectedPaths
  });
  assert.equal(next.collections.tasks.t1, undefined);
  assert.equal(next.collections.knowledge.k1, undefined);
  assert.equal(next.collections.schedules.s1.relatedTaskId, '');
  assert.deepEqual(next.collections.tasks.keep, before.tasks.keep);
  assert.deepEqual(next.deleteBaseRoot.knowledge.keep, before.knowledge.keep);
  assert.equal(next.barrier.phase, 'committed-awaiting-ack');
});

test('abort is an identity transition: displayed state, raw base, cache input, and barrier stay unchanged', () => {
  const before = syncState();
  assert.strictEqual(reduceDeleteSync(before, { type: 'abort-delete' }), before);
});

test('conflict review applies only the reviewed task and never replaces other collections', () => {
  const before = root();
  before.tasks.keep = { title: 'keep', revision: 7 };
  before.schedules.keep = { relatedTaskId: '', revision: 8 };
  before.knowledge.keep = { taskId: 'other', revision: 9 };
  const latest = { tasks: { t1: { ...before.tasks.t1, title: 'remote title', revision: 4 } } };
  const next = reduceDeleteSync(syncState(before), {
    type: 'apply-delete-target', roomId: 'test-delete-protocol', snapshot: latest, affectedPaths: ['tasks/t1']
  });
  assert.equal(next.collections.tasks.t1.title, 'remote title');
  assert.deepEqual(next.collections.tasks.keep, before.tasks.keep);
  assert.deepEqual(next.collections.schedules, before.schedules);
  assert.deepEqual(next.collections.knowledge, before.knowledge);
});

test('old or partial subscription snapshots cannot resurrect affected IDs or erase unrelated IDs while awaiting ack', () => {
  const before = root();
  before.tasks.keep = { title: 'keep', revision: 7 };
  before.schedules.keep = { relatedTaskId: '', revision: 8 };
  before.knowledge.keep = { taskId: 'other', revision: 9 };
  const plan = planDeleteMutation(captureDeleteBaseFromRoot('t1', before), before);
  let next = reduceDeleteSync(syncState(before), {
    type: 'apply-delete-commit', roomId: 'test-delete-protocol', snapshot: plan.nextRoot, affectedPaths: plan.affectedPaths
  });
  next = receive(next, 'tasks', { t1: before.tasks.t1 }, false);
  next = receive(next, 'schedules', { s1: before.schedules.s1 }, false);
  next = receive(next, 'knowledge', { k1: before.knowledge.k1 }, false);
  assert.equal(next.collections.tasks.t1, undefined);
  assert.equal(next.collections.schedules.s1.relatedTaskId, '');
  assert.equal(next.collections.knowledge.k1, undefined);
  assert.deepEqual(next.collections.tasks.keep, before.tasks.keep);
  assert.deepEqual(next.collections.schedules.keep, before.schedules.keep);
  assert.deepEqual(next.collections.knowledge.keep, before.knowledge.keep);
  assert.equal(next.barrier.phase, 'committed-awaiting-ack');
});

test('acknowledged per-collection snapshots release the barrier, then later authoritative changes apply normally', () => {
  const before = root();
  before.tasks.keep = { title: 'keep', revision: 7 };
  const plan = planDeleteMutation(captureDeleteBaseFromRoot('t1', before), before);
  let next = reduceDeleteSync(syncState(before), {
    type: 'apply-delete-commit', roomId: 'test-delete-protocol', snapshot: plan.nextRoot, affectedPaths: plan.affectedPaths
  });
  next = receive(next, 'tasks', plan.nextRoot.tasks);
  next = receive(next, 'schedules', plan.nextRoot.schedules);
  next = receive(next, 'knowledge', plan.nextRoot.knowledge);
  assert.equal(next.barrier.phase, 'acknowledged');
  const latestTasks = { keep: { title: 'remote update', revision: 8 } };
  next = receive(next, 'tasks', latestTasks);
  assert.deepEqual(next.collections.tasks, latestTasks);
});

test('a later schedule relink or deletion acknowledges the barrier without freezing normal synchronization', () => {
  const before = root();
  const plan = planDeleteMutation(captureDeleteBaseFromRoot('t1', before), before);
  let relinked = reduceDeleteSync(syncState(before), {
    type: 'apply-delete-commit', roomId: 'test-delete-protocol', snapshot: plan.nextRoot, affectedPaths: plan.affectedPaths
  });
  relinked = receive(relinked, 'tasks', plan.nextRoot.tasks);
  relinked = receive(relinked, 'schedules', { s1: { relatedTaskId: 't2', revision: 4, title: 'relinked' } });
  relinked = receive(relinked, 'knowledge', plan.nextRoot.knowledge);
  assert.equal(relinked.barrier.phase, 'acknowledged');
  assert.equal(relinked.collections.schedules.s1.relatedTaskId, 't2');

  let removed = reduceDeleteSync(syncState(before), {
    type: 'apply-delete-commit', roomId: 'test-delete-protocol', snapshot: plan.nextRoot, affectedPaths: plan.affectedPaths
  });
  removed = receive(removed, 'tasks', plan.nextRoot.tasks);
  removed = receive(removed, 'schedules', {});
  removed = receive(removed, 'knowledge', plan.nextRoot.knowledge);
  assert.equal(removed.barrier.phase, 'acknowledged');
  assert.equal(removed.collections.schedules.s1, undefined);
});

test('already-deleted task keeps a barrier until an absent-task subscription acknowledges it', () => {
  const before = root();
  let next = reduceDeleteSync(syncState(before), {
    type: 'apply-already-deleted', roomId: 'test-delete-protocol', snapshot: { tasks: {}, schedules: before.schedules, knowledge: before.knowledge }, affectedPaths: ['tasks/t1']
  });
  next = receive(next, 'tasks', { t1: before.tasks.t1 }, false);
  assert.equal(next.collections.tasks.t1, undefined);
  next = receive(next, 'tasks', {});
  assert.equal(next.barrier.phase, 'acknowledged');
});

test('room reset clears a deletion barrier without applying a foreign-room snapshot', () => {
  const before = root();
  const plan = planDeleteMutation(captureDeleteBaseFromRoot('t1', before), before);
  const pending = reduceDeleteSync(syncState(before), {
    type: 'apply-delete-commit', roomId: 'test-delete-protocol', snapshot: plan.nextRoot, affectedPaths: plan.affectedPaths
  });
  const reset = reduceDeleteSync(pending, { type: 'reset-room', roomId: 'test-next-room' });
  assert.equal(reset.roomId, 'test-next-room');
  assert.equal(reset.barrier, null);
  assert.equal(reduceDeleteSync(reset, { type: 'receive-subscription', roomId: 'test-delete-protocol', collection: 'tasks', value: {} }), reset);
});
