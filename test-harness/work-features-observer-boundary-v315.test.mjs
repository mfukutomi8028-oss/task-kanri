import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workFeatures = readFileSync('work-features-v167.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const product = readFileSync('WORK_FEATURES_OBSERVER_BOUNDARY_PRODUCT_V315.md', 'utf8');
const browser = readFileSync('tests/work-features-observer-boundary-v315.spec.mjs', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.315 product remains active after later releases', () => {
  assert.ok(release >= 278);
  assert.equal(String(responsibilities.baselineRelease), String(release));
  assert.match(workFeatures, /\/\/ Ver\.315: memo-owned render mutations do not require core reconciliation\./);
  assert.match(product, /Release and responsibility baseline advance from 277 to 278/);
});

test('Ver.315 product keeps scoped observer roots and skips memo-owned-only mutation batches', () => {
  assert.match(workFeatures, /const roots = \[main, detail\]\.filter\(Boolean\)/);
  assert.match(workFeatures, /featureState\.domObserver = new MutationObserver\(mutations => \{/);
  assert.match(workFeatures, /const memoRoot = document\.getElementById\('workMemoViewV167'\)/);
  assert.match(workFeatures, /mutations\.length && mutations\.every\(mutation => mutation\.target === memoRoot \|\| memoRoot\.contains\(mutation\.target\)\)/);
  assert.match(workFeatures, /roots\.forEach\(root => featureState\.domObserver\.observe\(root, \{ childList: true, subtree: true \}\)\)/);
});

test('Ver.315 preserves work-feature persistence and cleanup boundaries', () => {
  assert.match(workFeatures, /rooms\/\$\{featureState\.roomId\}\/businessMemos/);
  assert.match(workFeatures, /rooms\/\$\{featureState\.roomId\}\/taskStarts/);
  assert.match(workFeatures, /runTransaction/);
  assert.match(workFeatures, /cleanupOrphanStarts/);
  assert.match(product, /Firebase paths, memo and start-date transactions, canonical task persistence, and orphan cleanup are unchanged/);
});

test('Ver.315 browser regression measures product runtime rather than a semantic candidate injection', () => {
  assert.match(browser, /__WB_WORK_OBSERVER_V315_RUNS__/);
  assert.match(browser, /workMemoViewV167/);
  assert.match(browser, /mainContent/);
  assert.match(browser, /detailBody/);
  assert.match(browser, /taskStartDateV167/);
  assert.doesNotMatch(browser, /candidate\s*=/);
  assert.doesNotMatch(browser, /observerHead\s*=\s*candidate/);
});
