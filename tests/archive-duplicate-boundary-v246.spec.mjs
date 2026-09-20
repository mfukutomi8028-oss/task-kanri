import { test, expect } from '@playwright/test';

async function boot(page) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
}

test('Ver.246 product: runtime exposes conflict-protected archive metadata and transactional duplicate merge', async ({ page }) => {
  await boot(page);

  const state = await page.evaluate(async () => {
    const W = window.WorkBoardWorkflowV152;
    const [archiveSource, duplicateSource] = await Promise.all([
      fetch('archive-ui-v182.js').then(response => response.text()),
      fetch('duplicate-merge-v182.js').then(response => response.text())
    ]);
    return {
      release: Number(window.WORK_BOARD_RELEASE?.version || 0),
      hasWorkflow: Boolean(W),
      hasArchiveUi: Boolean(window.WorkBoardArchiveV182),
      hasDuplicateMerge: Boolean(window.WorkBoardDuplicateV182),
      archiveWriter: String(W?.archiveTask || ''),
      unarchiveWriter: String(W?.unarchiveTask || ''),
      duplicateMarker: String(W?.markDuplicate || ''),
      archiveSource,
      duplicateSource
    };
  });

  expect(state.release).toBeGreaterThanOrEqual(246);
  expect(state.hasWorkflow).toBe(true);
  expect(state.hasArchiveUi).toBe(true);
  expect(state.hasDuplicateMerge).toBe(true);

  expect(state.archiveWriter).toContain('expectedArchive');
  expect(state.archiveWriter).toContain('runTransaction');
  expect(state.archiveWriter).not.toContain('r.set(');
  expect(state.unarchiveWriter).toContain('expectedArchive');
  expect(state.unarchiveWriter).toContain('runTransaction');
  expect(state.unarchiveWriter).not.toContain('r.remove(');
  expect(state.duplicateMarker).toContain('expectedDuplicate');
  expect(state.duplicateMarker).toContain('runTransaction');
  expect(state.duplicateMarker).not.toContain('r.set(');

  expect(state.archiveSource).toContain('expected=entries.find(x=>x.id===id)?.info||null');
  expect(state.archiveSource).toContain('W.unarchiveTask(id,expected)');
  expect(state.duplicateSource).toContain('r.runTransaction(roomRef,current=>');
  expect(state.duplicateSource).toContain('expectedSourceRevision');
  expect(state.duplicateSource).toContain('expectedTargetRevision');
  expect(state.duplicateSource).not.toContain('await r.update(roomRef,updates)');
});

test('Ver.246 product: archive UI stays independently active when duplicate-merge sidecar is disabled', async ({ page }) => {
  await page.route(/duplicate-merge-v182\.js(?:\?|$)/, route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: 'document.documentElement.dataset.duplicateMergeV182AuditDisabled="true";'
  }));

  await boot(page);
  const state = await page.evaluate(() => ({
    disabled: document.documentElement.dataset.duplicateMergeV182AuditDisabled,
    hasWorkflow: Boolean(window.WorkBoardWorkflowV152),
    hasArchiveUi: Boolean(window.WorkBoardArchiveV182),
    hasDuplicateMerge: Boolean(window.WorkBoardDuplicateV182),
    archiveWriter: String(window.WorkBoardWorkflowV152?.archiveTask || ''),
    unarchiveWriter: String(window.WorkBoardWorkflowV152?.unarchiveTask || '')
  }));

  expect(state.disabled).toBe('true');
  expect(state.hasWorkflow).toBe(true);
  expect(state.hasArchiveUi).toBe(true);
  expect(state.hasDuplicateMerge).toBe(false);
  expect(state.archiveWriter).toContain('runTransaction');
  expect(state.unarchiveWriter).toContain('runTransaction');
});
