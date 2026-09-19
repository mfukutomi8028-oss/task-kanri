import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest = fs.readFileSync(new URL('../release-manifest.js', import.meta.url), 'utf8');
const stable = fs.readFileSync(new URL('../stable-fixes-v108.js', import.meta.url), 'utf8');
const legacyMobile = fs.readFileSync(new URL('../mobile-fixes.js', import.meta.url), 'utf8');
const mobileShell = fs.readFileSync(new URL('../mobile-shell-v234.js', import.meta.url), 'utf8');
const mobileShellStyle = fs.readFileSync(new URL('../ui-mobile-shell-v234.css', import.meta.url), 'utf8');
const coreStyle = fs.readFileSync(new URL('../ui-core-density-v188.css', import.meta.url), 'utf8');
const scheduleCopyStyle = fs.readFileSync(new URL('../ui-schedule-copy-v225.css', import.meta.url), 'utf8');
const dateKeyboard = fs.readFileSync(new URL('../date-segment-controls-v230.js', import.meta.url), 'utf8');
const legacyDateKeyboard = fs.readFileSync(new URL('../date-keyboard-fix-v127.js', import.meta.url), 'utf8');
const scheduleLock = fs.readFileSync(new URL('../schedule-today-lock-v129.js', import.meta.url), 'utf8');
const legacyListSort = fs.readFileSync(new URL('../list-sort-v131.js', import.meta.url), 'utf8');
const displayLock = fs.readFileSync(new URL('../version-display-lock.js', import.meta.url), 'utf8');
const displayStyle = fs.readFileSync(new URL('../ui-version-display-v232.css', import.meta.url), 'utf8');
const config = fs.readFileSync(new URL('../config.js', import.meta.url), 'utf8');
const userUx = fs.readFileSync(new URL('../user-ux-polish-v208.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('current manifest remains the release-version source and retired foundation sidecars stay inactive', () => {
  const release = manifest.match(/version:\s*["'](\d+)["']/)?.[1] || '';
  assert.ok(Number(release) >= 234, `expected Ver.234 or later, got ${release}`);
  assert.match(manifest, new RegExp(`const VERSION = ["']${release}["']`));
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const mobileScripts = extractStringArray(manifest, 'mobileScripts');
  const styles = extractStringArray(manifest, 'dynamicStyles');
  const required = extractStringArray(manifest, 'requiredAssets');
  assert.ok(!scripts.includes('stable-fixes-v108.js'));
  assert.ok(!required.includes('stable-fixes-v108.js'));
  assert.ok(fs.existsSync(new URL('../stable-fixes-v108.js', import.meta.url)));
  assert.ok(!scripts.includes('schedule-today-lock-v129.js'));
  assert.ok(!required.includes('schedule-today-lock-v129.js'));
  assert.ok(fs.existsSync(new URL('../schedule-today-lock-v129.js', import.meta.url)));
  assert.ok(!scripts.includes('list-sort-v131.js'));
  assert.ok(!required.includes('list-sort-v131.js'));
  assert.match(legacyListSort, /work-board-base-sort:/);
  assert.match(legacyListSort, /work-board-list-column-sort:/);
  assert.ok(!scripts.includes('date-keyboard-fix-v127.js'));
  assert.ok(!required.includes('date-keyboard-fix-v127.js'));
  assert.match(legacyDateKeyboard, /function installStyle\(\)/);
  assert.ok(!scripts.includes('version-display-lock.js'));
  assert.ok(!required.includes('version-display-lock.js'));
  assert.ok(fs.existsSync(new URL('../version-display-lock.js', import.meta.url)));
  assert.deepEqual(mobileScripts, ['mobile-shell-v234.js']);
  assert.ok(!required.includes('mobile-fixes.js'));
  assert.ok(fs.existsSync(new URL('../mobile-fixes.js', import.meta.url)));

  const dateIndex = scripts.indexOf('date-segment-controls-v230.js');
  const savedViewsIndex = scripts.indexOf('saved-views-v148.js');
  const columnSortIndex = scripts.indexOf('list-column-sort-v229.js');
  assert.ok(dateIndex >= 0, 'semantic date controller remains active');
  assert.ok(savedViewsIndex >= 0 && savedViewsIndex < columnSortIndex,
    'primary sort persistence must initialize before list-column sorting');
  assert.match(manifest, /"user-ux-polish-v208\.js"/);
  assert.equal(styles.filter(name => name === 'ui-schedule-copy-v225.css').length, 1);
  assert.equal(required.filter(name => name === 'ui-schedule-copy-v225.css').length, 1);
  assert.equal(styles.filter(name => name === 'ui-date-segment-controls-v230.css').length, 1);
  assert.equal(required.filter(name => name === 'ui-date-segment-controls-v230.css').length, 1);
  assert.equal(styles.filter(name => name === 'ui-version-display-v232.css').length, 1);
  assert.equal(required.filter(name => name === 'ui-version-display-v232.css').length, 1);
  assert.equal(styles.filter(name => name === 'ui-mobile-shell-v234.css').length, 1);
  assert.equal(required.filter(name => name === 'ui-mobile-shell-v234.css').length, 1);
});

test('Ver.219 app.js ownership of Today semantics remains canonical in later releases', () => {
  assert.match(app, /const openTasks = state\.tasks\.filter\(t => !isCompletedStatus\(t\.status\) && normalizeText\(t\.status\) !== normalizeText\("保留"\) && \(!scopeHasMine\(\) \|\| isCurrentUserOrGroupAssignee\(t\.assignee\)\)\);/);
  assert.match(app, /\.filter\(s => !scopeHasMine\(\) \|\| isCurrentUserOrGroupAssignee\(s\.assignee\)\)/);
  assert.match(app, /const spare = openTasks\.filter\(t => !t\.dueDate && !isUnsortedTask\(t\) && normalizeText\(t\.status\) !== normalizeText\("確認待ち"\)\)/);
  assert.match(app, /function getGroupAssignee\(\)\s*\{\s*return sanitizeUser\(state\.roomName \|\| ""\);\s*\}/);
  assert.match(app, /function isCurrentUserOrGroupAssignee\(value\)/);
});

test('Ver.227 app owns Schedule Today lifecycle while the old sidecar is compatibility-only', () => {
  assert.match(app, /function syncScheduleTodayAnchor\s*\(/);
  assert.match(app, /function installScheduleTodayLifecycle\s*\(/);
  assert.match(app, /state\.scheduleRange === "today" && \["prev", "next"\]\.includes\(direction\)/);
  assert.match(app, /title="今日から7日間を表示します">7日間<\/button>/);
  assert.match(app, /window\.addEventListener\("pageshow", sync\)/);
  assert.match(app, /window\.addEventListener\("focus", sync\)/);
  assert.match(app, /setInterval\(sync, 60 \* 1000\)/);
  assert.match(scheduleLock, /installScheduleTodayLockV129/);
});

test('Ver.225 schedule copy keeps a simple entry point while supporting rich date rules and atomic schedule writes', () => {
  assert.match(html, /id="copySchedule"[^>]*>コピー<\/button>/);
  assert.match(html, /id="scheduleCopyDialog"/);
  for (const value of ['once', 'dates', 'daily', 'weekdays', 'weekly', 'monthlyDay', 'monthlyNth', 'monthEnd', 'lastWeekday', 'yearly']) {
    assert.match(html, new RegExp(`<option value="${value}">`));
  }
  assert.match(app, /const SCHEDULE_COPY_MAX = 200;/);
  assert.match(app, /function buildScheduleCopyDates\s*\(/);
  assert.match(app, /function scheduleCopyNthWeekday\s*\(/);
  assert.match(app, /function scheduleCopyLastWeekday\s*\(/);
  assert.match(app, /executeWrite\("schedule-copy", source\.id, async \(\) => \{/);
  assert.match(app, /if \(state\.connectionMode === "local-only"\) \{[\s\S]*return transactionRoom\(root => \{/);
  assert.match(app, /await get\(state\.schedulesRef\);/);
  assert.match(app, /runTransaction\(state\.schedulesRef, current => \{/);
  assert.match(app, /normalizeRevision\(currentSource\.revision\) !== normalizeRevision\(source\.revision\)/);
  assert.match(app, /root\.schedules\[item\.id\] = \{ \.\.\.item, revision: 1 \};/);
  assert.match(app, /schedules\[item\.id\] = \{ \.\.\.item, revision: 1 \};/);
  const remoteStartAt = app.indexOf('await get(state.schedulesRef)');
  const remoteTransactionAt = app.indexOf('runTransaction(state.schedulesRef, current => {', remoteStartAt);
  const remoteRevisionGuardAt = app.indexOf('normalizeRevision(currentSource.revision) !== normalizeRevision(source.revision)', remoteTransactionAt);
  assert.ok(remoteStartAt >= 0 && remoteTransactionAt > remoteStartAt && remoteRevisionGuardAt > remoteTransactionAt,
    'remote copy must use the warmed schedules collection and recheck the source revision inside that atomic transaction');
  assert.match(scheduleCopyStyle, /\.schedule-copy-dialog/);
  assert.match(scheduleCopyStyle, /@media\(max-width:640px\)/);
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
  assert.doesNotMatch(coreStyle, /#todayView\s*\[data-v108-hidden\]/);
});

test('other active foundation owners remain isolated after Schedule Today, list-sort, date-keyboard, version-display, and mobile-fixes retirement', () => {
  assert.match(dateKeyboard, /const DATE_MIN = "1900-01-01";/);
  assert.match(dateKeyboard, /const DATE_MAX = "9999-12-31";/);
  assert.match(dateKeyboard, /function isValidDateParts\(year, month, day\)/);
  assert.doesNotMatch(dateKeyboard, /function installStyle\s*\(/);

  assert.match(mobileShell, /function applyActiveColumn\s*\(/);
  assert.match(mobileShell, /tabs\.scrollLeft = Math\.max\(0, left\)/);
  assert.match(mobileShellStyle, /\.work-mobile-status-tabs\s*\{[\s\S]*overflow-x: auto !important;/);
  assert.doesNotMatch(mobileShell, /installRollingWeekRangePatch|patchVersion|createElement\("style"\)/);
  assert.match(legacyMobile, /function installRollingWeekRangePatch\(\)/);
});

test('Ver.232 config and static CSS exclusively derive displayed and compatibility versions from the manifest release', () => {
  assert.match(config, /const VERSION = window\.WORK_BOARD_RELEASE\?\.version/);
  assert.match(config, /window\.WORK_BOARD_VERSION\s*=\s*VERSION/);
  assert.match(config, /window\.WORK_BOARD_RELEASE_VERSION\s*=\s*VERSION/);
  assert.match(config, /window\.addEventListener\("focus", setVersion\)/);
  assert.match(config, /window\.addEventListener\("pageshow", setVersion\)/);
  assert.match(displayStyle, /\.workboard-version-display/);
  assert.match(displayLock, /window\.WORK_BOARD_RELEASE\?\.version/);
  assert.doesNotMatch(displayLock, /["']122["']/);
});
