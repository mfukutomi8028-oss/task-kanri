import { test, expect } from '@playwright/test';

async function boot(page) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
}

test('Ver.248 audit: active dependency writer has no rendered expected-base parameter', async ({ page }) => {
  await boot(page);
  const state = await page.evaluate(() => ({
    release: Number(window.WORK_BOARD_RELEASE?.version || 0),
    writer: String(window.WorkBoardWorkflowV150?.writeDependencies || ''),
    dependencyUiLoaded: Boolean(window.WorkBoardCompletionGuardV149)
  }));

  expect(state.release).toBe(247);
  expect(state.dependencyUiLoaded).toBe(true);
  expect(state.writer).toContain('runTransaction(target');
  expect(state.writer).toContain('()=>clean.length?next:null');
  expect(state.writer).not.toContain('expected');
  expect(state.writer).not.toContain('current=>');
});

test('Ver.248 audit: active saved-view writer does not compare server updatedAt', async ({ page }) => {
  await boot(page);
  const source = await page.evaluate(() => String(window.WorkBoardWorkflowV150?.writeSavedView || ''));

  expect(source).toContain('runTransaction(target');
  expect(source).toContain('()=>view');
  expect(source).not.toContain('current=>');
  expect(source).not.toContain('updatedAt')
});

test('Ver.248 audit: relation writer uses the caller clean set to remove server-current peers', async ({ page }) => {
  await boot(page);
  const source = await page.evaluate(() => String(window.WorkBoardWorkflowV150?.writeRelations || ''));

  expect(source).toContain('runTransaction(target,current=>');
  expect(source).toContain('previous=Object.keys(next[id]');
  expect(source).toContain('if(clean.includes(other))peer[id]=true;else delete peer[id]');
  expect(source).not.toContain('expected');
});

test('Ver.248 audit: current workflow aliases still share the same v150 dependency/saved-view/relation writers', async ({ page }) => {
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
