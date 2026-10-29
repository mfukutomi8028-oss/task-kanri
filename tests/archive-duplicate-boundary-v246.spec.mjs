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
      hasArchivePersistence: Boolean(window.WorkBoardArchivePersistenceV540),
      archivePersistenceSource: await fetch('workspace-archive-v540.js').then(response => response.text()),
      duplicateMarker: String(W?.markDuplicate || ''),
      hasDuplicateMeta: Boolean(window.WorkBoardDuplicateMetaV545),
      duplicateMetaSource: await fetch('workspace-duplicate-meta-v545.js').then(response => response.text()),
      hasDuplicateAtomic: Boolean(window.WorkBoardDuplicateAtomicV544),
      duplicateAtomicSource: await fetch('workspace-duplicate-atomic-v544.js').then(response => response.text()),
      archiveSource,
      duplicateSource
    };
  });

  expect(state.release).toBeGreaterThanOrEqual(246);
  expect(state.hasWorkflow).toBe(true);
  expect(state.hasArchiveUi).toBe(true);
  expect(state.hasDuplicateMerge).toBe(true);

  expect(state.archiveWriter).toContain('expectedArchive');
  expect(state.archiveWriter).toContain('archivePersistence.archive(');
  expect(state.unarchiveWriter).toContain('expectedArchive');
  expect(state.unarchiveWriter).toContain('archivePersistence.restore(');
  expect(state.hasArchivePersistence).toBe(true);
  expect(state.archivePersistenceSource).toContain('runTransaction(target');
  expect(state.archivePersistenceSource).toContain('if (!same(current, expected))');
  expect(state.archivePersistenceSource).toContain('applyLocally: false');
  expect(state.archivePersistenceSource).toContain('conflict: true');
  expect(state.archivePersistenceSource).not.toContain('r.set(');
  expect(state.archivePersistenceSource).not.toContain('r.remove(');
  expect(state.duplicateMarker).toContain('expectedDuplicate');
  expect(state.duplicateMarker).toContain('duplicateMetadata.write(');
  expect(state.hasDuplicateMeta).toBe(true);
  expect(state.duplicateMetaSource).toContain('runTransaction(target, current =>');
  expect(state.duplicateMetaSource).toContain('if (!same(current, expected))');
  expect(state.duplicateMetaSource).toContain('workflowV152/duplicates/');
  expect(state.duplicateMetaSource).toContain('applyLocally: false');
  expect(state.duplicateMetaSource).not.toContain('r.set(');

  expect(state.archiveSource).toContain('expected=entries.find(x=>x.id===id)?.info||null');
  expect(state.archiveSource).toContain('W.unarchiveTask(id,expected)');
  expect(state.hasDuplicateAtomic).toBe(true);
  expect(state.duplicateSource).toContain('duplicateAtomic.commit(');
  expect(state.duplicateSource).toContain('expectedSourceRevision');
  expect(state.duplicateSource).toContain('expectedTargetRevision');
  expect(state.duplicateSource).toContain('dependencyUse(source)');
  expect(state.duplicateSource).toContain('syncDuplicateCache(source,target,now,me)');
  expect(state.duplicateAtomicSource).toContain('r.runTransaction(roomRef,current=>');
  expect(state.duplicateAtomicSource).toContain("if(current===null){conflictReason='cold';return null}");
  expect(state.duplicateAtomicSource).toContain('Number(rawS.revision||0)!==expectedSourceRevision');
  expect(state.duplicateAtomicSource).toContain('Number(rawT.revision||0)!==expectedTargetRevision');
  expect(state.duplicateAtomicSource).toContain('applyLocally:false');
  expect(state.duplicateAtomicSource).not.toContain('await r.update(roomRef,updates)');
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
    hasDuplicateAtomic: Boolean(window.WorkBoardDuplicateAtomicV544),
    archiveWriter: String(window.WorkBoardWorkflowV152?.archiveTask || ''),
    unarchiveWriter: String(window.WorkBoardWorkflowV152?.unarchiveTask || ''),
    hasArchivePersistence: Boolean(window.WorkBoardArchivePersistenceV540)
  }));

  expect(state.disabled).toBe('true');
  expect(state.hasWorkflow).toBe(true);
  expect(state.hasArchiveUi).toBe(true);
  expect(state.hasDuplicateMerge).toBe(false);
  expect(state.hasDuplicateAtomic).toBe(true);
  expect(state.hasArchivePersistence).toBe(true);
  expect(state.archiveWriter).toContain('archivePersistence.archive(');
  expect(state.unarchiveWriter).toContain('archivePersistence.restore(');
});
