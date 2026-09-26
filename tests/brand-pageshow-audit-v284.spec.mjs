import { test, expect } from '@playwright/test';

const ROOM = 'test-brand-pageshow-audit-v284';
const ICON_SELECTOR = 'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]';

function expectedCanonicalIcons(icons) {
  expect(icons).toHaveLength(4);
  expect(icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ rel: 'icon', href: expect.stringMatching(/assets\/brand-v184\.svg\?v=185$/), type: 'image/svg+xml' }),
    expect.objectContaining({ rel: 'icon', href: expect.stringMatching(/assets\/brand-v184\.png\?v=185$/), type: 'image/png', sizes: '512x512' }),
    expect.objectContaining({ rel: 'shortcut icon', href: expect.stringMatching(/assets\/brand-v184\.png\?v=185$/), type: 'image/png' }),
    expect.objectContaining({ rel: 'apple-touch-icon', href: expect.stringMatching(/assets\/brand-v184\.png\?v=185$/) })
  ]));
}

function expectCanonicalState(state) {
  expect(state.release).toBe('264');
  expect(state.brandVersion).toBe('185');
  expect(state.brandMark).toContain('assets/brand-v184.svg?v=185');
  expect(state.notificationBrand).toBe('185');
  expectedCanonicalIcons(state.icons);
}

async function installAudit(page, suppressInitialPageshow) {
  await page.addInitScript(({ room, suppress }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('systemTaskUser', '福冨');

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });

    window.__WB_BRAND_PAGESHOW_V284__ = {
      suppressInitialPageshow: suppress,
      suppressedInitialPageshow: 0,
      phase: 'init',
      applyCalls: [],
      pageshowEvents: [],
      iconAdds: 0,
      iconRemoves: 0,
      brandWrites: 0,
      notificationWrites: 0,
      brandDatasetAssignments: [],
      brandDatasetMutations: []
    };

    document.addEventListener('DOMContentLoaded', () => {
      const audit = window.__WB_BRAND_PAGESHOW_V284__;
      const observer = new MutationObserver(records => {
        for (const record of records) {
          if (record.target !== document.documentElement || record.attributeName !== 'data-brand-version') continue;
          audit.brandDatasetMutations.push({
            oldValue: record.oldValue || '',
            newValue: document.documentElement.getAttribute('data-brand-version') || ''
          });
        }
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ['data-brand-version']
      });
    }, { once: true });
  }, { room: ROOM, suppress: suppressInitialPageshow });

  await page.route(/\/brand-v185\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    let body = await response.text();

    const brandNeedle = `      if (img.getAttribute('src') !== SVG_ICON) img.setAttribute('src', SVG_ICON);`;
    const brandReplacement = `      if (img.getAttribute('src') !== SVG_ICON) {\n        window.__WB_BRAND_PAGESHOW_V284__.brandWrites += 1;\n        img.setAttribute('src', SVG_ICON);\n      }`;
    if (!body.includes(brandNeedle)) throw new Error('Ver.284 patchBrandMark injection point not found');
    body = body.replace(brandNeedle, brandReplacement);

    const appendNeedle = `    document.head.appendChild(link);`;
    const appendReplacement = `    window.__WB_BRAND_PAGESHOW_V284__.iconAdds += 1;\n    document.head.appendChild(link);`;
    if (!body.includes(appendNeedle)) throw new Error('Ver.284 append icon injection point not found');
    body = body.replace(appendNeedle, appendReplacement);

    const removeNeedle = `    document.head.querySelectorAll(ICON_SELECTOR).forEach(link => link.remove());`;
    const removeReplacement = `    document.head.querySelectorAll(ICON_SELECTOR).forEach(link => {\n      window.__WB_BRAND_PAGESHOW_V284__.iconRemoves += 1;\n      link.remove();\n    });`;
    if (!body.includes(removeNeedle)) throw new Error('Ver.284 remove icon injection point not found');
    body = body.replace(removeNeedle, removeReplacement);

    const notificationNeedle = `    window.Notification = WorkBoardNotification;`;
    const notificationReplacement = `    window.__WB_BRAND_PAGESHOW_V284__.notificationWrites += 1;\n    window.Notification = WorkBoardNotification;`;
    if (!body.includes(notificationNeedle)) throw new Error('Ver.284 Notification injection point not found');
    body = body.replace(notificationNeedle, notificationReplacement);

    const applyNeedle = `  function apply() {\n    patchBrandMark();\n    patchBrowserIcons();\n    patchNotifications();\n    document.documentElement.dataset.brandVersion = VERSION;\n  }`;
    const applyReplacement = `  function apply() {\n    const audit = window.__WB_BRAND_PAGESHOW_V284__;\n    const phase = audit.phase === 'init' ? 'startup' : audit.phase;\n    const call = {\n      phase,\n      readyState: document.readyState,\n      guardActive: [...document.documentElement.classList].some(name => name.startsWith('wb-first-paint-v')),\n      assetsReady: window.WORK_BOARD_ASSETS_READY === true,\n      iconAddsBefore: audit.iconAdds,\n      iconRemovesBefore: audit.iconRemoves,\n      brandWritesBefore: audit.brandWrites,\n      notificationWritesBefore: audit.notificationWrites,\n      brandDatasetBefore: document.documentElement.dataset.brandVersion || '',\n      brandMarkBefore: document.querySelector('.brand-mark img')?.getAttribute('src') || '',\n      notificationBrandBefore: window.Notification?.__workBoardBrandVersion || '',\n      iconsCurrentBefore: browserIconsAreCurrent()\n    };\n    audit.applyCalls.push(call);\n    patchBrandMark();\n    patchBrowserIcons();\n    patchNotifications();\n    const datasetBefore = document.documentElement.dataset.brandVersion || '';\n    document.documentElement.dataset.brandVersion = VERSION;\n    audit.brandDatasetAssignments.push({ phase, before: datasetBefore, after: document.documentElement.dataset.brandVersion || '' });\n    call.iconAddsAfter = audit.iconAdds;\n    call.iconRemovesAfter = audit.iconRemoves;\n    call.brandWritesAfter = audit.brandWrites;\n    call.notificationWritesAfter = audit.notificationWrites;\n    call.brandDatasetAfter = document.documentElement.dataset.brandVersion || '';\n    call.brandMarkAfter = document.querySelector('.brand-mark img')?.getAttribute('src') || '';\n    call.notificationBrandAfter = window.Notification?.__workBoardBrandVersion || '';\n    call.iconsCurrentAfter = browserIconsAreCurrent();\n  }`;
    if (!body.includes(applyNeedle)) throw new Error('Ver.284 apply injection point not found');
    body = body.replace(applyNeedle, applyReplacement);

    const pageshowNeedle = `  window.addEventListener('pageshow', apply);`;
    const pageshowReplacement = `  window.addEventListener('pageshow', event => {\n    const audit = window.__WB_BRAND_PAGESHOW_V284__;\n    audit.pageshowEvents.push({\n      persisted: event.persisted === true,\n      readyState: document.readyState,\n      guardActive: [...document.documentElement.classList].some(name => name.startsWith('wb-first-paint-v')),\n      assetsReady: window.WORK_BOARD_ASSETS_READY === true,\n      brandVersion: document.documentElement.dataset.brandVersion || '',\n      brandMark: document.querySelector('.brand-mark img')?.getAttribute('src') || '',\n      notificationBrand: window.Notification?.__workBoardBrandVersion || '',\n      iconsCurrent: browserIconsAreCurrent()\n    });\n    audit.phase = event.persisted === true ? 'pageshow-persisted' : 'pageshow-initial';\n    if (audit.suppressInitialPageshow && event.persisted !== true) {\n      audit.suppressedInitialPageshow += 1;\n      return;\n    }\n    apply();\n  });`;
    if (!body.includes(pageshowNeedle)) throw new Error('Ver.284 pageshow listener injection point not found');
    body = body.replace(pageshowNeedle, pageshowReplacement);

    await route.fulfill({ response, body });
  });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page, { suppressInitialPageshow = false } = {}) {
  await installAudit(page, suppressInitialPageshow);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === '264', undefined, { timeout: 8_000 });
  await page.waitForFunction(() => document.documentElement.dataset.brandVersion === '185', undefined, { timeout: 8_000 });
  await page.waitForFunction(() => window.__WB_BRAND_PAGESHOW_V284__?.pageshowEvents?.some(event => event.persisted === false), undefined, { timeout: 8_000 });
  await page.waitForTimeout(120);

  return page.evaluate(selector => {
    const audit = window.__WB_BRAND_PAGESHOW_V284__;
    return {
      audit,
      final: {
        release: window.WORK_BOARD_RELEASE?.version || '',
        guardActive: [...document.documentElement.classList].some(name => name.startsWith('wb-first-paint-v')),
        assetsReady: window.WORK_BOARD_ASSETS_READY === true,
        brandVersion: document.documentElement.dataset.brandVersion || '',
        brandMark: document.querySelector('.brand-mark img')?.getAttribute('src') || '',
        notificationBrand: window.Notification?.__workBoardBrandVersion || '',
        icons: [...document.head.querySelectorAll(selector)].map(link => ({
          rel: link.getAttribute('rel') || '',
          href: link.getAttribute('href') || '',
          type: link.getAttribute('type') || '',
          sizes: link.getAttribute('sizes') || ''
        }))
      }
    };
  }, ICON_SELECTOR);
}

test('Ver.284 audit: cold boot initial pageshow is a no-drift second apply after startup canonicalization', async ({ page }) => {
  const state = await boot(page);
  console.log('V284_BRAND_PAGESHOW_COLD_BOOT', JSON.stringify(state));

  expect(state.audit.pageshowEvents).toHaveLength(1);
  expect(state.audit.pageshowEvents[0].persisted).toBe(false);
  expect(state.audit.pageshowEvents[0].iconsCurrent).toBe(true);
  expect(state.audit.pageshowEvents[0].brandVersion).toBe('185');
  expect(state.audit.pageshowEvents[0].brandMark).toContain('assets/brand-v184.svg?v=185');
  expect(state.audit.pageshowEvents[0].notificationBrand).toBe('185');

  expect(state.audit.applyCalls).toHaveLength(2);
  expect(state.audit.applyCalls[0].phase).toBe('startup');
  expect(state.audit.applyCalls[1].phase).toBe('pageshow-initial');

  const second = state.audit.applyCalls[1];
  expect(second.iconsCurrentBefore).toBe(true);
  expect(second.iconAddsAfter - second.iconAddsBefore).toBe(0);
  expect(second.iconRemovesAfter - second.iconRemovesBefore).toBe(0);
  expect(second.brandWritesAfter - second.brandWritesBefore).toBe(0);
  expect(second.notificationWritesAfter - second.notificationWritesBefore).toBe(0);
  expect(second.brandDatasetBefore).toBe('185');
  expect(second.brandDatasetAfter).toBe('185');

  expectCanonicalState(state.final);
});

test('Ver.284 audit: suppressing only non-persisted initial pageshow leaves first-paint brand state unchanged', async ({ page }) => {
  const state = await boot(page, { suppressInitialPageshow: true });
  console.log('V284_BRAND_PAGESHOW_SUPPRESSED', JSON.stringify(state));

  expect(state.audit.pageshowEvents).toHaveLength(1);
  expect(state.audit.pageshowEvents[0].persisted).toBe(false);
  expect(state.audit.suppressedInitialPageshow).toBe(1);
  expect(state.audit.applyCalls).toHaveLength(1);
  expect(state.audit.applyCalls[0].phase).toBe('startup');
  expectCanonicalState(state.final);
});

test('Ver.284 audit: persisted pageshow still repairs synthetic drift when initial pageshow is suppressed', async ({ page }) => {
  await boot(page, { suppressInitialPageshow: true });

  const result = await page.evaluate(async selector => {
    const audit = window.__WB_BRAND_PAGESHOW_V284__;
    const brand = document.querySelector('.brand-mark img');
    brand?.setAttribute('src', 'assets/brand.png?v=synthetic-v284');
    const firstIcon = document.head.querySelector('link[rel~="icon"]');
    firstIcon?.setAttribute('href', 'assets/brand.png?v=synthetic-v284');

    function SyntheticNotification() {}
    SyntheticNotification.requestPermission = async () => 'default';
    Object.defineProperty(SyntheticNotification, 'permission', { configurable: true, get: () => 'default' });
    window.Notification = SyntheticNotification;

    const beforeCalls = audit.applyCalls.length;
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    await new Promise(resolve => setTimeout(resolve, 120));

    return {
      beforeCalls,
      afterCalls: audit.applyCalls.length,
      lastEvent: audit.pageshowEvents.at(-1),
      lastApply: audit.applyCalls.at(-1),
      final: {
        release: window.WORK_BOARD_RELEASE?.version || '',
        brandVersion: document.documentElement.dataset.brandVersion || '',
        brandMark: brand?.getAttribute('src') || '',
        notificationBrand: window.Notification?.__workBoardBrandVersion || '',
        icons: [...document.head.querySelectorAll(selector)].map(link => ({
          rel: link.getAttribute('rel') || '',
          href: link.getAttribute('href') || '',
          type: link.getAttribute('type') || '',
          sizes: link.getAttribute('sizes') || ''
        }))
      }
    };
  }, ICON_SELECTOR);

  console.log('V284_BRAND_PAGESHOW_PERSISTED_RECOVERY', JSON.stringify(result));
  expect(result.afterCalls).toBe(result.beforeCalls + 1);
  expect(result.lastEvent.persisted).toBe(true);
  expect(result.lastApply.phase).toBe('pageshow-persisted');
  expect(result.lastApply.iconsCurrentBefore).toBe(false);
  expect(result.lastApply.iconAddsAfter - result.lastApply.iconAddsBefore).toBe(4);
  expect(result.lastApply.brandWritesAfter - result.lastApply.brandWritesBefore).toBe(1);
  expect(result.lastApply.notificationWritesAfter - result.lastApply.notificationWritesBefore).toBe(1);
  expectCanonicalState(result.final);
});
