import { test, expect } from '@playwright/test';

const ROOM = 'test-modern-todo-toggle-v557';
async function boot(page, enabled = true) {
  await page.addInitScript(({ room, enabled }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('systemTaskUser', '佐藤');
    localStorage.setItem('system-task-users:' + room, JSON.stringify(['佐藤', '福冨']));
    const yesterday = Date.now() - 9 * 86400000;
    const todo = (id, owner, text, completed, completedAt, order) => ({
      id, owner, text, memo: '保存済みメモ：' + id, completed, completedAt, order,
      revision: 1, createdAt: 1000, updatedAt: 2000
    });
    localStorage.setItem('system-task-todos:' + room, JSON.stringify([
      todo('mine-open', '佐藤', '完了へ変更する', false, 0, -10),
      todo('mine-old', '佐藤', '未完了に戻す', true, yesterday, 0),
      todo('other-open', '福冨', '他人の個人ToDo', false, 0, 10)
    ]));
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get() { return null; }, set() {}
    });
    window.WORK_BOARD_TEST = { modernReadV552: true, modernWriteV557: enabled };
  }, { room: ROOM, enabled });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
  await page.goto('/?room=' + ROOM + '&modernReadV552=1&modernWriteV557=1',
    { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() =>
    window.WORK_BOARD_ASSETS_READY === true && window.WorkBoardReadV550?.read?.()?.ready === true,
    undefined, { timeout: 30000 });
}
const frame = page => page.frameLocator('iframe[data-modern-todo-v552]');
async function saved(page) {
  return page.evaluate(room => JSON.parse(localStorage.getItem('system-task-todos:' + room) || '[]'), ROOM);
}

for (const width of [1366, 390]) {
  test('Ver.557 Modern toggles personal ToDo through Classic owner only (' + width + 'px)', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await boot(page);
    const modern = frame(page);
    await expect(modern.locator('body')).toHaveAttribute('data-todo-write-v557', 'enabled');
    await expect(modern.locator('#openRowsV552 [data-todo-id]')).toHaveCount(1);
    const before = await saved(page);
    const other = before.find(row => row.id === 'other-open');
    await modern.locator('[data-todo-toggle-v557="mine-open"]').click();
    await expect(modern.locator('#todayRowsV552 [data-todo-id="mine-open"]')).toHaveCount(1);
    const after = await saved(page);
    const done = after.find(row => row.id === 'mine-open');
    expect(done.owner).toBe('佐藤');
    expect(done.completed).toBe(true);
    expect(done.revision).toBe(2);
    expect(done.completedAt).toBeGreaterThan(0);
    expect(after.find(row => row.id === 'other-open')).toEqual(other);
    await modern.locator('#historyV552 summary').click();
    await modern.locator('[data-todo-toggle-v557="mine-old"]').click();
    await expect(modern.locator('#openRowsV552 [data-todo-id="mine-old"]')).toHaveCount(1);
    const restored = (await saved(page)).find(row => row.id === 'mine-old');
    expect(restored.completed).toBe(false);
    expect(restored.completedAt).toBe(0);
    expect(restored.revision).toBe(2);
    expect(await modern.locator('body').evaluate(body =>
      body.ownerDocument.documentElement.scrollWidth - body.ownerDocument.defaultView.innerWidth))
      .toBeLessThanOrEqual(1);
  });
}

test('Ver.557 rejects stale revision, wrong room and another owner without writing', async ({ page }) => {
  await boot(page);
  const before = await saved(page);
  const attempt = async overrides => page.evaluate(async args =>
    window.WorkBoardTodoActionsV557.toggle(args), {
      roomId: ROOM, selectedUser: '佐藤', id: 'mine-open',
      expectedRevision: 1, completed: true, ...overrides
    });
  expect((await attempt({ selectedUser: '福冨' })).error).toBe('owner-mismatch');
  expect((await attempt({ roomId: 'test-another' })).error).toBe('owner-mismatch');
  expect((await attempt({ expectedRevision: 0 })).error).toBe('revision-or-state-mismatch');
  expect((await attempt({ completed: false })).error).toBe('revision-or-state-mismatch');
  expect(await saved(page)).toEqual(before);
  await frame(page).locator('[data-todo-toggle-v557="mine-open"]').click();
  expect((await attempt({ completed: false })).error).toBe('revision-or-state-mismatch');
  const changed = (await saved(page)).find(row => row.id === 'mine-open');
  expect(changed.revision).toBe(2);
});

test('Ver.557 flag absent preserves the Ver.552 read-only product and no command capability', async ({ page }) => {
  await boot(page, false);
  const modern = frame(page);
  await expect(modern.locator('body')).toHaveAttribute('data-todo-write-v557', 'readonly');
  await expect(modern.locator('[data-todo-toggle-v557]')).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.WorkBoardTodoActionsV557)).toBe('undefined');
  await expect(modern.locator('#openRowsV552 [data-todo-id]')).toHaveCount(1);
  expect((await saved(page)).find(row => row.id === 'mine-open').revision).toBe(1);
});
