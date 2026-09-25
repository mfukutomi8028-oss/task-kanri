import { test, expect } from '@playwright/test';

const ROOM = 'test-brand-apply-singlepass-v283';

const SNAPSHOT_EXPR = `(() => ({
  readyState: document.readyState,
  guardActive: [...document.documentElement.classList].some(name => name.startsWith('wb-first-paint-v')),
  assetsReady: window.WORK_BOARD_ASSETS_READY === true,
  brandMark: document.querySelector('.brand-mark img')?.getAttribute('src') || '',
  notificationBrand: window.Notification?.__workBoardBrandVersion || '',
  icons: [...document.head.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')].map(link => ({
    rel: link.getAttribute('rel') || '',
    href: link.getAttribute('href') || '',
    type: link.getAttribute('type') || '',
    sizes: link.getAttribute('sizes') || ''
  })),
  patchCalls: window.__WB_BRAND_IMMEDIATE_V283__.patchCalls.length,
  iconAdds: window.__WB_BRAND_IMMEDIATE_V283__.iconAdds,
  iconRemoves: window.__WB_BRAND_IMMEDIATE_V283__.iconRemoves
}))()`;

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

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });

    window.__WB_BRAND_IMMEDIATE_V283__ = {
      phase: 'init',
      patchCalls: [],
      iconAdds: 0,
      iconRemoves: 0,
      beforeApply: null,
      afterApply: null,
      nextFrame: null
    };
  }, ROOM);

  await page.route(/\/brand-v185\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    let body = await response.text();

    const patchNeedle = `  function patchBrowserIcons() {\n    if (!document.head || browserIconsAreCurrent()) return;`;
    const patchReplacement = `  function patchBrowserIcons() {\n    window.__WB_BRAND_IMMEDIATE_V283__.patchCalls.push({\n      phase: window.__WB_BRAND_IMMEDIATE_V283__.phase,\n      readyState: document.readyState,\n      guardActive: [...document.documentElement.classList].some(name => name.startsWith('wb-first-paint-v')),\n      assetsReady: window.WORK_BOARD_ASSETS_READY === true,\n      current: browserIconsAreCurrent()\n    });\n    if (!document.head || browserIconsAreCurrent()) return;`;
    if (!body.includes(patchNeedle)) throw new Error('Ver.283 patchBrowserIcons injection point not found');
    body = body.replace(patchNeedle, patchReplacement);

    const appendNeedle = `    document.head.appendChild(link);`;
    const appendReplacement = `    window.__WB_BRAND_IMMEDIATE_V283__.iconAdds += 1;\n    document.head.appendChild(link);`;
    if (!body.includes(appendNeedle)) throw new Error('Ver.283 append icon injection point not found');
    body = body.replace(appendNeedle, appendReplacement);

    const removeNeedle = `    document.head.querySelectorAll(ICON_SELECTOR).forEach(link => link.remove());`;
    const removeReplacement = `    document.head.querySelectorAll(ICON_SELECTOR).forEach(link => {\n      window.__WB_BRAND_IMMEDIATE_V283__.iconRemoves += 1;\n      link.remove();\n    });`;
    if (!body.includes(removeNeedle)) throw new Error('Ver.283 remove icon injection point not found');
    body = body.replace(removeNeedle, removeReplacement);

    const applyNeedle = `  function apply() {\n    patchBrandMark();\n    patchBrowserIcons();\n    patchNotifications();\n    document.documentElement.dataset.brandVersion = VERSION;\n  }`;
    const applyReplacement = `  function apply() {\n    if (!window.__WB_BRAND_IMMEDIATE_V283__.beforeApply) {\n      window.__WB_BRAND_IMMEDIATE_V283__.beforeApply = ${SNAPSHOT_EXPR};\n      window.__WB_BRAND_IMMEDIATE_V283__.phase = 'startup-apply';\n    } else {\n      window.__WB_BRAND_IMMEDIATE_V283__.phase = 'recovery-apply';\n    }\n    patchBrandMark();\n    patchBrowserIcons();\n    patchNotifications();\n    document.documentElement.dataset.brandVersion = VERSION;\n    if (!window.__WB_BRAND_IMMEDIATE_V283__.afterApply) {\n      window.__WB_BRAND_IMMEDIATE_V283__.afterApply = ${SNAPSHOT_EXPR};\n      requestAnimationFrame(() => {\n        window.__WB_BRAND_IMMEDIATE_V283__.nextFrame = ${SNAPSHOT_EXPR};\n      });\n    }\n  }`;
    if (!body.includes(applyNeedle)) throw new Error('Ver.283 apply injection point not found');
    body = body.replace(applyNeedle, applyReplacement);

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
  await page.waitForFunction(() => window.__WB_BRAND_IMMEDIATE_V283__?.nextFrame, undefined, { timeout: 8_000 });
  await page.waitForTimeout(80);

  return page.evaluate(() => ({
    audit: window.__WB_BRAND_IMMEDIATE_V283__,
    final: {
      guardActive: [...document.documentElement.classList].some(name => name.startsWith('wb-first-paint-v')),
      assetsReady: window.WORK_BOARD_ASSETS_READY === true,
      brandVersion: document.documentElement.dataset.brandVersion || '',
      brandMark: document.querySelector('.brand-mark img')?.getAttribute('src') || '',
      notificationBrand: window.Notification?.__workBoardBrandVersion || '',
      release: window.WORK_BOARD_RELEASE?.version || '',
      icons: [...document.head.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')].map(link => ({
        rel: link.getAttribute('rel') || '',
        href: link.getAttribute('href') || '',
        type: link.getAttribute('type') || '',
        sizes: link.getAttribute('sizes') || ''
      }))
    }
  }));
}

function expectCanonicalState(state) {
  expect(state.guardActive).toBe(false);
  expect(state.assetsReady).toBe(true);
  expect(state.brandVersion).toBe('185');
  expect(state.brandMark).toContain('assets/brand-v184.svg?v=185');
  expect(state.notificationBrand).toBe('185');
  expectedCanonicalIcons(state.icons);
}

test('Ver.283 product: startup canonicalizes brand, favicon and Notification through one apply-owned icon pass', async ({ page }) => {
  const state = await boot(page);
  console.log('V283_BRAND_APPLY_SINGLEPASS', JSON.stringify(state));

  expect(Number(state.final.release)).toBeGreaterThanOrEqual(264);
  expect(state.audit.beforeApply.readyState).not.toBe('loading');
  expect(state.audit.beforeApply.guardActive).toBe(true);
  expect(state.audit.beforeApply.assetsReady).toBe(false);
  expect(state.audit.beforeApply.patchCalls).toBe(0);

  expect(state.audit.afterApply.patchCalls).toBe(1);
  expect(state.audit.afterApply.iconAdds).toBe(4);
  expect(state.audit.afterApply.iconRemoves).toBeGreaterThan(0);
  expect(state.audit.afterApply.brandMark).toContain('assets/brand-v184.svg?v=185');
  expect(state.audit.afterApply.notificationBrand).toBe('185');
  expectedCanonicalIcons(state.audit.afterApply.icons);

  expectedCanonicalIcons(state.audit.nextFrame.icons);
  expect(state.audit.nextFrame.brandMark).toContain('assets/brand-v184.svg?v=185');
  expect(state.audit.nextFrame.notificationBrand).toBe('185');
  expectCanonicalState(state.final);
});

test('Ver.283 product: pageshow still repairs synthetic brand, favicon and Notification drift', async ({ page }) => {
  await boot(page);

  const result = await page.evaluate(async () => {
    const audit = window.__WB_BRAND_IMMEDIATE_V283__;
    const brand = document.querySelector('.brand-mark img');
    brand?.setAttribute('src', 'assets/brand.png?v=synthetic-v283');
    const firstIcon = document.head.querySelector('link[rel~="icon"]');
    firstIcon?.setAttribute('href', 'assets/brand.png?v=synthetic-v283');

    function SyntheticNotification() {}
    SyntheticNotification.requestPermission = async () => 'default';
    Object.defineProperty(SyntheticNotification, 'permission', { configurable: true, get: () => 'default' });
    window.Notification = SyntheticNotification;

    const beforeCalls = audit.patchCalls.length;
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    await new Promise(resolve => setTimeout(resolve, 80));

    return {
      beforeCalls,
      afterCalls: audit.patchCalls.length,
      brandMark: brand?.getAttribute('src') || '',
      notificationBrand: window.Notification?.__workBoardBrandVersion || '',
      lastPatchCall: audit.patchCalls.at(-1),
      icons: [...document.head.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')].map(link => ({
        rel: link.getAttribute('rel') || '',
        href: link.getAttribute('href') || '',
        type: link.getAttribute('type') || '',
        sizes: link.getAttribute('sizes') || ''
      }))
    };
  });

  console.log('V283_BRAND_APPLY_RECOVERY', JSON.stringify(result));
  expect(result.afterCalls).toBe(result.beforeCalls + 1);
  expect(result.lastPatchCall.current).toBe(false);
  expect(result.brandMark).toContain('assets/brand-v184.svg?v=185');
  expect(result.notificationBrand).toBe('185');
  expectedCanonicalIcons(result.icons);
});
