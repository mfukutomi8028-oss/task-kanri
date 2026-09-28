import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const app = readFileSync('app.js', 'utf8');
const workFeatures = readFileSync('work-features-v167.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_NAV_TARGET_BINDING_AUDIT_V307.md', 'utf8');
const product = readFileSync('MOBILE_SHELL_NAV_SCOPE_V308.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.308 release baseline remains present in later synchronized releases', () => {
  assert.ok(release >= 275);
  assert.equal(String(responsibilities.baselineRelease), String(release));
});

test('Ver.308 scopes navigation reconciliation to the stable nav container', () => {
  assert.match(mobile, /function bindGlobalClicks\(\)/);
  assert.match(mobile, /document\.querySelector\("\.nav"\)\?\.addEventListener\("click", event => \{/);
  assert.match(mobile, /event\.target\?\.closest\?\.\("\.nav-item"\)/);
  assert.match(mobile, /closeMobileMenu\(\);\s*syncMobileHeaderTitle\(\);\s*patchMobileBoardTabs\(\);/);
  const block = mobile.match(/function bindGlobalClicks\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.doesNotMatch(block, /document\.addEventListener\("click"/);
  assert.match(block, /window\.__workBoardMobileFixClicksV101/);
});

test('Ver.308 preserves dynamic Work Memo coverage and canonical nav ownership', () => {
  assert.match(workFeatures, /button\.className = 'nav-item work-memo-nav-v167'/);
  assert.match(workFeatures, /schedule\.insertAdjacentElement\('afterend', button\)/);
  const navBlock = app.match(/elements\.navItems\.forEach\(button => \{[\s\S]*?\n  \}\);/)?.[0] || '';
  assert.ok(navBlock, 'canonical nav click block must exist');
  assert.match(navBlock, /button\.addEventListener\("click", \(\) => \{/);
  assert.match(navBlock, /syncNavigationUi\(\);\s*render\(\);/);
  assert.doesNotMatch(navBlock, /stopPropagation\(|stopImmediatePropagation\(/);
});

test('Ver.307 evidence and Ver.308 promotion rationale remain durable', () => {
  assert.match(audit, /initial direct-target proposal is rejected/);
  assert.match(audit, /container-scoped delegation/);
  assert.match(product, /document\.querySelector\("\.nav"\)/);
  assert.match(product, /861px -> 860px/);
  const group = responsibilities.groups?.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.ok(group);
  assert.match(group.reason, /Ver\.307監査/);
  assert.match(group.reason, /Ver\.308製品/);
  assert.match(group.reason, /release 275/);
});

test('Ver.308 historic handoff to the create-menu audit remains documented', () => {
  assert.match(product, /Ver\.309 should re-audit/);
  assert.match(product, /create-menu/);
  assert.match(product, /No product change is authorized until equivalent behavior is proven/);
});
