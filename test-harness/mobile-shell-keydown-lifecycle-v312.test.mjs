import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const product = readFileSync('tests/mobile-shell-keydown-lifecycle-v312.spec.mjs', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

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