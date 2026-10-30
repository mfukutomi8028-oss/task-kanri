import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Ver.557 Modern toggle delegates to the existing Classic save path and has no other writer', () => {
  const app = read('app.js');
  const modern = read('modern/product/todo-list-v552.mjs');
  const html = read('modern/product/todo-list-read-v552.html');
  const release = read('release-manifest.js');
  assert.match(app, /function installModernTodoToggleV557\(\)/);
  assert.match(app, /return toggleTodo\(current\.id\);/);
  assert.match(app, /const result = await commitTodoRecord\('todo-toggle', id, todo\.revision/);
  assert.match(app, /return sharedWriteCoordinator\.execute\(kind, id, writer\);/);
  assert.match(app, /query\.get\('modernWriteV557'\) === '1'/);
  assert.match(app, /ROOM_ID\.startsWith\('test-'\)/);
  assert.match(app, /demoEmulator/);
  assert.match(modern, /WorkBoardTodoActionsV557/);
  assert.match(modern, /data-todo-toggle-v557/);
  assert.match(modern, /textContent/);
  assert.doesNotMatch(modern, /runTransaction\s*\(|initializeApp\s*\(|getDatabase\s*\(|localStorage\s*\.|demo-store/);
  assert.match(html, /todoActionStatusV557/);
  assert.doesNotMatch(release, /modern-todo-toggle-v557|todoActionStatusV557/);
});
