import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const clone = value => value === null || value === undefined ? value : JSON.parse(JSON.stringify(value));
const task = (id, overrides = {}) => ({
  id, title: '一括対象 ' + id, status: '対応中',
  assignee: '福冨', category: 'その他', priority: '中',
  revision: 1, updatedAt: 5000, completedAt: 0, completedMemo: '',
  dueDate: '', recurrence: 'none', recurrenceRule: {},
  comments: [{ id: 'comment-old', text: 'keep' }],
  checklist: [{ text: '確認', done: true }],
  history: [{ id: 'hist-old', text: '過去' }],
  ...overrides
});

function fixture({ initial, user = '福冨', openStatus = '未着手' } = {}) {
  const window = {}, source = read('workspace-bulk-update-v547.js');
  vm.runInNewContext(source, { window }, { filename: 'workspace-bulk-update-v547.js' });
  const shared = window.WorkBoardBulkUpdateV547;
  vm.runInNewContext(source, { window });
  assert.equal(window.WorkBoardBulkUpdateV547, shared, 'module must register once');
  const owner = shared.create({
    currentUser: () => user,
    defaultOpenStatus: () => openStatus
  });
  let stored = clone(initial ?? {
    a: task('a', { revision: 3 }),
    b: task('b', { revision: 5 }),
    untouched: task('untouched', { revision: 12, customAudit: 'unrelated' })
  });
  let failGet = false, failTransaction = false, aborted = false, nullAtFirst = false, key = 0;
  const calls = { paths: [], reads: 0, transactions: 0, rejected: 0, appendKeys: 0 };
  const api = {
    roomId: 'isolated-v547', db: {},
    ref(db, path) { assert.equal(db, this.db); calls.paths.push(path); return { path }; },
    async get(ref) {
      assert.equal(ref.path, 'rooms/isolated-v547/tasks');
      calls.reads++;
      if (failGet) throw new Error('get-offline');
      return { val: () => clone(stored) };
    },
    push(ref) {
      assert.equal(ref.path, 'rooms/isolated-v547/tasks');
      calls.appendKeys++;
      return { key: 'history-unique-' + (++key) };
    },
    async runTransaction(ref, apply, options) {
      assert.equal(ref.path, 'rooms/isolated-v547/tasks');
      assert.equal(options.applyLocally, false);
      calls.transactions++;
      if (failTransaction) throw new Error('transaction-offline');
      if (nullAtFirst) {
        const probe = apply(null);
        // The old implementation has no explicit null-probe handling;
        // the real warm-read prevents this path during normal operation.
        assert.equal(typeof probe, 'undefined');
      }
      const updated = apply(clone(stored));
      if (updated === undefined || aborted) {
        calls.rejected++;
        return { committed: false, snapshot: { val: () => clone(stored) } };
      }
      stored = clone(updated);
      return { committed: true, snapshot: { val: () => clone(stored) } };
    }
  };
  return {
    owner, shared, api, calls,
    get stored() { return clone(stored); },
    set stored(value) { stored = clone(value); },
    failGet(value = true) { failGet = value; },
    failTransaction(value = true) { failTransaction = value; },
    abort(value = true) { aborted = value; },
    nullProbe(value = true) { nullAtFirst = value; }
  };
}

test('Ver.547 preserves normalized revision behavior, immutable module registration and injected author', () => {
  const f = fixture();
  assert.equal(f.shared.normalizeRevision('5'), 5);
  assert.equal(f.shared.normalizeRevision(-1), 0);
  assert.equal(f.shared.normalizeRevision(1.5), 0);
  assert.equal(f.shared.normalizeRevision('not-a-number'), 0);
  assert.throws(() => f.shared.create({}), /dependencies/);
  assert.equal(f.owner.nextRecurringDueDate(task('x')), '');
});

test('Ver.547 multiple status updates commit atomically on tasks child, preserving all unrelated data', async () => {
  const f = fixture(), before = f.stored;
  const expected = await f.owner.commit(f.api, [before.a, before.b], 'status', '保留');
  assert.equal(expected.get('a'), 4);
  assert.equal(expected.get('b'), 6);
  assert.equal(f.stored.a.status, '保留');
  assert.equal(f.stored.b.status, '保留');
  assert.equal(f.stored.a.updatedBy, '福冨');
  assert.equal(f.stored.a.history.at(-1).text, '一括操作で状態を変更しました。');
  assert.equal(f.stored.a.lastChange.label, '状態変更');
  assert.deepEqual(f.stored.untouched, before.untouched);
  assert.equal(f.calls.reads, 1);
  assert.equal(f.calls.transactions, 1);
  assert.equal(f.calls.paths.every(path => path === 'rooms/isolated-v547/tasks'), true);
});

test('Ver.547 remote stale selected revision aborts entire batch without modifying either task', async () => {
  const f = fixture(), viewed = f.stored, server = f.stored;
  server.b.revision++;
  server.b.description = 'another-device-won';
  f.stored = server;
  await assert.rejects(f.owner.commit(f.api, [viewed.a, viewed.b], 'assignee', '森井'), /revision-or-relation-mismatch/);
  assert.equal(f.calls.rejected, 1);
  assert.deepEqual(f.stored, server);
  assert.equal(f.stored.a.assignee, '福冨');
});

test('Ver.547 explicit transaction abort and network/get failure do not imply committed write', async () => {
  const f = fixture(), before = f.stored;
  f.abort(true);
  await assert.rejects(f.owner.commit(f.api, [before.a], 'category', '用度'), /transaction-aborted-or-invariant-failure/);
  assert.deepEqual(f.stored, before);
  f.abort(false);
  f.failGet();
  await assert.rejects(f.owner.commit(f.api, [before.a], 'status', '保留'), /get-offline/);
  assert.equal(f.calls.transactions, 1);
  f.failGet(false);
  f.failTransaction();
  await assert.rejects(f.owner.commit(f.api, [before.a], 'status', '保留'), /transaction-offline/);
  assert.deepEqual(f.stored, before);
});

test('Ver.547 completion creates exactly one deterministic daily recurring child and preserves history', async () => {
  const original = task('daily', {
    dueDate: '2026-09-20', recurrence: 'daily', recurrenceRule: { interval: 1 },
    pinned: true, revision: 2, completedMemo: 'stale'
  });
  const f = fixture({ initial: { daily: original } });
  const expected = await f.owner.commit(f.api, [original], 'complete', '');
  assert.equal(expected.get('daily'), 3);
  const next = f.stored['rec-daily-2026-09-21'];
  assert.ok(next, 'next recurring child must exist');
  assert.equal(f.stored.daily.status, '完了');
  assert.equal(f.stored.daily.completedAt > 0, true);
  assert.equal(f.stored.daily.nextRecurringTaskId, next.id);
  assert.equal(next.status, '未着手');
  assert.equal(next.dueDate, '2026-09-21');
  assert.equal(next.revision, 1);
  assert.equal(next.recurringParentId, 'daily');
  assert.equal(next.operationId, next.id);
  assert.equal(next.comments.length, 0);
  assert.equal(next.checklist[0].done, false);
  assert.equal(next.pinned, false);
  assert.equal(next.history.at(-1).text.includes('定期タスクとして'), true);
  assert.equal(f.stored.daily.history.at(-1).text.includes('次回の定期タスクを作成'), true);
});

test('Ver.547 annual leap-day, monthly day, monthly nth weekday and weekly recurrence remain unchanged', () => {
  const f = fixture();
  const cases = [
    [task('yearly', { dueDate: '2024-02-29', recurrence: 'yearly' }), '2025-02-28'],
    [task('monthly', { dueDate: '2026-01-31', recurrence: 'monthlyDay', recurrenceRule: { interval: 1, monthDay: 31 } }), '2026-02-28'],
    [task('nth', { dueDate: '2026-10-05', recurrence: 'monthlyNth', recurrenceRule: { interval: 1, weekday: 1, nth: '2' } }), '2026-11-09'],
    [task('weekly', { dueDate: '2026-10-26', recurrence: 'weekly', recurrenceRule: { interval: 1, weekdays: [1, 3] } }), '2026-10-28']
  ];
  for (const [item, date] of cases) assert.equal(f.owner.nextRecurringDueDate(item), date);
});

test('Ver.547 existing recurring child with another parent prevents all writes', async () => {
  const parent = task('repeating', { dueDate: '2026-09-20', recurrence: 'daily' });
  const child = task('rec-repeating-2026-09-21', { dueDate: '2026-09-21', recurringParentId: 'other' });
  const f = fixture({ initial: { repeating: parent, [child.id]: child } }), before = f.stored;
  await assert.rejects(f.owner.commit(f.api, [parent], 'complete', ''), /revision-or-relation-mismatch/);
  assert.deepEqual(f.stored, before);
});

test('Ver.547 preexisting incompatible nextRecurringTaskId prevents child duplication', async () => {
  const parent = task('repeating', { dueDate: '2026-09-20', recurrence: 'daily', nextRecurringTaskId: 'rec-old' });
  const f = fixture({ initial: { repeating: parent } });
  await assert.rejects(f.owner.commit(f.api, [parent], 'complete', ''), /revision-or-relation-mismatch/);
  assert.equal(Object.keys(f.stored).length, 1);
});

test('Ver.547 repeating the same stale selected batch cannot append duplicate history or child', async () => {
  const parent = task('repeating', { dueDate: '2026-09-20', recurrence: 'daily' });
  const f = fixture({ initial: { repeating: parent } });
  await f.owner.commit(f.api, [parent], 'complete', '');
  const after = f.stored;
  await assert.rejects(f.owner.commit(f.api, [parent], 'complete', ''), /revision-or-relation-mismatch/);
  assert.deepEqual(f.stored, after);
  assert.equal(Object.keys(after).length, 2);
});

test('Ver.547 reopen resets completion metadata while keeping history and revision', async () => {
  const finished = task('reopen', { status: '完了', completedAt: 1000, completedMemo: 'closed', revision: 8 });
  const f = fixture({ initial: { reopen: finished } });
  const e = await f.owner.commit(f.api, [finished], 'status', '対応中');
  assert.equal(e.get('reopen'), 9);
  assert.equal(f.stored.reopen.completedAt, 0);
  assert.equal(f.stored.reopen.completedMemo, '');
  assert.equal(f.stored.reopen.status, '対応中');
  assert.equal(f.stored.reopen.history.length, 2);
});

test('Ver.547 writer and Classic UI share one owner while canonical delete remains untouched', () => {
  const writer = read('workspace-bulk-update-v547.js');
  const ui = read('bulk-actions-v243.js');
  const manifest = read('release-manifest.js');
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  const preview = read('modern/preview/index.html');
  assert.match(ui, /WorkBoardBulkUpdateV547\.create\(\{currentUser,defaultOpenStatus\}\)/);
  assert.match(ui, /sharedBulk\.commit\(api,selected,action,target\)/);
  assert.match(ui, /invokeCanonicalDelete\(api, id\)/);
  assert.match(ui, /const originalConfirm = window\.confirm/);
  assert.match(writer, /await api\.get\(tasksRef\)/);
  assert.match(writer, /api\.runTransaction\(tasksRef/);
  assert.match(writer, /normalizeRevision\(current\.revision\) !== normalizeRevision\(original\.revision\)/);
  assert.match(writer, /for \(const original of selected\) applyOneTask\(records, original, action, target, api\)/);
  assert.match(writer, /recurringParentId: original\.id/);
  assert.doesNotMatch(writer, /\blocalStorage\b|\bdocument\b|\bonValue\(|runTransaction\([^\n]*roomRef/);
  assert.doesNotMatch(ui, /api\.runTransaction\(tasksRef/);
  assert.doesNotMatch(preview, /workspace-bulk-update-v547|firebase|app\.js/i);
  assert.equal((manifest.match(/"workspace-bulk-update-v547\.js"/g) || []).length, 2);
  const scripts = manifest.slice(manifest.indexOf('dynamicScripts:'));
  assert.ok(scripts.indexOf('"workspace-bulk-update-v547.js"') < scripts.indexOf('"bulk-actions-v243.js"'));
  const group = inventory.groups.find(g => g.id === 'bulk-actions');
  assert.deepEqual(group.assets, ['workspace-bulk-update-v547.js', 'bulk-actions-v243.js']);
});
