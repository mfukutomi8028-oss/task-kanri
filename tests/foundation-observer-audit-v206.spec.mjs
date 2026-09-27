import { test, expect } from '@playwright/test';

const ROOM = 'test-foundation-observer-audit-v207';

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
        const entry = { callbackName: callback?.name || 'anonymous', callbackCount: 0, mutationCount: 0, observes: [], records: [] };
        this.__entry = entry;
        this.__native = new NativeMutationObserver(mutations => {
          entry.callbackCount += 1;
          entry.mutationCount += mutations.length;
          for (const mutation of mutations) {
            entry.records.push({
              target: mutation.target === document.body ? 'BODY' : mutation.target?.id ? `#${mutation.target.id}` : String(mutation.target?.tagName || mutation.target?.nodeName || 'unknown'),
              addedIds: [...mutation.addedNodes].flatMap(collectIds)
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
  await page.waitForFunction(() => (window.__WB_OBSERVER_AUDIT_V207__ || []).some(entry =>
    entry.observes.some(observe => observe.target === '#boardView'
      && observe.childList === true
      && observe.subtree === false
      && observe.attributes === false)));
}

function getObserverSnapshot(page) {
  return page.evaluate(() => {
    const registry = window.__WB_OBSERVER_AUDIT_V207__ || [];
    const pickObserver = (name, target) => registry.find(entry => entry.callbackName === name
      && entry.observes.some(observe => observe.target === target)) || null;
    const mobile = registry.find(entry => entry.observes.some(observe => observe.target === '#boardView'
      && observe.childList === true
      && observe.subtree === false
      && observe.attributes === false)) || null;
    return {
      stableToday: pickObserver('scheduleTodayFilters', '#todayView'),
      mobile,
      stableTaskForm: registry.filter(entry => entry.callbackName === 'scheduleDateInputs'
        && entry.observes.some(observe => observe.target === '#taskForm'))
    };
  });
}

test('foundation observers keep mobile feature scope while stable observers remain retired', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 });
  await boot(page);

  const before = await getObserverSnapshot(page);
  expect(before.stableTaskForm).toHaveLength(0);
  expect(before.stableToday).toBeNull();
  expect(before.mobile).not.toBeNull();
  expect(before.mobile.observes).toEqual(expect.arrayContaining([
    expect.objectContaining({ target: '#boardView', childList: true, subtree: false, attributes: false })
  ]));
  expect(before.mobile.observes.some(observe => observe.target === 'BODY')).toBe(false);

  await page.evaluate(() => {
    const registry = window.__WB_OBSERVER_AUDIT_V207__ || [];
    for (const entry of registry) entry.records.length = 0;
    const marker = document.createElement('div');
    marker.id = 'observer-audit-unrelated-v207';
    document.body.appendChild(marker);
  });
  await page.waitForTimeout(100);

  const after = await getObserverSnapshot(page);
  expect(after.stableToday).toBeNull();
  expect(after.stableTaskForm).toHaveLength(0);
  expect(after.mobile?.records.some(record => record.addedIds.includes('observer-audit-unrelated-v207')) || false).toBe(false);
});

test('mobile #boardView observer ignores descendant task-card churn after Ver.300 direct-child promotion', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 });
  await boot(page);

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await expect(page.locator('.work-mobile-status-tab').first()).toBeVisible();

  const before = await page.evaluate(() => {
    const registry = window.__WB_OBSERVER_AUDIT_V207__ || [];
    const mobileObserver = registry.find(entry => entry.observes.some(observe => observe.target === '#boardView'
      && observe.childList === true
      && observe.subtree === false));
    return {
      tabText: document.querySelector('.work-mobile-status-tab')?.textContent || '',
      observerCallbacks: mobileObserver?.callbackCount || 0
    };
  });

  await page.evaluate(() => {
    const column = document.querySelector('.board-view .board-column');
    if (!column) throw new Error('board column is missing');
    const card = document.createElement('article');
    card.id = 'observer-audit-task-card-v207';
    card.className = 'task-card';
    card.textContent = 'observer audit descendant card';
    column.appendChild(card);
  });
  await page.waitForTimeout(150);

  const afterAdd = await page.evaluate(() => {
    const registry = window.__WB_OBSERVER_AUDIT_V207__ || [];
    const mobileObserver = registry.find(entry => entry.observes.some(observe => observe.target === '#boardView'
      && observe.childList === true
      && observe.subtree === false));
    return {
      tabText: document.querySelector('.work-mobile-status-tab')?.textContent || '',
      observerCallbacks: mobileObserver?.callbackCount || 0
    };
  });
  expect(afterAdd).toEqual(before);

  await page.evaluate(() => document.getElementById('observer-audit-task-card-v207')?.remove());
  await page.waitForTimeout(150);
  const afterRemove = await page.evaluate(() => {
    const registry = window.__WB_OBSERVER_AUDIT_V207__ || [];
    const mobileObserver = registry.find(entry => entry.observes.some(observe => observe.target === '#boardView'
      && observe.childList === true
      && observe.subtree === false));
    return {
      tabText: document.querySelector('.work-mobile-status-tab')?.textContent || '',
      observerCallbacks: mobileObserver?.callbackCount || 0
    };
  });
  expect(afterRemove).toEqual(before);
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
