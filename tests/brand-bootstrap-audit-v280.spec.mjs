import { test, expect } from '@playwright/test';

const ROOM = 'test-brand-bootstrap-v281';

function expectedCanonicalIcons(icons) {
  expect(icons).toHaveLength(4);
  expect(icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ rel: 'icon', href: expect.stringMatching(/assets\/brand-v184\.svg\?v=185$/), type: 'image/svg+xml' }),
    expect.objectContaining({ rel: 'icon', href: expect.stringMatching(/assets\/brand-v184\.png\?v=185$/), type: 'image/png', sizes: '512x512' }),
    expect.objectContaining({ rel: 'shortcut icon', href: expect.stringMatching(/assets\/brand-v184\.png\?v=185$/), type: 'image/png' }),
    expect.objectContaining({ rel: 'apple-touch-icon', href: expect.stringMatching(/assets\/brand-v184\.png\?v=185$/) })
  ]));
}

async function installAudit(page) {
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('systemTaskUser', '福冨');
    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return null; }, set() {} });
    window.__WB_BRAND_BOOTSTRAP_V281__ = { brandBeforeApply: null, brandAfterApply: null };
  }, { room: ROOM });

  const snapshotExpr = `(() => ({
    guardActive: [...document.documentElement.classList].some(name => name.startsWith('wb-first-paint-v')),
    assetsReady: window.WORK_BOARD_ASSETS_READY === true,
    brandMark: document.querySelector('.brand-mark img')?.getAttribute('src') || '',
    icons: [...document.head.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')].map(link => ({ rel: link.getAttribute('rel') || '', href: link.getAttribute('href') || '', type: link.getAttribute('type') || '', sizes: link.getAttribute('sizes') || '' }))
  }))()`;

  await page.route(/\/config\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    const body = await response.text();
    if (/patchBrandIcons|upsertIconLink|assets\/brand\.png/.test(body)) throw new Error('Ver.281 config unexpectedly retains bootstrap brand mutation');
    await route.fulfill({ response, body });
  });

  await page.route(/\/brand-v185\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    let body = await response.text();
    const needle = `  function apply() {\n    patchBrandMark();\n    patchBrowserIcons();\n    patchNotifications();\n    if (document.documentElement.dataset.brandVersion !== VERSION) {\n      document.documentElement.dataset.brandVersion = VERSION;\n    }\n  }`;
    const replacement = `  function apply() {\n    if (!window.__WB_BRAND_BOOTSTRAP_V281__.brandBeforeApply) {\n      window.__WB_BRAND_BOOTSTRAP_V281__.brandBeforeApply = ${snapshotExpr};\n    }\n    patchBrandMark();\n    patchBrowserIcons();\n    patchNotifications();\n    if (document.documentElement.dataset.brandVersion !== VERSION) {\n      document.documentElement.dataset.brandVersion = VERSION;\n    }\n    if (!window.__WB_BRAND_BOOTSTRAP_V281__.brandAfterApply) {\n      window.__WB_BRAND_BOOTSTRAP_V281__.brandAfterApply = ${snapshotExpr};\n    }\n  }`;
    if (!body.includes(needle)) throw new Error('Ver.281+ brand apply audit injection point not found');
    body = body.replace(needle, replacement);
    await route.fulfill({ response, body });
  });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page) {
  await installAudit(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === window.WORK_BOARD_RELEASE?.version, undefined, { timeout: 8_000 });
  await page.waitForFunction(() => document.documentElement.dataset.brandVersion === '185', undefined, { timeout: 8_000 });
  await page.waitForTimeout(100);
  return page.evaluate(() => {
    const audit = window.__WB_BRAND_BOOTSTRAP_V281__;
    const icons = [...document.head.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')].map(link => ({ rel: link.getAttribute('rel') || '', href: link.getAttribute('href') || '', type: link.getAttribute('type') || '', sizes: link.getAttribute('sizes') || '' }));
    return { ...audit, final: { guardActive: [...document.documentElement.classList].some(name => name.startsWith('wb-first-paint-v')), assetsReady: window.WORK_BOARD_ASSETS_READY === true, firstPaintVersion: document.documentElement.dataset.firstPaintVersion || '', brandVersion: document.documentElement.dataset.brandVersion || '', brandMark: document.querySelector('.brand-mark img')?.getAttribute('src') || '', notificationBrand: window.Notification?.__workBoardBrandVersion || '', release: window.WORK_BOARD_RELEASE?.version || '', icons } };
  });
}

function expectCanonicalFinal(state) {
  expect(Number(state.final.release)).toBeGreaterThanOrEqual(263);
  expect(state.final.guardActive).toBe(false); expect(state.final.assetsReady).toBe(true); expect(state.final.firstPaintVersion).toBe(state.final.release); expect(state.final.brandVersion).toBe('185'); expect(state.final.brandMark).toContain('assets/brand-v184.svg?v=185'); expect(state.final.notificationBrand).toBe('185'); expectedCanonicalIcons(state.final.icons);
}

test('Ver.281+ product: config bootstrap is absent and canonical brand converges through the brand apply lifecycle before reveal', async ({ page }) => {
  const state = await boot(page); console.log('V281_BRAND_BOOTSTRAP_PRODUCT', JSON.stringify(state));
  expect(state.brandBeforeApply.guardActive).toBe(true); expect(state.brandBeforeApply.assetsReady).toBe(false); expect(state.brandBeforeApply.brandMark).toMatch(/assets\/brand-v184\.svg\?v=\d+$/); expect(state.brandBeforeApply.icons.some(icon => /assets\/brand\.png\?v=143$/.test(icon.href))).toBe(true); expect(state.brandAfterApply.guardActive).toBe(true); expectedCanonicalIcons(state.brandAfterApply.icons); expectCanonicalFinal(state);
});

test('Ver.281 product: pageshow still repairs synthetic brand, favicon and Notification drift', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const brand = document.querySelector('.brand-mark img'); brand?.setAttribute('src', 'assets/brand.png?v=synthetic-v281'); const firstIcon = document.head.querySelector('link[rel~="icon"]'); firstIcon?.setAttribute('href', 'assets/brand.png?v=synthetic-v281');
    function SyntheticNotification() {} SyntheticNotification.requestPermission = async () => 'default'; Object.defineProperty(SyntheticNotification, 'permission', { configurable: true, get: () => 'default' }); window.Notification = SyntheticNotification;
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); await new Promise(resolve => setTimeout(resolve, 80));
    return { brandMark: brand?.getAttribute('src') || '', notificationBrand: window.Notification?.__workBoardBrandVersion || '', icons: [...document.head.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')].map(link => ({ rel: link.getAttribute('rel') || '', href: link.getAttribute('href') || '', type: link.getAttribute('type') || '', sizes: link.getAttribute('sizes') || '' })) };
  });
  console.log('V281_BRAND_BOOTSTRAP_RECOVERY', JSON.stringify(result)); expect(result.brandMark).toContain('assets/brand-v184.svg?v=185'); expect(result.notificationBrand).toBe('185'); expectedCanonicalIcons(result.icons);
});
