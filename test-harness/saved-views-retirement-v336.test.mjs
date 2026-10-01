import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [savedViews, index, manifest, responsibilityText, browserRegression, auditRegression] = await Promise.all([
  read('saved-views-v148.js'),
  read('index.html'),
  read('release-manifest.js'),
  read('patch-responsibilities.json'),
  read('tests/saved-views-retirement-v336.spec.mjs'),
  read('tests/saved-views-legacy-retirement-audit-v335.spec.mjs')
]);
const responsibilities = JSON.parse(responsibilityText);

test('Ver.336 product: dormant saved-filter bridge is retired from active runtime', () => {
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

test('Ver.336 product: primary sort persistence remains active after later listener-scope cleanup', () => {
  assert.match(savedViews, /work-board-base-sort/);
  assert.match(savedViews, /function currentBaseSort\(\)/);
  assert.match(savedViews, /function persistBaseSort\(\)/);
  assert.match(savedViews, /function restoreBaseSort\(\)/);
  assert.match(savedViews, /document\.getElementById\(['"]sortSelect['"]\)/);
  assert.match(savedViews, /addEventListener\(['"]input['"],\s*persistBaseSort\)/);
  assert.match(savedViews, /DOMContentLoaded/);
});

test('Ver.336 product: legacy controls remain absent and Ver.335 audit evidence is retained', () => {
  assert.doesNotMatch(index, /id=["']saveCurrentFilter["']/);
  assert.doesNotMatch(index, /id=["']savedFilterList["']/);
  assert.doesNotMatch(index, /data-apply-filter=/);
  assert.match(auditRegression, /Ver\.335 audit/);
  assert.match(auditRegression, /saved-views-v148\.js/);
});

test('Ver.336 product: browser regression locks zero dormant registrations and reload persistence', () => {
  assert.match(browserRegression, /saved-views-v148\.js/);
  assert.match(browserRegression, /ownedIntervals/);
  assert.match(browserRegression, /ownedObservers/);
  assert.match(browserRegression, /ownedTimeouts/);
  assert.match(browserRegression, /work-board-base-sort/);
  assert.match(browserRegression, /page\.reload/);
});

test('Ver.336 product: release 284 history remains recorded while later releases stay aligned', () => {
  const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);
  assert.ok(release >= 284, `expected release 284 or later, got ${release}`);
  assert.equal(responsibilities.baselineRelease, String(release));
  const workflowGroup = responsibilities.groups?.find(group => group.id === 'workflow-and-detail');
  assert.match(workflowGroup?.reason || '', /Ver\.335監査/);
  assert.match(workflowGroup?.reason || '', /Ver\.336製品/);
  assert.match(workflowGroup?.reason || '', /release 284/);
  if (release >= 285) assert.match(workflowGroup?.reason || '', /Ver\.338製品/);
});
