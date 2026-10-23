import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const shell = readFileSync('mobile-shell-v234.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const product = readFileSync('MOBILE_SHELL_RESIZE_RECONCILER_V298.md', 'utf8');
const audit = readFileSync('docs/HISTORICAL_MOBILE_RESIZE_SCHEDULE_AUDITS_V512.md', 'utf8');
const gate = readFileSync('MOBILE_SHELL_RESIZE_PRODUCT_GATE_V296.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.298+ product keeps release and responsibility baseline aligned after 270', () => {
  assert.ok(release >= 270);
  assert.equal(String(responsibilities.baselineRelease), String(release));
});

test('Ver.298 product keeps startup patchAll at five responsibilities', () => {
  assert.match(shell, /function patchAll\(\) \{\s*ensureMobileHeader\(\);\s*patchMobileBoardTabs\(\);\s*syncMobileHeaderTitle\(\);\s*syncMobileMenuButton\(\);\s*bindGlobalClicks\(\);\s*\}/);
  assert.match(shell, /document\.addEventListener\("DOMContentLoaded", patchAll, \{ once: true \}\)/);
  assert.match(shell, /if \(window\.__workBoardMobileFixClicksV101\) return;/);
});

test('Ver.298 product narrows only scheduled resize recovery to board title and menu', () => {
  assert.match(shell, /const schedulePatch = \(\) => \{[\s\S]*requestAnimationFrame\(\(\) => \{\s*scheduled = false;\s*patchMobileBoardTabs\(\);\s*syncMobileHeaderTitle\(\);\s*syncMobileMenuButton\(\);\s*\}\);[\s\S]*\};/);
  const scheduleBlock = shell.match(/const schedulePatch = \(\) => \{[\s\S]*?\n  \};/)?.[0] || '';
  assert.doesNotMatch(scheduleBlock, /ensureMobileHeader\(\)/);
  assert.doesNotMatch(scheduleBlock, /bindGlobalClicks\(\)/);
  assert.doesNotMatch(scheduleBlock, /patchAll\(\)/);
  assert.match(shell, /window\.addEventListener\("resize", schedulePatch\)/);
});

test('Ver.298+ product preserves observer loader navigation and the current schedule-create boundary', () => {
  assert.match(shell, /const boardView = document\.getElementById\("boardView"\)/);
  assert.match(shell, /new MutationObserver\(/);
  assert.match(shell, /\.observe\(boardView, \{ childList: true \}\)/);
  assert.doesNotMatch(shell, /observe\(boardView, \{ childList: true, subtree: true \}\)/);
  assert.match(shell, /event\.target\?\.closest\?\.\("\.nav-item"\)/);
  if (release < 273) {
    assert.match(shell, /setTimeout\(tryOpen, 80\)/);
    assert.match(shell, /setTimeout\(tryOpen, 220\)/);
    assert.match(shell, /setTimeout\(tryOpen, 500\)/);
  } else {
    assert.doesNotMatch(shell, /setTimeout\(tryOpen, (?:80|220|500)\)/);
    assert.match(shell, /data-layout='schedule'[\s\S]*?\.click\(\);\s*tryOpen\(\);/);
  }
  assert.match(product, /no Firebase, task persistence, workflow, notification, or other business-data write path is changed/i);
});

test('Ver.298 history remains durable while later mobile-shell cleanup advances', () => {
  const group = responsibilities.groups?.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.ok(group);
  assert.match(group.reason, /Ver\.297監査/);
  assert.match(group.reason, /Ver\.298製品/);
  assert.match(group.reason, /release 270/);
  if (release >= 271) {
    assert.match(group.reason, /Ver\.299監査/);
    assert.match(group.reason, /Ver\.300製品/);
    assert.match(group.reason, /release 271/);
  }
  if (release >= 272) {
    assert.match(group.reason, /Ver\.301監査/);
    assert.match(group.reason, /Ver\.302製品/);
    assert.match(group.reason, /release 272/);
  }
  if (release >= 273) {
    assert.match(group.reason, /Ver\.303監査/);
    assert.match(group.reason, /Ver\.304製品/);
    assert.match(group.reason, /release 273/);
  }
  if (release >= 274) {
    assert.match(group.reason, /Ver\.305監査/);
    assert.match(group.reason, /Ver\.306製品/);
    assert.match(group.reason, /release 274/);
  }
  if (release >= 275) {
    assert.match(group.reason, /Ver\.307監査/);
    assert.match(group.reason, /Ver\.308製品/);
    assert.match(group.reason, /release 275/);
  }
});

test('Ver.490 keeps older mobile-shell audit anchors while Ver.298 owns later history', () => {
  const predecessors = [
    ['mobile-shell-startup-repatch-v291.test.mjs', 269, ['Ver\\.291監査', 'Ver\\.292製品']],
    ['mobile-shell-orientation-recovery-v293.test.mjs', 270, ['Ver\\.293監査', 'Ver\\.294製品', 'Ver\\.295監査', 'Ver\\.296製品化ゲート']],
  ];
  for (const [file, retiredBoundary, anchors] of predecessors) {
    const source = readFileSync('test-harness/' + file, 'utf8');
    for (const anchor of anchors) {
      assert.ok(source.includes('assert.match(group.reason, /' + anchor + '/);'),
        file + ' lost its original responsibility anchor ' + anchor);
    }
    assert.ok(!source.includes('  if (release >= ' + retiredBoundary + ') {'),
      file + ' reintroduced downstream owner checks after Ver.490');
  }
  const promotedOwner = readFileSync('test-harness/mobile-shell-resize-reconciler-v298.test.mjs', 'utf8');
  // Ver.498: Ver.295/296 historical owner guards follow their migrated source,
  // without weakening the Ver.490 checks for the other two predecessors.
  const migratedAnchors = ['Ver\\.295監査', 'Ver\\.296製品化ゲート'];
  for (const anchor of migratedAnchors) {
    assert.ok(promotedOwner.includes('assert.match(group.reason, /' + anchor + '/);'),
      'migrated Ver.295/296 responsibility anchor lost ' + anchor);
  }
  const migratedVer295Body = promotedOwner.split('\n// Ver.498: all four Ver.295/296 tests and 26 original assertion calls, preserved verbatim.')[1] || '';
  assert.ok(migratedVer295Body.length > 0, 'Ver.295 original test section must stay present');
  assert.ok(!migratedVer295Body.includes('  if (release >= 270) {'),
    'migrated Ver.295/296 cases must not reclaim Ver.297+ history');
  const migratedCases = [
    "Ver.295/296 evidence remains valid across later release promotion",
    "Ver.295 audit documents the exact temporary resize-only substitution",
    "Ver.296 gate preserves startup, observer, navigation, and the current schedule-create boundary",
    "Ver.295/296 history remains recorded while later resize ownership advances"
  ];
  for (const name of migratedCases) {
    assert.ok(promotedOwner.includes("test('" + name + "'"),
      'migrated Ver.295/296 case missing ' + name);
  }
  for (const token of [
    'Ver\\.297監査', 'Ver\\.298製品', 'Ver\\.299監査', 'Ver\\.300製品',
    'Ver\\.301監査', 'Ver\\.302製品', 'Ver\\.303監査', 'Ver\\.304製品',
    'Ver\\.305監査', 'Ver\\.306製品', 'Ver\\.307監査', 'Ver\\.308製品'
  ]) {
    assert.ok(promotedOwner.includes('assert.match(group.reason, /' + token + '/);'),
      'promoted history owner lost ' + token);
  }
});

// Ver.498: all four Ver.295/296 tests and 26 original assertion calls, preserved verbatim.
test('Ver.295/296 evidence remains valid across later release promotion', () => {
  assert.ok(release >= 269);
  assert.equal(String(responsibilities.baselineRelease), String(release));
  assert.match(shell, /function patchAll\(\)/);
  assert.match(shell, /window\.addEventListener\("resize", schedulePatch\)/);
  assert.doesNotMatch(shell, /window\.addEventListener\("orientationchange"/);
});

test('Ver.295 audit documents the exact temporary resize-only substitution', () => {
  assert.match(audit, /window\.addEventListener\("resize", schedulePatch\)/);
  assert.match(audit, /window\.addEventListener\("resize", scheduleBoardTabs\)/);
  assert.match(audit, /Production runtime remains unchanged/);
  assert.match(audit, /No Firebase or business-data write-path change/);
});

test('Ver.296 gate preserves startup, observer, navigation, and the current schedule-create boundary', () => {
  assert.match(shell, /document\.addEventListener\("DOMContentLoaded", patchAll, \{ once: true \}\)/);
  assert.match(shell, /const boardView = document\.getElementById\("boardView"\)/);
  assert.match(shell, /new MutationObserver\(/);
  assert.match(shell, /\.observe\(boardView, \{ childList: true \}\)/);
  assert.doesNotMatch(shell, /observe\(boardView, \{ childList: true, subtree: true \}\)/);
  assert.match(shell, /event\.target\?\.closest\?\.\("\.nav-item"\)/);
  if (release < 273) {
    assert.match(shell, /setTimeout\(tryOpen, 80\)/);
    assert.match(shell, /setTimeout\(tryOpen, 220\)/);
    assert.match(shell, /setTimeout\(tryOpen, 500\)/);
  } else {
    assert.doesNotMatch(shell, /setTimeout\(tryOpen, (?:80|220|500)\)/);
    assert.match(shell, /data-layout='schedule'[\s\S]*?\.click\(\);\s*tryOpen\(\);/);
  }
  assert.match(gate, /production runtime remains unchanged/i);
  assert.match(gate, /Ver\.297 should audit the five `patchAll\(\)` responsibilities independently/);
});

test('Ver.295/296 history remains recorded while later resize ownership advances', () => {
  const group = responsibilities.groups?.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.ok(group);
  assert.match(group.reason, /Ver\.295監査/);
  assert.match(group.reason, /Ver\.296製品化ゲート/);
  assert.match(group.reason, /board-only/);
  // Ver.490: later Ver.297-308 lineage is checked in the Ver.298 product suite; Ver.295/296 remains here.

});

test('Ver.498 retired Ver.295 standalone resize Protocol stays absent', () => {
  assert.equal(existsSync(new URL('./mobile-shell-resize-scope-v295.test.mjs', import.meta.url)), false);
});

// Ver.499: Original Ver.297 cases and assertions remain unchanged. Audit path scoped to this lineage.
{
const audit = readFileSync('docs/HISTORICAL_MOBILE_RESIZE_SCHEDULE_AUDITS_V512.md', 'utf8');
test('Ver.297+ keeps release and responsibility baseline aligned after 269', () => {
  assert.ok(release >= 269);
  assert.equal(String(responsibilities.baselineRelease), String(release));
  assert.match(shell, /function patchAll\(\) \{[\s\S]*ensureMobileHeader\(\);[\s\S]*patchMobileBoardTabs\(\);[\s\S]*syncMobileHeaderTitle\(\);[\s\S]*syncMobileMenuButton\(\);[\s\S]*bindGlobalClicks\(\);[\s\S]*\}/);
  assert.match(shell, /window\.addEventListener\("resize", schedulePatch\)/);
});

test('Ver.297 audit isolates the five patchAll responsibilities and proposed resize subset', () => {
  for (const name of ['ensureMobileHeader', 'patchMobileBoardTabs', 'syncMobileHeaderTitle', 'syncMobileMenuButton', 'bindGlobalClicks']) {
    assert.ok(audit.includes(`\`${name}()\``), `${name} responsibility must be documented`);
  }
  assert.match(audit, /replaces its `patchAll\(\)` call/);
  assert.match(audit, /patchMobileBoardTabs\(\);[\s\S]*syncMobileHeaderTitle\(\);[\s\S]*syncMobileMenuButton\(\);/);
  assert.match(audit, /Startup `patchAll\(\)` must remain unchanged/);
});

test('Ver.297 startup ownership and one-shot global click binding remain durable', () => {
  assert.match(shell, /document\.addEventListener\("DOMContentLoaded", patchAll, \{ once: true \}\)/);
  assert.match(shell, /if \(window\.__workBoardMobileFixClicksV101\) return;/);
  assert.match(shell, /window\.__workBoardMobileFixClicksV101 = true;/);
  assert.match(shell, /const boardView = document\.getElementById\("boardView"\)/);
  assert.match(shell, /new MutationObserver\(/);
  assert.match(shell, /\.observe\(boardView, \{ childList: true \}\)/);
  assert.doesNotMatch(shell, /observe\(boardView, \{ childList: true, subtree: true \}\)/);
});

test('Ver.297 evidence remains recorded while later cleanup priorities advance', () => {
  const group = responsibilities.groups?.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.ok(group);
  assert.match(group.reason, /Ver\.297監査/);

  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.equal(next.order, 1);
  assert.ok(Array.isArray(next.scope) && next.scope.length >= 1);
  if (release === 269) {
    assert.deepEqual(next.scope, ['mobile-shell-v234.js']);
    assert.match(next.goal, /Ver\.297監査/);
    assert.match(next.precondition, /Ver\.296/);
  } else if (release === 270) {
    assert.deepEqual(next.scope, ['mobile-shell-v234.js']);
    assert.match(group.reason, /Ver\.298製品/);
    assert.match(next.goal, /Ver\.299監査/);
    assert.match(next.precondition, /Ver\.298/);
  } else if (release === 271) {
    assert.deepEqual(next.scope, ['mobile-shell-v234.js']);
    assert.match(group.reason, /Ver\.299監査/);
    assert.match(group.reason, /Ver\.300製品/);
    assert.match(next.goal, /Ver\.301監査/);
    assert.match(next.precondition, /Ver\.300/);
  } else {
    assert.match(group.reason, /Ver\.301監査/);
    assert.match(group.reason, /Ver\.302製品/);
    assert.match(group.reason, /release 272/);
    assert.ok(next.goal && next.precondition,
      'later releases may move the current cleanup candidate without invalidating Ver.297 evidence');
  }
});
}

test('Ver.499 retired Ver.297 responsibility Protocol stays absent', () => {
  assert.equal(existsSync(new URL('./mobile-shell-resize-responsibility-v297.test.mjs', import.meta.url)), false);
});

// Ver.523: リサイズ製品化ゲートVer.296の4テスト本文を既存のVer.298リサイズ責務へ移管。
{
const v294Browser = readFileSync('tests/mobile-shell-orientation-recovery-audit-v293.spec.mjs', 'utf8');
const v295Browser = readFileSync('tests/mobile-shell-resize-scope-audit-v295.spec.mjs', 'utf8');
test('Ver.296 gate evidence remains valid after release 269', () => {
  assert.ok(release >= 269);
  assert.equal(String(responsibilities.baselineRelease), String(release));
  assert.match(shell, /function patchAll\(\)/);
  assert.match(shell, /const schedulePatch = \(\) =>/);
  assert.match(shell, /window\.addEventListener\("resize", schedulePatch\)/);
});

test('Ver.296 gate detects recovery semantics missing from the Ver.295 ordinary-state audit', () => {
  assert.match(v294Browser, /V294-DRIFT/);
  assert.match(v294Browser, /menu\.textContent = '\?'/);
  assert.match(v294Browser, /menu\.setAttribute\('aria-expanded', 'true'\)/);
  assert.match(v294Browser, /expectCanonicalMobileHeader/);
  assert.match(v294Browser, /expectCanonicalBoardState/);

  assert.match(v295Browser, /resize needs only board reconciliation/);
  assert.match(v295Browser, /navigation keeps title synchronization independent of resize/);
});

test('Ver.296 gate records why direct board-only resize could not be productized', () => {
  assert.match(gate, /Do \*\*not\*\* promote the Ver\.295 board-only substitution directly into production/);
  assert.match(gate, /header title or menu-button drift/);
  assert.match(gate, /resize -> schedulePatch -> patchAll\(\)/);
  assert.match(gate, /Release and `baselineRelease` remain `269`/);
  assert.match(gate, /Ver\.297 should audit the five `patchAll\(\)` responsibilities independently/);
});

test('Ver.296 gate remains in responsibility history after safe Ver.298 promotion', () => {
  const group = responsibilities.groups?.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.ok(group);
  assert.match(group.reason, /Ver\.296製品化ゲート/);
  if (release >= 270) {
    assert.match(group.reason, /Ver\.297監査/);
    assert.match(group.reason, /Ver\.298製品/);
  }
});
}
