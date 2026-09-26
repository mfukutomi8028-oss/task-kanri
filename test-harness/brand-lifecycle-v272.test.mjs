import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [brand, config, index, manifest, responsibilitySource] = await Promise.all([
  read('brand-v185.js'),
  read('config.js'),
  read('index.html'),
  read('release-manifest.js'),
  read('patch-responsibilities.json')
]);
const responsibilities = JSON.parse(responsibilitySource);

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
