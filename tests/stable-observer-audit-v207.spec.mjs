import { test, expect } from '@playwright/test';

const ROOM = 'test-stable-observer-audit-v207';

async function installAuditBoundary(page) {
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });

    const NativeMutationObserver = window.MutationObserver;
    const registry = [];
    window.__WB_STABLE_OBSERVER_AUDIT_V207__ = registry;
    window.MutationObserver = class MutationObserverAuditV207 {
      constructor(callback) {
        const entry = { callbackName: callback?.name || 'anonymous', callbackCount: 0, observes: [], records: [] };
        this.__entry = entry;
        this.__native = new NativeMutationObserver(mutations => {
          entry.callbackCount += 1;
          for (const mutation of mutations) {
            const target = mutation.target;
            entry.records.push({
              targetId: target?.id || '', targetTag: target?.tagName || target?.nodeName || '',
              targetInTaskForm: Boolean(target?.closest?.('#taskForm')) || target?.id === 'taskForm',
              targetInTodayView: Boolean(target?.closest?.('#todayView')) || target?.id === 'todayView'
            });
          }
          return callback(mutations, this);
        });
        registry.push(entry);
      }
      observe(target, options = {}) {
        this.__entry.observes.push({
          target: target === document.body ? 'BODY' : target?.id ? `#${target.id}` : String(target?.tagName || target?.nodeName || 'unknown'),
          childList: Boolean(options.childList), subtree: Boolean(options.subtree), attributes: Boolean(options.attributes)
        });
        return this.__native.observe(target, options);
      }
      disconnect() { return this.__native.disconnect(); }
      takeRecords() { return this.__native.takeRecords(); }
    };
  }, { room: ROOM });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page) {
  await installAuditBoundary(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
}

function stableSnapshot(page) {
  return page.evaluate(() => {
    const registry = window.__WB_STABLE_OBSERVER_AUDIT_V207__ || [];
    const pick = (name, target) => registry.find(entry => entry.callbackName === name
      && entry.observes.some(observe => observe.target === target)) || null;
    return {
      today: pick('scheduleTodayFilters', '#todayView'),
      taskFormStableObservers: registry.filter(entry => ['scheduleFixes', 'scheduleDateInputs', 'scheduleTodayFilters'].includes(entry.callbackName)
        && entry.observes.some(observe => observe.target === '#taskForm')),
      bodyStableObservers: registry.filter(entry => ['scheduleFixes', 'scheduleDateInputs', 'scheduleTodayFilters'].includes(entry.callbackName)
        && entry.observes.some(observe => observe.target === 'BODY'))
    };
  });
}

test('dynamic task start date is handled by date keyboard without a stable taskForm observer', async ({ page }) => {
  await boot(page);
  const stableBefore = await stableSnapshot(page);
  expect(stableBefore.today).toBeNull();
  expect(stableBefore.taskFormStableObservers).toHaveLength(0);
  expect(stableBefore.bodyStableObservers).toHaveLength(0);

  await expect(page.locator('#taskStartDateV167')).toHaveCount(1);
  await page.locator('.nav-item[data-layout="tasks"]').evaluate(button => button.click());
  await page.locator('#newTask').evaluate(button => button.click());
  await expect(page.locator('#taskDialog')).toBeVisible();

  const startDate = page.locator('#taskStartDateV167');
  await expect(startDate).toHaveAttribute('data-date-segment-v127', 'true');
  await expect(startDate).toHaveAttribute('min', '1900-01-01');
  await expect(startDate).toHaveAttribute('max', '9999-12-31');
  await expect(startDate).not.toHaveJSProperty('__stableDateV108', true);

  const stableAfter = await stableSnapshot(page);
  expect(stableAfter.today).toBeNull();
  expect(stableAfter.taskFormStableObservers).toHaveLength(0);
  expect(stableAfter.bodyStableObservers).toHaveLength(0);
});

test('stable Today observer remains retired across product navigation and Today re-render', async ({ page }) => {
  await boot(page);
  expect((await stableSnapshot(page)).today).toBeNull();

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await expect(page.locator('#boardView')).toBeVisible();
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="today"]')?.click());
  await expect(page.locator('#todayView')).toBeVisible();

  const stable = await stableSnapshot(page);
  expect(stable.today).toBeNull();
  expect(stable.taskFormStableObservers).toHaveLength(0);
  expect(stable.bodyStableObservers).toHaveLength(0);
});
