import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workFeatures = readFileSync('work-features-v167.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('WORK_FEATURES_OBSERVER_BOUNDARY_AUDIT_V314.md', 'utf8');
const browser = readFileSync('tests/work-features-observer-boundary-v314.spec.mjs', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.314 audit keeps product release and responsibility baseline at 277', () => {
  assert.equal(release, 277);
  assert.equal(String(responsibilities.baselineRelease), '277');
  assert.match(audit, /Product runtime is not changed in this audit/);
});

test('Ver.314 keeps current product observer on mainContent and detailBody subtree roots', () => {
  assert.match(workFeatures, /const roots = \[main, detail\]\.filter\(Boolean\)/);
  assert.match(workFeatures, /featureState\.domObserver = new MutationObserver\(\(\) => \{/);
  assert.match(workFeatures, /roots\.forEach\(root => featureState\.domObserver\.observe\(root, \{ childList: true, subtree: true \}\)\)/);
  assert.doesNotMatch(workFeatures, /mutations\.every\([\s\S]*?workMemoViewV167/);
});

test('Ver.314 candidate is isolated to browser audit and suppresses memo-owned scheduling only', () => {
  assert.match(browser, /workMemoViewV167/);
  assert.match(browser, /mutations\.every/);
  assert.match(browser, /__WB_WORK_OBSERVER_V314_RUNS__/);
  assert.match(browser, /mainContent/);
  assert.match(browser, /detailBody/);
  assert.match(browser, /taskStartDateV167/);
});

test('Ver.314 audit documents persistence and canonical-render boundaries', () => {
  assert.match(audit, /Firebase paths, memo\/task\/start-date persistence, transactions, and cleanup logic are unchanged/);
  assert.match(audit, /No canonical task, board, dashboard, detail, or memo renderer is replaced/);
});
