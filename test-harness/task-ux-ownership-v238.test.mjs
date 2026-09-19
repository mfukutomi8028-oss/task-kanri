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

test('Ver.239 preparation splits dialog lifecycle from the remaining quick-status task UX', () => {
  const manifest = read('release-manifest.js');
  const app = read('app.js');
  const taskUx = read('task-ux-v146.js');
  const dialogLifecycle = read('dialog-lifecycle-v239.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');

  const release = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);
  assert.ok(release >= 237);
  assert.equal(scripts.filter(name => name === 'task-ux-v146.js').length, 1);
  assert.equal(required.filter(name => name === 'task-ux-v146.js').length, 1);
  assert.equal(scripts.filter(name => name === 'dialog-lifecycle-v239.js').length, 1);
  assert.equal(required.filter(name => name === 'dialog-lifecycle-v239.js').length, 1);
  assert.ok(scripts.indexOf('dialog-lifecycle-v239.js') < scripts.indexOf('task-ux-v146.js'));

  // app.js remains the canonical task editor open/save/actual close owner.
  assert.match(app, /function openTaskDialog\(task = null, options = \{\}\)/);
  assert.match(app, /elements\.taskDialog\.showModal\(\)/);
  assert.match(app, /async function saveTaskFromForm\(\)/);
  assert.match(app, /elements\.taskDialog\.close\(\)/);
  assert.match(app, /elements\.closeTaskDialog\.addEventListener\("click", \(\) => \{ clearTaskDialogContexts\(\); elements\.taskDialog\.close\(\); \}\)/);
  assert.doesNotMatch(app, /入力内容が変更されています。保存せずに閉じますか？/);
  assert.doesNotMatch(app, /detail-status-control-v146/);

  // The focused dialog module owns only common dialog UX and delegates actual closing.
  assert.match(dialogLifecycle, /const DISCARD_MESSAGE = '入力内容が変更されています。保存せずに閉じますか？'/);
  assert.match(dialogLifecycle, /event\.isTrusted/);
  assert.match(dialogLifecycle, /event\.target\?\.closest\?\.\('#closeTaskDialog'\)/);
  assert.match(dialogLifecycle, /document\.addEventListener\('cancel'/);
  assert.match(dialogLifecycle, /dialog\.id === 'userDialog'/);
  assert.match(dialogLifecycle, /preferred\.click\(\)/);
  assert.doesNotMatch(dialogLifecycle, /detail-status-control-v146/);
  assert.doesNotMatch(dialogLifecycle, /submitStatusViaExistingEditor/);

  // task-ux now owns only the remaining quick-status sidecar behavior.
  assert.match(taskUx, /className = 'detail-status-control-v146'/);
  assert.match(taskUx, /submitStatusViaExistingEditor/);
  assert.match(taskUx, /v146-quick-status-saving/);
  assert.doesNotMatch(taskUx, /DISCARD_MESSAGE/);
  assert.doesNotMatch(taskUx, /taskDialogDirty/);
  assert.doesNotMatch(taskUx, /dialog\.id === 'userDialog'/);
  assert.doesNotMatch(taskUx, /getBoundingClientRect/);
});

test('Ver.239 preparation keeps the clear-sort primary restore in the column-sort owner', () => {
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

test('dialog split remains an internal Ver.239 preparation step and leaves product release at Ver.237', () => {
  const manifest = read('release-manifest.js');
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  const release = manifest.match(/version:\s*"(\d+)"/)?.[1];

  assert.equal(release, '237', 'full Ver.239 task UX consolidation has not shipped yet');
  assert.equal(inventory.baselineRelease, release);

  const taskUxGroup = inventory.groups.find(group => group.id === 'task-light-ux');
  assert.ok(taskUxGroup);
  assert.deepEqual(taskUxGroup.assets, ['ui-task-light-v189.css', 'task-ux-v146.js']);
  assert.match(taskUxGroup.reason, /クイック状態変更/);
  assert.match(taskUxGroup.reason, /dialog-lifecycle-v239\.js/);
  assert.doesNotMatch(taskUxGroup.reason, /3責務|三つ/);

  const dialogGroup = inventory.groups.find(group => group.id === 'dialog-lifecycle');
  assert.ok(dialogGroup);
  assert.deepEqual(dialogGroup.assets, ['dialog-lifecycle-v239.js']);
  assert.match(dialogGroup.reason, /backdrop close/);
  assert.match(dialogGroup.reason, /未保存破棄guard/);
  assert.match(dialogGroup.reason, /userDialog/);

  const next = inventory.priorityCandidates?.[0];
  assert.ok(next);
  assert.deepEqual(next.scope, ['task-ux-v146.js']);
  assert.match(next.goal, /クイック状態変更/);
  assert.match(next.goal, /app\.js/);
  assert.match(next.goal, /task-status/);
  assert.doesNotMatch(next.goal, /backdrop close|未保存/);
  assert.match(next.precondition, /dialog-lifecycle-v239\.js/);
});
