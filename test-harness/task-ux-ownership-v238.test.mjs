import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.239 moves quick task status into app and retires the task-ux sidecar from active runtime', () => {
  const manifest = read('release-manifest.js');
  const app = read('app.js');
  const taskUx = read('task-ux-v146.js');
  const dialogLifecycle = read('dialog-lifecycle-v239.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');

  assert.equal(manifest.match(/version:\s*"(\d+)"/)?.[1], '239');
  assert.ok(!scripts.includes('task-ux-v146.js'));
  assert.ok(!required.includes('task-ux-v146.js'));
  assert.ok(fs.existsSync(path.join(ROOT, 'task-ux-v146.js')),
    'retired task UX sidecar must remain physically available for cached manifests/rollback');
  assert.equal(scripts.filter(name => name === 'dialog-lifecycle-v239.js').length, 1);
  assert.equal(required.filter(name => name === 'dialog-lifecycle-v239.js').length, 1);

  // app.js now renders and owns the quick-status control directly.
  assert.match(app, /function renderQuickTaskStatusControl\(task\)/);
  assert.match(app, /detail-status-control-v146/);
  assert.match(app, /data-quick-task-status/);
  assert.match(app, /operationKey\('task-status', task\.id\)/);
  assert.match(app, /async function handleQuickTaskStatusChange\(task, select\)/);
  assert.match(app, /await completeTaskWithMemo\(task\.id\)/);
  assert.match(app, /await changeStatus\(task\.id, targetStatus\)/);
  assert.match(app, /quickStatusSelect\?\.addEventListener\("change"/);
  assert.doesNotMatch(app, /submitStatusViaExistingEditor/);
  assert.doesNotMatch(app, /v146-quick-status-saving/);

  // Canonical state changes continue through the existing revision-checked task-status path.
  assert.match(app, /async function changeStatus\(id, status, memo = ""\)/);
  assert.match(app, /return transitionTaskStatus\(task, status, memo\)/);
  assert.match(app, /commitTaskDraft\('task-status', task, draft\)/);

  // The focused dialog module remains independent of task quick status.
  assert.match(dialogLifecycle, /const DISCARD_MESSAGE = '入力内容が変更されています。保存せずに閉じますか？'/);
  assert.match(dialogLifecycle, /event\.isTrusted/);
  assert.match(dialogLifecycle, /event\.target\?\.closest\?\.\('#closeTaskDialog'\)/);
  assert.match(dialogLifecycle, /document\.addEventListener\('cancel'/);
  assert.match(dialogLifecycle, /dialog\.id === 'userDialog'/);
  assert.match(dialogLifecycle, /preferred\.click\(\)/);
  assert.doesNotMatch(dialogLifecycle, /detail-status-control-v146/);

  // The old body remains available only as rollback evidence and is no longer executed.
  assert.match(taskUx, /className = 'detail-status-control-v146'/);
  assert.match(taskUx, /submitStatusViaExistingEditor/);
  assert.match(taskUx, /v146-quick-status-saving/);
});

test('Ver.239 keeps the clear-sort primary restore in the column-sort owner', () => {
  const taskUx = read('task-ux-v146.js');
  const columnSort = read('list-column-sort-v229.js');
  const app = read('app.js');

  assert.match(columnSort, /data-clear-list-column-sort/);
  assert.match(columnSort, /writeColumnSort\(null\)/);
  assert.match(columnSort, /function restorePrimarySortAfterClear\(\)/);
  assert.match(columnSort, /restorePrimarySortAfterClear\(\)/);
  assert.match(columnSort, /select\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/);
  assert.match(columnSort, /document\.addEventListener\('input', handleBaseSortChange, true\)/);

  assert.doesNotMatch(taskUx, /\[data-clear-list-column-sort\]/);
  assert.doesNotMatch(taskUx, /sortSelect/);

  assert.match(app, /elements\.sortSelect/);
  assert.match(app, /\.forEach\(el => el\?\.addEventListener\("input", render\)\)/);
});

test('Ver.239 product closes the audited task UX consolidation and advances the cleanup checkpoint', () => {
  const manifest = read('release-manifest.js');
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  const release = manifest.match(/version:\s*"(\d+)"/)?.[1];

  assert.equal(release, '239');
  assert.equal(inventory.baselineRelease, release);

  const taskUxGroup = inventory.groups.find(group => group.id === 'task-light-ux');
  assert.ok(taskUxGroup);
  assert.deepEqual(taskUxGroup.assets, ['ui-task-light-v189.css']);
  assert.match(taskUxGroup.reason, /app\.js/);
  assert.match(taskUxGroup.reason, /task-status/);
  assert.match(taskUxGroup.reason, /task-ux-v146\.jsはactive runtimeから退役/);

  const dialogGroup = inventory.groups.find(group => group.id === 'dialog-lifecycle');
  assert.ok(dialogGroup);
  assert.deepEqual(dialogGroup.assets, ['dialog-lifecycle-v239.js']);
  assert.match(dialogGroup.reason, /backdrop close/);
  assert.match(dialogGroup.reason, /未保存破棄guard/);
  assert.match(dialogGroup.reason, /userDialog/);

  const next = inventory.priorityCandidates?.[0];
  assert.ok(next);
  assert.deepEqual(next.scope, ['dialog-lifecycle-v239.js']);
  assert.match(next.goal, /backdrop close/);
  assert.match(next.goal, /未保存破棄guard/);
  assert.match(next.precondition, /Ver\.239/);
});
