import { test, expect } from '@playwright/test';

const ROOM = 'test-foundation-observer-audit-v206';

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
    window.__WB_OBSERVER_AUDIT_V206__ = registry;

    window.MutationObserver = class MutationObserverAuditV206 {
      constructor(callback) {
        const entry = {
          callbackName: callback?.name || 'anonymous',
          callbackCount: 0,
          mutationCount: 0,
          observes: []
        };
        this.__entry = entry;
        this.__native = new NativeMutationObserver((mutations) => {
          entry.callbackCount += 1;
          entry.mutationCount += mutations.length;
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

      disconnect() {
        return this.__native.disconnect();
      }

      takeRecords() {
        return this.__native.takeRecords();
      }
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
    const registry = window.__WB_OBSERVER_AUDIT_V206__ || [];
    return registry.some(entry => entry.callbackName === 'scheduleFixes')
      && registry.some(entry => entry.callbackName === 'schedulePatch');
  });
}

function getObserverSnapshot(page) {
  return page.evaluate(() => {
    const registry = window.__WB_OBSERVER_AUDIT_V206__ || [];
    const pick = name => registry.find(entry => entry.callbackName === name) || null;
    return {
      stable: pick('scheduleFixes'),
      mobile: pick('schedulePatch')
    };
  });
}

test('stable and mobile foundation observers both watch BODY and react to unrelated child-list mutations', async ({ page }) => {
  await boot(page);

  const before = await getObserverSnapshot(page);
  expect(before.stable).not.toBeNull();
  expect(before.mobile).not.toBeNull();

  for (const entry of [before.stable, before.mobile]) {
    expect(entry.observes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        target: 'BODY',
        childList: true,
        subtree: true,
        attributes: false
      })
    ]));
  }

  await page.evaluate(() => {
    const marker = document.createElement('div');
    marker.id = 'observer-audit-unrelated-v206';
    marker.textContent = 'observer audit';
    document.body.appendChild(marker);
  });

  await expect.poll(async () => {
    const after = await getObserverSnapshot(page);
    return {
      stable: after.stable?.callbackCount || 0,
      mobile: after.mobile?.callbackCount || 0
    };
  }).toEqual({
    stable: expect.any(Number),
    mobile: expect.any(Number)
  });

  await expect.poll(async () => {
    const after = await getObserverSnapshot(page);
    return Boolean(
      after.stable?.callbackCount > before.stable.callbackCount
      && after.mobile?.callbackCount > before.mobile.callbackCount
    );
  }).toBe(true);
});

test('mobile body observer recalculates status-tab counts after board task-card child changes', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 });
  await boot(page);

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await expect(page.locator('.work-mobile-status-tab').first()).toBeVisible();

  const before = await page.evaluate(() => {
    const column = document.querySelector('.board-view .board-column');
    const tab = document.querySelector('.work-mobile-status-tab');
    const registry = window.__WB_OBSERVER_AUDIT_V206__ || [];
    const mobileObserver = registry.find(entry => entry.callbackName === 'schedulePatch');
    return {
      count: column?.querySelectorAll('.task-card').length ?? -1,
      text: tab?.textContent || '',
      observerCallbacks: mobileObserver?.callbackCount || 0
    };
  });

  expect(before.count).toBeGreaterThanOrEqual(0);

  await page.evaluate(() => {
    const column = document.querySelector('.board-view .board-column');
    if (!column) throw new Error('board column is missing');
    const card = document.createElement('article');
    card.id = 'observer-audit-task-card-v206';
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

  await page.evaluate(() => document.getElementById('observer-audit-task-card-v206')?.remove());
  await expect.poll(() => page.locator('.work-mobile-status-tab').first().textContent()).toMatch(
    new RegExp(`\\s${before.count}$`)
  );
});
