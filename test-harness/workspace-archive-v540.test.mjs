import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');

function harness({ remoteMode = 'local-only' } = {}) {
  const state = { archives: {} };
  const online = new Map();
  const calls = { local: [], transactions: [], notifications: [], logs: [], remoteCalls: 0 };
  const window = {};
  const source = read('workspace-archive-v540.js');
  vm.runInNewContext(source, { window }, { filename: 'workspace-archive-v540.js' });
  const singleton = window.WorkBoardArchivePersistenceV540;
  vm.runInNewContext(source, { window });
  assert.equal(singleton, window.WorkBoardArchivePersistenceV540, 'registration is idempotent');
  const path = id => 'rooms/test-v540/workflowV152/archives/' + id;
  const remote = {
    db: {},
    ref(db, p) { assert.equal(db, this.db); return { path: p }; },
    async runTransaction(ref, updater, options) {
      assert.equal(options?.applyLocally, false, 'transactions must not apply optimistically twice');
      const current = online.get(ref.path) || null;
      const updated = updater(current);
      calls.transactions.push({ path: ref.path, current, updated });
      if (updated === undefined) return { committed: false, snapshot: { val: () => current } };
      if (updated === null) online.delete(ref.path);
      else online.set(ref.path, updated);
      return { committed: true, snapshot: { val: () => updated } };
    }
  };
  let failTransactions = false;
  const realTxn = remote.runTransaction;
  remote.runTransaction = function (...args) {
    if (failTransactions) return Promise.reject(new Error('network-down'));
    return realTxn.apply(this, args);
  };
  const writer = singleton.create({
    roomId: 'test-v540',
    getArchives: () => state.archives,
    ensureRemote: async () => { calls.remoteCalls++; return remoteMode === 'ready' ? remote : null; },
    getRemoteState: () => remoteMode,
    currentUser: () => '福冨',
    applyLocal: (id, value) => {
      const item = singleton.normalize(value);
      if (item) state.archives[id] = item;
      else delete state.archives[id];
      calls.local.push([id, item && JSON.parse(JSON.stringify(item))]);
    },
    notify: (...args) => calls.notifications.push(args),
    log: (...args) => calls.logs.push(args)
  });
  return {
    writer, state, online, calls, path, singleton,
    setMode(value) { remoteMode = value; },
    failTransactions(value = true) { failTransactions = value; }
  };
}

test('Ver.540 archive normalize/same values keep the existing expected-base fields', () => {
  const { singleton } = harness();
  assert.equal(singleton.same(null, undefined), true);
  assert.equal(singleton.same({ archivedAt: 7, archivedBy: '福冨', reason: 'manual' },
    { archivedAt: 7, archivedBy: '福冨', reason: 'manual' }), true);
  assert.equal(singleton.same({ archivedAt: 7, archivedBy: 'A' },
    { archivedAt: 8, archivedBy: 'A' }), false);
  assert.equal(singleton.normalize({ archivedAt: '9', archivedBy: 5, reason: '' }).reason, 'manual');
  assert.equal(singleton.normalize({ archivedAt: '9' }).archivedAt, 9);
});

test('Ver.540 local-only archive and restore preserve cache, event, and return contracts', async () => {
  const h = harness();
  const done = await h.writer.archive('task1', 'manual', null, false);
  assert.equal(done.ok, true);
  assert.equal(done.localOnly, true);
  assert.equal(h.state.archives.task1.archivedBy, '福冨');
  assert.equal(h.state.archives.task1.reason, 'manual');
  const restored = await h.writer.restore('task1', null, false);
  assert.equal(restored.ok, true);
  assert.equal(restored.localOnly, true);
  assert.equal(h.state.archives.task1, undefined);
  assert.equal(h.calls.local.length, 2);
  assert.equal(h.calls.transactions.length, 0);
});

test('Ver.540 remote archive commits only to its own child with applyLocally:false', async () => {
  const h = harness({ remoteMode: 'ready' });
  assert.equal((await h.writer.archive('a', 'manual')).ok, true);
  assert.equal(h.online.get(h.path('a')).reason, 'manual');
  assert.equal(h.calls.transactions.length, 1);
  assert.equal(h.calls.transactions[0].path, h.path('a'));
  assert.equal(h.calls.local.length, 2, 'optimistic and committed snapshots');
  const current = h.online.get(h.path('a'));
  assert.equal((await h.writer.restore('a', current, true)).ok, true);
  assert.equal(h.online.has(h.path('a')), false);
  assert.equal(h.calls.transactions.length, 2);
});

test('Ver.540 stale archive and stale restore preserve remote winner and update local cache', async () => {
  const h = harness({ remoteMode: 'ready' });
  const winner = { archivedAt: 100, archivedBy: 'remote-user', reason: 'remote-win' };
  const old = { archivedAt: 90, archivedBy: 'old-user', reason: 'manual' };
  h.online.set(h.path('a'), winner);
  h.state.archives.a = old;
  const conflictArchive = await h.writer.archive('a', 'manual', old, true);
  assert.equal(conflictArchive.ok, false);
  assert.equal(conflictArchive.conflict, true);
  assert.equal(h.online.get(h.path('a')).reason, 'remote-win');
  assert.equal(h.state.archives.a.reason, 'remote-win');
  assert.equal(h.calls.notifications.length, 1);
  const conflictRestore = await h.writer.restore('a', old, true);
  assert.equal(conflictRestore.ok, false);
  assert.equal(conflictRestore.conflict, true);
  assert.equal(h.state.archives.a.reason, 'remote-win');
  assert.equal(h.calls.notifications.length, 2);
  assert.equal((await h.writer.restore('a', winner, true)).ok, true);
  assert.equal(h.online.has(h.path('a')), false);
});

test('Ver.540 network error restores previous local archive and exposes the original failure', async () => {
  const h = harness({ remoteMode: 'ready' });
  const old = { archivedAt: 1, archivedBy: 'old', reason: 'manual' };
  h.state.archives.a = old;
  h.failTransactions();
  const result = await h.writer.archive('a', 'manual', old, true);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'network-down');
  assert.equal(h.state.archives.a.archivedAt, 1);
  assert.equal(h.calls.notifications.length, 1);
  assert.equal(h.calls.logs.length, 1);
  const restore = await h.writer.restore('a', old, true);
  assert.equal(restore.ok, false);
  assert.equal(h.state.archives.a.archivedAt, 1);
});

test('Ver.540 unloaded remote retains existing local optimistic fallback and error status', async () => {
  const h = harness({ remoteMode: 'error' });
  const result = await h.writer.archive('a');
  assert.equal(result.ok, false);
  assert.equal(result.localOnly, false);
  assert.ok(h.state.archives.a, 'legacy offline not-ready behavior is preserved for compatibility');
  assert.equal(h.calls.transactions.length, 0);
});

test('Ver.540 keeps the Classic archive functions and isolated source boundary', () => {
  const sidecar = read('workflow-v152.js');
  const writer = read('workspace-archive-v540.js');
  const manifest = read('release-manifest.js');
  const modern = read('modern/preview/index.html');
  assert.match(sidecar, /window\.WorkBoardArchivePersistenceV540\.create\(/);
  assert.match(sidecar, /return archivePersistence\.archive\(taskId, reason, expectedArchive, arguments\.length >= 3\)/);
  assert.match(sidecar, /return archivePersistence\.restore\(taskId, expectedArchive, arguments\.length >= 2\)/);
  assert.match(writer, /r\.runTransaction\(target, current =>/);
  assert.match(writer, /if \(!same\(current, expected\)\)/);
  assert.match(writer, /return null;/);
  assert.doesNotMatch(writer, /\br\.set\(|\br\.remove\(|\bonValue\(/);
  const required = (manifest.match(/"workspace-archive-v540\.js"/g) || []).length;
  assert.equal(required, 2, 'one dynamic script and one required release asset');
  const scripts = manifest.slice(manifest.indexOf('dynamicScripts:'));
  assert.ok(scripts.indexOf('"workspace-archive-v540.js"') < scripts.indexOf('"workflow-v152.js"'));
  assert.doesNotMatch(modern, /workspace-archive-v540|firebase|app\.js/i);
});
