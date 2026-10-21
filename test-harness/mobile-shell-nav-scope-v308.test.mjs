import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const app = readFileSync('app.js', 'utf8');
const html = readFileSync('index.html', 'utf8');
const workFeatures = readFileSync('work-features-v167.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('docs/HISTORICAL_MOBILE_INTERACTION_AUDITS_V511.md', 'utf8');
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

// Ver.495: all original Ver.307 historical checks are retained without changing their assertions.
test('Ver.307 evidence remains anchored at release 274 while later product may advance', () => {
  assert.ok(release >= 274);
  assert.equal(String(responsibilities.baselineRelease), String(release));
  if (release === 274) {
    assert.match(mobile, /document\.addEventListener\("click", event => \{/);
    assert.doesNotMatch(mobile, /document\.querySelector\("\.nav"\)\?\.addEventListener/);
  } else {
    assert.match(mobile, /document\.querySelector\("\.nav"\)\?\.addEventListener\("click", event => \{/);
    const block = mobile.match(/function bindGlobalClicks\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
    assert.doesNotMatch(block, /document\.addEventListener\("click"/);
  }
});

test('Ver.307 records why direct binding to the seven initial nav buttons is incomplete', () => {
  const navItems = [...html.matchAll(/<button class="[^"]*nav-item[^"]*"[^>]*>/g)];
  assert.equal(navItems.length, 7);
  assert.match(workFeatures, /function createMemoNav\(\)/);
  assert.match(workFeatures, /button\.className = 'nav-item work-memo-nav-v167'/);
  assert.match(workFeatures, /schedule\.insertAdjacentElement\('afterend', button\)/);
  assert.match(audit, /eight `.nav-item` elements, not seven/);
  assert.match(audit, /initial direct-target proposal is rejected/);
});

test('Ver.307 preserves canonical navigation ownership before scoped mobile reconciliation', () => {
  const navBlock = app.match(/elements\.navItems\.forEach\(button => \{[\s\S]*?\n  \}\);/)?.[0] || '';
  assert.ok(navBlock, 'canonical nav click block must exist');
  assert.match(navBlock, /button\.addEventListener\("click", \(\) => \{/);
  assert.match(navBlock, /state\.layout = button\.dataset\.layout/);
  assert.match(navBlock, /syncNavigationUi\(\);\s*render\(\);/);
  assert.doesNotMatch(navBlock, /stopPropagation\(|stopImmediatePropagation\(/);
});

test('Ver.307 refined candidate keeps delegation and becomes Ver.308 product at release 275', () => {
  assert.match(mobile, /if \(window\.__workBoardMobileFixClicksV101\) return;/);
  assert.match(mobile, /window\.__workBoardMobileFixClicksV101 = true;/);
  assert.match(audit, /container-scoped delegation/);
  assert.match(audit, /stable sidebar navigation container `.nav`/);
  assert.ok(audit.includes("event.target?.closest?.('.nav-item')"));
  assert.match(audit, /861px -> 860px/);
  assert.match(audit, /Schedule create handoff remains intact/);
  if (release >= 275) {
    const group = responsibilities.groups?.find(item => item.id === 'responsive-sidebar-toolbar');
    assert.match(group?.reason || '', /Ver\.307監査/);
    assert.match(group?.reason || '', /Ver\.308製品/);
    assert.match(group?.reason || '', /release 275/);
  }
});

test('Ver.307 historic product gate remains documented without owning the current cleanup candidate', () => {
  assert.match(audit, /container-scoped delegation/);
  assert.match(audit, /release manifest and `baselineRelease` remain 274 during audit/);
  assert.match(audit, /next product version may replace document-wide navigation delegation with `.nav`-scoped delegation/);
});

test('Ver.495 retired Ver.307 standalone navigation suite stays absent', () => {
  assert.equal(existsSync(new URL('./mobile-shell-nav-target-binding-v307.test.mjs', import.meta.url)), false);
});

// Ver.497: Ver.305 audit remains scoped to its original immutable fixture; case bodies unchanged.
{
const audit = readFileSync('MOBILE_SHELL_NAVIGATION_HANDOFF_AUDIT_V305.md', 'utf8');
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
}

test('Ver.497 retired Ver.305 standalone navigation handoff stays absent', () => {
  assert.equal(existsSync(new URL('./mobile-shell-navigation-handoff-v305.test.mjs', import.meta.url)), false);
});
