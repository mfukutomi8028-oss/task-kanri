import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shell = readFileSync('mobile-shell-v234.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const product = readFileSync('MOBILE_SHELL_RESIZE_RECONCILER_V298.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.298+ product keeps release and responsibility baseline aligned after 270', () => {
  assert.ok(release >= 270);
  assert.equal(String(responsibilities.baselineRelease), String(release));
});

test('Ver.298 product keeps startup patchAll at five responsibilities', () => {
  assert.match(shell, /function patchAll\(\) \{\s*ensureMobileHeader\(\);\s*patchMobileBoardTabs\(\);\s*syncMobileHeaderTitle\(\);\s*syncMobileMenuButton\(\);\s*bindGlobalClicks\(\);\s*\}/);
  assert.match(shell, /document\.addEventListener\("DOMContentLoaded", patchAll, \{ once: true \}\)/);
  assert.match(shell, /if \(window\.__workBoardMobileFixClicksV101\) return;/);
});

test('Ver.298 product narrows only scheduled resize recovery to board title and menu', () => {
  assert.match(shell, /const schedulePatch = \(\) => \{[\s\S]*requestAnimationFrame\(\(\) => \{\s*scheduled = false;\s*patchMobileBoardTabs\(\);\s*syncMobileHeaderTitle\(\);\s*syncMobileMenuButton\(\);\s*\}\);[\s\S]*\};/);
  const scheduleBlock = shell.match(/const schedulePatch = \(\) => \{[\s\S]*?\n  \};/)?.[0] || '';
  assert.doesNotMatch(scheduleBlock, /ensureMobileHeader\(\)/);
  assert.doesNotMatch(scheduleBlock, /bindGlobalClicks\(\)/);
  assert.doesNotMatch(scheduleBlock, /patchAll\(\)/);
  assert.match(shell, /window\.addEventListener\("resize", schedulePatch\)/);
});

test('Ver.298+ product preserves observer loader navigation and the current schedule-create boundary', () => {
  assert.match(shell, /const boardView = document\.getElementById\("boardView"\)/);
  assert.match(shell, /new MutationObserver\(/);
  assert.match(shell, /\.observe\(boardView, \{ childList: true \}\)/);
  assert.doesNotMatch(shell, /observe\(boardView, \{ childList: true, subtree: true \}\)/);
  assert.match(shell, /event\.target\?\.closest\?\.\("\.nav-item"\)/);
  if (release < 273) {
    assert.match(shell, /setTimeout\(tryOpen, 80\)/);
    assert.match(shell, /setTimeout\(tryOpen, 220\)/);
    assert.match(shell, /setTimeout\(tryOpen, 500\)/);
  } else {
    assert.doesNotMatch(shell, /setTimeout\(tryOpen, (?:80|220|500)\)/);
    assert.match(shell, /data-layout='schedule'[\s\S]*?\.click\(\);\s*tryOpen\(\);/);
  }
  assert.match(product, /no Firebase, task persistence, workflow, notification, or other business-data write path is changed/i);
});

test('Ver.298 history remains durable while later mobile-shell cleanup advances', () => {
  const group = responsibilities.groups?.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.ok(group);
  assert.match(group.reason, /Ver\.297監査/);
  assert.match(group.reason, /Ver\.298製品/);
  assert.match(group.reason, /release 270/);
  if (release >= 271) {
    assert.match(group.reason, /Ver\.299監査/);
    assert.match(group.reason, /Ver\.300製品/);
    assert.match(group.reason, /release 271/);
  }
  if (release >= 272) {
    assert.match(group.reason, /Ver\.301監査/);
    assert.match(group.reason, /Ver\.302製品/);
    assert.match(group.reason, /release 272/);
  }
  if (release >= 273) {
    assert.match(group.reason, /Ver\.303監査/);
    assert.match(group.reason, /Ver\.304製品/);
    assert.match(group.reason, /release 273/);
  }
  if (release >= 274) {
    assert.match(group.reason, /Ver\.305監査/);
    assert.match(group.reason, /Ver\.306製品/);
    assert.match(group.reason, /release 274/);
  }
  if (release >= 275) {
    assert.match(group.reason, /Ver\.307監査/);
    assert.match(group.reason, /Ver\.308製品/);
    assert.match(group.reason, /release 275/);
  }
});
