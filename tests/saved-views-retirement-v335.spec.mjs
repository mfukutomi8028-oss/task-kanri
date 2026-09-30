import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-saved-views-retirement-v335';

async function boot(page, suffix, { baseSort = 'priority' } = {}) {
  const room = `${ROOM_PREFIX}-${suffix}`;
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(({ room, baseSort }) => {
    const seedMarker = `v335-seeded:${room}`;
    if (!sessionStorage.getItem(seedMarker)) {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
      localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '土屋']));
      localStorage.setItem(`work-board-base-sort:${room}`, baseSort);
      sessionStorage.setItem(seedMarker, '1');
    }

    window.__v335SavedViewsRuntime = {
      ownedIntervals: 0,
      ownedTimeouts: 0,
      ownedObservers: 0
    };

    const nativeSetInterval = window.setInterval.bind(window);
    window.setInterval = (callback, delay, ...args) => {
      const stack = String(new Error().stack || '');
      if (stack.includes('saved-views-v148.js')) window.__v335SavedViewsRuntime.ownedIntervals += 1;
      return nativeSetInterval(callback, delay, ...args);
    };

    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => {
      const stack = String(new Error().stack || '');
      if (stack.includes('saved-views-v148.js')) window.__v335SavedViewsRuntime.ownedTimeouts += 1;
      return nativeSetTimeout(callback, delay, ...args);
    };

    const NativeMutationObserver = window.MutationObserver;
    window.MutationObserver = class MutationObserver extends NativeMutationObserver {
      constructor(callback) {
        const stack = String(new Error().stack || '');
        if (stack.includes('saved-views-v148.js')) window.__v335SavedViewsRuntime.ownedObservers += 1;
        super(callback);
      }
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

async function runtimeCounts(page) {
  return page.evaluate(() => ({ ...window.__v335SavedViewsRuntime }));
}

test('Ver.335 product: saved views runtime has no dormant observer/timer registrations', async ({ page }) => {
  await boot(page, 'runtime');

  await expect(page.locator('#saveCurrentFilter, #savedFilterList, [data-apply-filter], [data-delete-filter]')).toHaveCount(0);
  expect(await runtimeCounts(page)).toEqual({ ownedIntervals: 0, ownedTimeouts: 0, ownedObservers: 0 });

  await page.locator('.nav-item[data-layout="tasks"]').click();
  await page.evaluate(() => document.querySelector('[data-task-layout="list"]')?.click());
  await expect(page.locator('#sortSelect')).toHaveValue('priority');
  await page.locator('#sortSelect').selectOption('due');
  expect(await runtimeCounts(page)).toEqual({ ownedIntervals: 0, ownedTimeouts: 0, ownedObservers: 0 });
});

test('Ver.335 product: primary sort persists and restores after reload', async ({ page }) => {
  const { room } = await boot(page, 'persist', { baseSort: 'updated' });

  await page.locator('.nav-item[data-layout="tasks"]').click();
  await page.evaluate(() => document.querySelector('[data-task-layout="list"]')?.click());
  await expect(page.locator('#sortSelect')).toHaveValue('updated');

  await page.locator('#sortSelect').selectOption('due');
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-base-sort:${roomId}`), room)).toBe('due');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.locator('.nav-item[data-layout="tasks"]').click();
  await page.evaluate(() => document.querySelector('[data-task-layout="list"]')?.click());
  await expect(page.locator('#sortSelect')).toHaveValue('due');
  expect(await runtimeCounts(page)).toEqual({ ownedIntervals: 0, ownedTimeouts: 0, ownedObservers: 0 });
});
