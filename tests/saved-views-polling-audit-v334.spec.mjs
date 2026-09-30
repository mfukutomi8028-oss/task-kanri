import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-saved-views-polling-v334';

async function boot(page, suffix, { baseSort = 'priority' } = {}) {
  const room = `${ROOM_PREFIX}-${suffix}`;
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(({ room, baseSort }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '土屋']));
    localStorage.setItem(`work-board-base-sort:${room}`, baseSort);

    const nativeSetInterval = window.setInterval.bind(window);
    window.__v334SavedViewIntervals = [];
    window.setInterval = (callback, delay, ...args) => {
      const stack = String(new Error().stack || '');
      if (Number(delay) === 250 && stack.includes('saved-views-v148.js')) {
        window.__v334SavedViewIntervals.push({ delay: Number(delay), stack });
      }
      return nativeSetInterval(callback, delay, ...args);
    };

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room, baseSort });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV148?.dependencyState?.() === 'local-only', undefined, { timeout: 10_000 });
  return { room };
}

async function ownedIntervalCount(page) {
  return page.evaluate(() => window.__v334SavedViewIntervals?.length || 0);
}

test('Ver.334 audit: current product exposes no legacy saved-filter controls and registers no saved-view polling interval', async ({ page }) => {
  await boot(page, 'unreachable');

  await expect(page.locator('#saveCurrentFilter')).toHaveCount(0);
  await expect(page.locator('#savedFilterList')).toHaveCount(0);
  await expect(page.locator('[data-apply-filter]')).toHaveCount(0);
  await expect(page.locator('[data-delete-filter]')).toHaveCount(0);
  expect(await ownedIntervalCount(page)).toBe(0);

  await page.locator('.nav-item[data-layout="tasks"]').click();
  await page.evaluate(() => document.querySelector('[data-task-layout="list"]')?.click());
  await expect(page.locator('#sortSelect')).toHaveValue('priority');
  await page.waitForTimeout(350);
  expect(await ownedIntervalCount(page)).toBe(0);

  await page.locator('#sortSelect').selectOption('due');
  await page.waitForTimeout(350);
  expect(await ownedIntervalCount(page)).toBe(0);
});

test('Ver.334 audit: active primary-sort persistence still works while the dormant saved-filter polling path stays unreachable', async ({ page }) => {
  const { room } = await boot(page, 'sort', { baseSort: 'updated' });

  await page.locator('.nav-item[data-layout="tasks"]').click();
  await page.evaluate(() => document.querySelector('[data-task-layout="list"]')?.click());
  await expect(page.locator('#sortSelect')).toHaveValue('updated');

  await page.locator('#sortSelect').selectOption('due');
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-base-sort:${roomId}`), room)).toBe('due');
  await page.locator('#sortSelect').selectOption('priority');
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-base-sort:${roomId}`), room)).toBe('priority');

  await page.waitForTimeout(350);
  expect(await ownedIntervalCount(page)).toBe(0);
  await expect(page.locator('#saveCurrentFilter, #savedFilterList, [data-apply-filter], [data-delete-filter]')).toHaveCount(0);
});
