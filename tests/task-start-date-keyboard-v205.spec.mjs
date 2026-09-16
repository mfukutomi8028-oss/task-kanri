import { test, expect } from '@playwright/test';

const ROOM = 'test-task-start-date-keyboard-v205';

async function boot(page) {
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

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
}

test('dynamically added task start date uses the same segmented keyboard entry as due date', async ({ page }) => {
  await boot(page);

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await page.evaluate(() => document.getElementById('newTask')?.click());
  await expect(page.locator('#taskDialog')).toBeVisible();

  const startDate = page.locator('#taskStartDateV167');
  await expect(startDate).toHaveAttribute('data-date-segment-v127', 'true');

  const startWrapper = startDate.locator('xpath=..');
  await expect(startWrapper).toHaveClass(/date-segment-control-v127/);
  await expect(startWrapper.locator('.date-segment-picker-v127')).toHaveCount(1);

  await startWrapper.getByLabel('開始日 年').fill('2026');
  await startWrapper.getByLabel('開始日 月').fill('09');
  await startWrapper.getByLabel('開始日 日').fill('30');

  await expect(startDate).toHaveValue('2026-09-30');

  const dueDate = page.locator('#taskDueDate');
  const dueWrapper = dueDate.locator('xpath=..');
  await expect(dueWrapper).toHaveClass(/date-segment-control-v127/);
  await expect(dueWrapper.locator('.date-segment-picker-v127')).toHaveCount(1);
});