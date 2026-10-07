import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-runtime-interval-v362';

async function boot(page, suffix) {
  const room = `${ROOM_PREFIX}-${suffix}`;
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '土屋']));

    const records = window.__WB_V362_INTERVALS__ = [];
    const nativeSetInterval = window.setInterval.bind(window);
    window.setInterval = function(handler, timeout, ...args) {
      const stack = String(new Error().stack || '');
      const match = stack.match(/([A-Za-z0-9_-]+\.js)(?::\d+:\d+)?/);
      records.push({ asset: match?.[1] || '', timeout: Number(timeout || 0) });
      return nativeSetInterval(handler, timeout, ...args);
    };

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
  await page.goto(`/?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForTimeout(1800);
}

test('Ver.362 browser confirms the four remaining interval owners and retired app/insights polling', async ({ page }) => {
  await boot(page, 'owners');

  const intervals = await page.evaluate(() => window.__WB_V362_INTERVALS__);
  const known = intervals
    .filter(item => [
      'app.js',
      'insights-v148.js',
      'completion-unpin-v150.js',
      'reminders-v152.js',
      'inbox-events-v183.js',
      'archive-ui-v182.js'
    ].includes(item.asset));

  expect(known.filter(item => item.asset === 'app.js')).toEqual([]);
  expect(known.filter(item => item.asset === 'insights-v148.js')).toEqual([]);

  expect(known.filter(item => item.asset === 'completion-unpin-v150.js').map(item => item.timeout)).toEqual([1500]);
  expect(known.filter(item => item.asset === 'reminders-v152.js').map(item => item.timeout)).toEqual([30000]);
  expect(known.filter(item => item.asset === 'inbox-events-v183.js').map(item => item.timeout)).toEqual([1500]);
  expect(known.filter(item => item.asset === 'archive-ui-v182.js').map(item => item.timeout)).toEqual([6 * 60 * 60 * 1000]);
});
