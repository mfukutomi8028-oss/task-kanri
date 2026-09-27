import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shell = readFileSync('mobile-shell-v234.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const audit = readFileSync('MOBILE_SHELL_CREATE_MENU_OUTSIDE_CLICK_AUDIT_V309.md', 'utf8');
const browser = readFileSync('tests/mobile-shell-create-menu-outside-click-audit-v309.spec.mjs', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.309 audit remains on Ver.308 release 275 without product runtime change', () => {
  assert.equal(release, 275);
  assert.match(shell, /document\.addEventListener\("click", event => \{\s*if \(!event\.target\?\.closest\?\.\("#workMobileHeader"\)\) closeCreateMenu\(\);\s*\}\);/);
  assert.doesNotMatch(shell, /setCreateMenuOutsideClickBound/);
});

test('Ver.309 audits lifecycle narrowing instead of a permanent body-level substitution', () => {
  assert.match(audit, /listener is useful only while `#workMobileCreateMenu` is open/);
  assert.match(audit, /lifecycle audit rather than a simple `document -> body` target move/);
  assert.match(audit, /Ver\.310 may promote only this listener lifecycle narrowing/);
  assert.match(audit, /Release and `baselineRelease` remain 275/);
});

test('Ver.309 browser candidate explicitly binds on open and unbinds on every close path', () => {
  assert.match(browser, /setCreateMenuOutsideClickBound/);
  assert.match(browser, /document\.addEventListener\('click', handleCreateMenuOutsideClick\)/);
  assert.match(browser, /document\.removeEventListener\('click', handleCreateMenuOutsideClick\)/);
  assert.match(browser, /setCreateMenuOutsideClickBound\(open\)/);
  assert.match(browser, /setCreateMenuOutsideClickBound\(false\)/);
});
