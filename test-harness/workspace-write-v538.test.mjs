import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classifyWorkspaceWriteError, createWorkspaceWriteCoordinator } from '../workspace-write-v538.js';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((r, j) => { resolve = r; reject = j; });
  return { promise, resolve, reject };
}

function harness(start = 'local-only') {
  let mode = start;
  const inFlightOperations = new Map();
  const busy = [];
  const errors = [];
  const settled = [];
  const degraded = [];
  const api = createWorkspaceWriteCoordinator({
    operationKey: (kind, id = '') => `${kind}:${id || 'new'}`,
    inFlightOperations,
    getConnectionMode: () => mode,
    setOperationBusy: (key, value) => busy.push([key, value]),
    logFailure: (key, error) => errors.push([key, error]),
    onNetworkFailure: () => { degraded.push(mode); mode = 'remote-degraded'; },
    onSettled: kind => settled.push(kind)
  });
  return {
    api, inFlightOperations, busy, errors, settled, degraded,
    mode: () => mode, setMode: next => { mode = next; }
  };
}

test('single coordinator delegates success to canonical writer and preserves metadata shape', async () => {
  const h = harness();
  let canonicalWriterCalls = 0;
  const result = await h.api.execute('task', 't1', key => {
    canonicalWriterCalls++;
    assert.equal(key, 'task:t1');
    return { committed: true, affectedPaths: ['rooms/demo/tasks/t1'], snapshotScope: 'record' };
  });
  assert.deepEqual(result, {
    ok: true, mode: 'local-only', operationId: 'task:t1',
    affectedPaths: ['rooms/demo/tasks/t1'], committed: true, snapshotScope: 'record'
  });
  assert.equal(canonicalWriterCalls, 1);
  assert.deepEqual(h.busy, [['task:t1', true], ['task:t1', false]]);
  assert.deepEqual(h.settled, ['task']);
  assert.equal(h.inFlightOperations.size, 0);
  assert.deepEqual(h.errors, []);
});

test('same operation is rejected in flight; different operations can proceed independently', async () => {
  const h = harness('remote-online');
  const gate = deferred();
  let calls = 0;
  const first = h.api.execute('todo-reorder', 'id1', async key => {
    calls++; assert.equal(key, 'todo-reorder:id1'); await gate.promise;
    return { committed: true };
  });
  assert.equal(h.inFlightOperations.size, 1);
  assert.deepEqual(await h.api.execute('todo-reorder', 'id1', () => { calls++; }), {
    ok: false, mode: 'remote-online', operationId: 'todo-reorder:id1',
    error: 'in-flight', affectedPaths: []
  });
  const separate = await h.api.execute('todo-reorder', 'id2', async () => ({ committed: true }));
  assert.equal(separate.ok, true);
  assert.equal(calls, 1);
  assert.equal(h.inFlightOperations.size, 1);
  gate.resolve();
  assert.equal((await first).ok, true);
  assert.equal(h.inFlightOperations.size, 0);
  assert.deepEqual(h.busy, [
    ['todo-reorder:id1', true], ['todo-reorder:id2', true],
    ['todo-reorder:id2', false], ['todo-reorder:id1', false]
  ]);
  assert.deepEqual(h.settled, ['todo-reorder', 'todo-reorder']);
});

test('blocked modes deny writes without modifying busy state or invoking the writer', async () => {
  for (const mode of ['initializing', 'remote-loading', 'remote-degraded']) {
    const h = harness(mode);
    let calls = 0;
    assert.deepEqual(await h.api.execute('task-delete', 'x', () => { calls++; }), {
      ok: false, mode, operationId: 'task-delete:x', error: 'write-not-available', affectedPaths: []
    });
    assert.equal(calls, 0);
    assert.equal(h.inFlightOperations.size, 0);
    assert.deepEqual(h.busy, []);
    assert.deepEqual(h.settled, []);
  }
});

test('writer failures preserve precise conflict and permission classifications', async () => {
  const h = harness('remote-online');
  for (const [error, expected] of [
    [new Error('revision-or-relation-mismatch'), 'revision-or-relation-mismatch'],
    [new Error('transaction-aborted-or-invariant-failure'), 'transaction-aborted-or-invariant-failure'],
    [Object.assign(new Error('denied'), { code: 'PERMISSION_DENIED' }), 'permission-denied']
  ]) {
    const result = await h.api.execute('task', 'id', () => { throw error; });
    assert.equal(result.ok, false);
    assert.equal(result.error, expected);
    assert.equal(result.mode, 'remote-online');
    assert.deepEqual(result.affectedPaths, []);
    assert.equal(h.inFlightOperations.size, 0);
  }
  assert.equal(h.errors.length, 3);
  assert.deepEqual(h.degraded, []);
});

test('remote network failure degrades mode before reporting failure; local failure does not', async () => {
  const remote = harness('remote-online');
  const error = Object.assign(new Error('socket dropped'), { code: 'NETWORK_ERROR' });
  assert.deepEqual(await remote.api.execute('schedule', 's1', async () => { throw error; }), {
    ok: false, mode: 'remote-degraded', operationId: 'schedule:s1',
    error: 'network-or-read-failure', affectedPaths: []
  });
  assert.deepEqual(remote.degraded, ['remote-online']);
  assert.deepEqual(remote.busy, [['schedule:s1', true], ['schedule:s1', false]]);
  const blocked = await remote.api.execute('schedule', 's2', () => { throw Error('should not call'); });
  assert.equal(blocked.error, 'write-not-available');
  const local = harness('local-only');
  assert.equal((await local.api.execute('todo-create', 'form', async () => { throw error; })).error, 'network-or-read-failure');
  assert.equal(local.mode(), 'local-only');
  assert.deepEqual(local.degraded, []);
});

test('completion uses current mode and releases lock even when writer rejects', async () => {
  const h = harness('remote-online');
  const gate = deferred();
  const writing = h.api.execute('knowledge', 'id', async () => {
    await gate.promise; return { committed:true };
  });
  h.setMode('remote-loading');
  gate.resolve();
  assert.equal((await writing).mode, 'remote-loading');
  assert.equal(h.inFlightOperations.size, 0);
  assert.deepEqual(h.busy, [['knowledge:id', true], ['knowledge:id', false]]);
  assert.deepEqual(h.settled, ['knowledge']);
  assert.equal(classifyWorkspaceWriteError(new Error('already-deleted')), 'already-deleted');
});

test('actual Classic routes all write actions through one coordinator without changing transaction owners', () => {
  const app = read('app.js');
  const release = read('release-manifest.js');
  const modern = read('modern/preview/index.html');
  assert.match(app, /import \{ createWorkspaceWriteCoordinator \} from "\.\/workspace-write-v538\.js";/);
  assert.match(app, /return sharedWriteCoordinator\.execute\(kind, id, writer\);/);
  assert.match(app, /function transactionRecord\(/);
  assert.match(app, /function transactionRoom\(/);
  assert.match(app, /runTransaction\(/);
  assert.match(app, /function setOperationDisabled\(/);
  assert.equal((release.match(/"workspace-write-v538\.js"/g) || []).length, 1);
  assert.doesNotMatch(modern, /workspace-write-v538|app\.js|firebase/i);
});
