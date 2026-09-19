import { test, expect } from '@playwright/test';

const ROOM = 'test-sidebar-mobile-boundary-v241';
const MOBILE_SHELL = 'mobile-shell-v234.js';
const PIN_KEY = 'work-board-desktop-sidebar-pinned-v158';

async function installSafetyBoundary(page) {
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([]));
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page, width) {
  await page.setViewportSize({ width, height: 900 });
  await installSafetyBoundary(page);
  let shellRequests = 0;
  page.on('request', request => {
    try {
      if (new URL(request.url()).pathname.endsWith(`/${MOBILE_SHELL}`)) shellRequests += 1;
    } catch (_) {}
  });
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => String(window.WORK_BOARD_RELEASE?.version || '') === '240', undefined, { timeout: 8_000 });
  return () => shellRequests;
}

async function bodyState(page) {
  return page.evaluate(() => ({
    className: document.body.className,
    sidebarState: document.body.getAttribute('data-desktop-sidebar-state'),
    paddingTop: getComputedStyle(document.body).paddingTop,
    headerCount: document.querySelectorAll('#workMobileHeader').length,
    headerDisplay: document.getElementById('workMobileHeader') ? getComputedStyle(document.getElementById('workMobileHeader')).display : null,
    sidebarTransform: getComputedStyle(document.querySelector('.sidebar')).transform
  }));
}

test('Ver.241 audit: exact cold-boot boundary is mobile at 860 and desktop at 861', async ({ page }) => {
  const mobileRequests = await boot(page, 860);
  expect(mobileRequests()).toBe(1);
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/desktop-sidebar-v158/);

  await page.setViewportSize({ width: 861, height: 900 });
  await page.goto(`/?room=${ROOM}&desktop=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await expect(page.locator('body')).toHaveClass(/desktop-sidebar-v158/);
});

test('Ver.241 audit: desktop cold boot resized to 860 enters CSS-only mobile state without mobile shell JS', async ({ page }) => {
  const shellRequests = await boot(page, 861);
  expect(shellRequests()).toBe(0);
  await expect(page.locator('body')).toHaveClass(/desktop-sidebar-v158/);
  await expect(page.locator('#workMobileHeader')).toHaveCount(0);

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('body')).not.toHaveClass(/desktop-sidebar-v158/, { timeout: 3_000 });
  await expect(page.locator('body')).not.toHaveAttribute('data-desktop-sidebar-state', /.+/);

  const state = await bodyState(page);
  expect(shellRequests()).toBe(0);
  expect(state.headerCount).toBe(0);
  expect(state.paddingTop).toBe('68px');
  expect(state.sidebarTransform).not.toBe('none');
});

test('Ver.241 audit: mobile cold boot keeps its shell across 860 -> 861 -> 860 transitions', async ({ page }) => {
  const shellRequests = await boot(page, 860);
  expect(shellRequests()).toBe(1);
  await expect(page.locator('#workMobileHeader')).toBeVisible();

  await page.setViewportSize({ width: 861, height: 900 });
  await expect(page.locator('body')).toHaveClass(/desktop-sidebar-v158/, { timeout: 3_000 });
  await expect(page.locator('#workMobileHeader')).toBeHidden();

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('body')).not.toHaveClass(/desktop-sidebar-v158/, { timeout: 3_000 });
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  expect(shellRequests()).toBe(1);

  const menuButton = page.locator('.work-mobile-menu-button');
  await menuButton.click();
  await expect(page.locator('body')).toHaveClass(/work-mobile-menu-open/);
  await page.locator('.nav-item[data-layout="tasks"]').first().click();
  await expect(page.locator('body')).not.toHaveClass(/work-mobile-menu-open/);

  const activeLabel = await page.locator('.nav-item.active').first().evaluate(node => node.textContent?.trim() || '');
  await expect(page.locator('.work-mobile-title-text')).toHaveText(activeLabel);
});

test('Ver.241 audit: desktop compatibility preserves a real pinned state while clearing only runtime desktop classes at 860', async ({ page }) => {
  await boot(page, 861);

  await page.locator('.sidebar').hover();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
  const pinButton = page.locator('.desktop-sidebar-pin-v158');
  await expect(pinButton).toBeVisible();
  await pinButton.click();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'pinned', { timeout: 3_000 });
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), PIN_KEY)).toBe('1');

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('body')).not.toHaveClass(/desktop-sidebar-v158/, { timeout: 3_000 });
  await expect(page.locator('body')).not.toHaveAttribute('data-desktop-sidebar-state', /.+/);
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), PIN_KEY)).toBe('1');

  await page.setViewportSize({ width: 861, height: 900 });
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'pinned', { timeout: 3_000 });
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), PIN_KEY)).toBe('1');
});
