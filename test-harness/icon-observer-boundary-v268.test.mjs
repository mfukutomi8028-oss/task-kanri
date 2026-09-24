import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [manifest, app, brand, icons] = await Promise.all([
  read('release-manifest.js'),
  read('app.js'),
  read('brand-v185.js'),
  read('icon-system-v169.js')
]);

const legacyAssets = [
  'assets/nav-today-v87.png',
  'assets/nav-task-v87.png',
  'assets/nav-schedule-v87.png',
  'assets/nav-star-menu.png',
  'assets/nav-done.png',
  'assets/summary-open.png',
  'assets/summary-overdue.png',
  'assets/summary-today.png'
];

test('Ver.268 audit: release manifest keeps one documentElement-wide legacy icon observer alive', () => {
  assert.match(manifest, /new MutationObserver\(records =>/);
  assert.match(manifest, /iconObserver\.observe\(root, \{ childList: true, subtree: true \}\)/);
  assert.match(manifest, /window\.__WB_LEGACY_ICON_OBSERVER_V256__ = iconObserver/);
});

test('Ver.268 audit: assets-ready reveal does not disconnect the legacy icon observer', () => {
  const reveal = manifest.match(/function revealCurrentUi\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(reveal.length > 0);
  assert.doesNotMatch(reveal, /iconObserver\.disconnect\(\)/);
  assert.doesNotMatch(manifest, /workboard:assets-ready[^\n]*iconObserver\.disconnect/);
});

test('Ver.268 audit: runtime app no longer generates the mapped legacy navigation and summary assets', () => {
  for (const asset of legacyAssets) assert.doesNotMatch(app, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('Ver.268 audit: brand and icon-system already own current brand/navigation/summary correction', () => {
  assert.match(brand, /patchBrandMark\(\)/);
  assert.match(brand, /patchBrowserIcons\(\)/);
  assert.match(brand, /window\.addEventListener\('pageshow', apply\)/);
  assert.match(icons, /const NAV_ICONS = \[/);
  assert.match(icons, /const SUMMARY_ICONS = \[/);
  assert.match(icons, /applyIcons\(\)/);
  assert.match(icons, /attempts >= 24/);
});

test('Ver.268 audit: release observer current unique behavior is generic late legacy-image compatibility', () => {
  assert.match(manifest, /record\.addedNodes\.forEach\(patchNode\)/);
  assert.match(manifest, /node\.querySelectorAll\?\.\('img'\)\.forEach\(upgradeImage\)/);
  assert.match(manifest, /legacyIconMap\.get\(assetKey\(img\.getAttribute\('src'\)\)\)/);
});
