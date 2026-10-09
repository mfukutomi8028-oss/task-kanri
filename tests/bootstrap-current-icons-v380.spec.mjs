import { test, expect } from '@playwright/test';

const ROOM = 'test-bootstrap-icons-v380';
const LEGACY = [
  'nav-today-v87.png', 'nav-todo-v142.svg', 'nav-task-v87.png',
  'nav-schedule-v87.png', 'summary-mine.png', 'nav-star-menu.png',
  'nav-done.png', 'summary-open.png', 'summary-overdue.png',
  'summary-today.png'
];
const selectors = [
  ['.nav-item[data-layout="today"] .nav-icon img', 'nav-today-v169.svg'],
  ['.nav-item[data-layout="todos"] .nav-icon img', 'nav-todo-v168.svg'],
  ['.nav-item[data-layout="tasks"] .nav-icon img', 'nav-task-v169.svg'],
  ['.nav-item[data-layout="schedule"] .nav-icon img', 'nav-schedule-v169.svg'],
  ['.nav-item[data-filter="mine"] .nav-icon img', 'nav-mine-v169.svg'],
  ['.nav-item[data-filter="favorite"] .nav-icon img', 'nav-star-v169.svg'],
  ['.nav-item[data-filter="done"] .nav-icon img', 'nav-done-v169.svg']
];

for (const width of [1366, 390]) {
  test('Ver.380 current bootstrap icons and legacy-cache boundary (' + width + 'px)', async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.addInitScript(room => {
      localStorage.clear();
      localStorage.setItem('systemTaskRoomId', room);
      localStorage.setItem('systemTaskUser', 'QA');
      Object.defineProperty(window, 'firebaseConfig', {
        configurable: true,
        get() { return null; },
        set() {}
      });
    }, ROOM);
    await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
    await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
      route => route.abort('blockedbyclient'));

    const requests = [];
    const missing = [];
    page.on('request', request => {
      if (request.resourceType() === 'image') requests.push(new URL(request.url()).pathname.split('/').pop());
    });
    page.on('response', response => {
      if (response.status() === 404 && response.url().includes('/assets/')) missing.push(response.url());
    });
    await page.goto('/?room=' + ROOM, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
    await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === window.WORK_BOARD_RELEASE?.version);
    await expect(page.locator('.brand-mark img')).toHaveAttribute('src', /brand-v184\.svg/);
    for (const [selector, basename] of selectors) {
      await expect(page.locator(selector)).toHaveAttribute('src', new RegExp(basename.replace('.', '\\.')));
    }
    for (const [countId, basename] of [
      ['openCount', 'summary-open-v169.svg'],
      ['overdueCount', 'summary-overdue-v169.svg'],
      ['todayCount', 'nav-today-v169.svg'],
      ['myCount', 'nav-mine-v169.svg']
    ]) {
      const image = page.locator('#' + countId).locator('xpath=ancestor::*[contains(@class,"summary-card")]').locator('.summary-icon img');
      await expect(image).toHaveAttribute('src', new RegExp(basename.replace('.', '\\.')));
    }
    expect(missing).toEqual([]);
    expect(requests.filter(name => LEGACY.includes(name))).toEqual([]);
  });
}
