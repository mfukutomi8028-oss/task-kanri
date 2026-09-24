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

test('Ver.269 product: legacy observer remains available during first paint', () => {
  assert.match(manifest, /new MutationObserver\(records =>/);
  assert.match(manifest, /iconObserver\.observe\(root, \{ childList: true, subtree: true \}\)/);
  assert.match(manifest, /window\.__WB_LEGACY_ICON_OBSERVER_V257__ = iconObserver/);
  assert.match(manifest, /record\.addedNodes\.forEach\(patchNode\)/);
});

test('Ver.269 product: assets-ready performs a final image sweep before disconnecting the broad observer', () => {
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

test('Ver.269 product: four-second reveal fallback does not terminate compatibility before assets-ready', () => {
  assert.match(manifest, /window\.setTimeout\(revealCurrentUi, 4000\)/);
  assert.doesNotMatch(manifest, /window\.setTimeout\(handleAssetsReady, 4000\)/);
});

test('Ver.269 product: release manifest and responsibility baseline advance together', () => {
  assert.equal(manifest.match(/version:\s*"(\d+)"/)?.[1], '257');
  assert.equal(responsibilities.baselineRelease, '257');
});

test('Ver.269 product: runtime app still does not generate mapped legacy navigation and summary assets', () => {
  for (const asset of legacyAssets) assert.doesNotMatch(app, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('Ver.269 product: brand and icon-system retain current asset ownership', () => {
  assert.match(brand, /patchBrandMark\(\)/);
  assert.match(brand, /patchBrowserIcons\(\)/);
  assert.match(brand, /window\.addEventListener\('pageshow', apply\)/);
  assert.match(icons, /const NAV_ICONS = \[/);
  assert.match(icons, /const SUMMARY_ICONS = \[/);
  assert.match(icons, /applyIcons\(\)/);
  assert.match(icons, /attempts >= 24/);
});

test('Ver.269 product: next audit isolates icon-system finite polling', () => {
  const candidate = responsibilities.priorityCandidates?.find(item => item.order === 1);
  assert.ok(candidate, 'priority candidate must exist');
  assert.deepEqual(candidate.scope, ['icon-system-v169.js']);
  assert.match(candidate.goal, /Ver\.270監査/);
});
