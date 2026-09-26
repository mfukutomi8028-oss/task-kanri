import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-shell-resize-product-gate-v296';
const MOBILE_SHELL = 'mobile-shell-v234.js';
const RESIZE_TARGET = '  window.addEventListener("resize", schedulePatch);';

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

async function installBoardOnlyResizeAudit(page) {
  let substitutions = 0;
  await page.route(`**/${MOBILE_SHELL}*`, async route => {
    const response = await route.fetch();
    const original = await response.text();
    const body = original.replace(`${RESIZE_TARGET}\n`, '  window.addEventListener("resize", scheduleBoardTabs);\n');
    if (body === original) throw new Error('Ver.296 product-gate target is missing');
    substitutions += 1;
    await route.fulfill({ response, body });
  });
  return () => substitutions;
}

async function boot(page) {
  await page.setViewportSize({ width: 800, height: 1000 });
  await installSafetyBoundary(page);
  const getSubstitutions = await installBoardOnlyResizeAudit(page);
  await page.goto(`/?room=${ROOM}&v296=gate`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => Number(window.WORK_BOARD_RELEASE?.version || 0) === 269,
    undefined, { timeout: 8_000 });
  return getSubstitutions;
}

async function openTaskBoard(page) {
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await expect(page.locator('.board-view .board-column.work-mobile-active-column')).toHaveCount(1);
}

test('Ver.296 gate: board-only resize repairs board but loses existing header/menu recovery', async ({ page }) => {
  const getSubstitutions = await boot(page);
  expect(getSubstitutions()).toBe(1);
  await openTaskBoard(page);

  await page.evaluate(() => {
    const title = document.querySelector('.work-mobile-title-text');
    if (title) title.textContent = 'V296-DRIFT';
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

  await page.setViewportSize({ width: 820, height: 1000 });

  await expect(page.locator('.board-view .board-column.work-mobile-active-column')).toHaveCount(1);
  await expect(page.locator('.work-mobile-status-tab.active')).toHaveCount(1);
  await expect(page.locator('.work-mobile-status-tab[aria-pressed="true"]')).toHaveCount(1);

  await expect(page.locator('.work-mobile-title-text')).toHaveText('V296-DRIFT');
  await expect(page.locator('.work-mobile-menu-button')).toHaveText('?');
  await expect(page.locator('.work-mobile-menu-button')).toHaveAttribute('aria-expanded', 'true');
});
