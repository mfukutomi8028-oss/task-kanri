import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('completion-unpin-v150.js');
const manifest = read('release-manifest.js');
const responsibilities = JSON.parse(read('patch-responsibilities.json'));

function boot({ mode = 'local-only', rows = [], remoteRows = rows } = {}) {
  let state = mode;
  const taskKey = 'system-task-tasks:audit-v365';
  const values = new Map([[taskKey, JSON.stringify(rows)]]);
  const localWrites = [], intervals = [], events = new Map(), transactions = [];
  let localReloads = 0, remoteCallback = null, pauseTransactions = false;
  const pendingTransactions = [];
  const remoteTasks = Object.fromEntries(remoteRows.map(row => [row.id, { ...row }]));
  const localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); localWrites.push({ key, value }); }
  };
  const remote = {
    db: {},
    ref: (_db, path) => ({ path }),
    onValue: (_ref, callback) => { remoteCallback = callback; },
    runTransaction: (ref, updater, options) => {
      transactions.push({ path: ref.path, options });
      const commit = () => {
        const id = ref.path.split('/').at(-1);
        const next = updater(remoteTasks[id] ?? null);
        if (next !== undefined) remoteTasks[id] = next;
        return { committed: next !== undefined };
      };
      if (pauseTransactions) return new Promise(resolve => pendingTransactions.push(() => resolve(commit())));
      return Promise.resolve(commit());
    }
  };
  const W = {
    ROOM_ID: 'audit-v365',
    taskKey,
    dependencyState: () => state,
    tasks: () => JSON.parse(values.get(taskKey) || '[]'),
    ensureRemote: async () => mode === 'remote' ? remote : null
  };
  const window = {
    WorkBoardWorkflowV150: W,
    loadLocalTasks: () => { localReloads++; },
    addEventListener: (name, callback) => events.set(name, [...(events.get(name) || []), callback])
  };
  vm.runInNewContext(source, {
    window, localStorage,
    setInterval: (callback, delay) => { intervals.push({ callback, delay }); return intervals.length; },
    console: { warn() {} }
  }, { filename: 'completion-unpin-v150.js' });
  return {
    intervals, localWrites, transactions, remoteTasks,
    localRows: () => JSON.parse(values.get(taskKey)),
    setRows: rows => values.set(taskKey, JSON.stringify(rows)),
    reloads: () => localReloads,
    state: value => { state = value; },
    tick: () => { for (const timer of intervals) timer.callback(); },
    emit: name => { for (const callback of events.get(name) || []) callback(); },
    snapshot: rows => {
      assert.equal(typeof remoteCallback, 'function', 'remote subscription should be bound');
      remoteCallback({ val: () => Object.fromEntries(rows.map(row => [row.id, row])) });
    },
    pause: value => { pauseTransactions = value; },
    release: () => { for (const next of pendingTransactions.splice(0)) next(); },
    flush: async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); }
  };
}

test('Ver.365 local-only startup repairs only completed pinned tasks and owns a single 1500ms fallback', async () => {
  const b = boot({ rows: [
    { id: 'done', status: '完了', pinned: true, revision: 4 },
    { id: 'open', status: '未着手', pinned: true, revision: 8 },
    { id: 'unpinned', status: '完了', pinned: false, revision: 9 }
  ] });
  await b.flush();
  assert.equal(b.intervals.length, 1);
  assert.equal(b.intervals[0].delay, 1500);
  assert.equal(b.localRows().find(t => t.id === 'done').pinned, false);
  assert.equal(b.localRows().find(t => t.id === 'done').revision, 5);
  assert.equal(b.localRows().find(t => t.id === 'open').pinned, true);
  assert.equal(b.localRows().find(t => t.id === 'unpinned').revision, 9);
  assert.equal(b.localWrites.length, 1);
  assert.equal(b.reloads(), 1);
  assert.equal(b.transactions.length, 0);
});

test('Ver.365 local-only timer catches direct task-cache changes absent workflow events; workflow event also repairs immediately', async () => {
  const b = boot({ rows: [{ id: 'task', status: '未着手', pinned: true, revision: 1 }] });
  await b.flush();
  b.setRows([{ id: 'task', status: '完了', pinned: true, revision: 1 }]);
  assert.equal(b.localRows()[0].pinned, true);
  b.tick();
  assert.equal(b.localRows()[0].pinned, false);
  assert.equal(b.localRows()[0].revision, 2);
  b.tick();
  assert.equal(b.localWrites.length, 1, 'repeated ticks must be idempotent');
  b.setRows([{ id: 'task', status: '完了', pinned: true, revision: 6 }]);
  b.emit('workflow-v150-update');
  assert.equal(b.localRows()[0].revision, 7);
  assert.equal(b.localRows()[0].pinned, false);
  assert.equal(b.localWrites.length, 2);
  assert.equal(b.intervals.length, 1, 'workflow events never spawn duplicate intervals');
});

test('Ver.365 remote mode uses onValue and guarded transactions without the local polling interval', async () => {
  const completed = { id: 'done', status: '完了', pinned: true, revision: 3 };
  const open = { id: 'open', status: '未着手', pinned: true, revision: 5 };
  const b = boot({ mode: 'remote', rows: [completed], remoteRows: [completed, open] });
  await b.flush();
  assert.equal(b.intervals.length, 0);
  b.snapshot([completed, open]);
  await b.flush();
  assert.equal(b.transactions.length, 1);
  assert.equal(b.transactions[0].path, 'rooms/audit-v365/tasks/done');
  assert.equal(b.transactions[0].options.applyLocally, false);
  assert.equal(b.remoteTasks.done.pinned, false);
  assert.equal(b.remoteTasks.done.revision, 4);
  assert.equal(b.remoteTasks.open.pinned, true);
  assert.equal(b.localWrites.length, 0, 'remote path must not write the task cache');
});

test('Ver.365 remote repair rechecks latest transaction state and suppresses overlapping snapshots', async () => {
  const stale = { id: 'stale', status: '完了', pinned: true, revision: 1 };
  const changed = { ...stale, status: '未着手', revision: 2 };
  const b = boot({ mode: 'remote', remoteRows: [changed] });
  await b.flush();
  b.snapshot([stale]);
  await b.flush();
  assert.equal(b.transactions.length, 1);
  assert.equal(b.remoteTasks.stale.status, '未着手');
  assert.equal(b.remoteTasks.stale.pinned, true, 'stale snapshot must not undo a reopened task');

  const fresh = { id: 'fresh', status: '完了', pinned: true, revision: 10 };
  const c = boot({ mode: 'remote', remoteRows: [fresh] });
  await c.flush();
  c.pause(true);
  c.snapshot([fresh]);
  c.snapshot([fresh]);
  assert.equal(c.transactions.length, 1, 'same task is inFlight until transaction settles');
  c.release();
  await c.flush();
  assert.equal(c.remoteTasks.fresh.pinned, false);
  assert.equal(c.remoteTasks.fresh.revision, 11);
});

test('Ver.365 notes that an already-started local-only interval stays allocated after a synthetic state transition', async () => {
  const b = boot();
  await b.flush();
  assert.equal(b.intervals.length, 1);
  b.state('ready');
  b.setRows([{ id: 'late', status: '完了', pinned: true, revision: 1 }]);
  b.tick();
  assert.equal(b.localRows()[0].pinned, true, 'local writer must be gated when no longer local-only');
  assert.equal(b.intervals.length, 1, 'existing timer is not cancelled by the current implementation');
  assert.equal(b.localWrites.length, 0);
});

test('Ver.365 remains release-neutral and preserves the Ver.330 browser regression contract', () => {
  const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1]);
  assert.equal(release, 296);
  assert.equal(String(responsibilities.baselineRelease), String(release));
  assert.match(source, /remote\.runTransaction\(target,current=>/);
  assert.match(read('tests/completion-unpin-polling-audit-v330.spec.mjs'), /setInterval/);
  assert.match(read('workflow-core-v150.js'), /if\(!initPromise\)initPromise=initFirebase\(\)/);
});
