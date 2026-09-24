import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [controls, tools, preview] = await Promise.all([
  read('todo-controls-v144.js'),
  read('todo-tools-v145.js'),
  read('todo-preview-v147.js')
]);

test('Ver.264 protocol: ToDo observer ownership and current scopes are explicit', () => {
  assert.match(controls, /observeRoot\(document\.getElementById\('todoView'\)\)/);
  assert.match(controls, /observeRoot\(document\.getElementById\('todayView'\)\)/);
  assert.match(controls, /observer\.observe\(root, \{ childList: true, subtree: true \}\)/);
  assert.match(controls, /document\.querySelectorAll\('#todoView \.todo-check'\)/);
  assert.match(controls, /document\.querySelectorAll\('#todayView \.todo-preview-check'\)/);

  assert.match(tools, /const root = document\.getElementById\('todoView'\)/);
  assert.match(tools, /observer\.observe\(root, \{ childList: true, subtree: true \}\)/);
  assert.match(tools, /root\.addEventListener\('input'/);
  assert.match(tools, /if \(!query\) return;/);

  assert.match(preview, /const root = document\.getElementById\('todayView'\)/);
  assert.match(preview, /\.observe\(root, \{ childList: true, subtree: true \}\)/);
  assert.match(preview, /document\.querySelectorAll\('#todayView \.todo-preview-checkline'\)/);
});

test('Ver.264 protocol: all three sidecars coalesce callbacks through requestAnimationFrame', () => {
  for (const [name, source] of [
    ['todo-controls-v144.js', controls],
    ['todo-tools-v145.js', tools],
    ['todo-preview-v147.js', preview]
  ]) {
    assert.match(source, /let scheduled = false;/, `${name} should keep an explicit scheduled guard`);
    assert.match(source, /if \(scheduled\) return;/, `${name} should coalesce duplicate observer callbacks`);
    assert.match(source, /requestAnimationFrame\(\(\) => \{/, `${name} should defer its patch to rAF`);
  }
});

test('Ver.264 protocol: semantic patch surfaces are narrower than their subtree observer scopes', () => {
  assert.doesNotMatch(tools, /getElementById\('todayView'\)/);
  assert.doesNotMatch(preview, /getElementById\('todoView'\)/);

  const controlsTargets = [
    '#todoView .todo-check',
    '#todayView .todo-preview-check'
  ];
  for (const target of controlsTargets) assert.ok(controls.includes(target));

  assert.ok(tools.includes('.todo-page'));
  assert.ok(preview.includes('#todayView .todo-preview-checkline'));
});
