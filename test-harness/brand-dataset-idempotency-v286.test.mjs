import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const brand = readFileSync('brand-v185.js', 'utf8');
const config = readFileSync('config.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
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
