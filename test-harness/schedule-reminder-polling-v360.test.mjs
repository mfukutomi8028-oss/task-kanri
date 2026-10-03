import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [app, manifest, responsibilitiesText] = await Promise.all([
  read('app.js'),
  read('release-manifest.js'),
  read('patch-responsibilities.json')
]);
const responsibilities = JSON.parse(responsibilitiesText);

function blockBetween(source, start, end) {
  const startAt = source.indexOf(start);
  assert.ok(startAt >= 0, `${start} must exist`);
  const endAt = source.indexOf(end, startAt + start.length);
  assert.ok(endAt > startAt, `${end} must follow ${start}`);
  return source.slice(startAt, endAt);
}

test('Ver.360 audit: current Schedule reminder owner is one 30-second interval plus startup catch-up', () => {
  const watcher = blockBetween(app, 'function startScheduleReminderWatcher()', 'function getScheduleReminderMap()');
  assert.match(watcher, /if \(state\.scheduleReminderTimer\) return;/);
  assert.match(watcher, /state\.scheduleReminderTimer = setInterval\(checkScheduleReminders, 30000\);/);
  assert.match(watcher, /setTimeout\(checkScheduleReminders, 1200\);/);
});

test('Ver.360 audit: reminder semantics are time-arrival based and duplicate-safe', () => {
  const reminder = blockBetween(app, 'function checkScheduleReminders()', 'function fireScheduleReminder(');
  assert.match(reminder, /const reminderBeforeMs = 15 \* 60 \* 1000;/);
  assert.match(reminder, /const diff = start - now;/);
  assert.match(reminder, /if \(diff > 0 && diff <= reminderBeforeMs && !seen\[key\]\)/);
  assert.match(reminder, /seen\[key\] = now;/);
  assert.match(reminder, /fireScheduleReminder\(schedule\);/);
  assert.match(reminder, /if \(changed\) setScheduleReminderMap\(seen\);/);
  assert.match(reminder, /7 \* 24 \* 60 \* 60 \* 1000/);
});

test('Ver.360 audit: schedule data refresh already causes immediate reminder reconciliation', () => {
  assert.match(app, /onValue\(state\.schedulesRef,[\s\S]*?mergeSubscribedCollection\('schedules', value\);[\s\S]*?checkScheduleReminders\(\);/);
  assert.match(app, /function loadLocalSchedules\(\)[\s\S]*?state\.schedules = JSON\.parse[\s\S]*?checkScheduleReminders\(\);/);
  assert.match(app, /Notification\.requestPermission\(\)[\s\S]*?if \(result === "granted"\)[\s\S]*?checkScheduleReminders\(\);/);
});

test('Ver.360 audit: one-shot product candidate can preserve behavior without visibility-only ownership', () => {
  // Productization should target the next unnotified (startAt - 15m) boundary, then
  // run checkScheduleReminders and re-arm. The timer must remain armed while hidden
  // so browser notifications can still arrive from a background tab; focus/pageshow/
  // visible recovery should only add catch-up/re-arm for browser suspension/throttling.
  assert.match(app, /function scheduleReminderKey\(/);
  assert.match(app, /function shouldRemindSchedule\(/);
  assert.match(app, /schedule\.startAt/);
  assert.doesNotMatch(app, /clearInterval\(state\.scheduleReminderTimer\)/);
});

test('Ver.360 audit is release-neutral', () => {
  const release = manifest.match(/const VERSION = ['"](\d+)['"]/)?.[1];
  assert.equal(release, '294');
  assert.equal(String(responsibilities.baselineRelease), '294');
});
