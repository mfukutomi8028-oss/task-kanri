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

test('Ver.238 boundary keeps task-ux active because dialog and quick-status behavior still depend on it', () => {
  const manifest = read('release-manifest.js');
  const app = read('app.js');
  const taskUx = read('task-ux-v146.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');

  const release = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);
  assert.ok(release >= 237);
  assert.equal(scripts.filter(name => name === 'task-ux-v146.js').length, 1);
  assert.equal(required.filter(name => name === 'task-ux-v146.js').length, 1);

  // app.js is still the canonical task editor lifecycle and persistence owner.
  assert.match(app, /function openTaskDialog\(task = null, options = \{\}\)/);
  assert.match(app, /elements\.taskDialog\.showModal\(\)/);
  assert.match(app, /async function saveTaskFromForm\(\)/);
  assert.match(app, /elements\.taskDialog\.close\(\)/);
  assert.match(app, /elements\.closeTaskDialog\.addEventListener\("click", \(\) => \{ clearTaskDialogContexts\(\); elements\.taskDialog\.close\(\); \}\)/);
  assert.doesNotMatch(app, /入力内容が変更されています。保存せずに閉じますか？/);
  assert.doesNotMatch(app, /detail-status-control-v146/);

  // task-ux still supplies the three behaviors that app.js does not currently provide.
  assert.match(taskUx, /const DISCARD_MESSAGE = '入力内容が変更されています。保存せずに閉じますか？'/);
  assert.match(taskUx, /event\.isTrusted/);
  assert.match(taskUx, /document\.addEventListener\('cancel'/);
  assert.match(taskUx, /event\.target\?\.closest\?\.\('#closeTaskDialog'\)/);
  assert.match(taskUx, /className = 'detail-status-control-v146'/);
  assert.match(taskUx, /submitStatusViaExistingEditor/);
  assert.match(taskUx, /dialog\.id === 'userDialog'/);
  assert.match(taskUx, /preferred\.click\(\)/);
});

test('Ver.239 preparation moves clear-sort primary restore into the column-sort owner', () => {
  const taskUx = read('task-ux-v146.js');
  const columnSort = read('list-column-sort-v229.js');
  const app = read('app.js');

  // list-column-sort owns secondary sort state, the clear control, and its immediate return to canonical primary order.
  assert.match(columnSort, /data-clear-list-column-sort/);
  assert.match(columnSort, /writeColumnSort\(null\)/);
  assert.match(columnSort, /function restorePrimarySortAfterClear\(\)/);
  assert.match(columnSort, /restorePrimarySortAfterClear\(\)/);
  assert.match(columnSort, /select\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/);
  assert.match(columnSort, /document\.addEventListener\('input', handleBaseSortChange, true\)/);

  // The generic task UX sidecar no longer knows about list-column sorting.
  assert.doesNotMatch(taskUx, /\[data-clear-list-column-sort\]/);
  assert.doesNotMatch(taskUx, /sortSelect/);

  // The synthetic input works because app.js owns primary sorting/rendering on sortSelect input.
  assert.match(app, /elements\.sortSelect/);
  assert.match(app, /\.forEach\(el => el\?\.addEventListener\("input", render\)\)/);
});

test('bridge migration is an internal Ver.239 preparation step and leaves the product release at Ver.237', () => {
  const manifest = read('release-manifest.js');
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  const release = manifest.match(/version:\s*"(\d+)"/)?.[1];

  assert.equal(release, '237', 'full Ver.239 task UX consolidation has not shipped yet');
  assert.equal(inventory.baselineRelease, release);

  const foundation = inventory.groups.find(group => group.id === 'foundation-presentation');
  assert.ok(foundation);
  assert.match(foundation.reason, /primary sort|primary-sort|一次|正本/i);

  const taskUxGroup = inventory.groups.find(group => group.id === 'task-light-ux');
  assert.ok(taskUxGroup);
  assert.ok(taskUxGroup.assets.includes('task-ux-v146.js'));
  assert.match(taskUxGroup.reason, /3|三つ|3責務/);
  assert.doesNotMatch(taskUxGroup.reason, /列見出し並び順解除後.*bridge/);

  const next = inventory.priorityCandidates?.[0];
  assert.ok(next);
  assert.deepEqual(next.scope, ['task-ux-v146.js']);
  assert.match(next.goal, /app\.js/);
  assert.match(next.goal, /未保存/);
  assert.match(next.goal, /backdrop/);
  assert.match(next.goal, /クイック状態/);
  assert.match(next.precondition, /bridge/);
});
