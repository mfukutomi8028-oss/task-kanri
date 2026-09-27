import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-shell-board-observer-semantic-v302';

async function installInstrumentation(page, { width = 430 } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
      {
        id: 'v302-task-1',
        title: 'V302 seeded task',
        status: '未着手',
        assignee: '福冨',
        priority: '中',
        category: 'PC',
        description: '',
        dueDate: '',
        tags: []
      }
    ]));
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
    window.__WB_BOARD_OBSERVER_V302__ = { patches: 0 };
  }, { room: ROOM });

  await page.route(/\/mobile-shell-v234\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    let body = await response.text();
    const needle = '  function patchMobileBoardTabs() {';
    if (!body.includes(needle)) throw new Error('Ver.302 patchMobileBoardTabs instrumentation point not found');
    body = body.replace(needle, `${needle}\n    if (window.__WB_BOARD_OBSERVER_V302__) window.__WB_BOARD_OBSERVER_V302__.patches += 1;`);
    await route.fulfill({ response, body });
  });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function activateLayout(page, layout) {
  const nav = page.locator(`.nav-item[data-layout="${layout}"]`).first();
  await expect(nav).toHaveCount(1);
  await nav.evaluate(element => element.click());
}

async function waitForRelease(page) {
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === '272', undefined, { timeout: 8_000 });
}

async function resetPatches(page) {
  await page.evaluate(() => { window.__WB_BOARD_OBSERVER_V302__.patches = 0; });
}

async function patchCount(page) {
  return page.evaluate(() => window.__WB_BOARD_OBSERVER_V302__.patches);
}

async function statusTabTexts(page) {
  return page.locator('.work-mobile-status-tabs button').allTextContents();
}

async function bootBoard(page, options = {}) {
  await installInstrumentation(page, options);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await waitForRelease(page);
  await activateLayout(page, 'tasks');
  await expect(page.locator('#boardView .task-card').filter({ hasText: 'V302 seeded task' })).toHaveCount(1);
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await expect(page.locator('#boardView .work-mobile-active-column')).toHaveCount(1);
  await page.waitForTimeout(120);
  await resetPatches(page);
}

test('Ver.302 product: unrelated direct child does not schedule board-tab reconciliation', async ({ page }) => {
  await bootBoard(page);
  const beforeTabs = await statusTabTexts(page);

  await page.evaluate(() => {
    const noise = document.createElement('span');
    noise.dataset.v302DirectNoise = 'true';
    noise.hidden = true;
    document.getElementById('boardView')?.appendChild(noise);
  });
  await page.waitForTimeout(120);

  expect(await patchCount(page)).toBe(0);
  expect(await statusTabTexts(page)).toEqual(beforeTabs);
  await expect(page.locator('#boardView .work-mobile-active-column')).toHaveCount(1);
});

test('Ver.302 product: canonical filtered redraw still updates counts and active column', async ({ page }) => {
  await bootBoard(page);
  expect((await statusTabTexts(page)).some(text => /未着手/.test(text) && /1/.test(text))).toBeTruthy();

  await page.locator('#searchInput').fill('no-match-v302');
  await expect(page.locator('#boardView .task-card')).toHaveCount(0);
  await expect.poll(() => patchCount(page)).toBeGreaterThan(0);
  await expect.poll(async () => (await statusTabTexts(page)).some(text => /未着手/.test(text) && /0/.test(text))).toBeTruthy();
  await expect(page.locator('#boardView .work-mobile-active-column')).toHaveCount(1);

  await resetPatches(page);
  await page.locator('#searchInput').fill('');
  await expect(page.locator('#boardView .task-card').filter({ hasText: 'V302 seeded task' })).toHaveCount(1);
  await expect.poll(() => patchCount(page)).toBeGreaterThan(0);
  await expect.poll(async () => (await statusTabTexts(page)).some(text => /未着手/.test(text) && /1/.test(text))).toBeTruthy();
});

test('Ver.302 product: Tasks to Today to Tasks reconstruction remains intact', async ({ page }) => {
  await bootBoard(page);
  await activateLayout(page, 'today');
  await expect(page.locator('#todayView')).toBeVisible();
  await expect(page.locator('.work-mobile-status-tabs')).toHaveCount(0);

  await activateLayout(page, 'tasks');
  await expect(page.locator('#boardView .task-card').filter({ hasText: 'V302 seeded task' })).toHaveCount(1);
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await expect(page.locator('#boardView .work-mobile-active-column')).toHaveCount(1);
  expect((await statusTabTexts(page)).some(text => /未着手/.test(text) && /1/.test(text))).toBeTruthy();
});

test('Ver.302 product: 861 to 860 late-load boundary remains intact', async ({ page }) => {
  await installInstrumentation(page, { width: 861 });
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await waitForRelease(page);
  await expect(page.locator('#workMobileHeader')).toHaveCount(0);

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  await activateLayout(page, 'tasks');
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await expect(page.locator('#boardView .work-mobile-active-column')).toHaveCount(1);
  expect((await statusTabTexts(page)).some(text => /未着手/.test(text) && /1/.test(text))).toBeTruthy();
});
