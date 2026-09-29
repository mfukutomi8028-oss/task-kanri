import { test, expect } from '@playwright/test';

const ROOM = 'test-sidebar-global-listener-product-v324';

async function installProductProbe(page, { width = 1366 } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(room => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });

    const state = window.__WB_SIDEBAR_GLOBAL_V324__ = {
      adds: { keydown: 0, dragend: 0, drop: 0 },
      removes: { keydown: 0, dragend: 0, drop: 0 },
      callbacks: { keydown: 0, dragend: 0, drop: 0 }
    };
    const originalAdd = EventTarget.prototype.addEventListener;
    const originalRemove = EventTarget.prototype.removeEventListener;
    const wrappedByListener = new WeakMap();
    const trackedTypes = new Set(['keydown', 'dragend', 'drop']);

    function captureKey(options) {
      if (typeof options === 'boolean') return options ? '1' : '0';
      return options?.capture ? '1' : '0';
    }

    EventTarget.prototype.addEventListener = function(type, listener, options) {
      const isTracked = this === document
        && trackedTypes.has(type)
        && typeof listener === 'function'
        && /V324$/.test(listener.name || '');
      if (!isTracked) return originalAdd.call(this, type, listener, options);

      const key = `${type}:${captureKey(options)}`;
      let entries = wrappedByListener.get(listener);
      if (!entries) {
        entries = new Map();
        wrappedByListener.set(listener, entries);
      }
      let wrapped = entries.get(key);
      if (!wrapped) {
        wrapped = function(...args) {
          state.callbacks[type] += 1;
          return listener.apply(this, args);
        };
        entries.set(key, wrapped);
      }
      state.adds[type] += 1;
      return originalAdd.call(this, type, wrapped, options);
    };

    EventTarget.prototype.removeEventListener = function(type, listener, options) {
      const isTracked = this === document
        && trackedTypes.has(type)
        && typeof listener === 'function'
        && /V324$/.test(listener.name || '');
      if (!isTracked) return originalRemove.call(this, type, listener, options);

      const key = `${type}:${captureKey(options)}`;
      const wrapped = wrappedByListener.get(listener)?.get(key) || listener;
      state.removes[type] += 1;
      return originalRemove.call(this, type, wrapped, options);
    };
  }, ROOM);

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page, options = {}) {
  await installProductProbe(page, options);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await page.waitForTimeout(300);
}

async function stats(page) {
  return page.evaluate(() => JSON.parse(JSON.stringify(window.__WB_SIDEBAR_GLOBAL_V324__)));
}

function activeCount(snapshot, type) {
  return snapshot.adds[type] - snapshot.removes[type];
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

test('Ver.324 product: collapsed desktop owns no document keydown/drag lifecycle', async ({ page }) => {
  await boot(page, { width: 1366 });
  await settleCollapsed(page);

  const before = await stats(page);
  expect(activeCount(before, 'keydown')).toBe(0);
  expect(activeCount(before, 'dragend')).toBe(0);
  expect(activeCount(before, 'drop')).toBe(0);

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await dispatchDocumentDrag(page, 'dragend');
  await dispatchDocumentDrag(page, 'drop');

  const after = await stats(page);
  expect(after.callbacks).toEqual(before.callbacks);
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed');
});

test('Ver.324 product: mobile boundary owns no desktop document listeners', async ({ page }) => {
  await boot(page, { width: 800 });
  await expect(page.locator('body')).not.toHaveAttribute('data-desktop-sidebar-state', /.+/);

  const before = await stats(page);
  expect(activeCount(before, 'keydown')).toBe(0);
  expect(activeCount(before, 'dragend')).toBe(0);
  expect(activeCount(before, 'drop')).toBe(0);

  await page.keyboard.press('Escape');
  await dispatchDocumentDrag(page, 'dragend');
  expect((await stats(page)).callbacks).toEqual(before.callbacks);
});

test('Ver.324 product: keyboard expansion binds once and Escape collapses then releases ownership', async ({ page }) => {
  await boot(page, { width: 1366 });
  await settleCollapsed(page);

  const today = page.locator('.nav-item[data-layout="today"]').first();
  const before = await stats(page);
  await today.focus();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });

  const expanded = await stats(page);
  expect(expanded.adds.keydown - before.adds.keydown).toBe(1);
  expect(expanded.adds.dragend - before.adds.dragend).toBe(1);
  expect(expanded.adds.drop - before.adds.drop).toBe(1);
  expect(activeCount(expanded, 'keydown')).toBe(1);

  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
  await expect.poll(() => today.evaluate(node => document.activeElement === node)).toBeTruthy();

  const collapsed = await stats(page);
  expect(collapsed.callbacks.keydown - expanded.callbacks.keydown).toBe(1);
  expect(collapsed.removes.keydown - expanded.removes.keydown).toBe(1);
  expect(collapsed.removes.dragend - expanded.removes.dragend).toBe(1);
  expect(collapsed.removes.drop - expanded.removes.drop).toBe(1);
  expect(activeCount(collapsed, 'keydown')).toBe(0);
});

test('Ver.324 product: drag reveal retains cleanup until dragend then releases all three listeners', async ({ page }) => {
  await boot(page, { width: 1366 });
  await settleCollapsed(page);

  const before = await stats(page);
  await page.locator('.sidebar').evaluate(node => {
    node.dispatchEvent(new DragEvent('dragenter', { bubbles: true }));
  });
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });

  const expanded = await stats(page);
  expect(expanded.adds.keydown - before.adds.keydown).toBe(1);
  expect(activeCount(expanded, 'dragend')).toBe(1);

  await moveAway(page);
  await dispatchDocumentDrag(page, 'dragend');
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });

  const collapsed = await stats(page);
  expect(collapsed.callbacks.dragend - expanded.callbacks.dragend).toBe(1);
  expect(activeCount(collapsed, 'keydown')).toBe(0);
  expect(activeCount(collapsed, 'dragend')).toBe(0);
  expect(activeCount(collapsed, 'drop')).toBe(0);
});

test('Ver.324 product: pinning and 861 to 860 transition release transient ownership', async ({ page }) => {
  await boot(page, { width: 1366 });
  await settleCollapsed(page);

  await page.locator('.sidebar').hover();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
  expect(activeCount(await stats(page), 'keydown')).toBe(1);

  await page.locator('.desktop-sidebar-pin-v158').click();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'pinned', { timeout: 3_000 });
  const pinned = await stats(page);
  expect(activeCount(pinned, 'keydown')).toBe(0);
  expect(activeCount(pinned, 'dragend')).toBe(0);
  expect(activeCount(pinned, 'drop')).toBe(0);

  const callbacksBeforeEscape = { ...pinned.callbacks };
  await page.keyboard.press('Escape');
  expect((await stats(page)).callbacks).toEqual(callbacksBeforeEscape);

  await page.locator('.desktop-sidebar-pin-v158').click();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
  await page.locator('.nav-item[data-layout="today"]').first().focus();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
  expect(activeCount(await stats(page), 'keydown')).toBe(1);

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('body')).not.toHaveAttribute('data-desktop-sidebar-state', /.+/, { timeout: 3_000 });
  const mobile = await stats(page);
  expect(activeCount(mobile, 'keydown')).toBe(0);
  expect(activeCount(mobile, 'dragend')).toBe(0);
  expect(activeCount(mobile, 'drop')).toBe(0);
});
