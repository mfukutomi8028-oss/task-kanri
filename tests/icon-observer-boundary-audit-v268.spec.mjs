import { test, expect } from '@playwright/test';

const ROOM = 'test-icon-observer-boundary-v268';

async function installAudit(page) {
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

    window.__WB_ICON_OBSERVER_AUDIT_V268__ = {
      entries,
      reset() {
        entries.forEach(entry => {
          entry.callbackCount = 0;
          entry.mutationCount = 0;
          entry.records.length = 0;
        });
      }
    };

    window.MutationObserver = class MutationObserverAuditV268 {
      constructor(callback) {
        const owned = ownedFromStack(new Error().stack);
        const entry = { owned, callbackCount: 0, mutationCount: 0, observes: [], records: [], wrapper: this };
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
          this.__entry.observes.push({
            target: target === document.documentElement ? 'documentElement' : (target?.id ? `#${target.id}` : String(target?.nodeName || '')),
            childList: Boolean(options.childList),
            subtree: Boolean(options.subtree),
            attributes: Boolean(options.attributes)
          });
        }
        return this.__native.observe(target, options);
      }
      disconnect() { return this.__native.disconnect(); }
      takeRecords() { return this.__native.takeRecords(); }
    };
  }, ROOM);

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page) {
  await installAudit(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.__WB_ICON_OBSERVER_AUDIT_V268__?.entries?.length === 1, undefined, { timeout: 8_000 });
}

async function snapshot(page) {
  return page.evaluate(() => {
    const audit = window.__WB_ICON_OBSERVER_AUDIT_V268__;
    const entry = audit.entries[0];
    return {
      count: audit.entries.length,
      callbackCount: entry.callbackCount,
      mutationCount: entry.mutationCount,
      observes: entry.observes,
      records: entry.records.slice(-30),
      assetsReady: window.WORK_BOARD_ASSETS_READY === true
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

test('Ver.268 audit: legacy icon observer remains documentElement-subtree scoped after assets-ready', async ({ page }) => {
  await boot(page);
  const audit = await snapshot(page);
  expect(audit.assetsReady).toBe(true);
  expect(audit.count).toBe(1);
  expect(audit.observes).toEqual([expect.objectContaining({ target: 'documentElement', childList: true, subtree: true, attributes: false })]);
});

test('Ver.268 audit: unrelated post-ready DOM churn still wakes the legacy icon observer', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__WB_ICON_OBSERVER_AUDIT_V268__.reset());
  await page.evaluate(() => {
    const host = document.querySelector('#mainContent') || document.body;
    for (let index = 0; index < 12; index += 1) {
      const node = document.createElement('span');
      node.className = 'v268-unrelated-node';
      host.appendChild(node);
      node.remove();
    }
  });
  await page.waitForTimeout(80);
  const audit = await snapshot(page);
  console.log('V268_ICON_UNRELATED_METRICS', JSON.stringify(audit));
  expect(audit.callbackCount).toBeGreaterThan(0);
  expect(audit.mutationCount).toBeGreaterThan(0);
});

test('Ver.268 audit: current product icons are already canonical once assets-ready fires', async ({ page }) => {
  await boot(page);
  const icons = await currentIconState(page);
  expect(icons.brand).toContain('brand-v184.svg');
  expect(icons.today).toContain('nav-today-v169.svg');
  expect(icons.todos).toContain('nav-todo-v168.svg');
  expect(icons.tasks).toContain('nav-task-v169.svg');
  expect(icons.schedule).toContain('nav-schedule-v169.svg');
});

test('Ver.268 audit: observer unique late behavior is upgrading a synthetic legacy image after ready', async ({ page }) => {
  await boot(page);
  const src = await page.evaluate(async () => {
    const img = document.createElement('img');
    img.id = 'v268-late-legacy';
    img.src = 'assets/nav-today-v87.png';
    document.body.appendChild(img);
    await new Promise(resolve => setTimeout(resolve, 60));
    return img.getAttribute('src') || '';
  });
  expect(src).toContain('assets/nav-today-v169.svg?v=256');
});

test('Ver.268 audit: after disconnect, normal navigation keeps canonical icon ownership intact', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__WB_LEGACY_ICON_OBSERVER_V256__?.disconnect());
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await expect(page.locator('#boardView')).toBeVisible();
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="today"]')?.click());
  await expect(page.locator('#todayView')).toBeVisible();
  const icons = await currentIconState(page);
  expect(icons.brand).toContain('brand-v184.svg');
  expect(icons.today).toContain('nav-today-v169.svg');
  expect(icons.todos).toContain('nav-todo-v168.svg');
  expect(icons.tasks).toContain('nav-task-v169.svg');
  expect(icons.schedule).toContain('nav-schedule-v169.svg');
});
