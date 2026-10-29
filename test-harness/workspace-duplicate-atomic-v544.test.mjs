import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const clone = value => value === null || value === undefined ? value : JSON.parse(JSON.stringify(value));
function task(id, revision = 1) {
  return {
    id, title: '題名:' + id, description: '本文:' + id,
    revision, status: '対応中', pinned: true, tags: ['共通', id],
    comments: [{ id: 'comment-' + id, author: '福冨', text: id }],
    checklist: [{ text: id, checked: false }], history: []
  };
}
function harness({ cold = false, roomMissing = false } = {}) {
  const window = {};
  const code = read('workspace-duplicate-atomic-v544.js');
  vm.runInNewContext(code, { window }, { filename: 'workspace-duplicate-atomic-v544.js' });
  const api = window.WorkBoardDuplicateAtomicV544;
  vm.runInNewContext(code, { window });
  assert.equal(window.WorkBoardDuplicateAtomicV544, api, 'module must register only once');
  let stored = roomMissing ? null : {
    tasks: { source: task('source'), target: task('target'), untouched: task('untouched') },
    workflowV152: { duplicates: {}, archives: {}, inbox: { 福冨: { event: { taskId: 'source', readAt: 42 } } } },
    meta: { users: ['福冨', '森井'] }, unrelated: { version: 3 }
  };
  let transactionError = null, corruptSnapshot = false;
  const calls = { paths: [], probes: [], committed: 0, aborted: 0 };
  const remote = {
    db: {},
    ref(db, path) { assert.equal(db, this.db); return { path }; },
    async runTransaction(ref, updater, options) {
      assert.equal(options?.applyLocally, false);
      calls.paths.push(ref.path);
      if (transactionError) throw transactionError;
      if (cold) {
        const probe = updater(null);
        calls.probes.push(probe);
        assert.equal(probe, null, 'cold cache null probe must not fabricate a room');
      }
      const next = updater(clone(stored));
      if (next === undefined) {
        calls.aborted++;
        return { committed: false, snapshot: { val: () => clone(stored) } };
      }
      stored = clone(next);
      calls.committed++;
      if (corruptSnapshot) {
        const broken = clone(stored);
        if (broken?.tasks?.target) broken.tasks.target.revision = 99;
        return { committed: true, snapshot: { val: () => broken } };
      }
      return { committed: true, snapshot: { val: () => clone(stored) } };
    }
  };
  const writer = api.create({ roomId: 'room-v544' });
  const options = ({ source = 'source', target = 'target', sourceRev = 1, targetRev = 1 } = {}) => ({
    remote, source, target, expectedSourceRevision: sourceRev,
    expectedTargetRevision: targetRev, now: 123456, me: '福冨'
  });
  return {
    api, writer, calls, remote, options,
    get room() { return clone(stored); },
    set room(v) { stored = clone(v); },
    setError(v) { transactionError = v; },
    corrupt() { corruptSnapshot = true; }
  };
}

test('Ver.544 atomically merges both task records, workflow metadata and retains unrelated room fields', async () => {
  const h = harness();
  const before = h.room;
  const result = await h.writer.commit(h.options());
  assert.equal(result.ok, true);
  assert.equal(h.calls.committed, 1);
  assert.deepEqual(h.calls.paths, ['rooms/room-v544']);
  const room = h.room;
  assert.equal(room.tasks.source.revision, 2);
  assert.equal(room.tasks.target.revision, 2);
  assert.equal(room.tasks.source.status, '完了');
  assert.equal(room.tasks.source.pinned, false);
  assert.equal(room.tasks.source.duplicateOf, 'target');
  assert.equal(room.tasks.source.completedAt, 123456);
  assert.equal(room.tasks.target.description.includes('【重複タスク'), true);
  assert.equal(room.tasks.target.comments.length, 2);
  assert.equal(room.tasks.target.checklist.length, 2);
  assert.equal(room.tasks.target.history.length, 1);
  assert.equal(room.workflowV152.duplicates.source.targetId, 'target');
  assert.equal(room.workflowV152.archives.source.reason, 'duplicate');
  assert.equal(room.workflowV152.archives.source.archivedBy, '福冨');
  assert.deepEqual(room.tasks.untouched, before.tasks.untouched);
  assert.deepEqual(room.meta, before.meta);
  assert.deepEqual(room.unrelated, before.unrelated);
  assert.deepEqual(room.workflowV152.inbox, before.workflowV152.inbox);
});

test('Ver.544 rejects a stale target revision and keeps remote winner and all workflow metadata intact', async () => {
  const h = harness();
  const before = h.room;
  before.tasks.target.revision = 2;
  before.tasks.target.description = 'REMOTE WINNER';
  h.room = before;
  const result = await h.writer.commit(h.options());
  assert.equal(result.ok, false);
  assert.equal(result.conflict, true);
  assert.equal(result.reason, 'revision');
  assert.equal(h.calls.committed, 0);
  assert.equal(h.calls.aborted, 1);
  assert.equal(h.room.tasks.target.description, 'REMOTE WINNER');
  assert.equal(h.room.tasks.source.revision, 1);
  assert.deepEqual(h.room.workflowV152.duplicates, {});
  assert.deepEqual(h.room.workflowV152.archives, {});
});

test('Ver.544 rejects stale source revision without changing target task', async () => {
  const h = harness();
  const value = h.room;
  value.tasks.source.revision = 5;
  value.tasks.source.title = '別端末更新';
  h.room = value;
  const result = await h.writer.commit(h.options());
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'revision');
  assert.equal(h.room.tasks.source.title, '別端末更新');
  assert.equal(h.room.tasks.target.revision, 1);
});

test('Ver.544 protects source and target independently from preexisting archives or duplicate links', async () => {
  for (const key of ['source', 'target']) {
    for (const type of ['duplicates', 'archives']) {
      const h = harness();
      const room = h.room;
      room.workflowV152[type][key] = type === 'duplicates' ? { targetId: 'other' } : { archivedAt: 11 };
      h.room = room;
      const result = await h.writer.commit(h.options());
      assert.equal(result.ok, false, key + ':' + type);
      assert.equal(result.reason, 'workflow');
      assert.equal(h.calls.committed, 0);
      assert.equal(h.room.tasks.source.revision, 1);
      assert.equal(h.room.tasks.target.revision, 1);
    }
  }
});

test('Ver.544 aborts missing source or target with no partial task or workflow writes', async () => {
  for (const missing of ['source', 'target']) {
    const h = harness();
    const room = h.room;
    delete room.tasks[missing];
    h.room = room;
    const result = await h.writer.commit(h.options());
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing');
    assert.equal(h.calls.committed, 0);
    assert.deepEqual(h.room.workflowV152.duplicates, {});
    assert.deepEqual(h.room.workflowV152.archives, {});
  }
});

test('Ver.544 accepts a cold Firebase null probe but verifies actual authoritative room snapshot', async () => {
  const h = harness({ cold: true });
  assert.equal((await h.writer.commit(h.options())).ok, true);
  assert.equal(h.calls.probes.length, 1);
  assert.equal(h.calls.committed, 1);
  const empty = harness({ cold: true, roomMissing: true });
  const result = await empty.writer.commit(empty.options());
  assert.equal(result.ok, false);
  assert.equal(result.conflict, true);
  assert.equal(result.reason, 'missing');
});

test('Ver.544 rejects corrupt post-commit acknowledgement instead of falsely claiming success', async () => {
  const h = harness();
  h.corrupt();
  await assert.rejects(h.writer.commit(h.options()), /統合結果を共同データで確認できませんでした/);
});

test('Ver.544 rejects transaction failure and leaves remote records unchanged', async () => {
  const h = harness(), before = h.room;
  h.setError(new Error('network-down'));
  await assert.rejects(h.writer.commit(h.options()), /network-down/);
  assert.deepEqual(h.room, before);
  assert.equal(h.calls.committed, 0);
});

test('Ver.544 two clients using the same old revisions converge with one winner', async () => {
  const h = harness();
  const first = await h.writer.commit(h.options());
  assert.equal(first.ok, true);
  const second = await h.writer.commit(h.options());
  assert.equal(second.ok, false);
  assert.equal(second.conflict, true);
  assert.equal(second.reason, 'revision');
  assert.equal(h.calls.committed, 1);
  assert.equal(h.room.tasks.source.revision, 2);
  assert.equal(h.room.tasks.target.revision, 2);
});

test('Ver.544 preserves existing text, tag, comment, checklist and history limits', () => {
  const h = harness();
  const source = task('source'), target = task('target');
  source.description = '追記';
  target.description = '既存本文';
  source.tags = ['共通', '別タグ'];
  target.tags = ['共通'];
  source.comments = Array.from({ length: 270 }, (_, i) => ({ id: 'source-c-' + i }));
  target.comments = Array.from({ length: 250 }, (_, i) => ({ id: 'c-' + i }));
  source.checklist = Array.from({ length: 140 }, (_, i) => ({ text: 'item-' + i }));
  target.checklist = [{ text: ' item-0 ' }];
  target.history = Array.from({ length: 90 }, (_, i) => ({ id: 'history-' + i }));
  const next = h.api.buildMergedRecords(source, target, 'source', 'target', 123456, '福冨');
  assert.equal(next.targetNext.description.includes('追記'), true);
  assert.equal(next.targetNext.tags.length, 2);
  assert.equal(next.targetNext.comments.length, 300);
  assert.equal(next.targetNext.checklist.length, 120);
  assert.equal(next.targetNext.history.length, 80);
  assert.equal(next.targetNext.revision, 2);
  assert.equal(next.sourceNext.revision, 2);
  assert.equal(next.sourceNext.status, '完了');
});

test('Ver.544 Classic keeps dependency guard, user confirmation and separate post-commit cleanup', () => {
  const ui = read('duplicate-merge-v182.js');
  const module = read('workspace-duplicate-atomic-v544.js');
  const manifest = read('release-manifest.js');
  const preview = read('modern/preview/index.html');
  assert.match(ui, /window\.WorkBoardDuplicateAtomicV544\.create\(/);
  assert.match(ui, /duplicateAtomic\.commit\(\{remote:r,source,target,expectedSourceRevision,expectedTargetRevision,now,me\}\)/);
  assert.match(ui, /dependencyUse\(source\)/);
  assert.match(ui, /if\(!confirm\(/);
  const committed = ui.indexOf('await duplicateAtomic.commit(');
  const cache = ui.indexOf('syncDuplicateCache(source,target,now,me);', committed);
  const relations = ui.indexOf('W.writeRelations(', cache);
  const reminder = ui.indexOf('W.writeReminder?.(source,null)', relations);
  assert.ok(committed >= 0 && cache > committed && relations > cache && reminder > relations);
  assert.doesNotMatch(module, /\bwindow\.addEventListener|\bquerySelector|\blocalStorage\b|\bonValue\(/);
  assert.doesNotMatch(preview, /workspace-duplicate-atomic-v544|firebase|app\.js/i);
  assert.equal((manifest.match(/"workspace-duplicate-atomic-v544\.js"/g) || []).length, 2);
  const scripts = manifest.slice(manifest.indexOf('dynamicScripts:'));
  assert.ok(scripts.indexOf('"workspace-duplicate-atomic-v544.js"') < scripts.indexOf('"duplicate-merge-v182.js"'));
});
