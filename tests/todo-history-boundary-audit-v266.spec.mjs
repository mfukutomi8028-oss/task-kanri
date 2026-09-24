import { test, expect } from '@playwright/test';

const ROOM = 'test-todo-history-boundary-v266';
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
    const observers = [];
    const raf = { scheduled: 0, executed: 0 };
    const intervals = [];
    const sourceFromStack = stack => String(stack || '').includes(source);

    window.__WB_TODO_HISTORY_AUDIT_V266__ = {
      observers,
      raf,
      intervals,
      reset() {
        for (const entry of observers) {
          entry.callbackCount = 0;
          entry.mutationCount = 0;
          entry.records.length = 0;
        }
        raf.scheduled = 0;
        raf.executed = 0;
      },
      disconnectObservers() {
        observers.forEach(entry => entry.wrapper?.disconnect());
      },
      fireIntervals() {
        intervals.forEach(entry => entry.callback());
      }
    };

    window.MutationObserver = class MutationObserverAuditV266 {
      constructor(callback) {
        const owned = sourceFromStack(new Error().stack);
        const entry = {
          owned,
          callbackCount: 0,
          mutationCount: 0,
          observes: [],
          records: [],
          wrapper: this
        };
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

    window.requestAnimationFrame = function requestAnimationFrameAuditV266(callback) {
      const owned = sourceFromStack(new Error().stack);
      if (owned) raf.scheduled += 1;
      return nativeRaf(timestamp => {
        if (owned) raf.executed += 1;
        return callback(timestamp);
      });
    };

    window.setInterval = function setIntervalAuditV266(callback, delay, ...args) {
      const owned = sourceFromStack(new Error().stack);
      if (owned) intervals.push({ delay: Number(delay), callback: () => callback(...args) });
      return nativeSetInterval(callback, delay, ...args);
    };
  }, { room: ROOM, source: SOURCE });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page) {
  await installAudit(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.__WB_TODO_HISTORY_AUDIT_V266__?.observers?.length === 1, undefined, { timeout: 8_000 });
}

async function openTodos(page) {
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="todos"]')?.click());
  await expect(page.locator('#todoView')).toBeVisible();
  await expect(page.locator('#todoView .todo-history-v146')).toHaveCount(1);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const audit = window.__WB_TODO_HISTORY_AUDIT_V266__;
    const entry = audit.observers[0];
    return {
      observerCount: audit.observers.length,
      callbackCount: entry.callbackCount,
      mutationCount: entry.mutationCount,
      observes: entry.observes,
      records: entry.records.slice(-60),
      rafScheduled: audit.raf.scheduled,
      rafExecuted: audit.raf.executed,
      intervals: audit.intervals.map(item => item.delay)
    };
  });
}

async function isolateEventTriggers(page) {
  await page.evaluate(() => {
    const audit = window.__WB_TODO_HISTORY_AUDIT_V266__;
    audit.disconnectObservers();
    audit.reset();
  });
}

test('Ver.266 audit: history uses one broad subtree observer plus a 60 second interval', async ({ page }) => {
  await boot(page);
  await openTodos(page);
  const audit = await snapshot(page);
  expect(audit.observerCount).toBe(1);
  expect(audit.observes).toEqual([expect.objectContaining({ target: '#todoView', childList: true, subtree: true, attributes: false })]);
  expect(audit.intervals).toContain(60000);
});

test('Ver.266 audit: canonical render enters self-induced observer/rAF churn during idle', async ({ page }) => {
  await boot(page);
  await openTodos(page);
  await page.waitForTimeout(120);
  const first = await snapshot(page);
  await page.waitForTimeout(180);
  const idle = await snapshot(page);

  console.log('V266_HISTORY_RENDER_METRICS', JSON.stringify(first));
  console.log('V266_HISTORY_IDLE_METRICS', JSON.stringify(idle));

  expect(first.callbackCount).toBeGreaterThanOrEqual(1);
  expect(first.rafScheduled).toBeGreaterThanOrEqual(1);
  expect(idle.callbackCount).toBeGreaterThan(first.callbackCount);
  expect(idle.mutationCount).toBeGreaterThan(first.mutationCount);
  expect(idle.rafScheduled).toBeGreaterThan(first.rafScheduled);
});

test('Ver.266 audit: unrelated descendant mutation wakes the history observer', async ({ page }) => {
  await boot(page);
  await openTodos(page);
  await page.evaluate(() => window.__WB_TODO_HISTORY_AUDIT_V266__.reset());
  await page.evaluate(() => {
    const host = document.querySelector('#todoView .todo-page');
    const marker = document.createElement('span');
    marker.id = 'v266-unrelated-history-descendant';
    marker.hidden = true;
    host?.appendChild(marker);
  });
  await page.waitForTimeout(100);
  const audit = await snapshot(page);
  console.log('V266_HISTORY_UNRELATED_METRICS', JSON.stringify(audit));
  expect(audit.callbackCount).toBeGreaterThanOrEqual(1);
  expect(audit.rafScheduled).toBeGreaterThanOrEqual(1);
});

test('Ver.266 audit: search, storage and timer already provide explicit non-DOM refresh triggers', async ({ page }) => {
  await boot(page);
  await openTodos(page);
  await isolateEventTriggers(page);

  const search = page.locator('#todoView .todo-search-input-v145');
  await search.fill('history trigger');
  await page.waitForTimeout(40);
  const afterSearch = await snapshot(page);
  expect(afterSearch.rafScheduled).toBeGreaterThanOrEqual(1);

  await page.evaluate(() => window.__WB_TODO_HISTORY_AUDIT_V266__.reset());
  await page.evaluate(room => {
    window.dispatchEvent(new StorageEvent('storage', { key: `system-task-todos:${room}`, newValue: '[]' }));
  }, ROOM);
  await page.waitForTimeout(40);
  const afterStorage = await snapshot(page);
  expect(afterStorage.rafScheduled).toBeGreaterThanOrEqual(1);

  await page.evaluate(() => window.__WB_TODO_HISTORY_AUDIT_V266__.reset());
  await page.evaluate(() => window.__WB_TODO_HISTORY_AUDIT_V266__.fireIntervals());
  await page.waitForTimeout(40);
  const afterTimer = await snapshot(page);
  expect(afterTimer.rafScheduled).toBeGreaterThanOrEqual(1);

  console.log('V266_HISTORY_EVENT_TRIGGER_METRICS', JSON.stringify({
    search: afterSearch.rafScheduled,
    storage: afterStorage.rafScheduled,
    timer: afterTimer.rafScheduled
  }));
});
