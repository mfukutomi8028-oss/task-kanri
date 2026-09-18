import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('app.js');
const lock = read('schedule-today-lock-v129.js');
const manifest = read('release-manifest.js');

test('Ver.226 app owns Schedule range/anchor state and final controls but not the Today lock lifecycle', () => {
  assert.match(app, /scheduleRange:\s*localStorage\.getItem\(scheduleRangeKey\(\)\)\s*\|\|\s*["']today["']/);
  assert.match(app, /scheduleAnchor:\s*localStorage\.getItem\(scheduleAnchorKey\(\)\)\s*\|\|\s*todayISO\(\)/);
  assert.match(app, /data-schedule-range=\\?"today\\?"/);
  assert.match(app, /data-schedule-range=\\?"week\\?"/);
  assert.match(app, /data-schedule-move=\\?"prev\\?"/);
  assert.match(app, /data-schedule-move=\\?"today\\?"/);
  assert.match(app, /data-schedule-move=\\?"next\\?"/);

  assert.match(app, /state\.scheduleRange\s*=\s*button\.dataset\.scheduleRange/);
  assert.match(app, /button\.addEventListener\(["']click["'],\s*\(\)\s*=>\s*moveScheduleAnchor\(button\.dataset\.scheduleMove\)\)/);
  assert.match(app, /function moveScheduleAnchor\(direction\)/);
  assert.match(app, /if\s*\(direction\s*===\s*["']today["']\)\s*\{\s*state\.scheduleAnchor\s*=\s*todayISO\(\)/s);
  assert.match(app, /state\.scheduleAnchor\s*=\s*toISODate\(addDays\(base,\s*direction\s*===\s*["']next["']\s*\?\s*1\s*:\s*-1\)\)/);

  assert.doesNotMatch(app, /addEventListener\(["']pageshow["']/);
  assert.doesNotMatch(app, /visibilitychange[^\n]+scheduleEnforcement/);
});

test('schedule-today-lock exclusively owns Today correction, movement blocking, label normalization and resume/day-rollover hooks', () => {
  assert.match(lock, /function localTodayISO\(\)/);
  assert.match(lock, /function normalizeWeekRangeLabel\(/);
  assert.match(lock, /button\.textContent\s*=\s*["']7日間["']/);
  assert.match(lock, /button\.title\s*=\s*["']今日から7日間を表示します["']/);
  assert.match(lock, /function enforceTodayAnchor\(\)/);
  assert.match(lock, /todayButton\.click\(\)/);

  assert.match(lock, /document\.addEventListener\(["']click["'][\s\S]*event\.preventDefault\(\)[\s\S]*event\.stopImmediatePropagation\(\)/);
  assert.match(lock, /new MutationObserver\(scheduleEnforcement\)/);
  assert.match(lock, /window\.addEventListener\(["']pageshow["'],\s*scheduleEnforcement\)/);
  assert.match(lock, /window\.addEventListener\(["']focus["'],\s*scheduleEnforcement\)/);
  assert.match(lock, /document\.addEventListener\(["']visibilitychange["']/);
  assert.match(lock, /setInterval\(scheduleEnforcement,\s*60\s*\*\s*1000\)/);
});

test('Ver.226 still loads the Today lock sidecar, so retirement must follow product integration rather than direct manifest deletion', () => {
  const dynamicScriptsMatch = manifest.match(/dynamicScripts:\s*\[([\s\S]*?)\]/);
  const requiredAssetsMatch = manifest.match(/requiredAssets:\s*\[([\s\S]*?)\]/);
  assert.ok(dynamicScriptsMatch, 'dynamicScripts inventory must exist');
  assert.ok(requiredAssetsMatch, 'requiredAssets inventory must exist');
  assert.match(dynamicScriptsMatch[1], /schedule-today-lock-v129\.js/);
  assert.match(requiredAssetsMatch[1], /schedule-today-lock-v129\.js/);
});
