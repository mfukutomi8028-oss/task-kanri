import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-fixes-ownership-v233';

async function bootMobile(page) {
  await page.setViewportSize({ width: 430, height: 800 });
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => Number(window.WORK_BOARD_RELEASE?.version || 0) >= 232, undefined, { timeout: 8_000 });
}

test('Ver.233 audit: mobile-fixes owns the conditional mobile shell without reclaiming version or schedule semantics', async ({ page }) => {
  await bootMobile(page);

  await expect(page.locator('#workMobileHeader')).toBeVisible();
  await expect(page.locator('.work-mobile-menu-button')).toBeVisible();
  await expect(page.locator('.work-mobile-action-button')).toBeVisible();

  const runtime = await page.evaluate(() => ({
    mobileRequests: performance.getEntriesByType('resource')
      .filter(entry => String(entry.name || '').includes('/mobile-fixes.js')).length,
    rollingWeekPrototypePatched: Object.prototype.hasOwnProperty.call(Date.prototype, '__workBoardOriginalGetDay'),
    versionClassCount: document.querySelectorAll('.workboard-version-display').length,
    legacyVersionClassCount: document.querySelectorAll('.app-version').length
  }));

  expect(runtime.mobileRequests).toBe(1);
  expect(runtime.rollingWeekPrototypePatched).toBe(false);
  expect(runtime.versionClassCount).toBeGreaterThan(0);
  expect(runtime.legacyVersionClassCount).toBe(0);

  const version = String(await page.evaluate(() => window.WORK_BOARD_RELEASE?.version || ''));
  await page.evaluate(() => {
    const display = document.querySelector('.workboard-version-display');
    if (!display) throw new Error('version display is missing');
    display.textContent = 'Ver.101';
    display.dataset.releaseVersion = '101';
    window.dispatchEvent(new Event('focus'));
  });
  await expect(page.locator('.workboard-version-display').first()).toHaveText(`Ver.${version}`);
  await expect(page.locator('.workboard-version-display').first()).toHaveAttribute('data-release-version', version);
});

test('Ver.233 audit: status tabs keep mobile state, accessibility and vertical position', async ({ page }) => {
  await bootMobile(page);
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());

  const tabs = page.locator('.work-mobile-status-tabs');
  const buttons = tabs.locator('.work-mobile-status-tab');
  await expect(tabs).toBeVisible();
  expect(await buttons.count()).toBeGreaterThan(1);

  await page.evaluate(() => window.scrollTo(0, 180));
  const beforeY = await page.evaluate(() => window.scrollY);
  const second = buttons.nth(1);
  await second.click();

  await expect(second).toHaveClass(/active/);
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await expect(buttons.first()).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.board-view .board-column.work-mobile-active-column')).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem('workBoardMobileBoardStatusIndex'))).toBe('1');
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - beforeY)).toBeLessThanOrEqual(2);
});

test('Ver.233 audit: mobile create menu delegates to canonical task and schedule entry points', async ({ page }) => {
  await bootMobile(page);

  const create = page.locator('.work-mobile-action-button');
  await create.click();
  await expect(page.locator('#workMobileCreateMenu')).toHaveClass(/open/);
  await page.locator('[data-mobile-create="task"]').click();
  await expect(page.locator('#taskDialog')).toBeVisible();
  await page.evaluate(() => document.getElementById('taskDialog')?.close());

  await create.click();
  await page.locator('[data-mobile-create="schedule"]').click();
  await expect(page.locator('#scheduleDialog')).toBeVisible({ timeout: 3_000 });
});
