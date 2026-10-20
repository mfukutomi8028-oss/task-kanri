import { test, expect } from '@playwright/test';

// Count only listeners directly registered by app.js. Independent UI patches
// and config.js own their own listeners and must not be mistaken for duplicates.
const EXPECTED = {
  'document:dragend': 1,
  'document:drop': 1,
  'document:visibilitychange': 2,
  'window:focus': 2,
  'window:pageshow': 2
};

async function boot(page, suffix) {
  const room = 'test-app-lifecycle-v508-' + suffix;
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(({ roomId }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', roomId);
    const original = EventTarget.prototype.addEventListener;
    const registrations = [];
    const events = new Set(['dragend', 'drop', 'visibilitychange', 'focus', 'pageshow']);
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (events.has(type) && (this === document || this === window)) {
        const frames = String(new Error().stack || '').split('\n');
        const caller = frames[2] || '';
        if (/\/app\.js(?:\?|:)/.test(caller)) {
          registrations.push({ target: this === document ? 'document' : 'window', type });
        }
      }
      return original.call(this, type, listener, options);
    };
    window.__v508ListenerMetrics = () => {
      const byType = {};
      for (const { target, type } of registrations) {
        const key = target + ':' + type;
        byType[key] = (byType[key] || 0) + 1;
      }
      return { total: registrations.length, byType };
    };
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get() { return null; }, set() {}
    });
  }, { roomId: room });
  await page.route('https://www.gstatic.com/firebasejs/**',
    route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
  await page.goto('/?room=' + encodeURIComponent(room), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true,
    undefined, { timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => window.__v508ListenerMetrics().total),
    { timeout: 12_000 }).toBe(8);
}

async function metrics(page) {
  return page.evaluate(() => window.__v508ListenerMetrics());
}

test('Ver.508 core app cold boot installs the expected eight document/window listeners once', async ({ page }) => {
  await boot(page, 'cold');
  expect(await metrics(page)).toEqual({ total: 8, byType: EXPECTED });
});

test('Ver.508 resume events and a fresh page reload never multiply core listeners', async ({ page }) => {
  await boot(page, 'resume');
  await page.evaluate(() => {
    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('pageshow'));
      document.dispatchEvent(new Event('visibilitychange'));
    }
  });
  expect(await metrics(page)).toEqual({ total: 8, byType: EXPECTED });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true,
    undefined, { timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => window.__v508ListenerMetrics().total),
    { timeout: 12_000 }).toBe(8);
  expect(await metrics(page)).toEqual({ total: 8, byType: EXPECTED });
});
