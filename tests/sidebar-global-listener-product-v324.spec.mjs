import { test, expect } from '@playwright/test';

const ROOM = 'test-sidebar-global-listener-product-v324';
const TARGETS = new Set([
  'keydown:handleDocumentKeydown',
  'dragend:handleDocumentDragEnd',
  'drop:handleDocumentDrop'
]);

async function boot(page, width = 1366) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(({ room, targetNames }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });

    const targets = new Set(targetNames);
    const ids = new WeakMap();
    let nextId = 1;
    const active = new Set();
    const adds = {};
    const removes = {};
    const originalAdd = Document.prototype.addEventListener;
    const originalRemove = Document.prototype.removeEventListener;

    const listenerId = listener => {
      if (!listener || (typeof listener !== 'function' && typeof listener !== 'object')) return 'unknown';
      if (!ids.has(listener)) ids.set(listener, nextId++);
      return ids.get(listener);
    };
    const captureValue = options => options === true || Boolean(options && options.capture);
    const targetName = (type, listener) => `${type}:${listener?.name || ''}`;
    const keyFor = (type, listener, options) => `${type}:${listenerId(listener)}:${captureValue(options)}`;

    Document.prototype.addEventListener = function(type, listener, options) {
      const name = targetName(type, listener);
      if (this === document && targets.has(name)) {
        const key = keyFor(type, listener, options);
        active.add(key);
        adds[name] = (adds[name] || 0) + 1;
      }
      return originalAdd.call(this, type, listener, options);
    };

    Document.prototype.removeEventListener = function(type, listener, options) {
      const name = targetName(type, listener);
      if (this === document && targets.has(name)) {
        const key = keyFor(type, listener, options);
        active.delete(key);
        removes[name] = (removes[name] || 0) + 1;
      }
      return originalRemove.call(this, type, listener, options);
    };

    window.__WB_SIDEBAR_LISTENER_V324__ = {
      snapshot() {
        return {
          active: active.size,
          adds: { ...adds },
          removes: { ...removes }
        };
      }
    };
  }, { room: ROOM, targetNames: [...TARGETS] });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForTimeout(250);
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
}

async function dispatchDocumentDrag(page, type) {
  await page.evaluate(eventType => {
    document.dispatchEvent(new DragEvent(eventType, { bubbles: true }));
  }, type);
}

test('Ver.324 product: collapsed desktop and mobile own no sidebar document listeners', async ({ page }) => {
  await boot(page, 1366);
  await settleCollapsed(page);
  expect((await stats(page)).active).toBe(0);

  await page.keyboard.press('ArrowRight');
  await dispatchDocumentDrag(page, 'dragend');
  await dispatchDocumentDrag(page, 'drop');
  expect((await stats(page)).active).toBe(0);
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed');

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('body')).not.toHaveAttribute('data-desktop-sidebar-state', /.+/, { timeout: 3_000 });
  expect((await stats(page)).active).toBe(0);
});

test('Ver.324 product: keyboard expansion owns listeners only until Escape collapse', async ({ page }) => {
  await boot(page, 1366);
  await settleCollapsed(page);

  const today = page.locator('.nav-item[data-layout="today"]').first();
  await today.focus();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
  expect((await stats(page)).active).toBe(3);

  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
  await expect.poll(() => today.evaluate(node => document.activeElement === node)).toBeTruthy();
  expect((await stats(page)).active).toBe(0);
});

test('Ver.324 product: drag reveal retains cleanup through dragend then releases listeners', async ({ page }) => {
  await boot(page, 1366);
  await settleCollapsed(page);

  await page.locator('.sidebar').evaluate(node => {
    node.dispatchEvent(new DragEvent('dragenter', { bubbles: true }));
  });
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
  expect((await stats(page)).active).toBe(3);

  await moveAway(page);
  await dispatchDocumentDrag(page, 'dragend');
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
  expect((await stats(page)).active).toBe(0);
});

test('Ver.324 product: pinning and desktop boundary release transient ownership without accumulation', async ({ page }) => {
  await boot(page, 1366);
  await settleCollapsed(page);

  for (let cycle = 0; cycle < 2; cycle += 1) {
    await page.locator('.sidebar').hover();
    await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
    expect((await stats(page)).active).toBe(3);
    await moveAway(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
    expect((await stats(page)).active).toBe(0);
  }

  await page.locator('.sidebar').hover();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
  await page.locator('.desktop-sidebar-pin-v158').click();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'pinned', { timeout: 3_000 });
  expect((await stats(page)).active).toBe(0);

  await page.locator('.desktop-sidebar-pin-v158').click();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
  await page.locator('.nav-item[data-layout="today"]').first().focus();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
  expect((await stats(page)).active).toBe(3);

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('body')).not.toHaveAttribute('data-desktop-sidebar-state', /.+/, { timeout: 3_000 });
  expect((await stats(page)).active).toBe(0);
});
