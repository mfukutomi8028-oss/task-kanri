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

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.219 manifest is the release-version source and stable is absent from active inventory', () => {
  assert.match(manifest, /version:\s*["']219["']/);
  assert.match(manifest, /const VERSION = ["']219["']/);
  assert.match(manifest, /installFirstPaintGuardV219/);
  assert.match(manifest, /wb-first-paint-v219/);

  const required = extractStringArray(manifest, 'requiredAssets');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  assert.equal(required.includes('stable-fixes-v108.js'), false);
  assert.equal(scripts.includes('stable-fixes-v108.js'), false);

  const dateIndex = scripts.indexOf('date-keyboard-fix-v127.js');
  const todayIndex = scripts.indexOf('schedule-today-lock-v129.js');
  const sortIndex = scripts.indexOf('list-sort-v131.js');
  const versionIndex = scripts.indexOf('version-display-lock.js');
  assert.ok(dateIndex >= 0 && dateIndex < todayIndex && todayIndex < sortIndex && sortIndex < versionIndex);
  assert.match(manifest, /"user-ux-polish-v208\.js"/);
  assert.ok(fs.existsSync(new URL('../stable-fixes-v108.js', import.meta.url)),
    'legacy stable file must remain for cached pre-Ver.219 manifests');
});

test('Ver.217 user UX presentation translates Star wording to お気に入り without changing favorite state ownership', () => {
  assert.match(userUx, /setTrailingText\(button, 'お気に入り'\)/);
  assert.match(userUx, /setTrailingText\(favoriteRow, 'お気に入りのみ'\)/);
  assert.match(userUx, /active \? 'お気に入り解除' : 'お気に入り'/);
  assert.match(userUx, /active \? 'お気に入りを解除' : 'お気に入りに追加'/);
  assert.match(userUx, /\.replace\('スターを付けました', 'お気に入りに追加しました'\)/);
  assert.match(userUx, /\.replace\('スターを外しました', 'お気に入りから外しました'\)/);
  assert.match(userUx, /data-star-task/);
  assert.doesNotMatch(userUx, /favoriteTaskIds\s*=/,
    'presentation polish must not take ownership of favorite persistence');
});

test('Ver.219 Today visibility is rendered by app.js while remaining foundation owners stay isolated', () => {
  assert.doesNotMatch(coreStyle, /data-v108-hidden/);
  assert.doesNotMatch(manifest, /dynamicScripts:[\s\S]*stable-fixes-v108\.js/);

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

  assert.match(scheduleLock, /function normalizeWeekRangeLabel\s*\(/);
  assert.match(scheduleLock, /button\.textContent = ["']7日間["']/);
  assert.match(scheduleLock, /button\.title = ["']今日から7日間を表示します["']/);
  assert.equal((scheduleLock.match(/new MutationObserver/g) || []).length, 1);
});

test('legacy stable file stays frozen as compatibility-only code and does not regain unrelated owners', () => {
  assert.doesNotMatch(stable, /const VERSION\s*=/);
  assert.doesNotMatch(stable, /WORK_BOARD_VERSION\s*=/);
  assert.doesNotMatch(stable, /function patchScheduleRangeLabel\s*\(/);
  assert.doesNotMatch(stable, /function patchStatusTabAutoScroll\s*\(/);
  assert.doesNotMatch(stable, /function patchDateInputs\s*\(/);
  assert.doesNotMatch(stable, /card\.hidden\s*=\s*shouldHide/);
});

test('version display lock exclusively derives displayed and compatibility versions from the manifest release', () => {
  assert.match(displayLock, /window\.WORK_BOARD_RELEASE\?\.version/);
  assert.match(displayLock, /window\.WORK_BOARD_VERSION\s*=\s*version/);
  assert.doesNotMatch(displayLock, /["']122["']/);
});
