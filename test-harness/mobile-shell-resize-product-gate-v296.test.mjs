import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shell = readFileSync('mobile-shell-v234.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const gate = readFileSync('MOBILE_SHELL_RESIZE_PRODUCT_GATE_V296.md', 'utf8');
const v294Browser = readFileSync('tests/mobile-shell-orientation-recovery-audit-v293.spec.mjs', 'utf8');
const v295Browser = readFileSync('tests/mobile-shell-resize-scope-audit-v295.spec.mjs', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

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
