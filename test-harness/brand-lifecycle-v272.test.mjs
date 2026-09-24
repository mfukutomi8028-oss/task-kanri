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

test('Ver.272 audit: release and responsibility baseline stay at 258', () => {
  assert.equal(manifest.match(/version:\s*"(\d+)"/)?.[1], '258');
  assert.equal(responsibilities.baselineRelease, '258');
});

test('Ver.272 audit: brand startup contains an immediate favicon pass followed by apply favicon pass', () => {
  const topLevelAt = brand.indexOf('// Favicon replacement can happen as soon as the dynamic patch is evaluated.');
  assert.ok(topLevelAt >= 0);
  const afterComment = brand.slice(topLevelAt);
  assert.match(afterComment, /patchBrowserIcons\(\);[\s\S]*?document\.readyState/);

  const apply = brand.match(/function apply\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(apply.length > 0);
  assert.match(apply, /patchBrandMark\(\);/);
  assert.match(apply, /patchBrowserIcons\(\);/);
  assert.match(apply, /patchNotifications\(\);/);
  assert.match(brand, /else \{\s*apply\(\);\s*\}/);
});

test('Ver.272 audit: brand pageshow reuses the full apply lifecycle', () => {
  assert.match(brand, /window\.addEventListener\('pageshow', apply\)/);
});

test('Ver.272 audit: notification wrapper is independently idempotent by brand version', () => {
  assert.match(brand, /current\.__workBoardBrandVersion === VERSION/);
  assert.match(brand, /Object\.defineProperty\(WorkBoardNotification, '__workBoardBrandVersion'/);
});

test('Ver.272 audit: canonical loader patches legacy brand before loading brand-v185 first among dynamic scripts', () => {
  const start = config.match(/async function start\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(start.length > 0);
  assert.ok(start.indexOf('patchBrandIcons();') >= 0);
  assert.ok(start.indexOf('for (const [src, marker] of SCRIPTS)') > start.indexOf('patchBrandIcons();'));

  const scripts = manifest.match(/dynamicScripts:\s*\[([^\]]+)\]/)?.[1] || '';
  const names = [...scripts.matchAll(/"([^"]+\.js)"/g)].map(match => match[1]);
  assert.equal(names[0], 'brand-v185.js');
});

test('Ver.272 audit: static HTML still carries legacy favicon and Notification compatibility that brand-v185 upgrades', () => {
  assert.match(index, /href="assets\/brand\.png\?v=143"/);
  assert.match(index, /function BoardNotification\(title, options\)/);
  assert.match(index, /icon: "assets\/brand\.png\?v=143"/);
});
