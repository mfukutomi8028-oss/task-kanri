import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [app, history] = await Promise.all([
  read('app.js'),
  read('todo-history-v146.js')
]);

test('Ver.266 audit: canonical ToDo renderer replaces the view root while history watches its whole subtree', () => {
  assert.match(app, /elements\.todoView\.innerHTML\s*=\s*`/);
  assert.match(app, /bindTodoWorkspace\(elements\.todoView\)/);
  assert.match(history, /document\.getElementById\('todoView'\)/);
  assert.match(history, /\.observe\(root, \{ childList: true, subtree: true \}\)/);
});

test('Ver.266 audit: history owns four independent refresh triggers', () => {
  assert.match(history, /requestAnimationFrame\(/);
  assert.match(history, /root\.addEventListener\('input'/);
  assert.match(history, /todo-search-input-v145/);
  assert.match(history, /window\.addEventListener\('storage'/);
  assert.match(history, /event\.key === todosKey\(\) \|\| event\.key === 'systemTaskUser'/);
  assert.match(history, /window\.setInterval\(schedulePatch, 60000\)/);
});

test('Ver.266 audit: history semantic inputs are cache, current user, search state and local date boundary', () => {
  assert.match(history, /localStorage\.getItem\(todosKey\(\)\)/);
  assert.match(history, /localStorage\.getItem\('systemTaskUser'\)/);
  assert.match(history, /#todoView \.todo-search-input-v145/);
  assert.match(history, /const today = todayISO\(\)/);
  assert.match(history, /const start = historyStart\(\)/);
});

test('Ver.266 audit: patch writes inside its own subtree and can retrigger the broad observer', () => {
  assert.match(history, /lists\.appendChild\(section\)/);
  assert.match(history, /section\.innerHTML\s*=/);
  assert.match(history, /button\.textContent = hidden \? '履歴を表示' : '履歴を隠す'/);
  assert.match(history, /section\.dataset\.signature !== signature/);
});
