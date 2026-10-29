import { test, expect } from '@playwright/test';

// All fixtures are local to isolated test rooms; no production Firebase writes.
async function boot(page, room, { historical = [], memos = null } = {}) {
  await page.addInitScript(({ room, historical, memos }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('system-task-users:' + room, JSON.stringify(['福冨']));
    if (historical.length) localStorage.setItem('system-task-todos:' + room, JSON.stringify(historical));
    if (memos) localStorage.setItem('system-business-memos:' + room, JSON.stringify(memos));
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get() { return null; }, set() {}
    });
  }, { room, historical, memos });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
  await page.goto('/?room=' + room, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
}

function boxesIntersect(a, b) {
  return a.left < b.right - 1 && a.right > b.left + 1 &&
    a.top < b.bottom - 1 && a.bottom > b.top + 1;
}

for (const width of [1366, 390]) {
  test('Ver.532 ToDo completion button does not cover the title at width ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await boot(page, 'test-v532-todo-' + width);
    await page.locator('#todayView [data-layout-jump="todos"]').first().click();
    await page.locator('#todayTodoInput').fill('完了ボタンに隠れてはいけない検証用ToDo');
    await page.locator('.todo-create-form [type="submit"]').click();
    const row = page.locator('#todoView .todo-list:not(.is-completed) [data-todo-id]').first();
    const button = row.locator('.todo-state-toggle-v144');
    const title = row.locator('.todo-summary-button .todo-text');
    await expect(button).toBeVisible();
    await expect(title).toContainText('検証用ToDo');
    const layout = await row.evaluate(node => {
      const a = node.querySelector('.todo-state-toggle-v144').getBoundingClientRect();
      const b = node.querySelector('.todo-summary-button .todo-text').getBoundingClientRect();
      return { button: { left: a.left, right: a.right, top: a.top, bottom: a.bottom },
        title: { left: b.left, right: b.right, top: b.top, bottom: b.bottom }, titleWidth: b.width };
    });
    expect(layout.titleWidth).toBeGreaterThan(70);
    expect(boxesIntersect(layout.button, layout.title)).toBe(false);
    await expect(row.locator('.todo-move-button')).toHaveCount(2);
  });
}

for (const width of [1366, 390]) {
  test('Ver.532 archived ToDo title and memo are readable at width ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const now = Date.now();
    const historical = [{
      id: 'archived-v532', owner: '福冨', text: '保存した重要な作業の名称',
      memo: '担当者への引き継ぎ内容を保持する',
      completed: true, completedAt: now - 9 * 86400000,
      createdAt: now - 10 * 86400000, updatedAt: now - 9 * 86400000,
      order: 0, revision: 1
    }];
    await boot(page, 'test-v532-history-' + width, { historical });
    await page.locator('#todayView [data-layout-jump="todos"]').first().click();
    const row = page.locator('.todo-history-v146 .todo-history-item-v146');
    await expect(row).toHaveCount(1);
    await page.locator('.todo-history-toggle-v146').click();
    const title = row.locator('.todo-history-title-row-v146 .todo-text');
    const memo = row.locator('.todo-history-memo-v146');
    await expect(title).toBeVisible();
    await expect(title).toContainText('保存した重要な作業の名称');
    await expect(memo).toContainText('担当者への引き継ぎ内容');
    const layout = await row.evaluate(node => {
      const main = node.querySelector('.todo-history-main-v146').getBoundingClientRect();
      const title = node.querySelector('.todo-history-title-row-v146 .todo-text').getBoundingClientRect();
      const date = node.querySelector('.todo-history-date-v146').getBoundingClientRect();
      return {
        mainWidth: main.width, titleWidth: title.width,
        title: { left: title.left, right: title.right, top: title.top, bottom: title.bottom },
        date: { left: date.left, right: date.right, top: date.top, bottom: date.bottom }
      };
    });
    expect(layout.mainWidth).toBeGreaterThan(120);
    expect(layout.titleWidth).toBeGreaterThan(80);
    expect(boxesIntersect(layout.title, layout.date)).toBe(false);
  });
}

test('Ver.532 memo card displays the full text with an independently scrollable viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const body = '問い合わせ先と作業手順\n' +
    Array.from({ length: 35 }, (_, i) => '手順' + i + '：共有する際の確認内容を記録する。').join('\n') +
    '\n末尾の重要情報を必ず読めること';
  const memos = {
    memoLong: { id: 'memoLong', title: '長い手順メモ', body, category: '定型情報',
      revision: 1, updatedAt: 2000, pinned: false }
  };
  await boot(page, 'test-v532-long-memo', { memos });
  await expect(page.locator('[data-work-memo-layout]')).toBeAttached();
  await page.locator('[data-work-memo-layout]').click();
  const pre = page.locator('#workMemoViewV167 .work-memo-body-v167');
  await expect(pre).toHaveCount(1);
  // The feature view is mounted while hidden; wait for navigation to settle
  // before measuring layout, without relaxing scroll/content assertions.
  await expect(page.locator('body')).toHaveClass(/work-memo-mode-v167/);
  await expect(page.locator('#workMemoViewV167')).toBeVisible();
  await expect(pre).toBeVisible();
  await expect(pre).toContainText('末尾の重要情報を必ず読めること');
  await expect(pre).toHaveAttribute('tabindex', '0');
  const metrics = await pre.evaluate(el => ({
    text: el.textContent, client: el.clientHeight, scroll: el.scrollHeight,
    overflow: getComputedStyle(el).overflowY
  }));
  expect(metrics.text).toBe(body);
  expect(metrics.scroll).toBeGreaterThan(metrics.client + 25);
  expect(metrics.overflow).toBe('auto');
  const moved = await pre.evaluate(el => { el.scrollTop = el.scrollHeight; return el.scrollTop; });
  expect(moved).toBeGreaterThan(0);
});
