import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [app, history] = await Promise.all([
  read('app.js'),
  read('todo-history-v146.js')
]);

test('Ver.267 product: canonical ToDo renderer is adopted from direct root child replacement only', () => {
  assert.match(app, /elements\.todoView\.innerHTML\s*=\s*`/);
  assert.match(app, /bindTodoWorkspace\(elements\.todoView\)/);
  assert.match(history, /new MutationObserver\(handleRootMutations\)\.observe\(root, \{ childList: true \}\)/);
  assert.doesNotMatch(history, /subtree:\s*true/);
});

test('Ver.267 product: observer path is synchronous and no longer owns requestAnimationFrame or interval polling', () => {
  assert.match(history, /function handleRootMutations\(mutations\)/);
  assert.match(history, /if \(needsPatch\) patch\(\)/);
  assert.doesNotMatch(history, /requestAnimationFrame\(/);
  assert.doesNotMatch(history, /setInterval\(/);
});

test('Ver.267 product: search and storage remain explicit event-driven refresh triggers', () => {
  assert.match(history, /root\.addEventListener\('input'/);
  assert.match(history, /todo-search-input-v145/);
  assert.match(history, /window\.addEventListener\('storage'/);
  assert.match(history, /event\.key === todosKey\(\) \|\| event\.key === 'systemTaskUser'/);
});

test('Ver.267 product: local date refresh uses one-shot boundary scheduling plus resume recovery', () => {
  assert.match(history, /next\.setHours\(24, 0, 0, 250\)/);
  assert.match(history, /window\.setTimeout\(/);
  assert.match(history, /window\.addEventListener\('pageshow', refreshForResume\)/);
  assert.match(history, /visibilitychange/);
});

test('Ver.267 product: visibility writes are idempotent before touching child text or aria state', () => {
  assert.match(history, /body && body\.hidden !== hidden/);
  assert.match(history, /button\.textContent !== label/);
  assert.match(history, /button\.getAttribute\('aria-expanded'\) !== expanded/);
  assert.match(history, /section\.dataset\.signature !== signature/);
});
