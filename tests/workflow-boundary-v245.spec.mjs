import { test, expect } from '@playwright/test';

async function boot(page) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
}

test('Ver.245 audit: normal runtime replaces the v150 reminder writer with the v152 reliability writer', async ({ page }) => {
  await boot(page);
  const state = await page.evaluate(() => ({
    release: Number(window.WORK_BOARD_RELEASE?.version || 0),
    has150: Boolean(window.WorkBoardWorkflowV150),
    has152: Boolean(window.WorkBoardWorkflowV152),
    sameWriter: window.WorkBoardWorkflowV150?.writeReminder === window.WorkBoardWorkflowV152?.writeReminder,
    writerSource: String(window.WorkBoardWorkflowV152?.writeReminder || '')
  }));

  expect(state.release).toBeGreaterThanOrEqual(244);
  expect(state.has150).toBe(true);
  expect(state.has152).toBe(true);
  expect(state.sameWriter).toBe(true);
  expect(state.writerSource).toContain('r.set(target,next)');
  expect(state.writerSource).toContain('r.get(target)');
  expect(state.writerSource).not.toContain('runTransaction');
});

test('Ver.245 audit: without workflow-v152 the v150 reminder transaction remains the active writer', async ({ page }) => {
  await page.route(/workflow-v152\.js(?:\?|$)/, route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: 'document.documentElement.dataset.workflowV152AuditDisabled="true";'
  }));

  await boot(page);
  const state = await page.evaluate(() => ({
    disabled: document.documentElement.dataset.workflowV152AuditDisabled,
    has150: Boolean(window.WorkBoardWorkflowV150),
    has152: Boolean(window.WorkBoardWorkflowV152),
    writerSource: String(window.WorkBoardWorkflowV150?.writeReminder || '')
  }));

  expect(state.disabled).toBe('true');
  expect(state.has150).toBe(true);
  expect(state.has152).toBe(false);
  expect(state.writerSource).toContain('runTransaction');
  expect(state.writerSource).not.toContain('r.set(target,next)');
});
