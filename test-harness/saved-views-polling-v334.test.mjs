import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [savedViews, app, index, manifest, responsibilityText, browserAudit] = await Promise.all([
  read('saved-views-v148.js'),
  read('app.js'),
  read('index.html'),
  read('release-manifest.js'),
  read('patch-responsibilities.json'),
  read('tests/saved-views-polling-audit-v334.spec.mjs')
]);
const responsibilities = JSON.parse(responsibilityText);

test('Ver.334 audit: dormant saved-filter bridge still contains a 250ms x24 interval in source', () => {
  assert.match(savedViews, /const timer = setInterval\(async \(\) => \{/);
  assert.match(savedViews, /attempts \+= 1/);
  assert.match(savedViews, /attempts >= 24/);
  assert.match(savedViews, /\}, 250\);/);
  assert.match(savedViews, /#saveCurrentFilter/);
  assert.match(savedViews, /\[data-apply-filter\]/);
});

test('Ver.334 audit: current HTML no longer exposes the legacy saved-filter controls that trigger the interval', () => {
  assert.doesNotMatch(index, /id=["']saveCurrentFilter["']/);
  assert.doesNotMatch(index, /id=["']savedFilterList["']/);
  assert.doesNotMatch(index, /data-apply-filter=/);
  assert.doesNotMatch(index, /data-delete-filter=/);
});

test('Ver.334 audit: app retains nullable legacy references while current sort persistence is independent', () => {
  assert.match(app, /saveCurrentFilter:\s*\$\(["']saveCurrentFilter["']\)/);
  assert.match(app, /savedFilterList:\s*\$\(["']savedFilterList["']\)/);
  assert.match(savedViews, /function persistBaseSort\(\)/);
  assert.match(savedViews, /function restoreBaseSort\(\)/);
  assert.match(savedViews, /#sortSelect/);
});

test('Ver.334 audit: browser test measures the active runtime and requires zero owned 250ms interval registrations', () => {
  assert.match(browserAudit, /Number\(delay\) === 250 && stack\.includes\('saved-views-v148\.js'\)/);
  assert.match(browserAudit, /expect\(await ownedIntervalCount\(page\)\)\.toBe\(0\)/);
  assert.match(browserAudit, /#saveCurrentFilter/);
  assert.match(browserAudit, /work-board-base-sort/);
  assert.doesNotMatch(browserAudit, /page\.route\([^\n]*saved-views-v148\.js/);
});

test('Ver.334 audit: release and responsibility baseline remain 283 because product runtime is unchanged', () => {
  const release = manifest.match(/version:\s*["'](\d+)["']/)?.[1];
  assert.equal(release, '283');
  assert.equal(responsibilities.baselineRelease, '283');
});
