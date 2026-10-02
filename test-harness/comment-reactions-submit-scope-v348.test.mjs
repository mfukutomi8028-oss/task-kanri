import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Ver.349 product keeps comment-reactions submit delegation scoped to fixed detail root', () => {
  const source = read('comment-reactions-v191.js');
  assert.match(source, /function\s+bindGlobalEvents\s*\(root\)/);
  assert.match(source, /root\.addEventListener\(\s*['"]submit['"]\s*,/);
  assert.doesNotMatch(source, /document\.addEventListener\(\s*['"]submit['"]\s*,/);
  assert.match(source, /document\.addEventListener\(["']click["']/);
  assert.match(source, /root\.addEventListener\(['"]keydown['"]/);
  assert.match(source, /const\s+root\s*=\s*document\.getElementById\(["']detailBody["']\)/);
  assert.match(source, /\.observe\(root,\s*\{\s*childList:\s*true,\s*subtree:\s*true\s*\}\)/);
  assert.match(source, /bindGlobalEvents\(root\)/);
});

test('Ver.349 product preserves reply submit capture semantics and canonical handoff', () => {
  const source = read('comment-reactions-v191.js');
  const start = source.indexOf("root.addEventListener('submit'");
  const end = source.indexOf('document.addEventListener("click"', start);
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

test('Ver.349 product advances release and responsibility baseline to 290', () => {
  const manifest = read('release-manifest.js');
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const release = manifest.match(/version:\s*["'](\d+)["']/)?.[1];
  assert.equal(release, '290');
  assert.equal(String(responsibilities.baselineRelease), '290');
  assert.match(manifest, /installFirstPaintGuardV290/);
  assert.match(manifest, /const\s+VERSION\s*=\s*['"]290['"]/);
  assert.match(manifest, /wb-first-paint-v290/);
  assert.match(manifest, /__WB_LEGACY_ICON_OBSERVER_V290__/);
});

test('Ver.349 product records the next click-scope audit without changing it yet', () => {
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const candidate = responsibilities.priorityCandidates?.[0];
  assert.deepEqual(candidate?.scope, ['comment-reactions-v191.js']);
  assert.match(String(candidate?.goal || ''), /Ver\.350/);
  assert.match(String(candidate?.goal || ''), /click scope監査/);

  const source = read('comment-reactions-v191.js');
  assert.match(source, /document\.addEventListener\(["']click["']/);
});
