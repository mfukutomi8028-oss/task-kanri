import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

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

// Exercise the actual route instrumentation and product frame owner, not a copy
// of their suppression logic. No browser, Firebase, or business data is involved.
async function coreIsolationFixtureV371() {
  let instrumented = '';
  const loader = { test() {}, expect: value => ({ toBe: expected => assert.equal(value, expected) }) };
  runInNewContext(browser.replace(/^import .*\n/, ''), loader);
  await loader.installAudit({
    addInitScript: async () => {},
    route: async (pattern, handler) => {
      if (!String(pattern).includes('work-features-v167')) return;
      await handler({
        fetch: async () => ({ text: async () => workFeatures }),
        fulfill: async ({ body }) => { instrumented = body; }
      });
    }
  });
  const start = instrumented.indexOf('  function observeCoreDom() {');
  const end = instrumented.indexOf('  function showFeatureMessage(');
  assert.ok(start >= 0 && end > start, 'product observer/clock source boundaries must exist');
  const audit = {
    today: '2026-10-01', suppressCoreReconcile: false,
    coreCallbacks: 0, coreMutationTargets: [], applyCalls: 0,
    midnightSchedules: 0, midnightFires: 0
  };
  const main = { id: 'mainContent', addEventListener() {} };
  const frames = [];
  let hidden = true;
  const context = {
    window: { __WB_WORK_LONG_LIVED_V316__: audit },
    featureState: {},
    document: { getElementById: id => id === 'mainContent' ? main : null },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      observe() {}
      disconnect() {}
    },
    requestAnimationFrame: callback => { frames.push(callback); return frames.length; },
    clearTimeout() {}, setTimeout: () => 1,
    createMemoNav() {}, ensureMemoView() {}, ensureStartDateField() {}, bindCoreNavigationExit() {},
    applyFutureTaskUi() { audit.applyCalls++; hidden = audit.today < '2026-10-02'; }
  };
  runInNewContext(instrumented.slice(start, end) + '\nobserveCoreDom(); scheduleDateBoundaryRefresh();', context);
  return {
    audit, context, hidden: () => hidden,
    mutate: () => context.featureState.domObserver.callback([{ target: main }]),
    frame: () => { for (const callback of frames.splice(0)) callback(0); }
  };
}

test('Ver.371 recovery reproduces a prequeued core frame escaping the old observer-only gate', async () => {
  const fixture = await coreIsolationFixtureV371();
  fixture.mutate(); // Queue a real product reconciliation before suppression.
  fixture.audit.suppressCoreReconcile = true;
  const baseline = fixture.audit.applyCalls;
  fixture.audit.today = '2026-10-02';
  fixture.mutate(); // Suppressed, but it cannot cancel the earlier frame.
  fixture.frame();
  assert.equal(fixture.audit.applyCalls, baseline + 1);
  assert.equal(fixture.hidden(), false);
  assert.equal(fixture.audit.midnightFires, 0);
});

test('Ver.371 recovery drains pending frames before the baseline and retains the one-shot clock proof', async () => {
  const callback = browser.match(/const isolatedApplyCount = await page\.evaluate\((async \(\) => \{[\s\S]*?\n  \})\);/)?.[1];
  assert.ok(callback, 'browser isolation must establish and return its baseline atomically');
  for (const prequeued of [false, true]) {
    const fixture = await coreIsolationFixtureV371();
    if (prequeued) fixture.mutate();
    const isolated = runInNewContext(`(${callback})()`, fixture.context);
    assert.equal(fixture.audit.suppressCoreReconcile, true);
    fixture.frame();
    const baseline = await isolated;
    assert.equal(baseline, prequeued ? 1 : 0);
    assert.equal(fixture.hidden(), true);
    fixture.audit.today = '2026-10-02';
    fixture.mutate();
    fixture.frame();
    assert.ok(fixture.audit.coreCallbacks > 0);
    assert.equal(fixture.audit.applyCalls, baseline);
    assert.equal(fixture.hidden(), true);
    assert.equal(fixture.audit.midnightFires, 0);
    fixture.audit.runMidnight();
    assert.equal(fixture.audit.applyCalls, baseline + 1);
    assert.equal(fixture.audit.midnightFires, 1);
    assert.equal(fixture.audit.midnightSchedules, 2);
    assert.equal(fixture.hidden(), false);
  }
});
