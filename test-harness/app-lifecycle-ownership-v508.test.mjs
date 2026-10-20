import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Ver.508: source-only lifecycle ownership guard. Runtime registrations are
// independently verified in tests/app-lifecycle-listener-singleton-v508.spec.mjs.
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const count = (source, expression) => (source.match(expression) || []).length;
const section = (start, next) => {
  const first = app.indexOf(start);
  assert.ok(first >= 0, 'lifecycle start missing: ' + start);
  assert.equal(app.indexOf(start, first + start.length), -1, 'duplicate start: ' + start);
  const last = app.indexOf(next, first + start.length);
  assert.ok(last > first, 'lifecycle end missing: ' + next);
  return app.slice(first, last);
};

test('Ver.508 core app initializers have one definition and one explicit invocation each', () => {
  const names = ['init', 'setupEvents', 'installScheduleTodayLifecycle', 'startScheduleReminderWatcher'];
  for (const name of names) {
    const definitions = new RegExp('\\bfunction\\s+' + name + '\\s*\\(', 'g');
    const uses = new RegExp('\\b' + name + '\\s*\\(', 'g');
    assert.equal(count(app, definitions), 1, name + ' must have one definition');
    assert.equal(count(app, uses), 2, name + ' must have exactly one call site plus definition');
  }
  assert.equal(count(app, /^\s*init\(\);\s*$/gm), 1, 'one module entrypoint');
  const init = section('function init() {', 'function installDialogFallback() {');
  for (const name of names.slice(1)) {
    assert.match(init, new RegExp('\\b' + name + '\\s*\\(\\s*\\)'));
  }
});

test('Ver.508 two independent Schedule visibility owners and drag listeners stay singular', () => {
  const today = section('function installScheduleTodayLifecycle() {', 'function moveScheduleAnchor(');
  const reminder = section('function startScheduleReminderWatcher() {', 'function getScheduleReminderMap() {');
  for (const event of ['visibilitychange', 'focus', 'pageshow']) {
    const target = event === 'visibilitychange' ? 'document' : 'window';
    const regex = new RegExp('\\b' + target + '\\.addEventListener\\s*\\(\\s*"' + event + '"', 'g');
    assert.equal(count(today, regex), 1, 'Schedule Today owns one ' + target + ':' + event);
    assert.equal(count(reminder, regex), 1, 'Schedule reminder owns one ' + target + ':' + event);
  }
  const setup = section('function setupEvents() {', 'function ' + 'loadRoomName(');
  assert.equal(count(setup, /document\.addEventListener\s*\(\s*"dragend"/g), 1);
  assert.equal(count(setup, /document\.addEventListener\s*\(\s*"drop"/g), 1);
});

test('Ver.508 Today timer cleanup and reminder reentry guard remain present', () => {
  const today = section('function installScheduleTodayLifecycle() {', 'function moveScheduleAnchor(');
  const reminder = section('function startScheduleReminderWatcher() {', 'function getScheduleReminderMap() {');
  assert.match(today, /clearTimeout\s*\(\s*dayBoundaryTimerV359\s*\)/);
  assert.match(today, /dayBoundaryTimerV359\s*=\s*setTimeout\s*\(/);
  assert.match(today, /if\s*\(\s*document\.hidden\s*\)\s*return/);
  assert.match(reminder, /if\s*\(\s*state\.scheduleReminderWatcherStarted\s*\)\s*return/);
  assert.match(reminder, /state\.scheduleReminderWatcherStarted\s*=\s*true/);
  assert.doesNotMatch(app, /\bsetInterval\s*\(/, 'core app must not revert to interval polling');
});

test('Ver.508 a second explicit initializer would violate the single-call contract', () => {
  const fakeRegression = app + '\ninit();\n';
  assert.equal(count(fakeRegression, /^\s*init\(\);\s*$/gm), 2);
});
