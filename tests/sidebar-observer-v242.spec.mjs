import { test, expect } from '@playwright/test';

const ROOM = 'test-sidebar-observer-v242';
const CURRENT_SIDEBAR = 'desktop-sidebar-v242.js';
const RETIRED_SIDEBAR = 'desktop-sidebar-v181.js';
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

async function boot(page, width = 1366) {
  await page.setViewportSize({ width, height: 900 });
  await installSafetyBoundary(page);
  const requests = [];
  page.on('request', request => {
    try { requests.push(new URL(request.url()).pathname); } catch (_) {}
  });
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => String(window.WORK_BOARD_RELEASE?.version || '') === '242', undefined, { timeout: 8_000 });
  await expect(page.locator('.desktop-sidebar-pin-v158')).toHaveCount(1);
  return requests;
}

async function assertTextOnlyPin(page) {
  const pin = page.locator('.desktop-sidebar-pin-v158');
  await expect(pin).toHaveClass(/desktop-sidebar-pin-text-only-v160/);
  await expect(pin.locator('.desktop-sidebar-pin-icon-v158')).toHaveCount(0);
}

test('Ver.242 product: semantic sidebar loads once and retired Ver.181 is not requested', async ({ page }) => {
  const requests = await boot(page);
  const currentRequests = requests.filter(path => path.endsWith(`/${CURRENT_SIDEBAR}`));
  const retiredRequests = requests.filter(path => path.endsWith(`/${RETIRED_SIDEBAR}`));

  expect(currentRequests).toHaveLength(1);
  expect(retiredRequests).toHaveLength(0);
  await assertTextOnlyPin(page);
});

test('Ver.242 product: unrelated DOM changes no longer recover a synthetic legacy icon, while pageshow still does', async ({ page }) => {
  await boot(page);
  await assertTextOnlyPin(page);

  await page.evaluate(() => {
    const pin = document.querySelector('.desktop-sidebar-pin-v158');
    if (!(pin instanceof HTMLElement)) throw new Error('missing pin button');
    const icon = document.createElement('span');
    icon.className = 'desktop-sidebar-pin-icon-v158';
    icon.textContent = '📌';
    pin.prepend(icon);

    const unrelated = document.createElement('div');
    unrelated.id = 'unrelated-sidebar-observer-v242-node';
    document.querySelector('main')?.appendChild(unrelated);
  });

  await page.waitForTimeout(100);
  await expect(page.locator('.desktop-sidebar-pin-icon-v158')).toHaveCount(1);

  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow')));
  await expect(page.locator('.desktop-sidebar-pin-icon-v158')).toHaveCount(0, { timeout: 3_000 });
  await assertTextOnlyPin(page);
});

test('Ver.242 product: pin interactions and navigation remain text-only without the body observer', async ({ page }) => {
  await boot(page);
  const body = page.locator('body');
  const pin = page.locator('.desktop-sidebar-pin-v158');

  await page.locator('.sidebar').hover();
  await expect(body).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
  await pin.click();
  await expect(body).toHaveAttribute('data-desktop-sidebar-state', 'pinned', { timeout: 3_000 });
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), PIN_KEY)).toBe('1');
  await assertTextOnlyPin(page);

  await page.locator('.nav-item[data-layout="tasks"]').first().click();
  await expect(page.locator('.nav-item[data-layout="tasks"]').first()).toHaveClass(/active/);
  await assertTextOnlyPin(page);

  await pin.click();
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), PIN_KEY)).toBe('0');
  await assertTextOnlyPin(page);
});

test('Ver.242 product: 861/860 round trip preserves pinned state and text-only presentation', async ({ page }) => {
  await boot(page, 861);
  await page.locator('.sidebar').hover();
  const pin = page.locator('.desktop-sidebar-pin-v158');
  await pin.click();
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), PIN_KEY)).toBe('1');

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('body')).not.toHaveClass(/desktop-sidebar-v158/, { timeout: 3_000 });
  await expect(page.locator('body')).not.toHaveAttribute('data-desktop-sidebar-state', /.+/);
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), PIN_KEY)).toBe('1');

  await page.setViewportSize({ width: 861, height: 900 });
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'pinned', { timeout: 3_000 });
  await assertTextOnlyPin(page);
});
