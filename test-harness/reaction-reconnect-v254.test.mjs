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

test('Ver.254 reconnect audit remains valid in Ver.251 or later product releases', () => {
  const match = read('release-manifest.js').match(/const VERSION = '(\d+)'/);
  assert.ok(match && Number(match[1]) >= 251);
});

test('reaction writer blocks non-online states before busy state and Firebase work', () => {
  const comments = read('comment-reactions-v191.js');
  const toggle = functionBlock(comments, 'toggleReaction', 'openReply');
  const onlineGuard = toggle.indexOf('if (!isRemoteOnline())');
  const busyAdd = toggle.indexOf('busy.add(operation)');
  const firebaseCall = toggle.indexOf('const api = await firebase()');
  assert.ok(onlineGuard >= 0 && busyAdd > onlineGuard && firebaseCall > busyAdd,
    'non-online guard must stop before writer busy state and Firebase work');
});

test('reconnect stale expected state aborts before mutation and restores transaction snapshot', () => {
  const comments = read('comment-reactions-v191.js');
  const toggle = functionBlock(comments, 'toggleReaction', 'openReply');
  const expectedCheck = toggle.indexOf('if (currentPressed !== expectedPressed)');
  const intendedAdd = toggle.indexOf('if (intendedPressed) users.push(user)');
  const restoreSnapshot = toggle.indexOf('writeCachedTask(taskId, saved)');
  assert.ok(expectedCheck >= 0 && intendedAdd > expectedCheck,
    'server membership must be compared with rendered expected state before add/remove mutation');
  assert.ok(restoreSnapshot > intendedAdd,
    'aborted transaction snapshot must be available for local cache convergence');
  assert.match(toggle, /if \(!result\.committed\) \{[\s\S]*writeCachedTask\(taskId, saved\)[\s\S]*if \(conflict\)/);
});

test('reaction notification remains post-commit only', () => {
  const comments = read('comment-reactions-v191.js');
  const toggle = functionBlock(comments, 'toggleReaction', 'openReply');
  const committedBranch = toggle.indexOf('if (!result.committed)');
  const notification = toggle.indexOf('await deliverPersonal');
  assert.ok(committedBranch >= 0 && notification > committedBranch,
    'conflict/no-op paths must not emit reaction notifications');
});

// Ver.500: Ver.253's five original test bodies remain verbatim; their shared helper is deduplicated.
test('Ver.251 reaction connection-boundary hardening remains published in later releases', () => {
  const manifest = read('release-manifest.js');
  const sourceVersion = manifest.match(/const VERSION = '(\d+)'/);
  const releaseVersion = manifest.match(/version:\s*"(\d+)"/);
  assert.ok(sourceVersion && Number(sourceVersion[1]) >= 251);
  assert.ok(releaseVersion && Number(releaseVersion[1]) >= 251);
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

test('Ver.500 retired Ver.253 offline reaction Protocol stays absent', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'test-harness/comment-reaction-offline-v253.test.mjs')), false);
});
