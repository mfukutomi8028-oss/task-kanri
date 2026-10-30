import { test, expect } from '@playwright/test';

const ROOM = 'test-modern-todo-crud-v558';

function seedTodos() {
  const today = new Date();
  const completedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 15).getTime();
  const oldCompleted = Date.now() - 9 * 86400000;
  const row = (id, owner, text, order, completed = false, completedAt = 0) => ({
    id, owner, text, memo: '初期メモ：' + id, completed, completedAt,
    order, createdAt: 1000 + order, updatedAt: 2000 + order, revision: 1
  });
  return [
    row('mine-a', '佐藤', '先頭の作業', -10),
    row('mine-b', '佐藤', '二番目の作業', 100),
    row('mine-done', '佐藤', '本日の完了', 400, true, completedToday),
    row('mine-old', '佐藤', '過去の完了', 500, true, oldCompleted),
    row('other', '福冨', '他人の秘密メモ', 800)
  ];
}

async function boot(page, { manage = true, advanced = false } = {}) {
  const seeded = seedTodos();
  await page.addInitScript(({ room, todos, manage, advanced }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('systemTaskUser', '佐藤');
    localStorage.setItem('system-task-users:' + room, JSON.stringify(['佐藤', '福冨']));
    localStorage.setItem('system-task-todos:' + room, JSON.stringify(todos));
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get() { return null; }, set() {}
    });
    window.WORK_BOARD_TEST = { modernReadV552: true, modernWriteV557: true, modernWriteV558: manage, modernWriteV559: advanced };
  }, { room: ROOM, todos: seeded, manage, advanced });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
  await page.goto('/?room=' + ROOM + '&modernReadV552=1&modernWriteV557=1&modernWriteV558=1&modernWriteV559=1',
    { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() =>
    window.WORK_BOARD_ASSETS_READY === true
      && window.WorkBoardReadV550?.read?.()?.ready === true,
    undefined, { timeout: 30000 });
}

const modern = page => page.frameLocator('iframe[data-modern-todo-v552]');
const saved = page => page.evaluate(room =>
  JSON.parse(localStorage.getItem('system-task-todos:' + room) || '[]'), ROOM);
const byId = (rows, id) => rows.find(row => row.id === id);
const parentRequest = (id, overrides = {}) => ({
  roomId: ROOM, selectedUser: '佐藤', id, expectedRevision: 1,
  ...overrides
});

for (const width of [1366, 390]) {
  test('Ver.558 create/edit/move/delete reuse the Classic local owner at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await boot(page);
    const frame = modern(page);
    await expect(frame.locator('body')).toHaveAttribute('data-todo-manage-v558', 'enabled');
    const before = await saved(page);
    const unrelated = byId(before, 'other');
    await frame.locator('#todoNewV558').click();
    await frame.locator('#todoTextV558').fill('新規の作業');
    await frame.locator('#todoMemoV558').fill('新規の詳細メモ');
    await frame.locator('#todoSaveV558').click();
    await expect(frame.locator('#todoFormV558')).toHaveCount(0);
    await expect(frame.locator('#openRowsV552 [data-todo-id]')).toHaveCount(3);
    const created = (await saved(page)).find(row => row.text === '新規の作業');
    expect(created).toMatchObject({ owner: '佐藤', memo: '新規の詳細メモ', revision: 1, completed: false });
    expect(created.id).toBeTruthy();
    expect(await frame.locator('#openRowsV552 [data-todo-id]').first().getAttribute('data-todo-id'))
      .toBe(created.id);

    const editor = frame.locator('#openRowsV552 [data-todo-id="' + created.id + '"] [data-todo-act-v558="update"]');
    await editor.click();
    await expect(frame.locator('#todoTextV558')).toHaveValue('新規の作業');
    await frame.locator('#todoTextV558').fill('編集後の作業');
    await frame.locator('#todoMemoV558').fill('編集後の詳細メモ');
    await frame.locator('#todoSaveV558').click();
    await expect(frame.locator('#todoFormV558')).toHaveCount(0);
    await expect(frame.locator('#openRowsV552 [data-todo-id="' + created.id + '"]')).toContainText('編集後の作業');
    expect(byId(await saved(page), created.id)).toMatchObject({
      text: '編集後の作業', memo: '編集後の詳細メモ', revision: 2
    });

    const moveDown = frame.locator('#openRowsV552 [data-todo-id="' + created.id
      + '"] [data-todo-act-v558="reorder"][data-direction="1"]');
    await moveDown.click();
    await expect(frame.locator('#openRowsV552 [data-todo-id]').first()).toHaveAttribute('data-todo-id', 'mine-a');
    const moved = await saved(page);
    expect(byId(moved, created.id).revision).toBe(3);
    expect(byId(moved, 'mine-a').revision).toBe(2);

    page.once('dialog', dialog => dialog.accept());
    await frame.locator('#openRowsV552 [data-todo-id="' + created.id
      + '"] [data-todo-act-v558="remove"]').click();
    await expect(frame.locator('#openRowsV552 [data-todo-id="' + created.id + '"]')).toHaveCount(0);
    const after = await saved(page);
    expect(byId(after, created.id)).toBeUndefined();
    expect(byId(after, 'other')).toEqual(unrelated);
    expect(byId(after, 'mine-old')).toEqual(byId(before, 'mine-old'));
    expect(await frame.locator('body').evaluate(el =>
      el.ownerDocument.documentElement.scrollWidth - el.ownerDocument.defaultView.innerWidth))
      .toBeLessThanOrEqual(1);
  });
}

test('Ver.558 rejects wrong owner/room, stale revision and invalid changes without writing', async ({ page }) => {
  await boot(page);
  const before = await saved(page);
  const invoke = (method, request) => page.evaluate(({ method, request }) =>
    window.WorkBoardTodoActionsV557[method](request), { method, request });
  expect((await invoke('update', parentRequest('mine-a', { selectedUser: '福冨', text: '禁止', memo: '' }))).error)
    .toBe('owner-mismatch');
  expect((await invoke('remove', parentRequest('mine-a', { roomId: 'test-another-room' }))).error)
    .toBe('owner-mismatch');
  expect((await invoke('update', parentRequest('mine-a', { expectedRevision: 0, text: '古い', memo: '' }))).error)
    .toBe('revision-or-state-mismatch');
  expect((await invoke('update', parentRequest('other', { text: '越境', memo: '' }))).error)
    .toBe('not-found');
  expect((await invoke('create', parentRequest('', { text: '', memo: '' }))).error)
    .toBe('invalid-todo-input');
  expect((await invoke('create', parentRequest('', { text: 'x'.repeat(101), memo: '' }))).error)
    .toBe('invalid-todo-input');
  expect((await invoke('reorder', parentRequest('mine-a', {
    segment: 'open', direction: 1, neighborId: 'mine-b', expectedNeighborRevision: 9
  }))).error).toBe('revision-or-state-mismatch');
  expect(await saved(page)).toEqual(before);
});

test('Ver.558 remote-style stale edit is rejected locally and unsaved text stays in the editor', async ({ page }) => {
  await boot(page);
  const frame = modern(page);
  await frame.locator('#openRowsV552 [data-todo-id="mine-a"] [data-todo-act-v558="update"]').click();
  await frame.locator('#todoTextV558').fill('消してはいけない未保存の文章');
  const winner = await page.evaluate(request =>
    window.WorkBoardTodoActionsV557.update(request),
    parentRequest('mine-a', { text: '別端末相当の新しい内容', memo: '同期済み' }));
  expect(winner.ok).toBe(true);
  await frame.locator('#todoSaveV558').click();
  await expect(frame.locator('#todoActionStatusV557')).toContainText('保存できませんでした');
  await expect(frame.locator('#todoTextV558')).toHaveValue('消してはいけない未保存の文章');
  expect(byId(await saved(page), 'mine-a')).toMatchObject({
    text: '別端末相当の新しい内容', revision: 2
  });
  await frame.locator('#todoCancelV558').click();
  await expect(frame.locator('#todoFormV558')).toHaveCount(0);
  page.once('dialog', dialog => dialog.dismiss());
  await frame.locator('#openRowsV552 [data-todo-id="mine-b"] [data-todo-act-v558="remove"]').click();
  await expect(frame.locator('#todoActionStatusV557')).toContainText('キャンセル');
  expect(byId(await saved(page), 'mine-b')).toBeTruthy();
});

test('Ver.558 filtered search hides ambiguous reorder but preserves edit and delete', async ({ page }) => {
  await boot(page);
  const frame = modern(page);
  await frame.locator('#todoSearchV552').fill('先頭の作業');
  await expect(frame.locator('#openRowsV552 [data-todo-id]')).toHaveCount(1);
  await expect(frame.locator('#openRowsV552 [data-todo-act-v558="reorder"]')).toHaveCount(0);
  await expect(frame.locator('#openRowsV552 [data-todo-act-v558="update"]')).toHaveCount(1);
  await expect(frame.locator('#openRowsV552 [data-todo-act-v558="remove"]')).toHaveCount(1);
  await frame.locator('#todoSearchV552').fill('');
  await expect(frame.locator('#openRowsV552 [data-todo-id="mine-a"] [data-todo-act-v558="reorder"]'))
    .toHaveCount(2);
});

test('Ver.558 clears an unsaved draft when Classic changes the selected user', async ({ page }) => {
  await boot(page);
  const frame = modern(page);
  await frame.locator('#openRowsV552 [data-todo-id="mine-a"] [data-todo-act-v558="update"]').click();
  await frame.locator('#todoTextV558').fill('前の利用者だけの未保存文書');
  await page.evaluate(() => {
    const select = document.getElementById('currentUserSelect');
    select.value = '福冨';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(frame.locator('#sourceV552')).toContainText('利用者：福冨');
  await expect(frame.locator('#todoFormV558')).toHaveCount(0);
  await expect(frame.locator('#main')).not.toContainText('前の利用者だけの未保存文書');
  await expect(frame.locator('#todoActionStatusV557')).toContainText('利用者またはルーム');
});

test('Ver.558 disabled flag preserves Ver.557 toggle-only UI with no edit form', async ({ page }) => {
  await boot(page, { manage: false });
  const frame = modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-todo-write-v557', 'enabled');
  await expect(frame.locator('body')).toHaveAttribute('data-todo-manage-v558', 'readonly');
  await expect(frame.locator('#todoNewV558')).toBeHidden();
  await expect(frame.locator('form, [data-todo-act-v558]')).toHaveCount(0);
  await expect(frame.locator('[data-todo-toggle-v557]')).toHaveCount(4);
  expect(await page.evaluate(() => typeof window.WorkBoardTodoActionsV557.create)).toBe('undefined');
});

test('Ver.559 desktop drag reorders through Classic and keeps other owner unchanged', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await boot(page, { advanced: true });
  const frame = modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-todo-advanced-v559', 'enabled');
  const oldRows = await saved(page);
  const target = frame.locator('#openRowsV552 .todo-row[data-todo-id="mine-b"]');
  const size = await target.boundingBox();
  expect(size?.height).toBeGreaterThan(15);
  await frame.locator('#openRowsV552 .todo-row[data-todo-id="mine-a"] [data-todo-drag-v559]')
    .dragTo(target, { targetPosition: { x: Math.min(20, size.width - 2), y: size.height - 2 } });
  await expect(frame.locator('#openRowsV552 .todo-row[data-todo-id]').first())
    .toHaveAttribute('data-todo-id', 'mine-b');
  const rows = await saved(page);
  expect(byId(rows, 'mine-a').revision).toBe(2);
  expect(byId(rows, 'mine-b').revision).toBe(1);
  expect(byId(rows, 'other')).toEqual(byId(oldRows, 'other'));
  await expect(frame.locator('#todoActionStatusV557')).toContainText('ドラッグによる並び順を保存');
});

test('Ver.559 opens Classic promotion form and atomically saves task and ToDo locally', async ({ page }) => {
  await boot(page, { advanced: true });
  const frame = modern(page);
  await frame.locator('#openRowsV552 .todo-row[data-todo-id="mine-a"] [data-todo-act-v558="promote"]').click();
  await expect(page.locator('iframe[data-modern-todo-v552]')).toHaveCount(0);
  await expect(page.locator('#taskDialog')).toBeVisible();
  await expect(page.locator('#taskTitle')).toHaveValue('先頭の作業');
  await expect(page.locator('#taskDescription')).toHaveValue('初期メモ：mine-a');
  await page.locator('#taskForm button[type="submit"]').click();
  await expect(page.locator('#taskDialog')).not.toBeVisible();
  const readTasks = () => page.evaluate(room =>
    JSON.parse(localStorage.getItem('system-task-tasks:' + room) || '[]'), ROOM);
  await expect.poll(async () => (await readTasks()).length).toBe(1);
  const tasks = await readTasks();
  expect(tasks[0]).toMatchObject({ title: '先頭の作業', description: '初期メモ：mine-a' });
  const todo = byId(await saved(page), 'mine-a');
  expect(todo).toMatchObject({ completed: true, revision: 2 });
  expect(todo.completedAt).toBeGreaterThan(0);
  expect(byId(await saved(page), 'other').text).toBe('他人の秘密メモ');
});

test('Ver.559 refuses stale promotion without creating an orphan task', async ({ page }) => {
  await boot(page, { advanced: true });
  await modern(page).locator('#openRowsV552 .todo-row[data-todo-id="mine-a"] [data-todo-act-v558="promote"]').click();
  await expect(page.locator('#taskDialog')).toBeVisible();
  const winner = await page.evaluate(async room => window.WorkBoardTodoActionsV557.update({
    roomId: room, selectedUser: '佐藤', id: 'mine-a', expectedRevision: 1,
    text: '別端末相当の更新済み内容', memo: '最新メモ'
  }), ROOM);
  expect(winner.ok).toBe(true);
  await page.locator('#taskForm button[type="submit"]').click();
  await expect(page.locator('#taskDialog')).toBeVisible();
  const taskCount = await page.evaluate(room =>
    JSON.parse(localStorage.getItem('system-task-tasks:' + room) || '[]').length, ROOM);
  expect(taskCount).toBe(0);
  expect(byId(await saved(page), 'mine-a')).toMatchObject({
    text: '別端末相当の更新済み内容', completed: false, revision: 2
  });
  await page.keyboard.press('Escape');
  await expect(page.locator('#taskDialog')).not.toBeVisible();
});

test('Ver.559 move validates full visible order and rejects an unauthorized operation', async ({ page }) => {
  await boot(page, { advanced: true });
  const before = await saved(page);
  const actions = async request => page.evaluate(request =>
    window.WorkBoardTodoActionsV557.move(request), request);
  const expectedRows = [
    { id: 'mine-a', revision: 1 }, { id: 'mine-b', revision: 1 }
  ];
  const request = {
    roomId: ROOM, selectedUser: '佐藤', id: 'mine-a',
    expectedRevision: 1, targetId: 'mine-b', expectedTargetRevision: 1,
    after: true, segment: 'open', expectedRows
  };
  expect((await actions({ ...request, expectedRows: expectedRows.slice(1) })).error)
    .toBe('revision-or-state-mismatch');
  expect((await actions({ ...request, selectedUser: '福冨' })).error)
    .toBe('owner-mismatch');
  expect((await actions({ ...request, expectedTargetRevision: 2 })).error)
    .toBe('revision-or-state-mismatch');
  expect(await saved(page)).toEqual(before);
});

test('Ver.559 absent flag preserves Ver.558 and never shows promotion or drag', async ({ page }) => {
  await boot(page);
  const frame = modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-todo-advanced-v559', 'readonly');
  await expect(frame.locator('[data-todo-drag-v559], [data-todo-act-v558="promote"]')).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.WorkBoardTodoActionsV557.move)).toBe('undefined');
  expect(await page.evaluate(() => typeof window.WorkBoardTodoActionsV557.promote)).toBe('undefined');
  await expect(frame.locator('#todoNewV558')).toBeVisible();
});

test('Ver.559 mobile offers Classic promotion but uses existing arrow controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, { advanced: true });
  const frame = modern(page);
  await expect(frame.locator('[data-todo-act-v558="promote"]')).toHaveCount(2);
  await expect(frame.locator('[data-todo-drag-v559]').first()).toBeHidden();
  await expect(frame.locator('[data-todo-act-v558="reorder"]')).toHaveCount(6);
  expect(await frame.locator('body').evaluate(body =>
    body.ownerDocument.documentElement.scrollWidth - body.ownerDocument.defaultView.innerWidth))
    .toBeLessThanOrEqual(1);
});

