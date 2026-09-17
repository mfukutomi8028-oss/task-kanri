import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const OPEN_TASKS_BEFORE = 'const openTasks = state.tasks.filter(t => !isCompletedStatus(t.status));';
const OPEN_TASKS_AFTER = 'const openTasks = state.tasks.filter(t => !isCompletedStatus(t.status) && normalizeText(t.status) !== normalizeText("保留") && (!scopeHasMine() || isCurrentUserOrGroupAssignee(t.assignee)));';
const SCHEDULE_BEFORE = '.filter(s => !scopeHasMine() || s.assignee === getCurrentUser())';
const SCHEDULE_AFTER = '.filter(s => !scopeHasMine() || isCurrentUserOrGroupAssignee(s.assignee))';
const SPARE_BEFORE = 'const spare = openTasks.filter(t => !t.dueDate && !isUnsortedTask(t)).sort(compareSmartTasks).slice(0, 10);';
const SPARE_AFTER = 'const spare = openTasks.filter(t => !t.dueDate && !isUnsortedTask(t) && normalizeText(t.status) !== normalizeText("確認待ち")).sort(compareSmartTasks).slice(0, 10);';

function count(source, token) {
  return source.split(token).length - 1;
}

test('audit: Today renderer has three exact migration targets for canonical ownership', () => {
  const app = read('app.js');
  assert.equal(count(app, OPEN_TASKS_BEFORE), 1, 'openTasks Today source must have one exact migration target');
  assert.equal(count(app, SCHEDULE_BEFORE), 1, 'Today schedule mine predicate must have one exact migration target');
  assert.equal(count(app, SPARE_BEFORE), 1, 'Today spare source must have one exact migration target');
  assert.doesNotMatch(app, new RegExp(OPEN_TASKS_AFTER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(app, new RegExp(SCHEDULE_AFTER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(app, new RegExp(SPARE_AFTER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('audit: app canonical assignee predicate already owns current user plus room-name group semantics', () => {
  const app = read('app.js');
  assert.match(app, /function getGroupAssignee\(\)\s*\{\s*return sanitizeUser\(state\.roomName \|\| ""\);\s*\}/);
  assert.match(app, /function isCurrentUserOrGroupAssignee\(value\)\s*\{[\s\S]*?getCurrentUser\(\)[\s\S]*?isGroupAssignee\(value\);\s*\}/);
});

test('audit: stable is now exclusively Today post-filtering and can be tested as a retirement candidate', () => {
  const stable = read('stable-fixes-v108.js');
  assert.match(stable, /function applyTodayFilters\(\)/);
  assert.match(stable, /data-v108-hidden/);
  assert.match(stable, /new MutationObserver\(scheduleTodayFilters\)/);
  assert.match(stable, /GROUP_ASSIGNEES/);
  assert.match(stable, /readStoredArray/);
  assert.doesNotMatch(stable, /runTransaction|firebase|fetch\(/i,
    'stable must not own persistence before attempting full Today retirement');
});
