import { test, expect } from '@playwright/test';

const ROOM = 'test-ui-smoke';
const VIEWPORTS = [
  { name: 'pc-wide-1920', width: 1920, height: 1080 },
  { name: 'pc-notebook-1366', width: 1366, height: 768 },
  { name: 'pc-half-980', width: 980, height: 900 },
  { name: 'desktop-boundary-861', width: 861, height: 900 },
  { name: 'mobile-boundary-860', width: 860, height: 900 },
  { name: 'mobile-430', width: 430, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-360', width: 360, height: 800 }
];

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

async function boot(page) {
  const pageErrors = [];
  const failedSameOriginRequests = [];
  const badSameOriginResponses = [];

  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('requestfailed', request => {
    if (!request.url().startsWith('http://127.0.0.1:4173/')) return;
    const failure = request.failure()?.errorText || '';
    const supersededImage = request.resourceType() === 'image' && failure === 'net::ERR_ABORTED';
    if (!supersededImage) {
      failedSameOriginRequests.push(`${request.method()} ${request.url()} ${failure}`);
    }
  });
  page.on('response', response => {
    if (response.url().startsWith('http://127.0.0.1:4173/') && response.status() >= 400) {
      badSameOriginResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });

  const beforeReady = await page.evaluate(() => ({
    ready: window.WORK_BOARD_ASSETS_READY === true,
    guard: [...document.documentElement.classList].some(name => name.startsWith('wb-first-paint-v')),
    bodyVisibility: getComputedStyle(document.body).visibility
  }));
  if (!beforeReady.ready) {
    expect(beforeReady.guard, 'first-paint guard should remain active until assets are ready').toBeTruthy();
    expect(beforeReady.bodyVisibility, 'body must stay hidden while the current release is incomplete').toBe('hidden');
  }

  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });

  // Local static assets should settle almost immediately after the dynamic
  // loader completes. Snapshot the final state instead of waiting indefinitely
  // for an intentionally superseded legacy icon request.
  await page.waitForTimeout(500);

  const runtime = await page.evaluate(() => ({
    version: String(window.WORK_BOARD_RELEASE?.version || ''),
    visibleVersion: document.querySelector('.app-version, .workboard-version-display')?.textContent?.trim() || '',
    summary: window.WORK_BOARD_ASSET_SUMMARY,
    guardLeft: [...document.documentElement.classList].some(name => name.startsWith('wb-first-paint-v')),
    bodyVisibility: getComputedStyle(document.body).visibility,
    brokenImages: [...document.querySelectorAll('.brand-mark img, .nav-icon img')]
      .filter(img => !img.complete || img.naturalWidth === 0)
      .map(img => ({ src: img.getAttribute('src') || '', complete: img.complete, naturalWidth: img.naturalWidth }))
  }));

  expect(runtime.version).toMatch(/^\d+$/);
  expect(runtime.visibleVersion).toBe(`Ver.${runtime.version}`);
  expect(runtime.summary?.styles?.failed).toBe(0);
  expect(runtime.summary?.scripts?.failed).toBe(0);
  expect(runtime.guardLeft).toBeFalsy();
  expect(runtime.bodyVisibility).not.toBe('hidden');
  expect(runtime.brokenImages).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(failedSameOriginRequests).toEqual([]);
  expect(badSameOriginResponses).toEqual([]);

  return runtime;
}

for (const viewport of VIEWPORTS) {
  test(`responsive smoke: ${viewport.name}`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await installProductionSafetyBoundary(page);
    await boot(page);

    const layout = await page.evaluate(() => ({
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      sidebarWidth: document.querySelector('.sidebar')?.getBoundingClientRect().width || 0,
      sidebarState: document.body.dataset.desktopSidebarState || '',
      desktopSidebar: document.body.classList.contains('desktop-sidebar-v158'),
      pinDisplay: getComputedStyle(document.querySelector('.desktop-sidebar-pin-v158')).display
    }));

    expect(layout.scrollWidth, 'today view should not create page-level horizontal overflow').toBeLessThanOrEqual(layout.viewport + 2);
    if (viewport.width >= 861) {
      expect(layout.desktopSidebar).toBeTruthy();
      expect(layout.sidebarState).toBe('collapsed');
      expect(layout.sidebarWidth).toBeGreaterThanOrEqual(66);
      expect(layout.sidebarWidth).toBeLessThanOrEqual(70);
      expect(layout.pinDisplay).not.toBe('none');
    } else {
      expect(layout.desktopSidebar).toBeFalsy();
      expect(layout.sidebarState).toBe('');
      expect(layout.pinDisplay).toBe('none');
    }
  });
}

test('desktop sidebar expands as overlay and only pinned mode reserves width', async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1366, height: 900 });
  await installProductionSafetyBoundary(page);
  await boot(page);

  const sidebar = page.locator('.sidebar');
  const pin = page.locator('.desktop-sidebar-pin-v158');
  const main = page.locator('.main');
  const initialMainLeft = await main.evaluate(node => node.getBoundingClientRect().left);

  await sidebar.hover();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded');
  await page.waitForTimeout(240);
  const expanded = await page.evaluate(() => ({
    sidebarWidth: document.querySelector('.sidebar').getBoundingClientRect().width,
    mainLeft: document.querySelector('.main').getBoundingClientRect().left
  }));
  expect(expanded.sidebarWidth).toBeGreaterThan(260);
  expect(Math.abs(expanded.mainLeft - initialMainLeft), 'hover expansion must overlay instead of shifting main content').toBeLessThanOrEqual(3);

  await main.hover({ position: { x: 350, y: 300 } });
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed');

  await sidebar.hover();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded');
  await pin.click();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'pinned');
  await page.waitForTimeout(240);
  const pinnedMainLeft = await main.evaluate(node => node.getBoundingClientRect().left);
  expect(pinnedMainLeft).toBeGreaterThan(260);

  await pin.click();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed');
});

test('major navigation, new-task dialog, memo view and reload remain usable', async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1366, height: 900 });
  await installProductionSafetyBoundary(page);
  const firstRuntime = await boot(page);

  const clickLayout = async layout => {
    const button = page.locator(`.nav-item[data-layout="${layout}"]`);
    await button.click();
    await expect(button).toHaveClass(/active/);
  };

  await clickLayout('todos');
  await expect(page.locator('#todoView')).toBeVisible();

  await clickLayout('tasks');
  await expect(page.locator('#searchInput')).toBeVisible();
  await expect(page.locator('#quickAddInput')).toBeVisible();

  await page.locator('#newTask').click();
  await expect(page.locator('#taskDialog')).toBeVisible();
  await expect(page.locator('#taskStartDateV167')).toBeAttached();
  await expect(page.locator('#taskDueDate')).toBeAttached();
  await page.locator('#closeTaskDialog').click();
  await expect(page.locator('#taskDialog')).not.toBeVisible();

  await clickLayout('schedule');
  await expect(page.locator('#scheduleView')).toBeVisible();

  const memoNav = page.locator('[data-work-memo-layout]');
  await expect(memoNav).toBeAttached();
  await memoNav.click();
  await expect(memoNav).toHaveClass(/active/);
  await expect(page.locator('#workMemoViewV167')).toBeVisible();

  await clickLayout('today');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === String(window.WORK_BOARD_RELEASE?.version || ''), undefined, { timeout: 8_000 });

  const afterReload = await page.evaluate(() => ({
    version: String(window.WORK_BOARD_RELEASE?.version || ''),
    legacyNavIcons: [...document.querySelectorAll('.nav-icon img')]
      .map(img => img.getAttribute('src') || '')
      .filter(src => /nav-(?:today|task|schedule)-v87\.png|nav-star-menu\.png|nav-done\.png|summary-mine\.png/.test(src))
  }));
  expect(afterReload.version).toBe(firstRuntime.version);
  expect(afterReload.legacyNavIcons).toEqual([]);
});
