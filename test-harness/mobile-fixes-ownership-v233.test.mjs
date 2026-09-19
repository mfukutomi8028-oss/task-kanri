import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = read('release-manifest.js');
const legacyMobile = read('mobile-fixes.js');
const mobileShell = read('mobile-shell-v234.js');
const mobileCss = read('ui-mobile-shell-v234.css');
const config = read('config.js');

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

function normalizeCss(source) {
  return source
    .replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .trim();
}

test('Ver.234 mobile shell ownership remains active in later releases and mobile-fixes stays retired', () => {
  assert.ok(Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0) >= 234);
  assert.deepEqual(extractStringArray(manifest, 'mobileScripts'), ['mobile-shell-v234.js']);
  assert.deepEqual(extractStringArray(manifest, 'optionalAssets'), ['mobile-shell-v234.js']);
  assert.ok(!extractStringArray(manifest, 'dynamicScripts').includes('mobile-fixes.js'));
  assert.ok(!extractStringArray(manifest, 'requiredAssets').includes('mobile-fixes.js'));
  assert.equal(extractStringArray(manifest, 'dynamicStyles').filter(name => name === 'ui-mobile-shell-v234.css').length, 1);
  assert.equal(extractStringArray(manifest, 'requiredAssets').filter(name => name === 'ui-mobile-shell-v234.css').length, 1);
  assert.ok(fs.existsSync(new URL('../mobile-fixes.js', import.meta.url)),
    'legacy mobile-fixes.js must remain physical for cached manifests and rollback');
});

test('Ver.234 semantic JS keeps the audited live mobile shell and board-tab responsibilities', () => {
  assert.match(mobileShell, /function ensureMobileHeader\(\)/);
  assert.match(mobileShell, /function patchMobileBoardTabs\(\)/);
  assert.match(mobileShell, /function applyActiveColumn\(activeIndex, scrollToTabs\)/);
  assert.match(mobileShell, /localStorage\.setItem\(STORAGE_ACTIVE_STATUS, String\(index\)\)/);
  assert.match(mobileShell, /button\.setAttribute\("aria-pressed", active \? "true" : "false"\)/);
  assert.match(mobileShell, /tabs\.scrollLeft = Math\.max\(0, left\)/);
  assert.match(mobileShell, /new MutationObserver\(scheduleBoardTabs\)\.observe\(boardView, \{ childList: true, subtree: true \}\)/);
  assert.match(mobileShell, /data-mobile-create="task"/);
  assert.match(mobileShell, /data-mobile-create="schedule"/);
});

test('Ver.234 semantic JS drops audited dead Schedule/version helpers and inline presentation', () => {
  assert.doesNotMatch(mobileShell, /function installStyle\(/);
  assert.doesNotMatch(mobileShell, /createElement\("style"\)/);
  assert.doesNotMatch(mobileShell, /installRollingWeekRangePatch/);
  assert.doesNotMatch(mobileShell, /resetScheduleAnchorBeforeRollingWeek/);
  assert.doesNotMatch(mobileShell, /Date\.prototype/);
  assert.doesNotMatch(mobileShell, /function patchVersion\(/);
  assert.doesNotMatch(mobileShell, /querySelectorAll\("\.app-version"\)/);

  assert.match(config, /element\.classList\.remove\("app-version"\)/);
  assert.match(config, /element\.classList\.add\("workboard-version-display"\)/);
  assert.match(config, /window\.addEventListener\("pageshow", setVersion\)/);
  assert.match(config, /window\.addEventListener\("focus", setVersion\)/);
});

test('Ver.234 external CSS is presentation-equivalent to the audited legacy inline block and loads last', () => {
  const legacyBlock = legacyMobile.match(/style\.textContent = `([\s\S]*?)`;\s*document\.head\.appendChild\(style\)/)?.[1];
  assert.ok(legacyBlock, 'legacy inline mobile CSS must remain readable for compatibility comparison');
  const expandedLegacy = legacyBlock.replace('${MOBILE_QUERY}', '(max-width: 860px)');
  assert.equal(normalizeCss(mobileCss), normalizeCss(expandedLegacy));

  const styles = extractStringArray(manifest, 'dynamicStyles');
  assert.equal(styles.at(-1), 'ui-mobile-shell-v234.css',
    'mobile presentation must keep the old inline patch cascade priority');
  assert.match(mobileCss, /@media\s*\(max-width:\s*860px\)/);
  assert.match(mobileCss, /\.work-mobile-status-tabs/);
  assert.match(mobileCss, /\.board-view \.board-column\.work-mobile-active-column/);
});
