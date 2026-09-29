import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workFeatures = readFileSync('work-features-v167.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('WORK_FEATURES_LONG_LIVED_AUDIT_V316.md', 'utf8');
const browser = readFileSync('tests/work-features-long-lived-v316.spec.mjs', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.316 audit remains valid after later product releases', () => {
  assert.ok(release >= 278);
  assert.equal(String(responsibilities.baselineRelease), String(release));
  assert.match(audit, /Product runtime is not changed in this audit/);
});

test('Ver.316 task-dialog observer is already scoped to the canonical open attribute', () => {
  assert.match(workFeatures, /featureState\.taskDialogObserver = new MutationObserver\(\(\) => \{/);
  assert.match(workFeatures, /if \(dialog\.open \|\| dialog\.hasAttribute\('open'\)\) populateStartDateFromCurrentTask\(\)/);
  assert.match(workFeatures, /featureState\.taskDialogObserver\.observe\(dialog, \{ attributes: true, attributeFilter: \['open'\] \}\)/);
  assert.doesNotMatch(workFeatures, /taskDialogObserver\.observe\([^\n]+childList/);
  assert.doesNotMatch(workFeatures, /taskDialogObserver\.observe\([^\n]+subtree/);
});

test('Ver.316 date-boundary owner is a single recursive one-shot timeout, not polling', () => {
  assert.match(workFeatures, /function scheduleDateBoundaryRefresh\(\) \{/);
  assert.match(workFeatures, /clearTimeout\(featureState\.midnightTimer\)/);
  assert.match(workFeatures, /new Date\(now\.getFullYear\(\), now\.getMonth\(\), now\.getDate\(\) \+ 1, 0, 0, 2, 0\)/);
  assert.match(workFeatures, /featureState\.midnightTimer = setTimeout\(\(\) => \{\s*applyFutureTaskUi\(\);\s*scheduleDateBoundaryRefresh\(\);/s);
  assert.doesNotMatch(workFeatures, /setInterval\(/);
});

test('Ver.316 browser audit measures both long-lived owners without productizing a candidate', () => {
  assert.match(browser, /suppressDialogPopulate/);
  assert.match(browser, /dialogCallbacks/);
  assert.match(browser, /runMidnight/);
  assert.match(browser, /midnightSchedules/);
  assert.match(browser, /future-task-v167-hidden/);
  assert.doesNotMatch(browser, /route\.fulfill\([^)]*work-features-v167\.js[^)]*candidate/s);
});

test('Ver.316 evidence remains recorded while later cleanup priorities advance independently', () => {
  const workGroup = responsibilities.groups?.find(group => group.id === 'work-memo-and-reserved');
  assert.ok(workGroup);
  assert.match(workGroup.reason || '', /Ver\.314監査/);
  assert.match(workGroup.reason || '', /Ver\.315製品/);
  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.doesNotMatch(next.goal || '', /Ver\.316監査/);
  assert.ok(Number(String(next.goal || '').match(/Ver\.(\d+)/)?.[1] || 0) > 316);
});
