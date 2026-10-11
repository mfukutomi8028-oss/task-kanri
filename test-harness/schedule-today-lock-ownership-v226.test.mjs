import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FROZEN_RETIRED_JS_BLOBS_V408 } from './build-pages-runtime-v382.mjs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('app.js');
const lock = JSON.parse(read('compat/frozen-legacy-runtime-v397.json'))['schedule-today-lock-v129.js'];
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

test('Ver.408 archives the retired schedule-today-lock while preserving its original cache URL', () => {
  const dynamicScriptsMatch = manifest.match(/dynamicScripts:\s*\[([\s\S]*?)\]/);
  const requiredAssetsMatch = manifest.match(/requiredAssets:\s*\[([\s\S]*?)\]/);
  assert.ok(dynamicScriptsMatch, 'dynamicScripts inventory must exist');
  assert.ok(requiredAssetsMatch, 'requiredAssets inventory must exist');
  assert.doesNotMatch(dynamicScriptsMatch[1], /schedule-today-lock-v129\.js/);
  assert.doesNotMatch(requiredAssetsMatch[1], /schedule-today-lock-v129\.js/);
  assert.equal(fs.existsSync(new URL('../schedule-today-lock-v129.js', import.meta.url)), false,
    'retired schedule lock must no longer remain in Git root');
  assert.equal(typeof lock, 'string', 'old Schedule Today script must be available for cached HTML URLs');
  assert.equal(FROZEN_RETIRED_JS_BLOBS_V408['schedule-today-lock-v129.js'],
    '6297fb42494ed656ee00e7589ded6f9abb158609');
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
