import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const OPEN_TASKS = 'const openTasks = state.tasks.filter(t => !isCompletedStatus(t.status) && normalizeText(t.status) !== normalizeText("保留") && (!scopeHasMine() || isCurrentUserOrGroupAssignee(t.assignee)));';
const SCHEDULE_MINE = '.filter(s => !scopeHasMine() || isCurrentUserOrGroupAssignee(s.assignee))';
const SPARE = 'const spare = openTasks.filter(t => !t.dueDate && !isUnsortedTask(t) && normalizeText(t.status) !== normalizeText("確認待ち")).sort(compareSmartTasks).slice(0, 10);';

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.219 app.js canonically owns Today task and schedule semantics', () => {
  const app = read('app.js');
  assert.equal(app.split(OPEN_TASKS).length - 1, 1);
  assert.equal(app.split(SCHEDULE_MINE).length - 1, 1);
  assert.equal(app.split(SPARE).length - 1, 1);
  assert.doesNotMatch(app, /const openTasks = state\.tasks\.filter\(t => !isCompletedStatus\(t\.status\)\);/);
  assert.doesNotMatch(app, /\.filter\(s => !scopeHasMine\(\) \|\| s\.assignee === getCurrentUser\(\)\)/);
});

test('Ver.219 shared assignee semantics have one canonical owner in app.js', () => {
  const app = read('app.js');
  assert.match(app, /function getGroupAssignee\(\)\s*\{\s*return sanitizeUser\(state\.roomName \|\| ""\);\s*\}/);
  assert.match(app, /function isCurrentUserOrGroupAssignee\(value\)\s*\{[\s\S]*?getCurrentUser\(\)[\s\S]*?isGroupAssignee\(value\);\s*\}/);
});

test('Ver.219 retires stable-fixes-v108.js from the active release inventory but keeps the file for cached releases', () => {
  const manifest = read('release-manifest.js');
  const required = extractStringArray(manifest, 'requiredAssets');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  assert.equal(required.includes('stable-fixes-v108.js'), false);
  assert.equal(scripts.includes('stable-fixes-v108.js'), false);
  assert.ok(fs.existsSync(path.join(ROOT, 'stable-fixes-v108.js')),
    'legacy stable file must remain physically available for cached Ver.218 manifests');
});

test('Ver.219 no longer needs the durable stable visibility marker', () => {
  const app = read('app.js');
  const core = read('ui-core-density-v188.css');
  assert.doesNotMatch(app, /data-v108-hidden/);
  assert.doesNotMatch(core, /data-v108-hidden/);
});
