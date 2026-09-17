import { test, expect } from '@playwright/test';

const ROOM = 'test-foundation-overlap-v200';

async function installLocalOnlyBoundary(page) {
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return null; }, set() {} });
  }, { room: ROOM });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page) {
  await installLocalOnlyBoundary(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
}

test('date keyboard constrains product task dates while retired stable date markers stay absent', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 });
  await boot(page);

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await page.evaluate(() => document.getElementById('newTask')?.click());
  await expect(page.locator('#taskDialog')).toBeVisible();

  const source = page.locator('#taskDueDate');
  await expect(source.locator('xpath=..')).toHaveClass(/date-segment-control-v127/);
  await expect(source).toHaveAttribute('data-date-segment-v127', 'true');
  await expect(source).toHaveAttribute('min', '1900-01-01');
  await expect(source).toHaveAttribute('max', '9999-12-31');
  await expect.poll(() => source.evaluate(node => Boolean(node.__stableDateV108))).toBe(false);
  await expect.poll(() => source.evaluate(node => Boolean(node.__workBoardDateBoundV101))).toBe(false);

  const startDate = page.locator('#taskStartDateV167');
  await expect(startDate).toHaveAttribute('data-date-segment-v127', 'true');
  await expect(startDate).toHaveAttribute('min', '1900-01-01');
  await expect(startDate).toHaveAttribute('max', '9999-12-31');
  await expect(startDate.locator('xpath=..')).toHaveClass(/date-segment-control-v127/);
  await expect.poll(() => startDate.evaluate(node => Boolean(node.__stableDateV108))).toBe(false);
  await expect(page.locator('#taskDialog .date-segment-control-v127')).toHaveCount(2);

  await page.evaluate(() => {
    const host = document.createElement('section');
    host.id = 'foundation-overlap-dynamic-v200';
    host.innerHTML = '<input id="dynamicDateV200" type="date"><input id="dynamicDateTimeV200" type="datetime-local">';
    document.body.appendChild(host);
  });

  const dynamicDate = page.locator('#dynamicDateV200');
  const dynamicDateTime = page.locator('#dynamicDateTimeV200');
  await expect.poll(() => dynamicDate.evaluate(node => Boolean(node.__stableDateV108))).toBe(false);
  await expect.poll(() => dynamicDateTime.evaluate(node => Boolean(node.__stableDateV108))).toBe(false);
  await expect.poll(() => dynamicDate.evaluate(node => Boolean(node.__workBoardDateBoundV101))).toBe(false);
  await expect.poll(() => dynamicDateTime.evaluate(node => Boolean(node.__workBoardDateBoundV101))).toBe(false);
  await expect(dynamicDate).not.toHaveAttribute('min', /.+/);
  await expect(dynamicDate).not.toHaveAttribute('max', /.+/);
  await expect(dynamicDateTime).not.toHaveAttribute('min', /.+/);
  await expect(dynamicDateTime).not.toHaveAttribute('max', /.+/);

  await page.evaluate(() => {
    for (let index = 0; index < 3; index += 1) {
      const marker = document.createElement('span');
      marker.textContent = String(index);
      document.getElementById('foundation-overlap-dynamic-v200')?.appendChild(marker);
    }
  });
  await page.waitForTimeout(150);
  await expect(dynamicDate).not.toHaveAttribute('data-date-segment-v127', 'true');
  await expect(dynamicDate.locator('xpath=..')).not.toHaveClass(/date-segment-control-v127/);
  await expect(page.locator('#taskDialog .date-segment-control-v127')).toHaveCount(2);
});
