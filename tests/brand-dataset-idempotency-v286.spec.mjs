import { test, expect } from '@playwright/test';

const ROOM = 'test-brand-dataset-idempotency-v286';

function expectedCanonicalIcons(icons) {
  expect(icons).toHaveLength(4);
  expect(icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ rel: 'icon', href: expect.stringMatching(/assets\/brand-v184\.svg\?v=185$/), type: 'image/svg+xml' }),
    expect.objectContaining({ rel: 'icon', href: expect.stringMatching(/assets\/brand-v184\.png\?v=185$/), type: 'image/png', sizes: '512x512' }),
    expect.objectContaining({ rel: 'shortcut icon', href: expect.stringMatching(/assets\/brand-v184\.png\?v=185$/), type: 'image/png' }),
    expect.objectContaining({ rel: 'apple-touch-icon', href: expect.stringMatching(/assets\/brand-v184\.png\?v=185$/) })
  ]));
}

async function installAudit(page, conditionalDataset) {
  await page.addInitScript(({ room, conditionalDataset }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('systemTaskUser', '福冨');
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
    window.__WB_BRAND_DATASET_V286__ = {
      conditionalDataset,
      phase: 'startup',
      applyCalls: [],
      brandWrites: 0,
      iconAdds: 0,
      iconRemoves: 0,
      notificationWraps: 0,
      datasetAssignments: 0,
      datasetMutations: 0
    };
    window.addEventListener('pageshow', event => {
      window.__WB_BRAND_DATASET_V286__.phase = event.persisted ? 'persisted-pageshow' : 'nonpersisted-pageshow';
    }, true);
  }, { room: ROOM, conditionalDataset });

  await page.route(/\/brand-v185\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    let body = await response.text();

    const topNeedle = `  const EXPECTED_ICONS = [`;
    const topReplacement = `  const brandAuditV286 = window.__WB_BRAND_DATASET_V286__;\n  if (brandAuditV286 && document.documentElement) {\n    new MutationObserver(records => {\n      brandAuditV286.datasetMutations += records.filter(record => record.type === 'attributes' && record.attributeName === 'data-brand-version').length;\n    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-brand-version'], attributeOldValue: true });\n  }\n\n  const EXPECTED_ICONS = [`;
    if (!body.includes(topNeedle)) throw new Error('Ver.286 top injection point not found');
    body = body.replace(topNeedle, topReplacement);

    const brandNeedle = `      if (img.getAttribute('src') !== SVG_ICON) img.setAttribute('src', SVG_ICON);`;
    const brandReplacement = `      if (img.getAttribute('src') !== SVG_ICON) {\n        if (brandAuditV286) brandAuditV286.brandWrites += 1;\n        img.setAttribute('src', SVG_ICON);\n      }`;
    if (!body.includes(brandNeedle)) throw new Error('Ver.286 brand injection point not found');
    body = body.replace(brandNeedle, brandReplacement);

    const appendNeedle = `    document.head.appendChild(link);`;
    const appendReplacement = `    if (brandAuditV286) brandAuditV286.iconAdds += 1;\n    document.head.appendChild(link);`;
    if (!body.includes(appendNeedle)) throw new Error('Ver.286 icon append injection point not found');
    body = body.replace(appendNeedle, appendReplacement);

    const removeNeedle = `    document.head.querySelectorAll(ICON_SELECTOR).forEach(link => link.remove());`;
    const removeReplacement = `    document.head.querySelectorAll(ICON_SELECTOR).forEach(link => {\n      if (brandAuditV286) brandAuditV286.iconRemoves += 1;\n      link.remove();\n    });`;
    if (!body.includes(removeNeedle)) throw new Error('Ver.286 icon remove injection point not found');
    body = body.replace(removeNeedle, removeReplacement);

    const notificationNeedle = `    window.Notification = WorkBoardNotification;`;
    const notificationReplacement = `    if (brandAuditV286) brandAuditV286.notificationWraps += 1;\n    window.Notification = WorkBoardNotification;`;
    if (!body.includes(notificationNeedle)) throw new Error('Ver.286 Notification injection point not found');
    body = body.replace(notificationNeedle, notificationReplacement);

    const applyNeedle = `  function apply() {\n    patchBrandMark();\n    patchBrowserIcons();\n    patchNotifications();\n    document.documentElement.dataset.brandVersion = VERSION;\n  }`;
    const assignment = conditionalDataset
      ? `    if (document.documentElement.dataset.brandVersion !== VERSION) {\n      if (brandAuditV286) brandAuditV286.datasetAssignments += 1;\n      document.documentElement.dataset.brandVersion = VERSION;\n    }`
      : `    if (brandAuditV286) brandAuditV286.datasetAssignments += 1;\n    document.documentElement.dataset.brandVersion = VERSION;`;
    const applyReplacement = `  function apply() {\n    if (brandAuditV286) brandAuditV286.applyCalls.push({\n      phase: brandAuditV286.phase,\n      brandVersionBefore: document.documentElement.dataset.brandVersion || '',\n      guardActive: [...document.documentElement.classList].some(name => name.startsWith('wb-first-paint-v')),\n      assetsReady: window.WORK_BOARD_ASSETS_READY === true\n    });\n    patchBrandMark();\n    patchBrowserIcons();\n    patchNotifications();\n${assignment}\n  }`;
    if (!body.includes(applyNeedle)) throw new Error('Ver.286 apply injection point not found');
    body = body.replace(applyNeedle, applyReplacement);

    await route.fulfill({ response, body });
  });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page, conditionalDataset) {
  await installAudit(page, conditionalDataset);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.brandVersion === '185', undefined, { timeout: 8_000 });
  await page.waitForTimeout(100);
}

async function persistedNoDrift(page) {
  return page.evaluate(async () => {
    const audit = window.__WB_BRAND_DATASET_V286__;
    const before = structuredClone(audit);
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    await new Promise(resolve => setTimeout(resolve, 100));
    return { before, after: structuredClone(audit) };
  });
}

test('Ver.286 audit: current persisted no-drift recovery repeats only data-brand-version assignment', async ({ page }) => {
  await boot(page, false);
  const result = await persistedNoDrift(page);
  console.log('V286_DATASET_BASELINE', JSON.stringify(result));

  expect(result.after.applyCalls.length).toBe(result.before.applyCalls.length + 1);
  expect(result.after.brandWrites).toBe(result.before.brandWrites);
  expect(result.after.iconAdds).toBe(result.before.iconAdds);
  expect(result.after.iconRemoves).toBe(result.before.iconRemoves);
  expect(result.after.notificationWraps).toBe(result.before.notificationWraps);
  expect(result.after.datasetAssignments).toBe(result.before.datasetAssignments + 1);
  expect(result.after.datasetMutations).toBeGreaterThan(result.before.datasetMutations);
});

test('Ver.286 audit: conditional dataset write removes persisted no-drift mutation without changing canonical state', async ({ page }) => {
  await boot(page, true);
  const result = await persistedNoDrift(page);
  const state = await page.evaluate(() => ({
    brandVersion: document.documentElement.dataset.brandVersion || '',
    brandMark: document.querySelector('.brand-mark img')?.getAttribute('src') || '',
    notificationBrand: window.Notification?.__workBoardBrandVersion || '',
    icons: [...document.head.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')].map(link => ({
      rel: link.getAttribute('rel') || '', href: link.getAttribute('href') || '', type: link.getAttribute('type') || '', sizes: link.getAttribute('sizes') || ''
    }))
  }));
  console.log('V286_DATASET_COUNTERFACTUAL', JSON.stringify({ result, state }));

  expect(result.after.applyCalls.length).toBe(result.before.applyCalls.length + 1);
  expect(result.after.datasetAssignments).toBe(result.before.datasetAssignments);
  expect(result.after.datasetMutations).toBe(result.before.datasetMutations);
  expect(state.brandVersion).toBe('185');
  expect(state.brandMark).toContain('assets/brand-v184.svg?v=185');
  expect(state.notificationBrand).toBe('185');
  expectedCanonicalIcons(state.icons);
});

test('Ver.286 audit: conditional dataset write still repairs full synthetic drift on persisted restore', async ({ page }) => {
  await boot(page, true);
  const result = await page.evaluate(async () => {
    const audit = window.__WB_BRAND_DATASET_V286__;
    const brand = document.querySelector('.brand-mark img');
    brand?.setAttribute('src', 'assets/brand.png?v=synthetic-v286');
    document.documentElement.dataset.brandVersion = 'synthetic-v286';
    const firstIcon = document.head.querySelector('link[rel~="icon"]');
    firstIcon?.setAttribute('href', 'assets/brand.png?v=synthetic-v286');
    function SyntheticNotification() {}
    SyntheticNotification.requestPermission = async () => 'default';
    Object.defineProperty(SyntheticNotification, 'permission', { configurable: true, get: () => 'default' });
    window.Notification = SyntheticNotification;

    const before = structuredClone(audit);
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      before,
      after: structuredClone(audit),
      brandVersion: document.documentElement.dataset.brandVersion || '',
      brandMark: brand?.getAttribute('src') || '',
      notificationBrand: window.Notification?.__workBoardBrandVersion || '',
      icons: [...document.head.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')].map(link => ({
        rel: link.getAttribute('rel') || '', href: link.getAttribute('href') || '', type: link.getAttribute('type') || '', sizes: link.getAttribute('sizes') || ''
      }))
    };
  });
  console.log('V286_DATASET_DRIFT_RECOVERY', JSON.stringify(result));

  expect(result.after.applyCalls.length).toBe(result.before.applyCalls.length + 1);
  expect(result.after.brandWrites).toBe(result.before.brandWrites + 1);
  expect(result.after.iconAdds).toBe(result.before.iconAdds + 4);
  expect(result.after.notificationWraps).toBe(result.before.notificationWraps + 1);
  expect(result.after.datasetAssignments).toBe(result.before.datasetAssignments + 1);
  expect(result.brandVersion).toBe('185');
  expect(result.brandMark).toContain('assets/brand-v184.svg?v=185');
  expect(result.notificationBrand).toBe('185');
  expectedCanonicalIcons(result.icons);
});
