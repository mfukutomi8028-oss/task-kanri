import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-shell-resize-scope-v295';
const MOBILE_SHELL = 'mobile-shell-v234.js';
const RESIZE_TARGET = '  window.addEventListener("resize", schedulePatch);';

async function installSafetyBoundary(page) {
  await page.addInitScript(room => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([]));
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
    window.__v295ResizeCount = 0;
    window.addEventListener('resize', () => { window.__v295ResizeCount += 1; });
  }, ROOM);

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function narrowResizeRecovery(page) {
  let shellRequests = 0;
  let substitutions = 0;

  await page.route(`**/${MOBILE_SHELL}*`, async route => {
    const response = await route.fetch();
    const original = await response.text();
    const body = original.replace(`${RESIZE_TARGET}\n`, '  window.addEventListener("resize", scheduleBoardTabs);\n');
    if (body === original) throw new Error('Ver.295 resize audit target is missing');
    shellRequests += 1;
    substitutions += 1;
    await route.fulfill({ response, body });
  });

  return {
    getShellRequests: () => shellRequests,
    getSubstitutions: () => substitutions
  };
}

async function boot(page, width = 800, height = 1000) {
  await page.setViewportSize({ width, height });
  await installSafetyBoundary(page);
  const audit = await narrowResizeRecovery(page);
  await page.goto(`/?room=${ROOM}&v295=${width}x${height}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => Number(window.WORK_BOARD_RELEASE?.version || 0) === 269,
    undefined, { timeout: 8_000 });
  return audit;
}

async function openTaskBoard(page) {
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await expect(page.locator('.board-view .board-column.work-mobile-active-column')).toHaveCount(1);
}

async function expectCanonicalMobileBoard(page) {
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await expect(page.locator('.board-view .board-column.work-mobile-active-column')).toHaveCount(1);
  await expect(page.locator('.work-mobile-status-tab.active')).toHaveCount(1);
  await expect(page.locator('.work-mobile-status-tab[aria-pressed="true"]')).toHaveCount(1);
}

async function driftBoardState(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.board-view .board-column').forEach(column => {
      column.classList.remove('work-mobile-active-column');
    });
    document.querySelectorAll('.work-mobile-status-tab').forEach(tab => {
      tab.classList.remove('active');
      tab.setAttribute('aria-pressed', 'false');
    });
  });
}

test('Ver.295 audit: mobile resize needs only board reconciliation', async ({ page }) => {
  const audit = await boot(page, 800, 1000);
  expect(audit.getShellRequests()).toBe(1);
  expect(audit.getSubstitutions()).toBe(1);

  await openTaskBoard(page);
  await driftBoardState(page);
  await page.setViewportSize({ width: 820, height: 1000 });

  await expectCanonicalMobileBoard(page);
  expect(await page.evaluate(() => window.__v295ResizeCount)).toBeGreaterThan(0);
  expect(audit.getShellRequests()).toBe(1);
});

test('Ver.295 audit: mobile-desktop-mobile boundary stays canonical with board-only resize recovery', async ({ page }) => {
  const audit = await boot(page, 800, 1000);
  await openTaskBoard(page);

  const titleBefore = await page.locator('.work-mobile-title-text').textContent();
  await expect(page.locator('.work-mobile-menu-button')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.work-mobile-menu-button')).toHaveText('☰');

  await page.setViewportSize({ width: 1000, height: 800 });
  await expect(page.locator('#workMobileHeader')).toBeHidden();
  await expect(page.locator('.work-mobile-status-tabs')).toHaveCount(0);
  await expect(page.locator('.board-view .board-column.work-mobile-active-column')).toHaveCount(0);

  await page.setViewportSize({ width: 800, height: 1000 });
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  await expectCanonicalMobileBoard(page);
  await expect(page.locator('.work-mobile-title-text')).toHaveText(titleBefore || 'タスク');
  await expect(page.locator('.work-mobile-menu-button')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.work-mobile-menu-button')).toHaveText('☰');
  expect(audit.getShellRequests()).toBe(1);
});

test('Ver.295 audit: navigation keeps title synchronization independent of resize', async ({ page }) => {
  const audit = await boot(page, 800, 1000);
  await openTaskBoard(page);

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="schedule"]')?.click());
  await expect(page.locator('.nav-item[data-layout="schedule"]')).toHaveClass(/active/);
  const activeLabel = await page.locator('.nav-item[data-layout="schedule"]').evaluate(node => node.textContent?.trim() || '');
  await expect(page.locator('.work-mobile-title-text')).toHaveText(activeLabel);

  await page.setViewportSize({ width: 820, height: 1000 });
  await expect(page.locator('.work-mobile-title-text')).toHaveText(activeLabel);
  expect(audit.getShellRequests()).toBe(1);
});
