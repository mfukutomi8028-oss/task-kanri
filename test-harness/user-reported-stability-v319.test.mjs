import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const runtime = readFileSync('user-reported-stability-v319.js', 'utf8');
const css = readFileSync('ui-user-reported-stability-v319.css', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const notificationIcon = readFileSync('assets/notification-brand-v319.svg', 'utf8');
const browser = readFileSync('tests/user-reported-stability-v319.spec.mjs', 'utf8');

test('Ver.319 registers the targeted maintenance assets without changing Release 279', () => {
  assert.match(manifest, /version:\s*["']279["']/);
  assert.match(manifest, /ui-user-reported-stability-v319\.css/);
  assert.match(manifest, /user-reported-stability-v319\.js/);
  assert.match(manifest, /assets\/notification-brand-v319\.svg/);
});

test('Ver.319 gives notifications a dedicated safe-area icon while preserving brand lifecycle ownership', () => {
  assert.match(runtime, /NOTIFICATION_ICON = `assets\/notification-brand-v319\.svg\?v=\$\{VERSION\}`/);
  assert.match(runtime, /icon: NOTIFICATION_ICON/);
  assert.match(runtime, /__workBoardBrandVersion/);
  assert.match(runtime, /__workBoardNotificationSafeVersion/);
  assert.match(notificationIcon, /viewBox="0 0 128 128"/);
  assert.match(notificationIcon, /x="28" y="26" width="72" height="76"/);
});

test('Ver.319 stabilizes reserved-task board counts before paint across canonical column replacement', () => {
  assert.match(runtime, /record\.removedNodes\.forEach\(addHiddenTaskIdsFrom\)/);
  assert.match(runtime, /knownFutureTaskIds/);
  assert.match(runtime, /\.filter\(node => !node\.classList\.contains\(FUTURE_HIDDEN_CLASS\)\)\.length/);
  assert.match(runtime, /if \(output && output\.textContent !== next\) output\.textContent = next/);
});

test('Ver.319 keeps canonical task detail and edit surfaces and restores the right-side detail after dialog close', () => {
  assert.match(runtime, /data-task-dialog-tab-v319="detail"/);
  assert.match(runtime, /data-task-dialog-tab-v319="edit"/);
  assert.match(runtime, /aria-controls="taskForm"/);
  assert.doesNotMatch(runtime, /form\.id\s*=/);
  assert.match(runtime, /moveDetailIntoDialog/);
  assert.match(runtime, /restoreDetailHome/);
  assert.match(runtime, /event\.stopImmediatePropagation\(\)/);
});

test('Ver.319 explicitly inherits dashboard Auto Assist typography', () => {
  assert.match(css, /\.workflow-assist-list-v148 button[\s\S]*font-family:\s*inherit/);
});

test('Ver.319 browser regression covers the four reported behaviors', () => {
  assert.match(browser, /notification-brand-v319\.svg/);
  assert.match(browser, /not\.toContain\('21'\)/);
  assert.match(browser, /taskDialogDetailTabV319/);
  assert.match(browser, /fontFamily/);
});
