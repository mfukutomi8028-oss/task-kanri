import { test, expect } from '@playwright/test';

const ROOM = 'test-work-features-observer-v314';
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

    window.__WB_WORK_OBSERVER_AUDIT_V314__ = { registry };
    window.MutationObserver = class WorkObserverAuditV314 {
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

async function installInstrumentedSource(page, candidate) {
  await page.route(/work-features-v167\.js(?:\?|$)/, async route => {
    const response = await route.fetch();
    let source = await response.text();
    const observerNeedle = 'featureState.domObserver = new MutationObserver(() => {';
    const instrumentNeedle = 'scheduled = true;\n      requestAnimationFrame(() => {';
    expect(source.includes(observerNeedle)).toBe(true);
    expect(source.includes(instrumentNeedle)).toBe(true);

    const observerHead = candidate
      ? `featureState.domObserver = new MutationObserver(mutations => {\n      const memoRootV314 = document.getElementById('workMemoViewV167');\n      if (memoRootV314 && mutations.length && mutations.every(mutation => mutation.target === memoRootV314 || memoRootV314.contains(mutation.target))) return;`
      : observerNeedle;
    source = source.replace(observerNeedle, observerHead);
    source = source.replace(instrumentNeedle, `scheduled = true;\n      window.__WB_WORK_OBSERVER_V314_RUNS__ = (window.__WB_WORK_OBSERVER_V314_RUNS__ || 0) + 1;\n      requestAnimationFrame(() => {`);

    await route.fulfill({ response, body: source, contentType: 'application/javascript' });
  });
}

async function boot(page, { candidate = false } = {}) {
  await installAudit(page);
  await installInstrumentedSource(page, candidate);
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
    const list = window.__WB_WORK_OBSERVER_AUDIT_V314__?.registry || [];
    const entry = list.find(item => {
      const targets = item.targets.map(target => target.target);
      return item.source === 'work-features-v167.js' && targets.includes('#mainContent') && targets.includes('#detailBody');
    });
    return entry ? { calls: entry.calls, targets: entry.targets, records: entry.records } : null;
  });
}

async function resetCoreCounters(page) {
  await page.evaluate(() => {
    window.__WB_WORK_OBSERVER_V314_RUNS__ = 0;
    const list = window.__WB_WORK_OBSERVER_AUDIT_V314__?.registry || [];
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

async function runs(page) {
  return page.evaluate(() => Number(window.__WB_WORK_OBSERVER_V314_RUNS__ || 0));
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
  expect(scopes.map(item => item.target).sort()).toEqual(['#detailBody', '#mainContent']);
  scopes.forEach(scope => expect(scope).toEqual(expect.objectContaining({ childList: true, subtree: true, attributes: false })));
}

test('Ver.314 baseline: memo-owned descendant mutation still schedules core work-feature reconciliation', async ({ page }) => {
  await boot(page, { candidate: false });
  const observer = await coreObserver(page);
  expectScopedRoots(observer);

  await resetCoreCounters(page);
  await appendMarker(page, '#workMemoViewV167', 'v314-baseline-memo-marker');
  await expect.poll(() => runs(page)).toBeGreaterThanOrEqual(1);

  const after = await coreObserver(page);
  expect(after.calls).toBeGreaterThanOrEqual(1);
  expect(after.records.some(record => record.target === '#workMemoViewV167')).toBe(true);
});

test('Ver.314 candidate: memo-owned self mutation is ignored while main/detail recovery and core entry points remain intact', async ({ page }) => {
  await boot(page, { candidate: true });
  const observer = await coreObserver(page);
  expectScopedRoots(observer);

  await resetCoreCounters(page);
  await appendMarker(page, '#workMemoViewV167', 'v314-candidate-memo-marker');
  await expect.poll(async () => (await coreObserver(page))?.calls || 0).toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(100);
  expect(await runs(page)).toBe(0);

  await resetCoreCounters(page);
  await appendMarker(page, '#mainContent', 'v314-candidate-main-marker');
  await expect.poll(() => runs(page)).toBeGreaterThanOrEqual(1);

  await resetCoreCounters(page);
  await appendMarker(page, '#detailBody', 'v314-candidate-detail-marker');
  await expect.poll(() => runs(page)).toBeGreaterThanOrEqual(1);

  await page.locator('[data-work-memo-layout]').evaluate(button => button.click());
  await expect(page.locator('#workMemoViewV167')).toBeVisible();
  await expect(page.locator('#workMemoViewV167 [data-memo-new]').first()).toBeVisible();
  await expect(page.locator('#taskStartDateV167')).toBeAttached();
});
