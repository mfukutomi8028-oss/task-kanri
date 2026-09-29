import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('ui-task-light-v189.css', 'utf8');
const browser = readFileSync('tests/task-dialog-ui-v320.spec.mjs', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');

test('Ver.320 remains a scoped Release 279 UI maintenance layer', () => {
  assert.match(manifest, /version:\s*["']279["']/);
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

test('Ver.320 makes the comment feed primary and keeps the composer compact', () => {
  assert.match(css, /\.task-dialog-detail-panel-v319 \.task-comments-panel-v149[\s\S]*grid-template-areas:\s*"feed compose"/);
  assert.match(css, /\.task-dialog-detail-panel-v319 \.task-comment-feed-v149[\s\S]*grid-area:\s*feed/);
  assert.match(css, /\.task-dialog-detail-panel-v319 \.task-comment-compose-v149[\s\S]*grid-area:\s*compose/);
  assert.match(css, /\.task-dialog-detail-panel-v319 \.task-comment-compose-v149 \.comment-form textarea[\s\S]*min-height:\s*86px !important/);
});

test('Ver.320 browser regression checks wide detail, checklist sizing, comment priority and right-pane preservation', () => {
  assert.match(browser, /check-item/);
  assert.match(browser, /task-comments-panel-v149/);
  assert.match(browser, /feedBox\?\.width.*composeBox\?\.width/s);
  assert.match(browser, /rightPaneColumns/);
  assert.match(browser, /checkboxBox\?\.width/);
});
