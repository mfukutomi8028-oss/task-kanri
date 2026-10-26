import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LEGACY_CSS_ALIASES, LEGACY_RUNTIME_ALIASES, FROZEN_RETIRED_CSS_BLOBS_V403 } from './build-pages-runtime-v382.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = read('release-manifest.js');
const legacyMobile = JSON.parse(read('compat/frozen-legacy-runtime-v397.json'))['mobile-fixes.js'];
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
  assert.equal(fs.existsSync(new URL('../mobile-fixes.js', import.meta.url)), false,
    'retired combined mobile JS must leave Git root');
  assert.equal(typeof legacyMobile, 'string', 'old inline CSS source must remain archived');
});

test('Ver.234+ semantic JS keeps the audited live mobile shell and board-tab responsibilities', () => {
  assert.match(mobileShell, /function ensureMobileHeader\(\)/);
  assert.match(mobileShell, /function patchMobileBoardTabs\(\)/);
  assert.match(mobileShell, /function applyActiveColumn\(activeIndex, scrollToTabs\)/);
  assert.match(mobileShell, /localStorage\.setItem\(STORAGE_ACTIVE_STATUS, String\(index\)\)/);
  assert.match(mobileShell, /button\.setAttribute\("aria-pressed", active \? "true" : "false"\)/);
  assert.match(mobileShell, /tabs\.scrollLeft = Math\.max\(0, left\)/);
  assert.match(mobileShell, /const boardView = document\.getElementById\("boardView"\)/);
  assert.match(mobileShell, /new MutationObserver\(/);
  assert.match(mobileShell, /\.observe\(boardView, \{ childList: true \}\)/);
  assert.doesNotMatch(mobileShell, /observe\(boardView, \{ childList: true, subtree: true \}\)/);
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

test('Ver.234+ mobile CSS preserves legacy presentation except the Ver.373 hidden-row boundary and loads last', () => {
  const legacyBlock = legacyMobile.match(/style\.textContent = `([\s\S]*?)`;\s*document\.head\.appendChild\(style\)/)?.[1];
  assert.ok(legacyBlock, 'legacy inline mobile CSS must remain readable for compatibility comparison');
  const expandedLegacy = legacyBlock.replace('${MOBILE_QUERY}', '(max-width: 860px)');
  // Ver.373 excludes hidden/archived/reserved rows from the mobile grid rule.
  // Everything else must remain equivalent; do not rewrite the rollback source.
  const legacySelector = '.task-table tr {';
  const visibleSelector = '.task-table tr:not([hidden]):not(.workflow-task-archived-v152):not(.future-task-v167-hidden) {';
  assert.equal(expandedLegacy.split(legacySelector).length - 1, 1);
  assert.equal(mobileCss.split(visibleSelector).length - 1, 1);
  assert.ok(!mobileCss.includes(legacySelector));
  const expected = expandedLegacy.replace(legacySelector, visibleSelector);
  assert.equal(normalizeCss(mobileCss), normalizeCss(expected));

  const styles = extractStringArray(manifest, 'dynamicStyles');
  assert.equal(styles.at(-1), 'ui-mobile-shell-v234.css',
    'mobile presentation must keep the old inline patch cascade priority');
  assert.match(mobileCss, /@media\s*\(max-width:\s*860px\)/);
  assert.match(mobileCss, /\.work-mobile-status-tabs/);
  assert.match(mobileCss, /\.board-view \.board-column\.work-mobile-active-column/);
});


test('Ver.187+ keeps mixed ui-v157 retired while preserving each mobile correction in its owning CSS', () => {
  const manifest = read('release-manifest.js');
  const release = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);
  assert.ok(release >= 187, `mobile ownership contract requires release 187 or later, got ${release}`);

  const required = extractStringArray(manifest, 'requiredAssets');
  const styles = extractStringArray(manifest, 'dynamicStyles');
  const hasReviewedMotion = styles.includes('ui-motion-v533.css');
  // Ver.533: one reviewed, feature-owned motion stylesheet is allowed;
  // the legacy mobile shell MUST remain the final stylesheet.
  const maxStyles = release >= 234 ? (hasReviewedMotion ? 26 : 25) : release >= 232 ? 24 : 23;
  if (hasReviewedMotion) {
    assert.equal(styles.filter(name => name === 'ui-motion-v533.css').length, 1);
    assert.equal(styles.at(-2), 'ui-motion-v533.css',
      'motion must be loaded immediately before the existing mobile shell');
  }
  // One reviewed Ver.535 visual-only layer is not a legacy functional patch.
  const signalStyles = styles.filter(name => name === 'ui-signal-light-v535.css');
  assert.ok(signalStyles.length <= 1, 'SIGNAL Light must not load twice');
  if (signalStyles.length) {
    assert.equal(styles.indexOf('ui-signal-light-v535.css'), styles.indexOf('ui-motion-v533.css') - 1,
      'SIGNAL Light must precede motion and final mobile shell');
    assert.ok(required.includes('ui-signal-light-v535.css'));
  }
  const reviewedBaseStyles = styles.filter(name => name !== 'ui-signal-light-v535.css');
  assert.ok(reviewedBaseStyles.length <= maxStyles,
    `Ver.187+ must stay within the reviewed stylesheet count for release ${release}; got ${styles.length}, max ${maxStyles}`);
  if (release >= 232) {
    assert.equal(styles.filter(name => name === 'ui-version-display-v232.css').length, 1,
      'Ver.232 may add exactly one dedicated version-display stylesheet beyond the prior bound');
  }
  if (release >= 234) {
    assert.equal(styles.filter(name => name === 'ui-mobile-shell-v234.css').length, 1,
      'Ver.234 may add exactly one dedicated mobile-shell stylesheet beyond the Ver.232 bound');
    assert.equal(styles.at(-1), 'ui-mobile-shell-v234.css',
      'externalized mobile shell CSS must preserve the former inline patch cascade priority');
  }
  assert.ok(!required.includes('ui-v157.css'), 'ui-v157.css must no longer be a required runtime asset');
  assert.ok(!styles.includes('ui-v157.css'), 'ui-v157.css must no longer be dynamically loaded');
  assert.equal(fs.existsSync(path.join(ROOT, 'ui-v157.css')), false, 'Ver.403 retires redundant cached CSS from Git root');
  const oldMobile = JSON.parse(read('compat/frozen-legacy-runtime-v397.json'))['ui-v157.css'];
  assert.equal(typeof oldMobile, 'string', 'cached mobile CSS source must remain archived');
  assert.equal(FROZEN_RETIRED_CSS_BLOBS_V403['ui-v157.css'], 'c241129803d6a1fc4c6ff660a42c8940effc1e01', 'cached mobile CSS Git blob must remain pinned');

  assert.equal(LEGACY_CSS_ALIASES['ui-v148.css'], 'ui-workflow-insights-v192.css',
    'legacy cached CSS URL must keep the proven mobile rule');
  const v148 = read('ui-workflow-insights-v192.css');
  assert.match(v148, /\.task-table td:nth-child\(3\) \.workflow-time-inline-v148\{margin-left:10px;vertical-align:middle\}/);
  assert.match(v148, /@media\(max-width:420px\)\{\.task-table td:nth-child\(3\) \.workflow-time-inline-v148\{margin-left:8px\}\}/);

  assert.equal(LEGACY_CSS_ALIASES['ui-v149.css'], 'ui-task-prerequisites-comments-v192.css',
    'legacy cached CSS URL must keep touch target rules');
  const v149 = read('ui-task-prerequisites-comments-v192.css');
  assert.match(v149, /\.task-detail-tab-v149,[\s\S]*\.detail-actions-v2 \.main-actions>button,[\s\S]*\.detail-actions-v2 \.sub-actions>button\{min-height:44px!important\}/);

  assert.equal(LEGACY_RUNTIME_ALIASES['ui-v156.css'], 'ui-comment-mentions-v191.css',
    'legacy mention CSS URL must remain published');
  const v156 = read('ui-comment-mentions-v191.css');
  assert.match(v156, /\.workflow-mention-shell-v156\{z-index:1440!important\}/);
  assert.match(v156, /\.workflow-mention-users-v156\{-webkit-overflow-scrolling:touch;overscroll-behavior:contain\}/);

  const inboxArchive = read('ui-inbox-archive-v186.css');
  for (const snippet of [
    '.workflow-inbox-shell-v152,.workflow-inbox-shell-v153{z-index:1420!important}',
    '.workflow-archive-shell-v153{z-index:1430!important}',
    '#toast.toast{z-index:1500!important}',
    '.workflow-drawer-v152{height:100dvh!important;max-height:100dvh!important}',
    '#todayView .activity-actions>[data-open-personal-inbox-v153]{grid-column:1/-1!important}',
    '.workflow-inbox-read-v152{min-height:44px!important;padding:8px 12px!important}',
    '.workflow-inbox-list-v152,.workflow-archive-list-v153{-webkit-overflow-scrolling:touch;overscroll-behavior:contain}',
    '.workflow-inbox-shell-v153 .workflow-drawer-v152{width:100vw!important;max-width:100vw!important}'
  ]) {
    assert.ok(inboxArchive.includes(snippet), `missing migrated inbox/archive rule: ${snippet}`);
  }
});
