import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [savedViews, index, manifest, responsibilityText, browserRegression] = await Promise.all([
  read('saved-views-v148.js'),
  read('index.html'),
  read('release-manifest.js'),
  read('patch-responsibilities.json'),
  read('tests/saved-views-retirement-v335.spec.mjs')
]);
const responsibilities = JSON.parse(responsibilityText);

test('Ver.335 product: dormant saved-filter bridge is retired from active saved-views runtime', () => {
  assert.doesNotMatch(savedViews, /saveCurrentFilter/);
  assert.doesNotMatch(savedViews, /data-apply-filter/);
  assert.doesNotMatch(savedViews, /savedKey/);
  assert.doesNotMatch(savedViews, /columnKey/);
  assert.doesNotMatch(savedViews, /function\s+(?:ids|snapshot|begin|finish|apply|label)\s*\(/);
  assert.doesNotMatch(savedViews, /setInterval\s*\(/);
  assert.doesNotMatch(savedViews, /setTimeout\s*\(/);
  assert.doesNotMatch(savedViews, /new MutationObserver/);
  assert.doesNotMatch(savedViews, /document\.addEventListener\(['"]click['"]/);
});

test('Ver.335 product: primary sort persistence remains the only active responsibility', () => {
  assert.match(savedViews, /work-board-base-sort/);
  assert.match(savedViews, /function currentBaseSort\(\)/);
  assert.match(savedViews, /function persistBaseSort\(\)/);
  assert.match(savedViews, /function restoreBaseSort\(\)/);
  assert.match(savedViews, /#sortSelect/);
  assert.match(savedViews, /document\.addEventListener\('input', handleBaseSortEvent, true\)/);
  assert.match(savedViews, /document\.addEventListener\('change', handleBaseSortEvent, true\)/);
  assert.match(savedViews, /DOMContentLoaded/);
});

test('Ver.335 product: legacy saved-filter controls remain absent from current HTML', () => {
  assert.doesNotMatch(index, /id=["']saveCurrentFilter["']/);
  assert.doesNotMatch(index, /id=["']savedFilterList["']/);
  assert.doesNotMatch(index, /data-apply-filter=/);
  assert.doesNotMatch(index, /data-delete-filter=/);
});

test('Ver.335 product: browser regression locks zero dormant runtime registrations and sort persistence', () => {
  assert.match(browserRegression, /saved-views-v148\.js/);
  assert.match(browserRegression, /ownedIntervals/);
  assert.match(browserRegression, /ownedObservers/);
  assert.match(browserRegression, /ownedTimeouts/);
  assert.match(browserRegression, /work-board-base-sort/);
});

test('Ver.335 product: release and responsibility baseline advance together to 284', () => {
  const release = manifest.match(/version:\s*["'](\d+)["']/)?.[1];
  assert.equal(release, '284');
  assert.equal(responsibilities.baselineRelease, '284');
});
