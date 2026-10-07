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

test('Ver.361 product retires the 30-second Schedule reminder interval', () => {
  assert.doesNotMatch(app, /setInterval\(checkScheduleReminders,\s*30000\)/);
  const lifecycle = blockBetween(app, 'function clearScheduleReminderTimer()', 'function getScheduleReminderMap()');
  assert.match(lifecycle, /clearTimeout\(state\.scheduleReminderTimer\)/);
  assert.match(lifecycle, /function nextScheduleReminderBoundary\(now = Date\.now\(\)\)/);
  assert.match(lifecycle, /const boundary = start - reminderBeforeMs;/);
  assert.match(lifecycle, /if \(!nextAt \|\| boundary < nextAt\) nextAt = boundary;/);
  assert.match(lifecycle, /const maxDelay = 2147483647;/);
  assert.match(lifecycle, /state\.scheduleReminderTimer = setTimeout\(\(\) =>/);
});

test('Ver.361 product keeps exactly one background-capable reminder timer and resume catch-up', () => {
  const lifecycle = blockBetween(app, 'function clearScheduleReminderTimer()', 'function getScheduleReminderMap()');
  assert.match(lifecycle, /function armScheduleReminderTimer\(\)[\s\S]*?clearScheduleReminderTimer\(\)/);
  assert.match(lifecycle, /function syncScheduleReminderWatcher\(\)[\s\S]*?checkScheduleReminders\(\);[\s\S]*?armScheduleReminderTimer\(\);/);
  assert.match(lifecycle, /window\.addEventListener\("focus", syncScheduleReminderWatcher\)/);
  assert.match(lifecycle, /window\.addEventListener\("pageshow", syncScheduleReminderWatcher\)/);
  assert.match(lifecycle, /document\.addEventListener\("visibilitychange",[\s\S]*?if \(!document\.hidden\) syncScheduleReminderWatcher\(\)/);
  assert.doesNotMatch(lifecycle, /document\.hidden\)[\s\S]*?clearScheduleReminderTimer/);
});

test('Ver.361 product preserves reminder semantics and re-arms on schedule refresh', () => {
  const reminder = blockBetween(app, 'function checkScheduleReminders()', 'function requestScheduleNotificationPermission()');
  assert.match(reminder, /const reminderBeforeMs = 15 \* 60 \* 1000;/);
  assert.match(reminder, /if \(diff > 0 && diff <= reminderBeforeMs && !seen\[key\]\)/);
  assert.match(reminder, /seen\[key\] = now;/);
  assert.match(reminder, /fireScheduleReminder\(schedule\);/);
  assert.match(reminder, /7 \* 24 \* 60 \* 60 \* 1000/);

  assert.match(app, /mergeSubscribedCollection\('schedules', value\);[\s\S]*?syncScheduleReminderWatcher\(\);[\s\S]*?markCollectionReady\("schedules"\)/);
  assert.match(app, /function loadLocalSchedules\(\)[\s\S]*?syncScheduleReminderWatcher\(\);/);
  assert.match(app, /Notification\.requestPermission\(\)[\s\S]*?if \(result === "granted"\)[\s\S]*?syncScheduleReminderWatcher\(\);/);
});

test('Ver.361 release and baseline advance together', () => {
  const release = manifest.match(/const VERSION = ['"](\d+)['"]/)?.[1];
  assert.equal(release, '295');
  assert.equal(String(responsibilities.baselineRelease), '295');
});
