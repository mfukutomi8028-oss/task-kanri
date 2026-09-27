import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const app = readFileSync('app.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_NAVIGATION_HANDOFF_AUDIT_V305.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.306 product promotes release and responsibility baseline together', () => {
  assert.equal(release, 274);
  assert.equal(String(responsibilities.baselineRelease), '274');
});

test('Ver.306 product uses synchronous bubble-phase navigation reconciliation', () => {
  assert.match(mobile, /function bindGlobalClicks\(\)/);
  assert.match(mobile, /document\.addEventListener\("click", event => \{/);
  assert.match(mobile, /event\.target\?\.closest\?\.\("\.nav-item"\)/);
  assert.match(mobile, /closeMobileMenu\(\);\s*syncMobileHeaderTitle\(\);\s*patchMobileBoardTabs\(\);/);
  assert.doesNotMatch(mobile, /setTimeout\(\(\) => \{\s*closeMobileMenu\(\);\s*syncMobileHeaderTitle\(\);\s*patchMobileBoardTabs\(\);\s*\}, 0\);/);
  assert.doesNotMatch(mobile, /\}, true\);\s*\n\s*\}/);
});

test('Ver.306 keeps canonical nav ownership on the target element', () => {
  const navBlock = app.match(/elements\.navItems\.forEach\(button => \{[\s\S]*?\n  \}\);/)?.[0] || '';
  assert.ok(navBlock, 'canonical nav click block must exist');
  assert.match(navBlock, /button\.addEventListener\("click", \(\) => \{/);
  assert.match(navBlock, /state\.layout = button\.dataset\.layout/);
  assert.match(navBlock, /syncNavigationUi\(\);\s*render\(\);/);
  assert.doesNotMatch(navBlock, /stopPropagation\(|stopImmediatePropagation\(/);
});

test('Ver.305 audit evidence remains durable after Ver.306 promotion', () => {
  assert.match(audit, /document bubble phase/);
  assert.match(audit, /same click task/);
  assert.match(audit, /861px -> 860px/);
  assert.match(audit, /Regression #784/);
  assert.match(audit, /Protocol and release-contract tests: success/);
  assert.match(audit, /Browser regression smoke tests: success/);
  assert.match(audit, /Firebase Emulator write tests: success/);

  const group = responsibilities.groups?.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.ok(group);
  assert.match(group.reason, /Ver\.305監査/);
  assert.match(group.reason, /Ver\.306製品/);
  assert.match(group.reason, /document bubble/);
  assert.match(group.reason, /release 274/);
});

test('Ver.306 hands the next audit boundary forward', () => {
  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.equal(next.order, 1);
  assert.deepEqual(next.scope, ['mobile-shell-v234.js']);
  assert.match(next.goal, /Ver\.307監査/);
  assert.match(next.precondition, /Ver\.306/);
  assert.match(next.precondition, /274/);
});