import { test, expect } from '@playwright/test';

// テスト専用ルームのローカルフォールバックのみを使用し、本番Firebaseに接続しない。
async function boot(page, room, { historical = [], memos = null } = {}) {
  await page.addInitScript(({ room, historical, memos }) => {
    if (!sessionStorage.getItem('wb-v531-fixture-ready')) {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
      localStorage.setItem('system-task-users:' + room, JSON.stringify(['福冨', '森井']));
      if (historical.length) localStorage.setItem('system-task-todos:' + room, JSON.stringify(historical));
      if (memos) localStorage.setItem('system-business-memos:' + room, JSON.stringify(memos));
      sessionStorage.setItem('wb-v531-fixture-ready', '1');
    }
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get() { return null; }, set() {}
    });
  }, { room, historical, memos });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
  await page.goto('/?room=' + room, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  if (memos) {
    // The assets-ready flag confirms loading, not that the two independent
    // Classic data owners have finished local fallback/subscription setup.
    // Wait for the actual business-memo read boundary before clicking nav.
    await page.waitForFunction(() =>
      window.WorkBoardReadV550?.read?.()?.ready === true &&
      window.WorkBoardBusinessMemoReadV555?.read?.()?.ready === true,
    undefined, { timeout: 30_000 });
  }
}

test('Today panels move using visible arrows and retain the user-specific order after reload', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await boot(page, 'test-v531-today-order');
  const panels = page.locator('#todayView .today-grid [data-today-panel-id]');
  await expect(panels).toHaveCount(5);
  await expect(panels.first()).toHaveAttribute('data-today-panel-id', 'schedule');
  await page.locator('#todayView [data-today-panel-id="schedule"] .today-panel-shift-v531').nth(1).click();
  await expect(panels.first()).toHaveAttribute('data-today-panel-id', 'overdue');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await expect(page.locator('#todayView .today-grid [data-today-panel-id]').first())
    .toHaveAttribute('data-today-panel-id', 'overdue');
});

test('Todo shows newest first and supports desktop drag while retaining mobile arrow buttons', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await boot(page, 'test-v531-todo-order');
  await page.locator('#todayView [data-layout-jump="todos"]').first().click();
  const input = page.locator('#todayTodoInput');
  await input.fill('先に登録したToDo');
  await page.locator('.todo-create-form [type="submit"]').click();
  await expect(page.locator('#todoView .todo-list:not(.is-completed) [data-todo-id]')).toHaveCount(1);
  await input.fill('後から登録したToDo');
  await page.locator('.todo-create-form [type="submit"]').click();
  const rows = page.locator('#todoView .todo-list:not(.is-completed) [data-todo-id]');
  await expect(rows).toHaveCount(2);
  await expect(rows.first().locator('.todo-text')).toHaveText('後から登録したToDo');
  await expect(rows.first().locator('.todo-move-button')).toHaveCount(2);
  await rows.first().locator('.todo-drag-handle-v531').dragTo(rows.nth(1));
  await expect(rows.first().locator('.todo-text')).toHaveText('先に登録したToDo');
});

test('past completed ToDos remain searchable beyond seven days with paged DOM rendering', async ({ page }) => {
  const now = Date.now();
  const historical = Array.from({ length: 85 }, (_, index) => ({
    id: 'old-' + index,
    owner: '福冨',
    text: '古い履歴 ' + index,
    memo: '保存した内容 ' + index,
    completed: true,
    completedAt: now - (index + 8) * 86400000,
    createdAt: now - (index + 9) * 86400000,
    updatedAt: now - (index + 8) * 86400000,
    order: index * 1024,
    revision: 1
  }));
  await boot(page, 'test-v531-todo-history', { historical });
  await page.locator('#todayView [data-layout-jump="todos"]').first().click();
  await expect(page.locator('.todo-history-v146 .todo-history-item-v146')).toHaveCount(50);
  await expect(page.locator('.todo-history-more-v531')).toHaveCount(1);
  await page.locator('.todo-search-input-v145').fill('古い履歴 84');
  await expect(page.locator('.todo-history-v146 .todo-history-item-v146')).toHaveCount(1);
  await expect(page.locator('.todo-history-v146 .todo-item .todo-text')).toContainText('古い履歴 84');
});

test('business memo order is editable without changing shared memos and remains after reload', async ({ page }) => {
  const memos = {
    memoOlder: { id: 'memoOlder', title: '古い業務メモ', body: '連絡先', category: '定型情報', revision: 1, updatedAt: 1000, pinned: false },
    memoNewer: { id: 'memoNewer', title: '新しい業務メモ', body: '手順', category: '定型情報', revision: 1, updatedAt: 2000, pinned: false }
  };
  await page.setViewportSize({ width: 1366, height: 900 });
  await boot(page, 'test-v531-memo-order', { memos });
  await expect(page.locator('[data-work-memo-layout]')).toBeAttached({ timeout: 20_000 });
  await page.locator('[data-work-memo-layout]').click();
  // The cards are mounted even while the memo screen is hidden: verify the
  // actual route before expecting the reorder buttons to be actionable.
  await expect(page.locator('body')).toHaveClass(/work-memo-mode-v167/);
  await expect(page.locator('#workMemoViewV167')).toBeVisible();
  const cards = page.locator('#workMemoViewV167 .work-memo-card-v167');
  await expect(cards).toHaveCount(2);
  await expect(cards.first().locator('h4')).toHaveText('新しい業務メモ');
  const moveOlderFirst = cards.nth(1).locator('.work-memo-move-v531').first();
  await expect(moveOlderFirst).toBeVisible();
  await moveOlderFirst.click();
  await expect(cards.first().locator('h4')).toHaveText('古い業務メモ');
  const savedMemo = await page.evaluate(() => JSON.parse(localStorage.getItem('system-business-memos:test-v531-memo-order') || '{}'));
  expect(savedMemo.memoOlder.revision).toBe(1);
  expect(savedMemo.memoNewer.revision).toBe(1);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.locator('[data-work-memo-layout]').click();
  await expect(page.locator('body')).toHaveClass(/work-memo-mode-v167/);
  await expect(page.locator('#workMemoViewV167')).toBeVisible();
  await expect(page.locator('#workMemoViewV167 .work-memo-card-v167').first().locator('h4')).toHaveText('古い業務メモ');
});
