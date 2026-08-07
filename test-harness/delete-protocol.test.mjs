import assert from 'node:assert/strict';
import test from 'node:test';
import { captureDeleteBaseFromRoot, classifyDeleteConflict, isCanonicalRevision, planDeleteMutation } from '../task-delete-v134.js';

const root = () => ({
  tasks: { t1: { title: 'Original', revision: 3, comments: [{ text: 'keep' }], checklist: [] } },
  schedules: { s1: { relatedTaskId: 't1', revision: 2, title: 'linked' } },
  knowledge: { k1: { taskId: 't1', revision: 4, title: 'knowledge' } }
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
