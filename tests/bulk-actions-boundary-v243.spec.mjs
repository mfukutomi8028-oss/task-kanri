import { test, expect } from '@playwright/test';

const ROOM = 'test-bulk-actions-product-v243';

async function installSafetyBoundary(page) {
  await page.addInitScript(({ room }) => {
    try {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
    } catch {}
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page) {
  const sidecarRequests = [];
  const retiredRequests = [];
  page.on('request', request => {
    try {
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith('/bulk-actions-v243.js')) sidecarRequests.push(request.url());
      if (pathname.endsWith('/bulk-actions-v174.js')) retiredRequests.push(request.url());
    } catch {}
  });

  await page.setViewportSize({ width: 1366, height: 900 });
  await installSafetyBoundary(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => String(window.WORK_BOARD_RELEASE?.version || '') === '243', undefined, { timeout: 8_000 });
  return { sidecarRequests, retiredRequests };
}

async function openList(page) {
  await page.locator('.nav-item[data-layout="tasks"]').first().evaluate(button => button.click());
  await page.locator('[data-task-layout="list"]').evaluate(button => button.click());
  await expect(page.locator('#listView')).toBeVisible();
}

async function quickAdd(page, title) {
  await page.locator('#quickAddInput').fill(title);
  await page.locator('#quickAddButton').click();
  await expect(page.locator('#quickAddInput')).toHaveValue('');
}

function taskRow(page, title) {
  return page.locator('#listView tr[data-task-id]').filter({ hasText: title });
}

test('Ver.243 product: local bulk status/delete stay app-owned while only v243 runtime loads', async ({ page }) => {
  const requests = await boot(page);
  await openList(page);

  const statusTitle = '一括状態製品確認';
  const deleteTitle = '一括削除製品確認';
  await quickAdd(page, statusTitle);
  await quickAdd(page, deleteTitle);

  const statusRow = taskRow(page, statusTitle);
  const deleteRow = taskRow(page, deleteTitle);
  await expect(statusRow).toHaveCount(1);
  await expect(deleteRow).toHaveCount(1);

  await statusRow.locator('[data-bulk-id]').check();
  await page.locator('#listView [data-bulk-action]').selectOption('status');
  await expect(page.locator('#listView [data-bulk-target]')).toBeVisible();
  await page.locator('#listView [data-bulk-target]').selectOption('保留');
  await page.locator('#listView [data-bulk-apply]').click();
  await expect(taskRow(page, statusTitle)).toContainText('保留');

  const refreshedDeleteRow = taskRow(page, deleteTitle);
  await refreshedDeleteRow.locator('[data-bulk-id]').check();
  await page.locator('#listView [data-bulk-action]').selectOption('delete');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#listView [data-bulk-apply]').click();
  await expect(taskRow(page, deleteTitle)).toHaveCount(0);
  await expect(taskRow(page, statusTitle)).toHaveCount(1);

  expect(requests.sidecarRequests).toHaveLength(1);
  expect(requests.retiredRequests).toHaveLength(0);
  expect(await page.evaluate(() => window.WorkBoardBulkV243?.version || '')).toBe('243');
  expect(await page.evaluate(() => Boolean(window.__WB_BULK_DELETE_V175__))).toBe(false);
});
