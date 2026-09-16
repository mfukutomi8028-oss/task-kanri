import { test, expect } from '@playwright/test';

const ROOM = 'test-stable-observer-audit-v207';

async function installAuditBoundary(page) {
  await page.addInitScript(({ room }) => {
    try {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
    } catch {}

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });

    const NativeMutationObserver = window.MutationObserver;
    const registry = [];
    window.__WB_STABLE_OBSERVER_AUDIT_V207__ = registry;

    const collectIds = node => {
      if (!node || node.nodeType !== 1) return [];
      const ids = [];
      if (node.id) ids.push(node.id);
      node.querySelectorAll?.('[id]').forEach(item => ids.push(item.id));
      return ids;
    };

    window.MutationObserver = class MutationObserverAuditV207 {
      constructor(callback) {
        const entry = {
          callbackName: callback?.name || 'anonymous',
          callbackCount: 0,
          observes: [],
          records: []
        };
        this.__entry = entry;
        this.__native = new NativeMutationObserver(mutations => {
          entry.callbackCount += 1;
          for (const mutation of mutations) {
            const target = mutation.target;
            entry.records.push({
              targetId: target?.id || '',
              targetTag: target?.tagName || target?.nodeName || '',
              targetInTaskForm: Boolean(target?.closest?.('#taskForm')),
              targetInTodayView: Boolean(target?.closest?.('#todayView')) || target?.id === 'todayView',
              addedIds: [...mutation.addedNodes].flatMap(collectIds)
            });
          }
          return callback(mutations, this);
        });
        registry.push(entry);
      }

      observe(target, options = {}) {
        this.__entry.observes.push({
          target: target === document.body
            ? 'BODY'
            : target?.id
              ? `#${target.id}`
              : String(target?.tagName || target?.nodeName || 'unknown'),
          childList: Boolean(options.childList),
          subtree: Boolean(options.subtree),
          attributes: Boolean(options.attributes)
        });
        return this.__native.observe(target, options);
      }

      disconnect() { return this.__native.disconnect(); }
      takeRecords() { return this.__native.takeRecords(); }
    };
  }, { room: ROOM });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page) {
  await installAuditBoundary(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await page.waitForFunction(() => {
    const registry = window.__WB_STABLE_OBSERVER_AUDIT_V207__ || [];
    return registry.some(entry => entry.callbackName === 'scheduleFixes'
      && entry.observes.some(observe => observe.target === 'BODY'));
  });
}

function stableSnapshot(page) {
  return page.evaluate(() => {
    const registry = window.__WB_STABLE_OBSERVER_AUDIT_V207__ || [];
    return registry.find(entry => entry.callbackName === 'scheduleFixes'
      && entry.observes.some(observe => observe.target === 'BODY')) || null;
  });
}

test('dynamic task start-date insertion is contained inside #taskForm', async ({ page }) => {
  await boot(page);

  await expect(page.locator('#taskStartDateV167')).toHaveCount(1);
  await expect.poll(async () => {
    const stable = await stableSnapshot(page);
    return stable?.records.some(record =>
      record.targetInTaskForm && record.addedIds.includes('taskStartDateV167')) || false;
  }).toBe(true);
});

test('Today re-render child-list mutations are contained inside #todayView', async ({ page }) => {
  await boot(page);

  await page.evaluate(() => {
    const registry = window.__WB_STABLE_OBSERVER_AUDIT_V207__ || [];
    const stable = registry.find(entry => entry.callbackName === 'scheduleFixes'
      && entry.observes.some(observe => observe.target === 'BODY'));
    if (stable) stable.records.length = 0;
  });

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await expect(page.locator('#boardView')).toBeVisible();
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="today"]')?.click());
  await expect(page.locator('#todayView')).toBeVisible();

  await expect.poll(async () => {
    const stable = await stableSnapshot(page);
    return stable?.records.some(record => record.targetInTodayView) || false;
  }).toBe(true);
});
