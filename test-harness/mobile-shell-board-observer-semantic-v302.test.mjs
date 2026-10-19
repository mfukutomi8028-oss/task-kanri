import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const app = readFileSync('app.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_BOARD_OBSERVER_AUDIT_V299.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.302+ keeps release and responsibility baseline aligned', () => {
  assert.ok(release >= 272);
  assert.equal(String(responsibilities.baselineRelease), String(release));
});

test('Ver.302 observer only schedules for direct board-column additions or removals', () => {
  assert.match(mobile, /new MutationObserver\(records => \{/);
  assert.match(mobile, /const hasBoardColumnChange = records\.some\(record =>/);
  assert.match(mobile, /\.\.\.record\.addedNodes, \.\.\.record\.removedNodes/);
  assert.match(mobile, /node\.nodeType === 1 && node\.matches\?\.\("\.board-column"\)/);
  assert.match(mobile, /if \(hasBoardColumnChange\) scheduleBoardTabs\(\)/);
  assert.match(mobile, /\.observe\(boardView, \{ childList: true \}\)/);
  assert.doesNotMatch(mobile, /subtree:\s*true/);
});

test('Ver.302 preserves existing reconciliation owners while later schedule cleanup advances independently', () => {
  assert.match(mobile, /window\.addEventListener\("resize", schedulePatch\)/);
  assert.match(mobile, /patchMobileBoardTabs\(\);\s*syncMobileHeaderTitle\(\);\s*syncMobileMenuButton\(\);/s);
  if (release < 273) {
    assert.match(mobile, /setTimeout\(tryOpen, 80\)/);
    assert.match(mobile, /setTimeout\(tryOpen, 220\)/);
    assert.match(mobile, /setTimeout\(tryOpen, 500\)/);
  } else {
    assert.doesNotMatch(mobile, /setTimeout\(tryOpen, (?:80|220|500)\)/);
    assert.match(mobile, /document\.querySelector\("\.nav-item\[data-layout='schedule'\], \[data-layout='schedule'\]"\)\?\.click\(\);\s*tryOpen\(\);/);
    const group = responsibilities.groups?.find(item => item.id === 'responsive-sidebar-toolbar');
    assert.ok(group);
    assert.match(group.reason, /Ver\.303監査/);
    assert.match(group.reason, /Ver\.304製品/);
    assert.match(group.reason, /release 273/);
  }
});

// Ver.496: preserve all five Ver.299 tests and their 31 assertions unchanged.
test('Ver.300+ product keeps release and responsibility baseline aligned after 271', () => {
  assert.ok(release >= 271);
  assert.equal(String(responsibilities.baselineRelease), String(release));
});

test('Ver.300+ product observes only direct child-list changes under boardView', () => {
  assert.match(mobile, /const boardView = document\.getElementById\("boardView"\)/);
  assert.match(mobile, /new MutationObserver\(/);
  assert.match(mobile, /\.observe\(boardView, \{ childList: true \}\)/);
  assert.doesNotMatch(mobile, /observe\(boardView, \{ childList: true, subtree: true \}\)/);
  assert.match(mobile, /function patchMobileBoardTabs\(\)/);
  assert.match(mobile, /const signature = columns\.map\(column => `\$\{getBoardColumnLabel\(column\)\}:\$\{column\.querySelectorAll\("\.task-card"\)\.length\}`\)\.join\("\|"\)/);
});

test('Ver.300 keeps observer targeting anchored to canonical app renderBoard replacement', () => {
  assert.match(app, /function renderBoard\(tasks\)/);
  assert.match(app, /elements\.boardView\.innerHTML = columns \+ addColumn/);
  assert.match(app, /bindTaskCards\(elements\.boardView\)/);
  assert.match(app, /bindBoardTaskDrops\(elements\.boardView\)/);
});

test('Ver.300 preserves Ver.298 resize reconciliation contract', () => {
  assert.match(mobile, /window\.addEventListener\("resize", schedulePatch\)/);
  assert.match(mobile, /requestAnimationFrame\(\(\) => \{\s*scheduled = false;\s*patchMobileBoardTabs\(\);\s*syncMobileHeaderTitle\(\);\s*syncMobileMenuButton\(\);\s*\}\)/);
  assert.doesNotMatch(mobile, /addEventListener\(["']orientationchange["']/);
});

test('Ver.300 records the promoted Ver.299 evidence while later observer cleanup advances', () => {
  assert.match(audit, /unrelated descendant child-list mutation wakes the current subtree observer/);
  assert.match(audit, /direct-child candidate ignores that unrelated descendant mutation/);
  assert.match(audit, /real application board redraw still wakes the direct-child candidate/);

  const group = responsibilities.groups?.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.match(group?.reason || '', /Ver\.299監査/);
  assert.match(group?.reason || '', /Ver\.300製品/);
  assert.match(group?.reason || '', /release 271/);

  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.equal(next.order, 1);
  assert.ok(Array.isArray(next.scope) && next.scope.length >= 1);
  if (release === 271) {
    assert.deepEqual(next.scope, ['mobile-shell-v234.js']);
    assert.match(next.goal || '', /Ver\.301監査/);
    assert.match(next.precondition || '', /Ver\.300/);
  } else {
    assert.match(group?.reason || '', /Ver\.301監査/);
    assert.match(group?.reason || '', /Ver\.302製品/);
    assert.match(group?.reason || '', /release 272/);
    assert.ok(next.goal && next.precondition,
      'later releases may advance the active cleanup candidate while retaining Ver.299/300 evidence');
  }
});

test('Ver.496 retired Ver.299 observer Protocol stays absent', () => {
  assert.equal(existsSync(new URL('./mobile-shell-board-observer-v299.test.mjs', import.meta.url)), false);
});
