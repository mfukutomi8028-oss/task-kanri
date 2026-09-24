import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [controls, tools, preview] = await Promise.all([
  read('todo-controls-v144.js'),
  read('todo-tools-v145.js'),
  read('todo-preview-v147.js')
]);

test('Ver.265 protocol: ToDo observer ownership stays feature-scoped while adoption is targeted', () => {
  assert.match(controls, /observeRoot\(document\.getElementById\('todoView'\), 'workspace'\)/);
  assert.match(controls, /observeRoot\(document\.getElementById\('todayView'\), 'preview'\)/);
  assert.match(controls, /observer\.observe\(root, \{ childList: true, subtree: true \}\)/);
  assert.match(controls, /mutation\.addedNodes\.forEach\(node => queueAddedNode\(node, mode\)\)/);
  assert.match(controls, /node\.querySelectorAll\(selector\)\.forEach/);

  assert.match(tools, /const root = document\.getElementById\('todoView'\)/);
  assert.match(tools, /observer\.observe\(root, \{ childList: true, subtree: true \}\)/);
  assert.match(tools, /\.\.\.mutation\.addedNodes.*addedNodeTouchesTodoStructure/s);
  assert.match(tools, /const OBSERVED_STRUCTURE = '.todo-page, \.todo-list, \.todo-item, \.todo-page-head, \.todo-list-heading, \.todo-page-stats';/);
  assert.match(tools, /root\.addEventListener\('input'/);

  assert.match(preview, /const root = document\.getElementById\('todayView'\)/);
  assert.match(preview, /\.observe\(root, \{ childList: true, subtree: true \}\)/);
  assert.match(preview, /mutation\.addedNodes\.forEach\(queueAddedNode\)/);
  assert.match(preview, /node\.querySelectorAll\('\.todo-preview-checkline'\)\.forEach/);
});

test('Ver.265 protocol: all three sidecars retain requestAnimationFrame coalescing only after semantic targeting', () => {
  for (const [name, source] of [
    ['todo-controls-v144.js', controls],
    ['todo-tools-v145.js', tools],
    ['todo-preview-v147.js', preview]
  ]) {
    assert.match(source, /let scheduled = false;/, `${name} should keep an explicit scheduled guard`);
    assert.match(source, /if \(scheduled\) return;/, `${name} should coalesce duplicate observer callbacks`);
    assert.match(source, /requestAnimationFrame\(\(\) => \{/, `${name} should defer its targeted patch to rAF`);
  }
});

test('Ver.265 protocol: observer-owned DOM writes are idempotent and unrelated added nodes cannot schedule product patching', () => {
  assert.match(controls, /if \(button\.textContent !== text\) button\.textContent = text;/);
  assert.match(tools, /function setText\(element, value\)/);
  assert.match(tools, /if \(element && element\.textContent !== value\) element\.textContent = value;/);
  assert.match(tools, /if \(!\(node instanceof Element\)\) return false;/);
  assert.match(preview, /if \(!\(node instanceof Element\)\) return;/);

  assert.doesNotMatch(tools, /getElementById\('todayView'\)/);
  assert.doesNotMatch(preview, /getElementById\('todoView'\)/);
});
