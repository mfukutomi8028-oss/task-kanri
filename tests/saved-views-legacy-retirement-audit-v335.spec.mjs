import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-saved-views-retirement-v335';

const CANDIDATE = `// Ver.335 audit candidate: retain only active primary-sort persistence.
(function installSavedViewsV229() {
  const W = window.WorkBoardWorkflowV148;
  if (!W) return;

  const baseSortKey = \`work-board-base-sort:\${W.ROOM_ID}\`;
  const VALID_BASE_SORTS = new Set(['smart', 'due', 'updated', 'priority']);

  function currentBaseSort() {
    const select = document.getElementById('sortSelect');
    return select && VALID_BASE_SORTS.has(select.value) ? select.value : '';
  }
  function persistBaseSort() {
    const value = currentBaseSort();
    if (value) localStorage.setItem(baseSortKey, value);
  }
  function restoreBaseSort() {
    const select = document.getElementById('sortSelect');
    if (!select) return false;
    const saved = localStorage.getItem(baseSortKey) || '';
    if (VALID_BASE_SORTS.has(saved) && select.value !== saved) {
      select.value = saved;
      select.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return true;
  }
  function handleBaseSortEvent(event) {
    if (event.target?.matches?.('#sortSelect')) persistBaseSort();
  }

  document.addEventListener('input', handleBaseSortEvent, true);
  document.addEventListener('change', handleBaseSortEvent, true);
  function start() { restoreBaseSort(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
`;

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
    window.__v335SavedViewIntervals = [];
    window.setInterval = (callback, delay, ...args) => {
      const stack = String(new Error().stack || '');
      if (Number(delay) === 250 && stack.includes('saved-views-v148.js')) {
        window.__v335SavedViewIntervals.push({ delay: Number(delay), stack });
      }
      return nativeSetInterval(callback, delay, ...args);
    };

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room, baseSort });

  await page.route(/saved-views-v148\.js(?:\?.*)?$/, route => route.fulfill({
    status: 200,
    contentType: 'application/javascript; charset=utf-8',
    body: CANDIDATE
  }));
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV148?.dependencyState?.() === 'local-only', undefined, { timeout: 10_000 });
  return { room };
}

async function ownedIntervals(page) {
  return page.evaluate(() => window.__v335SavedViewIntervals?.length || 0);
}

test('Ver.335 audit: legacy saved-filter bridge can be removed while primary sort restore/persist remains live', async ({ page }) => {
  const { room } = await boot(page, 'primary-sort', { baseSort: 'updated' });

  await expect(page.locator('#saveCurrentFilter, #savedFilterList, [data-apply-filter], [data-delete-filter]')).toHaveCount(0);
  await page.locator('.nav-item[data-layout="tasks"]').click();
  await page.evaluate(() => document.querySelector('[data-task-layout="list"]')?.click());
  await expect(page.locator('#sortSelect')).toHaveValue('updated');
  expect(await ownedIntervals(page)).toBe(0);

  await page.locator('#sortSelect').selectOption('due');
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-base-sort:${roomId}`), room)).toBe('due');
  await page.locator('#sortSelect').selectOption('priority');
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-base-sort:${roomId}`), room)).toBe('priority');
  expect(await ownedIntervals(page)).toBe(0);
});

test('Ver.335 audit: candidate survives reload and restores the last primary sort without legacy bridge helpers', async ({ page }) => {
  const { room } = await boot(page, 'reload', { baseSort: 'smart' });

  await page.locator('.nav-item[data-layout="tasks"]').click();
  await page.evaluate(() => document.querySelector('[data-task-layout="list"]')?.click());
  await expect(page.locator('#sortSelect')).toHaveValue('smart');

  await page.locator('#sortSelect').selectOption('due');
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-base-sort:${roomId}`), room)).toBe('due');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.locator('.nav-item[data-layout="tasks"]').click();
  await page.evaluate(() => document.querySelector('[data-task-layout="list"]')?.click());
  await expect(page.locator('#sortSelect')).toHaveValue('due');
  await expect(page.locator('#saveCurrentFilter, #savedFilterList, [data-apply-filter], [data-delete-filter]')).toHaveCount(0);
  expect(await ownedIntervals(page)).toBe(0);
});
