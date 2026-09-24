import { test, expect } from '@playwright/test';

const ROOM = 'test-todo-observer-boundary-v265';
const SOURCES = ['todo-controls-v144.js', 'todo-tools-v145.js', 'todo-preview-v147.js'];

async function installAuditBoundary(page) {
  await page.addInitScript(({ room, sources }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });

    const NativeMutationObserver = window.MutationObserver;
    const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    const registry = [];
    const raf = Object.fromEntries(sources.map(source => [source, { scheduled: 0, executed: 0 }]));

    const sourceFromStack = stack => sources.find(source => String(stack || '').includes(source)) || '';
    const targetLabel = target => {
      if (target === document.body) return 'BODY';
      if (target?.id) return `#${target.id}`;
      const tag = String(target?.tagName || target?.nodeName || 'unknown');
      const classes = typeof target?.className === 'string'
        ? target.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.')
        : '';
      return classes ? `${tag}.${classes}` : tag;
    };

    window.__WB_TODO_OBSERVER_AUDIT_V265__ = { registry, raf, sources };

    window.MutationObserver = class MutationObserverAuditV265 {
      constructor(callback) {
        const source = sourceFromStack(new Error().stack);
        const entry = {
          source,
          callbackCount: 0,
          mutationCount: 0,
          observes: [],
          records: []
        };
        this.__entry = entry;
        this.__native = new NativeMutationObserver(mutations => {
          entry.callbackCount += 1;
          entry.mutationCount += mutations.length;
          for (const mutation of mutations) {
            entry.records.push({
              target: targetLabel(mutation.target),
              added: mutation.addedNodes.length,
              removed: mutation.removedNodes.length
            });
          }
          return callback(mutations, this);
        });
        registry.push(entry);
      }

      observe(target, options = {}) {
        this.__entry.observes.push({
          target: targetLabel(target),
          childList: Boolean(options.childList),
          subtree: Boolean(options.subtree),
          attributes: Boolean(options.attributes)
        });
        return this.__native.observe(target, options);
      }

      disconnect() { return this.__native.disconnect(); }
      takeRecords() { return this.__native.takeRecords(); }
    };

    window.requestAnimationFrame = function requestAnimationFrameAuditV265(callback) {
      const source = sourceFromStack(new Error().stack);
      if (source) raf[source].scheduled += 1;
      return nativeRequestAnimationFrame(timestamp => {
        if (source) raf[source].executed += 1;
        return callback(timestamp);
      });
    };
  }, { room: ROOM, sources: SOURCES });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page) {
  await installAuditBoundary(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const audit = window.__WB_TODO_OBSERVER_AUDIT_V265__;
    const targetEntries = (audit?.registry || []).filter(entry => audit.sources.includes(entry.source));
    return targetEntries.length >= 4;
  }, undefined, { timeout: 8_000 });
  await page.waitForTimeout(150);
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
  await page.waitForTimeout(120);
}

async function resetAudit(page) {
  await page.evaluate(() => {
    const audit = window.__WB_TODO_OBSERVER_AUDIT_V265__;
    for (const entry of audit?.registry || []) {
      entry.callbackCount = 0;
      entry.mutationCount = 0;
      entry.records.length = 0;
    }
    for (const stat of Object.values(audit?.raf || {})) {
      stat.scheduled = 0;
      stat.executed = 0;
    }
  });
}

async function snapshot(page) {
  return page.evaluate(() => {
    const audit = window.__WB_TODO_OBSERVER_AUDIT_V265__;
    const entries = (audit?.registry || [])
      .filter(entry => audit.sources.includes(entry.source))
      .map(entry => ({
        source: entry.source,
        callbackCount: entry.callbackCount,
        mutationCount: entry.mutationCount,
        observes: entry.observes,
        records: entry.records.slice(-40)
      }));
    const bySource = Object.fromEntries(audit.sources.map(source => {
      const owned = entries.filter(entry => entry.source === source);
      const records = owned.flatMap(entry => entry.records);
      const recordTargets = records.reduce((counts, record) => {
        counts[record.target] = (counts[record.target] || 0) + 1;
        return counts;
      }, {});
      return [source, {
        observers: owned.length,
        callbackCount: owned.reduce((sum, entry) => sum + entry.callbackCount, 0),
        mutationCount: owned.reduce((sum, entry) => sum + entry.mutationCount, 0),
        rafScheduled: audit.raf[source].scheduled,
        rafExecuted: audit.raf[source].executed,
        targets: owned.flatMap(entry => entry.observes.map(observe => observe.target)),
        scopes: owned.flatMap(entry => entry.observes),
        recordTargets
      }];
    }));
    return { entries, bySource };
  });
}

function expectDirectRootObserver(source) {
  expect(source.scopes.length).toBeGreaterThanOrEqual(1);
  for (const scope of source.scopes) {
    expect(scope).toEqual(expect.objectContaining({ childList: true, subtree: false, attributes: false }));
  }
}

function expectIdleStable(before, after, sourceName) {
  expect(after.bySource[sourceName].callbackCount).toBe(before.bySource[sourceName].callbackCount);
  expect(after.bySource[sourceName].mutationCount).toBe(before.bySource[sourceName].mutationCount);
  expect(after.bySource[sourceName].rafScheduled).toBe(before.bySource[sourceName].rafScheduled);
  expect(after.bySource[sourceName].rafExecuted).toBe(before.bySource[sourceName].rafExecuted);
}

test('Ver.265 product: three ToDo sidecars keep four observers but only on direct view roots', async ({ page }) => {
  await boot(page);
  const audit = await snapshot(page);

  expect(audit.bySource['todo-controls-v144.js'].observers).toBe(2);
  expect(audit.bySource['todo-controls-v144.js'].targets.sort()).toEqual(['#todayView', '#todoView']);
  expect(audit.bySource['todo-tools-v145.js'].observers).toBe(1);
  expect(audit.bySource['todo-tools-v145.js'].targets).toEqual(['#todoView']);
  expect(audit.bySource['todo-preview-v147.js'].observers).toBe(1);
  expect(audit.bySource['todo-preview-v147.js'].targets).toEqual(['#todayView']);

  expectDirectRootObserver(audit.bySource['todo-controls-v144.js']);
  expectDirectRootObserver(audit.bySource['todo-tools-v145.js']);
  expectDirectRootObserver(audit.bySource['todo-preview-v147.js']);
});

test('Ver.265 product: canonical ToDo and Today re-renders adopt once without observer-owned rAF churn', async ({ page }) => {
  await boot(page);

  await openLayout(page, 'todos', '#todoView');
  await page.locator('#todayTodoInput').fill('Ver.265 observer product todo');
  await page.locator('[data-todo-form]').evaluate(form => form.requestSubmit());
  await expect(page.locator('#todoView .todo-item')).toHaveCount(1);
  await page.waitForTimeout(150);

  await openLayout(page, 'tasks', '#boardView');
  await resetAudit(page);
  await openLayout(page, 'todos', '#todoView');
  await expect(page.locator('#todoView .todo-state-toggle-v144')).toHaveCount(1);
  await expect(page.locator('#todoView .todo-tools-v145')).toHaveCount(1);
  const todo = await snapshot(page);
  await page.waitForTimeout(180);
  const todoIdle = await snapshot(page);
  console.log('V265_TODO_RERENDER_METRICS', JSON.stringify(todo.bySource));
  console.log('V265_TODO_IDLE_METRICS', JSON.stringify(todoIdle.bySource));

  for (const source of ['todo-controls-v144.js', 'todo-tools-v145.js']) {
    expect(todo.bySource[source].callbackCount).toBeGreaterThanOrEqual(1);
    expect(todo.bySource[source].callbackCount).toBeLessThanOrEqual(2);
    expect(todo.bySource[source].rafScheduled).toBe(0);
    expect(todo.bySource[source].rafExecuted).toBe(0);
    expectIdleStable(todo, todoIdle, source);
  }

  await openLayout(page, 'tasks', '#boardView');
  await resetAudit(page);
  await openLayout(page, 'today', '#todayView');
  await expect(page.locator('#todayView .todo-preview-checkline')).toHaveCount(1);
  await expect(page.locator('#todayView .todo-preview-state-hint-v144')).toHaveCount(1);
  await expect(page.locator('#todayView .todo-preview-open-line-v147')).toHaveCount(1);
  const today = await snapshot(page);
  await page.waitForTimeout(180);
  const todayIdle = await snapshot(page);
  console.log('V265_TODAY_RERENDER_METRICS', JSON.stringify(today.bySource));
  console.log('V265_TODAY_IDLE_METRICS', JSON.stringify(todayIdle.bySource));

  for (const source of ['todo-controls-v144.js', 'todo-preview-v147.js']) {
    expect(today.bySource[source].callbackCount).toBeGreaterThanOrEqual(1);
    expect(today.bySource[source].callbackCount).toBeLessThanOrEqual(2);
    expect(today.bySource[source].rafScheduled).toBe(0);
    expect(today.bySource[source].rafExecuted).toBe(0);
    expectIdleStable(today, todayIdle, source);
  }
});

test('Ver.265 product: unrelated descendant mutations no longer wake ToDo or Today sidecars', async ({ page }) => {
  await boot(page);

  await openLayout(page, 'todos', '#todoView');
  await resetAudit(page);
  await page.evaluate(() => {
    const pageRoot = document.querySelector('#todoView .todo-page');
    const marker = document.createElement('span');
    marker.id = 'v265-unrelated-todo-descendant';
    marker.hidden = true;
    pageRoot?.appendChild(marker);
  });
  await page.waitForTimeout(140);
  const todo = await snapshot(page);
  console.log('V265_TODO_UNRELATED_MUTATION_METRICS', JSON.stringify(todo.bySource));
  expect(todo.bySource['todo-controls-v144.js'].callbackCount).toBe(0);
  expect(todo.bySource['todo-tools-v145.js'].callbackCount).toBe(0);
  expect(todo.bySource['todo-controls-v144.js'].rafScheduled).toBe(0);
  expect(todo.bySource['todo-tools-v145.js'].rafScheduled).toBe(0);

  await openLayout(page, 'today', '#todayView');
  await resetAudit(page);
  await page.evaluate(() => {
    const host = document.querySelector('#todayView .activity-panel') || document.querySelector('#todayView > *');
    const marker = document.createElement('span');
    marker.id = 'v265-unrelated-today-descendant';
    marker.hidden = true;
    host?.appendChild(marker);
  });
  await page.waitForTimeout(140);
  const today = await snapshot(page);
  console.log('V265_TODAY_UNRELATED_MUTATION_METRICS', JSON.stringify(today.bySource));
  expect(today.bySource['todo-controls-v144.js'].callbackCount).toBe(0);
  expect(today.bySource['todo-preview-v147.js'].callbackCount).toBe(0);
  expect(today.bySource['todo-controls-v144.js'].rafScheduled).toBe(0);
  expect(today.bySource['todo-preview-v147.js'].rafScheduled).toBe(0);
});

test('Ver.265 product: search, collapse, preview detail and explicit completion stay functional', async ({ page }) => {
  await boot(page);
  await openLayout(page, 'todos', '#todoView');

  await page.locator('#todayTodoInput').fill('検索対象 observer scope Ver265');
  await page.locator('[data-todo-form]').evaluate(form => form.requestSubmit());
  await expect(page.locator('#todoView .todo-item')).toHaveCount(1);
  await expect(page.locator('#todoView .todo-state-toggle-v144')).toHaveCount(1);

  const search = page.locator('#todoView .todo-search-input-v145');
  await search.fill('observer scope');
  await expect(page.locator('#todoView .todo-search-result-v145')).toContainText('1件 / 1件');
  await search.fill('一致しない');
  await expect(page.locator('#todoView .todo-search-empty-v145')).toBeVisible();
  await search.fill('');

  await page.locator('#todoView .todo-state-toggle-v144').evaluate(button => button.click());
  await expect(page.locator('#todoView .todo-state-toggle-v144')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#todoView .todo-completed-toggle-v145')).toBeVisible();
  await page.locator('#todoView .todo-completed-toggle-v145').evaluate(button => button.click());
  await expect(page.locator('#todoView .todo-list.is-completed')).toHaveClass(/is-collapsed-v145/);

  await openLayout(page, 'today', '#todayView');
  await openLayout(page, 'todos', '#todoView');
  await page.locator('#todoView .todo-completed-toggle-v145').evaluate(button => button.click());
  await page.locator('#todoView .todo-state-toggle-v144').evaluate(button => button.click());
  await openLayout(page, 'today', '#todayView');
  await expect(page.locator('#todayView .todo-preview-state-hint-v144')).toHaveCount(1);
  await expect(page.locator('#todayView .todo-preview-open-line-v147')).toHaveCount(1);
  await page.locator('#todayView .todo-preview-text').evaluate(title => title.click());
  await expect(page.locator('#todoView')).toBeVisible();
  await expect(page.locator('#todoView .todo-item.is-expanded')).toHaveCount(1);
});
