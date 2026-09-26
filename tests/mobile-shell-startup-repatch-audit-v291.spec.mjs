import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-shell-startup-repatch-v292';
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

async function boot(page, width) {
  await page.setViewportSize({ width, height: 900 });
  await installSafetyBoundary(page);
  const getShellRequests = await countMobileShellRequests(page);
  await page.goto(`/?room=${ROOM}&width=${width}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === window.WORK_BOARD_RELEASE?.version,
    undefined, { timeout: 8_000 });
  await page.waitForFunction(() => Number(window.WORK_BOARD_RELEASE?.version || 0) >= 268,
    undefined, { timeout: 8_000 });
  return { getShellRequests };
}

async function expectCanonicalMobileHeader(page) {
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  await expect(page.locator('.work-mobile-menu-button')).toBeVisible();
  await expect(page.locator('.work-mobile-action-button')).toBeVisible();
  await expect(page.locator('.nav-item.active').first()).toBeVisible();
  const activeLabel = await page.locator('.nav-item.active').first().evaluate(node => node.textContent?.trim() || '');
  expect(activeLabel).not.toBe('');
  await expect(page.locator('.work-mobile-title-text')).toHaveText(activeLabel);
}

async function openTaskBoardAndExpectTabs(page) {
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  const tabs = page.locator('.work-mobile-status-tabs');
  const buttons = tabs.locator('.work-mobile-status-tab');
  await expect(tabs).toBeVisible();
  expect(await buttons.count()).toBeGreaterThan(1);
  await expect(page.locator('.board-view .board-column.work-mobile-active-column')).toHaveCount(1);
  const activeLabel = await page.locator('.nav-item.active').first().evaluate(node => node.textContent?.trim() || '');
  await expect(page.locator('.work-mobile-title-text')).toHaveText(activeLabel);
  return { tabs, buttons };
}

for (const width of [390, 860]) {
  test(`Ver.292+ product: ${width}px cold boot is canonical without startup insurance repatches`, async ({ page }) => {
    const runtime = await boot(page, width);

    expect(runtime.getShellRequests()).toBe(1);
    await expectCanonicalMobileHeader(page);

    const before = await page.evaluate(() => ({
      title: document.querySelector('.work-mobile-title-text')?.textContent?.trim() || '',
      activeLayout: document.querySelector('.nav-item.active')?.getAttribute('data-layout') || '',
      menuExpanded: document.querySelector('.work-mobile-menu-button')?.getAttribute('aria-expanded') || '',
      createExpanded: document.querySelector('.work-mobile-action-button')?.getAttribute('aria-expanded') || ''
    }));

    await page.waitForTimeout(1250);

    const after = await page.evaluate(() => ({
      title: document.querySelector('.work-mobile-title-text')?.textContent?.trim() || '',
      activeLayout: document.querySelector('.nav-item.active')?.getAttribute('data-layout') || '',
      menuExpanded: document.querySelector('.work-mobile-menu-button')?.getAttribute('aria-expanded') || '',
      createExpanded: document.querySelector('.work-mobile-action-button')?.getAttribute('aria-expanded') || ''
    }));
    expect(after).toEqual(before);

    const create = page.locator('.work-mobile-action-button');
    await create.click();
    await expect(page.locator('#workMobileCreateMenu')).toHaveClass(/open/);
    await page.locator('[data-mobile-create="task"]').click();
    await expect(page.locator('#taskDialog')).toBeVisible();
    await page.evaluate(() => document.getElementById('taskDialog')?.close());

    await create.click();
    await page.locator('[data-mobile-create="schedule"]').click();
    await expect(page.locator('#scheduleDialog')).toBeVisible({ timeout: 5_000 });
  });
}

test('Ver.292+ product: board-scoped observer updates status tabs after timer retirement', async ({ page }) => {
  const runtime = await boot(page, 430);
  expect(runtime.getShellRequests()).toBe(1);
  const { buttons } = await openTaskBoardAndExpectTabs(page);

  const before = await buttons.first().textContent();
  const beforeCount = Number(String(before || '').match(/(\d+)\s*$/)?.[1] || 0);

  await page.evaluate(() => {
    const column = document.querySelector('.board-view .board-column');
    if (!column) throw new Error('board column is missing');
    const card = document.createElement('div');
    card.className = 'task-card';
    card.dataset.v292ProductCard = 'true';
    card.textContent = 'Ver.292 product card';
    column.appendChild(card);
  });

  await expect.poll(async () => {
    const text = await buttons.first().textContent();
    return Number(String(text || '').match(/(\d+)\s*$/)?.[1] || 0);
  }).toBe(beforeCount + 1);

  await page.evaluate(() => document.querySelector('[data-v292-product-card="true"]')?.remove());
  await expect.poll(async () => {
    const text = await buttons.first().textContent();
    return Number(String(text || '').match(/(\d+)\s*$/)?.[1] || 0);
  }).toBe(beforeCount);
});

test('Ver.292+ product: desktop cold boot late-loads canonical mobile shell once', async ({ page }) => {
  const runtime = await boot(page, 861);
  expect(runtime.getShellRequests()).toBe(0);
  await expect(page.locator('#workMobileHeader')).toHaveCount(0);
  await expect(page.locator('body')).toHaveClass(/desktop-sidebar-v158/);

  await page.setViewportSize({ width: 860, height: 900 });
  await expect.poll(() => runtime.getShellRequests(), { timeout: 5_000 }).toBe(1);
  await expectCanonicalMobileHeader(page);
  await openTaskBoardAndExpectTabs(page);

  const before = await page.evaluate(() => ({
    title: document.querySelector('.work-mobile-title-text')?.textContent?.trim() || '',
    tabs: [...document.querySelectorAll('.work-mobile-status-tab')].map(node => ({
      text: node.textContent?.trim() || '',
      pressed: node.getAttribute('aria-pressed') || ''
    })),
    activeColumns: document.querySelectorAll('.board-view .board-column.work-mobile-active-column').length
  }));

  await page.waitForTimeout(1250);

  const after = await page.evaluate(() => ({
    title: document.querySelector('.work-mobile-title-text')?.textContent?.trim() || '',
    tabs: [...document.querySelectorAll('.work-mobile-status-tab')].map(node => ({
      text: node.textContent?.trim() || '',
      pressed: node.getAttribute('aria-pressed') || ''
    })),
    activeColumns: document.querySelectorAll('.board-view .board-column.work-mobile-active-column').length
  }));
  expect(after).toEqual(before);

  await page.setViewportSize({ width: 861, height: 900 });
  await expect(page.locator('#workMobileHeader')).toBeHidden();
  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  expect(runtime.getShellRequests()).toBe(1);
});
