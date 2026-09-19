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

test('Ver.240 product: dialog lifecycle is active once and owns UX only, not persistence or app close state', () => {
  const manifest = read('release-manifest.js');
  const lifecycle = read('dialog-lifecycle-v239.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');

  assert.equal(manifest.match(/version:\s*"(\d+)"/)?.[1], '240');
  assert.equal(scripts.filter(name => name === 'dialog-lifecycle-v239.js').length, 1);
  assert.equal(required.filter(name => name === 'dialog-lifecycle-v239.js').length, 1);

  assert.match(lifecycle, /const DISCARD_MESSAGE = '入力内容が変更されています。保存せずに閉じますか？'/);
  assert.match(lifecycle, /const BACKDROP_CLOSE_CONTROL_BY_DIALOG = Object\.freeze\(/);
  assert.match(lifecycle, /event\.isTrusted/);
  assert.match(lifecycle, /document\.addEventListener\('cancel'/);
  assert.match(lifecycle, /preferred\.click\(\)/);

  assert.doesNotMatch(lifecycle, /localStorage\.setItem/);
  assert.doesNotMatch(lifecycle, /sessionStorage\.setItem/);
  assert.doesNotMatch(lifecycle, /runTransaction/);
  assert.doesNotMatch(lifecycle, /commitTaskDraft/);
  assert.doesNotMatch(lifecycle, /changeStatus\(/);
});

test('Ver.240 product: every current closable dialog delegates to an app-owned close or cancel path', () => {
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

  // Startup user selection is intentionally modal and is not in the backdrop delegation map.
  assert.doesNotMatch(lifecycle, /userDialog:\s*['"]/);
  assert.doesNotMatch(html, /id="closeUserDialog"/);

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

test('Ver.240 product: backdrop delegation is explicit and has no generic direct-close fallback', () => {
  const lifecycle = read('dialog-lifecycle-v239.js');

  const mappings = [
    ["userManageDialog", '#closeUserManage'],
    ["statusManageDialog", '#closeStatusManage'],
    ["categoryManageDialog", '#closeCategoryManage'],
    ["scheduleDialog", '#closeScheduleDialog'],
    ["scheduleCopyDialog", '#closeScheduleCopyDialog'],
    ["templateManageDialog", '#closeTemplateManage'],
    ["taskDialog", '#closeTaskDialog'],
    ["timelineMoveDialog", '#closeTimelineMoveDialog'],
    ["activityDialog", '#closeActivityDialog'],
    ["deleteConflictDialog", '#cancelDeleteConflict']
  ];
  for (const [dialogId, selector] of mappings) {
    assert.match(lifecycle, new RegExp(`${dialogId}: '${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  }

  assert.match(lifecycle, /const closeSelector = BACKDROP_CLOSE_CONTROL_BY_DIALOG\[dialog\.id\]/);
  assert.match(lifecycle, /if \(!closeSelector\) return/);
  assert.doesNotMatch(lifecycle, /'\.dialog-head \.icon-button'/);
  assert.doesNotMatch(lifecycle, /else dialog\.close\(\)/);
  assert.doesNotMatch(lifecycle, /#cancelTimelineMove/);
});

test('Ver.240 product: task discard guard stays sidecar-owned while app remains the canonical task close owner', () => {
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

test('Ver.240 product: dialog lifecycle inventory is consolidated and advances cleanup priority', () => {
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  const dialogGroup = inventory.groups.find(group => group.id === 'dialog-lifecycle');
  assert.ok(dialogGroup);
  assert.equal(dialogGroup.consolidation, 'consolidated-v240');
  assert.deepEqual(dialogGroup.assets, ['dialog-lifecycle-v239.js']);
  assert.match(dialogGroup.reason, /Ver\.240/);
  assert.match(dialogGroup.reason, /明示/);
  assert.match(dialogGroup.reason, /direct close fallback/);

  const next = inventory.priorityCandidates?.[0];
  assert.ok(next);
  assert.equal(next.order, 1);
  assert.ok(next.scope.includes('desktop-sidebar-v181.js'));
  assert.ok(next.scope.includes('mobile-shell-v234.js'));
  assert.match(next.precondition, /Ver\.\d+/,
    'later cleanup priorities may advance without rewriting the completed Ver.240 lifecycle contract');
});
