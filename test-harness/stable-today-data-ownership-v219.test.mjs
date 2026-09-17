import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('audit: app.js is the canonical owner of room-scoped task/schedule keys', () => {
  const app = read('app.js');
  assert.match(app, /const ROOM_ID = getRoomId\(\);/);
  assert.match(app, /function tasksKey\(\)\s*\{\s*return `system-task-tasks:\$\{ROOM_ID\}`;\s*\}/);
  assert.match(app, /function schedulesKey\(\)\s*\{\s*return `system-task-schedules:\$\{ROOM_ID\}`;\s*\}/);
});

test('audit: app.js owns current-user and shared-room assignee semantics', () => {
  const app = read('app.js');
  assert.match(app, /function getCurrentUser\(\)\s*\{\s*return normalizeUser\(state\.currentUser \|\| localStorage\.getItem\("systemTaskUser"\) \|\| state\.users\[0\]\);\s*\}/);
  assert.match(app, /function getGroupAssignee\(\)\s*\{\s*return sanitizeUser\(state\.roomName \|\| ""\);\s*\}/);
  assert.match(app, /function isCurrentUserOrGroupAssignee\(value\)/);
});

test('audit: stable currently duplicates room, storage, user and group-assignee resolution', () => {
  const stable = read('stable-fixes-v108.js');
  assert.match(stable, /const GROUP_ASSIGNEES = \["システム課", "システム担当", "システム", "全員", "共通"\]/);
  assert.match(stable, /function getRoomId\(\)/);
  assert.match(stable, /function readStoredArray\(prefix\)/);
  assert.match(stable, /for \(let index = 0; index < localStorage\.length; index \+= 1\)/,
    'audit must keep evidence that stable scans storage beyond the active room');
  assert.match(stable, /function getCurrentUser\(\)/);
  assert.match(stable, /currentUserLabel/,
    'audit must keep evidence that stable has an independent current-user fallback');
  assert.match(stable, /function isAllowedAssignee\(assignee, currentUser\)/);
});

test('audit: Today product rendering already uses canonical state collections, but mine filtering is split', () => {
  const app = read('app.js');
  assert.match(app, /const openTasks = state\.tasks\.filter/);
  assert.match(app, /const schedules = state\.schedules/);
  assert.match(app, /\.filter\(s => !scopeHasMine\(\) \|\| s\.assignee === getCurrentUser\(\)\)/,
    'audit records that Today schedule mine filtering does not yet use the shared-room canonical predicate');
  assert.match(app, /dueToday\.map\(taskCard\)/);
  assert.match(app, /spare\.map\(taskCard\)/);
});
