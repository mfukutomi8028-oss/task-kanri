import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
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
