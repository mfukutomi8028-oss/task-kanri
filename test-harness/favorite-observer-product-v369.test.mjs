import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const product = read('favorite-ui-v237.js');
const baseline = read('test-harness/fixtures/favorite-ui-v237-pre-v369.js');
const manifest = read('release-manifest.js');
const responsibilities = JSON.parse(read('patch-responsibilities.json'));

test('Ver.369 release 297 promotes favorite semantic wakeups without asset rename', () => {
  const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1]);
  assert.ok(release >= 297);
  assert.equal(String(release), String(responsibilities.baselineRelease));
  assert.match(manifest, /"favorite-ui-v237\.js"/);
  assert.match(product, /function favoriteMutationV369\(records\)/);
  assert.match(product, /if \(favoriteMutationV369\(records\)\) schedulePatch\(\)/);
  assert.doesNotMatch(product, /if \(records\.some\(record => record\.addedNodes\.length \|\| record\.removedNodes\.length\)\) schedulePatch\(\)/);
  assert.doesNotMatch(product, /:has\(/, 'no CSS :has pseudo-class dependency');
  assert.match(baseline, /if \(records\.some\(record => record\.addedNodes\.length \|\| record\.removedNodes\.length\)\) schedulePatch\(\)/);
});
test('Ver.369 retains nested/removed favorite controls, filter-only row ownership and click', () => {
  assert.match(product, /#favoriteOnly/);
  assert.match(product, /#roomCacheHelp, #clearRoomCache/);
  assert.match(product, /element\.querySelector\?\.\(FAVORITE_CONTROL_V369\)/);
  assert.match(product, /favoriteHostV369\(record\.target\)/);
  assert.match(product, /element\.closest\?\.\('label\.check-row'\)/);
  assert.match(product, /row\?\.querySelector\?\.\('#favoriteOnly'\)/);
  assert.match(product, /document\.addEventListener\('click'/);
  assert.match(product, /new MutationObserver\(patchFavoriteToast\)/);
  assert.match(product, /aria-label/);
  assert.match(product, /requestAnimationFrame\(runPatch\)/);
});
test('Ver.369 retains fixed observer ownership and does not add write paths', () => {
  const count = s => [...s.matchAll(/new MutationObserver\(/g)].length;
  assert.equal(count(product), count(baseline));
  assert.equal(count(product), 2);
  assert.match(product, /document\.querySelector\('\.sidebar'\)/);
  assert.match(product, /document\.getElementById\('mainContent'\)/);
  assert.match(product, /document\.getElementById\('detailBody'\)/);
  assert.doesNotMatch(product, /runTransaction|localStorage\.setItem|fetch\(|setInterval\(/);
});
