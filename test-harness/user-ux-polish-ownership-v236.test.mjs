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

test('Ver.237 user-ux retirement remains intact through the current task UX successor', () => {
  const manifest = read('release-manifest.js');
  const required = extractStringArray(manifest, 'requiredAssets');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const favorite = read('favorite-ui-v237.js');
  const taskUx = read('task-ux-v239.js');
  const legacy = read('user-ux-polish-v208.js');

  const release = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);
  assert.ok(release >= 237, `Ver.237 ownership must remain valid in later releases, got Ver.${release}`);
  assert.equal(scripts.filter(item => item === 'favorite-ui-v237.js').length, 1);
  assert.ok(required.includes('favorite-ui-v237.js'));
  assert.ok(!scripts.includes('user-ux-polish-v208.js'));
  assert.ok(!required.includes('user-ux-polish-v208.js'));
  assert.ok(fs.existsSync(path.join(ROOT, 'user-ux-polish-v208.js')),
    'legacy sidecar must remain physically available for cached manifests/rollback');

  assert.equal(scripts.filter(item => item === 'task-ux-v239.js').length, 1);
  assert.ok(required.includes('task-ux-v239.js'));
  assert.ok(!scripts.includes('task-ux-v146.js'));
  assert.ok(!required.includes('task-ux-v146.js'));
  assert.ok(fs.existsSync(path.join(ROOT, 'task-ux-v146.js')),
    'Ver.237 task UX source must remain physically available for cached manifests/rollback');

  assert.match(favorite, /function retireRemovedControls\(\)/);
  assert.match(favorite, /function patchFavoriteLabels\(/);
  assert.match(favorite, /function patchFavoriteToast\(/);
  assert.match(favorite, /お気に入りに追加しました/);
  assert.doesNotMatch(favorite, /DISCARD_MESSAGE|confirmTaskDiscard|document\.addEventListener\('cancel'/);

  assert.match(taskUx, /const DISCARD_MESSAGE = '入力内容が変更されています。保存せずに閉じますか？'/);
  assert.match(taskUx, /event\.isTrusted/);
  assert.match(taskUx, /closest\?\.\('#closeTaskDialog'\)/);
  assert.match(taskUx, /document\.addEventListener\('cancel'/);
  assert.match(taskUx, /document\.addEventListener\('close'/);
  assert.match(taskUx, /preferred\.click\(\)/);

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
