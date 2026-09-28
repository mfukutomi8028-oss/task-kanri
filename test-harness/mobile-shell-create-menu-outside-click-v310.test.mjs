import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const product = readFileSync('MOBILE_SHELL_CREATE_MENU_OUTSIDE_CLICK_V310.md', 'utf8');
const audit = readFileSync('MOBILE_SHELL_CREATE_MENU_OUTSIDE_CLICK_AUDIT_V309.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.310 promotes transient create-menu outside-click lifecycle at release 276', () => {
  assert.equal(release, 276);
  assert.equal(String(responsibilities.baselineRelease), '276');
  assert.match(mobile, /\/\/ Ver\.310:/);
  assert.match(mobile, /let createMenuOutsideClickBound = false;/);
  assert.match(mobile, /function handleCreateMenuOutsideClick\(event\)/);
  assert.match(mobile, /function setCreateMenuOutsideClickBound\(shouldBind\)/);
  assert.match(mobile, /document\.addEventListener\("click", handleCreateMenuOutsideClick\);/);
  assert.match(mobile, /document\.removeEventListener\("click", handleCreateMenuOutsideClick\);/);
  assert.doesNotMatch(mobile, /document\.addEventListener\("click", event => \{\s*if \(!event\.target\?\.closest\?\.\("#workMobileHeader"\)\) closeCreateMenu\(\);\s*\}\);/s);
});

test('toggle and close own the outside-click listener binding lifecycle', () => {
  assert.match(mobile, /button\?\.setAttribute\("aria-expanded", open \? "true" : "false"\);\s*setCreateMenuOutsideClickBound\(open\);/s);
  assert.match(mobile, /document\.querySelector\("\.work-mobile-action-button"\)\?\.setAttribute\("aria-expanded", "false"\);\s*setCreateMenuOutsideClickBound\(false\);/s);
});

test('Ver.310 preserves keydown, nav and schedule handoff boundaries', () => {
  assert.match(mobile, /document\.addEventListener\("keydown", event =>/);
  assert.match(mobile, /document\.querySelector\("\.nav"\)\?\.addEventListener\("click", event =>/);
  assert.match(mobile, /document\.querySelector\("\.nav-item\[data-layout='schedule'\], \[data-layout='schedule'\]"\)\?\.click\(\);\s*tryOpen\(\);/s);
});

test('responsibility map records promotion and the next keydown audit boundary', () => {
  const group = responsibilities.groups.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.ok(group);
  assert.match(group.reason, /Ver\.309監査/);
  assert.match(group.reason, /Ver\.310製品/);
  assert.match(group.reason, /release 276/);

  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.match(next.goal, /Ver\.311監査/);
  assert.match(next.goal, /keydown/);
  assert.match(next.precondition, /Ver\.310/);
  assert.match(next.precondition, /276/);
});

test('audit and product documentation retain evidence and explicit boundaries', () => {
  assert.match(audit, /document-level [`\w]*click[`\w]* listener/);
  assert.match(product, /menu open/);
  assert.match(product, /Ver\.311/);
});
