import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const brand = readFileSync('brand-v185.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));

const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

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
