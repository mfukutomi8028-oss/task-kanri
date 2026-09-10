import { test, expect } from '@playwright/test';

const ROOM = 'test-icon-visual';

async function installProductionSafetyBoundary(page) {
  await page.addInitScript(({ room }) => {
    try {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
    } catch {}

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

async function boot(page, width, height) {
  await page.setViewportSize({ width, height });
  await installProductionSafetyBoundary(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await page.waitForTimeout(500);
}

async function settleDesktopSidebar(page) {
  const viewport = page.viewportSize();
  await page.mouse.move(Math.max(340, viewport.width - 30), 240);
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed');
}

async function freezeMotion(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `
  });
}

test('icon system visual baseline: collapsed desktop navigation', async ({ page }) => {
  await boot(page, 1366, 900);
  await settleDesktopSidebar(page);
  await freezeMotion(page);
  await expect(page.locator('.sidebar .nav')).toHaveScreenshot('icon-nav-desktop-collapsed.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.001
  });
});

test('icon system visual baseline: expanded desktop navigation', async ({ page }) => {
  await boot(page, 1366, 900);
  await settleDesktopSidebar(page);
  await page.locator('.sidebar').hover();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded');
  await freezeMotion(page);
  await expect(page.locator('.sidebar .nav')).toHaveScreenshot('icon-nav-desktop-expanded.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.001
  });
});

test('icon system visual baseline: mobile navigation and summaries', async ({ page }) => {
  await boot(page, 390, 844);
  await freezeMotion(page);
  await expect(page.locator('.sidebar .nav')).toHaveScreenshot('icon-nav-mobile-390.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.001
  });

  await page.locator('.nav-item[data-layout="tasks"]').click();
  await expect(page.locator('.summary-grid')).toBeVisible();
  await expect(page.locator('.summary-grid')).toHaveScreenshot('icon-summary-mobile-390.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.001
  });
});
