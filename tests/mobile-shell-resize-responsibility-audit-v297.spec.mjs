import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-shell-resize-responsibility-v298';
const MOBILE_SHELL = 'mobile-shell-v234.js';

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
    window.__v298ResizeCount = 0;
    window.addEventListener('resize', () => { window.__v298ResizeCount += 1; });
  }, ROOM);

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function countMobileShellRequests(page) {
  let shellRequests = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname.endsWith(`/${MOBILE_SHELL}`)) shellRequests += 1;
  });
  return () => shellRequests;
}

async function boot(page, width = 800, height = 1000) {
  await page.setViewportSize({ width, height });
  await installSafetyBoundary(page);
  const getShellRequests = await countMobileShellRequests(page);
  await page.goto(`/?room=${ROOM}&v298=${width}x${height}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => Number(window.WORK_BOARD_RELEASE?.version || 0) >= 270,
    undefined, { timeout: 8_000 });
  return { getShellRequests };
}

async function openTaskBoard(page) {
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await expect(page.locator('.board-view .board-column.work-mobile-active-column')).toHaveCount(1);
}

async function canonicalHeaderState(page) {
  const activeLabel = await page.locator('.nav-item.active').first().evaluate(node => node.textContent?.trim() || '');
  return { activeLabel };
}

async function driftRecoverableState(page) {
  await page.evaluate(() => {
    const title = document.querySelector('.work-mobile-title-text');
    if (title) title.textContent = 'V298-DRIFT';
    const menu = document.querySelector('.work-mobile-menu-button');
    if (menu) {
      menu.textContent = '?';
      menu.setAttribute('aria-expanded', 'true');
    }
    document.querySelectorAll('.board-view .board-column').forEach(column => column.classList.remove('work-mobile-active-column'));
    document.querySelectorAll('.work-mobile-status-tab').forEach(tab => {
      tab.classList.remove('active');
      tab.setAttribute('aria-pressed', 'false');
    });
  });
}

async function expectCanonicalState(page, activeLabel) {
  await expect(page.locator('.work-mobile-title-text')).toHaveText(activeLabel);
  await expect(page.locator('.work-mobile-menu-button')).toHaveText('☰');
  await expect(page.locator('.work-mobile-menu-button')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.work-mobile-status-tab.active')).toHaveCount(1);
  await expect(page.locator('.work-mobile-status-tab[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('.board-view .board-column.work-mobile-active-column')).toHaveCount(1);
}

test('Ver.298 product: reduced resize reconciler preserves the full existing recovery contract', async ({ page }) => {
  const runtime = await boot(page, 800, 1000);
  expect(runtime.getShellRequests()).toBe(1);
  await openTaskBoard(page);
  const { activeLabel } = await canonicalHeaderState(page);

  await driftRecoverableState(page);
  await page.setViewportSize({ width: 820, height: 1000 });

  await expectCanonicalState(page, activeLabel);
  expect(await page.evaluate(() => window.__v298ResizeCount)).toBeGreaterThan(0);
  expect(runtime.getShellRequests()).toBe(1);
});

test('Ver.298 product: 860/861 round-trip stays canonical with reduced resize reconciliation', async ({ page }) => {
  const runtime = await boot(page, 860, 900);
  await openTaskBoard(page);
  const { activeLabel } = await canonicalHeaderState(page);

  await page.setViewportSize({ width: 861, height: 900 });
  await expect(page.locator('#workMobileHeader')).toBeHidden();
  await expect(page.locator('.work-mobile-status-tabs')).toHaveCount(0);
  await expect(page.locator('.board-view .board-column.work-mobile-active-column')).toHaveCount(0);

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  await expectCanonicalState(page, activeLabel);
  expect(runtime.getShellRequests()).toBe(1);
});

test('Ver.298 product: header creation and global click binding remain startup-owned across resize', async ({ page }) => {
  const runtime = await boot(page, 800, 1000);
  await page.locator('#workMobileHeader').evaluate(node => { node.dataset.v298Identity = 'stable'; });

  await page.setViewportSize({ width: 820, height: 1000 });
  await page.setViewportSize({ width: 800, height: 1000 });
  await expect(page.locator('#workMobileHeader')).toHaveCount(1);
  await expect(page.locator('#workMobileHeader')).toHaveAttribute('data-v298-identity', 'stable');

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="schedule"]')?.click());
  await expect(page.locator('.nav-item[data-layout="schedule"]')).toHaveClass(/active/);
  const scheduleLabel = await page.locator('.nav-item[data-layout="schedule"]').evaluate(node => node.textContent?.trim() || '');
  await expect(page.locator('.work-mobile-title-text')).toHaveText(scheduleLabel);
  expect(runtime.getShellRequests()).toBe(1);
});
