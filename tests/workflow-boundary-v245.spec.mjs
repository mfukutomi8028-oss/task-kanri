import { test, expect } from '@playwright/test';

async function installRuntimeAudit(page) {
  await page.addInitScript(() => {
    const NativeMutationObserver = window.MutationObserver;
    const records = [];
    window.__WB_WORKFLOW_OBSERVER_AUDIT__ = records;
    window.MutationObserver = class AuditedMutationObserver {
      constructor(callback) {
        const record = { stack: String(new Error().stack || ''), targets: [] };
        const inner = new NativeMutationObserver((mutations, observer) => callback(mutations, observer));
        this.observe = (target, options) => {
          const label = target?.id ? `#${target.id}` : target?.classList?.contains('app-shell') ? '.app-shell' : target?.nodeName || '';
          record.targets.push({ target: label, options: { ...options } });
          return inner.observe(target, options);
        };
        this.disconnect = () => inner.disconnect();
        this.takeRecords = () => inner.takeRecords();
        records.push(record);
      }
    };

    let v150;
    Object.defineProperty(window, 'WorkBoardWorkflowV150', {
      configurable: true,
      get() { return v150; },
      set(value) {
        v150 = value;
        if (value && !window.__WB_WORKFLOW_V150_ORIGINAL__) {
          window.__WB_WORKFLOW_V150_ORIGINAL__ = {
            writeDependencies: value.writeDependencies,
            writeSavedView: value.writeSavedView,
            writeRelations: value.writeRelations,
            writeReminder: value.writeReminder
          };
        }
      }
    });
  });
}

async function boot(page) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV150 && window.WorkBoardWorkflowV152, undefined, { timeout: 20_000 });
}

test('Ver.245 audit: V152 inherits dependency/relation writers but replaces only the reminder writer at runtime', async ({ page }) => {
  await installRuntimeAudit(page);
  await boot(page);

  const state = await page.evaluate(() => {
    const original = window.__WB_WORKFLOW_V150_ORIGINAL__;
    const core = window.WorkBoardWorkflowV150;
    const enhanced = window.WorkBoardWorkflowV152;
    return {
      aliasesShareCore: window.WorkBoardWorkflowV148 === core && window.WorkBoardWorkflowV149 === core,
      wrapperIsDistinct: enhanced !== core,
      dependenciesUnchanged: original?.writeDependencies === enhanced?.writeDependencies,
      savedViewUnchanged: original?.writeSavedView === enhanced?.writeSavedView,
      relationsUnchanged: original?.writeRelations === enhanced?.writeRelations,
      reminderWasReplaced: original?.writeReminder !== enhanced?.writeReminder,
      coreNowUsesEnhancedReminder: core?.writeReminder === enhanced?.writeReminder,
      enhancedOwnsInbox: typeof enhanced?.writeInboxEvent === 'function',
      enhancedOwnsArchive: typeof enhanced?.archiveTask === 'function',
      enhancedOwnsDuplicate: typeof enhanced?.markDuplicate === 'function'
    };
  });

  expect(state).toEqual({
    aliasesShareCore: true,
    wrapperIsDistinct: true,
    dependenciesUnchanged: true,
    savedViewUnchanged: true,
    relationsUnchanged: true,
    reminderWasReplaced: true,
    coreNowUsesEnhancedReminder: true,
    enhancedOwnsInbox: true,
    enhancedOwnsArchive: true,
    enhancedOwnsDuplicate: true
  });
});

test('Ver.245 audit: persistence sidecars create no DOM observer while consumer observers stay main/detail scoped', async ({ page }) => {
  await installRuntimeAudit(page);
  await boot(page);

  const records = await page.evaluate(() => window.__WB_WORKFLOW_OBSERVER_AUDIT__ || []);
  const direct = records.filter(item => /workflow-core-v150\.js|workflow-v152\.js/.test(item.stack));
  const relationRecords = records.filter(item => /relationships-v152\.js/.test(item.stack));
  const reminderRecords = records.filter(item => /reminders-v152\.js/.test(item.stack));

  expect(direct, 'workflow persistence sidecars should not own DOM MutationObservers').toHaveLength(0);
  expect(relationRecords.some(item => item.targets.some(target => target.target === '#detailBody' && target.options?.childList && target.options?.subtree))).toBeTruthy();
  expect(relationRecords.some(item => item.targets.some(target => target.target === 'BODY' || target.target === '.app-shell'))).toBeFalsy();
  expect(reminderRecords.some(item => item.targets.some(target => target.target === '#mainContent' && target.options?.childList && target.options?.subtree))).toBeTruthy();
  expect(reminderRecords.some(item => item.targets.some(target => target.target === '#detailBody' && target.options?.childList && target.options?.subtree))).toBeTruthy();
  expect(reminderRecords.some(item => item.targets.some(target => target.target === 'BODY' || target.target === '.app-shell'))).toBeFalsy();
});

test('Ver.245 audit: disabling V152 enhancement leaves V150 workflow core available without taking over app persistence', async ({ page }) => {
  await page.route(/workflow-v152\.js(?:\?|$)/, route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: 'document.documentElement.dataset.workflowV152AuditDisabled="true";'
  }));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV150, undefined, { timeout: 20_000 });

  const state = await page.evaluate(() => ({
    disabled: document.documentElement.dataset.workflowV152AuditDisabled || '',
    core: Boolean(window.WorkBoardWorkflowV150),
    enhanced: Boolean(window.WorkBoardWorkflowV152),
    dependencies: typeof window.WorkBoardWorkflowV150?.writeDependencies === 'function',
    relations: typeof window.WorkBoardWorkflowV150?.writeRelations === 'function',
    reminder: typeof window.WorkBoardWorkflowV150?.writeReminder === 'function',
    release: Number(window.WORK_BOARD_RELEASE?.version || 0)
  }));

  expect(state.disabled).toBe('true');
  expect(state.core).toBe(true);
  expect(state.enhanced).toBe(false);
  expect(state.dependencies).toBe(true);
  expect(state.relations).toBe(true);
  expect(state.reminder).toBe(true);
  expect(state.release).toBeGreaterThanOrEqual(244);
});
