import { test, expect } from '@playwright/test';

const ROOM = 'test-brand-pageshow-persisted-v285';

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

    const audit = window.__WB_BRAND_PAGESHOW_V285__ = {
      phase: 'startup',
      applyCalls: [],
      pageshowEvents: [],
      brandWrites: 0,
      iconAdds: 0,
      iconRemoves: 0,
      notificationWraps: 0,
      datasetAssignments: 0,
      datasetMutations: 0
    };

    window.addEventListener('pageshow', event => {
      audit.pageshowEvents.push({
        persisted: event.persisted,
        readyState: document.readyState,
        assetsReady: window.WORK_BOARD_ASSETS_READY === true
      });
      audit.phase = event.persisted ? 'persisted-pageshow' : 'nonpersisted-pageshow';
    }, true);
  }, ROOM);

  await page.route(/\/brand-v185\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    let body = await response.text();

    const topNeedle = `  const EXPECTED_ICONS = [`;
    const topReplacement = `  const brandAuditV285 = window.__WB_BRAND_PAGESHOW_V285__;\n  if (brandAuditV285 && document.documentElement) {\n    new MutationObserver(records => {\n      brandAuditV285.datasetMutations += records.filter(record => record.type === 'attributes' && record.attributeName === 'data-brand-version').length;\n    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-brand-version'], attributeOldValue: true });\n  }\n\n  const EXPECTED_ICONS = [`;
    if (!body.includes(topNeedle)) throw new Error('Ver.285 top injection point not found');
    body = body.replace(topNeedle, topReplacement);

    const brandNeedle = `      if (img.getAttribute('src') !== SVG_ICON) img.setAttribute('src', SVG_ICON);`;
    const brandReplacement = `      if (img.getAttribute('src') !== SVG_ICON) {\n        if (brandAuditV285) brandAuditV285.brandWrites += 1;\n        img.setAttribute('src', SVG_ICON);\n      }`;
    if (!body.includes(brandNeedle)) throw new Error('Ver.285 brand write injection point not found');
    body = body.replace(brandNeedle, brandReplacement);

    const appendNeedle = `    document.head.appendChild(link);`;
    const appendReplacement = `    if (brandAuditV285) brandAuditV285.iconAdds += 1;\n    document.head.appendChild(link);`;
    if (!body.includes(appendNeedle)) throw new Error('Ver.285 icon append injection point not found');
    body = body.replace(appendNeedle, appendReplacement);

    const removeNeedle = `    document.head.querySelectorAll(ICON_SELECTOR).forEach(link => link.remove());`;
    const removeReplacement = `    document.head.querySelectorAll(ICON_SELECTOR).forEach(link => {\n      if (brandAuditV285) brandAuditV285.iconRemoves += 1;\n      link.remove();\n    });`;
    if (!body.includes(removeNeedle)) throw new Error('Ver.285 icon remove injection point not found');
    body = body.replace(removeNeedle, removeReplacement);

    const notificationNeedle = `    window.Notification = WorkBoardNotification;`;
    const notificationReplacement = `    if (brandAuditV285) brandAuditV285.notificationWraps += 1;\n    window.Notification = WorkBoardNotification;`;
    if (!body.includes(notificationNeedle)) throw new Error('Ver.285 notification injection point not found');
    body = body.replace(notificationNeedle, notificationReplacement);

    const applyNeedle = `  function apply() {\n    patchBrandMark();\n    patchBrowserIcons();\n    patchNotifications();\n    if (document.documentElement.dataset.brandVersion !== VERSION) {\n      document.documentElement.dataset.brandVersion = VERSION;\n    }\n  }`;
    const applyReplacement = `  function apply() {\n    const audit = brandAuditV285;\n    if (audit) {\n      audit.applyCalls.push({\n        phase: audit.phase,\n        readyState: document.readyState,\n        assetsReady: window.WORK_BOARD_ASSETS_READY === true,\n        guardActive: [...document.documentElement.classList].some(name => name.startsWith('wb-first-paint-v')),\n        brandVersionBefore: document.documentElement.dataset.brandVersion || ''\n      });\n    }\n    patchBrandMark();\n    patchBrowserIcons();\n    patchNotifications();\n    if (document.documentElement.dataset.brandVersion !== VERSION) {\n      if (audit) audit.datasetAssignments += 1;\n      document.documentElement.dataset.brandVersion = VERSION;\n    }\n  }`;
    if (!body.includes(applyNeedle)) throw new Error('Ver.285 apply injection point not found');
    body = body.replace(applyNeedle, applyReplacement);

    await route.fulfill({ response, body });
  });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page) {
  await installAudit(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === window.WORK_BOARD_RELEASE?.version, undefined, { timeout: 8_000 });
  await page.waitForFunction(() => document.documentElement.dataset.brandVersion === '185', undefined, { timeout: 8_000 });
  await page.waitForTimeout(120);

  return page.evaluate(() => ({
    audit: structuredClone(window.__WB_BRAND_PAGESHOW_V285__),
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

test('Ver.285 product: cold boot stays canonical with one startup apply and ignores initial non-persisted pageshow', async ({ page }) => {
  const state = await boot(page);
  console.log('V285_BRAND_COLD_BOOT_PRODUCT', JSON.stringify(state));

  expect(Number(state.final.release)).toBeGreaterThanOrEqual(265);
  expect(state.audit.applyCalls).toHaveLength(1);
  expect(state.audit.applyCalls[0].phase).toBe('startup');
  expect(state.audit.pageshowEvents).toEqual(expect.arrayContaining([expect.objectContaining({ persisted: false })]));
  expect(state.audit.brandWrites).toBe(1);
  expect(state.audit.iconAdds).toBe(4);
  expect(state.audit.iconRemoves).toBeGreaterThan(0);
  expect(state.audit.notificationWraps).toBe(1);
  expect(state.audit.datasetAssignments).toBe(1);
  expect(state.audit.datasetMutations).toBeGreaterThanOrEqual(1);
  expectCanonicalState(state.final);
});

test('Ver.285 product: later non-persisted pageshow remains a no-op', async ({ page }) => {
  await boot(page);

  const result = await page.evaluate(async () => {
    const audit = window.__WB_BRAND_PAGESHOW_V285__;
    const before = {
      applyCalls: audit.applyCalls.length,
      brandWrites: audit.brandWrites,
      iconAdds: audit.iconAdds,
      iconRemoves: audit.iconRemoves,
      notificationWraps: audit.notificationWraps,
      datasetAssignments: audit.datasetAssignments
    };

    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
    await new Promise(resolve => setTimeout(resolve, 80));

    return { before, after: structuredClone(audit) };
  });

  console.log('V285_BRAND_NONPERSISTED_NOOP', JSON.stringify(result));
  expect(result.after.applyCalls.length).toBe(result.before.applyCalls);
  expect(result.after.brandWrites).toBe(result.before.brandWrites);
  expect(result.after.iconAdds).toBe(result.before.iconAdds);
  expect(result.after.iconRemoves).toBe(result.before.iconRemoves);
  expect(result.after.notificationWraps).toBe(result.before.notificationWraps);
  expect(result.after.datasetAssignments).toBe(result.before.datasetAssignments);
});

test('Ver.285 product: persisted pageshow still repairs synthetic brand, favicon and Notification drift', async ({ page }) => {
  await boot(page);

  const result = await page.evaluate(async () => {
    const audit = window.__WB_BRAND_PAGESHOW_V285__;
    const brand = document.querySelector('.brand-mark img');
    brand?.setAttribute('src', 'assets/brand.png?v=synthetic-v285');
    const firstIcon = document.head.querySelector('link[rel~="icon"]');
    firstIcon?.setAttribute('href', 'assets/brand.png?v=synthetic-v285');

    function SyntheticNotification() {}
    SyntheticNotification.requestPermission = async () => 'default';
    Object.defineProperty(SyntheticNotification, 'permission', { configurable: true, get: () => 'default' });
    window.Notification = SyntheticNotification;

    const before = {
      applyCalls: audit.applyCalls.length,
      brandWrites: audit.brandWrites,
      iconAdds: audit.iconAdds,
      iconRemoves: audit.iconRemoves,
      notificationWraps: audit.notificationWraps,
      datasetAssignments: audit.datasetAssignments
    };

    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      before,
      after: structuredClone(audit),
      brandMark: brand?.getAttribute('src') || '',
      notificationBrand: window.Notification?.__workBoardBrandVersion || '',
      icons: [...document.head.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')].map(link => ({
        rel: link.getAttribute('rel') || '',
        href: link.getAttribute('href') || '',
        type: link.getAttribute('type') || '',
        sizes: link.getAttribute('sizes') || ''
      }))
    };
  });

  console.log('V285_BRAND_PERSISTED_RECOVERY', JSON.stringify(result));
  expect(result.after.applyCalls.length).toBe(result.before.applyCalls + 1);
  expect(result.after.applyCalls.at(-1).phase).toBe('persisted-pageshow');
  expect(result.after.brandWrites).toBe(result.before.brandWrites + 1);
  expect(result.after.iconAdds).toBe(result.before.iconAdds + 4);
  expect(result.after.iconRemoves).toBeGreaterThan(result.before.iconRemoves);
  expect(result.after.notificationWraps).toBe(result.before.notificationWraps + 1);
  expect(result.after.datasetAssignments).toBe(result.before.datasetAssignments);
  expect(result.brandMark).toContain('assets/brand-v184.svg?v=185');
  expect(result.notificationBrand).toBe('185');
  expectedCanonicalIcons(result.icons);
});
