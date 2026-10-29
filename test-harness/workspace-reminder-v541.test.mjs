import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function harness(initialMode = 'local-only') {
  let mode = initialMode, fail = false, abort = false;
  const state = { reminders: {} };
  const remoteRecords = new Map();
  const activity = { applied: [], notifications: [], logs: [], transactions: [], remoteAttempts: 0 };
  const window = {};
  const code = read('workspace-reminder-v541.js');
  vm.runInNewContext(code, { window }, { filename: 'workspace-reminder-v541.js' });
  const api = window.WorkBoardReminderPersistenceV541;
  vm.runInNewContext(code, { window });
  assert.equal(api, window.WorkBoardReminderPersistenceV541, 'single module registration');
  const path = (user, id) => 'rooms/room-v541/workflowV148/reminders/' + user + '/' + id;
  const firebase = {
    db: {},
    ref(db, at) { assert.equal(db, firebase.db); return { path: at }; },
    async runTransaction(target, updater, options) {
      assert.equal(options.applyLocally, false);
      if (fail) throw new Error('network-dropped');
      const before = remoteRecords.get(target.path) || null;
      const after = updater(before);
      activity.transactions.push({ path: target.path, before, after });
      if (abort || after === undefined) return { committed: false, snapshot: { val: () => before } };
      if (after === null) remoteRecords.delete(target.path);
      else remoteRecords.set(target.path, after);
      return { committed: true, snapshot: { val: () => after } };
    }
  };
  const writer = api.create({
    roomId: 'room-v541',
    getReminders: () => state.reminders,
    ensureRemote: async () => { activity.remoteAttempts++; return mode === 'remote-online' ? firebase : null; },
    getDependencyState: () => mode,
    applyLocal(user, id, value) {
      const next = api.normalizeReminderValue(value);
      state.reminders[user] ||= {};
      if (next) state.reminders[user][id] = next;
      else delete state.reminders[user][id];
      if (!Object.keys(state.reminders[user]).length) delete state.reminders[user];
      activity.applied.push([user, id, next && JSON.parse(JSON.stringify(next))]);
    },
    notify: (...args) => activity.notifications.push(args),
    log: (...args) => activity.logs.push(args)
  });
  return {
    api, writer, state, remoteRecords, activity, path,
    setMode(m) { mode = m; }, fail(flag = true) { fail = flag; },
    abort(flag = true) { abort = flag; }
  };
}

test('Ver.541 reminder normalizer preserves note limit and strict expected-base fields', () => {
  const { api } = harness();
  assert.equal(api.normalizeReminderValue(null), null);
  assert.equal(api.normalizeReminderValue({ at: 0 }), null);
  assert.equal(api.normalizeReminderValue({ at: 'bad' }), null);
  assert.equal(api.normalizeReminderValue({ at: 1, note: 'x'.repeat(250) }).note.length, 240);
  assert.equal(api.normalizeReminderValue({ at: '23', updatedAt: '7' }).updatedAt, 7);
  assert.equal(api.sameReminderValue(null, undefined), true);
  assert.equal(api.sameReminderValue({ at: 23, updatedAt: 7, note: 'a' },
    { at: '23', updatedAt: 7, note: 'a' }), true);
  assert.equal(api.sameReminderValue({ at: 23, updatedAt: 7, note: 'a' },
    { at: 23, updatedAt: 8, note: 'a' }), false);
});

test('Ver.541 local-only save/clear preserves per-user records and canonical event owner', async () => {
  const h = harness();
  const first = await h.writer.write('task-a', { at: 812345, note: 'x'.repeat(280) }, 'user-a');
  assert.equal(first.ok, true); assert.equal(first.localOnly, true);
  assert.equal(h.state.reminders['user-a']['task-a'].note.length, 240);
  assert.ok(h.state.reminders['user-a']['task-a'].updatedAt > 0);
  const second = await h.writer.write('task-a', { at: 812346, note: '別ユーザー' }, 'user-b');
  assert.equal(second.ok, true);
  assert.equal(h.state.reminders['user-a']['task-a'].at, 812345);
  assert.equal(h.state.reminders['user-b']['task-a'].at, 812346);
  const clear = await h.writer.write('task-a', null, 'user-a');
  assert.equal(clear.ok, true);
  assert.equal(h.state.reminders['user-a'], undefined);
  assert.equal(h.activity.transactions.length, 0);
  assert.equal(h.activity.applied.length, 3);
});

test('Ver.541 remote write/clear uses workflowV148 child transaction with expected base', async () => {
  const h = harness('remote-online');
  assert.equal((await h.writer.write('task-a', { at: 812345, note: 'old' }, 'user-a')).ok, true);
  const path = h.path('user-a', 'task-a');
  assert.equal(h.activity.transactions[0].path, path);
  assert.equal(h.remoteRecords.get(path).note, 'old');
  assert.equal(h.activity.applied.length, 2);
  const base = h.remoteRecords.get(path);
  assert.equal((await h.writer.write('task-a', { at: 812346, note: 'new' }, 'user-a', base, true)).ok, true);
  assert.equal(h.remoteRecords.get(path).note, 'new');
  assert.equal((await h.writer.write('task-a', null, 'user-a', h.remoteRecords.get(path), true)).ok, true);
  assert.equal(h.remoteRecords.has(path), false);
  assert.equal(h.state.reminders['user-a'], undefined);
  assert.equal(h.activity.notifications.length, 0);
});

test('Ver.541 stale save and stale clear keep the remote winner, and current base can clear', async () => {
  const h = harness('remote-online');
  const path = h.path('user-a', 'task-a');
  const old = { at: 10000, note: 'old', updatedAt: 100 };
  const winner = { at: 12000, note: 'remote-winner', updatedAt: 120 };
  h.state.reminders['user-a'] = { 'task-a': old };
  h.remoteRecords.set(path, winner);
  const stale = await h.writer.write('task-a', { at: 14000, note: 'stale' }, 'user-a', old, true);
  assert.equal(stale.ok, false); assert.equal(stale.conflict, true);
  assert.equal(h.remoteRecords.get(path).note, 'remote-winner');
  assert.equal(h.state.reminders['user-a']['task-a'].note, 'remote-winner');
  const clear = await h.writer.write('task-a', null, 'user-a', old, true);
  assert.equal(clear.ok, false); assert.equal(clear.conflict, true);
  assert.equal(h.state.reminders['user-a']['task-a'].note, 'remote-winner');
  assert.equal(h.activity.notifications.length, 2);
  assert.equal(h.activity.logs.length, 0);
  assert.equal((await h.writer.write('task-a', null, 'user-a', winner, true)).ok, true);
  assert.equal(h.remoteRecords.has(path), false);
});

test('Ver.541 disconnected initialization rolls back; local-only stays writable', async () => {
  const h = harness('remote-loading');
  h.state.reminders['user-a'] = { 'task-a': { at: 100, note: 'keep', updatedAt: 1 } };
  assert.equal((await h.writer.write('task-a', { at: 200 }, 'user-a')).ok, false);
  assert.equal(h.state.reminders['user-a']['task-a'].at, 100);
  assert.equal(h.activity.notifications.at(-1)[0], 'リマインダーを保存できませんでした。');
  h.setMode('local-only');
  const local = await h.writer.write('task-a', { at: 220 }, 'user-a');
  assert.equal(local.ok, true); assert.equal(local.localOnly, true);
  assert.equal(h.state.reminders['user-a']['task-a'].at, 220);
});

test('Ver.541 rejected transaction and clear maintain previous value and error messages', async () => {
  const h = harness('remote-online');
  h.state.reminders['user-a'] = { 'task-a': { at: 100, note: 'keep', updatedAt: 1 } };
  h.fail();
  const failure = await h.writer.write('task-a', null, 'user-a');
  assert.equal(failure.ok, false); assert.equal(failure.error, 'network-dropped');
  assert.equal(h.state.reminders['user-a']['task-a'].at, 100);
  assert.equal(h.activity.notifications.at(-1)[0], '確認済みにできませんでした。通信状態を確認して再試行してください。');
  h.fail(false);h.abort(true);
  const aborted = await h.writer.write('task-a', { at: 200 }, 'user-a');
  assert.equal(aborted.ok, false); assert.equal(aborted.error, 'reminder-transaction-aborted');
  assert.equal(h.state.reminders['user-a']['task-a'].at, 100);
  assert.equal(h.activity.logs.length, 2);
});

test('Ver.541 writer is one owner; old v150 fallback remains when sidecar disabled', () => {
  const module = read('workspace-reminder-v541.js');
  const sidecar = read('workflow-v152.js');
  const base = read('workflow-core-v150.js');
  const manifest = read('release-manifest.js');
  const preview = read('modern/preview/index.html');
  assert.match(sidecar, /window\.WorkBoardReminderPersistenceV541\.create\(/);
  assert.match(sidecar, /return reminderPersistence\.write\(taskId, item, userKey\(user\), expectedReminder, arguments\.length >= 4\)/);
  assert.match(sidecar, /Base\.writeReminder=writeReminder/);
  assert.match(base, /async function writeReminder\(/);
  assert.match(base, /runTransaction\(target/);
  assert.match(module, /runTransaction\(target, current =>/);
  assert.match(module, /sameReminderValue\(current, expected\)/);
  assert.doesNotMatch(module, /\bonValue\(|\blocalStorage\b|\bdocument\b|\br\.set\(|\br\.get\(/);
  assert.doesNotMatch(preview, /workspace-reminder-v541|firebase|app\.js/i);
  assert.doesNotMatch(read('index.html'), /modern\/preview/);
  assert.equal((manifest.match(/"workspace-reminder-v541\.js"/g) || []).length, 2);
  const scripts = manifest.slice(manifest.indexOf('dynamicScripts:'));
  assert.ok(scripts.indexOf('"workspace-reminder-v541.js"') < scripts.indexOf('"workflow-v152.js"'));
});
