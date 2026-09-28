import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const product = readFileSync('MOBILE_SHELL_KEYDOWN_LIFECYCLE_V312.md', 'utf8');
const audit = readFileSync('MOBILE_SHELL_KEYDOWN_LIFECYCLE_AUDIT_V311.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.312 promotes transient mobile Escape lifecycle at release 277', () => {
  assert.equal(release, 277);
  assert.equal(String(responsibilities.baselineRelease), '277');
  assert.match(mobile, /\/\/ Ver\.312:/);
  assert.match(mobile, /let mobileEscapeKeydownBound = false;/);
  assert.match(mobile, /function handleMobileEscapeKeydown\(event\)/);
  assert.match(mobile, /function syncMobileEscapeKeydownBound\(\)/);
  assert.match(mobile, /document\.addEventListener\("keydown", handleMobileEscapeKeydown\);/);
  assert.match(mobile, /document\.removeEventListener\("keydown", handleMobileEscapeKeydown\);/);
});

test('permanent anonymous document keydown listener is retired', () => {
  assert.doesNotMatch(mobile, /document\.addEventListener\("keydown", event => \{\s*if \(event\.key === "Escape"\)/s);
  assert.match(mobile, /document\.body\?\.classList\.contains\("work-mobile-menu-open"\)/);
  assert.match(mobile, /document\.getElementById\("workMobileCreateMenu"\)\?\.classList\.contains\("open"\)/);
});

test('drawer and create menu transitions resync one DOM-derived Escape binding', () => {
  assert.match(mobile, /function closeMobileMenu\(\) \{[\s\S]*?syncMobileEscapeKeydownBound\(\);\s*\}/);
  assert.match(mobile, /function toggleCreateMenu\(\) \{[\s\S]*?setCreateMenuOutsideClickBound\(open\);\s*syncMobileEscapeKeydownBound\(\);\s*\}/);
  assert.match(mobile, /function closeCreateMenu\(\) \{[\s\S]*?setCreateMenuOutsideClickBound\(false\);\s*syncMobileEscapeKeydownBound\(\);\s*\}/);
});

test('Ver.312 preserves outside-click, nav and schedule handoff boundaries', () => {
  assert.match(mobile, /function setCreateMenuOutsideClickBound\(shouldBind\)/);
  assert.match(mobile, /document\.addEventListener\("click", handleCreateMenuOutsideClick\);/);
  assert.match(mobile, /document\.querySelector\("\.nav"\)\?\.addEventListener\("click", event =>/);
  assert.match(mobile, /document\.querySelector\("\.nav-item\[data-layout='schedule'\], \[data-layout='schedule'\]"\)\?\.click\(\);\s*tryOpen\(\);/s);
});

test('responsibility map records Ver.311 audit, Ver.312 product, and next audit boundary', () => {
  const group = responsibilities.groups.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.ok(group);
  assert.match(group.reason, /Ver\.311監査/);
  assert.match(group.reason, /Ver\.312製品/);
  assert.match(group.reason, /release 277/);

  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.match(next.goal, /Ver\.313監査/);
  assert.match(next.precondition, /Ver\.312/);
  assert.match(next.precondition, /277/);
});

test('audit and product docs preserve explicit evidence and write-path boundaries', () => {
  assert.match(audit, /transient Escape listener/);
  assert.match(product, /276 → 277/);
  assert.match(product, /Firebase/);
  assert.match(product, /Ver\.313/);
});
