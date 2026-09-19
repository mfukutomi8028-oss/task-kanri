import { test, expect } from '@playwright/test';

const ROOM = 'test-version-display-current';
const RETIRED_SIDECAR = 'version-display-lock.js';
const DISPLAY_CSS = 'ui-version-display-v232.css';

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

  let retiredSidecarRequests = 0;
  page.on('request', request => {
    try {
      if (new URL(request.url()).pathname.endsWith(`/${RETIRED_SIDECAR}`)) retiredSidecarRequests += 1;
    } catch (_) {}
  });

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await page.waitForFunction(name => Array.from(document.styleSheets).some(sheet => {
    try { return new URL(sheet.href || '', location.href).pathname.endsWith(`/${name}`); }
    catch (_) { return false; }
  }), DISPLAY_CSS, { timeout: 8_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    const display = document.querySelector('.workboard-version-display');
    return Boolean(display)
      && display.dataset.releaseVersion === version
      && display.textContent === `Ver.${version}`;
  }, undefined, { timeout: 8_000 });

  return () => retiredSidecarRequests;
}

async function expectCanonicalVersion(page) {
  const version = await page.evaluate(() => String(window.WORK_BOARD_RELEASE?.version || ''));
  expect(version).not.toBe('');
  const display = page.locator('.workboard-version-display').first();
  await expect(display).toHaveText(`Ver.${version}`);
  await expect(display).toHaveAttribute('data-release-version', version);
  await expect(display).toHaveAttribute('title', `現在のバージョン Ver.${version}`);
  await expect(page.locator('.app-version')).toHaveCount(0);
  expect(await page.evaluate(() => String(window.WORK_BOARD_VERSION || ''))).toBe(version);
  expect(await page.evaluate(() => String(window.WORK_BOARD_RELEASE_VERSION || ''))).toBe(version);
}

test('current manifest/config owner keeps initial version display canonical after stable and version sidecar retirement', async ({ page }) => {
  const getRetiredSidecarRequests = await boot(page);
  await expectCanonicalVersion(page);
  await expect(page.locator('#stableFixesV108Style')).toHaveCount(0);
  await expect(page.locator('#workBoardVersionDisplayStyle')).toHaveCount(0);
  const stableLoaded = await page.evaluate(() => performance.getEntriesByType('resource')
    .some(entry => String(entry.name || '').includes('stable-fixes-v108.js')));
  expect(stableLoaded).toBe(false);
  expect(getRetiredSidecarRequests()).toBe(0);
});

test('current config owner restores legacy version overwrites after stable and version sidecar retirement', async ({ page }) => {
  const getRetiredSidecarRequests = await boot(page);
  await expectCanonicalVersion(page);

  await page.evaluate(() => {
    const display = document.querySelector('.workboard-version-display');
    display.textContent = 'Ver.108';
    display.title = 'legacy version';
    display.dataset.releaseVersion = '108';
    window.WORK_BOARD_VERSION = '108';
    window.WORK_BOARD_RELEASE_VERSION = '108';
    window.dispatchEvent(new Event('pageshow'));
  });
  await expectCanonicalVersion(page);

  await page.evaluate(() => {
    const display = document.querySelector('.workboard-version-display');
    display.textContent = 'Ver.143';
    display.dataset.releaseVersion = '143';
    window.WORK_BOARD_VERSION = '143';
    window.WORK_BOARD_RELEASE_VERSION = '143';
    window.dispatchEvent(new Event('focus'));
  });
  await expectCanonicalVersion(page);
  expect(getRetiredSidecarRequests()).toBe(0);
});
