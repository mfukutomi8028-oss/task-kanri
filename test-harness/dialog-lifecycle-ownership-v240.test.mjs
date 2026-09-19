import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.240 audit: dialog lifecycle is active once and owns UX only, not persistence or app close state', () => {
  const manifest = read('release-manifest.js');
  const lifecycle = read('dialog-lifecycle-v239.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');

  assert.equal(manifest.match(/version:\s*"(\d+)"/)?.[1], '239', 'audit must not bump product release');
  assert.equal(scripts.filter(name => name === 'dialog-lifecycle-v239.js').length, 1);
  assert.equal(required.filter(name => name === 'dialog-lifecycle-v239.js').length, 1);

  assert.match(lifecycle, /const DISCARD_MESSAGE = '入力内容が変更されています。保存せずに閉じますか？'/);
  assert.match(lifecycle, /event\.isTrusted/);
  assert.match(lifecycle, /document\.addEventListener\('cancel'/);
  assert.match(lifecycle, /dialog\.id === 'userDialog'/);
  assert.match(lifecycle, /preferred\.click\(\)/);

  assert.doesNotMatch(lifecycle, /localStorage\.setItem/);
  assert.doesNotMatch(lifecycle, /sessionStorage\.setItem/);
  assert.doesNotMatch(lifecycle, /runTransaction/);
  assert.doesNotMatch(lifecycle, /commitTaskDraft/);
  assert.doesNotMatch(lifecycle, /changeStatus\(/);
});

test('Ver.240 audit: every current closable dialog already has an app-owned close or cancel path', () => {
  const html = read('index.html');
  const app = read('app.js');
  const lifecycle = read('dialog-lifecycle-v239.js');
  const dialogIds = [...html.matchAll(/<dialog id="([^"]+)"/g)].map(match => match[1]);

  assert.deepEqual(dialogIds, [
    'userDialog',
    'userManageDialog',
    'statusManageDialog',
    'categoryManageDialog',
    'scheduleDialog',
    'scheduleCopyDialog',
    'templateManageDialog',
    'taskDialog',
    'timelineMoveDialog',
    'activityDialog',
    'deleteConflictDialog'
  ]);

  // Startup user selection is intentionally modal and has no close button.
  assert.match(lifecycle, /if \(dialog\.id === 'userDialog'\) return/);
  assert.doesNotMatch(html, /id="closeUserDialog"/);

  // All other dialogs have an explicit close/cancel control whose actual behavior is app-owned.
  const controls = [
    'closeUserManage',
    'closeStatusManage',
    'closeCategoryManage',
    'closeScheduleDialog',
    'closeScheduleCopyDialog',
    'closeTemplateManage',
    'closeTaskDialog',
    'closeTimelineMoveDialog',
    'closeActivityDialog',
    'cancelDeleteConflict'
  ];
  controls.forEach(id => assert.match(html, new RegExp(`id="${id}"`), `${id} must exist in current dialog markup`));

  assert.match(app, /elements\.closeUserManage\.addEventListener\("click", \(\) => elements\.userManageDialog\.close\(\)\)/);
  assert.match(app, /elements\.closeStatusManage\.addEventListener\("click", \(\) => elements\.statusManageDialog\.close\(\)\)/);
  assert.match(app, /elements\.closeCategoryManage\.addEventListener\("click", \(\) => elements\.categoryManageDialog\.close\(\)\)/);
  assert.match(app, /elements\.closeScheduleDialog\.addEventListener\("click", \(\) => elements\.scheduleDialog\.close\(\)\)/);
  assert.match(app, /\$\("closeScheduleCopyDialog"\)\?\.addEventListener\("click", \(\) => closeScheduleCopyDialog\(true\)\)/);
  assert.match(app, /elements\.closeTemplateManage\.addEventListener\("click", \(\) => elements\.templateManageDialog\.close\(\)\)/);
  assert.match(app, /elements\.closeTaskDialog\.addEventListener\("click", \(\) => \{ clearTaskDialogContexts\(\); elements\.taskDialog\.close\(\); \}\)/);
  assert.match(app, /elements\.closeTimelineMoveDialog\?\.addEventListener\("click", \(\) => elements\.timelineMoveDialog\.close\(\)\)/);
  assert.match(app, /elements\.closeActivityDialog\?\.addEventListener\("click", \(\) => elements\.activityDialog\.close\(\)\)/);
  assert.match(app, /elements\.cancelDeleteConflict\.onclick = \(\) => \{/);
});

test('Ver.240 audit: current dialog inventory never needs the generic direct-close fallback', () => {
  const lifecycle = read('dialog-lifecycle-v239.js');
  const html = read('index.html');

  // Nine controls are named explicitly; schedule copy is currently reached through the generic
  // dialog-head icon selector. No current closable dialog lacks a delegatable control.
  [
    '#closeTaskDialog', '#closeScheduleDialog', '#closeTimelineMoveDialog', '#closeActivityDialog',
    '#closeUserManage', '#closeStatusManage', '#closeCategoryManage', '#closeTemplateManage',
    '#cancelDeleteConflict'
  ].forEach(selector => assert.ok(lifecycle.includes(selector), `${selector} must remain an explicit delegation target`));

  assert.match(lifecycle, /'\.dialog-head \.icon-button'/);
  assert.match(html, /id="closeScheduleCopyDialog" class="icon-button"/);
  assert.doesNotMatch(lifecycle, /#closeScheduleCopyDialog/,
    'schedule copy currently depends on the broad icon-button fallback rather than an explicit mapping');

  assert.match(lifecycle, /if \(preferred\) preferred\.click\(\);\s*else dialog\.close\(\);/,
    'audit records the generic direct-close fallback that is not required by the current dialog inventory');
});

test('Ver.240 audit: task discard guard is sidecar-owned while app remains the canonical task close owner', () => {
  const app = read('app.js');
  const lifecycle = read('dialog-lifecycle-v239.js');

  assert.match(lifecycle, /let taskDialogDirty = false/);
  assert.match(lifecycle, /event\.target\?\.closest\?\.\('#taskForm'\)/);
  assert.match(lifecycle, /event\.target\?\.closest\?\.\('#closeTaskDialog'\)/);
  assert.match(lifecycle, /event\.preventDefault\(\);\s*event\.stopImmediatePropagation\(\);/);

  assert.match(app, /elements\.closeTaskDialog\.addEventListener\("click", \(\) => \{ clearTaskDialogContexts\(\); elements\.taskDialog\.close\(\); \}\)/);
  assert.match(app, /elements\.taskDialog\.addEventListener\('cancel', clearTaskDialogContexts\)/);
  assert.match(app, /elements\.taskDialog\.addEventListener\('close', clearTaskDialogContexts\)/);
  assert.doesNotMatch(app, /入力内容が変更されています。保存せずに閉じますか？/);
});
