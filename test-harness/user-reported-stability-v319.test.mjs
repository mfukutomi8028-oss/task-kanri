import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const brand = readFileSync('brand-v185.js', 'utf8');
const workUi = readFileSync('work-features-ui-v190.js', 'utf8');
const detailLayout = readFileSync('detail-layout-v154.js', 'utf8');
const taskCss = readFileSync('ui-task-light-v189.css', 'utf8');
const brandCss = readFileSync('ui-brand-v185.css', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const notificationIcon = readFileSync('assets/notification-brand-v319.svg', 'utf8');
const browser = readFileSync('tests/user-reported-stability-v319.spec.mjs', 'utf8');

test('Ver.319 stays on Release 279 and keeps the new work in existing canonical dynamic owners', () => {
  assert.match(manifest, /version:\s*["']279["']/);
  assert.match(manifest, /assets\/notification-brand-v319\.svg/);
  assert.doesNotMatch(manifest, /user-reported-stability-v319\.(?:js|css)/);
});

test('Ver.319 gives notifications a dedicated safe-area icon inside the existing brand lifecycle', () => {
  assert.match(brand, /NOTIFICATION_ICON = 'assets\/notification-brand-v319\.svg\?v=319'/);
  assert.match(brand, /icon: NOTIFICATION_ICON/);
  assert.match(brand, /__workBoardBrandVersion/);
  assert.match(notificationIcon, /viewBox="0 0 128 128"/);
  assert.match(notificationIcon, /x="28" y="26" width="72" height="76"/);
});

test('Ver.319 stabilizes reserved-task board counts before paint across canonical column replacement', () => {
  assert.match(workUi, /record\.removedNodes\.forEach\(collectFutureIds\)/);
  assert.match(workUi, /knownFutureTaskIds/);
  assert.match(workUi, /\.filter\(node => !node\.classList\.contains\(FUTURE_HIDDEN_CLASS\)\)\.length/);
  assert.match(workUi, /if \(output && output\.textContent !== next\) output\.textContent = next/);
});

test('Ver.319 reuses canonical task detail in the editor and restores it to the right panel on close', () => {
  assert.match(detailLayout, /data-task-dialog-tab-v319="detail"/);
  assert.match(detailLayout, /data-task-dialog-tab-v319="edit"/);
  assert.match(detailLayout, /aria-controls=\\?"taskForm\\?"/);
  assert.doesNotMatch(detailLayout, /form\.id\s*=/);
  assert.match(detailLayout, /detailHome/);
  assert.match(detailLayout, /detailNextSibling/);
  assert.match(detailLayout, /event\.stopImmediatePropagation\(\)/);
  assert.match(taskCss, /task-dialog-detail-panel-v319/);
});

test('Ver.319 explicitly inherits dashboard Auto Assist typography', () => {
  assert.match(brandCss, /\.workflow-assist-list-v148 button[\s\S]*font-family:\s*inherit/);
});

test('Ver.319 browser regression covers the four reported behaviors', () => {
  assert.match(browser, /notification-brand-v319\.svg/);
  assert.match(browser, /not\.toContain\('21'\)/);
  assert.match(browser, /taskDialogDetailTabV319/);
  assert.match(browser, /fontFamily/);
});
