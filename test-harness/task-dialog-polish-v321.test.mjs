import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const detailLayout = readFileSync('detail-layout-v154.js', 'utf8');
const mentions = readFileSync('comment-mentions-v191.js', 'utf8');
const browser = readFileSync('tests/task-dialog-polish-v321.spec.mjs', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');

test('Ver.321 remains a scoped Release 279 UI repair', () => {
  assert.match(manifest, /version:\s*["']279["']/);
  assert.match(detailLayout, /taskDialogUxV321Styles/);
  assert.match(detailLayout, /dataset\.taskDialogUxVersion='321'/);
});

test('Ver.321 restores strict tab isolation and moves task metadata below the review content', () => {
  assert.match(detailLayout, /task-detail-panel-v149\[hidden\]\{display:none!important\}/);
  assert.match(detailLayout, /task-metadata-section-v154\{grid-column:1\/-1!important;grid-row:auto!important;position:static!important/);
  assert.match(detailLayout, /task-metadata-section-v154 \.detail-grid\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important\}/);
});

test('Ver.321 names the outer dialog by the active Detail or Edit mode', () => {
  assert.match(detailLayout, /dialogTitle\.textContent=showDetail\?'タスク詳細':'タスク編集'/);
});

test('Ver.321 keeps five task actions on one desktop row without text-driven column growth', () => {
  assert.match(detailLayout, /sub-actions\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important\}/);
  assert.match(detailLayout, /sub-actions>button\{width:100%!important;min-width:0!important;max-width:100%!important/);
  assert.match(detailLayout, /white-space:nowrap!important/);
});

test('Ver.321 mounts the mention picker inside an open task dialog top-layer context', () => {
  assert.match(mentions, /function mountShellForContext\(\)/);
  assert.match(mentions, /const host=taskDialog\?\.open\?taskDialog:document\.body/);
  assert.match(mentions, /mentionLayerHostV321/);
});

test('Ver.321 browser regression covers tab isolation, full-width metadata, dialog titles, mention layering and action stability', () => {
  for (const token of ['task-comments-panel-v149', 'task-history-panel-v149', 'task-tools-panel-v154', 'task-metadata-section-v154', 'タスク詳細', 'タスク編集', 'data-mention-layer-host-v321', 'お気に入り解除']) {
    assert.match(browser, new RegExp(token));
  }
});
