import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-shell-board-observer-v299';

async function installAudit(page, { directChildOnly = false } = {}) {
  await page.setViewportSize({ width: 430, height: 900 });
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
      {
        id: 'v299-task-1',
        title: 'V299 seeded task',
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
    window.__WB_BOARD_OBSERVER_V299__ = {
      callbacks: 0,
      records: 0,
      patches: 0
    };
  }, { room: ROOM });

  await page.route(/\/mobile-shell-v234\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    let body = await response.text();

    const patchNeedle = '  function patchMobileBoardTabs() {';
    if (!body.includes(patchNeedle)) throw new Error('Ver.299 patchMobileBoardTabs injection point not found');
    body = body.replace(patchNeedle, `${patchNeedle}\n    if (window.__WB_BOARD_OBSERVER_V299__) window.__WB_BOARD_OBSERVER_V299__.patches += 1;`);

    const observerNeedle = '    new MutationObserver(scheduleBoardTabs).observe(boardView, { childList: true, subtree: true });';
    if (!body.includes(observerNeedle)) throw new Error('Ver.299 board observer injection point not found');
    const options = directChildOnly ? '{ childList: true }' : '{ childList: true, subtree: true }';
    body = body.replace(observerNeedle, `    new MutationObserver(records => {\n      const audit = window.__WB_BOARD_OBSERVER_V299__;\n      if (audit) { audit.callbacks += 1; audit.records += records.length; }\n      scheduleBoardTabs();\n    }).observe(boardView, ${options});`);

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

async function bootBoard(page, options) {
  await installAudit(page, options);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === '270', undefined, { timeout: 8_000 });
  await activateLayout(page, 'tasks');
  await expect(page.locator('#boardView .board-column').first()).toBeVisible();
  await expect(page.locator('#boardView .task-card').filter({ hasText: 'V299 seeded task' })).toHaveCount(1);
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await page.waitForTimeout(120);
  await resetAudit(page);
}

async function resetAudit(page) {
  await page.evaluate(() => {
    Object.assign(window.__WB_BOARD_OBSERVER_V299__, { callbacks: 0, records: 0, patches: 0 });
  });
}

async function auditSnapshot(page) {
  return page.evaluate(() => ({ ...window.__WB_BOARD_OBSERVER_V299__ }));
}

async function statusTabTexts(page) {
  return page.locator('.work-mobile-status-tabs button').allTextContents();
}

test('Ver.299 audit: current subtree observer wakes for irrelevant task-card descendant mutation', async ({ page }) => {
  await bootBoard(page, { directChildOnly: false });
  const beforeTabs = await statusTabTexts(page);

  await page.evaluate(() => {
    const card = document.querySelector('#boardView .task-card');
    const noise = document.createElement('span');
    noise.dataset.v299Noise = 'true';
    noise.hidden = true;
    card?.appendChild(noise);
  });
  await page.waitForTimeout(100);

  const after = await auditSnapshot(page);
  const afterTabs = await statusTabTexts(page);
  expect(after.callbacks).toBeGreaterThan(0);
  expect(after.records).toBeGreaterThan(0);
  expect(after.patches).toBeGreaterThan(0);
  expect(afterTabs).toEqual(beforeTabs);
});

test('Ver.299 audit: direct-child candidate ignores descendant noise but preserves canonical filtered redraw counts', async ({ page }) => {
  await bootBoard(page, { directChildOnly: true });
  const beforeTabs = await statusTabTexts(page);
  expect(beforeTabs.some(text => /未着手/.test(text) && /1/.test(text))).toBeTruthy();

  await page.evaluate(() => {
    const card = document.querySelector('#boardView .task-card');
    const noise = document.createElement('span');
    noise.dataset.v299Noise = 'true';
    noise.hidden = true;
    card?.appendChild(noise);
  });
  await page.waitForTimeout(100);
  expect(await auditSnapshot(page)).toEqual({ callbacks: 0, records: 0, patches: 0 });
  expect(await statusTabTexts(page)).toEqual(beforeTabs);

  await page.locator('#searchInput').fill('no-match-v299');
  await expect(page.locator('#boardView .task-card')).toHaveCount(0);
  await expect.poll(async () => (await auditSnapshot(page)).callbacks).toBeGreaterThan(0);
  await expect.poll(async () => (await statusTabTexts(page)).some(text => /未着手/.test(text) && /0/.test(text))).toBeTruthy();

  await resetAudit(page);
  await page.locator('#searchInput').fill('');
  await expect(page.locator('#boardView .task-card').filter({ hasText: 'V299 seeded task' })).toHaveCount(1);
  await expect.poll(async () => (await auditSnapshot(page)).callbacks).toBeGreaterThan(0);
  await expect.poll(async () => (await statusTabTexts(page)).some(text => /未着手/.test(text) && /1/.test(text))).toBeTruthy();
});

test('Ver.299 audit: direct-child candidate preserves navigation away/back board reconstruction', async ({ page }) => {
  await bootBoard(page, { directChildOnly: true });
  await resetAudit(page);

  await activateLayout(page, 'today');
  await expect(page.locator('#todayView')).toBeVisible();
  await expect(page.locator('.work-mobile-status-tabs')).toHaveCount(0);

  await activateLayout(page, 'tasks');
  await expect(page.locator('#boardView .task-card').filter({ hasText: 'V299 seeded task' })).toHaveCount(1);
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await expect.poll(async () => (await auditSnapshot(page)).callbacks).toBeGreaterThan(0);
  expect((await statusTabTexts(page)).some(text => /未着手/.test(text) && /1/.test(text))).toBeTruthy();
});
