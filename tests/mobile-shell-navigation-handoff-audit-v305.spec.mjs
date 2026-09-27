import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-shell-navigation-handoff-v306';

async function installProductHarness(page, { width = 430 } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
      {
        id: 'v306-task-1',
        title: 'V306 seeded task',
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
    await route.continue();
  });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
  return metrics;
}

async function waitForRelease(page) {
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const release = String(window.WORK_BOARD_RELEASE?.version || window.WORK_BOARD_RELEASE_VERSION || '');
    return Boolean(release) && document.documentElement.dataset.firstPaintVersion === release;
  }, undefined, { timeout: 8_000 });
}

async function boot(page, options = {}) {
  const metrics = await installProductHarness(page, options);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await waitForRelease(page);
  if ((options.width ?? 430) <= 860) await expect(page.locator('#workMobileHeader')).toBeVisible();
  return metrics;
}

async function immediateNavigate(page, layout, { openDrawer = true } = {}) {
  return page.evaluate(({ targetLayout, shouldOpenDrawer }) => {
    if (shouldOpenDrawer) document.querySelector('.work-mobile-menu-button')?.click();
    const nav = document.querySelector(`.nav-item[data-layout="${targetLayout}"]`);
    if (!nav) throw new Error(`missing nav for ${targetLayout}`);
    nav.click();
    const active = document.querySelector('.nav-item.active');
    return {
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

test('Ver.306 product: Tasks navigation reconciles drawer title and board in the same click task', async ({ page }) => {
  await boot(page);

  const immediate = await immediateNavigate(page, 'tasks');
  expect(immediate.drawerOpen).toBe(false);
  expect(immediate.boardVisible).toBe(true);
  expect(immediate.title).toBe(immediate.expectedTitle);
  expect(immediate.statusTabs).toBe(1);
  expect(immediate.activeColumns).toBe(1);
  expect(await page.locator('.work-mobile-status-tabs').textContent()).toMatch(/未着手\s*1/);
});

test('Ver.306 product: Tasks to Today closes drawer updates title and removes board tabs synchronously', async ({ page }) => {
  await boot(page);
  let snapshot = await immediateNavigate(page, 'tasks');
  expect(snapshot.statusTabs).toBe(1);

  snapshot = await immediateNavigate(page, 'today');
  expect(snapshot.drawerOpen).toBe(false);
  expect(snapshot.todayVisible).toBe(true);
  expect(snapshot.title).toBe(snapshot.expectedTitle);
  expect(snapshot.statusTabs).toBe(0);
  expect(snapshot.activeColumns).toBe(0);
});

test('Ver.306 product: 861 to 860 late load keeps one shell and synchronous navigation handoff', async ({ page }) => {
  const metrics = await boot(page, { width: 861 });
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

test('Ver.306 product: schedule create synchronous handoff remains intact after navigation change', async ({ page }) => {
  await boot(page);
  await immediateNavigate(page, 'tasks', { openDrawer: false });

  await page.locator('.work-mobile-action-button').click();
  await page.locator("[data-mobile-create='schedule']").click();

  await expect(page.locator('#scheduleDialog')).toHaveAttribute('open', '');
  await expect(page.locator('.nav-item[data-layout="schedule"]').first()).toHaveClass(/active/);
  await expect(page.locator('.work-mobile-title-text')).toContainText('スケジュール');
});