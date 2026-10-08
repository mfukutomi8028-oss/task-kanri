import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const [source, manifest, responsibilityText] = await Promise.all([
  read('reminders-v152.js'), read('release-manifest.js'), read('patch-responsibilities.json')
]);

function boot({ time = '2026-10-08T10:00:00', offset = 300000 } = {}) {
  let now = new Date(time).getTime(), hidden = false, user = '福冨', timerId = 3000;
  const timers = new Map(), fired = [], events = new Map(), documentEvents = new Map();
  const reminders = { t1: { at: now + offset, note: '確認' } };
  const task = { title: '確認対象', status: 'open' };
  const taskMap = new Map([['t1', task]]);
  const W = {
    currentUser: () => user,
    taskMap: () => taskMap,
    remindersFor: () => reminders,
    reminderFor: id => reminders[id] || null,
    isCompleted: t => t.status === 'done',
    notify: message => fired.push(message),
    writeReminder: async () => ({ ok: true })
  };
  const NativeDate = Date;
  class Clock extends NativeDate {
    constructor(...args) { if (!args.length) super(now); else super(...args); }
    static now() { return now; }
  }
  const record = (map, name, cb) => map.set(name, [...(map.get(name) || []), cb]);
  const window = {
    WorkBoardWorkflowV152: W,
    Notification: class { static permission = 'default'; },
    addEventListener: (name, cb) => record(events, name, cb)
  };
  const document = {
    get hidden() { return hidden; },
    getElementById: () => null,
    addEventListener: (name, cb) => record(documentEvents, name, cb)
  };
  const context = vm.createContext({
    window, document, Date: Clock,
    requestAnimationFrame: cb => cb(),
    setInterval: () => { throw new Error('30-second polling must be retired'); },
    setTimeout: (callback, delay) => {
      const id = ++timerId; timers.set(id, { callback, delay }); return id;
    },
    clearTimeout: id => timers.delete(id),
    MutationObserver: class { observe() {} }
  });
  vm.runInContext(source, context, { filename: 'reminders-v152.js' });
  return {
    reminders, task, timers, fired,
    advance: ms => { now += ms; },
    setUser: v => { user = v; },
    emit: name => (events.get(name) || []).forEach(fn => fn()),
    focus: () => (events.get('focus') || []).forEach(fn => fn()),
    pageshow: () => (events.get('pageshow') || []).forEach(fn => fn()),
    visibility: value => { hidden = value; (documentEvents.get('visibilitychange') || []).forEach(fn => fn()); },
    tick: () => { const entry = timers.entries().next().value; if (!entry) return false; timers.delete(entry[0]); entry[1].callback(); return true; },
    expectedMidnight: () => { const d = new Date(now); d.setHours(24, 0, 0, 0); return d.getTime() - now; }
  };
}

test('Ver.363 owns exactly one reminder deadline timeout and notifies once', () => {
  const b = boot();
  assert.equal(b.timers.size, 1);
  assert.equal([...b.timers.values()][0].delay, 300000);
  assert.equal(b.fired.length, 0);
  b.advance(300000);
  assert.equal(b.tick(), true);
  assert.equal(b.fired.length, 1);
  assert.equal(b.timers.size, 1);
  assert.equal([...b.timers.values()][0].delay, b.expectedMidnight());
  b.emit('workflow-v150-update');
  b.focus();
  b.pageshow();
  assert.equal(b.timers.size, 1);
  assert.equal(b.fired.length, 1);
});

test('Ver.363 background retains timer; visible, focus, pageshow and reschedule stay idempotent', () => {
  const b = boot();
  b.visibility(true);
  assert.equal(b.timers.size, 1);
  b.visibility(false);
  b.focus(); b.pageshow(); b.emit('workflow-v152-update');
  assert.equal(b.timers.size, 1);
  b.reminders.t1 = { at: new Date('2026-10-08T10:02:00').getTime(), note: '変更' };
  b.emit('workflow-v152-update');
  assert.equal(b.timers.size, 1);
  assert.equal([...b.timers.values()][0].delay, 120000);
  b.advance(120000);
  b.tick();
  assert.equal(b.fired.length, 1);
  b.task.status = 'done';
  b.emit('workflow-v150-update');
  assert.equal(b.fired.length, 1);
});

test('Ver.363 handles local midnight and 24-hour remaining label boundary', () => {
  const midnight = boot({time:'2026-10-08T23:59:40', offset:120000});
  assert.equal(midnight.timers.size, 1);
  assert.equal([...midnight.timers.values()][0].delay, 20000);
  midnight.advance(20000); midnight.tick();
  assert.equal(midnight.fired.length, 0);
  assert.equal(midnight.timers.size, 1);
  assert.equal([...midnight.timers.values()][0].delay, 100000);

  const soon = boot({offset:25 * 3600000});
  assert.equal([...soon.timers.values()][0].delay, Math.min(3600000, soon.expectedMidnight()));
});

test('Ver.363 catches up overdue on focus and preserves user-scoped dedup', () => {
  const b = boot();
  b.advance(300001);
  b.focus();
  assert.equal(b.fired.length, 1);
  b.pageshow();
  assert.equal(b.fired.length, 1);
  b.setUser('土屋');b.emit('workflow-v150-update');
  assert.equal(b.fired.length, 2);
  b.reminders.t1 = { at: new Date('2026-10-08T10:04:00').getTime(), note: '別日時' };
  b.emit('workflow-v152-update');
  assert.equal(b.fired.length, 3);
  b.task.status = 'done';b.emit('workflow-v150-update');
  assert.equal(b.fired.length, 3);
});

test('Ver.363 release and one-shot contracts', () => {
  assert.doesNotMatch(source, /setInterval\(schedule,\s*30000\)/);
  assert.match(source, /function nextPersonalReminderBoundaryV363/);
  assert.match(source, /function armPersonalReminderV363/);
  assert.match(source, /Math\.min\(Math\.max\(1,next-now\),2147483647\)/);
  assert.match(source, /window\.addEventListener\('focus',schedule\)/);
  assert.match(source, /window\.addEventListener\('pageshow',schedule\)/);
  assert.match(source, /if\(!document\.hidden\)schedule\(\)/);
  assert.match(source, /badge\.textContent!==label/);
  assert.match(source, /article\.classList\.toggle\('is-due'/);
  assert.equal(manifest.match(/version:\s*"(\d+)"/)?.[1], '296');
  assert.equal(JSON.parse(responsibilityText).baselineRelease, '296');
});
