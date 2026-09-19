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

test('Ver.239 activates semantic task UX and list-column successors exactly once', () => {
  const manifest = read('release-manifest.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');

  assert.equal(manifest.match(/version:\s*"(\d+)"/)?.[1], '239');
  for (const name of ['task-ux-v239.js', 'list-column-sort-v239.js']) {
    assert.equal(scripts.filter(item => item === name).length, 1, `${name} must be dynamically active exactly once`);
    assert.equal(required.filter(item => item === name).length, 1, `${name} must be required exactly once`);
  }
  for (const name of ['task-ux-v146.js', 'list-column-sort-v229.js']) {
    assert.ok(!scripts.includes(name), `${name} must be retired from active runtime`);
    assert.ok(!required.includes(name), `${name} must be retired from required assets`);
    assert.ok(fs.existsSync(path.join(ROOT, name)), `${name} must remain physically available for cached manifests`);
  }
});

test('Ver.239 moves only the clear-sort rebuild bridge and preserves the existing task write path', () => {
  const taskUx = read('task-ux-v239.js');
  const listSort = read('list-column-sort-v239.js');
  const app = read('app.js');

  assert.doesNotMatch(taskUx, /data-clear-list-column-sort/);
  assert.doesNotMatch(taskUx, /sortSelect/);
  assert.match(taskUx, /submitStatusViaExistingEditor/);
  assert.match(taskUx, /taskForm\.requestSubmit\(\)/);
  assert.match(taskUx, /const DISCARD_MESSAGE/);
  assert.match(taskUx, /HTMLDialogElement/);

  assert.match(listSort, /data-clear-list-column-sort/);
  assert.match(listSort, /writeColumnSort\(null\)/);
  assert.match(listSort, /function requestPrimarySortRestore\(\)/);
  assert.match(listSort, /select\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/);
  assert.doesNotMatch(listSort, /taskForm|taskStatus|taskDialog/);

  assert.match(app, /elements\.sortSelect/);
  assert.match(app, /\.forEach\(el => el\?\.addEventListener\("input", render\)\)/);
  assert.match(app, /async function saveTaskFromForm\(\)/);
  assert.match(app, /commitTaskDraft/);
});

test('Ver.239 inventory leaves one narrower task UX candidate for the next checkpoint', () => {
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  assert.equal(inventory.baselineRelease, '239');

  const foundation = inventory.groups.find(group => group.id === 'foundation-presentation');
  const taskUx = inventory.groups.find(group => group.id === 'task-light-ux');
  assert.ok(foundation?.assets.includes('list-column-sort-v239.js'));
  assert.ok(taskUx?.assets.includes('task-ux-v239.js'));
  assert.match(foundation.reason, /Ver\.239/);
  assert.match(taskUx.reason, /Ver\.239/);

  assert.deepEqual(inventory.priorityCandidates?.[0]?.scope, ['task-ux-v239.js']);
  assert.match(inventory.priorityCandidates?.[0]?.goal || '', /app\.js/);
});
