import { test, expect } from '@playwright/test';

const ROOM = 'test-saved-views-polling-v334';

async function boot(page) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '土屋']));
    localStorage.setItem(`system-task-layout:${room}`, 'tasks');

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
  }, { room: ROOM });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.dependencyState?.() === 'local-only', undefined, { timeout: 10_000 });
}

test('Ver.334 product: saved-view metadata follows canonical filter save without owned polling', async ({ page }) => {
  await boot(page);

  await page.locator('.nav-item[data-layout="tasks"]').click();
  await expect(page.locator('#saveCurrentFilter')).toBeVisible();

  const listButton = page.locator('[data-task-layout="list"]');
  if (await listButton.count()) await listButton.click();
  await page.locator('#sortSelect').selectOption('priority');

  const columnSort = { key: 'priority', direction: 'desc' };
  await page.evaluate(({ room, columnSort }) => {
    localStorage.setItem(`work-board-list-column-sort:${room}`, JSON.stringify(columnSort));
    window.prompt = () => 'Ver.334 保存ビュー';
  }, { room: ROOM, columnSort });

  const before = await page.evaluate(room => {
    const value = JSON.parse(localStorage.getItem(`system-task-saved-filters:${room}`) || '[]');
    return (Array.isArray(value) ? value : []).map(item => String(item?.id || '')).filter(Boolean);
  }, ROOM);
  await page.locator('#saveCurrentFilter').click();

  await expect.poll(async () => page.evaluate(({ room, before }) => {
    const value = JSON.parse(localStorage.getItem(`system-task-saved-filters:${room}`) || '[]');
    const ids = (Array.isArray(value) ? value : []).map(item => String(item?.id || '')).filter(Boolean);
    return ids.find(id => !before.includes(id)) || '';
  }, { room: ROOM, before }), { timeout: 5_000 }).not.toBe('');

  const createdId = await page.evaluate(({ room, before }) => {
    const value = JSON.parse(localStorage.getItem(`system-task-saved-filters:${room}`) || '[]');
    const ids = (Array.isArray(value) ? value : []).map(item => String(item?.id || '')).filter(Boolean);
    return ids.find(id => !before.includes(id)) || '';
  }, { room: ROOM, before });
  expect(createdId).not.toBe('');

  await expect.poll(async () => page.evaluate(id => {
    const view = window.WorkBoardWorkflowV148?.workflow?.savedViews?.[id];
    return view ? { taskLayout: view.taskLayout || '', columnSort: view.columnSort || null } : null;
  }, createdId), { timeout: 5_000 }).toEqual({ taskLayout: 'list', columnSort });

  const runtime = await page.evaluate(() => ({
    ownedIntervals: window.__v334SavedViewIntervals || [],
    release: String(window.WORK_BOARD_RELEASE?.version || '')
  }));
  expect(runtime.ownedIntervals).toEqual([]);
  expect(Number(runtime.release)).toBeGreaterThanOrEqual(284);
});
