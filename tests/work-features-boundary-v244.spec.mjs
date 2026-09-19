import { test, expect } from '@playwright/test';

async function installObserverAudit(page) {
  await page.addInitScript(() => {
    const NativeMutationObserver = window.MutationObserver;
    const records = [];
    window.__WB_WORK_FEATURE_OBSERVER_AUDIT__ = records;
    window.MutationObserver = class AuditedMutationObserver {
      constructor(callback) {
        const record = { target: '', options: null, calls: 0 };
        const inner = new NativeMutationObserver((mutations, observer) => {
          record.calls += 1;
          callback(mutations, observer);
        });
        this.observe = (target, options) => {
          record.target = target?.id ? `#${target.id}` : target?.classList?.contains('app-shell') ? '.app-shell' : target?.className || target?.nodeName || '';
          record.options = { ...options };
          return inner.observe(target, options);
        };
        this.disconnect = () => inner.disconnect();
        this.takeRecords = () => inner.takeRecords();
        records.push(record);
      }
    };
  });
}

async function boot(page) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await expect(page.locator('[data-work-memo-layout]')).toBeAttached({ timeout: 20_000 });
  await expect(page.locator('#taskStartDateV167')).toBeAttached({ timeout: 20_000 });
}

async function waitForObserverQuiet(page, observerIndex) {
  let previous = await page.evaluate(index => window.__WB_WORK_FEATURE_OBSERVER_AUDIT__?.[index]?.calls ?? -1, observerIndex);
  let stableRounds = 0;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await page.waitForTimeout(100);
    const current = await page.evaluate(index => window.__WB_WORK_FEATURE_OBSERVER_AUDIT__?.[index]?.calls ?? -1, observerIndex);
    if (current === previous) {
      stableRounds += 1;
      if (stableRounds >= 3) return current;
    } else {
      previous = current;
      stableRounds = 0;
    }
  }

  throw new Error(`observer ${observerIndex} did not become quiet before the scoped mutation check`);
}

test('Ver.244 product: work-feature core observes main/detail only and ignores unrelated sidebar mutations', async ({ page }) => {
  await installObserverAudit(page);
  await boot(page);

  const records = await page.evaluate(() => {
    const audit = window.__WB_WORK_FEATURE_OBSERVER_AUDIT__ || [];
    return audit.map((item, index) => ({ index, target: item.target, options: item.options, calls: item.calls }));
  });
  const shell = records.find(item => item.target === '.app-shell' && item.options?.childList && item.options?.subtree);
  const main = records.find(item => item.target === '#mainContent' && item.options?.childList && item.options?.subtree);
  const detail = records.find(item => item.target === '#detailBody' && item.options?.childList && item.options?.subtree);
  const memo = records.find(item => item.target === '#workMemoViewV167' && item.options?.childList && item.options?.subtree);
  const taskDialog = records.find(item => item.target === '#taskDialog' && item.options?.attributes);

  expect(shell, 'work-features-v167 must no longer observe the whole app shell').toBeFalsy();
  expect(main, 'work-features-v167 should observe the main task surface').toBeTruthy();
  expect(detail, 'work-features-v167 should observe the task detail surface').toBeTruthy();
  expect(memo, 'work-features-ui-v190 should remain memo-root scoped').toBeTruthy();
  expect(taskDialog, 'start-date bridge should observe only taskDialog open state').toBeTruthy();

  const mainCallsBefore = await waitForObserverQuiet(page, main.index);
  const detailCallsBefore = await waitForObserverQuiet(page, detail.index);
  const memoCallsBefore = await waitForObserverQuiet(page, memo.index);

  await page.evaluate(() => {
    const host = document.querySelector('.sidebar');
    const marker = document.createElement('span');
    marker.dataset.v244UnrelatedMutation = 'true';
    marker.hidden = true;
    host?.appendChild(marker);
  });
  await page.waitForTimeout(150);

  const afterSidebar = await page.evaluate(({ mainIndex, detailIndex, memoIndex }) => {
    const audit = window.__WB_WORK_FEATURE_OBSERVER_AUDIT__ || [];
    return {
      mainCalls: audit[mainIndex]?.calls || 0,
      detailCalls: audit[detailIndex]?.calls || 0,
      memoCalls: audit[memoIndex]?.calls || 0
    };
  }, { mainIndex: main.index, detailIndex: detail.index, memoIndex: memo.index });

  expect(afterSidebar.mainCalls).toBe(mainCallsBefore);
  expect(afterSidebar.detailCalls).toBe(detailCallsBefore);
  expect(afterSidebar.memoCalls).toBe(memoCallsBefore);

  await page.evaluate(() => {
    const host = document.querySelector('.toolbar') || document.getElementById('mainContent');
    const marker = document.createElement('span');
    marker.dataset.v244MainMutation = 'true';
    marker.hidden = true;
    host?.appendChild(marker);
  });
  await expect.poll(async () => page.evaluate(index => window.__WB_WORK_FEATURE_OBSERVER_AUDIT__?.[index]?.calls || 0, main.index)).toBeGreaterThan(afterSidebar.mainCalls);

  const detailBeforeOwnMutation = await page.evaluate(index => window.__WB_WORK_FEATURE_OBSERVER_AUDIT__?.[index]?.calls || 0, detail.index);
  await page.evaluate(() => {
    const host = document.getElementById('detailBody');
    const marker = document.createElement('span');
    marker.dataset.v244DetailMutation = 'true';
    marker.hidden = true;
    host?.appendChild(marker);
  });
  await expect.poll(async () => page.evaluate(index => window.__WB_WORK_FEATURE_OBSERVER_AUDIT__?.[index]?.calls || 0, detail.index)).toBeGreaterThan(detailBeforeOwnMutation);
});

test('Ver.244 product: disabling presentation helper removes polish only, not memo/start-date core entry points', async ({ page }) => {
  await page.route(/work-features-ui-v190\.js(?:\?|$)/, route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: 'document.documentElement.dataset.workFeaturesUiAuditDisabled="true";'
  }));

  await boot(page);
  expect(await page.evaluate(() => document.documentElement.dataset.workFeaturesUiAuditDisabled)).toBe('true');
  expect(await page.evaluate(() => document.documentElement.dataset.workFeaturesUiVersion || '')).toBe('');

  await page.locator('[data-work-memo-layout]').evaluate(button => button.click());
  await expect(page.locator('#workMemoViewV167')).toBeVisible();
  await expect(page.locator('#workMemoViewV167 .work-memo-head-v167')).toBeVisible();
  await expect(page.locator('#workMemoViewV167 [data-memo-new]').first()).toBeVisible();
  await page.locator('#workMemoViewV167 [data-memo-new]').first().evaluate(button => button.click());
  await expect(page.locator('#workMemoDialogV167')).toBeVisible();
  await expect(page.locator('#taskStartDateV167')).toBeAttached();

  expect(await page.locator('.work-memo-new-v176').count()).toBe(0);
});
