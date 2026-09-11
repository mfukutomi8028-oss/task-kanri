import { test, expect } from '@playwright/test';

const ROOM = 'test-sidebar-js-behavior';
const PIN_KEY = 'work-board-desktop-sidebar-pinned-v158';

async function installProductionSafetyBoundary(page) {
  await page.addInitScript(({ room }) => {
    try {
      if (!sessionStorage.getItem('sidebar-js-test-seeded')) {
        localStorage.clear();
        localStorage.setItem('systemTaskUser', '福冨');
        localStorage.setItem('systemTaskRoomId', room);
        sessionStorage.setItem('sidebar-js-test-seeded', '1');
      }
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

async function waitForBoot(page) {
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await page.waitForTimeout(300);
}

async function boot(page, width = 1366, height = 900) {
  await page.setViewportSize({ width, height });
  await installProductionSafetyBoundary(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await waitForBoot(page);
}

async function moveAway(page) {
  const viewport = page.viewportSize();
  await page.mouse.move(Math.max(340, viewport.width - 24), 240);
}

async function settleCollapsed(page) {
  await moveAway(page);
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
}

async function expandWithPointer(page) {
  await page.locator('.sidebar').hover();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
}

async function pin(page) {
  await expandWithPointer(page);
  const button = page.locator('.desktop-sidebar-pin-v158');
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'pinned', { timeout: 3_000 });
}

test('sidebar startup keeps one text-only pin control and accessible core navigation labels', async ({ page }) => {
  await boot(page);
  await settleCollapsed(page);

  const pinButton = page.locator('.desktop-sidebar-pin-v158');
  await expect(pinButton).toHaveCount(1);
  await expect(pinButton).toHaveClass(/desktop-sidebar-pin-text-only-v160/);
  await expect(pinButton.locator('.desktop-sidebar-pin-icon-v158')).toHaveCount(0);
  await expect(pinButton).toHaveAttribute('aria-pressed', 'false');

  const today = page.locator('.nav-item[data-layout="today"]').first();
  await expect(today).toHaveAttribute('data-desktop-sidebar-label', /\S+/);
  await expect(today).toHaveAttribute('title', /\S+/);
  await expect(today).toHaveAttribute('aria-label', /\S+/);
});

test('pointer hover expands, pointer navigation releases focus, and leaving collapses again', async ({ page }) => {
  await boot(page);
  await settleCollapsed(page);
  await expandWithPointer(page);

  const today = page.locator('.nav-item[data-layout="today"]').first();
  await today.click();
  await expect.poll(() => today.evaluate(node => document.activeElement === node)).toBeFalsy();

  await moveAway(page);
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
});

test('keyboard focus expands, Escape collapses without discarding keyboard focus', async ({ page }) => {
  await boot(page);
  await settleCollapsed(page);

  const today = page.locator('.nav-item[data-layout="today"]').first();
  await today.focus();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
  await expect.poll(() => today.evaluate(node => document.activeElement === node)).toBeTruthy();

  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
  await expect.poll(() => today.evaluate(node => document.activeElement === node)).toBeTruthy();

  await page.keyboard.press('Tab');
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
});

test('pin state persists through reload and unpin is persisted too', async ({ page }) => {
  await boot(page);
  await settleCollapsed(page);
  await pin(page);

  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), PIN_KEY)).toBe('1');
  const pinButton = page.locator('.desktop-sidebar-pin-v158');
  await expect(pinButton).toHaveAttribute('aria-pressed', 'true');
  await expect(pinButton.locator('.desktop-sidebar-pin-label-v158')).toHaveText('固定を解除');

  await moveAway(page);
  await page.waitForTimeout(350);
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'pinned');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForBoot(page);
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'pinned', { timeout: 3_000 });
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), PIN_KEY)).toBe('1');

  const reloadedPin = page.locator('.desktop-sidebar-pin-v158');
  await reloadedPin.click();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), PIN_KEY)).toBe('0');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForBoot(page);
  await moveAway(page);
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
});

test('861 to 860 removes desktop state and returning to 861 restores a remembered pin', async ({ page }) => {
  await boot(page, 861);
  await settleCollapsed(page);
  await pin(page);
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), PIN_KEY)).toBe('1');

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('body')).not.toHaveClass(/desktop-sidebar-v158/, { timeout: 3_000 });
  await expect(page.locator('body')).not.toHaveAttribute('data-desktop-sidebar-state', /.+/);
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), PIN_KEY)).toBe('1');

  await page.setViewportSize({ width: 861, height: 900 });
  await expect(page.locator('body')).toHaveClass(/desktop-sidebar-v158/, { timeout: 3_000 });
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'pinned', { timeout: 3_000 });
});

test('drag reveal expands an unpinned sidebar and drag end allows it to collapse', async ({ page }) => {
  await boot(page);
  await settleCollapsed(page);

  await page.locator('.sidebar').evaluate(node => {
    node.dispatchEvent(new DragEvent('dragenter', { bubbles: true }));
  });
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });

  await moveAway(page);
  await page.evaluate(() => {
    document.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
  });
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
});
