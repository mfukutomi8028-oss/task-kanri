import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('app.js');
const lock = read('schedule-today-lock-v129.js');
const manifest = read('release-manifest.js');

test('Ver.227 app exclusively owns Schedule Today anchor and movement semantics', () => {
  assert.match(app, /scheduleRange:\s*localStorage\.getItem\(scheduleRangeKey\(\)\)\s*\|\|\s*["']today["']/);
  assert.match(app, /scheduleAnchor:\s*localStorage\.getItem\(scheduleAnchorKey\(\)\)\s*\|\|\s*todayISO\(\)/);
  assert.match(app, /function syncScheduleTodayAnchor\(/);
  assert.match(app, /if \(state\.scheduleRange !== "today"\) return false/);
  assert.match(app, /state\.scheduleAnchor = today/);
  assert.match(app, /localStorage\.setItem\(scheduleAnchorKey\(\), state\.scheduleAnchor\)/);
  assert.match(app, /function moveScheduleAnchor\(direction\)[\s\S]*state\.scheduleRange === "today" && \["prev", "next"\]\.includes\(direction\)/);
  assert.match(app, /data-schedule-move="prev"[^>]*disabled aria-disabled="true"/);
  assert.match(app, /data-schedule-move="next"[^>]*disabled aria-disabled="true"/);
});

test('Ver.227 app owns final 7-day label and resume/day-rollover correction without a Schedule DOM observer', () => {
  assert.match(app, /data-schedule-range="week" title="今日から7日間を表示します">7日間<\/button>/);
  assert.match(app, /function installScheduleTodayLifecycle\(\)/);
  assert.match(app, /window\.addEventListener\("pageshow", sync\)/);
  assert.match(app, /window\.addEventListener\("focus", sync\)/);
  assert.match(app, /document\.addEventListener\("visibilitychange"/);
  assert.match(app, /setInterval\(sync, 60 \* 1000\)/);
  assert.doesNotMatch(app, /new MutationObserver\([^)]*schedule/i);
});

test('Ver.227 retires schedule-today-lock from active runtime while retaining the physical compatibility file', () => {
  const dynamicScriptsMatch = manifest.match(/dynamicScripts:\s*\[([\s\S]*?)\]/);
  const requiredAssetsMatch = manifest.match(/requiredAssets:\s*\[([\s\S]*?)\]/);
  assert.ok(dynamicScriptsMatch, 'dynamicScripts inventory must exist');
  assert.ok(requiredAssetsMatch, 'requiredAssets inventory must exist');
  assert.doesNotMatch(dynamicScriptsMatch[1], /schedule-today-lock-v129\.js/);
  assert.doesNotMatch(requiredAssetsMatch[1], /schedule-today-lock-v129\.js/);
  assert.ok(fs.existsSync(new URL('../schedule-today-lock-v129.js', import.meta.url)));
  assert.match(lock, /installScheduleTodayLockV129/);
});
