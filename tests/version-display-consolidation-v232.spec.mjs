import { test, expect } from '@playwright/test';

const ROOM = 'test-version-display-consolidation-v232';
const SIDECAR = 'version-display-lock.js';
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

  let sidecarRequests = 0;
  let cssRequests = 0;
  page.on('request', request => {
    try {
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith(`/${SIDECAR}`)) sidecarRequests += 1;
      if (pathname.endsWith(`/${DISPLAY_CSS}`)) cssRequests += 1;
    } catch (_) {}
  });

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Number(version) >= 232 && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await page.waitForTimeout(1400);

  const version = String(await page.evaluate(() => window.WORK_BOARD_RELEASE?.version || ''));
  return {
    version,
    sidecarRequests: () => sidecarRequests,
    cssRequests: () => cssRequests
  };
}

async function corruptVersion(page) {
  await page.evaluate(() => {
    const node = document.querySelector('.app-version, .workboard-version-display');
    if (node) {
      node.textContent = 'Ver.122';
      node.title = 'legacy overwrite';
      node.dataset.releaseVersion = '122';
    }
    window.WORK_BOARD_RELEASE_VERSION = '122';
    window.WORK_BOARD_VERSION = '122';
  });
}

test('Ver.232+: config + static CSS own startup version presentation without version-display-lock', async ({ page }) => {
  const requests = await boot(page);
  const versionNode = page.locator('.workboard-version-display');
  const expected = `Ver.${requests.version}`;

  await expect(versionNode).toHaveCount(1);
  await expect(page.locator('.app-version')).toHaveCount(0);
  await expect(versionNode).toHaveText(expected);
  await expect(versionNode).toHaveAttribute('title', `現在のバージョン ${expected}`);
  await expect(versionNode).toHaveAttribute('data-release-version', requests.version);
  await expect.poll(() => page.evaluate(() => String(window.WORK_BOARD_RELEASE_VERSION || ''))).toBe(requests.version);
  await expect.poll(() => page.evaluate(() => String(window.WORK_BOARD_VERSION || ''))).toBe(requests.version);

  const computed = await versionNode.evaluate(node => ({
    display: getComputedStyle(node).display,
    fontWeight: getComputedStyle(node).fontWeight
  }));
  expect(computed.display).toBe('block');
  expect(Number(computed.fontWeight)).toBeGreaterThanOrEqual(800);
  expect(requests.cssRequests()).toBeGreaterThan(0);
  expect(requests.sidecarRequests()).toBe(0);
});

test('Ver.232+: config restores post-boot version drift on focus without the retired sidecar', async ({ page }) => {
  const requests = await boot(page);
  await corruptVersion(page);

  await page.evaluate(() => window.dispatchEvent(new Event('focus')));

  const versionNode = page.locator('.workboard-version-display');
  const expected = `Ver.${requests.version}`;
  await expect(versionNode).toHaveText(expected);
  await expect(versionNode).toHaveAttribute('title', `現在のバージョン ${expected}`);
  await expect(versionNode).toHaveAttribute('data-release-version', requests.version);
  await expect.poll(() => page.evaluate(() => String(window.WORK_BOARD_RELEASE_VERSION || ''))).toBe(requests.version);
  await expect.poll(() => page.evaluate(() => String(window.WORK_BOARD_VERSION || ''))).toBe(requests.version);
  expect(requests.sidecarRequests()).toBe(0);
});

test('Ver.232+: pageshow recovery keeps semantic version metadata in sync', async ({ page }) => {
  const requests = await boot(page);
  await corruptVersion(page);

  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));

  const versionNode = page.locator('.workboard-version-display');
  await expect(versionNode).toHaveText(`Ver.${requests.version}`);
  await expect(versionNode).not.toHaveClass(/app-version/);
  await expect(versionNode).toHaveAttribute('data-release-version', requests.version);
  await expect.poll(() => page.evaluate(() => String(window.WORK_BOARD_VERSION || ''))).toBe(requests.version);
});
