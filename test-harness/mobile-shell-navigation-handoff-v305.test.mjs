import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const app = readFileSync('app.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_NAVIGATION_HANDOFF_AUDIT_V305.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.306+ product keeps release and responsibility baseline aligned after 274', () => {
  assert.ok(release >= 274);
  assert.equal(String(responsibilities.baselineRelease), String(release));
});

test('Ver.306+ product keeps synchronous bubble-phase navigation reconciliation', () => {
  assert.match(mobile, /function bindGlobalClicks\(\)/);
  if (release === 274) {
    assert.match(mobile, /document\.addEventListener\("click", event => \{/);
  } else {
    assert.match(mobile, /document\.querySelector\("\.nav"\)\?\.addEventListener\("click", event => \{/);
  }
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

test('Ver.305 audit evidence remains durable after later promotion', () => {
  assert.match(audit, /document bubble phase/);
  assert.match(audit, /same click task/);
  assert.match(audit, /861px -> 860px/);
  assert.match(audit, /Regression #784/);
  const group = responsibilities.groups?.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.ok(group);
  assert.match(group.reason, /Ver\.305監査/);
  assert.match(group.reason, /Ver\.306製品/);
  assert.match(group.reason, /release 274/);
  if (release >= 275) {
    assert.match(group.reason, /Ver\.307監査/);
    assert.match(group.reason, /Ver\.308製品/);
  }
});

test('Ver.305 historic handoff remains documented without owning the current cleanup candidate', () => {
  assert.match(audit, /Ver\.306/);
  assert.match(audit, /document bubble phase/);
  assert.match(audit, /release 273/);
});
