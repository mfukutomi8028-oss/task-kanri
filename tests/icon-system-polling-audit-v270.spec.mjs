import { test, expect } from '@playwright/test';

const ROOM = 'test-icon-system-polling-v270';

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

    const nativeSetInterval = window.setInterval.bind(window);
    const entries = [];
    const sourceOwned = stack => String(stack || '').includes('icon-system-v169.js');
    const targetSelectors = [
      '.nav-item[data-layout="today"] .nav-icon img',
      '.nav-item[data-layout="todos"] .nav-icon img',
      '.nav-item[data-layout="tasks"] .nav-icon img',
      '.nav-item[data-layout="schedule"] .nav-icon img',
      '.nav-item[data-filter="mine"] .nav-icon img',
      '.nav-item[data-filter="favorite"] .nav-icon img',
      '.nav-item[data-filter="done"] .nav-icon img',
      '.work-memo-nav-v167 .nav-icon img',
      '#openCount', '#overdueCount', '#todayCount', '#myCount'
    ];

    window.__WB_ICON_POLL_AUDIT_V270__ = { entries, targetSelectors };

    window.setInterval = function setIntervalAuditV270(callback, delay, ...args) {
      if (!sourceOwned(new Error().stack)) return nativeSetInterval(callback, delay, ...args);
      const entry = {
        delay: Number(delay),
        callbackCount: 0,
        targetsPresentAtRegistration: targetSelectors.map(selector => Boolean(document.querySelector(selector))),
        callback: () => callback(...args)
      };
      entries.push(entry);
      return nativeSetInterval(() => {
        entry.callbackCount += 1;
        return callback(...args);
      }, delay);
    };
  }, ROOM);

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page) {
  await installAudit(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.__WB_ICON_POLL_AUDIT_V270__?.entries?.length === 1, undefined, { timeout: 8_000 });
}

test('Ver.270 audit: polling starts after all semantic icon targets already exist', async ({ page }) => {
  await boot(page);
  const snapshot = await page.evaluate(() => {
    const entry = window.__WB_ICON_POLL_AUDIT_V270__.entries[0];
    return { delay: entry.delay, targets: entry.targetsPresentAtRegistration };
  });
  expect(snapshot.delay).toBe(250);
  expect(snapshot.targets).toEqual(snapshot.targets.map(() => true));
});

test('Ver.270 audit: polling continues after assets-ready with no missing icon targets', async ({ page }) => {
  await boot(page);
  const before = await page.evaluate(() => window.__WB_ICON_POLL_AUDIT_V270__.entries[0].callbackCount);
  await page.waitForTimeout(650);
  const after = await page.evaluate(() => ({
    callbackCount: window.__WB_ICON_POLL_AUDIT_V270__.entries[0].callbackCount,
    allPresent: window.__WB_ICON_POLL_AUDIT_V270__.targetSelectors.every(selector => Boolean(document.querySelector(selector)))
  }));
  expect(after.allPresent).toBe(true);
  expect(after.callbackCount).toBeGreaterThan(before);
});

test('Ver.270 audit: one poll callback only provides late self-heal for a deliberately corrupted icon', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const img = document.querySelector('.nav-item[data-layout="today"] .nav-icon img');
    img?.setAttribute('src', 'assets/nav-today-v87.png?v=synthetic-v270');
    window.__WB_ICON_POLL_AUDIT_V270__.entries[0].callback();
  });
  await expect(page.locator('.nav-item[data-layout="today"] .nav-icon img')).toHaveAttribute('src', /nav-today-v169\.svg/);
});
