import { test, expect } from '@playwright/test';

// Run in an isolated local-only room; never write to production Firebase.
async function boot(page, room) {
  await page.addInitScript(roomId => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', roomId);
    localStorage.setItem('system-task-users:' + roomId, JSON.stringify(['福冨']));
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get() { return null; }, set() {}
    });
  }, room);
  await page.route('https://www.gstatic.com/firebasejs/**', r => r.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    r => r.abort('blockedbyclient'));
  await page.goto('/?room=' + room, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  const style = page.locator('link[data-workboard-style="ui-motion-v533.css"]');
  await expect(style).toHaveAttribute('data-loaded', 'true');
  await expect(style).toHaveCount(1);
}

for (const width of [1366, 390]) {
  test('Ver.533 navigation receives one subtle view transition at width ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await boot(page, 'test-v533-motion-' + width);
    await page.locator('#todayView [data-layout-jump="todos"]').first().click();
    await expect(page.locator('#todoView')).toBeVisible();
    const motion = await page.locator('#todoView').evaluate(el => ({
      animation: getComputedStyle(el).animationName,
      duration: getComputedStyle(el).animationDuration,
      transform: getComputedStyle(el).transform
    }));
    expect(motion.animation).toContain('wm-view-arrive-v533');
    expect(parseFloat(motion.duration)).toBeGreaterThan(0);
    // View animation never creates a transformed containing block.
    expect(motion.transform).toBe('none');
  });
}

test('Ver.533 dialog opens without replacing its natural positioning', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await boot(page, 'test-v533-dialog');
  const modal = page.locator('#userManageDialog');
  await page.evaluate(() => document.getElementById('userManageDialog').showModal());
  await expect(modal).toBeVisible();
  const s = await modal.evaluate(el => ({
    animation: getComputedStyle(el).animationName,
    transform: getComputedStyle(el).transform,
    rect: el.getBoundingClientRect().toJSON(),
    viewport: window.innerWidth
  }));
  expect(s.animation).toContain('wm-dialog-fade-v533');
  expect(s.transform).toBe('none');
  expect(Math.abs(s.rect.left + s.rect.width / 2 - s.viewport / 2)).toBeLessThan(30);
});

test('Ver.533 respects OS reduced motion without hiding content or disabling inputs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page, 'test-v533-reduced');
  await page.locator('#todayView [data-layout-jump="todos"]').first().click();
  await expect(page.locator('#todoView')).toBeVisible();
  const viewName = await page.locator('#todoView')
    .evaluate(el => getComputedStyle(el).animationName);
  expect(viewName).toBe('none');
  const nav = await page.locator('.nav-item').first()
    .evaluate(el => getComputedStyle(el).transitionDuration);
  expect(nav.split(',').every(v => parseFloat(v) === 0)).toBe(true);
  await page.evaluate(() => document.getElementById('userManageDialog').showModal());
  const dialogName = await page.locator('#userManageDialog')
    .evaluate(el => getComputedStyle(el).animationName);
  expect(dialogName).toBe('none');
  await expect(page.locator('#userManageDialog')).toBeVisible();
});

// Desktop navigation is a hover-expand sidebar. Wait for the real interactive
// state before each click so pointerdown/up cannot straddle its CSS transition.
async function navigateDesktopSidebar(page, selector) {
  const sidebar = page.locator('.sidebar');
  await sidebar.hover();
  await expect(page.locator('body')).toHaveAttribute(
    'data-desktop-sidebar-state', /^(expanded|pinned)$/
  );
  const nav = sidebar.locator(selector);
  await expect(nav).toBeVisible();
  await nav.click();
}

test('Ver.533 task, dashboard, schedule and memo views share the same quiet transition', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await boot(page, 'test-v533-view-modes');

  await navigateDesktopSidebar(page, '.nav-item[data-layout="tasks"]');
  await expect(page.locator('#boardView')).toBeVisible();
  expect(await page.locator('#boardView').evaluate(el => getComputedStyle(el).animationName))
    .toContain('wm-view-arrive-v533');

  await page.locator('.stat-view-button[data-stat-layout="dashboard"]').click();
  await expect(page.locator('#dashboardView')).toBeVisible();
  expect(await page.locator('#dashboardView').evaluate(el => getComputedStyle(el).animationName))
    .toContain('wm-view-arrive-v533');

  await navigateDesktopSidebar(page, '.nav-item[data-layout="schedule"]');
  await expect(page.locator('#scheduleView')).toBeVisible();
  expect(await page.locator('#scheduleView').evaluate(el => getComputedStyle(el).animationName))
    .toContain('wm-view-arrive-v533');

  await navigateDesktopSidebar(page, '[data-work-memo-layout]');
  await expect(page.locator('#workMemoViewV167')).toBeVisible();
  expect(await page.locator('#workMemoViewV167').evaluate(el => getComputedStyle(el).animationName))
    .toContain('wm-view-arrive-v533');
});
