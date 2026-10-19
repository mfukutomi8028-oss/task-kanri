import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const detailLayout = readFileSync('detail-layout-v154.js', 'utf8');
const mentions = readFileSync('comment-mentions-v191.js', 'utf8');
const browser = readFileSync('tests/task-dialog-polish-v321.spec.mjs', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

function includesAll(source, tokens, message) {
  for (const token of tokens) assert.ok(source.includes(token), `${message}: missing ${token}`);
}

test('Ver.321 scoped UI repair remains published in release 279 or later', () => {
  assert.ok(release >= 279);
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

test('Ver.321 checkpoint documentation records rollback and unchanged release', () => {
  const doc = readFileSync('docs/ver321-task-dialog-polish.md', 'utf8');
  assert.match(doc, /Release remains 279/);
  assert.match(doc, /backup\/ver320-before-task-dialog-polish-v321/);
});

// Ver.501: historic Ver.320 checks remain byte-for-byte unchanged in this scoped block.
{
const css = readFileSync('ui-task-light-v189.css', 'utf8');
const detailLayout = readFileSync('detail-layout-v154.js', 'utf8');
const browser = readFileSync('tests/task-dialog-ui-v320.spec.mjs', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);
test('Ver.320 scoped UI maintenance remains published in release 279 or later', () => {
  assert.ok(release >= 279);
  assert.match(css, /Ver\.320: turn the dialog detail tab into a wide review workspace/);
  assert.match(css, /\.task-dialog-detail-panel-v319 > \.detail-body/);
});

test('Ver.320 uses wide-space layouts only inside the dialog detail workspace', () => {
  assert.match(css, /#taskDialog\.task-dialog-tabs-enabled-v319[\s\S]*max-width:\s*1180px/);
  assert.match(css, /\.task-dialog-detail-panel-v319 \.task-detail-panel-v149\[data-tab-panel="details"\][\s\S]*grid-template-columns:\s*minmax\(0, 1\.15fr\) minmax\(320px, \.85fr\)/);
  assert.match(css, /\.task-dialog-detail-panel-v319 \.detail-grid[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(css, /Ver\.320[\s\S]*\.detail-panel > \.detail-body\s*\{/);
});

test('Ver.320 neutralizes dialog input inflation for checklist checkboxes', () => {
  assert.match(css, /\.task-dialog-detail-panel-v319 \.checklist[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.task-dialog-detail-panel-v319 \.check-item input\[type="checkbox"\][\s\S]*width:\s*18px !important/);
  assert.match(css, /\.task-dialog-detail-panel-v319 \.check-item input\[type="checkbox"\][\s\S]*padding:\s*0 !important/);
  assert.match(css, /\.task-dialog-detail-panel-v319 \.check-item\.done > span[\s\S]*text-decoration:\s*line-through/);
});

test('Ver.320 makes comment history primary and the composer on-demand in dialog detail', () => {
  assert.match(detailLayout, /task-comment-compose-toggle-v320/);
  assert.match(detailLayout, /\.task-comment-feed-v149\{order:1/);
  assert.match(detailLayout, /\.task-comment-compose-v149\{order:2/);
  assert.match(detailLayout, /\.task-comment-compose-v149 \.comment-form\{display:none!important/);
  assert.match(detailLayout, /is-open-v320 \.comment-form\{display:grid!important/);
});

test('Ver.320 browser regression checks wide detail, checklist sizing, on-demand comments and right-pane preservation', () => {
  assert.match(browser, /check-item/);
  assert.match(browser, /task-comments-panel-v149/);
  assert.match(browser, /task-comment-compose-toggle-v320/);
  assert.match(browser, /toBeHidden\(\)/);
  assert.match(browser, /rightPaneColumns/);
  assert.match(browser, /checkboxBox\?\.width/);
});

test('Ver.320 canonical detail restoration and dialog-scoped checklist survive the Ver.321 takeover', () => {
  // Unique assertions migrated from the retired v320 UX audit. The old
  // taskDialogUxVersion='320' assertion is obsolete: v321 owns the version.
  assert.match(detailLayout, /task-dialog-detail-active-v320/);
  assert.match(detailLayout, /detailHome\.insertBefore\(detail,detailNextSibling\)/);
  assert.match(detailLayout, /#taskDialog \.task-dialog-detail-active-v320 \.check-item\{display:grid!important/);
  assert.match(detailLayout, /input\[type="checkbox"\].*width:18px!important/s);
  assert.match(detailLayout, /\.checklist\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(detailLayout, /taskDialogUxVersion='321'/);
});
}

test('Ver.501 retired Ver.320 dialog Protocol remains absent', () => {
  assert.equal(existsSync(new URL('./task-dialog-ui-v320.test.mjs', import.meta.url)), false);
});
