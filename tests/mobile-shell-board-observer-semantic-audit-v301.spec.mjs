import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-shell-board-observer-semantic-v301';

async function installAudit(page, { semanticOnly = false, width = 430 } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
      {
        id: 'v301-task-1',
        title: 'V301 seeded task',
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
    window.__WB_BOARD_OBSERVER_V301__ = {
      callbacks: 0,
      records: 0,
      schedules: 0,
      patches: 0
    };
  }, { room: ROOM });

  await page.route(/\/mobile-shell-v234\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    let body = await response.text();

    const patchNeedle = '  function patchMobileBoardTabs() {';
    if (!body.includes(patchNeedle)) throw new Error('Ver.301 patchMobileBoardTabs injection point not found');
    body = body.replace(
      patchNeedle,
      `${patchNeedle}\n    if (window.__WB_BOARD_OBSERVER_V301__) window.__WB_BOARD_OBSERVER_V301__.patches += 1;`
    );

    const observerNeedle = '    new MutationObserver(scheduleBoardTabs).observe(boardView, { childList: true });';
    if (!body.includes(observerNeedle)) throw new Error('Ver.301 direct-child board observer not found');
    body = body.replace(observerNeedle, `    new MutationObserver(records => {
      const audit = window.__WB_BOARD_OBSERVER_V301__;
      if (audit) { audit.callbacks += 1; audit.records += records.length; }
      const hasBoardColumnChange = records.some(record =>
        [...record.addedNodes, ...record.removedNodes]
          .some(node => node.nodeType === 1 && node.matches?.(".board-column"))
      );
      if (${semanticOnly ? 'hasBoardColumnChange' : 'true'}) {
        if (audit) audit.schedules += 1;
        scheduleBoardTabs();
      }
    }).observe(boardView, { childList: true });`);

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
  await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === '271', undefined, { timeout: 8_000 });
}

async function bootBoard(page, options = {}) {
  await installAudit(page, options);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await waitForRelease(page);
  await activateLayout(page, 'tasks');
  await expect(page.locator('#boardView .board-column').first()).toBeVisible();
  await expect(page.locator('#boardView .task-card').filter({ hasText: 'V301 seeded task' })).toHaveCount(1);
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await expect(page.locator('#boardView .work-mobile-active-column')).toHaveCount(1);
  await page.waitForTimeout(120);
  await resetAudit(page);
}

async function resetAudit(page) {
  await page.evaluate(() => {
    Object.assign(window.__WB_BOARD_OBSERVER_V301__, {
      callbacks: 0,
      records: 0,
      schedules: 0,
      patches: 0
    });
  });
}

async function auditSnapshot(page) {
  return page.evaluate(() => ({ ...window.__WB_BOARD_OBSERVER_V301__ }));
}

async function statusTabTexts(page) {
  return page.locator('.work-mobile-status-tabs button').allTextContents();
}

async function appendDirectNoise(page) {
  await page.evaluate(() => {
    const board = document.getElementById('boardView');
    const noise = document.createElement('span');
    noise.dataset.v301DirectNoise = 'true';
    noise.hidden = true;
    board?.appendChild(noise);
  });
}

test('Ver.301 audit: current direct-child observer schedules a patch for unrelated direct-child noise', async ({ page }) => {
  await bootBoard(page, { semanticOnly: false });
  const beforeTabs = await statusTabTexts(page);

  await appendDirectNoise(page);
  await page.waitForTimeout(100);

  const after = await auditSnapshot(page);
  expect(after.callbacks).toBeGreaterThan(0);
  expect(after.records).toBeGreaterThan(0);
  expect(after.schedules).toBeGreaterThan(0);
  expect(after.patches).toBeGreaterThan(0);
  expect(await statusTabTexts(page)).toEqual(beforeTabs);
  await expect(page.locator('#boardView .work-mobile-active-column')).toHaveCount(1);
});

test('Ver.301 audit: semantic candidate ignores direct-child noise and preserves canonical filtered redraw counts', async ({ page }) => {
  await bootBoard(page, { semanticOnly: true });
  const beforeTabs = await statusTabTexts(page);
  expect(beforeTabs.some(text => /未着手/.test(text) && /1/.test(text))).toBeTruthy();

  await appendDirectNoise(page);
  await page.waitForTimeout(100);

  const afterNoise = await auditSnapshot(page);
  expect(afterNoise.callbacks).toBeGreaterThan(0);
  expect(afterNoise.records).toBeGreaterThan(0);
  expect(afterNoise.schedules).toBe(0);
  expect(afterNoise.patches).toBe(0);
  expect(await statusTabTexts(page)).toEqual(beforeTabs);
  await expect(page.locator('#boardView .work-mobile-active-column')).toHaveCount(1);

  await resetAudit(page);
  await page.locator('#searchInput').fill('no-match-v301');
  await expect(page.locator('#boardView .task-card')).toHaveCount(0);
  await expect.poll(async () => (await auditSnapshot(page)).schedules).toBeGreaterThan(0);
  await expect.poll(async () => (await statusTabTexts(page)).some(text => /未着手/.test(text) && /0/.test(text))).toBeTruthy();
  await expect(page.locator('#boardView .work-mobile-active-column')).toHaveCount(1);

  await resetAudit(page);
  await page.locator('#searchInput').fill('');
  await expect(page.locator('#boardView .task-card').filter({ hasText: 'V301 seeded task' })).toHaveCount(1);
  await expect.poll(async () => (await auditSnapshot(page)).schedules).toBeGreaterThan(0);
  await expect.poll(async () => (await statusTabTexts(page)).some(text => /未着手/.test(text) && /1/.test(text))).toBeTruthy();
  await expect(page.locator('#boardView .work-mobile-active-column')).toHaveCount(1);
});

test('Ver.301 audit: semantic candidate preserves Tasks to Today to Tasks reconstruction', async ({ page }) => {
  await bootBoard(page, { semanticOnly: true });
  await resetAudit(page);

  await activateLayout(page, 'today');
  await expect(page.locator('#todayView')).toBeVisible();
  await expect(page.locator('.work-mobile-status-tabs')).toHaveCount(0);
  await expect.poll(async () => (await auditSnapshot(page)).schedules).toBeGreaterThan(0);

  await resetAudit(page);
  await activateLayout(page, 'tasks');
  await expect(page.locator('#boardView .task-card').filter({ hasText: 'V301 seeded task' })).toHaveCount(1);
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await expect.poll(async () => (await auditSnapshot(page)).schedules).toBeGreaterThan(0);
  await expect(page.locator('#boardView .work-mobile-active-column')).toHaveCount(1);
  expect((await statusTabTexts(page)).some(text => /未着手/.test(text) && /1/.test(text))).toBeTruthy();
});

test('Ver.301 audit: semantic candidate preserves the 861 to 860 late-load boundary', async ({ page }) => {
  await installAudit(page, { semanticOnly: true, width: 861 });
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await waitForRelease(page);
  await expect(page.locator('#workMobileHeader')).toHaveCount(0);

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  await activateLayout(page, 'tasks');
  await expect(page.locator('#boardView .board-column').first()).toBeVisible();
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await expect(page.locator('#boardView .work-mobile-active-column')).toHaveCount(1);
  expect((await statusTabTexts(page)).some(text => /未着手/.test(text) && /1/.test(text))).toBeTruthy();
});
