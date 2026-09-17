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

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.220 Today renderer canonically owns the three audited visibility predicates', () => {
  const app = read('app.js');
  assert.equal(count(app, OPEN_TASKS_BEFORE), 0);
  assert.equal(count(app, SCHEDULE_BEFORE), 0);
  assert.equal(count(app, SPARE_BEFORE), 0);
  assert.equal(count(app, OPEN_TASKS_AFTER), 1, 'Today openTasks semantics must have one canonical owner');
  assert.equal(count(app, SCHEDULE_AFTER), 1, 'Today schedule mine semantics must have one canonical owner');
  assert.equal(count(app, SPARE_AFTER), 1, 'Today spare semantics must have one canonical owner');
});

test('Ver.220 keeps current user plus current room-name group semantics in app.js', () => {
  const app = read('app.js');
  assert.match(app, /function getGroupAssignee\(\)\s*\{\s*return sanitizeUser\(state\.roomName \|\| ""\);\s*\}/);
  assert.match(app, /function isCurrentUserOrGroupAssignee\(value\)\s*\{[\s\S]*?getCurrentUser\(\)[\s\S]*?isGroupAssignee\(value\);\s*\}/);
});

test('Ver.220 retires stable Today post-filter from the active manifest while retaining the legacy file for cached releases', () => {
  const manifest = read('release-manifest.js');
  const required = extractStringArray(manifest, 'requiredAssets');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  assert.ok(!required.includes('stable-fixes-v108.js'), 'stable must not be a current required asset');
  assert.ok(!scripts.includes('stable-fixes-v108.js'), 'stable must not execute in the current runtime');
  assert.ok(fs.existsSync(path.join(ROOT, 'stable-fixes-v108.js')), 'legacy stable file must remain for cached manifests and rollback');
});
