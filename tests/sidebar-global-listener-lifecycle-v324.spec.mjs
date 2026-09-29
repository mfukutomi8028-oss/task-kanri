import { test, expect } from '@playwright/test';

const ROOM = 'test-sidebar-global-listener-product-v324';
const TRACKED = [
  'handleDocumentKeydownV324',
  'handleDocumentDragEndV324',
  'handleDocumentDropV324'
];

async function installProbe(page, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(({ room, tracked }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });

    const trackedNames = new Set(tracked);
    const active = new Set();
    const metrics = { adds: 0, removes: 0 };
    const originalAdd = EventTarget.prototype.addEventListener;
    const originalRemove = EventTarget.prototype.removeEventListener;

    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (this === document && listener && trackedNames.has(listener.name)) {
        metrics.adds += 1;
        active.add(listener.name);
      }
      return originalAdd.call(this, type, listener, options);
    };

    EventTarget.prototype.removeEventListener = function(type, listener, options) {
      if (this === document && listener && trackedNames.has(listener.name)) {
        metrics.removes += 1;
        active.delete(listener.name);
      }
      return originalRemove.call(this, type, listener, options);
    };

    window.__WB_SIDEBAR_V324_METRICS__ = () => ({
      adds: metrics.adds,
      removes: metrics.removes,
      active: [...active].sort()
    });
  }, { room: ROOM, tracked: TRACKED });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page, width = 1366) {
  await installProbe(page, width);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await page.waitForTimeout(250);
}

async function metrics(page) {
  return page.evaluate(() => window.__WB_SIDEBAR_V324_METRICS__());
}

async function moveAway(page) {
  const viewport = page.viewportSize();
  await page.mouse.move(Math.max(340, viewport.width - 24), 240);
}

async function settleCollapsed(page) {
  await moveAway(page);
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
}

async function dispatchDocumentDrag(page, type) {
  await page.evaluate(eventType => {
    document.dispatchEvent(new DragEvent(eventType, { bubbles: true }));
  }, type);
}

test('Ver.324 product: collapsed desktop sidebar owns no global document listeners', async ({ page }) => {
  await boot(page, 1366);
  await settleCollapsed(page);

  const before = await metrics(page);
  expect(before.active).toEqual([]);

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await dispatchDocumentDrag(page, 'dragend');
  await dispatchDocumentDrag(page, 'drop');
  await page.waitForTimeout(220);

  const after = await metrics(page);
  expect(after.active).toEqual([]);
  expect(after.adds).toBe(before.adds);
  expect(after.removes).toBe(before.removes);
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed');
});

test('Ver.324 product: keyboard expansion binds exactly three listeners until Escape collapse', async ({ page }) => {
  await boot(page, 1366);
  await settleCollapsed(page);
  const before = await metrics(page);

  const today = page.locator('.nav-item[data-layout="today"]').first();
  await today.focus();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });

  const expanded = await metrics(page);
  expect(expanded.adds - before.adds).toBe(3);
  expect(expanded.removes - before.removes).toBe(0);
  expect(expanded.active).toEqual([...TRACKED].sort());

  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
  await expect.poll(() => today.evaluate(node => document.activeElement === node)).toBeTruthy();

  const collapsed = await metrics(page);
  expect(collapsed.adds - before.adds).toBe(3);
  expect(collapsed.removes - before.removes).toBe(3);
  expect(collapsed.active).toEqual([]);
});

test('Ver.324 product: drag reveal owns cleanup only until dragend collapse', async ({ page }) => {
  await boot(page, 1366);
  await settleCollapsed(page);
  const before = await metrics(page);

  await page.locator('.sidebar').evaluate(node => {
    node.dispatchEvent(new DragEvent('dragenter', { bubbles: true }));
  });
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });

  const expanded = await metrics(page);
  expect(expanded.adds - before.adds).toBe(3);
  expect(expanded.active).toEqual([...TRACKED].sort());

  await moveAway(page);
  await dispatchDocumentDrag(page, 'dragend');
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });

  const collapsed = await metrics(page);
  expect(collapsed.removes - before.removes).toBe(3);
  expect(collapsed.active).toEqual([]);
});

test('Ver.324 product: pinning and 861 to 860 transition release transient document ownership', async ({ page }) => {
  await boot(page, 1366);
  await settleCollapsed(page);
  const before = await metrics(page);

  await page.locator('.sidebar').hover();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
  expect((await metrics(page)).active).toEqual([...TRACKED].sort());

  await page.locator('.desktop-sidebar-pin-v158').click();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'pinned', { timeout: 3_000 });
  const pinned = await metrics(page);
  expect(pinned.adds - before.adds).toBe(3);
  expect(pinned.removes - before.removes).toBe(3);
  expect(pinned.active).toEqual([]);

  await page.locator('.desktop-sidebar-pin-v158').click();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
  await page.locator('.nav-item[data-layout="today"]').first().focus();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
  expect((await metrics(page)).active).toEqual([...TRACKED].sort());

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('body')).not.toHaveAttribute('data-desktop-sidebar-state', /.+/, { timeout: 3_000 });
  const mobile = await metrics(page);
  expect(mobile.active).toEqual([]);
  expect(mobile.adds - before.adds).toBe(6);
  expect(mobile.removes - before.removes).toBe(6);
});

test('Ver.324 product: mobile cold boot has zero desktop global listener ownership', async ({ page }) => {
  await boot(page, 800);
  await expect(page.locator('body')).not.toHaveAttribute('data-desktop-sidebar-state', /.+/);
  expect((await metrics(page)).active).toEqual([]);

  await page.keyboard.press('Escape');
  await dispatchDocumentDrag(page, 'dragend');
  await dispatchDocumentDrag(page, 'drop');
  expect((await metrics(page)).active).toEqual([]);
});
