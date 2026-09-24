import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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
