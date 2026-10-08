import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../archive-ui-v182.js', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../release-manifest.js', import.meta.url), 'utf8');
const responsibilities = JSON.parse(readFileSync(new URL('../patch-responsibilities.json', import.meta.url), 'utf8'));
const DAY = 86400000;
const INITIAL_NOW = Date.parse('2026-10-08T00:00:00Z');

function boot(rows = []) {
  let now = INITIAL_NOW;
  const tasks = new Map(rows.map(row => [row.id, { ...row }]));
  const archives = {};
  const duplicates = {};
  const writes = [];
  const timeouts = [];
  const intervals = [];
  const listeners = new Map();
  const on = (name, callback) => listeners.set(name, [...(listeners.get(name) || []), callback]);
  const noOp = () => {};
  const element = () => ({
    isConnected: false,
    classList: { add: noOp, remove: noOp, contains: () => false, toggle: noOp },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: noOp,
    appendChild: noOp
  });
  const document = {
    body: { appendChild: node => { node.isConnected = true; }, classList: { add: noOp, remove: noOp } },
    createElement: element,
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener: noOp
  };
  const W = {
    v152: { archives, duplicates },
    taskMap: () => tasks,
    isCompleted: task => task.status === 'done',
    isArchived: id => Boolean(archives[id]),
    duplicateOf: id => duplicates[id] || null,
    archiveTask: async (id, reason) => {
      writes.push({ id, reason });
      archives[id] = { archivedAt: now, reason };
      return { ok: true };
    }
  };
  class ClockDate extends Date {
    constructor(...args) { if (args.length) super(...args); else super(now); }
    static now() { return now; }
  }
  const window = { WorkBoardWorkflowV152: W, addEventListener: on };
  const sandbox = {
    window, document, Date: ClockDate,
    MutationObserver: class { observe() {} },
    requestAnimationFrame: callback => { callback(); return 1; },
    setTimeout: (callback, delay) => { timeouts.push({ callback, delay }); return timeouts.length; },
    setInterval: (callback, delay) => { intervals.push({ callback, delay }); return intervals.length; }
  };
  vm.runInNewContext(source, sandbox, { filename: 'archive-ui-v182.js' });
  return {
    tasks, archives, duplicates, writes, timeouts, intervals, window,
    setNow: value => { now = value; },
    advance: ms => { now += ms; },
    emit: name => (listeners.get(name) || []).forEach(callback => callback()),
    startup: async () => timeouts[0].callback(),
    periodic: async () => intervals[0].callback()
  };
}

test('Ver.364: active archive owner retains one delayed startup and one six-hour interval', () => {
  const runtime = boot();
  assert.equal(runtime.timeouts.length, 1);
  assert.equal(runtime.timeouts[0].delay, 2500);
  assert.equal(runtime.intervals.length, 1);
  assert.equal(runtime.intervals[0].delay, 6 * 60 * 60 * 1000);
  assert.equal(typeof runtime.window.WorkBoardArchiveV182.renderAll, 'function');
  for (let i = 0; i < 3; i++) runtime.emit('workflow-v152-update');
  assert.equal(runtime.intervals.length, 1, 'update event must not duplicate periodic owner');
  assert.equal(runtime.writes.length, 0, 'ordinary UI refresh must not auto-write archives');
});

test('Ver.364: real autoArchive enforces strict 90-day threshold and exclusions', async () => {
  const cutoff = INITIAL_NOW - 90 * DAY;
  const runtime = boot([
    { id: 'eligible', status: 'done', completedAt: cutoff - 1 },
    { id: 'equal-cutoff', status: 'done', completedAt: cutoff },
    { id: 'inside-window', status: 'done', completedAt: cutoff + 1 },
    { id: 'open', status: 'open', completedAt: cutoff - 1 },
    { id: 'no-date', status: 'done', completedAt: 0 },
    { id: 'archived', status: 'done', completedAt: cutoff - 1 },
    { id: 'duplicate', status: 'done', completedAt: cutoff - 1 }
  ]);
  runtime.archives.archived = { archivedAt: INITIAL_NOW - DAY };
  runtime.duplicates.duplicate = { targetId: 'eligible' };
  await runtime.startup();
  assert.deepEqual(runtime.writes, [{ id: 'eligible', reason: 'auto' }]);
  await runtime.periodic();
  assert.equal(runtime.writes.length, 1, 'archived IDs must be excluded on later passes');
});

test('Ver.364: 20-record throttle preserves backlog across later timer passes', async () => {
  const runtime = boot(Array.from({ length: 25 }, (_, n) => ({
    id: 'done-' + n,
    status: 'done',
    completedAt: INITIAL_NOW - 91 * DAY
  })));
  await runtime.startup();
  assert.equal(runtime.writes.length, 20);
  assert.equal(new Set(runtime.writes.map(write => write.id)).size, 20);
  await runtime.periodic();
  assert.equal(runtime.writes.length, 25);
  assert.equal(new Set(runtime.writes.map(write => write.id)).size, 25);
  assert.ok(runtime.writes.every(write => write.reason === 'auto'));
});

test('Ver.364: update event does not replace clock arrival for a newly eligible task', async () => {
  const runtime = boot([{ id: 'aged-task', status: 'done', completedAt: INITIAL_NOW - DAY }]);
  await runtime.startup();
  assert.equal(runtime.writes.length, 0);
  runtime.advance(90 * DAY);
  runtime.emit('workflow-v152-update');
  assert.equal(runtime.writes.length, 0, 'current update event is UI-only, not an archive scan');
  await runtime.periodic();
  assert.deepEqual(runtime.writes, [{ id: 'aged-task', reason: 'auto' }]);
});

test('Ver.364: audit is release-neutral and does not bypass canonical archive writes', () => {
  const version = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1]);
  assert.ok(version >= 296);
  assert.equal(String(responsibilities.baselineRelease), String(version));
  assert.match(source, /await W\.archiveTask\(task\.id,'auto'\)/);
  assert.doesNotMatch(source, /firebase\.database|runTransaction|\.set\(roomRef/);
});
