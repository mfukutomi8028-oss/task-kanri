import { test } from 'node:test';
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

test('Ver.237 product retires generic user-ux-polish and keeps its live behavior with later semantic owners', () => {
  const manifest = read('release-manifest.js');
  const required = extractStringArray(manifest, 'requiredAssets');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const favorite = read('favorite-ui-v237.js');
  const taskUx = read('task-ux-v146.js');
  const dialogLifecycle = read('dialog-lifecycle-v239.js');
  const legacy = read('user-ux-polish-v208.js');

  assert.equal(manifest.match(/version:\s*"(\d+)"/)?.[1], '237');
  assert.equal(scripts.filter(item => item === 'favorite-ui-v237.js').length, 1);
  assert.ok(required.includes('favorite-ui-v237.js'));
  assert.ok(!scripts.includes('user-ux-polish-v208.js'));
  assert.ok(!required.includes('user-ux-polish-v208.js'));
  assert.ok(fs.existsSync(path.join(ROOT, 'user-ux-polish-v208.js')),
    'legacy sidecar must remain physically available for cached manifests/rollback');

  assert.match(favorite, /function retireRemovedControls\(\)/);
  assert.match(favorite, /function patchFavoriteLabels\(/);
  assert.match(favorite, /function patchFavoriteToast\(/);
  assert.match(favorite, /お気に入りに追加しました/);
  assert.doesNotMatch(favorite, /DISCARD_MESSAGE|confirmTaskDiscard|document\.addEventListener\('cancel'/);

  // The discard/backdrop behavior moved from the generic legacy source to task-ux,
  // then Ver.239 preparation moved it again to the focused dialog lifecycle owner.
  assert.ok(scripts.includes('dialog-lifecycle-v239.js'));
  assert.ok(required.includes('dialog-lifecycle-v239.js'));
  assert.match(dialogLifecycle, /const DISCARD_MESSAGE = '入力内容が変更されています。保存せずに閉じますか？'/);
  assert.match(dialogLifecycle, /event\.isTrusted/);
  assert.match(dialogLifecycle, /closest\?\.\('#closeTaskDialog'\)/);
  assert.match(dialogLifecycle, /document\.addEventListener\('cancel'/);
  assert.match(dialogLifecycle, /document\.addEventListener\('close'/);
  assert.match(dialogLifecycle, /preferred\.click\(\)/);
  assert.doesNotMatch(taskUx, /DISCARD_MESSAGE|confirmTaskDiscard|document\.addEventListener\('cancel'|preferred\.click\(\)/);

  assert.match(legacy, /function hideRemovedUi\(\)/);
  assert.match(legacy, /function patchFavoriteLabels\(/);
  assert.match(legacy, /const DISCARD_MESSAGE/);
});

test('Ver.237 keeps favorite data writes, inbox read state and quick pin with their established owners', () => {
  const app = read('app.js');
  const favorite = read('favorite-ui-v237.js');
  const inbox = read('inbox-ui-v183.js');
  const detail = read('detail-layout-v154.js');

  assert.match(app, /state\.favoriteTaskIds = starred/);
  assert.match(app, /saveFavoriteTaskIds\(\)/);
  assert.doesNotMatch(favorite, /saveFavoriteTaskIds|favoriteTaskIds\s*=/);

  assert.doesNotMatch(favorite, /markInboxRead|markAllInboxRead|data-inbox-read-v153/);
  assert.match(inbox, /W\.markInboxRead\(id,!Boolean\(item\.readAt\)\)/);
  assert.match(inbox, /data-inbox-read-v153/);
  assert.match(inbox, /data-inbox-category-v235/);

  assert.doesNotMatch(favorite, /data-quick-pin-v154|quickPinV154/);
  assert.match(detail, /data-quick-pin-v154/);
  assert.match(detail, /button\.textContent=pinned\?'固定解除':'固定'/);
  assert.match(detail, /async function togglePin/);
});
