import { test, expect } from '@playwright/test';

const ROOM = 'test-icon-observer-boundary-v269';

async function installAudit(page, { delayFirstScript = false } = {}) {
  await page.addInitScript(room => {
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('systemTaskUser', '福冨');

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });

    const NativeMutationObserver = window.MutationObserver;
    const entries = [];
    const ownedFromStack = stack => String(stack || '').includes('release-manifest.js');

    window.__WB_ICON_OBSERVER_AUDIT_V269__ = {
      entries,
      reset() {
        entries.forEach(entry => {
          entry.callbackCount = 0;
          entry.mutationCount = 0;
          entry.records.length = 0;
        });
      }
    };

    window.MutationObserver = class MutationObserverAuditV269 {
      constructor(callback) {
        const owned = ownedFromStack(new Error().stack);
        const entry = {
          owned,
          callbackCount: 0,
          mutationCount: 0,
          observes: [],
          records: [],
          disconnectCount: 0,
          active: false,
          wrapper: this
        };
        this.__entry = entry;
        this.__native = new NativeMutationObserver(mutations => {
          if (owned) {
            entry.callbackCount += 1;
            entry.mutationCount += mutations.length;
            mutations.forEach(mutation => entry.records.push({
              target: mutation.target?.id ? `#${mutation.target.id}` : String(mutation.target?.nodeName || mutation.target?.className || ''),
              added: mutation.addedNodes.length,
              removed: mutation.removedNodes.length
            }));
          }
          return callback(mutations, this);
        });
        if (owned) entries.push(entry);
      }
      observe(target, options = {}) {
        if (this.__entry.owned) {
          this.__entry.active = true;
          this.__entry.observes.push({
            target: target === document.documentElement ? 'documentElement' : (target?.id ? `#${target.id}` : String(target?.nodeName || '')),
            childList: Boolean(options.childList),
            subtree: Boolean(options.subtree),
            attributes: Boolean(options.attributes)
          });
        }
        return this.__native.observe(target, options);
      }
      disconnect() {
        if (this.__entry.owned) {
          this.__entry.disconnectCount += 1;
          this.__entry.active = false;
        }
        return this.__native.disconnect();
      }
      takeRecords() { return this.__native.takeRecords(); }
    };
  }, ROOM);

  if (delayFirstScript) {
    await page.route(/brand-v185\.js\?v=257$/, async route => {
      await new Promise(resolve => setTimeout(resolve, 700));
      await route.continue();
    });
  }
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page) {
  await installAudit(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.__WB_ICON_OBSERVER_AUDIT_V269__?.entries?.length === 1, undefined, { timeout: 8_000 });
  await page.waitForTimeout(80);
}

async function bootBeforeReady(page) {
  await installAudit(page, { delayFirstScript: true });
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__WB_LEGACY_ICON_OBSERVER_V257__ && window.__WB_ICON_OBSERVER_AUDIT_V269__?.entries?.length === 1, undefined, { timeout: 8_000 });
  const ready = await page.evaluate(() => window.WORK_BOARD_ASSETS_READY === true);
  expect(ready).toBe(false);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const audit = window.__WB_ICON_OBSERVER_AUDIT_V269__;
    const entry = audit.entries[0];
    return {
      count: audit.entries.length,
      callbackCount: entry.callbackCount,
      mutationCount: entry.mutationCount,
      observes: entry.observes,
      records: entry.records.slice(-30),
      disconnectCount: entry.disconnectCount,
      active: entry.active,
      assetsReady: window.WORK_BOARD_ASSETS_READY === true,
      release: window.WORK_BOARD_RELEASE?.version || ''
    };
  });
}

async function currentIconState(page) {
  return page.evaluate(() => ({
    brand: document.querySelector('.brand-mark img')?.getAttribute('src') || '',
    today: document.querySelector('.nav-item[data-layout="today"] .nav-icon img')?.getAttribute('src') || '',
    todos: document.querySelector('.nav-item[data-layout="todos"] .nav-icon img')?.getAttribute('src') || '',
    tasks: document.querySelector('.nav-item[data-layout="tasks"] .nav-icon img')?.getAttribute('src') || '',
    schedule: document.querySelector('.nav-item[data-layout="schedule"] .nav-icon img')?.getAttribute('src') || ''
  }));
}

test('Ver.269 product: broad legacy observer is registered for first paint and disconnected at assets-ready', async ({ page }) => {
  await boot(page);
  const audit = await snapshot(page);
  expect(audit.assetsReady).toBe(true);
  expect(audit.release).toBe('257');
  expect(audit.count).toBe(1);
  expect(audit.observes).toEqual([
    expect.objectContaining({ target: 'documentElement', childList: true, subtree: true, attributes: false })
  ]);
  expect(audit.disconnectCount).toBe(1);
  expect(audit.active).toBe(false);
});

test('Ver.269 product: unrelated post-ready DOM churn no longer wakes the legacy observer', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__WB_ICON_OBSERVER_AUDIT_V269__.reset());
  await page.evaluate(() => {
    const host = document.querySelector('#mainContent') || document.body;
    for (let index = 0; index < 12; index += 1) {
      const node = document.createElement('span');
      node.className = 'v269-unrelated-node';
      host.appendChild(node);
      node.remove();
    }
  });
  await page.waitForTimeout(100);
  const audit = await snapshot(page);
  console.log('V269_ICON_UNRELATED_METRICS', JSON.stringify(audit));
  expect(audit.callbackCount).toBe(0);
  expect(audit.mutationCount).toBe(0);
  expect(audit.active).toBe(false);
});

test('Ver.269 product: pre-ready compatibility still upgrades a legacy image', async ({ page }) => {
  await bootBeforeReady(page);
  const src = await page.evaluate(async () => {
    const img = document.createElement('img');
    img.id = 'v269-pre-ready-legacy';
    img.src = 'assets/nav-today-v87.png';
    document.body.appendChild(img);
    await new Promise(resolve => setTimeout(resolve, 80));
    return img.getAttribute('src') || '';
  });
  expect(src).toContain('assets/nav-today-v169.svg?v=257');
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  const audit = await snapshot(page);
  expect(audit.disconnectCount).toBe(1);
  expect(audit.active).toBe(false);
});

test('Ver.269 product: final sweep catches a legacy image even when observer delivery is unavailable', async ({ page }) => {
  await bootBeforeReady(page);
  const before = await page.evaluate(async () => {
    window.__WB_LEGACY_ICON_OBSERVER_V257__?.disconnect();
    const img = document.createElement('img');
    img.id = 'v269-final-sweep-legacy';
    img.src = 'assets/nav-task-v87.png';
    document.body.appendChild(img);
    await new Promise(resolve => setTimeout(resolve, 60));
    return img.getAttribute('src') || '';
  });
  expect(before).toContain('assets/nav-task-v87.png');

  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await expect(page.locator('#v269-final-sweep-legacy')).toHaveAttribute('src', /assets\/nav-task-v169\.svg\?v=257/);
  const audit = await snapshot(page);
  expect(audit.active).toBe(false);
  expect(audit.disconnectCount).toBeGreaterThanOrEqual(2);
});

test('Ver.269 product: post-ready synthetic legacy images are no longer generically patched', async ({ page }) => {
  await boot(page);
  const src = await page.evaluate(async () => {
    const img = document.createElement('img');
    img.id = 'v269-post-ready-legacy';
    img.src = 'assets/nav-today-v87.png';
    document.body.appendChild(img);
    await new Promise(resolve => setTimeout(resolve, 100));
    return img.getAttribute('src') || '';
  });
  expect(src).toContain('assets/nav-today-v87.png');
});

test('Ver.269 product: current product icons remain canonical after assets-ready and navigation', async ({ page }) => {
  await boot(page);
  let icons = await currentIconState(page);
  expect(icons.brand).toContain('brand-v184.svg');
  expect(icons.today).toContain('nav-today-v169.svg');
  expect(icons.todos).toContain('nav-todo-v168.svg');
  expect(icons.tasks).toContain('nav-task-v169.svg');
  expect(icons.schedule).toContain('nav-schedule-v169.svg');

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await expect(page.locator('#boardView')).toBeVisible();
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="today"]')?.click());
  await expect(page.locator('#todayView')).toBeVisible();

  icons = await currentIconState(page);
  expect(icons.brand).toContain('brand-v184.svg');
  expect(icons.today).toContain('nav-today-v169.svg');
  expect(icons.todos).toContain('nav-todo-v168.svg');
  expect(icons.tasks).toContain('nav-task-v169.svg');
  expect(icons.schedule).toContain('nav-schedule-v169.svg');
});
