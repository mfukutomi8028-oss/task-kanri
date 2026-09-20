import { test, expect } from '@playwright/test';

async function boot(page) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
}

test('Ver.248 product: dependency writer requires an expected base and reports conflicts in later releases', async ({ page }) => {
  await boot(page);
  const state = await page.evaluate(() => ({
    release: Number(window.WORK_BOARD_RELEASE?.version || 0),
    writer: String(window.WorkBoardWorkflowV150?.writeDependencies || ''),
    dependencyUiLoaded: Boolean(window.WorkBoardCompletionGuardV149)
  }));

  expect(state.release).toBeGreaterThanOrEqual(248);
  expect(state.dependencyUiLoaded).toBe(true);
  expect(state.writer).toContain('expectedIds');
  expect(state.writer).toContain('sameIdList(current,expected,id)');
  expect(state.writer).toContain('conflict:true');
});

test('Ver.248 product: saved-view writer compares the rendered expected record before commit', async ({ page }) => {
  await boot(page);
  const source = await page.evaluate(() => String(window.WorkBoardWorkflowV150?.writeSavedView || ''));

  expect(source).toContain('expectedView');
  expect(source).toContain('sameSavedViewValue(current,expected)');
  expect(source).toContain('conflict:true');
  expect(source).toContain('runTransaction(target,current=>');
});

test('Ver.248 product: relation writer protects the direct expected base and repairs reverse edges atomically', async ({ page }) => {
  await boot(page);
  const source = await page.evaluate(() => String(window.WorkBoardWorkflowV150?.writeRelations || ''));

  expect(source).toContain('expectedIds');
  expect(source).toContain('const direct=normalizeIdList(next[id],id)');
  expect(source).toContain('sameIdList(direct,expected,id)');
  expect(source).toContain('map[id]===true');
  expect(source).toContain('conflict:true');
});

test('Ver.248 product: current workflow aliases share the hardened v150 dependency/saved-view/relation writers', async ({ page }) => {
  await boot(page);
  const state = await page.evaluate(() => ({
    dependency: window.WorkBoardWorkflowV150?.writeDependencies === window.WorkBoardWorkflowV152?.writeDependencies,
    savedView: window.WorkBoardWorkflowV150?.writeSavedView === window.WorkBoardWorkflowV152?.writeSavedView,
    relations: window.WorkBoardWorkflowV150?.writeRelations === window.WorkBoardWorkflowV152?.writeRelations,
    workflowVersion: document.documentElement.dataset.workflowVersion || ''
  }));

  expect(state.dependency).toBe(true);
  expect(state.savedView).toBe(true);
  expect(state.relations).toBe(true);
  expect(Number(state.workflowVersion)).toBeGreaterThanOrEqual(152);
});
