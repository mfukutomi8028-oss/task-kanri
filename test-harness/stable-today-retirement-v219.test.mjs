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

function extractArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]`));
  assert.ok(match, `${name} must exist`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.219 Today renderer permanently owns the three audited migration points', () => {
  const app = read('app.js');
  assert.equal(count(app, OPEN_TASKS_BEFORE), 0);
  assert.equal(count(app, SCHEDULE_BEFORE), 0);
  assert.equal(count(app, SPARE_BEFORE), 0);
  assert.equal(count(app, OPEN_TASKS_AFTER), 1);
  assert.equal(count(app, SCHEDULE_AFTER), 1);
  assert.equal(count(app, SPARE_AFTER), 1);
});

test('Ver.219 canonical assignee predicate stays room-name based', () => {
  const app = read('app.js');
  assert.match(app, /function getGroupAssignee\(\)\s*\{\s*return sanitizeUser\(state\.roomName \|\| ""\);\s*\}/);
  assert.match(app, /function isCurrentUserOrGroupAssignee\(value\)\s*\{[\s\S]*?getCurrentUser\(\)[\s\S]*?isGroupAssignee\(value\);\s*\}/);
});

test('Ver.219 stable is legacy-only and must not return to the current runtime inventory', () => {
  const manifest = read('release-manifest.js');
  const required = extractArray(manifest, 'requiredAssets');
  const scripts = extractArray(manifest, 'dynamicScripts');
  assert.ok(!required.includes('stable-fixes-v108.js'));
  assert.ok(!scripts.includes('stable-fixes-v108.js'));
  assert.ok(fs.existsSync(path.join(ROOT, 'stable-fixes-v108.js')));

  const stable = read('stable-fixes-v108.js');
  assert.match(stable, /function applyTodayFilters\(\)/,
    'legacy source remains intact for cached older manifests rather than being repurposed');
});

test('Ver.219 retains marker CSS only as backward compatibility, not current product semantics', () => {
  const style = read('ui-core-density-v188.css');
  assert.match(style, /#todayView\s*\[data-v108-hidden\]\s*\{\s*display\s*:\s*none\s*!important/);
});
