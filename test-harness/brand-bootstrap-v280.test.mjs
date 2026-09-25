import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = readFileSync('config.js', 'utf8');
const brand = readFileSync('brand-v185.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));

const releaseMatch = manifest.match(/version:\s*["'](\d+)["']/);
const release = Number(releaseMatch?.[1] || 0);

test('Ver.280 audit: release 262+ keeps config bootstrap brand patch and canonical brand runtime ordered', () => {
  assert.ok(release >= 262, `expected release >= 262, got ${release}`);
  assert.equal(String(responsibilities.baselineRelease), String(release));

  const startIndex = config.indexOf('async function start()');
  const versionIndex = config.indexOf('setVersion();', startIndex);
  const bootstrapIndex = config.indexOf('patchBrandIcons();', versionIndex);
  const styleLoadIndex = config.indexOf('STYLES.map', bootstrapIndex);
  assert.ok(startIndex >= 0 && versionIndex > startIndex && bootstrapIndex > versionIndex);
  assert.ok(styleLoadIndex > bootstrapIndex, 'bootstrap brand patch must run before dynamic assets load');

  assert.match(manifest, /["']brand-v185\.js["']/);
  assert.match(brand, /patchBrowserIcons\(\);\s*\n\s*if \(document\.readyState === 'loading'\)/);
  assert.match(brand, /window\.addEventListener\('pageshow', apply\)/);
});

test('Ver.280 audit: config bootstrap is compatibility-only while brand-v185 owns canonical assets', () => {
  assert.match(config, /const brandIcon = assetUrl\('assets\/brand\.png'\)/);
  assert.match(config, /\.brand-mark img/);
  assert.match(config, /upsertIconLink\("icon", brandIcon/);

  assert.match(brand, /assets\/brand-v184\.svg\?v=\$\{VERSION\}/);
  assert.match(brand, /assets\/brand-v184\.png\?v=\$\{VERSION\}/);
  assert.match(brand, /function apply\(\)[\s\S]*patchBrandMark\(\);[\s\S]*patchBrowserIcons\(\);[\s\S]*patchNotifications\(\)/);
});

test('Ver.280 audit: responsibility ledger targets the config-to-brand handoff without changing product runtime', () => {
  const candidate = responsibilities.priorityCandidates?.find(item => String(item.goal || '').includes('Ver.280'));
  assert.ok(candidate, 'Ver.280 audit candidate must remain recorded');
  assert.deepEqual(candidate.scope, ['brand-v185.js', 'ui-brand-v185.css']);
  assert.match(candidate.goal, /patchBrandIcons/);
  assert.match(candidate.goal, /brand-v185\.js/);
});
