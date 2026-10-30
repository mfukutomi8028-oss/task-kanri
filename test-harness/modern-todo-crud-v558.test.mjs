import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('Ver.558 extends the same Ver.557 command facade without a second writer or listener', () => {
  const app = read('app.js');
  const view = read('modern/product/todo-list-v552.mjs');
  const html = read('modern/product/todo-list-read-v552.html');
  const release = read('release-manifest.js');
  assert.match(app, /function installModernTodoToggleV557\(\)/);
  assert.match(app, /Object\.assign\(actions, \{/);
  assert.match(app, /query\.get\('modernWriteV558'\) === '1'/);
  assert.match(app, /return createTodo\(values\.text, values\.memo\)/);
  assert.match(app, /return updateTodoDetails\(current\.id, values\.text, values\.memo\)/);
  assert.match(app, /return deleteTodo\(current\.id\)/);
  assert.match(app, /return reorderTodo\(current\.id, request\.direction, request\.segment\)/);
  assert.match(app, /return toggleTodo\(current\.id\)/);
  assert.match(app, /const result = await commitTodoRecord\('todo-toggle', id, todo\.revision/);
  assert.match(app, /const result = await commitTodoRecord\('todo-delete', id, todo\.revision/);
  assert.match(app, /const result = await executeWrite\('todo-reorder', id/);
  assert.match(app, /function modernTodoRevisionMatchesV558/);
  assert.match(app, /expectedNeighborRevision/);
  assert.match(view, /todoWriteActionsV557/);
  assert.match(view, /data-todo-act-v558/);
  assert.match(view, /row\.dataset\.todoId = todo\.id/);
  assert.doesNotMatch(view, /button\.dataset\.todoId\s*=/);
  assert.match(view, /document\.createElement\('form'\)/);
  assert.doesNotMatch(view, /\binnerHTML\b|insertAdjacentHTML/);
  assert.match(html, /id="todoNewV558"/);
  assert.match(html, /id="todoFormHostV558"/);
  assert.doesNotMatch(view, /runTransaction\s*\(|initializeApp\s*\(|getDatabase\s*\(|localStorage\s*\.|demo-store/);
  assert.doesNotMatch(release, /todoFormHostV558|modern-todo-row-tools-v558/);
});
