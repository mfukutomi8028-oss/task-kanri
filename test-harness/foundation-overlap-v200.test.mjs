import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const stable = fs.readFileSync(new URL('../stable-fixes-v108.js', import.meta.url), 'utf8');
const mobile = fs.readFileSync(new URL('../mobile-fixes.js', import.meta.url), 'utf8');
const dateKeyboard = fs.readFileSync(new URL('../date-keyboard-fix-v127.js', import.meta.url), 'utf8');

function functionBody(source, signature, nextSignature = '\n  function ') {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `missing function: ${signature}`);
  const next = source.indexOf(nextSignature, start + signature.length);
  return source.slice(start, next >= 0 ? next : source.length);
}

test('native date constraints are exclusively owned by date keyboard after stable retirement', () => {
  assert.doesNotMatch(stable, /const DATE_MIN\s*=/);
  assert.doesNotMatch(stable, /const DATE_MAX\s*=/);
  assert.doesNotMatch(stable, /function patchDateInputs\s*\(/);
  assert.doesNotMatch(stable, /__stableDateV108/);

  const mobilePatchAll = functionBody(mobile, '  function patchAll()');
  assert.doesNotMatch(mobile, /const DATE_MIN\s*=/);
  assert.doesNotMatch(mobile, /const DATE_MAX\s*=/);
  assert.doesNotMatch(mobile, /const DATETIME_MIN\s*=/);
  assert.doesNotMatch(mobile, /const DATETIME_MAX\s*=/);
  assert.doesNotMatch(mobile, /function clampDateValue\s*\(/);
  assert.doesNotMatch(mobile, /function patchDateInputs\s*\(/);
  assert.doesNotMatch(mobile, /__workBoardDateBoundV101/);
  assert.doesNotMatch(mobilePatchAll, /patchDateInputs/);

  assert.match(dateKeyboard, /const SELECTOR = 'input\[type="date"\], input\[type="datetime-local"\]';/);
  assert.match(dateKeyboard, /const DATE_MIN = "1900-01-01";/);
  assert.match(dateKeyboard, /const DATE_MAX = "9999-12-31";/);
  assert.match(dateKeyboard, /function buildControl\(source\)/);
  assert.match(dateKeyboard, /source\.dataset\.dateSegmentV127 = "true"/);
  assert.match(dateKeyboard, /source\.min = kind === "date" \? DATE_MIN : `\$\{DATE_MIN\}T00:00`/);
  assert.match(dateKeyboard, /source\.max = kind === "date" \? DATE_MAX : `\$\{DATE_MAX\}T23:59`/);
  assert.match(dateKeyboard, /function isValidDateParts\(year, month, day\)/);
  assert.match(dateKeyboard, /y < 1900 \|\| y > 9999/);
});

test('Today final visibility is owned by stable while mobile retires status filtering', () => {
  const stableToday = functionBody(stable, '  function applyTodayFilters()');
  assert.match(stable, /const GROUP_ASSIGNEES = \["システム課", "システム担当", "システム", "全員", "共通"\];/);
  assert.match(stableToday, /mineFilterIsActive\(\)/);
  assert.match(stableToday, /isAllowedAssignee\(task\.assignee, currentUser\)/);
  assert.match(stableToday, /data-v108-hidden/);
  assert.match(stableToday, /normalize\("保留"\)/);
  assert.match(stableToday, /normalize\("確認待ち"\)/);
  assert.match(stable, /#todayView \[data-v108-hidden\]\s*\{[\s\S]*?display: none !important;/);
  assert.doesNotMatch(stable, /#todayView \[data-v108-hidden="true"\]/);

  const mobilePatchAll = functionBody(mobile, '  function patchAll()');
  assert.doesNotMatch(mobile, /function patchTodayView\s*\(/);
  assert.doesNotMatch(mobile, /TODAY_EXCLUDED_STATUSES|SPARE_EXCLUDED_STATUSES|PROTECTED_DELETE_STATUSES/);
  assert.doesNotMatch(mobile, /data-workboard-auto-hidden/);
  assert.doesNotMatch(mobile, /getTaskStatus|readStatusFromTaskCard|loadTasksSnapshot|getRoomIdForStorage|normalizeText/);
  assert.doesNotMatch(mobilePatchAll, /patchTodayView/);
});

test('foundation observers stay feature-scoped while date keyboard patches dynamic fields only when a dialog opens', () => {
  assert.doesNotMatch(stable, /scheduleDateInputs/);
  assert.doesNotMatch(stable, /new MutationObserver\([^)]*\)\.observe\(taskForm/);
  assert.doesNotMatch(stable, /const taskForm = document\.getElementById\("taskForm"\)/);
  assert.match(stable, /new MutationObserver\(scheduleTodayFilters\)\.observe\(todayView,[\s\S]*childList: true,[\s\S]*subtree: true/);
  assert.doesNotMatch(stable, /new MutationObserver\(scheduleFixes\)\.observe\(document\.body/);
  assert.doesNotMatch(stable, /observe\(document\.body/);

  assert.match(mobile, /new MutationObserver\(scheduleBoardTabs\)\.observe\(boardView, \{ childList: true, subtree: true \}\)/);
  assert.doesNotMatch(mobile, /new MutationObserver\(schedulePatch\)\.observe\(document\.body/);

  assert.match(dateKeyboard, /function patchAll\(\)[\s\S]*document\.querySelectorAll\(SELECTOR\)\.forEach\(buildControl\)/);
  assert.match(dateKeyboard, /new MutationObserver\(\(\) => \{[\s\S]*if \(!dialog\.open\) return;[\s\S]*requestAnimationFrame\(\(\) => \{[\s\S]*patchAll\(\);[\s\S]*syncAll\(\);[\s\S]*\}\)/);
  assert.match(dateKeyboard, /attributeFilter: \["open"\]/);
  assert.doesNotMatch(dateKeyboard, /childList: true/);
  assert.doesNotMatch(dateKeyboard, /subtree: true/);
  assert.doesNotMatch(dateKeyboard, /observe\(document\.body/);
});

test('stable startup pass owns only style and Today while later stable updates are Today-only', () => {
  const stableApply = functionBody(stable, '  function applyFixes()');
  const stableTodaySchedule = functionBody(stable, '  function scheduleTodayFilters()', '\n\n  if (document.readyState');
  const mobilePatchAll = functionBody(mobile, '  function patchAll()');

  for (const responsibility of [
    'installStyle();',
    'applyTodayFilters();'
  ]) {
    assert.ok(stableApply.includes(responsibility), `stable startup responsibility missing: ${responsibility}`);
  }
  assert.ok(!stableApply.includes('patchDateInputs();'), 'stable startup pass must not retain retired date ownership');
  assert.ok(!stableApply.includes('setVersion();'), 'stable startup pass must not retain retired version ownership');
  assert.doesNotMatch(stable, /function setVersion\s*\(/);
  assert.doesNotMatch(stable, /WORK_BOARD_RELEASE\?\.version|WORK_BOARD_VERSION\s*=/);
  assert.doesNotMatch(stable, /function scheduleFixes\s*\(/);
  assert.doesNotMatch(stable, /let scheduled\s*=/);
  assert.match(stable, /document\.addEventListener\("DOMContentLoaded", applyFixes, \{ once: true \}\)/);
  assert.match(stable, /else \{\s*applyFixes\(\);\s*\}/);

  assert.doesNotMatch(stable, /function scheduleDateInputs\s*\(/);
  assert.match(stableTodaySchedule, /applyTodayFilters\(\);/);
  assert.doesNotMatch(stableTodaySchedule, /applyFixes\(\)|patchDateInputs\(\)|setVersion\(\)/);
  assert.doesNotMatch(stable, /new MutationObserver\(scheduleDateInputs\)/);
  assert.match(stable, /const todayView = document\.getElementById\("todayView"\);[\s\S]*new MutationObserver\(scheduleTodayFilters\)\.observe\(todayView/);
  assert.match(stable, /\.nav-filter\[data-filter="mine"\], \.nav-item\[data-layout\][\s\S]*setTimeout\(scheduleTodayFilters, 0\);[\s\S]*setTimeout\(scheduleTodayFilters, 120\);/);
  assert.match(stable, /#currentUserSelect, #startupUser[\s\S]*setTimeout\(scheduleTodayFilters, 0\)/);

  for (const responsibility of [
    'installStyle();',
    'ensureMobileHeader();',
    'patchMobileBoardTabs();',
    'syncMobileHeaderTitle();',
    'syncMobileMenuButton();',
    'patchVersion();',
    'bindGlobalClicks();'
  ]) {
    assert.ok(mobilePatchAll.includes(responsibility), `mobile startup/resize responsibility missing: ${responsibility}`);
  }
  assert.match(mobile, /const schedulePatch = \(\) => \{[\s\S]*requestAnimationFrame\(\(\) => \{[\s\S]*patchAll\(\);/);
  assert.match(mobile, /const scheduleBoardTabs = \(\) => \{[\s\S]*requestAnimationFrame\(\(\) => \{[\s\S]*patchMobileBoardTabs\(\);/);
  assert.doesNotMatch(mobile.match(/const scheduleBoardTabs = \(\) => \{[\s\S]*?\n  \};/)?.[0] || '', /patchAll\(\)/);
  assert.match(mobile, /const boardView = document\.getElementById\("boardView"\);[\s\S]*new MutationObserver\(scheduleBoardTabs\)\.observe\(boardView, \{ childList: true, subtree: true \}\)/);
});

test('boardView is the active mobile observer scope because app re-renders its contents in place', () => {
  assert.match(app, /boardView:\s*\$\("boardView"\)/);
  assert.match(app, /elements\.boardView\.innerHTML = columns \+ addColumn;/);
  assert.match(app, /elements\.boardView\.innerHTML = "";/);
  assert.doesNotMatch(app, /elements\.boardView\.replaceWith\s*\(/);
  assert.doesNotMatch(app, /elements\.boardView\.outerHTML\s*=/);
  assert.match(mobile, /document\.getElementById\("boardView"\)/);
});

test('mobile navigation explicitly synchronizes header and board tabs after nav activation', () => {
  const clicks = functionBody(mobile, '  function bindGlobalClicks()');
  assert.match(clicks, /event\.target\?\.closest\?\.\("\.nav-item"\)/);
  assert.match(clicks, /setTimeout\(\(\) => \{[\s\S]*closeMobileMenu\(\);[\s\S]*syncMobileHeaderTitle\(\);[\s\S]*patchMobileBoardTabs\(\);[\s\S]*\}, 0\)/);
});

test('mobile exclusively owns status-tab horizontal positioning after stable override retirement', () => {
  const stableApply = functionBody(stable, '  function applyFixes()');
  const mobileBoard = functionBody(mobile, '  function patchMobileBoardTabs()');
  const mobileActive = functionBody(mobile, '  function applyActiveColumn(activeIndex, scrollToTabs)');

  assert.doesNotMatch(stable, /function patchStatusTabAutoScroll\s*\(/);
  assert.doesNotMatch(stable, /__stableScrollIntoViewV108/);
  assert.doesNotMatch(stableApply, /patchStatusTabAutoScroll/);

  assert.match(mobileBoard, /applyActiveColumn\(selectedIndex, true\)/);
  assert.match(mobileActive, /const activeButton = tabs\.querySelector/);
  assert.match(mobileActive, /tabs\.scrollLeft = Math\.max\(0, left\)/);
  assert.doesNotMatch(mobileActive, /scrollIntoView\s*\(/);
});

test('status-tab presentation is mobile-owned while stable keeps only protective CSS', () => {
  const stableTabs = stable.match(/\.work-mobile-status-tabs\s*\{([\s\S]*?)\}/)?.[1] || '';
  const mobileTabs = mobile.match(/\.work-mobile-status-tabs\s*\{([\s\S]*?)\}/)?.[1] || '';
  const stableTab = stable.match(/\.work-mobile-status-tab\s*\{([\s\S]*?)\}/)?.[1] || '';
  const mobileTab = mobile.match(/\.work-mobile-status-tab\s*\{([\s\S]*?)\}/)?.[1] || '';

  assert.ok(stableTabs, 'stable status-tab protection rule is missing');
  assert.ok(mobileTabs, 'mobile status-tab row rule is missing');
  assert.ok(stableTab, 'stable status-tab protection rule is missing');
  assert.ok(mobileTab, 'mobile status-tab button rule is missing');

  for (const declaration of [
    'display: flex !important;',
    'gap: 8px !important;',
    'overflow-x: auto !important;',
    'scrollbar-width: none !important;'
  ]) {
    assert.ok(mobileTabs.includes(declaration), `mobile presentation declaration missing: ${declaration}`);
    assert.ok(!stableTabs.includes(declaration), `stable duplicate declaration still active: ${declaration}`);
  }

  assert.ok(mobileTab.includes('flex: 0 0 auto !important;'));
  assert.ok(!stableTab.includes('flex: 0 0 auto !important;'));
  assert.doesNotMatch(stable, /\.work-mobile-status-tabs::-webkit-scrollbar\s*\{\s*display: none !important;\s*\}/);
  assert.match(mobile, /\.work-mobile-status-tabs::-webkit-scrollbar\s*\{\s*display: none !important;\s*\}/);

  for (const declaration of [
    'flex-wrap: nowrap !important;',
    'width: 100% !important;',
    'max-width: 100% !important;',
    'overflow-y: hidden !important;',
    'touch-action: auto !important;',
    '-webkit-overflow-scrolling: touch !important;',
    'overscroll-behavior: auto !important;',
    'scroll-behavior: auto !important;',
    'scroll-snap-type: none !important;'
  ]) {
    assert.ok(stableTabs.includes(declaration), `stable protection missing: ${declaration}`);
  }

  for (const declaration of [
    'touch-action: auto !important;',
    'scroll-snap-align: none !important;',
    'user-select: none !important;',
    '-webkit-user-select: none !important;'
  ]) {
    assert.ok(stableTab.includes(declaration), `stable tab protection missing: ${declaration}`);
  }
});