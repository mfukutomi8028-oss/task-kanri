import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const app = readFileSync('app.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_BOARD_OBSERVER_SEMANTIC_AUDIT_V301.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.301 audit remains on the Ver.300 release baseline', () => {
  assert.equal(release, 271);
  assert.equal(String(responsibilities.baselineRelease), '271');
});

test('Ver.301 audit measures the current direct-child observer without product changes', () => {
  assert.match(mobile, /const boardView = document\.getElementById\("boardView"\)/);
  assert.match(mobile, /new MutationObserver\(scheduleBoardTabs\)\.observe\(boardView, \{ childList: true \}\)/);
  assert.doesNotMatch(mobile, /hasBoardColumnChange/);
  assert.doesNotMatch(mobile, /addedNodes.*board-column/s);
});

test('Ver.301 semantic target is anchored to the canonical board-column redraw boundary', () => {
  assert.match(app, /function renderBoard\(tasks\)/);
  assert.match(app, /elements\.boardView\.innerHTML = columns \+ addColumn/);
  assert.match(app, /bindTaskCards\(elements\.boardView\)/);
  assert.match(app, /bindBoardTaskDrops\(elements\.boardView\)/);
  assert.match(mobile, /const columns = \[\.\.\.board\.querySelectorAll\("\.board-column"\)\]/);
});

test('Ver.301 preserves reconciliation owners outside the observer predicate', () => {
  assert.match(mobile, /function scheduleBoardTabs\(\)/);
  assert.match(mobile, /requestAnimationFrame\(\(\) => \{\s*boardTabsScheduled = false;\s*patchMobileBoardTabs\(\);\s*\}\)/);
  assert.match(mobile, /window\.addEventListener\("resize", schedulePatch\)/);
  assert.match(mobile, /setTimeout\(tryOpen, 80\)/);
  assert.match(mobile, /setTimeout\(tryOpen, 220\)/);
  assert.match(mobile, /setTimeout\(tryOpen, 500\)/);
});

test('Ver.301 records a semantic-only Ver.302 product decision gate', () => {
  assert.match(audit, /unrelated direct child appended to `#boardView`/);
  assert.match(audit, /adds or removes at least one `\.board-column` direct child/);
  assert.match(audit, /Only promote a Ver\.302 product change/);

  const next = responsibilities.priorityCandidates?.[0];
  assert.deepEqual(next?.scope, ['mobile-shell-v234.js']);
  assert.match(next?.goal || '', /Ver\.301監査/);
  assert.match(next?.goal || '', /semantic target/);
  assert.match(next?.precondition || '', /Ver\.300/);
});
