import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRoomTodoPromotionV572 as handle } from '../security/room-promotion-request-v572.mjs';

const project = 'demo-task-kanri-v572';
const request = Object.freeze({
  authorizationHeader: 'Bearer valid-id-token-alice-12345',
  roomId: 'room-a',
  intent: { todoId: 'todo1', expectedRevision: 3, requestId: 'operationA', title: 'タスク化', description: '本文' }
});
function fixture() {
  return {
    access: { members: { alice: 'editor', bob: 'viewer', chief: 'admin' } },
    shared: { tasks: { existing: { title: '以前のタスク', revision: 1 } } },
    personal: { alice: { todos: { todo1: {
      id: 'todo1', ownerUid: 'alice', text: '提出', revision: 3, completed: false
    } } } },
    operations: { promotions: {} }
  };
}
function sandbox() {
  let room = fixture();
  let verifyCalls = 0, writeCount = 0, transactCalls = 0, nextId = 0;
  let loseAcknowledgement = false, throwBeforeWrite = false, tokenRevoked = false, wrongProject = false;
  const service = {
    expectedProjectId: project,
    async verifyIdToken(token, checkRevoked) {
      verifyCalls++;
      assert.equal(checkRevoked, true);
      if (tokenRevoked || !token.startsWith('valid-id-token-')) throw new Error('auth failure must not leak');
      const uid = token.replace('valid-id-token-', '').replace('-12345', '');
      return {
        uid,
        aud: wrongProject ? 'another-project' : project,
        iss: 'https://securetoken.google.com/' + project,
        role: 'admin' // intentionally malicious claim; room membership is authoritative
      };
    },
    makeTaskId: () => 'generatedTask' + (++nextId),
    now: () => 1761876000000,
    async transactRoom(roomId, updateRoom) {
      transactCalls++;
      assert.equal(roomId, 'room-a');
      if (throwBeforeWrite) throw new Error('upstream disconnected');
      const updated = updateRoom(structuredClone(room));
      if (updated === undefined) {
        return { committed: false, snapshot: { val: () => structuredClone(room) } };
      }
      room = structuredClone(updated);
      writeCount++;
      if (loseAcknowledgement) {
        loseAcknowledgement = false;
        throw new Error('ack lost AFTER server commit');
      }
      return { committed: true, snapshot: { val: () => structuredClone(room) } };
    }
  };
  return {
    service,
    state: () => structuredClone(room),
    stats: () => ({ verifyCalls, transactCalls, writeCount }),
    changeRoom: modifier => { modifier(room); },
    revokeToken: () => { tokenRevoked = true; },
    wrongProject: () => { wrongProject = true; },
    loseAck: () => { loseAcknowledgement = true; },
    failNetwork: () => { throwBeforeWrite = true; }
  };
}

test('Ver.572 validates a signed-token contract and commits only through the existing planner', async () => {
  const s = sandbox();
  const initial = s.state();
  const result = await handle(request, s.service);
  assert.equal(result.status, 'created');
  assert.equal(result.taskId, 'generatedTask1');
  assert.equal(s.state().shared.tasks.generatedTask1.revision, 1);
  assert.equal(s.state().personal.alice.todos.todo1.revision, 4);
  assert.equal(s.state().personal.alice.todos.todo1.completed, true);
  assert.equal(Object.keys(s.state().operations.promotions.alice).length, 1);
  assert.deepEqual(s.state().shared.tasks.existing, initial.shared.tasks.existing);
  assert.deepEqual(s.stats(), { verifyCalls: 1, transactCalls: 1, writeCount: 1 });
});

test('Ver.572 same operation ID returns already-applied without a second write', async () => {
  const s = sandbox();
  assert.equal((await handle(request, s.service)).status, 'created');
  const replay = await handle(request, s.service);
  assert.deepEqual(replay, { status: 'already-applied', taskId: 'generatedTask1' });
  assert.equal(s.stats().writeCount, 1);
  assert.equal(Object.keys(s.state().shared.tasks).length, 2);
});

test('Ver.572 transport loss after a real commit is indeterminate; retry recovers original task', async () => {
  const s = sandbox();
  s.loseAck();
  assert.deepEqual(await handle(request, s.service), { status: 'indeterminate', retrySameRequestId: true });
  assert.equal(s.stats().writeCount, 1);
  assert.deepEqual(await handle(request, s.service), { status: 'already-applied', taskId: 'generatedTask1' });
  assert.equal(s.stats().writeCount, 1);
});

test('Ver.572 network failure before any commit never returns a false success', async () => {
  const s = sandbox(); s.failNetwork();
  assert.deepEqual(await handle(request, s.service), { status: 'indeterminate', retrySameRequestId: true });
  assert.equal(s.stats().writeCount, 0);
});

test('Ver.572 refuses missing, expired and revoked tokens before a database call', async () => {
  const s = sandbox();
  assert.deepEqual(await handle({ ...request, authorizationHeader: '' }, s.service), { status: 'unauthenticated' });
  assert.deepEqual(await handle({ ...request, authorizationHeader: 'Bearer expired-id-token-12345' }, s.service), { status: 'unauthenticated' });
  s.revokeToken();
  assert.deepEqual(await handle(request, s.service), { status: 'unauthenticated' });
  assert.equal(s.stats().transactCalls, 0);
});

test('Ver.572 rejects a token with the wrong Firebase audience even if mocked verifier returns it', async () => {
  const s = sandbox(); s.wrongProject();
  assert.deepEqual(await handle(request, s.service), { status: 'unauthenticated' });
  assert.equal(s.stats().transactCalls, 0);
});

test('Ver.572 client-controlled role/UID/task ID and invalid room keys are rejected before auth', async () => {
  const s = sandbox();
  const invalid = [
    { ...request, uid: 'chief' },
    { ...request, role: 'admin' },
    { ...request, roomId: '../room-b' },
    { ...request, roomId: '__proto__' },
    { ...request, intent: { ...request.intent, ownerUid: 'bob' } },
    { ...request, intent: { ...request.intent, role: 'admin' } },
    { ...request, intent: { ...request.intent, generatedTaskId: 'existing' } },
    { ...request, intent: { ...request.intent, expectedRevision: 1.5 } },
    { ...request, intent: { ...request.intent, title: ' ' } }
  ];
  for (const bad of invalid) assert.equal((await handle(bad, s.service)).status, 'invalid-request');
  assert.equal(s.stats().verifyCalls, 0);
});

test('Ver.572 room membership is checked from current transactional state, never token claims', async () => {
  const s = sandbox();
  s.changeRoom(room => { room.access.members.alice = 'viewer'; });
  assert.equal((await handle(request, s.service)).status, 'forbidden');
  assert.equal(s.stats().writeCount, 0);
  s.changeRoom(room => { delete room.access.members.alice; });
  assert.equal((await handle(request, s.service)).status, 'forbidden');
  assert.equal(s.stats().writeCount, 0);
});

test('Ver.572 revoked membership blocks even an already-committed operation replay', async () => {
  const s = sandbox();
  assert.equal((await handle(request, s.service)).status, 'created');
  s.changeRoom(room => { delete room.access.members.alice; });
  assert.deepEqual(await handle(request, s.service), { status: 'forbidden' });
  assert.equal(s.stats().writeCount, 1);
});

test('Ver.572 stale revisions, changed payload with same request ID and task ID collisions do not write', async () => {
  const s = sandbox();
  assert.equal((await handle({ ...request, intent: { ...request.intent, expectedRevision: 2 } }, s.service)).status, 'conflict');
  assert.equal((await handle(request, s.service)).status, 'created');
  assert.equal((await handle({ ...request, intent: { ...request.intent, title: '別のタスク' } }, s.service)).status, 'conflict');
  assert.equal(s.stats().writeCount, 1);
});

test('Ver.572 concurrent same-ID submissions cannot create two tasks', async () => {
  const s = sandbox();
  const results = await Promise.all([handle(request, s.service), handle(request, s.service)]);
  assert.deepEqual(results.map(x => x.status).sort(), ['already-applied', 'created']);
  assert.equal(s.stats().writeCount, 1);
});

test('Ver.572 different requests for the same old revision cannot both commit', async () => {
  const s = sandbox();
  const second = { ...request, intent: { ...request.intent, requestId: 'operationB' } };
  const responses = await Promise.all([handle(request, s.service), handle(second, s.service)]);
  assert.deepEqual(responses.map(x => x.status).sort(), ['conflict', 'created']);
  assert.equal(s.stats().writeCount, 1);
});

test('Ver.572 malformed transaction results and unloaded/null rooms never claim success', async () => {
  const s = sandbox();
  s.service.transactRoom = async () => ({ committed: true, snapshot: { val: () => fixture() } });
  assert.deepEqual(await handle(request, s.service), { status: 'indeterminate', retrySameRequestId: true });
  s.service.transactRoom = async () => ({ committed: false, snapshot: { val: () => null } });
  assert.deepEqual(await handle(request, s.service), { status: 'indeterminate', retrySameRequestId: true });
  s.service.transactRoom = async () => null;
  assert.deepEqual(await handle(request, s.service), { status: 'indeterminate', retrySameRequestId: true });
});

test('Ver.572 server adapter refuses unsafe configuration and does not delegate credentials to the browser', async () => {
  const s = sandbox();
  await assert.rejects(handle(request, { ...s.service, verifyIdToken: undefined }), TypeError);
  await assert.rejects(handle(request, { ...s.service, expectedProjectId: '../other' }), TypeError);
  s.service.makeTaskId = () => '../forged';
  assert.deepEqual(await handle(request, s.service), { status: 'unavailable' });
  assert.equal(s.stats().transactCalls, 0);
});


test('Ver.573 accepts SDK TransactionResult class instances and fails closed on bad getters', async () => {
  const s = sandbox();
  const original = s.service.transactRoom;
  class TransactionResult {
    constructor(result) {
      this.committed = result.committed;
      this.snapshot = result.snapshot;
    }
  }
  s.service.transactRoom = async (...args) => new TransactionResult(await original(...args));
  assert.deepEqual(await handle(request, s.service), { status: 'created', taskId: 'generatedTask1' });
  assert.deepEqual(await handle(request, s.service), { status: 'already-applied', taskId: 'generatedTask1' });
  assert.equal(s.stats().writeCount, 1);
  s.service.transactRoom = async () => Object.defineProperty({}, 'committed', {
    get() { throw Error('bad-getter'); }
  });
  assert.deepEqual(await handle(request, s.service),
    { status: 'indeterminate', retrySameRequestId: true });
});
