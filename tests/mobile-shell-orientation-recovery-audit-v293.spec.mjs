import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-shell-orientation-recovery-v294';
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

    window.__v294ViewportEvents = { resize: 0, orientationchange: 0, sequence: [] };
    window.addEventListener('resize', () => {
      window.__v294ViewportEvents.resize += 1;
      window.__v294ViewportEvents.sequence.push('resize');
    });
    window.addEventListener('orientationchange', () => {
      window.__v294ViewportEvents.orientationchange += 1;
      window.__v294ViewportEvents.sequence.push('orientationchange');
    });
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

async function boot(page, width, height) {
  await page.setViewportSize({ width, height });
  await installSafetyBoundary(page);
  const getShellRequests = await countMobileShellRequests(page);
  await page.goto(`/?room=${ROOM}&v294=${width}x${height}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === window.WORK_BOARD_RELEASE?.version,
    undefined, { timeout: 8_000 });
  await page.waitForFunction(() => Number(window.WORK_BOARD_RELEASE?.version || 0) >= 269,
    undefined, { timeout: 8_000 });
  return { getShellRequests };
}

async function setDeviceMetrics(session, width, height, type, angle) {
  await session.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: true,
    screenOrientation: { type, angle }
  });
}

async function resetViewportEvents(page) {
  await page.evaluate(() => {
    window.__v294ViewportEvents = { resize: 0, orientationchange: 0, sequence: [] };
  });
}

async function viewportEvents(page) {
  return page.evaluate(() => ({ ...window.__v294ViewportEvents }));
}

async function expectCanonicalMobileHeader(page) {
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  const activeLabel = await page.locator('.nav-item.active').first().evaluate(node => node.textContent?.trim() || '');
  expect(activeLabel).not.toBe('');
  await expect(page.locator('.work-mobile-title-text')).toHaveText(activeLabel);
  await expect(page.locator('.work-mobile-menu-button')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.work-mobile-menu-button')).toHaveText('☰');
}

async function openTaskBoard(page) {
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await expect(page.locator('.board-view .board-column.work-mobile-active-column')).toHaveCount(1);
}

async function introduceRecoverableDrift(page) {
  await page.evaluate(() => {
    const title = document.querySelector('.work-mobile-title-text');
    if (title) title.textContent = 'V294-DRIFT';
    const menu = document.querySelector('.work-mobile-menu-button');
    if (menu) {
      menu.textContent = '?';
      menu.setAttribute('aria-expanded', 'true');
    }
    document.querySelectorAll('.board-view .board-column').forEach(column => {
      column.classList.remove('work-mobile-active-column');
    });
    document.querySelectorAll('.work-mobile-status-tab').forEach(tab => {
      tab.classList.remove('active');
      tab.setAttribute('aria-pressed', 'false');
    });
  });
}

async function expectCanonicalBoardState(page) {
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await expect(page.locator('.board-view .board-column.work-mobile-active-column')).toHaveCount(1);
  await expect(page.locator('.work-mobile-status-tab.active')).toHaveCount(1);
  await expect(page.locator('.work-mobile-status-tab[aria-pressed="true"]')).toHaveCount(1);
}

test('Ver.294 product: portrait/landscape rotation recovers through resize after orientation listener retirement', async ({ page }) => {
  const runtime = await boot(page, 390, 844);
  expect(runtime.getShellRequests()).toBe(1);
  await expectCanonicalMobileHeader(page);
  await openTaskBoard(page);

  const session = await page.context().newCDPSession(page);
  await setDeviceMetrics(session, 390, 844, 'portraitPrimary', 0);
  await page.waitForTimeout(80);

  await resetViewportEvents(page);
  await introduceRecoverableDrift(page);
  await setDeviceMetrics(session, 844, 390, 'landscapePrimary', 90);

  await expectCanonicalMobileHeader(page);
  await expectCanonicalBoardState(page);
  const landscapeEvents = await viewportEvents(page);
  expect(landscapeEvents.resize).toBeGreaterThan(0);

  await resetViewportEvents(page);
  await introduceRecoverableDrift(page);
  await setDeviceMetrics(session, 390, 844, 'portraitPrimary', 0);

  await expectCanonicalMobileHeader(page);
  await expectCanonicalBoardState(page);
  const portraitEvents = await viewportEvents(page);
  expect(portraitEvents.resize).toBeGreaterThan(0);
  expect(runtime.getShellRequests()).toBe(1);
});

test('Ver.294 product: rotation-style 800 -> 1000 -> 800 boundary is canonical with resize recovery only', async ({ page }) => {
  const runtime = await boot(page, 800, 1000);
  expect(runtime.getShellRequests()).toBe(1);
  await openTaskBoard(page);

  const session = await page.context().newCDPSession(page);
  await setDeviceMetrics(session, 800, 1000, 'portraitPrimary', 0);
  await page.waitForTimeout(80);

  await resetViewportEvents(page);
  await introduceRecoverableDrift(page);
  await setDeviceMetrics(session, 1000, 800, 'landscapePrimary', 90);

  await expect(page.locator('#workMobileHeader')).toBeHidden();
  await expect(page.locator('body')).toHaveClass(/desktop-sidebar-v158/);
  await expect(page.locator('.work-mobile-status-tabs')).toHaveCount(0);
  await expect(page.locator('.board-view .board-column.work-mobile-active-column')).toHaveCount(0);
  const desktopEvents = await viewportEvents(page);
  expect(desktopEvents.resize).toBeGreaterThan(0);

  await resetViewportEvents(page);
  await setDeviceMetrics(session, 800, 1000, 'portraitPrimary', 0);

  await expectCanonicalMobileHeader(page);
  await expectCanonicalBoardState(page);
  const mobileEvents = await viewportEvents(page);
  expect(mobileEvents.resize).toBeGreaterThan(0);
  expect(runtime.getShellRequests()).toBe(1);
});
