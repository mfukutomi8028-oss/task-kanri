import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_LONG_LIVED_RESPONSIBILITY_AUDIT_V313.md', 'utf8');
const browser = readFileSync('tests/mobile-shell-long-lived-responsibility-v313.spec.mjs', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.313 audit keeps product release and responsibility baseline at 277', () => {
  assert.equal(release, 277);
  assert.equal(String(responsibilities.baselineRelease), '277');
  assert.match(audit, /Product runtime is not changed in this audit/);
});

test('Ver.313 excludes already-audited resize and semantic board observer ownership', () => {
  assert.match(mobile, /window\.addEventListener\("resize", schedulePatch\)/);
  assert.match(mobile, /new MutationObserver\(records =>/);
  assert.match(mobile, /\.observe\(boardView, \{ childList: true \}\)/);
  assert.match(audit, /Ver\.295〜302/);
});

test('Ver.313 remaining navigation responsibility stays nav-root scoped and single-guarded', () => {
  assert.match(mobile, /function bindGlobalClicks\(\)/);
  assert.match(mobile, /window\.__workBoardMobileFixClicksV101/);
  assert.match(mobile, /document\.querySelector\("\.nav"\)\?\.addEventListener\("click", event =>/);
  assert.doesNotMatch(mobile, /document\.addEventListener\("click", event =>[\s\S]*?closest\?\.\("\.nav-item"\)/);
});

test('Ver.313 preserves transient document listeners instead of treating them as permanent ownership', () => {
  assert.match(mobile, /function setCreateMenuOutsideClickBound\(shouldBind\)/);
  assert.match(mobile, /document\.addEventListener\("click", handleCreateMenuOutsideClick\)/);
  assert.match(mobile, /document\.removeEventListener\("click", handleCreateMenuOutsideClick\)/);
  assert.match(mobile, /function syncMobileEscapeKeydownBound\(\)/);
  assert.match(mobile, /document\.addEventListener\("keydown", handleMobileEscapeKeydown\)/);
  assert.match(mobile, /document\.removeEventListener\("keydown", handleMobileEscapeKeydown\)/);
});

test('Ver.313 startup listeners remain one-shot and orientationchange stays retired', () => {
  const domReadyRegistrations = [...mobile.matchAll(/document\.addEventListener\("DOMContentLoaded", [^\n]+\{ once: true \}\)/g)];
  assert.equal(domReadyRegistrations.length, 2);
  assert.doesNotMatch(mobile, /orientationchange/);
});

test('Ver.313 browser audit measures nav root identity, callback scope, late load, and desktop boundary', () => {
  assert.match(browser, /sameNavRoot/);
  assert.match(browser, /navCallbacks/);
  assert.match(browser, /bindAdds/);
  assert.match(browser, /861/);
  assert.match(browser, /860/);
  assert.match(browser, /1000/);
});
