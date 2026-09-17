import { test, expect } from '@playwright/test';

const ROOM = 'test-version-display-v219';

async function boot(page) {
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return version === '219' && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await page.waitForFunction(() => document.getElementById('workBoardVersionDisplayStyle'));
}

async function expectCanonicalVersion(page) {
  const display = page.locator('.workboard-version-display').first();
  await expect(display).toHaveText('Ver.219');
  await expect(display).toHaveAttribute('data-release-version', '219');
  await expect(display).toHaveAttribute('title', '現在のバージョン Ver.219');
  await expect(page.locator('.app-version')).toHaveCount(0);
  expect(await page.evaluate(() => window.WORK_BOARD_VERSION)).toBe('219');
}

test('manifest and version-display-lock exclusively own initial version display after stable runtime retirement', async ({ page }) => {
  await boot(page);
  await expectCanonicalVersion(page);
  await expect(page.locator('#stableFixesV108Style')).toHaveCount(0);
  const stableLoaded = await page.evaluate(() => performance.getEntriesByType('resource')
    .some(entry => String(entry.name || '').includes('stable-fixes-v108.js')));
  expect(stableLoaded).toBe(false);
});

test('version-display-lock restores legacy overwrites after stable runtime retirement', async ({ page }) => {
  await boot(page);
  await expectCanonicalVersion(page);

  await page.evaluate(() => {
    const display = document.querySelector('.workboard-version-display');
    display.textContent = 'Ver.108';
    display.title = 'legacy version';
    display.dataset.releaseVersion = '108';
    window.WORK_BOARD_VERSION = '108';
    window.dispatchEvent(new Event('pageshow'));
  });
  await expectCanonicalVersion(page);

  await page.evaluate(() => {
    const display = document.querySelector('.workboard-version-display');
    display.textContent = 'Ver.143';
    window.dispatchEvent(new Event('focus'));
  });
  await expectCanonicalVersion(page);
});
