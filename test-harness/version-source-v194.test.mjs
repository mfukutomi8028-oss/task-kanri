import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest = fs.readFileSync(new URL('../release-manifest.js', import.meta.url), 'utf8');
const stable = fs.readFileSync(new URL('../stable-fixes-v108.js', import.meta.url), 'utf8');
const mobile = fs.readFileSync(new URL('../mobile-fixes.js', import.meta.url), 'utf8');
const coreStyle = fs.readFileSync(new URL('../ui-core-density-v188.css', import.meta.url), 'utf8');
const dateKeyboard = fs.readFileSync(new URL('../date-keyboard-fix-v127.js', import.meta.url), 'utf8');
const scheduleLock = fs.readFileSync(new URL('../schedule-today-lock-v129.js', import.meta.url), 'utf8');
const displayLock = fs.readFileSync(new URL('../version-display-lock.js', import.meta.url), 'utf8');

test('Ver.215 manifest is the release-version source and preserves foundation script order', () => {
  assert.match(manifest, /version:\s*["']215["']/);
  assert.match(manifest, /const VERSION = ["']215["']/);

  const stableIndex = manifest.indexOf('"stable-fixes-v108.js"');
  const dateIndex = manifest.indexOf('"date-keyboard-fix-v127.js"', stableIndex + 1);
  const todayIndex = manifest.indexOf('"schedule-today-lock-v129.js"', dateIndex + 1);
  const sortIndex = manifest.indexOf('"list-sort-v131.js"', todayIndex + 1);
  const versionIndex = manifest.indexOf('"version-display-lock.js"', sortIndex + 1);
  assert.ok(stableIndex >= 0 && stableIndex < dateIndex && dateIndex < todayIndex && todayIndex < sortIndex && sortIndex < versionIndex);
  assert.match(manifest, /"user-ux-polish-v208\.js"/);
});

test('stable owns Today markers without native hidden writes, core CSS owns final hide, and other foundation owners remain isolated', () => {
  assert.doesNotMatch(stable, /const VERSION\s*=/);
  assert.doesNotMatch(stable, /WORK_BOARD_VERSION\s*=/);
  assert.doesNotMatch(stable, /WORK_BOARD_RELEASE\?\.version/);
  assert.doesNotMatch(stable, /function setVersion\s*\(/);
  assert.doesNotMatch(stable, /function patchScheduleRangeLabel\s*\(/);
  assert.doesNotMatch(stable, /data-schedule-range=["']week["']/);
  assert.doesNotMatch(stable, /function patchStatusTabAutoScroll\s*\(/);
  assert.doesNotMatch(stable, /__stableScrollIntoViewV108/);
  assert.doesNotMatch(stable, /function patchDateInputs\s*\(/);
  assert.doesNotMatch(stable, /const DATE_MIN\s*=/);
  assert.doesNotMatch(stable, /const DATE_MAX\s*=/);
  assert.match(stable, /function applyTodayFilters\s*\(/);
  assert.match(stable, /data-v108-hidden/);
  assert.doesNotMatch(stable, /card\.hidden\s*=\s*shouldHide/);
  assert.match(coreStyle, /#todayView\s*\[data-v108-hidden\]\s*\{\s*display\s*:\s*none\s*!important\s*;?\s*\}/);

  assert.match(dateKeyboard, /const DATE_MIN = "1900-01-01";/);
  assert.match(dateKeyboard, /const DATE_MAX = "9999-12-31";/);
  assert.match(dateKeyboard, /source\.min = kind === "date" \? DATE_MIN : `\$\{DATE_MIN\}T00:00`/);
  assert.match(dateKeyboard, /source\.max = kind === "date" \? DATE_MAX : `\$\{DATE_MAX\}T23:59`/);
  assert.match(dateKeyboard, /function isValidDateParts\(year, month, day\)/);

  assert.match(mobile, /function applyActiveColumn\s*\(/);
  assert.match(mobile, /tabs\.scrollLeft = Math\.max\(0, left\)/);
  assert.match(mobile, /\.work-mobile-status-tabs\s*\{[\s\S]*display: flex !important;[\s\S]*overflow-x: auto !important;/);
  assert.match(mobile, /\.work-mobile-status-tabs\s*\{[\s\S]*flex-wrap: nowrap !important;[\s\S]*scroll-snap-type: none !important;/);
  assert.match(mobile, /\.work-mobile-status-tab\s*\{[\s\S]*touch-action: auto !important;[\s\S]*user-select: none !important;/);
  assert.doesNotMatch(stable, /\.work-mobile-status-tabs|\.work-mobile-status-tab/);

  assert.match(scheduleLock, /function normalizeWeekRangeLabel\s*\(/);
  assert.match(scheduleLock, /data-schedule-range=\\?['"]week\\?['"]/);
  assert.match(scheduleLock, /button\.textContent = ["']7日間["']/);
  assert.match(scheduleLock, /button\.title = ["']今日から7日間を表示します["']/);
  assert.equal((scheduleLock.match(/new MutationObserver/g) || []).length, 1);
  assert.match(scheduleLock, /observer\.observe\(view, \{ childList: true, subtree: true \}\)/);
  assert.doesNotMatch(mobile, /function patchScheduleRangeButtons\s*\(/);
  assert.doesNotMatch(mobile, /patchScheduleRangeButtons\(\);/);
});

test('Ver.215 stable startup is Today-only and later stable triggers remain Today-only', () => {
  assert.doesNotMatch(stable, /\.work-mobile-status-tab["']\)\) \{/);
  assert.doesNotMatch(stable, /window\.addEventListener\("resize", scheduleFixes\)/);
  assert.doesNotMatch(stable, /window\.addEventListener\("orientationchange"/);
  assert.doesNotMatch(stable, /window\.addEventListener\("pageshow", scheduleFixes\)/);
  assert.doesNotMatch(stable, /setTimeout\(scheduleFixes, 300\)/);
  assert.doesNotMatch(stable, /setTimeout\(scheduleFixes, 1200\)/);
  assert.doesNotMatch(stable, /function scheduleFixes\s*\(/);
  assert.doesNotMatch(stable, /let scheduled\s*=/);
  assert.doesNotMatch(stable, /function setVersion\s*\(/);
  assert.doesNotMatch(stable, /function installStyle\s*\(/);
  assert.doesNotMatch(stable, /stableFixesV108Style|MOBILE_QUERY/);

  assert.match(stable, /document\.addEventListener\("DOMContentLoaded", applyTodayFilters, \{ once: true \}\)/);
  assert.match(stable, /else \{\s*applyTodayFilters\(\);\s*\}/);
  assert.match(stable, /\.nav-filter\[data-filter="mine"\], \.nav-item\[data-layout\][\s\S]*setTimeout\(scheduleTodayFilters, 0\);[\s\S]*setTimeout\(scheduleTodayFilters, 120\);/);
  assert.match(stable, /#currentUserSelect, #startupUser[\s\S]*setTimeout\(scheduleTodayFilters, 0\)/);
  assert.match(stable, /function scheduleTodayFilters\s*\(/);
});

test('version display lock exclusively derives displayed and compatibility versions from the manifest release', () => {
  assert.match(displayLock, /window\.WORK_BOARD_RELEASE\?\.version/);
  assert.match(displayLock, /window\.WORK_BOARD_VERSION\s*=\s*version/);
  assert.doesNotMatch(displayLock, /["']122["']/);
  assert.doesNotMatch(stable, /WORK_BOARD_RELEASE\?\.version|WORK_BOARD_VERSION\s*=|function setVersion\s*\(/);
});
