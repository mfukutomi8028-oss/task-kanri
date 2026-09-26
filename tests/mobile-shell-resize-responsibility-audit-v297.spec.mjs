import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-shell-resize-responsibility-v297';
const MOBILE_SHELL = 'mobile-shell-v234.js';
const SCHEDULE_TARGET = `    requestAnimationFrame(() => {\n      scheduled = false;\n      patchAll();\n    });`;
const SCHEDULE_REPLACEMENT = `    requestAnimationFrame(() => {\n      scheduled = false;\n      patchMobileBoardTabs();\n      syncMobileHeaderTitle();\n      syncMobileMenuButton();\n    });`;

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
    window.__v297ResizeCount = 0;
    window.addEventListener('resize', () => { window.__v297ResizeCount += 1; });
  }, ROOM);

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function narrowResizeResponsibilities(page) {
  let shellRequests = 0;
  let substitutions = 0;
  await page.route(`**/${MOBILE_SHELL}*`, async route => {
    const response = await route.fetch();
    const original = await response.text();
    const body = original.replace(SCHEDULE_TARGET, SCHEDULE_REPLACEMENT);
    if (body === original) throw new Error('Ver.297 resize schedule target is missing');
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
  const audit = await narrowResizeResponsibilities(page);
  await page.goto(`/?room=${ROOM}&v297=${width}x${height}`, { waitUntil: 'domcontentloaded' });
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

async function canonicalHeaderState(page) {
  const activeLabel = await page.locator('.nav-item.active').first().evaluate(node => node.textContent?.trim() || '');
  return { activeLabel };
}

async function driftRecoverableState(page) {
  await page.evaluate(() => {
    const title = document.querySelector('.work-mobile-title-text');
    if (title) title.textContent = 'V297-DRIFT';
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

test('Ver.297 audit: responsibilities 2-4 preserve the full existing resize recovery contract', async ({ page }) => {
  const audit = await boot(page, 800, 1000);
  expect(audit.getShellRequests()).toBe(1);
  expect(audit.getSubstitutions()).toBe(1);
  await openTaskBoard(page);
  const { activeLabel } = await canonicalHeaderState(page);

  await driftRecoverableState(page);
  await page.setViewportSize({ width: 820, height: 1000 });

  await expectCanonicalState(page, activeLabel);
  expect(await page.evaluate(() => window.__v297ResizeCount)).toBeGreaterThan(0);
  expect(audit.getShellRequests()).toBe(1);
});

test('Ver.297 audit: 860/861 round-trip stays canonical with the reduced resize reconciler', async ({ page }) => {
  const audit = await boot(page, 860, 900);
  await openTaskBoard(page);
  const { activeLabel } = await canonicalHeaderState(page);

  await page.setViewportSize({ width: 861, height: 900 });
  await expect(page.locator('#workMobileHeader')).toBeHidden();
  await expect(page.locator('.work-mobile-status-tabs')).toHaveCount(0);
  await expect(page.locator('.board-view .board-column.work-mobile-active-column')).toHaveCount(0);

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  await expectCanonicalState(page, activeLabel);
  expect(audit.getShellRequests()).toBe(1);
});

test('Ver.297 audit: header creation and global click binding remain startup-owned across resize', async ({ page }) => {
  const audit = await boot(page, 800, 1000);
  const initialHeaderHandle = await page.locator('#workMobileHeader').evaluate(node => {
    node.dataset.v297Identity = 'stable';
    return node.dataset.v297Identity;
  });
  expect(initialHeaderHandle).toBe('stable');

  await page.setViewportSize({ width: 820, height: 1000 });
  await page.setViewportSize({ width: 800, height: 1000 });
  await expect(page.locator('#workMobileHeader')).toHaveCount(1);
  await expect(page.locator('#workMobileHeader')).toHaveAttribute('data-v297-identity', 'stable');

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="schedule"]')?.click());
  await expect(page.locator('.nav-item[data-layout="schedule"]')).toHaveClass(/active/);
  const scheduleLabel = await page.locator('.nav-item[data-layout="schedule"]').evaluate(node => node.textContent?.trim() || '');
  await expect(page.locator('.work-mobile-title-text')).toHaveText(scheduleLabel);
  expect(audit.getShellRequests()).toBe(1);
});
