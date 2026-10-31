import test from 'node:test';
import assert from 'node:assert/strict';
import { planRoomTodoPromotionV570 as plan } from '../security/room-atomic-promotion.mjs';

function fixture() {
  return {
    access: { members: { alice: 'editor', bob: 'viewer', chief: 'admin' } },
    shared: { tasks: { old: { id: 'old', title: '以前からのタスク', revision: 7 } } },
    personal: {
      alice: { todos: { todo1: { id: 'todo1', ownerUid: 'alice', text: '提出', revision: 3, completed: false } } },
      bob: { todos: { todo2: { id: 'todo2', ownerUid: 'bob', text: '閲覧', revision: 4, completed: false } } }
    },
    operations: { promotions: {} }, meta: { custom: true }
  };
}
const cmd = { todoId: 'todo1', expectedRevision: 3, requestId: 'operationA', title: 'タスク化', description: '内容' };
const trusted = { uid: 'alice', generatedTaskId: 'taskX', now: 1761876000000 };

test('Ver.570 atomic planner commits task, personal ToDo, and replay marker without modifying input', () => {
  const before = fixture(), snapshot = structuredClone(before);
  const result = plan(before, cmd, trusted);
  assert.equal(result.action, 'commit');
  assert.equal(result.taskId, 'taskX');
  assert.deepEqual(before, snapshot);
  assert.equal(result.room.shared.tasks.taskX.revision, 1);
  assert.equal(result.room.shared.tasks.taskX.description, '内容');
  assert.deepEqual(Object.keys(result.room.shared.tasks.taskX).sort(), ['description', 'revision', 'title']);
  assert.equal(result.room.personal.alice.todos.todo1.revision, 4);
  assert.equal(result.room.personal.alice.todos.todo1.completed, true);
  assert.equal(result.room.personal.alice.todos.todo1.completedAt, trusted.now);
  assert.deepEqual(result.room.personal.bob, before.personal.bob);
  assert.deepEqual(result.room.shared.tasks.old, before.shared.tasks.old);
  assert.deepEqual(result.room.meta, before.meta);
  assert.equal(result.room.operations.promotions.alice.operationA.taskId, 'taskX');
  assert.equal(result.room.operations.promotions.alice.operationA.digest.length, 64);
  assert.equal(result.room.operations.promotions.alice.operationA.title, undefined);
});

test('Ver.570 replay returns original task ID even with a new server-generated ID', () => {
  const first = plan(fixture(), cmd, trusted);
  const replay = plan(first.room, cmd, { ...trusted, generatedTaskId: 'taskY', now: trusted.now + 1 });
  assert.equal(replay.action, 'replayed');
  assert.equal(replay.taskId, 'taskX');
  assert.equal(replay.room, first.room);
  assert.equal(Object.keys(replay.room.shared.tasks).length, 2);
  assert.equal(Object.keys(replay.room.operations.promotions.alice).length, 1);
  assert.equal(plan(first.room, { ...cmd, title: '別の依頼' }, trusted).reason, 'request-id-reused');
});

test('Ver.570 stale, finished, foreign, missing and collision intents all fail closed', () => {
  const root = fixture();
  const cases = [
    [plan(root, { ...cmd, expectedRevision: 2 }, trusted), 'stale-or-foreign-todo'],
    [plan(root, { ...cmd, todoId: 'missing' }, trusted), 'stale-or-foreign-todo'],
    [plan(root, cmd, { ...trusted, generatedTaskId: 'old' }), 'task-id-collision'],
    [plan(root, cmd, { ...trusted, uid: 'bob' }), 'not-authorized'],
    [plan(root, cmd, { ...trusted, uid: 'unknown' }), 'not-authorized']
  ];
  for (const [result, reason] of cases) assert.deepEqual(result, { action: 'deny', reason });
  assert.equal(plan({ ...root, personal: { alice: { todos: { todo1: { ...root.personal.alice.todos.todo1, completed: true } } } } }, cmd, trusted).reason, 'stale-or-foreign-todo');
  assert.equal(plan({ ...root, access: { members: { alice: 'viewer' } } }, cmd, trusted).reason, 'not-authorized');
  assert.equal(plan(null, cmd, trusted).reason, 'room-unavailable');
});

test('Ver.570 accepts no client claims about UID, role, task ID, or revision', () => {
  const root = fixture();
  const forged = [{ role: 'admin' }, { uid: 'bob' }, { generatedTaskId: 'privileged' }, { revision: 99 }, { ownerUid: 'bob' }];
  for (const extra of forged) {
    assert.equal(plan(root, { ...cmd, ...extra }, trusted).reason, 'invalid-intent');
  }
  assert.equal(plan(root, { ...cmd, title: ' ' }, trusted).reason, 'invalid-intent');
  assert.equal(plan(root, { ...cmd, expectedRevision: 1.1 }, trusted).reason, 'invalid-intent');
  assert.equal(plan(root, { ...cmd, requestId: '__proto__' }, trusted).reason, 'invalid-intent');
  assert.equal(plan(root, cmd, { ...trusted, uid: '' }).reason, 'unverified-server-context');
  assert.equal(plan(root, cmd, { ...trusted, now: NaN }).reason, 'unverified-server-context');
});

test('Ver.570 competing nonidentical commands cannot both promote the same old revision', () => {
  const first = plan(fixture(), cmd, trusted);
  assert.equal(first.action, 'commit');
  const competing = plan(first.room, { ...cmd, requestId: 'operationB' }, { ...trusted, generatedTaskId: 'taskY' });
  assert.equal(competing.action, 'deny');
  assert.equal(competing.reason, 'stale-or-foreign-todo');
  assert.deepEqual(first.room.shared.tasks.taskY, undefined);
});

test('Ver.570 replay does not claim success if its committed task was removed', () => {
  const first = plan(fixture(), cmd, trusted);
  const tampered = structuredClone(first.room);
  delete tampered.shared.tasks.taskX;
  assert.equal(plan(tampered, cmd, trusted).reason, 'replay-state-inconsistent');
});
