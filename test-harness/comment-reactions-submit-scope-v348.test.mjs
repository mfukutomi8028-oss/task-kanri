import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function candidateSource() {
  const source = read('comment-reactions-v191.js');
  return source.replace(
    /document\.addEventListener\(\s*['"]submit['"]\s*,/,
    "root.addEventListener('submit',"
  );
}

test('Ver.348 audit isolates the remaining comment-reactions document submit candidate', () => {
  const source = read('comment-reactions-v191.js');
  assert.match(source, /function\s+bindGlobalEvents\s*\(root\)/);
  assert.match(source, /document\.addEventListener\(\s*['"]submit['"]\s*,/);
  assert.match(source, /document\.addEventListener\(["']click["']/);
  assert.match(source, /root\.addEventListener\(['"]keydown['"]/);
  assert.match(source, /const\s+root\s*=\s*document\.getElementById\(["']detailBody["']\)/);
  assert.match(source, /\.observe\(root,\s*\{\s*childList:\s*true,\s*subtree:\s*true\s*\}\)/);
});

test('Ver.348 audit candidate moves only submit capture delegation to fixed detail root', () => {
  const source = read('comment-reactions-v191.js');
  const candidate = candidateSource();
  assert.notEqual(candidate, source);
  assert.match(candidate, /root\.addEventListener\(\s*['"]submit['"]\s*,/);
  assert.doesNotMatch(candidate, /document\.addEventListener\(\s*['"]submit['"]\s*,/);
  assert.match(candidate, /root\.addEventListener\(['"]keydown['"]/);
  assert.match(candidate, /document\.addEventListener\(["']click["']/);

  const start = candidate.indexOf("root.addEventListener('submit'");
  const end = candidate.indexOf('document.addEventListener("click"', start);
  assert.ok(start >= 0 && end > start);
  const block = candidate.slice(start, end);
  assert.match(block, /event\.target\.closest\?\.\('#detailBody \.comment-form, #detailBody #commentForm'\)/);
  assert.match(block, /if\s*\(!form\s*\|\|\s*!replyTarget\)\s*return/);
  assert.match(block, /handleReplySubmit\(form,\s*event\)/);
  assert.match(block, /\},\s*true\);\s*$/);
});

test('Ver.348 audit preserves ordinary, local-only, degraded and requestSubmit semantics', () => {
  const source = candidateSource();
  assert.match(source, /if\s*\(!isRemoteOnline\(\)\)/);
  assert.match(source, /if\s*\(window\.firebaseConfig\)/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /event\.stopImmediatePropagation\(\)/);
  assert.match(source, /返信内容は保持しています/);
  assert.match(source, /textarea\.dataset\.commentReplyTargetV250\s*=\s*replyTarget\.commentId/);
  assert.match(source, /return false/);
  assert.match(source, /textarea\.closest\('form'\)\?\.requestSubmit\(\)/);
  assert.match(source, /bindGlobalEvents\(root\)/);
});

test('Ver.348 audit keeps release 289 and responsibility candidate unchanged', () => {
  const manifest = read('release-manifest.js');
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const release = manifest.match(/version:\s*["'](\d+)["']/)?.[1];
  assert.equal(release, '289');
  assert.equal(String(responsibilities.baselineRelease), '289');
  const candidate = responsibilities.priorityCandidates?.[0];
  assert.deepEqual(candidate?.scope, ['comment-reactions-v191.js']);
  assert.match(String(candidate?.goal || ''), /Ver\.348/);
  assert.match(String(candidate?.goal || ''), /submit scope監査/);
});
