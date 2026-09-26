import { test, expect } from '@playwright/test';

const ROOM = 'test-brand-bfcache-recovery-v288';

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
  await page.addInitScript(room => {
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('systemTaskUser', '福冨');
    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return null; }, set() {} });
    window.__WB_BRAND_BFCACHE_V288__ = { phase: 'startup', applyCalls: 0, brandWrites: 0, iconRebuilds: 0, notificationWraps: 0, datasetWrites: 0 };
  }, ROOM);

  await page.route(/\/brand-v185\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    let body = await response.text();
    const brandNeedle = `      if (img.getAttribute('src') !== SVG_ICON) img.setAttribute('src', SVG_ICON);`;
    body = body.replace(brandNeedle, `      if (img.getAttribute('src') !== SVG_ICON) { window.__WB_BRAND_BFCACHE_V288__.brandWrites += 1; img.setAttribute('src', SVG_ICON); }`);
    const iconNeedle = `    document.head.querySelectorAll(ICON_SELECTOR).forEach(link => link.remove());`;
    body = body.replace(iconNeedle, `    window.__WB_BRAND_BFCACHE_V288__.iconRebuilds += 1;\n    document.head.querySelectorAll(ICON_SELECTOR).forEach(link => link.remove());`);
    const notificationNeedle = `    window.Notification = WorkBoardNotification;`;
    body = body.replace(notificationNeedle, `    window.__WB_BRAND_BFCACHE_V288__.notificationWraps += 1;\n    window.Notification = WorkBoardNotification;`);
    const applyNeedle = `  function apply() {\n    patchBrandMark();\n    patchBrowserIcons();\n    patchNotifications();\n    if (document.documentElement.dataset.brandVersion !== VERSION) {\n      document.documentElement.dataset.brandVersion = VERSION;\n    }\n  }`;
    if (!body.includes(applyNeedle)) throw new Error('Ver.288 apply injection point not found');
    body = body.replace(applyNeedle, `  function apply() {\n    const audit = window.__WB_BRAND_BFCACHE_V288__;\n    audit.applyCalls += 1;\n    patchBrandMark();\n    patchBrowserIcons();\n    patchNotifications();\n    if (document.documentElement.dataset.brandVersion !== VERSION) {\n      audit.datasetWrites += 1;\n      document.documentElement.dataset.brandVersion = VERSION;\n    }\n  }`);
    await route.fulfill({ response, body });
  });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page) {
  await installAudit(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30000 });
  await page.waitForFunction(() => document.documentElement.dataset.brandVersion === '185');
  await page.waitForTimeout(100);
}

async function snapshot(page) {
  return page.evaluate(() => ({
    audit: structuredClone(window.__WB_BRAND_BFCACHE_V288__),
    brand: document.querySelector('.brand-mark img')?.getAttribute('src') || '',
    dataset: document.documentElement.dataset.brandVersion || '',
    notification: window.Notification?.__workBoardBrandVersion || '',
    icons: [...document.head.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')].map(link => ({ rel: link.getAttribute('rel') || '', href: link.getAttribute('href') || '', type: link.getAttribute('type') || '', sizes: link.getAttribute('sizes') || '' }))
  }));
}

test('Ver.288 audit: no-drift persisted recovery executes apply but performs no canonical writes', async ({ page }) => {
  await boot(page);
  const before = await snapshot(page);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await page.waitForTimeout(80);
  const after = await snapshot(page);
  expect(after.audit.applyCalls).toBe(before.audit.applyCalls + 1);
  expect(after.audit.brandWrites).toBe(before.audit.brandWrites);
  expect(after.audit.iconRebuilds).toBe(before.audit.iconRebuilds);
  expect(after.audit.notificationWraps).toBe(before.audit.notificationWraps);
  expect(after.audit.datasetWrites).toBe(before.audit.datasetWrites);
  expectedCanonicalIcons(after.icons);
});

test('Ver.288 audit: non-persisted pageshow remains a complete no-op', async ({ page }) => {
  await boot(page);
  const before = await snapshot(page);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false })));
  await page.waitForTimeout(80);
  const after = await snapshot(page);
  expect(after.audit).toEqual(before.audit);
});

test('Ver.288 audit: persisted recovery independently repairs brand, favicon, Notification and dataset drift', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    document.querySelector('.brand-mark img')?.setAttribute('src', 'assets/brand.png?v=v288-drift');
    document.head.querySelector('link[rel~="icon"]')?.setAttribute('href', 'assets/brand.png?v=v288-drift');
    function SyntheticNotification() {}
    SyntheticNotification.requestPermission = async () => 'default';
    Object.defineProperty(SyntheticNotification, 'permission', { configurable: true, get: () => 'default' });
    window.Notification = SyntheticNotification;
    document.documentElement.dataset.brandVersion = 'v288-drift';
  });
  const before = await snapshot(page);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await page.waitForTimeout(100);
  const after = await snapshot(page);
  expect(after.audit.applyCalls).toBe(before.audit.applyCalls + 1);
  expect(after.audit.brandWrites).toBe(before.audit.brandWrites + 1);
  expect(after.audit.iconRebuilds).toBe(before.audit.iconRebuilds + 1);
  expect(after.audit.notificationWraps).toBe(before.audit.notificationWraps + 1);
  expect(after.audit.datasetWrites).toBe(before.audit.datasetWrites + 1);
  expect(after.brand).toContain('assets/brand-v184.svg?v=185');
  expect(after.dataset).toBe('185');
  expect(after.notification).toBe('185');
  expectedCanonicalIcons(after.icons);
});
