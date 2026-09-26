import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shell = readFileSync('mobile-shell-v234.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_RESIZE_SCOPE_AUDIT_V295.md', 'utf8');
const gate = readFileSync('MOBILE_SHELL_RESIZE_PRODUCT_GATE_V296.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

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

test('Ver.296 gate preserves startup, observer, navigation, and schedule-create boundaries', () => {
  assert.match(shell, /document\.addEventListener\("DOMContentLoaded", patchAll, \{ once: true \}\)/);
  assert.match(shell, /new MutationObserver\(scheduleBoardTabs\)\.observe\(boardView, \{ childList: true, subtree: true \}\)/);
  assert.match(shell, /event\.target\?\.closest\?\.\("\.nav-item"\)/);
  assert.match(shell, /setTimeout\(tryOpen, 80\)/);
  assert.match(shell, /setTimeout\(tryOpen, 220\)/);
  assert.match(shell, /setTimeout\(tryOpen, 500\)/);
  assert.match(gate, /production runtime remains unchanged/i);
  assert.match(gate, /Ver\.297 should audit the five `patchAll\(\)` responsibilities independently/);
});

test('Ver.295/296 history remains recorded while later resize ownership advances', () => {
  const group = responsibilities.groups?.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.ok(group);
  assert.match(group.reason, /Ver\.295監査/);
  assert.match(group.reason, /Ver\.296製品化ゲート/);
  assert.match(group.reason, /board-only/);

  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.equal(next.order, 1);
  assert.deepEqual(next.scope, ['mobile-shell-v234.js']);
  if (release === 269) {
    assert.match(next.goal, /Ver\.297監査/);
    assert.match(next.precondition, /Ver\.296/);
  } else {
    assert.match(group.reason, /Ver\.297監査/);
    assert.match(group.reason, /Ver\.298製品/);
    assert.match(next.goal, /Ver\.299監査/);
    assert.match(next.precondition, /Ver\.298/);
  }
});
