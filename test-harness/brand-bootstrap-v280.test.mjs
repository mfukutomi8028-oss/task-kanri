import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = readFileSync('config.js', 'utf8');
const brand = readFileSync('brand-v185.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));

const releaseMatch = manifest.match(/version:\s*["'](\d+)["']/);
const release = Number(releaseMatch?.[1] || 0);

test('Ver.281+ product: release and responsibility baseline remain aligned after release 263', () => {
  assert.ok(release >= 263, `expected release >= 263, got ${release}`);
  assert.equal(String(responsibilities.baselineRelease), String(release));
});

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
