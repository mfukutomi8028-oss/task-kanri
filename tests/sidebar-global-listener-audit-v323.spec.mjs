import { test, expect } from '@playwright/test';

const ROOM = 'test-sidebar-global-listener-product-v324';
const MONITORED_TYPES = ['keydown', 'dragend', 'drop'];

async function installListenerTracker(page, width = 1366) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(({ room, monitoredTypes }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });

    const monitored = new Set(monitoredTypes);
    const originalAdd = EventTarget.prototype.addEventListener;
    const originalRemove = EventTarget.prototype.removeEventListener;
    const ids = new WeakMap();
    const active = new Set();
    let nextId = 1;
    let adds = 0;
    let removes = 0;

    function listenerId(listener) {
      if ((typeof listener !== 'function' && (typeof listener !== 'object' || !listener)) || listener === null) return 0;
      if (!ids.has(listener)) ids.set(listener, nextId++);
      return ids.get(listener);
    }

    function captureOf(options) {
      return typeof options === 'boolean' ? options : Boolean(options?.capture);
    }

    function keyFor(type, listener, options) {
      return `${type}:${listenerId(listener)}:${captureOf(options) ? 1 : 0}`;
    }

    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (this === document && monitored.has(type)) {
        const key = keyFor(type, listener, options);
        if (!active.has(key)) {
          active.add(key);
          adds += 1;
        }
      }
      return originalAdd.call(this, type, listener, options);
    };

    EventTarget.prototype.removeEventListener = function(type, listener, options) {
      if (this === document && monitored.has(type)) {
        const key = keyFor(type, listener, options);
        if (active.delete(key)) removes += 1;
      }
      return originalRemove.call(this, type, listener, options);
    };

    window.__WB_SIDEBAR_LISTENER_V324__ = {
      snapshot() {
        const perType = {};
        for (const type of monitoredTypes) {
          perType[type] = [...active].filter(key => key.startsWith(`${type}:`)).length;
        }
        return { active: active.size, perType, adds, removes };
      }
    };
  }, { room: ROOM, monitoredTypes: MONITORED_TYPES });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page, width = 1366) {
  await installListenerTracker(page, width);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await page.waitForTimeout(300);
}

async function stats(page) {
  return page.evaluate(() => window.__WB_SIDEBAR_LISTENER_V324__.snapshot());
}

async function moveAway(page) {
  const viewport = page.viewportSize();
  await page.mouse.move(Math.max(340, viewport.width - 24), 240);
}

async function settleCollapsed(page) {
  await moveAway(page);
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
  await page.waitForTimeout(260);
}

async function dispatchDocumentDrag(page, type) {
  await page.evaluate(eventType => {
    document.dispatchEvent(new DragEvent(eventType, { bubbles: true }));
  }, type);
}

test('Ver.324 product: collapsed desktop owns no transient sidebar document listeners', async ({ page }) => {
  await boot(page, 1366);
  await settleCollapsed(page);

  const baseline = await stats(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await dispatchDocumentDrag(page, 'dragend');
  await dispatchDocumentDrag(page, 'drop');
  await page.waitForTimeout(240);

  const after = await stats(page);
  expect(after).toEqual(baseline);
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed');
});

test('Ver.324 product: keyboard expansion binds exactly three listeners and Escape releases them', async ({ page }) => {
  await boot(page, 1366);
  await settleCollapsed(page);
  const baseline = await stats(page);

  const today = page.locator('.nav-item[data-layout="today"]').first();
  await today.focus();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });

  const expanded = await stats(page);
  expect(expanded.active - baseline.active).toBe(3);
  expect(expanded.perType.keydown - baseline.perType.keydown).toBe(1);
  expect(expanded.perType.dragend - baseline.perType.dragend).toBe(1);
  expect(expanded.perType.drop - baseline.perType.drop).toBe(1);

  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
  await expect.poll(() => today.evaluate(node => document.activeElement === node)).toBeTruthy();

  const collapsed = await stats(page);
  expect(collapsed.active).toBe(baseline.active);
  expect(collapsed.perType).toEqual(baseline.perType);
  expect(collapsed.adds - baseline.adds).toBe(3);
  expect(collapsed.removes - baseline.removes).toBe(3);
});

test('Ver.324 product: drag reveal keeps cleanup listeners only until dragend collapse', async ({ page }) => {
  await boot(page, 1366);
  await settleCollapsed(page);
  const baseline = await stats(page);

  await page.locator('.sidebar').evaluate(node => {
    node.dispatchEvent(new DragEvent('dragenter', { bubbles: true }));
  });
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
  expect((await stats(page)).active - baseline.active).toBe(3);

  await moveAway(page);
  await dispatchDocumentDrag(page, 'dragend');
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
  expect((await stats(page)).active).toBe(baseline.active);
});

test('Ver.324 product: pinning and 861 to 860 boundary release transient document ownership', async ({ page }) => {
  await boot(page, 1366);
  await settleCollapsed(page);
  const baseline = await stats(page);

  await page.locator('.sidebar').hover();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
  expect((await stats(page)).active - baseline.active).toBe(3);

  await page.locator('.desktop-sidebar-pin-v158').click();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'pinned', { timeout: 3_000 });
  expect((await stats(page)).active).toBe(baseline.active);

  await page.locator('.desktop-sidebar-pin-v158').click();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
  await page.locator('.nav-item[data-layout="today"]').first().focus();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
  expect((await stats(page)).active - baseline.active).toBe(3);

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('body')).not.toHaveAttribute('data-desktop-sidebar-state', /.+/, { timeout: 3_000 });
  expect((await stats(page)).active).toBe(baseline.active);
});

test('Ver.324 product: mobile cold boot never acquires the desktop transient listener set', async ({ page }) => {
  await boot(page, 800);
  await expect(page.locator('body')).not.toHaveAttribute('data-desktop-sidebar-state', /.+/);
  const baseline = await stats(page);

  await page.keyboard.press('Escape');
  await dispatchDocumentDrag(page, 'dragend');
  await dispatchDocumentDrag(page, 'drop');
  await page.waitForTimeout(240);

  expect(await stats(page)).toEqual(baseline);
});
