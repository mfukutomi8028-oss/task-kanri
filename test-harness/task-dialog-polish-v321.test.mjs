import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const detailLayout = readFileSync('detail-layout-v154.js', 'utf8');
const mentions = readFileSync('comment-mentions-v191.js', 'utf8');
const browser = readFileSync('tests/task-dialog-polish-v321.spec.mjs', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');

function includesAll(source, tokens, message) {
  for (const token of tokens) assert.ok(source.includes(token), `${message}: missing ${token}`);
}

test('Ver.321 remains a scoped Release 279 UI repair', () => {
  assert.match(manifest, /version:\s*["']279["']/);
  includesAll(detailLayout, ['taskDialogUxV321Styles', "taskDialogUxVersion='321'"], 'Ver.321 identity');
});

test('Ver.321 restores strict tab isolation and moves task metadata below the review content', () => {
  includesAll(detailLayout, [
    '.task-detail-panel-v149[hidden]{display:none!important}',
    '.task-metadata-section-v154{grid-column:1/-1!important;grid-row:auto!important;position:static!important',
    '.task-metadata-section-v154 .detail-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}'
  ], 'dialog detail layout');
});

test('Ver.321 names the outer dialog by the active Detail or Edit mode', () => {
  includesAll(detailLayout, ["dialogTitle.textContent=showDetail?'タスク詳細':'タスク編集'"], 'dialog title');
});

test('Ver.321 keeps five task actions on one desktop row without text-driven column growth', () => {
  includesAll(detailLayout, [
    'sub-actions{grid-template-columns:repeat(5,minmax(0,1fr))!important}',
    'sub-actions>button{width:100%!important;min-width:0!important;max-width:100%!important',
    'white-space:nowrap!important'
  ], 'secondary actions');
});

test('Ver.321 mounts the mention picker inside an open task dialog top-layer context', () => {
  includesAll(mentions, [
    'function mountShellForContext()',
    'const host=taskDialog?.open?taskDialog:document.body',
    'mentionLayerHostV321'
  ], 'mention dialog host');
});

test('Ver.321 browser regression covers tab isolation, full-width metadata, dialog titles, mention layering and action stability', () => {
  includesAll(browser, [
    'task-comments-panel-v149',
    'task-history-panel-v149',
    'task-tools-panel-v154',
    'task-metadata-section-v154',
    'タスク詳細',
    'タスク編集',
    'data-mention-layer-host-v321',
    'お気に入り解除'
  ], 'Ver.321 browser coverage');
});
