import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('app.js');
const lock = read('schedule-today-lock-v129.js');
const manifest = read('release-manifest.js');
const v359Product = read('tests/schedule-today-polling-audit-v358.spec.mjs');

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

test('Ver.359 app owns Today resume/day-boundary correction without a Schedule DOM observer or minute poll', () => {
  assert.match(app, /data-schedule-range="week" title="今日から7日間を表示します">7日間<\/button>/);
  assert.match(app, /function installScheduleTodayLifecycle\(\)/);
  assert.match(app, /let dayBoundaryTimerV359 = 0/);
  assert.match(app, /next\.setHours\(24, 0, 0, 0\)/);
  assert.match(app, /window\.addEventListener\("pageshow", resumeDayBoundaryV359\)/);
  assert.match(app, /window\.addEventListener\("focus", resumeDayBoundaryV359\)/);
  assert.match(app, /if \(document\.hidden\) clearDayBoundaryV359\(\)/);
  assert.doesNotMatch(app, /setInterval\(sync, 60 \* 1000\)/);
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

test('Ver.359 promotes the audited day-boundary lifecycle into product runtime', () => {
  assert.doesNotMatch(app, /setInterval\(sync, 60 \* 1000\)/);
  assert.match(v359Product, /Ver\.359 product replaces Schedule Today 60-second polling/);
  assert.match(v359Product, /__v359TimerState/);
  assert.match(v359Product, /armDayBoundaryV359/);
  assert.doesNotMatch(v359Product, /CURRENT_LIFECYCLE|CANDIDATE_LIFECYCLE|source\.replace/);
  assert.match(v359Product, /reconciles Today across midnight/);
  assert.match(v359Product, /catches up a missed midnight immediately when returning visible/);
  assert.ok(Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1]) >= 294);
});
