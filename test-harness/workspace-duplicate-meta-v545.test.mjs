import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');

function fixture(mode = 'local-only') {
  const window = {}, source = read('workspace-duplicate-meta-v545.js');
  vm.runInNewContext(source, { window }, { filename: 'workspace-duplicate-meta-v545.js' });
  const shared = window.WorkBoardDuplicateMetaV545;
  vm.runInNewContext(source, { window });
  assert.equal(window.WorkBoardDuplicateMetaV545, shared);

  const duplicates = {}, server = new Map();
  let connection = mode, fail = false, abort = false;
  const calls = { apply: [], transactions: [], notifications: [], logs: [], ensure: 0 };
  const path = id => 'rooms/v545-room/workflowV152/duplicates/' + id;
  const remote = {
    db: {},
    ref(db, at) { assert.equal(db, this.db); return { at }; },
    async runTransaction(target, update, options) {
      assert.equal(options.applyLocally, false);
      if (fail) throw new Error('offline');
      const before = server.get(target.at) ?? null;
      const next = update(before);
      calls.transactions.push({ path: target.at, before, next });
      if (abort || next === undefined) return { committed: false, snapshot: { val: () => before } };
      if (next === null) server.delete(target.at);
      else server.set(target.at, next);
      return { committed: true, snapshot: { val: () => next } };
    }
  };
  const owner = shared.create({
    roomId: 'v545-room',
    getDuplicates: () => duplicates,
    ensureRemote: async () => { calls.ensure++; return connection === 'ready' ? remote : null; },
    getRemoteState: () => connection,
    currentUser: () => '福冨',
    applyLocal: (id, value) => {
      const next = shared.normalize(value);
      if (next) duplicates[id] = next;
      else delete duplicates[id];
      calls.apply.push([id, next && { ...next }]);
    },
    notify: (...args) => calls.notifications.push(args),
    log: (...args) => calls.logs.push(args)
  });
  return {
    owner, shared, duplicates, server, path, calls,
    setMode: value => { connection = value; },
    setError: value => { fail = value; },
    setAbort: value => { abort = value; }
  };
}

test('Ver.545 normalizes metadata and compares all three expected-base fields', () => {
  const { shared } = fixture();
  assert.equal(shared.normalize(null), null);
  assert.equal(shared.normalize({ targetId: '' }), null);
  const item = shared.normalize({ targetId: 100, mergedAt: '52', mergedBy: 9 });
  assert.equal(item.targetId, '100');
  assert.equal(item.mergedAt, 52);
  assert.equal(item.mergedBy, '9');
  assert.equal(shared.same(null, undefined), true);
  assert.equal(shared.same({ targetId: 'a', mergedAt: 5, mergedBy: 'u' },
    { targetId: 'a', mergedAt: 5, mergedBy: 'u' }), true);
  assert.equal(shared.same({ targetId: 'a', mergedAt: 5, mergedBy: 'u' },
    { targetId: 'a', mergedAt: 5, mergedBy: 'z' }), false);
});

test('Ver.545 local-only write uses sole workflow state and preserves optimistic event behavior', async () => {
  const h = fixture();
  const result = await h.owner.write('source-a', 'target-a');
  assert.equal(result.ok, true);
  assert.equal(result.localOnly, true);
  assert.equal(h.duplicates['source-a'].targetId, 'target-a');
  assert.equal(h.duplicates['source-a'].mergedBy, '福冨');
  assert.ok(h.duplicates['source-a'].mergedAt > 0);
  assert.equal(h.calls.apply.length, 1);
  assert.equal(h.calls.transactions.length, 0);
});

test('Ver.545 unavailable remote retains old compatibility status without falsely reporting saved', async () => {
  const h = fixture('error');
  const result = await h.owner.write('source-a', 'target-a');
  assert.equal(result.ok, false);
  assert.equal(result.localOnly, false);
  assert.equal(h.duplicates['source-a'].targetId, 'target-a',
    'the original writer left an optimistic local cache on failed startup');
  assert.equal(h.calls.apply.length, 1);
  assert.equal(h.calls.transactions.length, 0);
});

test('Ver.545 remote first write uses original child transaction, no root overwrite', async () => {
  const h = fixture('ready');
  assert.equal((await h.owner.write('source-a', 'target-a')).ok, true);
  const saved = h.server.get(h.path('source-a'));
  assert.equal(saved.targetId, 'target-a');
  assert.equal(saved.mergedBy, '福冨');
  assert.equal(h.calls.transactions[0].path, h.path('source-a'));
  assert.equal(h.calls.apply.length, 2);
});

test('Ver.545 stale explicit expected base rejects overwrite and refreshes remote winner', async () => {
  const h = fixture('ready');
  const winner = { targetId: 'target-b', mergedAt: 80, mergedBy: 'another' };
  const old = { targetId: 'target-a', mergedAt: 70, mergedBy: 'old' };
  h.duplicates['source-a'] = { ...old };
  h.server.set(h.path('source-a'), { ...winner });
  const result = await h.owner.write('source-a', 'target-c', old, true);
  assert.equal(result.ok, false);
  assert.equal(result.conflict, true);
  assert.equal(h.server.get(h.path('source-a')).targetId, 'target-b');
  assert.equal(h.duplicates['source-a'].targetId, 'target-b');
  assert.equal(h.calls.notifications.length, 1);
  assert.equal(h.calls.logs.length, 0);
  assert.equal((await h.owner.write('source-a', 'target-c', winner, true)).ok, true);
  assert.equal(h.server.get(h.path('source-a')).targetId, 'target-c');
});

test('Ver.545 explicitly passing expected:null is not replaced with the optimistic local value', async () => {
  const h = fixture('ready');
  h.duplicates['source-a'] = { targetId: 'cached', mergedAt: 1, mergedBy: 'a' };
  const result = await h.owner.write('source-a', 'new-target', null, true);
  assert.equal(result.ok, true);
  assert.equal(h.server.get(h.path('source-a')).targetId, 'new-target');
});

test('Ver.545 server abort and network error restore the previous local metadata', async () => {
  const h = fixture('ready'), old = { targetId: 'target-old', mergedAt: 11, mergedBy: 'x' };
  h.duplicates['source-a'] = { ...old };
  h.server.set(h.path('source-a'), { ...old });
  h.setAbort(true);
  const abort = await h.owner.write('source-a', 'target-new');
  assert.equal(abort.ok, false);
  assert.equal(abort.error, 'duplicate-transaction-aborted');
  assert.equal(h.duplicates['source-a'].targetId, 'target-old');
  h.setAbort(false);
  h.setError(true);
  const failure = await h.owner.write('source-a', 'target-new');
  assert.equal(failure.ok, false);
  assert.equal(failure.error, 'offline');
  assert.equal(h.server.get(h.path('source-a')).targetId, 'target-old');
  assert.equal(h.duplicates['source-a'].targetId, 'target-old');
  assert.equal(h.calls.logs.length, 2);
  assert.equal(h.calls.notifications.length, 0,
    'legacy writer did not show additional generic notifications for errors');
});

test('Ver.545 source and target metadata updates never modify unrelated keys or archives', async () => {
  const h = fixture('ready');
  h.server.set(h.path('unrelated'), { targetId: 'untouched', mergedAt: 9, mergedBy: 'other' });
  await h.owner.write('source-a', 'target-b');
  assert.equal(h.server.get(h.path('unrelated')).targetId, 'untouched');
  assert.equal(h.server.size, 2);
  assert.equal(h.calls.transactions.length, 1);
});

test('Ver.545 shared writer is loaded before Classic and does not own the room subscription', () => {
  const module = read('workspace-duplicate-meta-v545.js');
  const sidecar = read('workflow-v152.js');
  const manifest = read('release-manifest.js');
  const preview = read('modern/preview/index.html');
  assert.match(sidecar, /window\.WorkBoardDuplicateMetaV545\.create\(/);
  assert.match(sidecar, /return duplicateMetadata\.write\(sourceId,targetId,expectedDuplicate,arguments\.length>=3\)/);
  assert.match(module, /runTransaction\(target, current =>/);
  assert.match(module, /if \(!same\(current, expected\)\)/);
  assert.match(module, /applyLocally: false/);
  assert.doesNotMatch(module, /\bonValue\(|\blocalStorage\b|\bdocument\b|\bfetch\(/);
  assert.doesNotMatch(preview, /workspace-duplicate-meta-v545|firebase|app\.js/i);
  assert.equal((manifest.match(/"workspace-duplicate-meta-v545\.js"/g) || []).length, 2);
  const scripts = manifest.slice(manifest.indexOf('dynamicScripts:'));
  assert.ok(scripts.indexOf('"workspace-duplicate-meta-v545.js"') < scripts.indexOf('"workflow-v152.js"'));
});
