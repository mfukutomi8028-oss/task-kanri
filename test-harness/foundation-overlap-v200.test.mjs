import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const stable = fs.readFileSync(new URL('../stable-fixes-v108.js', import.meta.url), 'utf8');
const mobile = fs.readFileSync(new URL('../mobile-fixes.js', import.meta.url), 'utf8');
const dateKeyboard = fs.readFileSync(new URL('../date-keyboard-fix-v127.js', import.meta.url), 'utf8');
const scheduleLock = fs.readFileSync(new URL('../schedule-today-lock-v129.js', import.meta.url), 'utf8');

function functionBody(source, signature, nextSignature = '\n  function ') {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `missing function: ${signature}`);
  const next = source.indexOf(nextSignature, start + signature.length);
  return source.slice(start, next >= 0 ? next : source.length);
}

test('native date constraints are owned by stable while segmented keyboard keeps its own source validation', () => {
  const stableDate = functionBody(stable, '  function patchDateInputs()');
  assert.match(stable, /const DATE_MIN = "1900-01-01";/);
  assert.match(stable, /const DATE_MAX = "9999-12-31";/);
  assert.match(stableDate, /input\.min = DATE_MIN/);
  assert.match(stableDate, /input\.max = DATE_MAX/);
  assert.match(stableDate, /input\.__stableDateV108/);

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
  assert.match(dateKeyboard, /function buildControl\(source\)/);
  assert.match(dateKeyboard, /source\.dataset\.dateSegmentV127 = "true"/);
  assert.match(dateKeyboard, /source\.min = kind === "date" \? DATE_MIN : `\$\{DATE_MIN\}T00:00`/);
  assert.match(dateKeyboard, /source\.max = kind === "date" \? DATE_MAX : `\$\{DATE_MAX\}T23:59`/);
  assert.match(dateKeyboard, /function isValidDateParts\(year, month, day\)/);
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

test('schedule range label is duplicated in mobile while schedule lock owns the scoped normalization path', () => {
  const scheduleNormalize = functionBody(scheduleLock, '  function normalizeWeekRangeLabel(view = getScheduleView())');
  assert.match(scheduleNormalize, /\[data-schedule-range="week"\]/);
  assert.match(scheduleNormalize, /button\.textContent = "7日間"/);
  assert.match(scheduleNormalize, /button\.title = "今日から7日間を表示します"/);
  assert.match(scheduleLock, /const observer = new MutationObserver\(scheduleEnforcement\);/);
  assert.match(scheduleLock, /observer\.observe\(view, \{ childList: true, subtree: true \}\)/);

  const mobileRange = functionBody(mobile, '  function patchScheduleRangeButtons()');
  const mobilePatchAll = functionBody(mobile, '  function patchAll()');
  const mobileClicks = functionBody(mobile, '  function bindGlobalClicks()');
  assert.match(mobileRange, /\[data-schedule-range="week"\]/);
  assert.match(mobileRange, /button\.textContent = "7日間"/);
  assert.match(mobileRange, /button\.title = "今日から7日間を表示します"/);
  assert.match(mobilePatchAll, /patchScheduleRangeButtons\(\)/);

  // These two helpers are legacy definitions only: current runtime does not call them.
  assert.match(mobile, /function installRollingWeekRangePatch\(\)/);
  assert.match(mobile, /function resetScheduleAnchorBeforeRollingWeek\(event\)/);
  assert.equal((mobile.match(/installRollingWeekRangePatch/g) || []).length, 1);
  assert.equal((mobile.match(/resetScheduleAnchorBeforeRollingWeek/g) || []).length, 1);
  assert.doesNotMatch(mobileClicks, /installRollingWeekRangePatch|resetScheduleAnchorBeforeRollingWeek/);
  assert.match(mobilePatchAll, /Date\.prototypeは変更しない/);
});

test('observer scopes stay distinct after mobile date retirement', () => {
  assert.match(stable, /new MutationObserver\(scheduleFixes\)\.observe\(document\.body,[\s\S]*childList: true,[\s\S]*subtree: true/);
  assert.match(mobile, /new MutationObserver\(schedulePatch\)\.observe\(document\.body, \{ childList: true, subtree: true \}\)/);

  assert.match(dateKeyboard, /function patchAll\(\)[\s\S]*document\.querySelectorAll\(SELECTOR\)\.forEach\(buildControl\)/);
  assert.match(dateKeyboard, /new MutationObserver\(\(\) => \{[\s\S]*if \(dialog\.open\) requestAnimationFrame\(syncAll\)[\s\S]*attributeFilter: \["open"\]/);
  assert.doesNotMatch(dateKeyboard, /observe\(document\.body/);
});
