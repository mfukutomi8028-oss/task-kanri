import { test, expect } from '@playwright/test';

const ROOM = 'test-brand-immediate-v282';

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
  patchCalls: window.__WB_BRAND_IMMEDIATE_V282__.patchCalls.length,
  iconAdds: window.__WB_BRAND_IMMEDIATE_V282__.iconAdds,
  iconRemoves: window.__WB_BRAND_IMMEDIATE_V282__.iconRemoves
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

async function installAudit(page, { suppressStandalone }) {
  await page.addInitScript(({ room, suppress }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId', `${room}-${suppress ? 'suppressed' : 'baseline'}`);
    localStorage.setItem('systemTaskUser', '福冨');

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });

    window.__WB_BRAND_IMMEDIATE_V282__ = {
      suppressStandalone: suppress,
      phase: 'init',
      patchCalls: [],
      iconAdds: 0,
      iconRemoves: 0,
      beforeStandalone: null,
      afterStandalone: null,
      beforeApply: null,
      afterApply: null,
      nextFrame: null
    };
  }, { room: ROOM, suppress: suppressStandalone });

  await page.route(/\/brand-v185\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    let body = await response.text();

    const patchNeedle = `  function patchBrowserIcons() {\n    if (!document.head || browserIconsAreCurrent()) return;`;
    const patchReplacement = `  function patchBrowserIcons() {\n    window.__WB_BRAND_IMMEDIATE_V282__.patchCalls.push({\n      phase: window.__WB_BRAND_IMMEDIATE_V282__.phase,\n      readyState: document.readyState,\n      guardActive: [...document.documentElement.classList].some(name => name.startsWith('wb-first-paint-v')),\n      assetsReady: window.WORK_BOARD_ASSETS_READY === true,\n      current: browserIconsAreCurrent()\n    });\n    if (!document.head || browserIconsAreCurrent()) return;`;
    if (!body.includes(patchNeedle)) throw new Error('Ver.282 patchBrowserIcons injection point not found');
    body = body.replace(patchNeedle, patchReplacement);

    const appendNeedle = `    document.head.appendChild(link);`;
    const appendReplacement = `    window.__WB_BRAND_IMMEDIATE_V282__.iconAdds += 1;\n    document.head.appendChild(link);`;
    if (!body.includes(appendNeedle)) throw new Error('Ver.282 append icon injection point not found');
    body = body.replace(appendNeedle, appendReplacement);

    const removeNeedle = `    document.head.querySelectorAll(ICON_SELECTOR).forEach(link => link.remove());`;
    const removeReplacement = `    document.head.querySelectorAll(ICON_SELECTOR).forEach(link => {\n      window.__WB_BRAND_IMMEDIATE_V282__.iconRemoves += 1;\n      link.remove();\n    });`;
    if (!body.includes(removeNeedle)) throw new Error('Ver.282 remove icon injection point not found');
    body = body.replace(removeNeedle, removeReplacement);

    const applyNeedle = `  function apply() {\n    patchBrandMark();\n    patchBrowserIcons();\n    patchNotifications();\n    document.documentElement.dataset.brandVersion = VERSION;\n  }`;
    const applyReplacement = `  function apply() {\n    patchBrandMark();\n    window.__WB_BRAND_IMMEDIATE_V282__.phase = 'apply';\n    patchBrowserIcons();\n    patchNotifications();\n    document.documentElement.dataset.brandVersion = VERSION;\n    if (!window.__WB_BRAND_IMMEDIATE_V282__.afterApply) {\n      window.__WB_BRAND_IMMEDIATE_V282__.afterApply = ${SNAPSHOT_EXPR};\n    }\n  }`;
    if (!body.includes(applyNeedle)) throw new Error('Ver.282 apply injection point not found');
    body = body.replace(applyNeedle, applyReplacement);

    const standaloneNeedle = `  // Correct the loader's compatibility favicon as soon as this runtime arrives.\n  patchBrowserIcons();`;
    const standaloneReplacement = suppressStandalone
      ? `  // Ver.282 audit counterfactual: standalone favicon correction suppressed.\n  window.__WB_BRAND_IMMEDIATE_V282__.phase = 'standalone-suppressed';\n  window.__WB_BRAND_IMMEDIATE_V282__.beforeApply = ${SNAPSHOT_EXPR};\n  requestAnimationFrame(() => {\n    window.__WB_BRAND_IMMEDIATE_V282__.nextFrame = ${SNAPSHOT_EXPR};\n  });`
      : `  // Correct the loader's compatibility favicon as soon as this runtime arrives.\n  window.__WB_BRAND_IMMEDIATE_V282__.phase = 'standalone';\n  window.__WB_BRAND_IMMEDIATE_V282__.beforeStandalone = ${SNAPSHOT_EXPR};\n  patchBrowserIcons();\n  window.__WB_BRAND_IMMEDIATE_V282__.afterStandalone = ${SNAPSHOT_EXPR};\n  requestAnimationFrame(() => {\n    window.__WB_BRAND_IMMEDIATE_V282__.nextFrame = ${SNAPSHOT_EXPR};\n  });`;
    if (!body.includes(standaloneNeedle)) throw new Error('Ver.282 standalone injection point not found');
    body = body.replace(standaloneNeedle, standaloneReplacement);

    await route.fulfill({ response, body });
  });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page, suppressStandalone) {
  await installAudit(page, { suppressStandalone });
  await page.goto(`/?room=${ROOM}-${suppressStandalone ? 'suppressed' : 'baseline'}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === window.WORK_BOARD_RELEASE?.version, undefined, { timeout: 8_000 });
  await page.waitForFunction(() => document.documentElement.dataset.brandVersion === '185', undefined, { timeout: 8_000 });
  await page.waitForFunction(() => window.__WB_BRAND_IMMEDIATE_V282__?.nextFrame, undefined, { timeout: 8_000 });
  await page.waitForTimeout(80);

  return page.evaluate(() => ({
    audit: window.__WB_BRAND_IMMEDIATE_V282__,
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

test('Ver.282 audit: standalone favicon correction has no independent next-frame or reveal value', async ({ browser }) => {
  const baselineContext = await browser.newContext();
  const baselinePage = await baselineContext.newPage();
  const baseline = await boot(baselinePage, false);
  await baselineContext.close();

  const suppressedContext = await browser.newContext();
  const suppressedPage = await suppressedContext.newPage();
  const suppressed = await boot(suppressedPage, true);
  await suppressedContext.close();

  console.log('V282_BRAND_IMMEDIATE_BASELINE', JSON.stringify(baseline));
  console.log('V282_BRAND_IMMEDIATE_SUPPRESSED', JSON.stringify(suppressed));

  expect(baseline.audit.beforeStandalone.readyState).not.toBe('loading');
  expect(baseline.audit.beforeStandalone.guardActive).toBe(true);
  expect(baseline.audit.beforeStandalone.assetsReady).toBe(false);
  expect(baseline.audit.afterStandalone.patchCalls).toBe(1);
  expectedCanonicalIcons(baseline.audit.afterStandalone.icons);
  expect(baseline.audit.afterApply.patchCalls).toBe(2);

  expect(suppressed.audit.beforeApply.readyState).not.toBe('loading');
  expect(suppressed.audit.beforeApply.guardActive).toBe(true);
  expect(suppressed.audit.beforeApply.assetsReady).toBe(false);
  expect(suppressed.audit.beforeApply.patchCalls).toBe(0);
  expect(suppressed.audit.afterApply.patchCalls).toBe(1);
  expectedCanonicalIcons(suppressed.audit.afterApply.icons);

  expect(suppressed.audit.afterApply.brandMark).toBe(baseline.audit.afterApply.brandMark);
  expect(suppressed.audit.afterApply.notificationBrand).toBe(baseline.audit.afterApply.notificationBrand);
  expect(suppressed.audit.afterApply.iconAdds).toBe(baseline.audit.afterApply.iconAdds);
  expect(suppressed.audit.afterApply.iconRemoves).toBe(baseline.audit.afterApply.iconRemoves);
  expectedCanonicalIcons(baseline.audit.nextFrame.icons);
  expectedCanonicalIcons(suppressed.audit.nextFrame.icons);
  expect(suppressed.audit.nextFrame.brandMark).toBe(baseline.audit.nextFrame.brandMark);
  expect(suppressed.audit.nextFrame.notificationBrand).toBe(baseline.audit.nextFrame.notificationBrand);
  expectCanonicalState(baseline.final);
  expectCanonicalState(suppressed.final);
});

test('Ver.282 audit: pageshow recovery remains canonical when standalone startup call is suppressed', async ({ page }) => {
  await boot(page, true);

  const result = await page.evaluate(async () => {
    const audit = window.__WB_BRAND_IMMEDIATE_V282__;
    const brand = document.querySelector('.brand-mark img');
    brand?.setAttribute('src', 'assets/brand.png?v=synthetic-v282');
    const firstIcon = document.head.querySelector('link[rel~="icon"]');
    firstIcon?.setAttribute('href', 'assets/brand.png?v=synthetic-v282');

    function SyntheticNotification() {}
    SyntheticNotification.requestPermission = async () => 'default';
    Object.defineProperty(SyntheticNotification, 'permission', { configurable: true, get: () => 'default' });
    window.Notification = SyntheticNotification;

    audit.phase = 'pageshow-recovery';
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    await new Promise(resolve => setTimeout(resolve, 80));

    return {
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

  console.log('V282_BRAND_IMMEDIATE_RECOVERY', JSON.stringify(result));
  expect(result.lastPatchCall.phase).toBe('apply');
  expect(result.brandMark).toContain('assets/brand-v184.svg?v=185');
  expect(result.notificationBrand).toBe('185');
  expectedCanonicalIcons(result.icons);
});
