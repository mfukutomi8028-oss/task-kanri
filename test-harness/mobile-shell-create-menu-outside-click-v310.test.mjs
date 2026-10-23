import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const product = readFileSync('MOBILE_SHELL_CREATE_MENU_OUTSIDE_CLICK_V310.md', 'utf8');
const audit = readFileSync('docs/HISTORICAL_MOBILE_INTERACTION_AUDITS_V511.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.310 transient create-menu outside-click lifecycle remains active in later releases', () => {
  assert.ok(release >= 276);
  assert.equal(String(responsibilities.baselineRelease), String(release));
  assert.match(mobile, /\/\/ Ver\.310:/);
  assert.match(mobile, /let createMenuOutsideClickBound = false;/);
  assert.match(mobile, /function handleCreateMenuOutsideClick\(event\)/);
  assert.match(mobile, /function setCreateMenuOutsideClickBound\(shouldBind\)/);
  assert.match(mobile, /document\.addEventListener\("click", handleCreateMenuOutsideClick\);/);
  assert.match(mobile, /document\.removeEventListener\("click", handleCreateMenuOutsideClick\);/);
  assert.doesNotMatch(mobile, /document\.addEventListener\("click", event => \{\s*if \(!event\.target\?\.closest\?\.\("#workMobileHeader"\)\) closeCreateMenu\(\);\s*\}\);/s);
});

test('toggle and close still own the outside-click listener binding lifecycle', () => {
  assert.match(mobile, /button\?\.setAttribute\("aria-expanded", open \? "true" : "false"\);\s*setCreateMenuOutsideClickBound\(open\);/s);
  assert.match(mobile, /document\.querySelector\("\.work-mobile-action-button"\)\?\.setAttribute\("aria-expanded", "false"\);\s*setCreateMenuOutsideClickBound\(false\);/s);
});

test('Ver.310 preserves nav and schedule handoff while later Escape narrowing may coexist', () => {
  assert.match(mobile, /document\.querySelector\("\.nav"\)\?\.addEventListener\("click", event =>/);
  assert.match(mobile, /document\.querySelector\("\.nav-item\[data-layout='schedule'\], \[data-layout='schedule'\]"\)\?\.click\(\);\s*tryOpen\(\);/s);
  assert.match(mobile, /keydown/);
});

test('responsibility map retains the Ver.309 audit and Ver.310 productization history', () => {
  const group = responsibilities.groups.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.ok(group);
  assert.match(group.reason, /Ver\.309監査/);
  assert.match(group.reason, /Ver\.310製品/);
  assert.match(group.reason, /release 276/);
});

test('audit and product documentation retain Ver.310 evidence and explicit boundaries', () => {
  assert.match(audit, /document-level [`\w]*click[`\w]* listener/);
  assert.match(product, /menu open/);
  assert.match(product, /Ver\.311/);
});

// Ver.522: モバイル一時メニューのEscape監視を、外側クリック監視の既存Protocol責務へ統合。
{
const product = readFileSync('tests/mobile-shell-keydown-lifecycle-v312.spec.mjs', 'utf8');
test('Ver.312 Escape lifecycle remains present in release 277 and later', () => {
  assert.ok(release >= 277);
  assert.equal(String(responsibilities.baselineRelease), String(release));
  assert.match(mobile, /\/\/ Ver\.312:/);
});

test('Ver.312 product owns one DOM-derived transient mobile Escape lifecycle', () => {
  assert.match(mobile, /let mobileEscapeKeydownBound = false/);
  assert.match(mobile, /function handleMobileEscapeKeydown\(event\)/);
  assert.match(mobile, /function syncMobileEscapeKeydownBound\(\)/);
  assert.match(mobile, /work-mobile-menu-open/);
  assert.match(mobile, /workMobileCreateMenu/);
  assert.match(mobile, /document\.addEventListener\("keydown", handleMobileEscapeKeydown\)/);
  assert.match(mobile, /document\.removeEventListener\("keydown", handleMobileEscapeKeydown\)/);
  assert.doesNotMatch(mobile, /document\.addEventListener\("keydown", event =>/);
});

test('Ver.312 syncs Escape ownership at every drawer/create-menu close or toggle boundary', () => {
  assert.match(mobile, /function closeMobileMenu\(\)[\s\S]*?syncMobileEscapeKeydownBound\(\);/);
  assert.match(mobile, /function toggleCreateMenu\(\)[\s\S]*?setCreateMenuOutsideClickBound\(open\);\s*syncMobileEscapeKeydownBound\(\);/);
  assert.match(mobile, /function closeCreateMenu\(\)[\s\S]*?setCreateMenuOutsideClickBound\(false\);\s*syncMobileEscapeKeydownBound\(\);/);
  assert.match(mobile, /work-mobile-menu-button[\s\S]*?closeCreateMenu\(\);\s*syncMobileMenuButton\(\);\s*syncMobileEscapeKeydownBound\(\);/);
});

test('Ver.310 outside-click and Ver.308 nav boundaries remain intact', () => {
  assert.match(mobile, /function setCreateMenuOutsideClickBound\(shouldBind\)/);
  assert.match(mobile, /document\.addEventListener\("click", handleCreateMenuOutsideClick\)/);
  assert.match(mobile, /document\.querySelector\("\.nav"\)\?\.addEventListener\("click", event =>/);
});

test('Ver.312 browser regression measures the product runtime instead of an injected candidate', () => {
  assert.match(product, /handleMobileEscapeKeydown/);
  assert.match(product, /syncMobileEscapeKeydownBound/);
  assert.doesNotMatch(product, /candidate\s*=/);
  assert.match(product, /Number\(await boot\(page\)\)\)\.toBeGreaterThanOrEqual\(277\)/);
});
}
