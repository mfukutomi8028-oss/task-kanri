import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-saved-views-polling-v334';

async function boot(page, suffix) {
  const room = `${ROOM_PREFIX}-${suffix}`;
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '土屋']));

    const nativeSetInterval = window.setInterval.bind(window);
    window.__v334SavedViewIntervals = [];
    window.setInterval = (callback, delay, ...args) => {
      const stack = String(new Error().stack || '');
      const owned = Number(delay) === 250 && stack.includes('saved-views-v148.js');
      if (owned) {
        const key = `system-task-saved-filters:${room}`;
        let current = [];
        try { current = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) {}
        const record = {
          delay: Number(delay),
          stack,
          callbacks: 0,
          suppressed: true,
          idsAtRegistration: (Array.isArray(current) ? current : []).map(item => String(item?.id || '')).filter(Boolean),
          callback
        };
        window.__v334SavedViewIntervals.push(record);
        return 934400 + window.__v334SavedViewIntervals.length;
      }
      return nativeSetInterval(callback, delay, ...args);
    };

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV148?.dependencyState?.() === 'local-only', undefined, { timeout: 10_000 });
  await expect(page.locator('#saveCurrentFilter')).toBeVisible();
  return { room };
}

async function savedFilters(page, room) {
  return page.evaluate(({ room }) => {
    try {
      const value = JSON.parse(localStorage.getItem(`system-task-saved-filters:${room}`) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }, { room });
}

async function invokeOwnedPoll(page, index = 0) {
  return page.evaluate(async ({ index }) => {
    const record = window.__v334SavedViewIntervals?.[index];
    if (!record) throw new Error('Ver.334 saved-views interval not captured');
    record.callbacks += 1;
    return record.callback();
  }, { index });
}

test('Ver.334 audit: the first saved-view poll is sufficient because the canonical filter id already exists before polling starts', async ({ page }) => {
  const { room } = await boot(page, 'success');

  page.once('dialog', dialog => dialog.accept('Ver.334 保存ビュー監査'));
  await page.locator('#saveCurrentFilter').click();

  await expect.poll(async () => (await savedFilters(page, room)).length).toBe(1);
  await page.waitForFunction(() => window.__v334SavedViewIntervals?.length === 1, undefined, { timeout: 5_000 });

  const [filter] = await savedFilters(page, room);
  expect(filter.name).toBe('Ver.334 保存ビュー監査');

  const registration = await page.evaluate(() => {
    const record = window.__v334SavedViewIntervals?.[0];
    return {
      delay: record?.delay,
      callbacks: record?.callbacks,
      suppressed: record?.suppressed,
      idsAtRegistration: record?.idsAtRegistration || [],
      workflowHasView: Boolean(window.WorkBoardWorkflowV148?.workflow?.savedViews?.[record?.idsAtRegistration?.[0]])
    };
  });

  expect(registration.delay).toBe(250);
  expect(registration.callbacks).toBe(0);
  expect(registration.suppressed).toBe(true);
  expect(registration.idsAtRegistration).toContain(filter.id);
  expect(registration.workflowHasView).toBe(false);

  // This is the same callback the real interval would run at 250ms. One invocation
  // must be enough to bridge the canonical saved-filter id into workflow metadata.
  await invokeOwnedPoll(page);
  await expect.poll(async () => page.evaluate(({ id }) => {
    const view = window.WorkBoardWorkflowV148?.workflow?.savedViews?.[id];
    return view ? { taskLayout: view.taskLayout, hasUpdatedAt: Number(view.updatedAt || 0) > 0 } : null;
  }, { id: filter.id })).toEqual({ taskLayout: 'board', hasUpdatedAt: true });

  expect(await page.evaluate(() => window.__v334SavedViewIntervals?.[0]?.callbacks || 0)).toBe(1);
});

test('Ver.334 audit: cancelled save has no id at timer registration, so bounded retry only performs empty wakeups', async ({ page }) => {
  const { room } = await boot(page, 'cancel');

  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#saveCurrentFilter').click();
  await page.waitForFunction(() => window.__v334SavedViewIntervals?.length === 1, undefined, { timeout: 5_000 });

  expect(await savedFilters(page, room)).toEqual([]);
  expect(await page.evaluate(() => ({
    callbacks: window.__v334SavedViewIntervals?.[0]?.callbacks || 0,
    idsAtRegistration: window.__v334SavedViewIntervals?.[0]?.idsAtRegistration || []
  }))).toEqual({ callbacks: 0, idsAtRegistration: [] });

  for (let i = 0; i < 24; i += 1) await invokeOwnedPoll(page);

  expect(await savedFilters(page, room)).toEqual([]);
  expect(await page.evaluate(() => Object.keys(window.WorkBoardWorkflowV148?.workflow?.savedViews || {}))).toEqual([]);
  expect(await page.evaluate(() => window.__v334SavedViewIntervals?.[0]?.callbacks || 0)).toBe(24);
});
