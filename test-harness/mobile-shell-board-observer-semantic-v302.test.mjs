import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const app = readFileSync('app.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_BOARD_OBSERVER_SEMANTIC_AUDIT_V301.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.302 advances release and responsibility baseline together', () => {
  assert.equal(release, 272);
  assert.equal(String(responsibilities.baselineRelease), '272');
});

test('Ver.302 product gates direct-child board reconciliation on board-column identity', () => {
  assert.match(mobile, /const boardView = document\.getElementById\("boardView"\)/);
  assert.match(mobile, /new MutationObserver\(records => \{/);
  assert.match(mobile, /const hasBoardColumnChange = records\.some\(record =>/);
  assert.match(mobile, /\.\.\.record\.addedNodes, \.\.\.record\.removedNodes/);
  assert.match(mobile, /node\.nodeType === 1 && node\.matches\?\.\("\.board-column"\)/);
  assert.match(mobile, /if \(hasBoardColumnChange\) scheduleBoardTabs\(\)/);
  assert.match(mobile, /\}\)\.observe\(boardView, \{ childList: true \}\)/);
  assert.doesNotMatch(mobile, /observe\(boardView, \{ childList: true, subtree: true \}\)/);
});

test('Ver.302 keeps canonical redraw and reconciliation ownership unchanged', () => {
  assert.match(app, /function renderBoard\(tasks\)/);
  assert.match(app, /elements\.boardView\.innerHTML = columns \+ addColumn/);
  assert.match(mobile, /const scheduleBoardTabs = \(\) => \{/);
  assert.match(mobile, /requestAnimationFrame\(\(\) => \{\s*boardTabsScheduled = false;\s*patchMobileBoardTabs\(\);\s*\}\)/);
  assert.match(mobile, /window\.addEventListener\("resize", schedulePatch\)/);
  assert.match(mobile, /function patchAll\(\)/);
  assert.match(mobile, /setTimeout\(tryOpen, 80\)/);
  assert.match(mobile, /setTimeout\(tryOpen, 220\)/);
  assert.match(mobile, /setTimeout\(tryOpen, 500\)/);
});

test('Ver.302 responsibility record promotes only the audited semantic boundary', () => {
  assert.match(audit, /No tested canonical path required reconciliation for a direct-child mutation that lacked `\.board-column` addition\/removal/);
  const group = responsibilities.groups?.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.ok(group);
  assert.match(group.reason, /Ver\.301監査/);
  assert.match(group.reason, /Ver\.302製品/);
  assert.match(group.reason, /release 272/);
});
