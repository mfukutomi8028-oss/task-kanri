import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_KEYDOWN_LIFECYCLE_AUDIT_V311.md', 'utf8');
const browserAudit = readFileSync('tests/mobile-shell-keydown-lifecycle-audit-v311.spec.mjs', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.311 is audit-only at Ver.310 release 276', () => {
  assert.equal(release, 276);
  assert.equal(String(responsibilities.baselineRelease), '276');
  assert.match(mobile, /\/\/ Ver\.310:/);
  assert.doesNotMatch(mobile, /\/\/ Ver\.311:/);
});

test('current product retains permanent keydown listener for baseline measurement', () => {
  assert.match(mobile, /document\.addEventListener\("keydown", event => \{\s*if \(event\.key === "Escape"\) \{\s*closeMobileMenu\(\);\s*closeCreateMenu\(\);\s*\}\s*\}\);/s);
});

test('Ver.310 create-menu outside-click and Ver.308 nav boundaries remain product-owned', () => {
  assert.match(mobile, /function setCreateMenuOutsideClickBound\(shouldBind\)/);
  assert.match(mobile, /document\.addEventListener\("click", handleCreateMenuOutsideClick\);/);
  assert.match(mobile, /document\.querySelector\("\.nav"\)\?\.addEventListener\("click", event =>/);
});

test('Ver.311 browser audit models one DOM-derived transient keydown lifecycle', () => {
  assert.match(browserAudit, /let mobileEscapeKeydownBound = false/);
  assert.match(browserAudit, /function syncMobileEscapeKeydownBound\(\)/);
  assert.match(browserAudit, /work-mobile-menu-open/);
  assert.match(browserAudit, /workMobileCreateMenu/);
  assert.match(browserAudit, /document\.addEventListener\(\"keydown\", handleMobileEscapeKeydown\)/);
  assert.match(browserAudit, /document\.removeEventListener\(\"keydown\", handleMobileEscapeKeydown\)/);
});

test('Ver.311 documentation keeps explicit audit and product gates', () => {
  assert.match(audit, /Product runtime is not changed/);
  assert.match(audit, /release \/ baselineRelease: `276`/);
  assert.match(audit, /Ver\.312/);
  assert.match(audit, /276 to 277/);
});