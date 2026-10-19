import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

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
    requestAnimationFrame: cb => { if (!hidden) cb(); },
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


test('Ver.363 delivers deadline and re-arms while hidden when animation frames are suspended', () => {
  const b = boot();
  b.visibility(true);
  b.advance(300000);
  assert.equal(b.tick(), true);
  assert.equal(b.fired.length, 1, 'background deadline must not depend on rAF');
  assert.equal(b.timers.size, 1, 'background timer must re-arm');

  b.reminders.t1 = { at: new Date('2026-10-08T10:06:00').getTime(), note: 'background update' };
  b.emit('workflow-v152-update');
  assert.equal([...b.timers.values()][0].delay, 60000, 'background workflow update must re-arm earlier deadline');
  b.advance(60000);
  b.tick();
  assert.equal(b.fired.length, 2, 'updated reminder must fire in background');
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
  const release = Number(manifest.match(/version:\s*"(\d+)"/)?.[1]);
  assert.ok(release >= 296, 'Ver.363 remains valid after later releases');
  assert.equal(JSON.parse(responsibilityText).baselineRelease, String(release));
});

// Ver.502: retain every Ver.362 audit test and its isolated legacy clock fixture unchanged.
{
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const [source, manifest, responsibilitiesText] = await Promise.all([
  read('reminders-v152.js'),
  read('release-manifest.js'),
  read('patch-responsibilities.json')
]);

test('Ver.362 audit: polling currently owns time-arrival, not remote collection sync', () => {
  const interval = source.match(/setInterval\(schedule,\s*(\d+)\)/);
  console.log('V362_PERSONAL_REMINDER_INTERVAL', interval ? Number(interval[1]) : 'retired');
  if (interval) assert.equal(Number(interval[1]), 30000);
  assert.match(source, /function notifyDue\(\)/);
  assert.match(source, /Number\(item\.at\)>now/);
  assert.match(source, /const key=[^;]+item\.at/);
  assert.match(source, /if\(notified\.has\(key\)\)continue/);
  assert.match(source, /function dueItems\(\)/);
  assert.match(source, /end\.setHours\(23,59,59,999\)/);
  assert.match(source, /function patchToday\(\)/);
  assert.match(source, /function stateLabel\(item\)/);
});

test('Ver.362 audit: existing update, completion, identity, observer and notification contracts', () => {
  for (const event of ['workflow-v152-update', 'workflow-v150-update']) {
    assert.ok(source.includes("'" + event + "'"), event + ' must remain wired');
  }
  assert.match(source, /new MutationObserver\(/);
  assert.match(source, /requestAnimationFrame\(\(\)=>\{scheduled=false;patch\(\)\}\)/);
  assert.match(source, /if\(user!==lastUser\)\{lastUser=user;notified=new Set\(\)\}/);
  assert.match(source, /clearCompleted\(\);patchDetail\(\);patchToday\(\);notifyDue\(\)/);
  assert.match(source, /W\.isCompleted\(task\)/);
  assert.match(source, /new Notification\(/);
  assert.match(source, /W\.writeReminder\(/);
});

function boot() {
  let now = Date.parse('2026-10-08T01:00:00Z');
  let user = '福冨';
  const task = { title: '実動作監査', status: 'open' };
  const items = { 'task-1': { at: now + 60000, note: '確認事項' } };
  const events = new Map();
  const intervals = [];
  const timers = new Map();
  let nextId = 0;
  const toasts = [];
  const desktopNotifications = [];
  const taskMap = new Map([['task-1', task]]);
  const W = {
    currentUser: () => user,
    taskMap: () => taskMap,
    remindersFor: () => items,
    reminderFor: id => items[id] || null,
    isCompleted: t => t.status === 'done',
    notify: message => toasts.push(message),
    writeReminder: async () => ({ ok: true })
  };
  const NativeDate = Date;
  class AuditDate extends NativeDate {
    constructor(...args) { if (args.length) super(...args); else super(now); }
    static now() { return now; }
  }
  class MockNotification {
    static permission = 'granted';
    constructor(title, options) { desktopNotifications.push({ title, body: options.body }); }
  }
  const window = {
    WorkBoardWorkflowV152: W,
    Notification: MockNotification,
    addEventListener: (name, callback) => {
      const listeners = events.get(name) || [];
      listeners.push(callback);
      events.set(name, listeners);
    }
  };
  const context = vm.createContext({
    window,
    document: { getElementById: () => null, hidden: false, addEventListener: () => {} },
    Date: AuditDate,
    Notification: MockNotification,
    requestAnimationFrame: callback => callback(),
    setInterval: (callback, delay) => { intervals.push({ callback, delay }); return intervals.length; },
    setTimeout: (callback, delay) => { const id=++nextId;timers.set(id,{callback,delay});return id; },
    clearTimeout: id => timers.delete(id),
    MutationObserver: class { observe() {} }
  });
  vm.runInContext(source, context, { filename: 'reminders-v152.js' });
  return {
    task, items, toasts, desktopNotifications, intervals, timers,
    advance: milliseconds => { now += milliseconds; },
    setUser: value => { user = value; },
    emit: name => { for (const fn of events.get(name) || []) fn(); }
  };
}

test('Ver.362 isolated runtime: clock wake, duplicate protection, reschedule, identity, completion', () => {
  const runtime = boot();
  assert.equal(runtime.toasts.length, 0, 'future reminder must not notify early');
  assert.ok(runtime.intervals.length <= 1, 'current owner must not multiply intervals');
  if (runtime.intervals.length) assert.equal(runtime.intervals[0].delay, 30000);
  runtime.advance(60001);
  if (runtime.intervals.length) runtime.intervals[0].callback();
  else runtime.emit('workflow-v152-update'); // future one-shot releases still retain event catch-up
  assert.equal(runtime.toasts.length, 1);
  assert.equal(runtime.desktopNotifications.length, 1);
  runtime.emit('workflow-v150-update');
  assert.equal(runtime.toasts.length, 1, 'same id/time must not notify twice');
  runtime.items['task-1'] = { at: Date.parse('2026-10-08T01:00:01Z'), note: '再設定' };
  runtime.emit('workflow-v152-update');
  assert.equal(runtime.toasts.length, 2, 'new reminder timestamp must notify');
  runtime.setUser('土屋');
  runtime.emit('workflow-v152-update');
  assert.equal(runtime.toasts.length, 3, 'per-user notification ownership resets');
  runtime.task.status = 'done';
  runtime.emit('workflow-v152-update');
  assert.equal(runtime.toasts.length, 3, 'completed task cannot produce another toast');
});

test('Ver.362 audit remains release-neutral while baseline stays synchronized', () => {
  const version = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1]);
  const baseline = Number(JSON.parse(responsibilitiesText).baselineRelease);
  assert.ok(version >= 295);
  assert.equal(baseline, version);
});
}

test('Ver.502 retired Ver.362 personal reminder Protocol remains absent', () => {
  assert.equal(existsSync(new URL('./personal-reminder-polling-v362.test.mjs', import.meta.url)), false);
});
