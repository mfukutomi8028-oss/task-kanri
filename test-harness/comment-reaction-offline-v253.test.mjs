import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function functionBlock(source, name, nextName) {
  const start = source.indexOf(`async function ${name}`);
  const end = source.indexOf(`\n  function ${nextName}`, start);
  assert.ok(start >= 0 && end > start, `${name} block must exist`);
  return source.slice(start, end);
}

test('Ver.251 product publishes the reaction connection-boundary hardening release', () => {
  const manifest = read('release-manifest.js');
  assert.match(manifest, /const VERSION = '251'/);
  assert.match(manifest, /version:\s*"251"/);
});

test('reaction writer blocks local-only and configured non-online states before entering Firebase', () => {
  const comments = read('comment-reactions-v191.js');
  const toggle = functionBlock(comments, 'toggleReaction', 'openReply');
  const localGuard = toggle.indexOf('if (!window.firebaseConfig)');
  const remoteGuard = toggle.indexOf('if (!isRemoteOnline())');
  const firebaseCall = toggle.indexOf('const api = await firebase()');
  assert.ok(localGuard >= 0 && remoteGuard > localGuard && firebaseCall > remoteGuard,
    'both writable-mode guards must run before Firebase initialization');
  assert.match(toggle, /リアクションは共同編集ONで利用できます/);
  assert.match(toggle, /共同データを保存できる状態ではありません。リアクションは変更していません/);
});

test('reaction click still delegates to toggleReaction while the writer owns the connection guard', () => {
  const comments = read('comment-reactions-v191.js');
  assert.match(comments, /const reactionButton = event\.target\.closest\("\[data-comment-reaction-id\]\[data-comment-reaction-emoji\]\"\)[\s\S]*toggleReaction\(/);
  assert.match(comments, /if \(!isRemoteOnline\(\)\) \{[\s\S]*リアクションは変更していません/);
});

test('blocked or failed reaction attempts have no optimistic local mutation path before Firebase succeeds', () => {
  const comments = read('comment-reactions-v191.js');
  const toggle = functionBlock(comments, 'toggleReaction', 'openReply');
  const firebaseCall = toggle.indexOf('const api = await firebase()');
  const cacheWrite = toggle.indexOf('writeCachedTask(taskId, saved)');
  assert.ok(firebaseCall >= 0 && cacheWrite > firebaseCall,
    'cache is updated only from a transaction result');
  assert.doesNotMatch(toggle.slice(0, firebaseCall), /writeCachedTask|localStorage\.setItem/);
});

test('Firebase module loader clears a rejected cached promise so a later online attempt can retry', () => {
  const comments = read('comment-reactions-v191.js');
  const loader = functionBlock(comments, 'firebase', 'showMessage');
  assert.match(loader, /if \(firebasePromise\) return firebasePromise/);
  assert.match(loader, /const pending = \(async \(\) => \{/);
  assert.match(loader, /firebasePromise = pending/);
  assert.match(loader, /catch \(error\) \{[\s\S]*if \(firebasePromise === pending\) firebasePromise = null;[\s\S]*throw error/);
});
