import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const app = readFileSync('app.js', 'utf8');
const html = readFileSync('index.html', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_NAV_TARGET_BINDING_AUDIT_V307.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.307 audit stays on Ver.306 release baseline without product runtime changes', () => {
  assert.equal(release, 274);
  assert.equal(String(responsibilities.baselineRelease), '274');
  assert.match(mobile, /document\.addEventListener\("click", event => \{/);
  assert.match(mobile, /event\.target\?\.closest\?\.\("\.nav-item"\)/);
  assert.doesNotMatch(mobile, /document\.querySelectorAll\("\.nav-item"\)\.forEach/);
});

test('Ver.307 candidate targets the seven static nav buttons already present in index.html', () => {
  const navItems = [...html.matchAll(/<button class="[^"]*nav-item[^"]*"[^>]*>/g)];
  assert.equal(navItems.length, 7);
  assert.match(html, /class="nav-item active" data-layout="today"/);
  assert.match(html, /class="nav-item" data-layout="todos"/);
  assert.match(html, /class="nav-item" data-layout="tasks"/);
  assert.match(html, /class="nav-item" data-layout="schedule"/);
  assert.equal((html.match(/class="nav-item nav-filter"/g) || []).length, 3);
});

test('Ver.307 preserves canonical navigation ownership before narrowing mobile reconciliation', () => {
  const navBlock = app.match(/elements\.navItems\.forEach\(button => \{[\s\S]*?\n  \}\);/)?.[0] || '';
  assert.ok(navBlock, 'canonical nav click block must exist');
  assert.match(navBlock, /button\.addEventListener\("click", \(\) => \{/);
  assert.match(navBlock, /state\.layout = button\.dataset\.layout/);
  assert.match(navBlock, /syncNavigationUi\(\);\s*render\(\);/);
  assert.doesNotMatch(navBlock, /stopPropagation\(|stopImmediatePropagation\(/);
});

test('Ver.307 keeps one-shot binding and documents an audit-only explicit-target candidate', () => {
  assert.match(mobile, /if \(window\.__workBoardMobileFixClicksV101\) return;/);
  assert.match(mobile, /window\.__workBoardMobileFixClicksV101 = true;/);
  assert.match(audit, /Audit-only: product runtime and release remain unchanged/);
  assert.match(audit, /document\.querySelectorAll\('\.nav-item'\)/);
  assert.match(audit, /861px -> 860px/);
  assert.match(audit, /Schedule create handoff remains intact/);
  assert.match(audit, /No production change is authorized/);
});

test('Ver.307 remains the first declared cleanup candidate', () => {
  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.equal(next.order, 1);
  assert.deepEqual(next.scope, ['mobile-shell-v234.js']);
  assert.match(next.goal, /Ver\.307監査/);
  assert.match(next.precondition, /Ver\.306/);
  assert.match(next.precondition, /274/);
});
