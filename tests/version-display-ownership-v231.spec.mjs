import { test, expect } from '@playwright/test';

const ROOM = 'test-version-display-ownership-v231';
const SIDECAR = 'version-display-lock.js';

async function boot(page, { disableDisplayLock = false } = {}) {
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

  let sidecarRequests = 0;
  page.on('request', request => {
    try {
      if (new URL(request.url()).pathname.endsWith(`/${SIDECAR}`)) sidecarRequests += 1;
    } catch (_) {}
  });

  if (disableDisplayLock) {
    await page.route(`**/${SIDECAR}*`, route => route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: '/* Ver.231 audit: version-display-lock intentionally disabled */'
    }));
  }

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });

  // Let config.js finish both delayed startup synchronizers so the assertions
  // below isolate post-boot behavior rather than startup timing.
  await page.waitForTimeout(1400);
  return () => sidecarRequests;
}

async function corruptVersion(page) {
  await page.evaluate(() => {
    const node = document.querySelector('.app-version, .workboard-version-display');
    if (node) {
      node.textContent = 'Ver.122';
      node.title = 'legacy overwrite';
      node.dataset.releaseVersion = '122';
    }
    window.WORK_BOARD_VERSION = '122';
  });
}

test('Ver.231 audit: manifest + config keep startup version correct without version-display-lock', async ({ page }) => {
  const getSidecarRequests = await boot(page, { disableDisplayLock: true });

  const release = await page.evaluate(() => String(window.WORK_BOARD_RELEASE?.version || ''));
  expect(Number(release)).toBeGreaterThanOrEqual(230);

  const versionNode = page.locator('.app-version');
  await expect(versionNode).toHaveCount(1);
  await expect(versionNode).toHaveText(`Ver.${release}`);
  await expect(versionNode).toHaveAttribute('title', `現在のバージョン Ver.${release}`);
  await expect(page.locator('.workboard-version-display')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => String(window.WORK_BOARD_RELEASE_VERSION || ''))).toBe(release);
  await expect.poll(() => page.evaluate(() => String(window.WORK_BOARD_VERSION || ''))).toBe(release);
  expect(getSidecarRequests()).toBeGreaterThan(0);
});

test('Ver.231 audit: config does not provide post-boot focus recovery when version-display-lock is disabled', async ({ page }) => {
  await boot(page, { disableDisplayLock: true });
  await corruptVersion(page);

  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(120);

  await expect(page.locator('.app-version')).toHaveText('Ver.122');
  await expect.poll(() => page.evaluate(() => String(window.WORK_BOARD_VERSION || ''))).toBe('122');
});

test('Ver.231 audit: active version-display-lock exclusively restores post-boot drift and semantic display metadata', async ({ page }) => {
  const getSidecarRequests = await boot(page);
  const release = await page.evaluate(() => String(window.WORK_BOARD_RELEASE?.version || ''));

  const versionNode = page.locator('.workboard-version-display');
  await expect(versionNode).toHaveCount(1);
  await expect(versionNode).not.toHaveClass(/app-version/);
  await expect(versionNode).toHaveAttribute('data-release-version', release);
  await expect(page.locator('#workBoardVersionDisplayStyle')).toHaveCount(1);

  await corruptVersion(page);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));

  await expect(versionNode).toHaveText(`Ver.${release}`);
  await expect(versionNode).toHaveAttribute('title', `現在のバージョン Ver.${release}`);
  await expect(versionNode).toHaveAttribute('data-release-version', release);
  await expect.poll(() => page.evaluate(() => String(window.WORK_BOARD_VERSION || ''))).toBe(release);
  expect(getSidecarRequests()).toBeGreaterThan(0);
});
