import { test, expect } from '@playwright/test';

const ROOM = 'test-saved-views-polling-v334';

async function installState(page, { baseSort = '' } = {}) {
  await page.addInitScript(({ room, baseSort }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '土屋']));
    localStorage.setItem(`system-task-layout:${room}`, 'tasks');
    if (baseSort) localStorage.setItem(`work-board-base-sort:${room}`, baseSort);

    const nativeSetInterval = window.setInterval.bind(window);
    window.__v334SavedViewIntervals = [];
    window.setInterval = (callback, delay, ...args) => {
      const stack = String(new Error().stack || '');
      if (stack.includes('saved-views-v148.js')) {
        window.__v334SavedViewIntervals.push({ delay: Number(delay), stack });
      }
      return nativeSetInterval(callback, delay, ...args);
    };

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM, baseSort });
}

async function boot(page, options = {}) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await installState(page, options);
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.dependencyState?.() === 'local-only', undefined, { timeout: 10_000 });
  await page.locator('.nav-item[data-layout="tasks"]').click();
}

test('Ver.334 product: active saved-view sidecar keeps primary sort persistence with no owned polling', async ({ page }) => {
  await boot(page);

  // The legacy saved-filter create/list controls are not part of the current product DOM.
  await expect(page.locator('#saveCurrentFilter')).toHaveCount(0);
  await expect(page.locator('#savedFilterList')).toHaveCount(0);

  await page.locator('#sortSelect').selectOption('priority');
  await expect.poll(() => page.evaluate(room => localStorage.getItem(`work-board-base-sort:${room}`), ROOM)).toBe('priority');

  const runtime = await page.evaluate(() => ({
    ownedIntervals: window.__v334SavedViewIntervals || [],
    release: String(window.WORK_BOARD_RELEASE?.version || '')
  }));
  expect(runtime.ownedIntervals).toEqual([]);
  expect(Number(runtime.release)).toBeGreaterThanOrEqual(284);
});

test('Ver.334 product: saved-view sidecar still restores the persisted primary sort on boot', async ({ page }) => {
  await boot(page, { baseSort: 'updated' });
  await expect(page.locator('#sortSelect')).toHaveValue('updated');
  expect(await page.evaluate(() => window.__v334SavedViewIntervals || [])).toEqual([]);
});
