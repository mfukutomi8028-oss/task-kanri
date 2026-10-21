import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const brand = readFileSync('brand-v185.js', 'utf8');
const config = readFileSync('config.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const index = readFileSync('index.html', 'utf8');
const audit = readFileSync('docs/HISTORICAL_VERSION_BRAND_HANDOFF_AUDITS_V516.md', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));

const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);
const standaloneNeedle = `  // Correct the loader's compatibility favicon as soon as this runtime arrives.\n  patchBrowserIcons();`;

test('Ver.287+ product: release 266 or later matches responsibility baseline', () => {
  assert.ok(release >= 266);
  assert.equal(String(responsibilities.baselineRelease), String(release));
});

test('Ver.287 product: pageshow recovery stays persisted-only', () => {
  assert.match(brand, /window\.addEventListener\('pageshow', event => \{[\s\S]*if \(event\.persisted\) apply\(\);[\s\S]*\}\);/);
  assert.doesNotMatch(brand, /window\.addEventListener\('pageshow', apply\)/);
});

test('Ver.287 product: brand, favicon, Notification and dataset writes are idempotent', () => {
  assert.match(brand, /if \(img\.getAttribute\('src'\) !== SVG_ICON\) img\.setAttribute\('src', SVG_ICON\)/);
  assert.match(brand, /if \(!document\.head \|\| browserIconsAreCurrent\(\)\) return;/);
  assert.match(brand, /if \(!current \|\| current\.__workBoardBrandVersion === VERSION\) return;/);
  assert.match(brand, /if \(document\.documentElement\.dataset\.brandVersion !== VERSION\) \{[\s\S]*document\.documentElement\.dataset\.brandVersion = VERSION;[\s\S]*\}/);
});

test('Ver.287 product: responsibility ledger records the promoted Ver.286 finding', () => {
  const iconGroup = responsibilities.groups?.find(group => group.id === 'icon-system');
  assert.match(iconGroup?.reason || '', /Ver\.287製品/);
  assert.match(iconGroup?.reason || '', /data-brand-version/);
  assert.match(iconGroup?.reason || '', /idempotent/);
});

// Ver.280 / Ver.282: distinct startup and ownership guards retained after consolidation.
test('Ver.281 product: config no longer owns bootstrap brand or favicon mutation', () => {
  assert.doesNotMatch(config, /function\s+patchBrandIcons\s*\(/);
  assert.doesNotMatch(config, /function\s+upsertIconLink\s*\(/);
  assert.doesNotMatch(config, /patchBrandIcons\s*\(\s*\)/);
  assert.doesNotMatch(config, /assets\/brand\.png/);

  const startIndex = config.indexOf('async function start()');
  const versionIndex = config.indexOf('setVersion();', startIndex);
  const styleLoadIndex = config.indexOf('STYLES.map', versionIndex);
  assert.ok(startIndex >= 0 && versionIndex > startIndex && styleLoadIndex > versionIndex);
});

test('Ver.281+ product: canonical brand runtime keeps startup and recovery ownership as later releases shrink duplicate work', () => {
  assert.match(manifest, /["']brand-v185\.js["']/);
  assert.match(brand, /assets\/brand-v184\.svg\?v=\$\{VERSION\}/);
  assert.match(brand, /assets\/brand-v184\.png\?v=\$\{VERSION\}/);
  assert.match(brand, /function apply\(\)[\s\S]*patchBrandMark\(\);[\s\S]*patchBrowserIcons\(\);[\s\S]*patchNotifications\(\)/);
  assert.match(brand, /window\.addEventListener\('pageshow'/);
  if (release >= 265) {
    assert.match(brand, /if \(event\.persisted\) apply\(\)/);
  }
});

test('Ver.281 product: responsibility ledger retains config bootstrap retirement after later brand cleanup', () => {
  const iconGroup = responsibilities.groups?.find(group => group.id === 'icon-system');
  assert.ok(iconGroup, 'icon-system responsibility group must exist');
  assert.match(iconGroup.reason, /Ver\.281製品/);
  assert.match(iconGroup.reason, /patchBrandIcons/);
});

test('Ver.283 product: brand startup owns browser icon correction only through apply', () => {
  const calls = brand.match(/\bpatchBrowserIcons\(\);/g) || [];
  assert.equal(calls.length, 1, 'expected only the apply-owned patchBrowserIcons call');
  assert.ok(!brand.includes(standaloneNeedle), 'standalone startup correction must be retired');
  assert.match(brand, /function apply\(\)[\s\S]*patchBrandMark\(\);[\s\S]*patchBrowserIcons\(\);[\s\S]*patchNotifications\(\)/);
});

test('Ver.283 product: dynamic loader still reaches apply on the normal post-loading path', () => {
  assert.match(manifest, /["']brand-v185\.js["']/);
  assert.match(config, /document\.addEventListener\(["']DOMContentLoaded["'],\s*start/);
  assert.match(config, /for \(const \[src, marker\] of SCRIPTS\)[\s\S]*await loadScript\(src, marker\)/);
  assert.match(brand, /if \(document\.readyState === 'loading'\)[\s\S]*else \{\s*apply\(\);\s*\}/);
});

test('Ver.283+ product: canonical apply keeps brand, favicon and Notification together while later releases may narrow pageshow recovery', () => {
  assert.match(brand, /function apply\(\)[\s\S]*patchBrandMark\(\);[\s\S]*patchBrowserIcons\(\);[\s\S]*patchNotifications\(\);[\s\S]*dataset\.brandVersion = VERSION/);
  assert.match(brand, /window\.addEventListener\('pageshow'/);
  assert.match(brand, /function browserIconsAreCurrent\(\)/);
  assert.match(brand, /if \(!document\.head \|\| browserIconsAreCurrent\(\)\) return;/);
  if (release >= 265) {
    assert.match(brand, /if \(event\.persisted\) apply\(\)/);
  }
});

test('Ver.283 product: responsibility ledger retains the retirement after later brand cleanup', () => {
  const iconGroup = responsibilities.groups.find(group => group.id === 'icon-system');
  assert.ok(iconGroup?.reason.includes('Ver.282監査'));
  assert.ok(iconGroup?.reason.includes('Ver.283製品'));
});

// Ver.272 historical brand lifecycle guards: unchanged assertions, including strict baseline type.
test('Ver.273+ product: brand idempotency remains present in release 259 or later', () => {
  const release = manifest.match(/version:\s*"(\d+)"/)?.[1] || '';
  assert.ok(Number(release) >= 259);
  assert.equal(responsibilities.baselineRelease, release);
});

test('Ver.273+ product: favicon recovery remains current-set aware while Ver.283 keeps startup correction apply-owned', () => {
  assert.match(brand, /const ICON_SELECTOR =/);
  assert.match(brand, /const EXPECTED_ICONS = \[/);
  assert.match(brand, /function browserIconsAreCurrent\(\)/);
  assert.match(brand, /links\.length !== EXPECTED_ICONS\.length/);
  assert.match(brand, /EXPECTED_ICONS\.every\(expected => links\.some\(link => iconLinkMatches\(link, expected\)\)\)/);

  const patch = brand.match(/function patchBrowserIcons\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(patch.length > 0);
  assert.match(patch, /if \(!document\.head \|\| browserIconsAreCurrent\(\)\) return;/);
  assert.match(patch, /document\.head\.querySelectorAll\(ICON_SELECTOR\)\.forEach\(link => link\.remove\(\)\)/);
  assert.match(patch, /EXPECTED_ICONS\.forEach/);

  const calls = brand.match(/\bpatchBrowserIcons\(\);/g) || [];
  assert.equal(calls.length, 1);
  assert.doesNotMatch(brand, /Correct the loader's compatibility favicon as soon as this runtime arrives/);
});

test('Ver.273+ product: apply keeps brand mark, favicon and Notification under one lifecycle with pageshow recovery retained', () => {
  const apply = brand.match(/function apply\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(apply.length > 0);
  assert.match(apply, /patchBrandMark\(\);/);
  assert.match(apply, /patchBrowserIcons\(\);/);
  assert.match(apply, /patchNotifications\(\);/);
  assert.match(brand, /window\.addEventListener\('pageshow'/);

  const release = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);
  if (release >= 265) {
    assert.match(brand, /if \(event\.persisted\) apply\(\)/);
  }
});

test('Ver.273 product: notification wrapper remains independently idempotent by brand version', () => {
  assert.match(brand, /current\.__workBoardBrandVersion === VERSION/);
  assert.match(brand, /Object\.defineProperty\(WorkBoardNotification, '__workBoardBrandVersion'/);
});

test('Ver.273+ product: canonical brand runtime loads first and later releases may retire config compatibility bootstrap', () => {
  const scripts = manifest.match(/dynamicScripts:\s*\[([^\]]+)\]/)?.[1] || '';
  const names = [...scripts.matchAll(/"([^"]+\.js)"/g)].map(match => match[1]);
  assert.equal(names[0], 'brand-v185.js');

  const start = config.match(/async function start\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(start.length > 0);
  assert.ok(start.indexOf('for (const [src, marker] of SCRIPTS)') >= 0);

  const release = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);
  if (release >= 263) {
    assert.doesNotMatch(config, /patchBrandIcons\s*\(\s*\)/);
    assert.doesNotMatch(config, /function\s+upsertIconLink\s*\(/);
  }
});

test('Ver.273 product: static HTML compatibility remains available for old favicon and Notification clients', () => {
  assert.match(index, /href="assets\/brand\.png\?v=143"/);
  assert.match(index, /function BoardNotification\(title, options\)/);
  assert.match(index, /icon: "assets\/brand\.png\?v=143"/);
});

// Ver.284 persisted pageshow cold-boot product and immutable audit evidence.
test('Ver.285 product: startup keeps one canonical apply and pageshow recovery is persisted-only', () => {
  const calls = brand.match(/\bpatchBrowserIcons\(\);/g) || [];
  assert.equal(calls.length, 1, 'favicon correction must remain apply-owned');
  assert.match(brand, /function apply\(\)[\s\S]*patchBrandMark\(\);[\s\S]*patchBrowserIcons\(\);[\s\S]*patchNotifications\(\);[\s\S]*dataset\.brandVersion = VERSION/);
  assert.doesNotMatch(brand, /window\.addEventListener\('pageshow', apply\)/);
  assert.match(brand, /window\.addEventListener\('pageshow', event => \{[\s\S]*if \(event\.persisted\) apply\(\);[\s\S]*\}\);/);
});

test('Ver.285 product: no-drift guards remain while dataset assignment stays available for Ver.286 audit', () => {
  assert.match(brand, /if \(img\.getAttribute\('src'\) !== SVG_ICON\) img\.setAttribute\('src', SVG_ICON\)/);
  assert.match(brand, /if \(!document\.head \|\| browserIconsAreCurrent\(\)\) return;/);
  assert.match(brand, /if \(!current \|\| current\.__workBoardBrandVersion === VERSION\) return;/);
  assert.match(brand, /document\.documentElement\.dataset\.brandVersion = VERSION;/);
});

test('Ver.285 product: ledger retains Ver.284 evidence and Ver.285 product after later audits advance', () => {
  const iconGroup = responsibilities.groups.find(group => group.id === 'icon-system');
  assert.ok(iconGroup?.reason.includes('Ver.284監査'));
  assert.ok(iconGroup?.reason.includes('Ver.285製品'));
  assert.ok(
    iconGroup?.reason.includes('Ver.286監査') ||
      (responsibilities.priorityCandidates || []).some(candidate => /Ver\.286監査/.test(candidate?.goal || '')),
    'Ver.286 audit must remain recorded either as completed history or the current candidate'
  );
  assert.ok(
    iconGroup?.reason.includes('data-brand-version') ||
      (responsibilities.priorityCandidates || []).some(candidate => /data-brand-version/.test(candidate?.goal || '')),
    'data-brand-version audit history must remain durable after promotion'
  );
});

test('Ver.284 audit record remains durable evidence for the persisted-only product decision', () => {
  assert.match(audit, /cold boot初回pageshowを実行しなくても、startup `apply\(\)` だけで最終canonical状態は完全に成立した/);
  assert.match(audit, /BFCache相当のpersisted pageshow recoveryには独立した復旧価値がある/);
  assert.match(audit, /Ver\.285製品化候補/);
  assert.match(audit, /`persisted=false` は `apply\(\)` を再実行しない/);
  assert.match(audit, /`persisted=true` では従来どおり `apply\(\)` を実行する/);
});
