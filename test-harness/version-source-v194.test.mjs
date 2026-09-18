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
const userUx = fs.readFileSync(new URL('../user-ux-polish-v208.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.220 manifest is the release-version source and stable is no longer active', () => {
  assert.match(manifest, /version:\s*["']220["']/);
  assert.match(manifest, /const VERSION = ["']220["']/);
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  assert.ok(!scripts.includes('stable-fixes-v108.js'));
  assert.ok(!required.includes('stable-fixes-v108.js'));
  assert.ok(fs.existsSync(new URL('../stable-fixes-v108.js', import.meta.url)));

  const dateIndex = scripts.indexOf('date-keyboard-fix-v127.js');
  const todayIndex = scripts.indexOf('schedule-today-lock-v129.js');
  const sortIndex = scripts.indexOf('list-sort-v131.js');
  const versionIndex = scripts.indexOf('version-display-lock.js');
  assert.ok(dateIndex >= 0 && dateIndex < todayIndex && todayIndex < sortIndex && sortIndex < versionIndex);
  assert.match(manifest, /"user-ux-polish-v208\.js"/);
});

test('Ver.220 app.js owns Today semantics using the canonical user and room-group predicate', () => {
  assert.match(app, /const openTasks = state\.tasks\.filter\(t => !isCompletedStatus\(t\.status\) && normalizeText\(t\.status\) !== normalizeText\("保留"\) && \(!scopeHasMine\(\) \|\| isCurrentUserOrGroupAssignee\(t\.assignee\)\)\);/);
  assert.match(app, /\.filter\(s => !scopeHasMine\(\) \|\| isCurrentUserOrGroupAssignee\(s\.assignee\)\)/);
  assert.match(app, /const spare = openTasks\.filter\(t => !t\.dueDate && !isUnsortedTask\(t\) && normalizeText\(t\.status\) !== normalizeText\("確認待ち"\)\)/);
  assert.match(app, /function getGroupAssignee\(\)\s*\{\s*return sanitizeUser\(state\.roomName \|\| ""\);\s*\}/);
  assert.match(app, /function isCurrentUserOrGroupAssignee\(value\)/);
});

test('Ver.217 user UX presentation translates Star wording to お気に入り without changing favorite state ownership', () => {
  assert.match(userUx, /setTrailingText\(button, 'お気に入り'\)/);
  assert.match(userUx, /setTrailingText\(favoriteRow, 'お気に入りのみ'\)/);
  assert.match(userUx, /active \? 'お気に入り解除' : 'お気に入り'/);
  assert.match(userUx, /active \? 'お気に入りを解除' : 'お気に入りに追加'/);
  assert.match(userUx, /data-star-task/);
  assert.doesNotMatch(userUx, /favoriteTaskIds\s*=/);
});

test('retired stable remains a physical cached-release compatibility file while current core CSS has no legacy hidden-marker rule', () => {
  assert.match(stable, /function applyTodayFilters\s*\(/);
  assert.match(stable, /data-v108-hidden/);
  assert.doesNotMatch(stable, /runTransaction|firebase|fetch\(/i);
  assert.doesNotMatch(coreStyle, /data-v108-hidden/);
});

test('other foundation owners remain isolated after stable retirement', () => {
  assert.match(dateKeyboard, /const DATE_MIN = "1900-01-01";/);
  assert.match(dateKeyboard, /const DATE_MAX = "9999-12-31";/);
  assert.match(dateKeyboard, /function isValidDateParts\(year, month, day\)/);

  assert.match(mobile, /function applyActiveColumn\s*\(/);
  assert.match(mobile, /tabs\.scrollLeft = Math\.max\(0, left\)/);
  assert.match(mobile, /\.work-mobile-status-tabs\s*\{[\s\S]*overflow-x: auto !important;/);

  assert.match(scheduleLock, /function normalizeWeekRangeLabel\s*\(/);
  assert.match(scheduleLock, /button\.textContent = ["']7日間["']/);
  assert.equal((scheduleLock.match(/new MutationObserver/g) || []).length, 1);
});

test('version display lock exclusively derives displayed and compatibility versions from the manifest release', () => {
  assert.match(displayLock, /window\.WORK_BOARD_RELEASE\?\.version/);
  assert.match(displayLock, /window\.WORK_BOARD_VERSION\s*=\s*version/);
  assert.doesNotMatch(displayLock, /["']122["']/);
});
