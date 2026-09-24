import { test, expect } from '@playwright/test';

const ROOM = 'test-icon-system-single-pass-v271';

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
    const iconIntervals = [];
    window.__WB_ICON_SINGLE_PASS_V271__ = { iconIntervals };
    window.setInterval = function setIntervalAuditV271(callback, delay, ...args) {
      const stack = String(new Error().stack || '');
      if (stack.includes('icon-system-v169.js')) iconIntervals.push({ delay: Number(delay) });
      return nativeSetInterval(callback, delay, ...args);
    };
  }, ROOM);

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page) {
  await installAudit(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
}

const expectedIcons = [
  ['.nav-item[data-layout="today"] .nav-icon img', /nav-today-v169\.svg/],
  ['.nav-item[data-layout="todos"] .nav-icon img', /nav-todo-v168\.svg/],
  ['.nav-item[data-layout="tasks"] .nav-icon img', /nav-task-v169\.svg/],
  ['.nav-item[data-layout="schedule"] .nav-icon img', /nav-schedule-v169\.svg/],
  ['.nav-item[data-filter="mine"] .nav-icon img', /nav-mine-v169\.svg/],
  ['.nav-item[data-filter="favorite"] .nav-icon img', /nav-star-v169\.svg/],
  ['.nav-item[data-filter="done"] .nav-icon img', /nav-done-v169\.svg/],
  ['.work-memo-nav-v167 .nav-icon img', /nav-memo-v168\.svg/]
];

test('Ver.271 product: icon-system registers no polling interval', async ({ page }) => {
  await boot(page);
  const intervals = await page.evaluate(() => window.__WB_ICON_SINGLE_PASS_V271__.iconIntervals);
  expect(intervals).toEqual([]);
});

test('Ver.271 product: all semantic navigation icons converge during the single startup pass', async ({ page }) => {
  await boot(page);
  for (const [selector, pattern] of expectedIcons) {
    await expect(page.locator(selector)).toHaveAttribute('src', pattern);
  }
  await expect(page.locator('#openCount').locator('xpath=ancestor::article[contains(@class,"summary-card")]').locator('.summary-icon img')).toHaveAttribute('src', /summary-open-v169\.svg/);
  await expect(page.locator('#overdueCount').locator('xpath=ancestor::article[contains(@class,"summary-card")]').locator('.summary-icon img')).toHaveAttribute('src', /summary-overdue-v169\.svg/);
  await expect(page.locator('#todayCount').locator('xpath=ancestor::article[contains(@class,"summary-card")]').locator('.summary-icon img')).toHaveAttribute('src', /nav-today-v169\.svg/);
  await expect(page.locator('#myCount').locator('xpath=ancestor::article[contains(@class,"summary-card")]').locator('.summary-icon img')).toHaveAttribute('src', /nav-mine-v169\.svg/);
});

test('Ver.271 product: retired polling no longer provides generic late source self-heal', async ({ page }) => {
  await boot(page);
  const today = page.locator('.nav-item[data-layout="today"] .nav-icon img');
  await today.evaluate(img => img.setAttribute('src', 'assets/nav-today-v87.png?v=synthetic-v271'));
  await page.waitForTimeout(700);
  await expect(today).toHaveAttribute('src', /synthetic-v271/);
});

test('Ver.271 product: normal navigation does not regress icon ownership', async ({ page }) => {
  await boot(page);
  for (const layout of ['todos', 'tasks', 'schedule', 'today']) {
    await page.locator(`.nav-item[data-layout="${layout}"]`).click();
    const expected = expectedIcons.find(([selector]) => selector.includes(`data-layout="${layout}"`));
    await expect(page.locator(expected[0])).toHaveAttribute('src', expected[1]);
  }
});
