import { test, expect } from '@playwright/test';

const ROOM = 'test-sidebar-compatibility-v289';
const PIN_KEY = 'work-board-desktop-sidebar-pinned-v158';

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
  }, ROOM);

  await page.route(/\/desktop-sidebar-v242\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    let body = await response.text();
    const startMarker = '/* === Preserved desktop-sidebar-compat-v159 compatibility === */';
    const endMarker = '/* === Ver.242 text-only pin presentation === */';
    const start = body.indexOf(startMarker);
    const end = body.indexOf(endMarker);
    if (start < 0 || end < 0 || end <= start) {
      throw new Error('Ver.289 could not isolate the V159 compatibility IIFE');
    }
    body = `${body.slice(0, start)}\nwindow.__WB_SIDEBAR_V159_SUPPRESSED_V289__ = true;\n\n${body.slice(end)}`;
    await route.fulfill({ response, body });
  });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page, width) {
  await page.setViewportSize({ width, height: 900 });
  await installSafetyBoundary(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === window.WORK_BOARD_RELEASE?.version, undefined, { timeout: 8_000 });
  await page.waitForFunction(() => window.__WB_SIDEBAR_V159_SUPPRESSED_V289__ === true, undefined, { timeout: 8_000 });
  await page.waitForTimeout(120);
}

async function moveAway(page) {
  const viewport = page.viewportSize();
  await page.mouse.move(Math.max(340, viewport.width - 24), 240);
}

async function expectMobileRuntime(page) {
  await expect(page.locator('body')).not.toHaveClass(/desktop-sidebar-v158/, { timeout: 3_000 });
  await expect(page.locator('body')).not.toHaveAttribute('data-desktop-sidebar-state', /.+/);
  await expect(page.locator('#workMobileHeader')).toBeVisible({ timeout: 5_000 });
}

test('Ver.289 audit: V158 core alone owns 861 -> 860 -> 861 state transitions', async ({ page }) => {
  await boot(page, 861);
  await moveAway(page);
  await expect(page.locator('body')).toHaveClass(/desktop-sidebar-v158/);
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });

  await page.setViewportSize({ width: 860, height: 900 });
  await expectMobileRuntime(page);

  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await page.waitForTimeout(80);
  await expectMobileRuntime(page);

  const menuButton = page.locator('.work-mobile-menu-button');
  await menuButton.click();
  await expect(page.locator('body')).toHaveClass(/work-mobile-menu-open/);
  await page.locator('.nav-item[data-layout="tasks"]').first().click();
  await expect(page.locator('body')).not.toHaveClass(/work-mobile-menu-open/);

  await page.setViewportSize({ width: 861, height: 900 });
  await moveAway(page);
  await expect(page.locator('body')).toHaveClass(/desktop-sidebar-v158/, { timeout: 3_000 });
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
});

test('Ver.289 audit: V158 core alone preserves pinned preference through the mobile boundary', async ({ page }) => {
  await boot(page, 861);
  await moveAway(page);
  await page.locator('.sidebar').hover();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });

  const pinButton = page.locator('.desktop-sidebar-pin-v158');
  await pinButton.click();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'pinned', { timeout: 3_000 });
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), PIN_KEY)).toBe('1');

  await page.setViewportSize({ width: 860, height: 900 });
  await expectMobileRuntime(page);
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), PIN_KEY)).toBe('1');

  await page.setViewportSize({ width: 861, height: 900 });
  await expect(page.locator('body')).toHaveClass(/desktop-sidebar-v158/, { timeout: 3_000 });
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'pinned', { timeout: 3_000 });
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), PIN_KEY)).toBe('1');
});

test('Ver.289 audit: mobile cold boot and exact 860 -> 861 transition work with V159 suppressed', async ({ page }) => {
  await boot(page, 860);
  await expectMobileRuntime(page);

  await page.setViewportSize({ width: 861, height: 900 });
  await moveAway(page);
  await expect(page.locator('body')).toHaveClass(/desktop-sidebar-v158/, { timeout: 3_000 });
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });

  await page.setViewportSize({ width: 860, height: 900 });
  await expectMobileRuntime(page);
});
