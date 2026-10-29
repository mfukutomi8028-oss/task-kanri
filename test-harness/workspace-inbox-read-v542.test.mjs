import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function makeHarness(mode = 'local-only') {
  const window = {}, source = read('workspace-inbox-read-v542.js');
  vm.runInNewContext(source, { window }, { filename: 'workspace-inbox-read-v542.js' });
  const shared = window.WorkBoardInboxReadV542;
  vm.runInNewContext(source, { window });
  assert.equal(window.WorkBoardInboxReadV542, shared, 'must register once');

  let connection = mode, networkFailure = false, coldProbe = false, abort = false;
  const inbox = {};
  const server = new Map();
  const calls = { writes: [], local: [], notifications: [], logs: [], connect: 0 };
  const path = (user, id) => 'rooms/room-v542/workflowV152/inbox/' + user + '/' + id;
  const firebase = {
    db: {},
    ref(db, at) { assert.equal(db, firebase.db); return { path: at }; },
    async runTransaction(ref, update, options) {
      assert.equal(options.applyLocally, false, 'never apply Firebase local optimistic writes twice');
      if (networkFailure) throw new Error('network-lost');
      const current = server.get(ref.path) ?? null;
      let probeResult = 'unused';
      if (coldProbe) {
        probeResult = update(null);
        // Simulate SDK's initial cold local cache; do not mutate the server.
      }
      const next = update(current && { ...current });
      calls.writes.push({ path: ref.path, current, next, probeResult });
      if (abort || next === undefined) return { committed: false, snapshot: { val: () => current } };
      if (next === null) server.delete(ref.path);
      else server.set(ref.path, next);
      return { committed: true, snapshot: { val: () => next } };
    }
  };
  const persistence = shared.create({
    roomId: 'room-v542',
    getInbox: () => inbox,
    ensureRemote: async () => { calls.connect++; return connection === 'ready' ? firebase : null; },
    getRemoteState: () => connection,
    applyLocal(user, id, value) {
      const item = inbox[user]?.[id];
      if (!item) return false;
      item.readAt = shared.normalizeReadAt(value);
      calls.local.push([user, id, item.readAt]);
      return true;
    },
    notify: (...args) => calls.notifications.push(args),
    log: (...args) => calls.logs.push(args)
  });
  function makeEvent({ readAt = 0, taskId = 'task-a' } = {}) {
    return { taskId, title: '新規コメント', body: 'テスト', readAt, createdAt: 100 };
  }
  return {
    window, shared, inbox, server, calls, path, makeEvent, persistence,
    setMode(next) { connection = next; }, setNetworkFailure(next = true) { networkFailure = next; },
    setColdProbe(next = true) { coldProbe = next; }, setAbort(next = true) { abort = next; }
  };
}

test('Ver.542 readAt normalization and missing event do not create placeholder records', async () => {
  const h = makeHarness();
  assert.equal(h.shared.normalizeReadAt(undefined), 0);
  assert.equal(h.shared.normalizeReadAt('5'), 5);
  assert.equal(h.shared.normalizeReadAt(-9), 0);
  assert.equal(h.shared.normalizeReadAt('not-a-date'), 0);
  assert.equal((await h.persistence.write('missing', true, '福冨')).ok, false);
  assert.equal(h.calls.connect, 0);
  assert.equal(h.calls.local.length, 0);
});

test('Ver.542 local-only read and unread use the original canonical inbox, not another cache', async () => {
  const h = makeHarness('local-only');
  h.inbox['福冨'] = { x: h.makeEvent(), y: h.makeEvent() };
  const original = h.inbox['福冨'].x;
  const result = await h.persistence.write('x', true, '福冨');
  assert.equal(result.ok, true);
  assert.equal(result.localOnly, true);
  assert.ok(original.readAt > 0);
  assert.equal(h.inbox['福冨'].y.readAt, 0);
  assert.equal((await h.persistence.write('x', false, '福冨')).ok, true);
  assert.equal(original.readAt, 0);
  assert.equal(h.calls.writes.length, 0);
  assert.equal(h.calls.notifications.length, 0);
});

test('Ver.542 remote read and unread preserve child path, event content and expected-base CAS', async () => {
  const h = makeHarness('ready');
  h.inbox['福冨'] = { x: h.makeEvent() };
  h.server.set(h.path('福冨', 'x'), h.makeEvent());
  const readResult = await h.persistence.write('x', true, '福冨', 0, true);
  assert.equal(readResult.ok, true);
  const stored = h.server.get(h.path('福冨', 'x'));
  assert.ok(stored.readAt > 0);
  assert.equal(stored.taskId, 'task-a');
  assert.equal(stored.title, '新規コメント');
  assert.equal(h.inbox['福冨'].x.readAt, stored.readAt);
  assert.equal(h.calls.writes[0].path, h.path('福冨', 'x'));
  assert.equal(h.calls.local.length, 2, 'optimistic and confirmed snapshots');
  const unreadResult = await h.persistence.write('x', false, '福冨', stored.readAt, true);
  assert.equal(unreadResult.ok, true);
  assert.equal(h.server.get(h.path('福冨', 'x')).readAt, 0);
  assert.equal(h.inbox['福冨'].x.readAt, 0);
});

test('Ver.542 cold-cache null probe does not delete event or classify it as remote loss', async () => {
  const h = makeHarness('ready');
  h.setColdProbe(true);
  h.inbox['福冨'] = { x: h.makeEvent() };
  h.server.set(h.path('福冨', 'x'), h.makeEvent());
  const result = await h.persistence.write('x', true, '福冨', 0, true);
  assert.equal(result.ok, true);
  assert.equal(h.calls.writes[0].probeResult, null, 'the first null is only a cold-cache SDK probe');
  assert.equal(h.calls.writes[0].next.taskId, 'task-a');
  assert.equal(h.calls.notifications.length, 0);
  assert.ok(h.server.get(h.path('福冨', 'x')).readAt > 0);
});

test('Ver.542 stale read and stale unread preserve the remote winner and expose conflict', async () => {
  const h = makeHarness('ready');
  const old = h.makeEvent({ readAt: 111 }), winner = h.makeEvent({ readAt: 222 });
  h.inbox['福冨'] = { x: { ...old } };
  h.server.set(h.path('福冨', 'x'), { ...winner });
  let result = await h.persistence.write('x', false, '福冨', old.readAt, true);
  assert.equal(result.ok, false);
  assert.equal(result.conflict, true);
  assert.equal(h.server.get(h.path('福冨', 'x')).readAt, 222);
  assert.equal(h.inbox['福冨'].x.readAt, 222);
  result = await h.persistence.write('x', true, '福冨', old.readAt, true);
  assert.equal(result.ok, false);
  assert.equal(result.conflict, true);
  assert.equal(h.inbox['福冨'].x.readAt, 222);
  assert.equal(h.calls.notifications.length, 2);
  assert.equal(h.calls.logs.length, 0);
  const currentResult = await h.persistence.write('x', false, '福冨', 222, true);
  assert.equal(currentResult.ok, true);
  assert.equal(h.server.get(h.path('福冨', 'x')).readAt, 0);
});

test('Ver.542 absent remote or mismatched taskId cannot overwrite or recreate notification', async () => {
  const h = makeHarness('ready');
  h.inbox['福冨'] = { x: h.makeEvent({ readAt: 0 }) };
  const result = await h.persistence.write('x', true, '福冨', 0, true);
  assert.equal(result.ok, false);
  assert.equal(result.conflict, true);
  assert.equal(h.inbox['福冨'].x.readAt, 0);
  assert.equal(h.server.has(h.path('福冨', 'x')), false);
  h.server.set(h.path('福冨', 'x'), { title: 'no taskId', readAt: 0 });
  const invalid = await h.persistence.write('x', true, '福冨', 0, true);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.conflict, true);
  assert.equal(h.server.get(h.path('福冨', 'x')).title, 'no taskId');
});

test('Ver.542 blocked remote and rejected transaction restore previous readAt without losing event', async () => {
  const h = makeHarness('error');
  h.inbox['福冨'] = { x: h.makeEvent({ readAt: 333 }) };
  const unavailable = await h.persistence.write('x', false, '福冨');
  assert.equal(unavailable.ok, false);
  assert.equal(h.inbox['福冨'].x.readAt, 333);
  assert.equal(h.calls.notifications.length, 1);
  h.setMode('ready');
  h.server.set(h.path('福冨', 'x'), h.makeEvent({ readAt: 333 }));
  h.setNetworkFailure(true);
  const failed = await h.persistence.write('x', false, '福冨', 333, true);
  assert.equal(failed.ok, false);
  assert.equal(failed.error, 'network-lost');
  assert.equal(h.inbox['福冨'].x.readAt, 333);
  assert.equal(h.calls.logs.length, 1);
  assert.equal(h.calls.notifications.length, 2);
});

test('Ver.542 preserves frozen unread target ids and the one live workflow owner', () => {
  const module = read('workspace-inbox-read-v542.js');
  const sidecar = read('workflow-v152.js');
  const manifest = read('release-manifest.js');
  const preview = read('modern/preview/index.html');
  assert.match(sidecar, /window\.WorkBoardInboxReadV542\.create\(/);
  assert.match(sidecar, /return inboxReadPersistence\.write\(eventId,read,userKey\(user\),expectedReadAt,arguments\.length>=4\)/);
  assert.match(sidecar, /targets=Object\.entries\(map\)/);
  assert.match(sidecar, /markInboxRead\(target\.id,true,user,target\.expectedReadAt\)/);
  assert.match(module, /current === null && !coldProbe/);
  assert.match(module, /normalizeReadAt\(current\.readAt\) !== expected/);
  assert.match(module, /runTransaction\(target, current =>/);
  assert.doesNotMatch(module, /\bonValue\(|\blocalStorage\b|\bdocument\b|firebaseConfig|\bfetch\(/);
  assert.doesNotMatch(preview, /workspace-inbox-read-v542|firebase|app\.js/i);
  assert.doesNotMatch(read('index.html'), /modern\/preview/);
  assert.equal((manifest.match(/"workspace-inbox-read-v542\.js"/g) || []).length, 2);
  const scripts = manifest.slice(manifest.indexOf('dynamicScripts:'));
  assert.ok(scripts.indexOf('"workspace-inbox-read-v542.js"') < scripts.indexOf('"workflow-v152.js"'));
});
