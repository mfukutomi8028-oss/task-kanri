import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const app = readFileSync('app.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_NAVIGATION_HANDOFF_AUDIT_V305.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.305 audit stays on the Ver.304 product baseline', () => {
  assert.equal(release, 273);
  assert.equal(String(responsibilities.baselineRelease), '273');
});

test('Ver.305 audit anchors the current capture plus zero-timeout navigation reconciliation', () => {
  assert.match(mobile, /function bindGlobalClicks\(\)/);
  assert.match(mobile, /document\.addEventListener\("click", event => \{/);
  assert.match(mobile, /event\.target\?\.closest\?\.\("\.nav-item"\)/);
  assert.match(mobile, /setTimeout\(\(\) => \{\s*closeMobileMenu\(\);\s*syncMobileHeaderTitle\(\);\s*patchMobileBoardTabs\(\);\s*\}, 0\);/);
  assert.match(mobile, /\}, true\);/);
});

test('Ver.305 canonical nav owner renders synchronously on the target element', () => {
  const navBlock = app.match(/elements\.navItems\.forEach\(button => \{[\s\S]*?\n  \}\);/)?.[0] || '';
  assert.ok(navBlock, 'canonical nav click block must exist');
  assert.match(navBlock, /button\.addEventListener\("click", \(\) => \{/);
  assert.match(navBlock, /state\.layout = button\.dataset\.layout/);
  assert.match(navBlock, /syncNavigationUi\(\);\s*render\(\);/);
  assert.doesNotMatch(navBlock, /stopPropagation\(|stopImmediatePropagation\(/);
});

test('Ver.305 audit records the proven bubble-phase handoff without product promotion', () => {
  assert.match(audit, /document bubble phase/);
  assert.match(audit, /same click task/);
  assert.match(audit, /861px -> 860px/);
  assert.match(audit, /Regression #784/);
  assert.match(audit, /Protocol and release-contract tests: success/);
  assert.match(audit, /Browser regression smoke tests: success/);
  assert.match(audit, /Firebase Emulator write tests: success/);
  assert.match(audit, /Ver\.305 itself is audit-only/);

  const group = responsibilities.groups?.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.ok(group);
  assert.match(group.reason, /Ver\.305監査/);
  assert.match(group.reason, /document bubble listener/);
  assert.match(group.reason, /Regression #784/);
  assert.match(group.reason, /release 273/);
});

test('Ver.305 hands the next product step to Ver.306 while keeping release 273', () => {
  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.equal(next.order, 1);
  assert.deepEqual(next.scope, ['mobile-shell-v234.js']);
  assert.match(next.goal, /Ver\.306製品/);
  assert.match(next.goal, /document capture \+ setTimeout\(0\)/);
  assert.match(next.goal, /document bubble phase/);
  assert.match(next.precondition, /Ver\.305監査/);
  assert.match(next.precondition, /273/);
});
