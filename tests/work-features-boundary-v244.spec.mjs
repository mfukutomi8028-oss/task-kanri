import { test, expect } from '@playwright/test';

async function installObserverAudit(page) {
  await page.addInitScript(() => {
    const NativeMutationObserver = window.MutationObserver;
    const records = [];
    window.__WB_WORK_FEATURE_OBSERVER_AUDIT__ = records;

    const markerName = node => {
      if (!(node instanceof Element)) return '';
      if (node.dataset.v244UnrelatedMutation) return 'sidebar';
      if (node.dataset.v244MainMutation) return 'main';
      if (node.dataset.v244DetailMutation) return 'detail';
      return '';
    };

    window.MutationObserver = class AuditedMutationObserver {
      constructor(callback) {
        const record = { targets: [], calls: 0, markers: [] };
        const inner = new NativeMutationObserver((mutations, observer) => {
          record.calls += 1;
          mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
              const marker = markerName(node);
              if (marker) record.markers.push(marker);
            });
          });
          callback(mutations, observer);
        });
        this.observe = (target, options) => {
          const label = target?.id ? `#${target.id}` : target?.classList?.contains('app-shell') ? '.app-shell' : target?.className || target?.nodeName || '';
          record.targets.push({ target: label, options: { ...options } });
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

test('Ver.244 product: work-feature core observes main/detail only and ignores unrelated sidebar mutations', async ({ page }) => {
  await installObserverAudit(page);
  await boot(page);

  const records = await page.evaluate(() => {
    const audit = window.__WB_WORK_FEATURE_OBSERVER_AUDIT__ || [];
    return audit.map((item, index) => ({ index, targets: item.targets, calls: item.calls, markers: item.markers }));
  });
  const ownsTarget = (record, target, predicate = () => true) => record?.targets?.some(item => item.target === target && predicate(item.options));
  const shell = records.find(item => ownsTarget(item, '.app-shell', options => options?.childList && options?.subtree));
  const core = records.find(item =>
    ownsTarget(item, '#mainContent', options => options?.childList && options?.subtree) &&
    ownsTarget(item, '#detailBody', options => options?.childList && options?.subtree));
  const memo = records.find(item => ownsTarget(item, '#workMemoViewV167', options => options?.childList && options?.subtree));
  const taskDialog = records.find(item => ownsTarget(item, '#taskDialog', options => options?.attributes));

  expect(shell, 'work-features-v167 must no longer observe the whole app shell').toBeFalsy();
  expect(core, 'work-features-v167 should observe both main and task-detail surfaces with one scoped observer').toBeTruthy();
  expect(memo, 'work-features-ui-v190 should remain memo-root scoped').toBeTruthy();
  expect(taskDialog, 'start-date bridge should observe only taskDialog open state').toBeTruthy();

  await page.evaluate(({ coreIndex, memoIndex }) => {
    const audit = window.__WB_WORK_FEATURE_OBSERVER_AUDIT__ || [];
    if (audit[coreIndex]) audit[coreIndex].markers.length = 0;
    if (audit[memoIndex]) audit[memoIndex].markers.length = 0;
  }, { coreIndex: core.index, memoIndex: memo.index });

  await page.evaluate(() => {
    const host = document.querySelector('.sidebar');
    const marker = document.createElement('span');
    marker.dataset.v244UnrelatedMutation = 'true';
    marker.hidden = true;
    host?.appendChild(marker);
  });
  await page.waitForTimeout(150);

  const sidebarMarkers = await page.evaluate(({ coreIndex, memoIndex }) => {
    const audit = window.__WB_WORK_FEATURE_OBSERVER_AUDIT__ || [];
    return {
      core: [...(audit[coreIndex]?.markers || [])],
      memo: [...(audit[memoIndex]?.markers || [])]
    };
  }, { coreIndex: core.index, memoIndex: memo.index });

  expect(sidebarMarkers.core).not.toContain('sidebar');
  expect(sidebarMarkers.memo).not.toContain('sidebar');

  await page.evaluate(() => {
    const host = document.querySelector('.toolbar') || document.getElementById('mainContent');
    const marker = document.createElement('span');
    marker.dataset.v244MainMutation = 'true';
    marker.hidden = true;
    host?.appendChild(marker);
  });
  await expect.poll(async () => page.evaluate(index => (
    window.__WB_WORK_FEATURE_OBSERVER_AUDIT__?.[index]?.markers || []
  ).includes('main'), core.index)).toBe(true);

  await page.evaluate(() => {
    const host = document.getElementById('detailBody');
    const marker = document.createElement('span');
    marker.dataset.v244DetailMutation = 'true';
    marker.hidden = true;
    host?.appendChild(marker);
  });
  await expect.poll(async () => page.evaluate(index => (
    window.__WB_WORK_FEATURE_OBSERVER_AUDIT__?.[index]?.markers || []
  ).includes('detail'), core.index)).toBe(true);
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
