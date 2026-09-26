import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [manifest, app, brand, icons, responsibilitySource] = await Promise.all([
  read('release-manifest.js'),
  read('app.js'),
  read('brand-v185.js'),
  read('icon-system-v169.js'),
  read('patch-responsibilities.json')
]);
const responsibilities = JSON.parse(responsibilitySource);

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

test('Ver.269+ product: legacy observer remains available during first paint', () => {
  assert.match(manifest, /new MutationObserver\(records =>/);
  assert.match(manifest, /iconObserver\.observe\(root, \{ childList: true, subtree: true \}\)/);
  assert.match(manifest, /window\.__WB_LEGACY_ICON_OBSERVER_V\d+__ = iconObserver/);
  assert.match(manifest, /record\.addedNodes\.forEach\(patchNode\)/);
});

test('Ver.269+ product: assets-ready performs a final image sweep before disconnecting the broad observer', () => {
  const finalize = manifest.match(/function finalizeLegacyIconCompatibility\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(finalize.length > 0, 'finalizeLegacyIconCompatibility must exist');
  const sweepAt = finalize.indexOf("document.querySelectorAll('img').forEach(upgradeImage)");
  const disconnectAt = finalize.indexOf('iconObserver.disconnect()');
  assert.ok(sweepAt >= 0, 'final image sweep must remain present');
  assert.ok(disconnectAt > sweepAt, 'observer must disconnect only after the final image sweep');

  const ready = manifest.match(/function handleAssetsReady\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(ready.indexOf('finalizeLegacyIconCompatibility()') >= 0);
  assert.ok(ready.indexOf('revealCurrentUi()') > ready.indexOf('finalizeLegacyIconCompatibility()'));
  assert.match(manifest, /window\.addEventListener\('workboard:assets-ready', handleAssetsReady, \{ once: true \}\)/);
});

test('Ver.269+ product: four-second reveal fallback does not terminate compatibility before assets-ready', () => {
  assert.match(manifest, /window\.setTimeout\(revealCurrentUi, 4000\)/);
  assert.doesNotMatch(manifest, /window\.setTimeout\(handleAssetsReady, 4000\)/);
});

test('Ver.269+ product: release manifest and responsibility baseline advance together', () => {
  const manifestVersion = manifest.match(/version:\s*"(\d+)"/)?.[1] || '';
  assert.ok(Number(manifestVersion) >= 257, 'Ver.269 boundary requires release 257 or later');
  assert.equal(responsibilities.baselineRelease, manifestVersion);
});

test('Ver.269+ product: runtime app still does not generate mapped legacy navigation and summary assets', () => {
  for (const asset of legacyAssets) assert.doesNotMatch(app, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('Ver.269+ product: brand and icon-system retain current asset ownership', () => {
  assert.match(brand, /patchBrandMark\(\)/);
  assert.match(brand, /patchBrowserIcons\(\)/);
  assert.match(brand, /window\.addEventListener\('pageshow'/);
  const release = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);
  if (release >= 265) assert.match(brand, /if \(event\.persisted\) apply\(\)/);
  assert.match(icons, /const NAV_ICONS = \[/);
  assert.match(icons, /const SUMMARY_ICONS = \[/);
  assert.match(icons, /applyIcons\(\)/);
});

test('Ver.269+ product: responsibility ledger retains the first-paint and current-icon ownership history', () => {
  const group = responsibilities.groups?.find(item => item.id === 'icon-system');
  assert.ok(group, 'icon-system responsibility group must exist');
  assert.match(group.reason || '', /Ver\.269/);
  assert.ok(group.assets?.includes('icon-system-v169.js'));
  assert.ok(group.assets?.includes('brand-v185.js'));
});
