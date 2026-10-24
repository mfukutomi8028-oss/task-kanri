import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const todoCss = read('ui-todo-light-v189.css');
const memoCss = read('ui-work-memo-v190.css');
const memoSource = read('work-features-v167.js');
const todoControls = read('todo-controls-v144.js');
const history = read('todo-history-v146.js');

test('Ver.532 desktop ToDo gives the full completion pill its own grid track', () => {
  assert.match(todoCss, /grid-template-columns:\s*24px max-content minmax\(0,\s*1fr\) auto !important/);
  assert.match(todoCss, /\.todo-item\s*>\s*\.todo-state-control-v144\s*\{[\s\S]*?grid-column:\s*2 !important/);
  assert.match(todoCss, /\.todo-item\s*>\s*\.todo-content\s*\{[\s\S]*?grid-column:\s*3 !important/);
  assert.match(todoCss, /pointer:\s*fine\)\s*and\s*\(max-width:\s*760px\)/);
  assert.match(todoControls, /wrapper\.className = 'todo-state-control-v144'/);
});

test('Ver.532 archived ToDos explicitly reclaim the wide text track from the interactive grid', () => {
  assert.match(todoCss, /\.todo-item\.todo-history-item-v146\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\) max-content !important/);
  assert.match(todoCss, /\.todo-history-item-v146\s*>\s*\.todo-history-main-v146\s*\{\s*grid-column:\s*1 !important/);
  assert.match(todoCss, /\.todo-history-item-v146\s*>\s*\.todo-history-date-v146\s*\{\s*grid-column:\s*2 !important/);
  assert.match(history, /<span class="todo-text"><span>\$\{title\}<\/span>/);
  assert.match(history, /\$\{memoHtml\}/);
});

test('Ver.532 memo cards render all saved characters and provide native scrolling', () => {
  assert.match(memoSource, /<pre class="work-memo-body-v167" tabindex="0"/);
  assert.match(memoSource, /\$\{escapeHtml\(body\)\}<\/pre>/);
  assert.doesNotMatch(memoSource, /body\.slice\(0,\s*220\)/);
  assert.match(memoCss, /\.work-memo-body-v167\s*\{[\s\S]*?max-height:\s*160px;[\s\S]*?overflow-y:\s*auto;/);
  assert.match(memoCss, /\.work-memo-body-v167:focus-visible/);
});
