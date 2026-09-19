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

test('Ver.244 audit: work-feature core app-shell observer fires for unrelated shell mutations while UI observer stays memo-scoped', async ({ page }) => {
  await installObserverAudit(page);
  await boot(page);

  const before = await page.evaluate(() => {
    const records = window.__WB_WORK_FEATURE_OBSERVER_AUDIT__ || [];
    return records.map((item, index) => ({ index, target: item.target, options: item.options, calls: item.calls }));
  });
  const shell = before.find(item => item.target === '.app-shell' && item.options?.childList && item.options?.subtree);
  const memo = before.find(item => item.target === '#workMemoViewV167' && item.options?.childList && item.options?.subtree);
  const taskDialog = before.find(item => item.target === '#taskDialog' && item.options?.attributes);

  expect(shell, 'work-features-v167 should own one app-shell subtree observer').toBeTruthy();
  expect(memo, 'work-features-ui-v190 should observe only its memo root').toBeTruthy();
  expect(taskDialog, 'start-date bridge should observe only taskDialog open state').toBeTruthy();

  await page.evaluate(() => {
    const host = document.querySelector('.sidebar') || document.querySelector('.hero') || document.querySelector('.app-shell');
    const marker = document.createElement('span');
    marker.dataset.v244UnrelatedMutation = 'true';
    marker.hidden = true;
    host?.appendChild(marker);
  });
  await page.waitForTimeout(100);

  const after = await page.evaluate(({ shellIndex, memoIndex }) => {
    const records = window.__WB_WORK_FEATURE_OBSERVER_AUDIT__ || [];
    return {
      shellCalls: records[shellIndex]?.calls || 0,
      memoCalls: records[memoIndex]?.calls || 0
    };
  }, { shellIndex: shell.index, memoIndex: memo.index });

  expect(after.shellCalls).toBeGreaterThan(shell.calls);
  expect(after.memoCalls).toBe(memo.calls);
});

test('Ver.244 audit: disabling presentation helper removes polish only, not memo/start-date core entry points', async ({ page }) => {
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
