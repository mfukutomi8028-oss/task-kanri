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

test('Ver.238 audit evidence remains physically available while app keeps canonical task editor ownership', () => {
  const app = read('app.js');
  const auditedTaskUx = read('task-ux-v146.js');
  const auditedColumnSort = read('list-column-sort-v229.js');

  // app.js remains the canonical task editor lifecycle and persistence owner.
  assert.match(app, /function openTaskDialog\(task = null, options = \{\}\)/);
  assert.match(app, /elements\.taskDialog\.showModal\(\)/);
  assert.match(app, /async function saveTaskFromForm\(\)/);
  assert.match(app, /elements\.taskDialog\.close\(\)/);
  assert.match(app, /elements\.closeTaskDialog\.addEventListener\("click", \(\) => \{ clearTaskDialogContexts\(\); elements\.taskDialog\.close\(\); \}\)/);
  assert.doesNotMatch(app, /入力内容が変更されています。保存せずに閉じますか？/);
  assert.doesNotMatch(app, /detail-status-control-v146/);

  // The Ver.238 audited sources remain untouched as rollback/cache evidence.
  assert.match(auditedTaskUx, /const DISCARD_MESSAGE = '入力内容が変更されています。保存せずに閉じますか？'/);
  assert.match(auditedTaskUx, /className = 'detail-status-control-v146'/);
  assert.match(auditedTaskUx, /\[data-clear-list-column-sort\]/);
  assert.match(auditedTaskUx, /select\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/);
  assert.match(auditedColumnSort, /data-clear-list-column-sort/);
  assert.doesNotMatch(auditedColumnSort, /requestPrimarySortRestore/);
});

test('Ver.239 semantic successors separate the list clear bridge from remaining task UX responsibilities', () => {
  const manifest = read('release-manifest.js');
  const taskUx = read('task-ux-v239.js');
  const columnSort = read('list-column-sort-v239.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  const release = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);

  assert.ok(release >= 239);
  for (const name of ['task-ux-v239.js', 'list-column-sort-v239.js']) {
    assert.equal(scripts.filter(item => item === name).length, 1, `${name} must be active exactly once`);
    assert.equal(required.filter(item => item === name).length, 1, `${name} must be required exactly once`);
  }
  for (const name of ['task-ux-v146.js', 'list-column-sort-v229.js']) {
    assert.ok(!scripts.includes(name), `${name} must be inactive after Ver.239`);
    assert.ok(!required.includes(name), `${name} must not remain required after Ver.239`);
    assert.ok(fs.existsSync(path.join(ROOT, name)), `${name} must remain physically available`);
  }

  // task UX now owns only quick status and dialog interaction guards.
  assert.match(taskUx, /const DISCARD_MESSAGE = '入力内容が変更されています。保存せずに閉じますか？'/);
  assert.match(taskUx, /event\.isTrusted/);
  assert.match(taskUx, /document\.addEventListener\('cancel'/);
  assert.match(taskUx, /event\.target\?\.closest\?\.\('#closeTaskDialog'\)/);
  assert.match(taskUx, /className = 'detail-status-control-v146'/);
  assert.match(taskUx, /submitStatusViaExistingEditor/);
  assert.match(taskUx, /dialog\.id === 'userDialog'/);
  assert.match(taskUx, /preferred\.click\(\)/);
  assert.doesNotMatch(taskUx, /data-clear-list-column-sort/);
  assert.doesNotMatch(taskUx, /document\.getElementById\('sortSelect'\)/);

  // Column sort now owns clear-state plus the bridge back to app.js primary rendering.
  assert.match(columnSort, /data-clear-list-column-sort/);
  assert.match(columnSort, /writeColumnSort\(null\)/);
  assert.match(columnSort, /function requestPrimarySortRestore\(\)/);
  assert.match(columnSort, /select\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/);
});

test('Ver.239 inventory advances the next task UX consolidation boundary', () => {
  const manifest = read('release-manifest.js');
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  const release = manifest.match(/version:\s*"(\d+)"/)?.[1];

  assert.equal(release, '239');
  assert.equal(inventory.baselineRelease, release);

  const taskUxGroup = inventory.groups.find(group => group.id === 'task-light-ux');
  assert.ok(taskUxGroup);
  assert.ok(taskUxGroup.assets.includes('task-ux-v239.js'));
  assert.ok(!taskUxGroup.assets.includes('task-ux-v146.js'));
  assert.match(taskUxGroup.reason, /Ver\.239/);
  assert.match(taskUxGroup.reason, /3責務|クイック状態変更/);

  const foundation = inventory.groups.find(group => group.id === 'foundation-presentation');
  assert.ok(foundation?.assets.includes('list-column-sort-v239.js'));
  assert.match(foundation.reason, /primary-sort再描画bridge/);

  const next = inventory.priorityCandidates?.[0];
  assert.ok(next);
  assert.deepEqual(next.scope, ['task-ux-v239.js']);
  assert.match(next.goal, /app\.js/);
  assert.match(next.goal, /dialog lifecycle/);
  assert.match(next.precondition, /Ver\.239/);
});
