import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Ver.236 audit keeps user-ux-polish active because current canonical sources still expose legacy favorite UI and unguarded close paths', () => {
  const manifest = read('release-manifest.js');
  const index = read('index.html');
  const app = read('app.js');
  const polish = read('user-ux-polish-v208.js');
  const taskUx = read('task-ux-v146.js');

  const release = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);
  assert.ok(release >= 235);
  assert.equal((manifest.match(/"user-ux-polish-v208\.js"/g) || []).length, 2);

  assert.match(index, /data-filter="favorite"[^>]*>[\s\S]*?スター<\/button>/);
  assert.match(index, /id="favoriteOnly"[^>]*\/>スターのみ/);
  assert.match(index, /id="roomCacheHelp"/);
  assert.match(index, /id="clearRoomCache"/);

  assert.match(app, /title="\$\{starred \? "スターを外す" : "スターを付ける"\}"/);
  assert.match(app, /toast\(starred \? "スターを外しました" : "スターを付けました"\)/);
  assert.match(app, /detail-favorite-button[\s\S]*?スター解除[\s\S]*?スター/);
  assert.match(app, /closeTaskDialog\.addEventListener\("click", \(\) => \{ clearTaskDialogContexts\(\); elements\.taskDialog\.close\(\); \}\)/);

  assert.match(polish, /const DISCARD_MESSAGE = '入力内容が変更されています。保存せずに閉じますか？'/);
  assert.match(polish, /function hideRemovedUi\(\)/);
  assert.match(polish, /function patchFavoriteLabels\(/);
  assert.match(polish, /function patchFavoriteToast\(/);
  assert.match(polish, /new MutationObserver/);
  assert.match(polish, /event\.target === dialog && isOutsideDialogClick/);
  assert.match(polish, /document\.addEventListener\('cancel'/);

  assert.match(taskUx, /#closeTaskDialog/);
  assert.match(taskUx, /preferred\.click\(\)/);
});

test('Ver.236 audit assigns inbox read state and quick pin to their current feature owners, not user-ux-polish', () => {
  const polish = read('user-ux-polish-v208.js');
  const inbox = read('inbox-ui-v183.js');
  const detail = read('detail-layout-v154.js');

  assert.doesNotMatch(polish, /markInboxRead|markAllInboxRead|data-inbox-read-v153/);
  assert.doesNotMatch(polish, /data-quick-pin-v154|quickPinV154/);

  assert.match(inbox, /W\.markInboxRead\(id,!Boolean\(item\.readAt\)\)/);
  assert.match(inbox, /data-inbox-read-v153/);
  assert.match(inbox, /data-inbox-category-v235/);

  assert.match(detail, /data-quick-pin-v154/);
  assert.match(detail, /button\.textContent=pinned\?'固定解除':'固定'/);
  assert.match(detail, /async function togglePin/);
});
