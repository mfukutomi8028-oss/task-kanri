import { test, expect } from '@playwright/test';

const ROOM = 'test-work-features-long-lived-v316';
const TASK_ID = 'v316-task-1';
const AUDIT_TODAY = '2026-10-01';
const START_DATE = '2026-10-02';

async function installAudit(page) {
  await page.addInitScript(({ room, taskId, startDate, auditToday }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
      {
        id: taskId,
        title: 'V316 future task',
        status: '未着手',
        assignee: '福冨',
        priority: '中',
        category: 'PC',
        description: '',
        dueDate: '2026-10-03',
        tags: [],
        pinned: false,
        createdAt: 1790800000000,
        updatedAt: 1790800000000,
        revision: 1
      }
    ]));
    localStorage.setItem(`system-task-start-dates:${room}`, JSON.stringify({
      [taskId]: {
        date: startDate,
        updatedAt: 1790800000000,
        updatedBy: '福冨',
        revision: 1
      }
    }));

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });

    window.__WB_WORK_LONG_LIVED_V316__ = {
      today: auditToday,
      suppressDialogPopulate: false,
      suppressCoreReconcile: false,
      dialogCallbacks: 0,
      dialogPopulates: 0,
      dialogSuppressed: 0,
      coreCallbacks: 0,
      coreMutationTargets: [],
      applyCalls: 0,
      midnightSchedules: 0,
      midnightFires: 0,
      lastMidnightDelay: 0,
      runMidnight: null,
      registry: []
    };

    const NativeMutationObserver = window.MutationObserver;
    const label = target => target?.id ? `#${target.id}` : String(target?.nodeName || '');
    window.MutationObserver = class WorkLongLivedAuditV316 {
      constructor(callback) {
        const entry = { calls: 0, targets: [], records: [] };
        this.__entry = entry;
        this.__native = new NativeMutationObserver((mutations, observer) => {
          entry.calls += 1;
          for (const mutation of mutations) {
            entry.records.push({
              type: mutation.type,
              target: label(mutation.target),
              attributeName: mutation.attributeName || ''
            });
          }
          callback(mutations, observer);
        });
        window.__WB_WORK_LONG_LIVED_V316__.registry.push(entry);
      }
      observe(target, options = {}) {
        this.__entry.targets.push({
          target: label(target),
          childList: Boolean(options.childList),
          subtree: Boolean(options.subtree),
          attributes: Boolean(options.attributes),
          attributeFilter: Array.isArray(options.attributeFilter) ? [...options.attributeFilter] : []
        });
        return this.__native.observe(target, options);
      }
      disconnect() { return this.__native.disconnect(); }
      takeRecords() { return this.__native.takeRecords(); }
    };
  }, { room: ROOM, taskId: TASK_ID, startDate: START_DATE, auditToday: AUDIT_TODAY });

  await page.route(/work-features-v167\.js(?:\?|$)/, async route => {
    const response = await route.fetch();
    let source = await response.text();

    const todayNeedle = "  function todayIso() {\n    const d = new Date();";
    const observerNeedle = "    featureState.taskDialogObserver = new MutationObserver(() => {\n      if (dialog.open || dialog.hasAttribute('open')) populateStartDateFromCurrentTask();\n    });";
    const applyNeedle = '  function applyFutureTaskUi() {';
    const coreObserverNeedle = "    featureState.domObserver = new MutationObserver(mutations => {\n      const memoRoot = document.getElementById('workMemoViewV167');";
    const timerNeedle = "    featureState.midnightTimer = setTimeout(() => {\n      applyFutureTaskUi();\n      scheduleDateBoundaryRefresh();\n    }, Math.max(1000, next.getTime() - now.getTime()));";

    expect(source.includes(todayNeedle)).toBe(true);
    expect(source.includes(observerNeedle)).toBe(true);
    expect(source.includes(applyNeedle)).toBe(true);
    expect(source.includes(coreObserverNeedle)).toBe(true);
    expect(source.includes(timerNeedle)).toBe(true);

    source = source.replace(todayNeedle, `  function todayIso() {
    const auditTodayV316 = window.__WB_WORK_LONG_LIVED_V316__?.today;
    if (auditTodayV316) return auditTodayV316;
    const d = new Date();`);

    source = source.replace(observerNeedle, `    featureState.taskDialogObserver = new MutationObserver(() => {
      const auditV316 = window.__WB_WORK_LONG_LIVED_V316__;
      if (auditV316) auditV316.dialogCallbacks += 1;
      if (dialog.open || dialog.hasAttribute('open')) {
        if (auditV316?.suppressDialogPopulate) {
          auditV316.dialogSuppressed += 1;
          return;
        }
        if (auditV316) auditV316.dialogPopulates += 1;
        populateStartDateFromCurrentTask();
      }
    });`);

    source = source.replace(applyNeedle, `${applyNeedle}
    const auditApplyV316 = window.__WB_WORK_LONG_LIVED_V316__;
    if (auditApplyV316) auditApplyV316.applyCalls += 1;`);

    source = source.replace(coreObserverNeedle, `    featureState.domObserver = new MutationObserver(mutations => {
      const auditCoreV316 = window.__WB_WORK_LONG_LIVED_V316__;
      if (auditCoreV316) {
        auditCoreV316.coreCallbacks += 1;
        mutations.forEach(mutation => auditCoreV316.coreMutationTargets.push(mutation.target?.id ? '#' + mutation.target.id : String(mutation.target?.className || mutation.target?.nodeName || '')));
        if (auditCoreV316.suppressCoreReconcile) return;
      }
      const memoRoot = document.getElementById('workMemoViewV167');`);

    source = source.replace(timerNeedle, `    const delayV316 = Math.max(1000, next.getTime() - now.getTime());
    const refreshAtBoundaryV316 = () => {
      const auditV316 = window.__WB_WORK_LONG_LIVED_V316__;
      if (auditV316) auditV316.midnightFires += 1;
      applyFutureTaskUi();
      scheduleDateBoundaryRefresh();
    };
    const auditV316 = window.__WB_WORK_LONG_LIVED_V316__;
    if (auditV316) {
      auditV316.midnightSchedules += 1;
      auditV316.lastMidnightDelay = delayV316;
      auditV316.runMidnight = refreshAtBoundaryV316;
    }
    featureState.midnightTimer = setTimeout(refreshAtBoundaryV316, delayV316);`);

    await route.fulfill({ response, body: source, contentType: 'application/javascript' });
  });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page) {
  await installAudit(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await expect(page.locator('#taskStartDateV167')).toBeAttached({ timeout: 20_000 });
  await expect(page.locator('[data-reserved-task-open]')).toBeAttached({ timeout: 20_000 });
  const tasksNav = page.locator('.nav-item[data-layout="tasks"]').first();
  await expect(tasksNav).toHaveCount(1);
  await tasksNav.evaluate(element => element.click());
  await expect(page.locator(`[data-task-id="${TASK_ID}"]`).first()).toBeAttached({ timeout: 20_000 });
  await page.waitForTimeout(100);
}

async function taskDialogObserver(page) {
  return page.evaluate(() => {
    const list = window.__WB_WORK_LONG_LIVED_V316__?.registry || [];
    const entry = list.find(item => item.targets.some(target => target.target === '#taskDialog' && target.attributes));
    return entry ? { calls: entry.calls, targets: entry.targets, records: entry.records } : null;
  });
}

async function resetDialogAudit(page) {
  await page.evaluate(() => {
    const audit = window.__WB_WORK_LONG_LIVED_V316__;
    audit.dialogCallbacks = 0;
    audit.dialogPopulates = 0;
    audit.dialogSuppressed = 0;
    const entry = audit.registry.find(item => item.targets.some(target => target.target === '#taskDialog' && target.attributes));
    if (entry) {
      entry.calls = 0;
      entry.records.length = 0;
    }
  });
}

test('Ver.316 audit: taskDialogObserver is narrowly scoped and is the active start-date open bridge', async ({ page }) => {
  await boot(page);
  const observer = await taskDialogObserver(page);
  expect(observer).toBeTruthy();
  const scope = observer.targets.find(target => target.target === '#taskDialog' && target.attributes);
  expect(scope).toEqual({
    target: '#taskDialog',
    childList: false,
    subtree: false,
    attributes: true,
    attributeFilter: ['open']
  });

  await resetDialogAudit(page);
  await page.evaluate(() => {
    const marker = document.createElement('span');
    marker.id = 'v316-unrelated-main-mutation';
    marker.hidden = true;
    document.getElementById('mainContent')?.appendChild(marker);
  });
  await page.waitForTimeout(80);
  expect((await taskDialogObserver(page)).calls).toBe(0);

  await page.evaluate(taskId => {
    document.getElementById('taskId').value = taskId;
    document.getElementById('taskStartDateV167').value = '1999-01-01';
    window.__WB_WORK_LONG_LIVED_V316__.suppressDialogPopulate = true;
    document.getElementById('taskDialog').showModal();
  }, TASK_ID);
  await expect.poll(() => page.evaluate(() => window.__WB_WORK_LONG_LIVED_V316__.dialogCallbacks)).toBeGreaterThan(0);
  expect(await page.locator('#taskStartDateV167').inputValue()).toBe('1999-01-01');
  expect(await page.evaluate(() => window.__WB_WORK_LONG_LIVED_V316__.dialogSuppressed)).toBe(1);

  await page.evaluate(() => document.getElementById('taskDialog').close());
  await expect.poll(() => page.evaluate(() => window.__WB_WORK_LONG_LIVED_V316__.dialogCallbacks)).toBeGreaterThan(1);
  expect(await page.evaluate(() => window.__WB_WORK_LONG_LIVED_V316__.dialogPopulates)).toBe(0);

  await page.evaluate(() => {
    document.getElementById('taskStartDateV167').value = '1999-01-01';
    window.__WB_WORK_LONG_LIVED_V316__.suppressDialogPopulate = false;
    document.getElementById('taskDialog').showModal();
  });
  await expect.poll(() => page.locator('#taskStartDateV167').inputValue()).toBe(START_DATE);
  expect(await page.evaluate(() => window.__WB_WORK_LONG_LIVED_V316__.dialogPopulates)).toBe(1);
  await page.evaluate(() => document.getElementById('taskDialog').close());
});

test('Ver.316 audit: one-shot date-boundary refresh remains the deterministic time owner despite incidental core churn', async ({ page }) => {
  await boot(page);
  const card = page.locator(`[data-task-id="${TASK_ID}"]`).first();
  await expect(card).toHaveClass(/future-task-v167-hidden/);
  await expect(page.locator('[data-reserved-task-open]')).toBeVisible();

  const before = await page.evaluate(() => ({
    schedules: window.__WB_WORK_LONG_LIVED_V316__.midnightSchedules,
    fires: window.__WB_WORK_LONG_LIVED_V316__.midnightFires,
    delay: window.__WB_WORK_LONG_LIVED_V316__.lastMidnightDelay,
    hasRunner: typeof window.__WB_WORK_LONG_LIVED_V316__.runMidnight === 'function',
    coreCallbacks: window.__WB_WORK_LONG_LIVED_V316__.coreCallbacks,
    applyCalls: window.__WB_WORK_LONG_LIVED_V316__.applyCalls
  }));
  expect(before.schedules).toBe(1);
  expect(before.fires).toBe(0);
  expect(before.delay).toBeGreaterThanOrEqual(1000);
  expect(before.hasRunner).toBe(true);

  const isolatedApplyCount = await page.evaluate(async () => {
    const audit = window.__WB_WORK_LONG_LIVED_V316__;
    audit.suppressCoreReconcile = true;
    // The observer guard stops new frames, not a frame already queued by boot.
    // Drain that owned frame before changing the audit date or taking a baseline.
    await new Promise(resolve => requestAnimationFrame(resolve));
    audit.coreCallbacks = 0;
    audit.coreMutationTargets.length = 0;
    return audit.applyCalls;
  });

  await page.evaluate(startDate => {
    window.__WB_WORK_LONG_LIVED_V316__.today = startDate;
    const marker = document.createElement('span');
    marker.id = 'v316-core-churn-proof';
    marker.hidden = true;
    document.getElementById('mainContent')?.appendChild(marker);
  }, START_DATE);
  await expect.poll(() => page.evaluate(() => window.__WB_WORK_LONG_LIVED_V316__.coreCallbacks)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__WB_WORK_LONG_LIVED_V316__.applyCalls)).toBe(isolatedApplyCount);
  await expect(card).toHaveClass(/future-task-v167-hidden/);

  await page.evaluate(() => window.__WB_WORK_LONG_LIVED_V316__.runMidnight());
  await expect(card).not.toHaveClass(/future-task-v167-hidden/);
  await expect(page.locator('[data-reserved-task-open]')).toBeHidden();

  const after = await page.evaluate(() => ({
    schedules: window.__WB_WORK_LONG_LIVED_V316__.midnightSchedules,
    fires: window.__WB_WORK_LONG_LIVED_V316__.midnightFires,
    applyCalls: window.__WB_WORK_LONG_LIVED_V316__.applyCalls,
    coreCallbacks: window.__WB_WORK_LONG_LIVED_V316__.coreCallbacks,
    coreMutationTargets: [...window.__WB_WORK_LONG_LIVED_V316__.coreMutationTargets],
    delay: window.__WB_WORK_LONG_LIVED_V316__.lastMidnightDelay
  }));
  expect(after.coreCallbacks).toBeGreaterThan(0);
  expect(after.fires).toBe(1);
  expect(after.schedules).toBe(2);
  expect(after.applyCalls).toBeGreaterThan(isolatedApplyCount);
  expect(after.delay).toBeGreaterThanOrEqual(1000);
});
