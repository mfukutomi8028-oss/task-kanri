import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');

function harness({
  sourceRelations = [], targetRelations = [],
  targetResponse = { ok: true }, sourceResponse = { ok: true },
  reminderResponse = { ok: true }, errorAt = ''
} = {}) {
  const window = {}, code = read('workspace-duplicate-cleanup-v546.js');
  vm.runInNewContext(code, { window }, { filename: 'workspace-duplicate-cleanup-v546.js' });
  const shared = window.WorkBoardDuplicateCleanupV546;
  vm.runInNewContext(code, { window });
  assert.equal(window.WorkBoardDuplicateCleanupV546, shared);
  const calls = [];
  const owner = shared.create({
    getRelations(id) {
      calls.push(['read', id]);
      if (errorAt === 'inspect') throw new Error('relation-read-error');
      return id === 'source' ? sourceRelations : targetRelations;
    },
    async writeRelations(id, ids) {
      calls.push(['relation', id, [...ids]]);
      if (errorAt === (id === 'source' ? 'source' : 'target')) throw new Error('relation-error');
      return id === 'source' ? sourceResponse : targetResponse;
    },
    async writeReminder(id, item) {
      calls.push(['reminder', id, item]);
      if (errorAt === 'reminder') throw new Error('reminder-error');
      return reminderResponse;
    },
    log: (...args) => calls.push(['log', ...args])
  });
  return { owner, calls };
}

test('Ver.546 no relations: only reminder cleanup is required after the committed merge', async () => {
  const h = harness();
  const result = await h.owner.run('source', 'target');
  assert.equal(result.ok, true);
  assert.equal(result.pending.length, 0);
  assert.equal(h.calls.filter(x => x[0] === 'relation').length, 0);
  assert.deepEqual(h.calls.filter(x => x[0] === 'reminder'), [['reminder', 'source', null]]);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.pending));
});

test('Ver.546 relation transfer is ordered, deduped, excludes source and then clears source', async () => {
  const h = harness({
    sourceRelations: ['target', 'third', 'fourth'],
    targetRelations: ['third', 'source', 'fifth']
  });
  const result = await h.owner.run('source', 'target');
  assert.equal(result.ok, true);
  const writes = h.calls.filter(x => x[0] === 'relation' || x[0] === 'reminder');
  assert.deepEqual(writes, [
    ['relation', 'target', ['third', 'fifth', 'target', 'fourth']],
    ['relation', 'source', []],
    ['reminder', 'source', null]
  ]);
});

test('Ver.546 target relation failure prevents clearing source; reminder is still checked', async () => {
  const h = harness({ sourceRelations: ['third'], targetResponse: { ok: false, conflict: true } });
  const result = await h.owner.run('source', 'target');
  assert.equal(result.ok, false);
  assert.deepEqual([...result.pending], ['target-relations']);
  assert.equal(h.calls.some(x => x[0] === 'relation' && x[1] === 'source'), false);
  assert.equal(h.calls.some(x => x[0] === 'reminder'), true);
});

test('Ver.546 local-only or missing acknowledgement cannot be mistaken for remote cleanup success', async () => {
  for (const targetResponse of [{ ok: true, localOnly: true }, undefined, { ok: false }]) {
    const h = harness({ sourceRelations: ['third'], targetResponse });
    const result = await h.owner.run('source', 'target');
    assert.equal(result.ok, false);
    assert.deepEqual([...result.pending], ['target-relations']);
    assert.equal(h.calls.some(x => x[0] === 'relation' && x[1] === 'source'), false);
  }
});

test('Ver.546 source relation failure leaves a precise pending item after target success', async () => {
  const h = harness({ sourceRelations: ['third'], sourceResponse: { ok: false, conflict: true } });
  const result = await h.owner.run('source', 'target');
  assert.equal(result.ok, false);
  assert.deepEqual([...result.pending], ['source-relations']);
  assert.equal(h.calls.filter(x => x[0] === 'relation').length, 2);
  assert.equal(h.calls.some(x => x[0] === 'reminder'), true);
});

test('Ver.546 stale reminder or remote-unavailable clear is reported as pending even after root commit', async () => {
  for (const reminderResponse of [{ ok: false, conflict: true }, { ok: true, localOnly: true }]) {
    const h = harness({ reminderResponse });
    const result = await h.owner.run('source', 'target');
    assert.equal(result.ok, false);
    assert.deepEqual([...result.pending], ['reminder']);
  }
});

test('Ver.546 exceptions are contained after the atomic commit, never thrown as a fake merge failure', async () => {
  for (const errorAt of ['target', 'source', 'reminder']) {
    const h = harness({ sourceRelations: ['third'], errorAt });
    const result = await h.owner.run('source', 'target');
    assert.equal(result.ok, false);
    const expected = errorAt === 'target' ? 'target-relations'
      : errorAt === 'source' ? 'source-relations' : 'reminder';
    assert.deepEqual([...result.pending], [expected]);
    assert.equal(h.calls.filter(x => x[0] === 'log').length, 1);
  }
});

test('Ver.546 failed relation inspection never guesses what to overwrite but can still clear reminder', async () => {
  const h = harness({ sourceRelations: ['third'], errorAt: 'inspect' });
  const result = await h.owner.run('source', 'target');
  assert.equal(result.ok, false);
  assert.deepEqual([...result.pending], ['relations-inspection']);
  assert.equal(h.calls.some(x => x[0] === 'relation'), false);
  assert.equal(h.calls.some(x => x[0] === 'reminder'), true);
});

test('Ver.546 multiple failures are returned for manual review, without retrying the root merge', async () => {
  const h = harness({ sourceRelations: ['third'], targetResponse: { ok: false }, reminderResponse: { ok: false } });
  const result = await h.owner.run('source', 'target');
  assert.deepEqual([...result.pending], ['target-relations', 'reminder']);
  assert.equal(h.calls.filter(x => x[0] === 'relation').length, 1);
  assert.equal(h.calls.filter(x => x[0] === 'reminder').length, 1);
});

test('Ver.546 Classic acknowledges atomic commit separately and warns rather than asking for remerge', () => {
  const core = read('workspace-duplicate-cleanup-v546.js');
  const ui = read('duplicate-merge-v182.js');
  const manifest = read('release-manifest.js');
  const preview = read('modern/preview/index.html');
  assert.match(ui, /window\.WorkBoardDuplicateCleanupV546\.create\(/);
  assert.match(ui, /duplicatePostCommit\.run\(source,target\)/);
  assert.match(ui, /cleanupPending:true/);
  assert.match(ui, /統合操作を再実行しないでください/);
  assert.ok(ui.indexOf('duplicateAtomic.commit(') < ui.indexOf('duplicatePostCommit.run('));
  assert.doesNotMatch(core, /runTransaction\(|\bset\(|\bupdate\(|\blocalStorage\b|\bdocument\b|\bonValue\(/);
  assert.doesNotMatch(preview, /workspace-duplicate-cleanup-v546|firebase|app\.js/i);
  assert.equal((manifest.match(/"workspace-duplicate-cleanup-v546\.js"/g) || []).length, 2);
  const list = manifest.slice(manifest.indexOf('dynamicScripts:'));
  assert.ok(list.indexOf('"workspace-duplicate-cleanup-v546.js"') < list.indexOf('"duplicate-merge-v182.js"'));
});
