import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-schedule-label-v203';

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
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
}

test('mobile schedule week label is owned by schedule lock after mobile duplicate retirement', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 });
  await boot(page);

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="schedule"]')?.click());
  await expect(page.locator('#scheduleView')).toBeVisible();

  const week = page.locator('#scheduleView [data-schedule-range="week"]');
  await expect(week).toHaveText('7日間');
  await expect(week).toHaveAttribute('title', '今日から7日間を表示します');

  await page.evaluate(() => {
    const button = document.querySelector('#scheduleView [data-schedule-range="week"]');
    if (!button) throw new Error('week range button not found');
    button.textContent = '週表示';
    button.title = 'broken';
  });

  await expect(week).toHaveText('7日間');
  await expect(week).toHaveAttribute('title', '今日から7日間を表示します');

  const mobileSource = await page.evaluate(async () => {
    const response = await fetch('./mobile-fixes.js', { cache: 'no-store' });
    return response.text();
  });
  expect(mobileSource).not.toContain('patchScheduleRangeButtons');
});
