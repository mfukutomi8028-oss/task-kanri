import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Ver.349 submit delegation remains scoped to fixed detail root after later click lifecycle cleanup', () => {
  const source = read('comment-reactions-v191.js');
  assert.match(source, /function\s+bindGlobalEvents\s*\(root\)/);
  assert.match(source, /root\.addEventListener\(\s*['"]submit['"]\s*,/);
  assert.doesNotMatch(source, /document\.addEventListener\(\s*['"]submit['"]\s*,/);
  assert.match(source, /root\.addEventListener\(\s*["']click["']\s*,\s*event\s*=>/);
  assert.match(source, /document\.addEventListener\(\s*["']click["']\s*,\s*handlePickerOutsideClick\s*,\s*true\s*\)/);
  assert.match(source, /root\.addEventListener\(['"]keydown['"]/);
  assert.match(source, /const\s+root\s*=\s*document\.getElementById\(["']detailBody["']\)/);
  assert.match(source, /\.observe\(root,\s*\{\s*childList:\s*true,\s*subtree:\s*true\s*\}\)/);
  assert.match(source, /bindGlobalEvents\(root\)/);
});

test('Ver.349 reply submit capture semantics and canonical handoff remain intact', () => {
  const source = read('comment-reactions-v191.js');
  const start = source.indexOf("root.addEventListener('submit'");
  const end = source.indexOf('root.addEventListener("click"', start);
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);
  assert.match(block, /event\.target\.closest\?\.\('#detailBody \.comment-form, #detailBody #commentForm'\)/);
  assert.match(block, /if\s*\(!form\s*\|\|\s*!replyTarget\)\s*return/);
  assert.match(block, /handleReplySubmit\(form,\s*event\)/);
  assert.match(block, /\},\s*true\);\s*$/);

  assert.match(source, /if\s*\(!isRemoteOnline\(\)\)/);
  assert.match(source, /if\s*\(window\.firebaseConfig\)/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /event\.stopImmediatePropagation\(\)/);
  assert.match(source, /返信内容は保持しています/);
  assert.match(source, /textarea\.dataset\.commentReplyTargetV250\s*=\s*replyTarget\.commentId/);
  assert.match(source, /textarea\.closest\('form'\)\?\.requestSubmit\(\)/);
});

test('Ver.349 release-290 product history remains durable in later aligned releases', () => {
  const manifest = read('release-manifest.js');
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);
  assert.ok(release >= 290);
  assert.equal(Number(responsibilities.baselineRelease), release);

  const group = responsibilities.groups.find(item => item.id === 'user-and-comments');
  const reason = String(group?.reason || '');
  assert.match(reason, /Ver\.349製品/);
  assert.match(reason, /document submit ownershipを撤去/);
  assert.match(reason, /release 290へ更新/);
});

test('Ver.349 handoff history survives while the current candidate advances to Ver.353', () => {
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const group = responsibilities.groups.find(item => item.id === 'user-and-comments');
  const reason = String(group?.reason || '');
  assert.match(reason, /Ver\.350監査/);
  assert.match(reason, /Ver\.351監査/);
  assert.match(reason, /Ver\.352製品/);

  const candidate = responsibilities.priorityCandidates?.[0];
  assert.deepEqual(candidate?.scope, ['comment-reactions-v191.js']);
  assert.match(String(candidate?.goal || ''), /Ver\.353/);
  assert.match(String(candidate?.goal || ''), /MutationObserver semantic filter監査/);

  const source = read('comment-reactions-v191.js');
  assert.match(source, /root\.addEventListener\(\s*["']click["']\s*,\s*event\s*=>/);
  assert.doesNotMatch(source, /document\.addEventListener\(\s*["']click["']\s*,\s*event\s*=>/);
});
