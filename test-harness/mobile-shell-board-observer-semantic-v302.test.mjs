import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.302 promotes release and baseline together', () => {
  assert.equal(release, 272);
  assert.equal(String(responsibilities.baselineRelease), '272');
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

test('Ver.302 preserves existing reconciliation owners outside the observer predicate', () => {
  assert.match(mobile, /window\.addEventListener\("resize", schedulePatch\)/);
  assert.match(mobile, /patchMobileBoardTabs\(\);\s*syncMobileHeaderTitle\(\);\s*syncMobileMenuButton\(\);/s);
  assert.match(mobile, /setTimeout\(tryOpen, 80\)/);
  assert.match(mobile, /setTimeout\(tryOpen, 220\)/);
  assert.match(mobile, /setTimeout\(tryOpen, 500\)/);
});
