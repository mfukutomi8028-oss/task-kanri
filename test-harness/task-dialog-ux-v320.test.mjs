import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const detailLayout = readFileSync('detail-layout-v154.js', 'utf8');

test('Ver.320 keeps canonical detail ownership while adding dialog-only UX', () => {
  assert.match(detailLayout, /task-dialog-detail-active-v320/);
  assert.match(detailLayout, /taskDialogUxVersion='320'/);
  assert.match(detailLayout, /detailHome\.insertBefore\(detail,detailNextSibling\)/);
  assert.match(detailLayout, /task-comment-compose-toggle-v320/);
});

test('Ver.320 explicitly repairs checklist labels inside dialog scope', () => {
  assert.match(detailLayout, /#taskDialog \.task-dialog-detail-active-v320 \.check-item\{display:grid!important/);
  assert.match(detailLayout, /input\[type="checkbox"\].*width:18px!important/s);
  assert.match(detailLayout, /\.checklist\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('Ver.320 makes comment history primary and composes on demand', () => {
  assert.match(detailLayout, /\.task-comment-feed-v149\{order:1/);
  assert.match(detailLayout, /\.task-comment-compose-v149\{order:2/);
  assert.match(detailLayout, /\.task-comment-compose-v149 \.comment-form\{display:none!important/);
  assert.match(detailLayout, /is-open-v320 \.comment-form\{display:grid!important/);
});
