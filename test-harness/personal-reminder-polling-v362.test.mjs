import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

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
