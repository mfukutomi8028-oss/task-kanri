import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest = fs.readFileSync(new URL('../release-manifest.js', import.meta.url), 'utf8');
const stable = fs.readFileSync(new URL('../stable-fixes-v108.js', import.meta.url), 'utf8');
const mobile = fs.readFileSync(new URL('../mobile-fixes.js', import.meta.url), 'utf8');
const dateKeyboard = fs.readFileSync(new URL('../date-keyboard-fix-v127.js', import.meta.url), 'utf8');
const scheduleLock = fs.readFileSync(new URL('../schedule-today-lock-v129.js', import.meta.url), 'utf8');
const displayLock = fs.readFileSync(new URL('../version-display-lock.js', import.meta.url), 'utf8');

test('Ver.209 manifest is the release-version source and preserves foundation script order', () => {
  assert.match(manifest, /version:\s*["']209["']/);
  assert.match(manifest, /const VERSION = ["']209["']/);

  const stableIndex = manifest.indexOf('"stable-fixes-v108.js"');
  const dateIndex = manifest.indexOf('"date-keyboard-fix-v127.js"', stableIndex + 1);
  const todayIndex = manifest.indexOf('"schedule-today-lock-v129.js"', dateIndex + 1);
  const sortIndex = manifest.indexOf('"list-sort-v131.js"', todayIndex + 1);
  const versionIndex = manifest.indexOf('"version-display-lock.js"', sortIndex + 1);
  assert.ok(stableIndex >= 0 && stableIndex < dateIndex && dateIndex < todayIndex && todayIndex < sortIndex && sortIndex < versionIndex);
  assert.match(manifest, /"user-ux-polish-v208\.js"/);
});

test('date keyboard owns native dates while stable owns Today, mobile owns status tabs, and schedule lock owns schedule normalization', () => {
  assert.doesNotMatch(stable, /const VERSION\s*=\s*["']122["']/);
  assert.doesNotMatch(stable, /WORK_BOARD_VERSION\s*=/);
  assert.match(stable, /WORK_BOARD_RELEASE\?\.version/);
  assert.doesNotMatch(stable, /function patchScheduleRangeLabel\s*\(/);
  assert.doesNotMatch(stable, /data-schedule-range=["']week["']/);
  assert.doesNotMatch(stable, /function patchStatusTabAutoScroll\s*\(/);
  assert.doesNotMatch(stable, /__stableScrollIntoViewV108/);
  assert.doesNotMatch(stable, /function patchDateInputs\s*\(/);
  assert.doesNotMatch(stable, /const DATE_MIN\s*=/);
  assert.doesNotMatch(stable, /const DATE_MAX\s*=/);
  assert.match(stable, /function applyTodayFilters\s*\(/);

  assert.match(dateKeyboard, /const DATE_MIN = "1900-01-01";/);
  assert.match(dateKeyboard, /const DATE_MAX = "9999-12-31";/);
  assert.match(dateKeyboard, /source\.min = kind === "date" \? DATE_MIN : `\$\{DATE_MIN\}T00:00`/);
  assert.match(dateKeyboard, /source\.max = kind === "date" \? DATE_MAX : `\$\{DATE_MAX\}T23:59`/);
  assert.match(dateKeyboard, /function isValidDateParts\(year, month, day\)/);

  assert.match(mobile, /function applyActiveColumn\s*\(/);
  assert.match(mobile, /tabs\.scrollLeft = Math\.max\(0, left\)/);
  assert.match(mobile, /\.work-mobile-status-tabs\s*\{[\s\S]*display: flex !important;[\s\S]*overflow-x: auto !important;/);
  assert.doesNotMatch(stable, /\.work-mobile-status-tabs\s*\{[\s\S]*display: flex !important;/);

  assert.match(scheduleLock, /function normalizeWeekRangeLabel\s*\(/);
  assert.match(scheduleLock, /data-schedule-range=\\?['"]week\\?['"]/);
  assert.match(scheduleLock, /button\.textContent = ["']7日間["']/);
  assert.match(scheduleLock, /button\.title = ["']今日から7日間を表示します["']/);
  assert.equal((scheduleLock.match(/new MutationObserver/g) || []).length, 1);
  assert.match(scheduleLock, /observer\.observe\(view, \{ childList: true, subtree: true \}\)/);
  assert.doesNotMatch(mobile, /function patchScheduleRangeButtons\s*\(/);
  assert.doesNotMatch(mobile, /patchScheduleRangeButtons\(\);/);
});

test('version display lock derives displayed and compatibility versions from the manifest release', () => {
  assert.match(displayLock, /window\.WORK_BOARD_RELEASE\?\.version/);
  assert.match(displayLock, /window\.WORK_BOARD_VERSION\s*=\s*version/);
  assert.doesNotMatch(displayLock, /["']122["']/);
});
