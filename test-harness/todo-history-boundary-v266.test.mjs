import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [app, history, manifest, inventoryText] = await Promise.all([
  read('app.js'),
  read('todo-history-v146.js'),
  read('release-manifest.js'),
  read('patch-responsibilities.json')
]);
const inventory = JSON.parse(inventoryText);

test('Ver.267 product: history adopts only canonical direct-root ToDo replacements', () => {
  assert.match(app, /elements\.todoView\.innerHTML\s*=\s*`/);
  assert.match(app, /bindTodoWorkspace\(elements\.todoView\)/);
  assert.match(history, /document\.getElementById\('todoView'\)/);
  assert.match(history, /\.observe\(root, \{ childList: true \}\)/);
  assert.match(history, /mutation\.addedNodes/);
  assert.match(history, /\[data-todo-lists\]/);
  assert.doesNotMatch(history, /subtree:\s*true/);
});

test('Ver.267 product: observer-owned rAF and 60 second polling are retired', () => {
  assert.doesNotMatch(history, /requestAnimationFrame\(/);
  assert.doesNotMatch(history, /setInterval\(/);
  assert.match(history, /window\.setTimeout\(/);
  assert.match(history, /next\.setHours\(24, 0, 0, 100\)/);
  assert.match(history, /window\.addEventListener\('pageshow', refreshAfterResume\)/);
  assert.match(history, /document\.addEventListener\('visibilitychange'/);
});

test('Ver.267 product: search and storage refresh are event-driven without a full patch scheduler', () => {
  assert.match(history, /root\.addEventListener\('input'/);
  assert.match(history, /todo-search-input-v145/);
  assert.match(history, /if \(section\) applyVisibility\(section\)/);
  assert.match(history, /window\.addEventListener\('storage'/);
  assert.match(history, /event\.key === todosKey\(\) \|\| event\.key === 'systemTaskUser'/);
  assert.match(history, /if \(event\.key === todosKey\(\) \|\| event\.key === 'systemTaskUser'\) patch\(\)/);
});

test('Ver.267 product: history DOM writes stay idempotent and semantic inputs are unchanged', () => {
  assert.match(history, /localStorage\.getItem\(todosKey\(\)\)/);
  assert.match(history, /localStorage\.getItem\('systemTaskUser'\)/);
  assert.match(history, /const today = todayISO\(\)/);
  assert.match(history, /const start = historyStart\(\)/);
  assert.match(history, /section\.dataset\.signature !== signature/);
  assert.match(history, /if \(body && body\.hidden !== hidden\) body\.hidden = hidden/);
  assert.match(history, /if \(button\.textContent !== label\) button\.textContent = label/);
  assert.match(history, /button\.getAttribute\('aria-expanded'\) !== expanded/);
});

test('Ver.267 product: release and responsibility baseline advance together across later releases', () => {
  const release = manifest.match(/version:\s*"(\d+)"/)?.[1];
  assert.ok(release, 'release manifest version must exist');
  assert.match(manifest, new RegExp(`installFirstPaintGuardV${release}`));
  assert.match(manifest, new RegExp(`const VERSION = '${release}'`));
  assert.equal(inventory.baselineRelease, release);
  assert.ok(Number(release) >= 256, 'Ver.267 contract must remain present in release 256 or later');
  const todoGroup = inventory.groups.find(group => group.id === 'todo-light-ux');
  assert.ok(todoGroup?.reason?.includes('Ver.267'));
});
