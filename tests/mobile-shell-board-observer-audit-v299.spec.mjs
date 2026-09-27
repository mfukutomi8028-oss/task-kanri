import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-shell-board-observer-v300';

async function installAudit(page) {
  await page.setViewportSize({ width: 430, height: 900 });
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
      {
        id: 'v300-task-1',
        title: 'V300 seeded task',
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
    window.__WB_BOARD_OBSERVER_V300__ = { callbacks: 0, records: 0, patches: 0 };

    const NativeMutationObserver = window.MutationObserver;
    window.MutationObserver = class MutationObserverAuditV300 {
      constructor(callback) {
        this.__boardViewObserved = false;
        this.__native = new NativeMutationObserver(records => {
          if (this.__boardViewObserved) {
            const audit = window.__WB_BOARD_OBSERVER_V300__;
            if (audit) {
              audit.callbacks += 1;
              audit.records += records.length;
            }
          }
          return callback(records, this);
        });
      }

      observe(target, options = {}) {
        if (target?.id === 'boardView'
          && options.childList === true
          && options.subtree !== true
          && options.attributes !== true) {
          this.__boardViewObserved = true;
        }
        return this.__native.observe(target, options);
      }

      disconnect() { return this.__native.disconnect(); }
      takeRecords() { return this.__native.takeRecords(); }
    };
  }, { room: ROOM });

  await page.route(/\/mobile-shell-v234\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    let body = await response.text();

    const patchNeedle = '  function patchMobileBoardTabs() {';
    if (!body.includes(patchNeedle)) throw new Error('Ver.300 patchMobileBoardTabs injection point not found');
    body = body.replace(patchNeedle, `${patchNeedle}\n    if (window.__WB_BOARD_OBSERVER_V300__) window.__WB_BOARD_OBSERVER_V300__.patches += 1;`);

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

async function bootBoard(page) {
  await installAudit(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await activateLayout(page, 'tasks');
  await expect(page.locator('#boardView .board-column').first()).toBeVisible();
  await expect(page.locator('#boardView .task-card').filter({ hasText: 'V300 seeded task' })).toHaveCount(1);
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await page.waitForTimeout(120);
  await resetAudit(page);
}

async function resetAudit(page) {
  await page.evaluate(() => {
    Object.assign(window.__WB_BOARD_OBSERVER_V300__, { callbacks: 0, records: 0, patches: 0 });
  });
}

async function auditSnapshot(page) {
  return page.evaluate(() => ({ ...window.__WB_BOARD_OBSERVER_V300__ }));
}

async function statusTabTexts(page) {
  return page.locator('.work-mobile-status-tabs button').allTextContents();
}

test('Ver.300 product: direct-child observer ignores irrelevant task-card descendant mutation', async ({ page }) => {
  await bootBoard(page);
  const beforeTabs = await statusTabTexts(page);

  await page.evaluate(() => {
    const card = document.querySelector('#boardView .task-card');
    const noise = document.createElement('span');
    noise.dataset.v300Noise = 'true';
    noise.hidden = true;
    card?.appendChild(noise);
  });
  await page.waitForTimeout(100);

  expect(await auditSnapshot(page)).toEqual({ callbacks: 0, records: 0, patches: 0 });
  expect(await statusTabTexts(page)).toEqual(beforeTabs);
});

test('Ver.300 product: canonical filtered redraw still updates status-tab counts', async ({ page }) => {
  await bootBoard(page);
  const beforeTabs = await statusTabTexts(page);
  expect(beforeTabs.some(text => /未着手/.test(text) && /1/.test(text))).toBeTruthy();

  await page.locator('#searchInput').fill('no-match-v300');
  await expect(page.locator('#boardView .task-card')).toHaveCount(0);
  await expect.poll(async () => (await auditSnapshot(page)).callbacks).toBeGreaterThan(0);
  await expect.poll(async () => (await statusTabTexts(page)).some(text => /未着手/.test(text) && /0/.test(text))).toBeTruthy();

  await resetAudit(page);
  await page.locator('#searchInput').fill('');
  await expect(page.locator('#boardView .task-card').filter({ hasText: 'V300 seeded task' })).toHaveCount(1);
  await expect.poll(async () => (await auditSnapshot(page)).callbacks).toBeGreaterThan(0);
  await expect.poll(async () => (await statusTabTexts(page)).some(text => /未着手/.test(text) && /1/.test(text))).toBeTruthy();
});

test('Ver.300 product: direct-child observer preserves navigation away/back board reconstruction', async ({ page }) => {
  await bootBoard(page);
  await resetAudit(page);

  await activateLayout(page, 'today');
  await expect(page.locator('#todayView')).toBeVisible();
  await expect(page.locator('.work-mobile-status-tabs')).toHaveCount(0);

  await activateLayout(page, 'tasks');
  await expect(page.locator('#boardView .task-card').filter({ hasText: 'V300 seeded task' })).toHaveCount(1);
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await expect.poll(async () => (await auditSnapshot(page)).callbacks).toBeGreaterThan(0);
  expect((await statusTabTexts(page)).some(text => /未着手/.test(text) && /1/.test(text))).toBeTruthy();
});
