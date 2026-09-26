import { test, expect } from '@playwright/test';

const ROOM = 'test-brand-dataset-idempotency-v287';

function expectedCanonicalIcons(icons) {
  expect(icons).toHaveLength(4);
  expect(icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ rel: 'icon', href: expect.stringMatching(/assets\/brand-v184\.svg\?v=185$/), type: 'image/svg+xml' }),
    expect.objectContaining({ rel: 'icon', href: expect.stringMatching(/assets\/brand-v184\.png\?v=185$/), type: 'image/png', sizes: '512x512' }),
    expect.objectContaining({ rel: 'shortcut icon', href: expect.stringMatching(/assets\/brand-v184\.png\?v=185$/), type: 'image/png' }),
    expect.objectContaining({ rel: 'apple-touch-icon', href: expect.stringMatching(/assets\/brand-v184\.png\?v=185$/) })
  ]));
}

async function boot(page) {
  await page.addInitScript(room => {
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('systemTaskUser', '福冨');
    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return null; }, set() {} });
    window.__WB_V287_DATASET_MUTATIONS__ = 0;
    new MutationObserver(records => {
      window.__WB_V287_DATASET_MUTATIONS__ += records.filter(record => record.type === 'attributes' && record.attributeName === 'data-brand-version').length;
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-brand-version'] });
  }, ROOM);
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.brandVersion === '185', undefined, { timeout: 8_000 });
  await page.waitForTimeout(100);
}

async function state(page) {
  return page.evaluate(() => ({
    brandVersion: document.documentElement.dataset.brandVersion || '',
    brandMark: document.querySelector('.brand-mark img')?.getAttribute('src') || '',
    notificationBrand: window.Notification?.__workBoardBrandVersion || '',
    mutations: window.__WB_V287_DATASET_MUTATIONS__,
    icons: [...document.head.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')].map(link => ({
      rel: link.getAttribute('rel') || '', href: link.getAttribute('href') || '', type: link.getAttribute('type') || '', sizes: link.getAttribute('sizes') || ''
    }))
  }));
}

test('Ver.287 product: persisted no-drift recovery does not rewrite data-brand-version', async ({ page }) => {
  await boot(page);
  const before = await state(page);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await page.waitForTimeout(100);
  const after = await state(page);

  expect(after.mutations).toBe(before.mutations);
  expect(after.brandVersion).toBe('185');
  expect(after.brandMark).toContain('assets/brand-v184.svg?v=185');
  expect(after.notificationBrand).toBe('185');
  expectedCanonicalIcons(after.icons);
});

test('Ver.287 product: persisted recovery repairs full synthetic brand drift', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    document.querySelector('.brand-mark img')?.setAttribute('src', 'assets/brand.png?v=synthetic-v287');
    document.documentElement.dataset.brandVersion = 'synthetic-v287';
    document.head.querySelector('link[rel~="icon"]')?.setAttribute('href', 'assets/brand.png?v=synthetic-v287');
    function SyntheticNotification() {}
    SyntheticNotification.requestPermission = async () => 'default';
    Object.defineProperty(SyntheticNotification, 'permission', { configurable: true, get: () => 'default' });
    window.Notification = SyntheticNotification;
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await page.waitForTimeout(100);
  const after = await state(page);

  expect(after.brandVersion).toBe('185');
  expect(after.brandMark).toContain('assets/brand-v184.svg?v=185');
  expect(after.notificationBrand).toBe('185');
  expectedCanonicalIcons(after.icons);
});
