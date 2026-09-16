import { test, expect } from '@playwright/test';

const ROOM = 'test-foundation-observer-audit-v207';

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
    window.__WB_OBSERVER_AUDIT_V207__ = registry;

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
          mutationCount: 0,
          observes: [],
          records: []
        };
        this.__entry = entry;
        this.__native = new NativeMutationObserver((mutations) => {
          entry.callbackCount += 1;
          entry.mutationCount += mutations.length;
          for (const mutation of mutations) {
            entry.records.push({
              target: mutation.target === document.body
                ? 'BODY'
                : mutation.target?.id
                  ? `#${mutation.target.id}`
                  : String(mutation.target?.tagName || mutation.target?.nodeName || 'unknown'),
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
    const registry = window.__WB_OBSERVER_AUDIT_V207__ || [];
    const watches = (entry, callbackName, target) => entry.callbackName === callbackName
      && entry.observes.some(observe => observe.target === target);
    return registry.some(entry => watches(entry, 'scheduleTodayFilters', '#todayView'))
      && registry.some(entry => watches(entry, 'scheduleBoardTabs', '#boardView'));
  });
}

function getObserverSnapshot(page) {
  return page.evaluate(() => {
    const registry = window.__WB_OBSERVER_AUDIT_V207__ || [];
    const pickObserver = (name, target) => registry.find(entry => entry.callbackName === name
      && entry.observes.some(observe => observe.target === target)) || null;
    return {
      stableToday: pickObserver('scheduleTodayFilters', '#todayView'),
      mobile: pickObserver('scheduleBoardTabs', '#boardView'),
      stableTaskForm: registry.filter(entry => entry.callbackName === 'scheduleDateInputs'
        && entry.observes.some(observe => observe.target === '#taskForm'))
    };
  });
}

test('foundation observers use feature scopes and retired stable date observation does not return', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 });
  await boot(page);

  const before = await getObserverSnapshot(page);
  expect(before.stableTaskForm).toHaveLength(0);
  expect(before.stableToday).not.toBeNull();
  expect(before.mobile).not.toBeNull();

  expect(before.stableToday.observes).toEqual(expect.arrayContaining([
    expect.objectContaining({ target: '#todayView', childList: true, subtree: true, attributes: false })
  ]));
  expect(before.mobile.observes).toEqual(expect.arrayContaining([
    expect.objectContaining({ target: '#boardView', childList: true, subtree: true, attributes: false })
  ]));

  for (const entry of [before.stableToday, before.mobile]) {
    expect(entry.observes.some(observe => observe.target === 'BODY')).toBe(false);
  }

  await page.evaluate(() => {
    const registry = window.__WB_OBSERVER_AUDIT_V207__ || [];
    for (const entry of registry) entry.records.length = 0;

    const marker = document.createElement('div');
    marker.id = 'observer-audit-unrelated-v207';
    marker.textContent = 'observer audit';
    document.body.appendChild(marker);
  });

  await expect.poll(async () => page.evaluate(() => {
    const registry = window.__WB_OBSERVER_AUDIT_V207__ || [];
    return registry.some(entry => entry.records.some(record =>
      record.addedIds.includes('observer-audit-unrelated-v207')));
  })).toBe(true);

  const after = await getObserverSnapshot(page);
  expect(after.stableTaskForm).toHaveLength(0);
  for (const entry of [after.stableToday, after.mobile]) {
    expect(entry?.records.some(record =>
      record.addedIds.includes('observer-audit-unrelated-v207')) || false).toBe(false);
  }
});

test('mobile #boardView observer recalculates status-tab counts after task-card child changes', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 });
  await boot(page);

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await expect(page.locator('.work-mobile-status-tab').first()).toBeVisible();

  const before = await page.evaluate(() => {
    const column = document.querySelector('.board-view .board-column');
    const registry = window.__WB_OBSERVER_AUDIT_V207__ || [];
    const mobileObserver = registry.find(entry => entry.callbackName === 'scheduleBoardTabs'
      && entry.observes.some(observe => observe.target === '#boardView'));
    return {
      count: column?.querySelectorAll('.task-card').length ?? -1,
      observerCallbacks: mobileObserver?.callbackCount || 0
    };
  });

  expect(before.count).toBeGreaterThanOrEqual(0);

  await page.evaluate(() => {
    const column = document.querySelector('.board-view .board-column');
    if (!column) throw new Error('board column is missing');
    const card = document.createElement('article');
    card.id = 'observer-audit-task-card-v207';
    card.className = 'task-card';
    card.textContent = 'observer audit card';
    column.appendChild(card);
  });

  await expect.poll(() => page.locator('.work-mobile-status-tab').first().textContent()).toMatch(
    new RegExp(`\\s${before.count + 1}$`)
  );

  await expect.poll(async () => {
    const snapshot = await getObserverSnapshot(page);
    return snapshot.mobile?.callbackCount || 0;
  }).toBeGreaterThan(before.observerCallbacks);

  await page.evaluate(() => document.getElementById('observer-audit-task-card-v207')?.remove());
  await expect.poll(() => page.locator('.work-mobile-status-tab').first().textContent()).toMatch(
    new RegExp(`\\s${before.count}$`)
  );
});

test('mobile navigation explicitly synchronizes header title without BODY observation', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 });
  await boot(page);

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="schedule"]')?.click());

  await expect.poll(async () => page.evaluate(() => {
    const title = document.querySelector('.work-mobile-title-text')?.textContent?.trim() || '';
    const active = document.querySelector('.nav-item.active')?.textContent?.trim() || '';
    return Boolean(active && title === active);
  })).toBe(true);
});
