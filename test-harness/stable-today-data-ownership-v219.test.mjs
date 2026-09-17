import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function extractArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]`));
  assert.ok(match, `${name} must exist`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.219 app.js remains the canonical owner of room-scoped task/schedule data', () => {
  const app = read('app.js');
  assert.match(app, /const ROOM_ID = getRoomId\(\);/);
  assert.match(app, /function tasksKey\(\)\s*\{\s*return `system-task-tasks:\$\{ROOM_ID\}`;\s*\}/);
  assert.match(app, /function schedulesKey\(\)\s*\{\s*return `system-task-schedules:\$\{ROOM_ID\}`;\s*\}/);
});

test('Ver.219 app.js owns current-user and current-room shared-assignee semantics', () => {
  const app = read('app.js');
  assert.match(app, /function getCurrentUser\(\)\s*\{\s*return normalizeUser\(state\.currentUser \|\| localStorage\.getItem\("systemTaskUser"\) \|\| state\.users\[0\]\);\s*\}/);
  assert.match(app, /function getGroupAssignee\(\)\s*\{\s*return sanitizeUser\(state\.roomName \|\| ""\);\s*\}/);
  assert.match(app, /function isCurrentUserOrGroupAssignee\(value\)/);
});

test('Ver.219 Today rendering uses canonical assignee semantics and owns its former stable exclusions', () => {
  const app = read('app.js');
  assert.match(app, /const openTasks = state\.tasks\.filter\(t => !isCompletedStatus\(t\.status\) && normalizeText\(t\.status\) !== normalizeText\("保留"\) && \(!scopeHasMine\(\) \|\| isCurrentUserOrGroupAssignee\(t\.assignee\)\)\);/);
  assert.match(app, /\.filter\(s => !scopeHasMine\(\) \|\| isCurrentUserOrGroupAssignee\(s\.assignee\)\)/);
  assert.match(app, /const spare = openTasks\.filter\(t => !t\.dueDate && !isUnsortedTask\(t\) && normalizeText\(t\.status\) !== normalizeText\("確認待ち"\)\)/);
  assert.doesNotMatch(app, /\.filter\(s => !scopeHasMine\(\) \|\| s\.assignee === getCurrentUser\(\)\)/);
});

test('Ver.219 manifest retires stable from active runtime while preserving the legacy file', () => {
  const manifest = read('release-manifest.js');
  const required = extractArray(manifest, 'requiredAssets');
  const scripts = extractArray(manifest, 'dynamicScripts');
  assert.ok(!required.includes('stable-fixes-v108.js'));
  assert.ok(!scripts.includes('stable-fixes-v108.js'));
  assert.equal(scripts.length, 33);
  assert.ok(fs.existsSync(path.join(ROOT, 'stable-fixes-v108.js')),
    'legacy stable file remains for clients holding older cached manifests');
});
