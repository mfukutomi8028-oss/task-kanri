import { test, expect } from '@playwright/test';

const ROOM = 'test-startup-direct-mode-v415';

test('saved JOURNAL is the first visible workspace, even after the old 4s timeout', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(room => {
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('workBoardDisplayV356:' + encodeURIComponent(room) + ':' + encodeURIComponent('福冨'), 'journal');
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get: () => null, set: () => {}
    });
  }, ROOM);
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
  await page.route('**/journal-display-v367.js?v=*', async route => {
    await new Promise(resolve => setTimeout(resolve, 5500));
    await route.continue();
  });
  await page.goto('/?room=' + ROOM, {waitUntil: 'domcontentloaded'});
  await expect(page.locator('html')).toHaveAttribute('data-wb-display', 'journal');
  await expect(page.locator('#clearRoomCache')).toHaveCount(0);

  await page.waitForTimeout(4350);
  await expect(page.locator('html')).toHaveClass(/wb-first-paint-v304/);
  await expect(page.locator('#wbBootScreen')).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('visibility', 'hidden');

  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, {timeout:60_000});
  await expect(page.locator('html')).not.toHaveClass(/wb-first-paint-v304/);
  await expect(page.locator('#wbJournalHeaderV367')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-wb-display', 'journal');
});
