import { test, expect } from '@playwright/test';

const ROOM = 'test-work-features-observer-v315';
const SOURCE = 'work-features-v167.js';

async function installAudit(page) {
  await page.addInitScript(({ room, source }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });

    const NativeMutationObserver = window.MutationObserver;
    const registry = [];
    const sourceFromStack = stack => String(stack || '').includes(source) ? source : '';
    const label = target => target?.id ? `#${target.id}` : String(target?.nodeName || '');

    window.__WB_WORK_OBSERVER_AUDIT_V315__ = { registry };
    window.MutationObserver = class WorkObserverAuditV315 {
      constructor(callback) {
        const entry = { source: sourceFromStack(new Error().stack), calls: 0, targets: [], records: [] };
        this.__entry = entry;
        this.__native = new NativeMutationObserver((mutations, observer) => {
          entry.calls += 1;
          for (const mutation of mutations) {
            entry.records.push({ target: label(mutation.target), added: mutation.addedNodes.length, removed: mutation.removedNodes.length });
          }
          callback(mutations, observer);
        });
        registry.push(entry);
      }
      observe(target, options = {}) {
        this.__entry.targets.push({ target: label(target), childList: Boolean(options.childList), subtree: Boolean(options.subtree), attributes: Boolean(options.attributes) });
        return this.__native.observe(target, options);
      }
      disconnect() { return this.__native.disconnect(); }
      takeRecords() { return this.__native.takeRecords(); }
    };
  }, { room: ROOM, source: SOURCE });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function installProductInstrumentation(page) {
  await page.route(/work-features-v167\.js(?:\?|$)/, async route => {
    const response = await route.fetch();
    let source = await response.text();
    const observerNeedle = 'featureState.domObserver = new MutationObserver(mutations => {';
    const guardNeedle = "const memoRoot = document.getElementById('workMemoViewV167');";
    const guardLine = 'if (memoRoot && mutations.length && mutations.every(mutation => mutation.target === memoRoot || memoRoot.contains(mutation.target))) return;';
    const scheduleNeedle = 'scheduled = true;\n      requestAnimationFrame(() => {';

    expect(source.includes(observerNeedle)).toBe(true);
    expect(source.includes(guardNeedle)).toBe(true);
    expect(source.includes(guardLine)).toBe(true);
    expect(source.includes(scheduleNeedle)).toBe(true);

    const markerSetup = `${guardNeedle}\n      const markerIdsV315 = [];\n      for (const mutationV315 of mutations) {\n        for (const nodeV315 of [mutationV315.target, ...mutationV315.addedNodes, ...mutationV315.removedNodes]) {\n          if (!nodeV315 || nodeV315.nodeType !== 1) continue;\n          if (nodeV315.id && nodeV315.id.startsWith('v315-')) markerIdsV315.push(nodeV315.id);\n          nodeV315.querySelectorAll?.('[id^="v315-"]').forEach(elementV315 => markerIdsV315.push(elementV315.id));\n        }\n      }\n      const recordMarkerPathV315 = pathV315 => {\n        if (!markerIdsV315.length) return;\n        window.__WB_WORK_OBSERVER_V315_MARKER_PATHS__ = [\n          ...(window.__WB_WORK_OBSERVER_V315_MARKER_PATHS__ || []),\n          { markerIds: [...new Set(markerIdsV315)], path: pathV315 }\n        ];\n      };`;
    source = source.replace(guardNeedle, markerSetup);
    source = source.replace(guardLine, `if (memoRoot && mutations.length && mutations.every(mutation => mutation.target === memoRoot || memoRoot.contains(mutation.target))) {\n        recordMarkerPathV315('memo-skip');\n        return;\n      }\n      recordMarkerPathV315('reconcile-path');`);
    source = source.replace(scheduleNeedle, `scheduled = true;\n      window.__WB_WORK_OBSERVER_V315_RUNS__ = (window.__WB_WORK_OBSERVER_V315_RUNS__ || 0) + 1;\n      requestAnimationFrame(() => {`);

    await route.fulfill({ response, body: source, contentType: 'application/javascript' });
  });
}

async function boot(page) {
  await installAudit(page);
  await installProductInstrumentation(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await expect(page.locator('[data-work-memo-layout]')).toBeAttached({ timeout: 20_000 });
  await expect(page.locator('#workMemoViewV167')).toBeAttached({ timeout: 20_000 });
  await expect(page.locator('#taskStartDateV167')).toBeAttached({ timeout: 20_000 });
  await page.waitForTimeout(150);
}

async function coreObserver(page) {
  return page.evaluate(() => {
    const list = window.__WB_WORK_OBSERVER_AUDIT_V315__?.registry || [];
    const entry = list.find(item => {
      const targets = item.targets.map(target => target.target);
      return item.source === 'work-features-v167.js' && targets.includes('#mainContent') && targets.includes('#detailBody');
    });
    return entry ? { calls: entry.calls, targets: entry.targets, records: entry.records } : null;
  });
}

async function resetCoreCounters(page) {
  await page.evaluate(() => {
    window.__WB_WORK_OBSERVER_V315_RUNS__ = 0;
    window.__WB_WORK_OBSERVER_V315_MARKER_PATHS__ = [];
    const list = window.__WB_WORK_OBSERVER_AUDIT_V315__?.registry || [];
    const entry = list.find(item => {
      const targets = item.targets.map(target => target.target);
      return item.source === 'work-features-v167.js' && targets.includes('#mainContent') && targets.includes('#detailBody');
    });
    if (entry) {
      entry.calls = 0;
      entry.records.length = 0;
    }
  });
}

async function markerPath(page, id) {
  return page.evaluate(markerId => {
    const paths = window.__WB_WORK_OBSERVER_V315_MARKER_PATHS__ || [];
    return paths.find(entry => Array.isArray(entry.markerIds) && entry.markerIds.includes(markerId))?.path || '';
  }, id);
}

async function appendMarker(page, hostSelector, id) {
  await page.evaluate(({ hostSelector, id }) => {
    const host = document.querySelector(hostSelector);
    if (!host) throw new Error(`missing host ${hostSelector}`);
    const marker = document.createElement('span');
    marker.id = id;
    marker.hidden = true;
    host.appendChild(marker);
  }, { hostSelector, id });
}

function expectScopedRoots(observer) {
  expect(observer).toBeTruthy();
  const scopes = observer.targets.filter(item => item.target === '#mainContent' || item.target === '#detailBody');
  expect([...new Set(scopes.map(item => item.target))].sort()).toEqual(['#detailBody', '#mainContent']);
  expect(scopes.length).toBeGreaterThanOrEqual(2);
  scopes.forEach(scope => expect(scope).toEqual(expect.objectContaining({ childList: true, subtree: true, attributes: false })));
}

test('Ver.315 product skips memo-owned observer work while preserving non-memo and detail recovery', async ({ page }) => {
  await boot(page);
  expectScopedRoots(await coreObserver(page));

  await resetCoreCounters(page);
  const memoMarkerId = 'v315-product-memo-marker';
  await appendMarker(page, '#workMemoViewV167', memoMarkerId);
  await expect.poll(() => markerPath(page, memoMarkerId)).toBe('memo-skip');
  const memoAfter = await coreObserver(page);
  expect(memoAfter.records.some(record => record.target === '#workMemoViewV167')).toBe(true);

  await resetCoreCounters(page);
  const mainMarkerId = 'v315-product-main-marker';
  await appendMarker(page, '#mainContent', mainMarkerId);
  await expect.poll(() => markerPath(page, mainMarkerId)).toBe('reconcile-path');

  await resetCoreCounters(page);
  const detailMarkerId = 'v315-product-detail-marker';
  await appendMarker(page, '#detailBody', detailMarkerId);
  await expect.poll(() => markerPath(page, detailMarkerId)).toBe('reconcile-path');

  await page.locator('[data-work-memo-layout]').evaluate(button => button.click());
  await expect(page.locator('#workMemoViewV167')).toBeVisible();
  await expect(page.locator('#workMemoViewV167 [data-memo-new]').first()).toBeVisible();
  await expect(page.locator('#taskStartDateV167')).toBeAttached();
});

test('Ver.315 mixed memo and non-memo mutation batch still enters reconciliation path', async ({ page }) => {
  await boot(page);
  await resetCoreCounters(page);
  const memoMarkerId = 'v315-mixed-memo-marker';
  const mainMarkerId = 'v315-mixed-main-marker';
  await page.evaluate(({ memoMarkerId, mainMarkerId }) => {
    const memoRoot = document.getElementById('workMemoViewV167');
    const main = document.getElementById('mainContent');
    if (!memoRoot || !main) throw new Error('missing Ver.315 roots');
    const memoMarker = document.createElement('span');
    memoMarker.id = memoMarkerId;
    memoMarker.hidden = true;
    const mainMarker = document.createElement('span');
    mainMarker.id = mainMarkerId;
    mainMarker.hidden = true;
    memoRoot.appendChild(memoMarker);
    main.appendChild(mainMarker);
  }, { memoMarkerId, mainMarkerId });
  await expect.poll(() => markerPath(page, mainMarkerId)).toBe('reconcile-path');
  expect(await markerPath(page, memoMarkerId)).toBe('reconcile-path');
});
