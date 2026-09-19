import { test, expect } from '@playwright/test';

const ROOM = 'test-sidebar-observer-v242';
const SIDEBAR_SCRIPT = 'desktop-sidebar-v181.js';
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

async function patchSidebarScript(page, transform) {
  await page.route(`**/${SIDEBAR_SCRIPT}*`, async route => {
    const response = await route.fetch();
    const original = await response.text();
    const next = transform(original);
    expect(next).not.toBe(original);
    await route.fulfill({ response, body: next, contentType: 'application/javascript' });
  });
}

async function boot(page) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await installSafetyBoundary(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => String(window.WORK_BOARD_RELEASE?.version || '') === '241', undefined, { timeout: 8_000 });
  await expect(page.locator('.desktop-sidebar-pin-v158')).toHaveCount(1);
}

async function assertTextOnlyPin(page) {
  const pin = page.locator('.desktop-sidebar-pin-v158');
  await expect(pin).toHaveClass(/desktop-sidebar-pin-text-only-v160/);
  await expect(pin.locator('.desktop-sidebar-pin-icon-v158')).toHaveCount(0);
}

test('Ver.242 audit: current body-wide polish observer fires for unrelated body subtree mutations', async ({ page }) => {
  await patchSidebarScript(page, source => source.replace(
    'const observer = new MutationObserver(() => apply());',
    'const observer = new MutationObserver(() => { window.__sidebarPolishObserverCallsV242 = (window.__sidebarPolishObserverCallsV242 || 0) + 1; apply(); });'
  ));
  await boot(page);
  await assertTextOnlyPin(page);

  await page.evaluate(() => { window.__sidebarPolishObserverCallsV242 = 0; });
  await page.evaluate(() => {
    const node = document.createElement('div');
    node.id = 'unrelated-sidebar-observer-audit-node';
    document.querySelector('main')?.appendChild(node);
  });
  await expect.poll(() => page.evaluate(() => window.__sidebarPolishObserverCallsV242 || 0)).toBeGreaterThan(0);
  await page.locator('#unrelated-sidebar-observer-audit-node').evaluate(node => node.remove());
});

test('Ver.242 audit: disabling only the polish observer still produces text-only pin at startup and through pin toggles', async ({ page }) => {
  await patchSidebarScript(page, source => source.replace(
    'if (document.body) observer.observe(document.body, { childList: true, subtree: true });',
    'if (false && document.body) observer.observe(document.body, { childList: true, subtree: true });'
  ));
  await boot(page);
  await assertTextOnlyPin(page);

  const body = page.locator('body');
  const pin = page.locator('.desktop-sidebar-pin-v158');
  await page.locator('.sidebar').hover();
  await expect(body).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
  await pin.click();
  await expect(body).toHaveAttribute('data-desktop-sidebar-state', 'pinned', { timeout: 3_000 });
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), PIN_KEY)).toBe('1');
  await assertTextOnlyPin(page);

  await pin.click();
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), PIN_KEY)).toBe('0');
  await assertTextOnlyPin(page);
});

test('Ver.242 audit: observer-disabled sidebar keeps text-only pin across navigation and 861/860 transitions', async ({ page }) => {
  await patchSidebarScript(page, source => source.replace(
    'if (document.body) observer.observe(document.body, { childList: true, subtree: true });',
    'if (false && document.body) observer.observe(document.body, { childList: true, subtree: true });'
  ));
  await boot(page);
  await assertTextOnlyPin(page);

  await page.locator('.nav-item[data-layout="tasks"]').first().click();
  await expect(page.locator('.nav-item[data-layout="tasks"]').first()).toHaveClass(/active/);
  await assertTextOnlyPin(page);

  await page.locator('.sidebar').hover();
  const pin = page.locator('.desktop-sidebar-pin-v158');
  await pin.click();
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), PIN_KEY)).toBe('1');

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('body')).not.toHaveClass(/desktop-sidebar-v158/, { timeout: 3_000 });
  await page.setViewportSize({ width: 861, height: 900 });
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'pinned', { timeout: 3_000 });
  await assertTextOnlyPin(page);
});

test('Ver.242 audit: current observer only adds synthetic recovery if a legacy icon is externally reinserted', async ({ page }) => {
  await boot(page);
  await assertTextOnlyPin(page);

  await page.evaluate(() => {
    const pin = document.querySelector('.desktop-sidebar-pin-v158');
    if (!(pin instanceof HTMLElement)) throw new Error('missing pin button');
    const icon = document.createElement('span');
    icon.className = 'desktop-sidebar-pin-icon-v158';
    icon.textContent = '📌';
    pin.prepend(icon);
  });
  await expect(page.locator('.desktop-sidebar-pin-icon-v158')).toHaveCount(0, { timeout: 3_000 });
});
