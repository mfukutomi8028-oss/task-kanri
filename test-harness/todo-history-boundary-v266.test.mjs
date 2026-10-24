import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [app, history, manifest, inventoryText, todoTools] = await Promise.all([
  read('app.js'),
  read('todo-history-v146.js'),
  read('release-manifest.js'),
  read('patch-responsibilities.json'),
  read('todo-tools-v145.js')
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
  assert.match(history, /root\.dispatchEvent\(new CustomEvent\('todo-history-updated-v531'\)\)/);
  assert.match(todoTools, /todo-history-updated-v531/);
  assert.match(history, /window\.addEventListener\('storage'/);
  assert.match(history, /event\.key === todosKey\(\) \|\| event\.key === 'systemTaskUser'/);
  assert.match(history, /if \(event\.key === todosKey\(\) \|\| event\.key === 'systemTaskUser'\) patch\(\)/);
});

test('Ver.267 product: history DOM writes stay idempotent and semantic inputs are unchanged', () => {
  assert.match(history, /localStorage\.getItem\(todosKey\(\)\)/);
  assert.match(history, /localStorage\.getItem\('systemTaskUser'\)/);
  assert.match(history, /const today = todayISO\(\)/);
  assert.match(history, /const PAGE_SIZE = 50/);
  assert.match(history, /history\.slice\(0, visibleCount\)/);
  assert.match(history, /\.filter\(todo => Number\(todo\.completedAt \|\| 0\) > 0/);
  assert.doesNotMatch(history, /HISTORY_DAYS\s*=\s*7/);
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

// Ver.519: retained unchanged Ver.265 Protocol checks after owner co-location.
{
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [app, controls, tools, preview] = await Promise.all([
  read('app.js'),
  read('todo-controls-v144.js'),
  read('todo-tools-v145.js'),
  read('todo-preview-v147.js')
]);

test('Ver.265 protocol: canonical ToDo and Today renders replace each view root', () => {
  assert.match(app, /elements\.todoView\.innerHTML\s*=\s*`/);
  assert.match(app, /elements\.todayView\.innerHTML\s*=\s*`/);
  assert.match(app, /bindTodoWorkspace\(elements\.todoView\)/);
  assert.match(app, /bindTodayTodoPreview\(\)/);
});

test('Ver.265 protocol: ToDo sidecars observe only direct view-root child replacement', () => {
  assert.match(controls, /observeRoot\(todoRoot, adoptWorkspaceNode\)/);
  assert.match(controls, /observeRoot\(todayRoot, adoptPreviewNode\)/);
  assert.match(controls, /\.observe\(root, \{ childList: true \}\)/);
  assert.doesNotMatch(controls, /subtree:\s*true/);

  assert.match(tools, /const root = document\.getElementById\('todoView'\)/);
  assert.match(tools, /\.observe\(root, \{ childList: true \}\)/);
  assert.doesNotMatch(tools, /subtree:\s*true/);

  assert.match(preview, /const root = document\.getElementById\('todayView'\)/);
  assert.match(preview, /\.observe\(root, \{ childList: true \}\)/);
  assert.doesNotMatch(preview, /subtree:\s*true/);
});

test('Ver.265 protocol: observer callbacks adopt only added subtrees and no longer schedule rAF rescans', () => {
  for (const [name, source] of [
    ['todo-controls-v144.js', controls],
    ['todo-tools-v145.js', tools],
    ['todo-preview-v147.js', preview]
  ]) {
    assert.match(source, /mutation\.addedNodes\.forEach\(/, `${name} must adopt only added nodes`);
    assert.doesNotMatch(source, /requestAnimationFrame\(/, `${name} must not schedule observer-driven rAF rescans`);
    assert.doesNotMatch(source, /let scheduled = false;/, `${name} must not keep the old rAF coalescing state`);
  }

  assert.match(controls, /function adoptWorkspaceNode\(node\)/);
  assert.match(controls, /function adoptPreviewNode\(node\)/);
  assert.match(tools, /function adoptNode\(node\)/);
  assert.match(preview, /function adoptNode\(node\)/);
});

test('Ver.265 protocol: todo-tools keeps search writes idempotent and detail editing event-driven', () => {
  assert.match(tools, /function setText\(node, value\)/);
  assert.match(tools, /node\.textContent !== value/);
  assert.match(tools, /setText\(completedToggle,/);
  assert.match(tools, /setText\(result,/);
  assert.match(tools, /root\.addEventListener\('input'/);
  assert.match(tools, /if \(!query\) return;/);
  assert.match(tools, /if \(page\) applySearch\(page\)/);
  assert.doesNotMatch(tools, /schedulePatch\(/);
});
}
