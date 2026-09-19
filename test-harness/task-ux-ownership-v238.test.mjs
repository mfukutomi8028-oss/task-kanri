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

test('Ver.238 audit keeps task-ux active because it still owns live dialog and quick-status behavior', () => {
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

  // task-ux still supplies behavior that app.js does not currently provide.
  assert.match(taskUx, /const DISCARD_MESSAGE = '入力内容が変更されています。保存せずに閉じますか？'/);
  assert.match(taskUx, /event\.isTrusted/);
  assert.match(taskUx, /document\.addEventListener\('cancel'/);
  assert.match(taskUx, /event\.target\?\.closest\?\.\('#closeTaskDialog'\)/);
  assert.match(taskUx, /className = 'detail-status-control-v146'/);
  assert.match(taskUx, /submitStatusViaExistingEditor/);
  assert.match(taskUx, /dialog\.id === 'userDialog'/);
  assert.match(taskUx, /preferred\.click\(\)/);
});

test('Ver.238 audit exposes a cross-sidecar clear-sort bridge that prevents simple task-ux retirement', () => {
  const taskUx = read('task-ux-v146.js');
  const columnSort = read('list-column-sort-v229.js');
  const app = read('app.js');

  // list-column-sort owns secondary sort state and the clear control itself.
  assert.match(columnSort, /data-clear-list-column-sort/);
  assert.match(columnSort, /writeColumnSort\(null\)/);
  assert.match(columnSort, /scheduleEnhance\(\)/);
  assert.match(columnSort, /document\.addEventListener\('input', handleBaseSortChange, true\)/);

  // Clearing secondary sort does not itself rebuild app.js's canonical primary order.
  assert.doesNotMatch(columnSort, /dispatchEvent\(new Event\('input'/);
  assert.match(taskUx, /\[data-clear-list-column-sort\]/);
  assert.match(taskUx, /select\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/);

  // The synthetic input works because app.js owns primary sorting/rendering on sortSelect input.
  assert.match(app, /elements\.sortSelect/);
  assert.match(app, /\.forEach\(el => el\?\.addEventListener\("input", render\)\)/);
});

test('Ver.238 audit records the safe next consolidation boundary without changing product release', () => {
  const manifest = read('release-manifest.js');
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  const release = manifest.match(/version:\s*"(\d+)"/)?.[1];

  assert.equal(release, '237', 'Ver.238 is an audit checkpoint and must not bump product release');
  assert.equal(inventory.baselineRelease, release);

  const taskUxGroup = inventory.groups.find(group => group.id === 'task-light-ux');
  assert.ok(taskUxGroup);
  assert.ok(taskUxGroup.assets.includes('task-ux-v146.js'));
  assert.match(taskUxGroup.reason, /Ver\.238/);
  assert.match(taskUxGroup.reason, /simple retirement|単純退役|単純削除/i);

  const next = inventory.priorityCandidates?.[0];
  assert.ok(next);
  assert.deepEqual(next.scope, ['task-ux-v146.js', 'list-column-sort-v229.js']);
  assert.match(next.goal, /app\.js/);
  assert.match(next.goal, /list-column-sort-v229\.js/);
  assert.match(next.precondition, /Ver\.238/);
});
