import { test, expect } from '@playwright/test';

// Regression for on-demand display fallback assets and Palette NEXT startup.
test('Ver.456: Classic skips Palette assets and switching loads them once', async ({ page }) => {
  const room = 'palette-lazy-v456';
  await page.setViewportSize({ width: 1366, height: 850 });
  await page.route('**/*', route => {
    const origin = new URL(route.request().url()).origin;
    return origin === 'http://127.0.0.1:4173'
      ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(({ room }) => {
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get() { return null; }, set() {}
    });
    localStorage.setItem('systemTaskUser', 'PaletteLazyTester');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.removeItem(
      'workBoardDisplayV356:' + encodeURIComponent(room) + ':' +
      encodeURIComponent('PaletteLazyTester')
    );
  }, { room });

  const assets = [];
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/palette-display-v358.css') ||
        pathname.endsWith('/palette-display-v358.js')) assets.push(pathname);
  });

  await page.goto('/?room=' + room, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true);
  expect(assets).toHaveLength(0);

  await page.locator('[data-wb-display-choice="palette"]').evaluate(button => button.click());
  await expect(page.locator('#paletteNextRoot .wb-pn')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('link[data-workboard-style="palette-display-v358.css"][data-loaded="true"]')).toHaveCount(1);
  await expect(page.locator('script[data-workboard-stable="palette-display-v358.js"][data-loaded="true"]')).toHaveCount(1);
  expect(assets.filter(path => path.endsWith('.css'))).toHaveLength(1);
  expect(assets.filter(path => path.endsWith('.js'))).toHaveLength(1);

  await page.locator('#pnMode').selectOption('classic');
  await expect(page.locator('html')).toHaveAttribute('data-wb-display', 'classic');
  await page.locator('[data-wb-display-choice="palette"]').evaluate(button => button.click());
  await expect(page.locator('#paletteNextRoot .wb-pn')).toBeVisible();
  expect(assets).toHaveLength(2);
});
