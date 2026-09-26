import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const app = readFileSync('app.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_BOARD_OBSERVER_AUDIT_V299.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.299 audit remains on the Ver.298 release baseline', () => {
  assert.equal(release, 270);
  assert.equal(String(responsibilities.baselineRelease), '270');
});

test('Ver.299 audit measures the existing boardView-scoped subtree observer without product changes', () => {
  assert.match(mobile, /const boardView = document\.getElementById\("boardView"\)/);
  assert.match(mobile, /new MutationObserver\(scheduleBoardTabs\)\.observe\(boardView, \{ childList: true, subtree: true \}\)/);
  assert.match(mobile, /function patchMobileBoardTabs\(\)/);
  assert.match(mobile, /const signature = columns\.map\(column => `\$\{getBoardColumnLabel\(column\)\}:\$\{column\.querySelectorAll\("\.task-card"\)\.length\}`\)\.join\("\|"\)/);
});

test('Ver.299 audit anchors narrowing to the canonical app render boundary', () => {
  assert.match(app, /function renderBoard\(tasks\)/);
  assert.match(app, /elements\.boardView\.innerHTML = columns \+ addColumn/);
  assert.match(app, /bindTaskCards\(elements\.boardView\)/);
  assert.match(app, /bindBoardTaskDrops\(elements\.boardView\)/);
});

test('Ver.299 audit preserves the Ver.298 resize reconciliation contract', () => {
  assert.match(mobile, /window\.addEventListener\("resize", schedulePatch\)/);
  assert.match(mobile, /requestAnimationFrame\(\(\) => \{\s*scheduled = false;\s*patchMobileBoardTabs\(\);\s*syncMobileHeaderTitle\(\);\s*syncMobileMenuButton\(\);\s*\}\)/);
  assert.doesNotMatch(mobile, /orientationchange/);
});

test('Ver.299 audit records the direct-child product decision gate', () => {
  assert.match(audit, /unrelated descendant child-list mutation wakes the current subtree observer/);
  assert.match(audit, /direct-child candidate ignores that unrelated descendant mutation/);
  assert.match(audit, /real application board redraw still wakes the direct-child candidate/);
  assert.match(audit, /Only promote Ver\.300 if the audit proves the direct-child observer preserves canonical application redraw\/count behavior/);
});
