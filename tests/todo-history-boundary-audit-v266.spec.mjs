import { test, expect } from '@playwright/test';

const ROOM = 'test-todo-history-boundary-v267';
const SOURCE = 'todo-history-v146.js';

async function installAudit(page) {
  await page.addInitScript(({ room, source }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });

    const NativeMutationObserver = window.MutationObserver;
    const nativeRaf = window.requestAnimationFrame.bind(window);
    const nativeSetInterval = window.setInterval.bind(window);
    const nativeSetTimeout = window.setTimeout.bind(window);
    const observers = [];
    const raf = { scheduled: 0, executed: 0 };
    const intervals = [];
    const timeouts = [];
    const sourceFromStack = stack => String(stack || '').includes(source);

    window.__WB_TODO_HISTORY_AUDIT_V267__ = {
      observers,
      raf,
      intervals,
      timeouts,
      reset() {
        for (const entry of observers) {
          entry.callbackCount = 0;
          entry.mutationCount = 0;
          entry.records.length = 0;
        }
        raf.scheduled = 0;
        raf.executed = 0;
      }
    };

    window.MutationObserver = class MutationObserverAuditV267 {
      constructor(callback) {
        const owned = sourceFromStack(new Error().stack);
        const entry = { owned, callbackCount: 0, mutationCount: 0, observes: [], records: [] };
        this.__entry = entry;
        this.__native = new NativeMutationObserver(mutations => {
          if (owned) {
            entry.callbackCount += 1;
            entry.mutationCount += mutations.length;
            for (const mutation of mutations) {
              entry.records.push({
                target: mutation.target?.id ? `#${mutation.target.id}` : String(mutation.target?.className || mutation.target?.nodeName || ''),
                added: mutation.addedNodes.length,
                removed: mutation.removedNodes.length
              });
            }
          }
          return callback(mutations, this);
        });
        if (owned) observers.push(entry);
      }
      observe(target, options = {}) {
        if (this.__entry.owned) {
          this.__entry.observes.push({
            target: target?.id ? `#${target.id}` : String(target?.nodeName || ''),
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

    window.requestAnimationFrame = function requestAnimationFrameAuditV267(callback) {
      const owned = sourceFromStack(new Error().stack);
      if (owned) raf.scheduled += 1;
      return nativeRaf(timestamp => {
        if (owned) raf.executed += 1;
        return callback(timestamp);
      });
    };

    window.setInterval = function setIntervalAuditV267(callback, delay, ...args) {
      if (sourceFromStack(new Error().stack)) intervals.push(Number(delay));
      return nativeSetInterval(callback, delay, ...args);
    };

    window.setTimeout = function setTimeoutAuditV267(callback, delay, ...args) {
      if (sourceFromStack(new Error().stack)) timeouts.push(Number(delay));
      return nativeSetTimeout(callback, delay, ...args);
    };
  }, { room: ROOM, source: SOURCE });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page) {
  await installAudit(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.__WB_TODO_HISTORY_AUDIT_V267__?.observers?.length === 1, undefined, { timeout: 8_000 });
}

async function openTodos(page) {
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="todos"]')?.click());
  await expect(page.locator('#todoView')).toBeVisible();
  await expect(page.locator('#todoView .todo-history-v146')).toHaveCount(1);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const audit = window.__WB_TODO_HISTORY_AUDIT_V267__;
    const entry = audit.observers[0];
    return {
      observerCount: audit.observers.length,
      callbackCount: entry.callbackCount,
      mutationCount: entry.mutationCount,
      observes: entry.observes,
      records: entry.records.slice(-20),
      rafScheduled: audit.raf.scheduled,
      rafExecuted: audit.raf.executed,
      intervals: [...audit.intervals],
      timeouts: [...audit.timeouts]
    };
  });
}

test('Ver.267 product: history observes only direct todoView child replacement and uses no rAF or interval', async ({ page }) => {
  await boot(page);
  await openTodos(page);
  const audit = await snapshot(page);
  expect(audit.observerCount).toBe(1);
  expect(audit.observes).toEqual([expect.objectContaining({ target: '#todoView', childList: true, subtree: false, attributes: false })]);
  expect(audit.rafScheduled).toBe(0);
  expect(audit.rafExecuted).toBe(0);
  expect(audit.intervals).toEqual([]);
  expect(audit.timeouts.some(delay => delay > 1_000)).toBe(true);
});

test('Ver.267 product: canonical rerender is adopted once and idle produces no self-induced observer churn', async ({ page }) => {
  await boot(page);
  await openTodos(page);
  await page.evaluate(() => window.__WB_TODO_HISTORY_AUDIT_V267__.reset());
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="todos"]')?.click());
  await expect(page.locator('#todoView .todo-history-v146')).toHaveCount(1);
  await page.waitForTimeout(120);
  const first = await snapshot(page);
  await page.waitForTimeout(180);
  const idle = await snapshot(page);

  expect(first.callbackCount).toBeLessThanOrEqual(2);
  expect(first.rafScheduled).toBe(0);
  expect(idle.callbackCount).toBe(first.callbackCount);
  expect(idle.mutationCount).toBe(first.mutationCount);
  expect(idle.rafScheduled).toBe(0);
});

test('Ver.267 product: unrelated descendant mutation does not wake history observer', async ({ page }) => {
  await boot(page);
  await openTodos(page);
  await page.evaluate(() => window.__WB_TODO_HISTORY_AUDIT_V267__.reset());
  await page.evaluate(() => {
    const pageRoot = document.querySelector('#todoView .todo-page');
    const marker = document.createElement('span');
    marker.textContent = 'unrelated';
    pageRoot?.appendChild(marker);
  });
  await page.waitForTimeout(80);
  const audit = await snapshot(page);
  expect(audit.callbackCount).toBe(0);
  expect(audit.mutationCount).toBe(0);
  expect(audit.rafScheduled).toBe(0);
});

test('Ver.267 product: search remains event-driven and history visibility follows search state', async ({ page }) => {
  await boot(page);
  await openTodos(page);
  const history = page.locator('#todoView .todo-history-v146');
  const input = page.locator('#todoView .todo-search-input-v145');
  await expect(history).toHaveClass(/is-collapsed-v146/);
  await input.fill('test');
  await expect(history).not.toHaveClass(/is-collapsed-v146/);
  await input.fill('');
  await expect(history).toHaveClass(/is-collapsed-v146/);
});
