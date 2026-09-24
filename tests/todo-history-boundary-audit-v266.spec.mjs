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
    const nativeClearTimeout = window.clearTimeout.bind(window);
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
      },
      fireLatestActiveTimeout() {
        const active = [...timeouts].reverse().find(item => !item.cancelled && !item.fired);
        active?.invoke();
      }
    };

    window.MutationObserver = class MutationObserverAuditV267 {
      constructor(callback) {
        const owned = sourceFromStack(new Error().stack);
        const entry = {
          owned,
          callbackCount: 0,
          mutationCount: 0,
          observes: [],
          records: []
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

    window.requestAnimationFrame = function requestAnimationFrameAuditV267(callback) {
      const owned = sourceFromStack(new Error().stack);
      if (owned) raf.scheduled += 1;
      return nativeRaf(timestamp => {
        if (owned) raf.executed += 1;
        return callback(timestamp);
      });
    };

    window.setInterval = function setIntervalAuditV267(callback, delay, ...args) {
      const owned = sourceFromStack(new Error().stack);
      if (owned) intervals.push({ delay: Number(delay) });
      return nativeSetInterval(callback, delay, ...args);
    };

    window.setTimeout = function setTimeoutAuditV267(callback, delay, ...args) {
      const owned = sourceFromStack(new Error().stack);
      let record = null;
      const wrapped = (...callbackArgs) => {
        if (record) record.fired = true;
        return callback(...callbackArgs);
      };
      const id = nativeSetTimeout(wrapped, delay, ...args);
      if (owned) {
        record = {
          id,
          delay: Number(delay),
          cancelled: false,
          fired: false,
          invoke() { return callback(...args); }
        };
        timeouts.push(record);
      }
      return id;
    };

    window.clearTimeout = function clearTimeoutAuditV267(id) {
      const record = timeouts.find(item => item.id === id);
      if (record) record.cancelled = true;
      return nativeClearTimeout(id);
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
  await page.waitForTimeout(120);
}

async function openLayout(page, layout, visibleSelector) {
  const clicked = await page.evaluate(value => {
    const node = document.querySelector(`.nav-item[data-layout="${value}"]`);
    if (!(node instanceof HTMLElement)) return false;
    node.click();
    return true;
  }, layout);
  expect(clicked, `navigation ${layout} should exist`).toBe(true);
  await expect(page.locator(visibleSelector)).toBeVisible();
  await page.waitForTimeout(100);
}

async function openTodos(page) {
  await openLayout(page, 'todos', '#todoView');
  await expect(page.locator('#todoView .todo-history-v146')).toHaveCount(1);
}

async function resetAudit(page) {
  await page.evaluate(() => window.__WB_TODO_HISTORY_AUDIT_V267__?.reset());
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
      records: entry.records.slice(-40),
      rafScheduled: audit.raf.scheduled,
      rafExecuted: audit.raf.executed,
      intervals: audit.intervals.map(item => item.delay),
      activeTimeouts: audit.timeouts
        .filter(item => !item.cancelled && !item.fired)
        .map(item => item.delay)
    };
  });
}

function priorCompletedTodo(daysAgo, id = 'history-v267') {
  const completed = new Date();
  completed.setHours(12, 0, 0, 0);
  completed.setDate(completed.getDate() - daysAgo);
  const completedAt = completed.getTime();
  return {
    id,
    text: `履歴 ${id}`,
    memo: 'Ver.267 history memo',
    completed: true,
    order: 0,
    owner: '福冨',
    revision: 1,
    createdAt: completedAt - 60_000,
    updatedAt: completedAt,
    completedAt
  };
}

async function writeHistoryAndDispatch(page, records) {
  await page.evaluate(({ room, records }) => {
    const key = `system-task-todos:${room}`;
    const value = JSON.stringify(records);
    localStorage.setItem(key, value);
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
  }, { room: ROOM, records });
}

test('Ver.267 product: history keeps one direct-root observer and one date-boundary timeout', async ({ page }) => {
  await boot(page);
  await openTodos(page);
  const audit = await snapshot(page);

  expect(audit.observerCount).toBe(1);
  expect(audit.observes).toEqual([
    expect.objectContaining({ target: '#todoView', childList: true, subtree: false, attributes: false })
  ]);
  expect(audit.intervals).toEqual([]);
  expect(audit.rafScheduled).toBe(0);
  expect(audit.rafExecuted).toBe(0);
  expect(audit.activeTimeouts.length).toBe(1);
  expect(audit.activeTimeouts[0]).toBeGreaterThanOrEqual(1_000);
  expect(audit.activeTimeouts[0]).toBeLessThanOrEqual(90_000_000);
});

test('Ver.267 product: canonical rerender patches once and stays idle-stable', async ({ page }) => {
  await boot(page);
  await openTodos(page);
  await openLayout(page, 'tasks', '#boardView');
  await resetAudit(page);
  await openTodos(page);

  const first = await snapshot(page);
  await page.waitForTimeout(180);
  const idle = await snapshot(page);
  console.log('V267_HISTORY_RENDER_METRICS', JSON.stringify(first));
  console.log('V267_HISTORY_IDLE_METRICS', JSON.stringify(idle));

  expect(first.callbackCount).toBeGreaterThanOrEqual(1);
  expect(first.callbackCount).toBeLessThanOrEqual(2);
  expect(first.rafScheduled).toBe(0);
  expect(first.rafExecuted).toBe(0);
  expect(idle.callbackCount).toBe(first.callbackCount);
  expect(idle.mutationCount).toBe(first.mutationCount);
  expect(idle.rafScheduled).toBe(0);
  expect(idle.rafExecuted).toBe(0);
});

test('Ver.267 product: unrelated descendant mutation no longer wakes history', async ({ page }) => {
  await boot(page);
  await openTodos(page);
  await resetAudit(page);
  await page.evaluate(() => {
    const host = document.querySelector('#todoView .todo-page');
    const marker = document.createElement('span');
    marker.id = 'v267-unrelated-history-descendant';
    marker.hidden = true;
    host?.appendChild(marker);
  });
  await page.waitForTimeout(120);
  const audit = await snapshot(page);
  console.log('V267_HISTORY_UNRELATED_METRICS', JSON.stringify(audit));
  expect(audit.callbackCount).toBe(0);
  expect(audit.mutationCount).toBe(0);
  expect(audit.rafScheduled).toBe(0);
});

test('Ver.267 product: search visibility and cross-tab storage refresh are event-driven', async ({ page }) => {
  await boot(page);
  await openTodos(page);
  const body = page.locator('#todoView .todo-history-body-v146');
  await expect(body).toBeHidden();

  await writeHistoryAndDispatch(page, [priorCompletedTodo(1, 'history-search-v267')]);
  await expect(page.locator('#todoView [data-history-todo-id="history-search-v267"]')).toHaveCount(1);

  await resetAudit(page);
  const search = page.locator('#todoView .todo-search-input-v145');
  await search.fill('history-search-v267');
  await expect(page.locator('#todoView .todo-history-v146')).toBeVisible();
  await expect(body).toBeVisible();
  await search.fill('');
  await expect(body).toBeHidden();
  let audit = await snapshot(page);
  expect(audit.rafScheduled).toBe(0);
  expect(audit.callbackCount).toBe(0);

  await writeHistoryAndDispatch(page, [priorCompletedTodo(1, 'history-storage-v267')]);
  await expect(page.locator('#todoView .todo-history-v146 .todo-count')).toHaveText('1件');
  await expect(page.locator('#todoView [data-history-todo-id="history-storage-v267"]')).toHaveCount(1);
  audit = await snapshot(page);
  console.log('V267_HISTORY_EVENT_METRICS', JSON.stringify(audit));
  expect(audit.rafScheduled).toBe(0);
  expect(audit.callbackCount).toBe(0);
});

test('Ver.267 product: date-boundary timeout expires old history and rearms without polling', async ({ page }) => {
  await boot(page);
  await openTodos(page);
  await writeHistoryAndDispatch(page, [priorCompletedTodo(7, 'history-boundary-v267')]);
  await expect(page.locator('#todoView .todo-history-v146 .todo-count')).toHaveText('1件');

  await resetAudit(page);
  await page.evaluate(() => {
    const NativeDate = Date;
    const shift = 24 * 60 * 60 * 1000;
    class ShiftedDate extends NativeDate {
      constructor(...args) {
        if (args.length === 0) super(NativeDate.now() + shift);
        else super(...args);
      }
      static now() { return NativeDate.now() + shift; }
    }
    window.Date = ShiftedDate;
    window.__WB_TODO_HISTORY_AUDIT_V267__.fireLatestActiveTimeout();
  });

  await expect(page.locator('#todoView .todo-history-v146 .todo-count')).toHaveText('0件');
  await expect(page.locator('#todoView [data-history-todo-id="history-boundary-v267"]')).toHaveCount(0);
  const audit = await snapshot(page);
  console.log('V267_HISTORY_BOUNDARY_METRICS', JSON.stringify(audit));
  expect(audit.intervals).toEqual([]);
  expect(audit.rafScheduled).toBe(0);
  expect(audit.activeTimeouts.length).toBe(1);
});
