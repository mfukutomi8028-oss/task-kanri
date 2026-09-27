import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-shell-navigation-handoff-v305';

async function installAudit(page, { candidate = false, width = 430 } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
      {
        id: 'v305-task-1',
        title: 'V305 seeded task',
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
  }, { room: ROOM });

  const metrics = { mobileLoads: 0 };
  await page.route(/\/mobile-shell-v234\.js(?:\?.*)?$/, async route => {
    metrics.mobileLoads += 1;
    const response = await route.fetch();
    let body = await response.text();
    if (candidate) {
      const current = `    document.addEventListener("click", event => {\n      if (event.target?.closest?.(".nav-item")) {\n        setTimeout(() => {\n          closeMobileMenu();\n          syncMobileHeaderTitle();\n          patchMobileBoardTabs();\n        }, 0);\n      }\n    }, true);`;
      const replacement = `    document.addEventListener("click", event => {\n      if (event.target?.closest?.(".nav-item")) {\n        closeMobileMenu();\n        syncMobileHeaderTitle();\n        patchMobileBoardTabs();\n      }\n    });`;
      if (!body.includes(current)) throw new Error('Ver.305 navigation candidate injection point not found');
      body = body.replace(current, replacement);
    }
    await route.fulfill({ response, body });
  });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
  return metrics;
}

async function waitForRelease(page) {
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === '273', undefined, { timeout: 8_000 });
}

async function boot(page, options = {}) {
  const metrics = await installAudit(page, options);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await waitForRelease(page);
  if ((options.width ?? 430) <= 860) await expect(page.locator('#workMobileHeader')).toBeVisible();
  return metrics;
}

async function immediateNavigate(page, layout, { openDrawer = true } = {}) {
  return page.evaluate(({ targetLayout, shouldOpenDrawer }) => {
    if (shouldOpenDrawer) document.querySelector('.work-mobile-menu-button')?.click();
    const beforeTitle = document.querySelector('.work-mobile-title-text')?.textContent?.trim() || '';
    const nav = document.querySelector(`.nav-item[data-layout="${targetLayout}"]`);
    if (!nav) throw new Error(`missing nav for ${targetLayout}`);
    nav.click();
    const active = document.querySelector('.nav-item.active');
    return {
      beforeTitle,
      title: document.querySelector('.work-mobile-title-text')?.textContent?.trim() || '',
      expectedTitle: active?.textContent?.trim() || '',
      drawerOpen: document.body.classList.contains('work-mobile-menu-open'),
      statusTabs: document.querySelectorAll('.work-mobile-status-tabs').length,
      activeColumns: document.querySelectorAll('#boardView .work-mobile-active-column').length,
      boardVisible: Boolean(document.getElementById('boardView')?.offsetParent),
      todayVisible: Boolean(document.getElementById('todayView')?.offsetParent)
    };
  }, { targetLayout: layout, shouldOpenDrawer: openDrawer });
}

test('Ver.305 baseline: current capture handler needs the zero-timeout to finish mobile reconciliation', async ({ page }) => {
  await boot(page);

  const immediate = await immediateNavigate(page, 'tasks');
  expect(immediate.drawerOpen).toBe(true);
  expect(immediate.boardVisible).toBe(true);
  expect(immediate.title).toBe(immediate.beforeTitle);
  expect(immediate.title).not.toBe(immediate.expectedTitle);

  await expect.poll(async () => page.evaluate(() => document.body.classList.contains('work-mobile-menu-open'))).toBe(false);
  await expect.poll(async () => page.locator('.work-mobile-title-text').textContent()).toBe(immediate.expectedTitle);
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await expect(page.locator('#boardView .work-mobile-active-column')).toHaveCount(1);
});

test('Ver.305 candidate: bubble phase reconciles after canonical render in the same click task', async ({ page }) => {
  await boot(page, { candidate: true });

  const immediate = await immediateNavigate(page, 'tasks');
  expect(immediate.drawerOpen).toBe(false);
  expect(immediate.boardVisible).toBe(true);
  expect(immediate.title).toBe(immediate.expectedTitle);
  expect(immediate.statusTabs).toBe(1);
  expect(immediate.activeColumns).toBe(1);
  expect(await page.locator('.work-mobile-status-tabs').textContent()).toMatch(/未着手\s*1/);
});

test('Ver.305 candidate: Tasks to Today closes drawer, updates title, and removes board tabs synchronously', async ({ page }) => {
  await boot(page, { candidate: true });
  let snapshot = await immediateNavigate(page, 'tasks');
  expect(snapshot.statusTabs).toBe(1);

  snapshot = await immediateNavigate(page, 'today');
  expect(snapshot.drawerOpen).toBe(false);
  expect(snapshot.todayVisible).toBe(true);
  expect(snapshot.title).toBe(snapshot.expectedTitle);
  expect(snapshot.statusTabs).toBe(0);
  expect(snapshot.activeColumns).toBe(0);
});

test('Ver.305 candidate: 861 to 860 late load keeps one shell and synchronous navigation handoff', async ({ page }) => {
  const metrics = await boot(page, { candidate: true, width: 861 });
  await expect(page.locator('#workMobileHeader')).toHaveCount(0);
  expect(metrics.mobileLoads).toBe(0);

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  await expect.poll(() => metrics.mobileLoads).toBe(1);
  await expect(page.locator('#workMobileHeader')).toHaveCount(1);

  const immediate = await immediateNavigate(page, 'tasks');
  expect(immediate.drawerOpen).toBe(false);
  expect(immediate.title).toBe(immediate.expectedTitle);
  expect(immediate.statusTabs).toBe(1);
  expect(immediate.activeColumns).toBe(1);
  expect(metrics.mobileLoads).toBe(1);
});
