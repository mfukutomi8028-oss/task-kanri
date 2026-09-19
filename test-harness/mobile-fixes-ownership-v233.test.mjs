import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = read('release-manifest.js');
const mobile = read('mobile-fixes.js');
const config = read('config.js');

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.233 audit keeps mobile-fixes as the only conditional mobile runtime patch', () => {
  assert.equal(manifest.match(/version:\s*"(\d+)"/)?.[1], '232',
    'audit-only checkpoint must not change the product release');
  assert.deepEqual(extractStringArray(manifest, 'mobileScripts'), ['mobile-fixes.js']);
  assert.deepEqual(extractStringArray(manifest, 'optionalAssets'), ['mobile-fixes.js']);
  assert.ok(!extractStringArray(manifest, 'dynamicScripts').includes('mobile-fixes.js'));
});

test('Ver.233 audit identifies the live mobile shell and board-tab responsibilities', () => {
  assert.match(mobile, /function installStyle\(\)/);
  assert.match(mobile, /function ensureMobileHeader\(\)/);
  assert.match(mobile, /function patchMobileBoardTabs\(\)/);
  assert.match(mobile, /function applyActiveColumn\(activeIndex, scrollToTabs\)/);
  assert.match(mobile, /localStorage\.setItem\(STORAGE_ACTIVE_STATUS, String\(index\)\)/);
  assert.match(mobile, /button\.setAttribute\("aria-pressed", active \? "true" : "false"\)/);
  assert.match(mobile, /tabs\.scrollLeft = Math\.max\(0, left\)/);
  assert.match(mobile, /new MutationObserver\(scheduleBoardTabs\)\.observe\(boardView, \{ childList: true, subtree: true \}\)/);
});

test('Ver.233 audit proves old schedule monkey-patch helpers are dormant', () => {
  assert.match(mobile, /function installRollingWeekRangePatch\(\)/);
  assert.match(mobile, /function resetScheduleAnchorBeforeRollingWeek\(event\)/);
  assert.equal((mobile.match(/installRollingWeekRangePatch\(\);/g) || []).length, 0,
    'Date.prototype rolling-week patch must not be invoked');
  assert.equal((mobile.match(/resetScheduleAnchorBeforeRollingWeek\(/g) || []).length, 1,
    'schedule-anchor helper must only remain as its declaration');
  assert.match(mobile, /7日間表示はapp\.js本体で処理するため、Date\.prototypeは変更しない/);
});

test('Ver.233 audit proves mobile version patch is obsolete after Ver.232 canonicalization', () => {
  assert.match(mobile, /function patchVersion\(\)/);
  assert.match(mobile, /document\.querySelectorAll\("\.app-version"\)/);
  assert.match(config, /element\.classList\.remove\("app-version"\)/);
  assert.match(config, /element\.classList\.add\("workboard-version-display"\)/);
  assert.match(config, /window\.addEventListener\("pageshow", setVersion\)/);
  assert.match(config, /window\.addEventListener\("focus", setVersion\)/);
  assert.doesNotMatch(mobile, /querySelectorAll\("\.workboard-version-display"\)/,
    'mobile patch must not become a second owner of the canonical Ver.232 display');
});
