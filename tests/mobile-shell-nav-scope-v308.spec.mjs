import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-shell-nav-scope-v308';

async function installHarness(page, { width = 430 } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([{
      id: 'v308-task-1', title: 'V308 seeded task', status: '未着手', assignee: '福冨',
      priority: '中', category: 'PC', description: '', dueDate: '', tags: []
    }]));
    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return null; }, set() {} });
  }, { room: ROOM });

  const metrics = { mobileLoads: 0 };
  await page.route(/\/mobile-shell-v234\.js(?:\?.*)?$/, async route => {
    metrics.mobileLoads += 1;
    await route.continue();
  });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
  return metrics;
}

async function waitForRelease(page) {
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  const release = await page.evaluate(() => String(window.WORK_BOARD_RELEASE?.version || ''));
  expect(Number(release)).toBeGreaterThanOrEqual(275);
  await page.waitForFunction(version => document.documentElement.dataset.firstPaintVersion === version, release, { timeout: 8_000 });
}

async function boot(page, options = {}) {
  const metrics = await installHarness(page, options);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await waitForRelease(page);
  if ((options.width ?? 430) <= 860) await expect(page.locator('#workMobileHeader')).toBeVisible();
  await expect(page.locator('[data-work-memo-layout]')).toHaveCount(1);
  return metrics;
}

async function immediateNavigate(page, selector, { openDrawer = true } = {}) {
  return page.evaluate(({ targetSelector, shouldOpenDrawer }) => {
    if (shouldOpenDrawer) document.querySelector('.work-mobile-menu-button')?.click();
    const nav = document.querySelector(targetSelector);
    if (!nav) throw new Error(`missing nav for ${targetSelector}`);
    nav.click();
    const active = document.querySelector('.nav-item.active');
    return {
      title: document.querySelector('.work-mobile-title-text')?.textContent?.trim() || '',
      expectedTitle: active?.textContent?.trim() || '',
      drawerOpen: document.body.classList.contains('work-mobile-menu-open'),
      statusTabs: document.querySelectorAll('.work-mobile-status-tabs').length,
      activeColumns: document.querySelectorAll('#boardView .work-mobile-active-column').length,
      boardVisible: Boolean(document.getElementById('boardView')?.offsetParent),
      todayVisible: Boolean(document.getElementById('todayView')?.offsetParent),
      memoVisible: Boolean(document.getElementById('workMemoViewV167') && !document.getElementById('workMemoViewV167').hidden),
      guard: Boolean(window.__workBoardMobileFixClicksV101),
      navCount: document.querySelectorAll('.nav-item').length
    };
  }, { targetSelector: selector, shouldOpenDrawer: openDrawer });
}

test('Ver.308 product: Tasks keeps same-task drawer title and board reconciliation', async ({ page }) => {
  await boot(page);
  const immediate = await immediateNavigate(page, '.nav-item[data-layout="tasks"]');
  expect(immediate.guard).toBe(true);
  expect(immediate.navCount).toBe(8);
  expect(immediate.drawerOpen).toBe(false);
  expect(immediate.boardVisible).toBe(true);
  expect(immediate.title).toBe(immediate.expectedTitle);
  expect(immediate.statusTabs).toBe(1);
  expect(immediate.activeColumns).toBe(1);
  expect(await page.locator('.work-mobile-status-tabs').textContent()).toMatch(/未着手\s*1/);
});

test('Ver.308 product: Tasks to Today removes board tabs synchronously', async ({ page }) => {
  await boot(page);
  let snapshot = await immediateNavigate(page, '.nav-item[data-layout="tasks"]');
  expect(snapshot.statusTabs).toBe(1);
  snapshot = await immediateNavigate(page, '.nav-item[data-layout="today"]');
  expect(snapshot.drawerOpen).toBe(false);
  expect(snapshot.todayVisible).toBe(true);
  expect(snapshot.title).toBe(snapshot.expectedTitle);
  expect(snapshot.statusTabs).toBe(0);
  expect(snapshot.activeColumns).toBe(0);
});

test('Ver.308 product: static filter nav remains covered by nav delegation', async ({ page }) => {
  await boot(page);
  await immediateNavigate(page, '.nav-item[data-layout="tasks"]', { openDrawer: false });
  const snapshot = await immediateNavigate(page, '.nav-item[data-filter="mine"]');
  expect(snapshot.drawerOpen).toBe(false);
  expect(snapshot.boardVisible).toBe(true);
  expect(snapshot.title).toBe(snapshot.expectedTitle);
  expect(snapshot.statusTabs).toBe(1);
  expect(snapshot.activeColumns).toBe(1);
});

test('Ver.308 product: dynamically inserted Work Memo nav remains covered', async ({ page }) => {
  await boot(page);
  await immediateNavigate(page, '.nav-item[data-layout="tasks"]', { openDrawer: false });
  const snapshot = await immediateNavigate(page, '[data-work-memo-layout]');
  expect(snapshot.navCount).toBe(8);
  expect(snapshot.drawerOpen).toBe(false);
  expect(snapshot.memoVisible).toBe(true);
  expect(snapshot.title).toBe('業務メモ');
  expect(snapshot.expectedTitle).toBe('業務メモ');
  expect(snapshot.statusTabs).toBe(0);
  expect(snapshot.activeColumns).toBe(0);
});

test('Ver.308 product: 861 to 860 late load binds nav delegation once and covers dynamic nav', async ({ page }) => {
  const metrics = await boot(page, { width: 861 });
  await expect(page.locator('#workMobileHeader')).toHaveCount(0);
  expect(metrics.mobileLoads).toBe(0);
  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  await expect.poll(() => metrics.mobileLoads).toBe(1);
  let immediate = await immediateNavigate(page, '.nav-item[data-layout="tasks"]');
  expect(immediate.guard).toBe(true);
  expect(immediate.drawerOpen).toBe(false);
  expect(immediate.statusTabs).toBe(1);
  immediate = await immediateNavigate(page, '[data-work-memo-layout]');
  expect(immediate.memoVisible).toBe(true);
  expect(immediate.title).toBe('業務メモ');
  expect(metrics.mobileLoads).toBe(1);
});

test('Ver.308 product: Ver.304 Schedule create synchronous handoff remains intact', async ({ page }) => {
  await boot(page);
  await immediateNavigate(page, '.nav-item[data-layout="tasks"]', { openDrawer: false });
  await page.locator('.work-mobile-action-button').click();
  await page.locator("[data-mobile-create='schedule']").click();
  await expect(page.locator('#scheduleDialog')).toHaveAttribute('open', '');
  await expect(page.locator('.nav-item[data-layout="schedule"]').first()).toHaveClass(/active/);
  await expect(page.locator('.work-mobile-title-text')).toContainText('スケジュール');
});
