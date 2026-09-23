import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function block(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.ok(start >= 0 && end > start, `${startToken} block must exist`);
  return source.slice(start, end);
}

test('Ver.258 audit remains valid in Ver.252 or later product releases', () => {
  const match = read('release-manifest.js').match(/const VERSION = '(\d+)'/);
  assert.ok(match && Number(match[1]) >= 252);
});

test('a transaction rejection cannot clear the already-resolved Firebase helper cache', () => {
  const source = read('comment-reactions-v191.js');
  const firebase = block(source, 'async function firebase()', '\n  function showMessage');
  assert.match(firebase, /if \(firebasePromise\) return firebasePromise/);
  assert.match(firebase, /if \(firebasePromise === pending\) firebasePromise = null/);
  const reaction = block(source, 'async function toggleReaction', '\n  function openReply');
  assert.match(reaction, /const api = await firebase\(\)/);
  assert.match(reaction, /await api\.runTransaction/);
  assert.doesNotMatch(reaction, /firebasePromise\s*=\s*null/);
});

test('reaction transaction failure stays non-optimistic and always releases the operation busy state', () => {
  const source = read('comment-reactions-v191.js');
  const reaction = block(source, 'async function toggleReaction', '\n  function openReply');
  const acquire = reaction.indexOf('const api = await firebase()');
  const transaction = reaction.indexOf('await api.runTransaction');
  const cacheWrite = reaction.indexOf('writeCachedTask(taskId, saved)');
  const finallyIndex = reaction.indexOf('} finally {');
  assert.ok(acquire >= 0 && transaction > acquire && cacheWrite > transaction && finallyIndex > transaction);
  assert.match(reaction.slice(finallyIndex), /busy\.delete\(operation\)/);
  assert.doesNotMatch(reaction.slice(0, transaction), /writeCachedTask\(/);
});

test('reply transaction failure preserves draft and reply target until a committed retry succeeds', () => {
  const source = read('comment-reactions-v191.js');
  const submit = block(source, 'async function handleReplySubmit', '\n  function closePickers');
  const save = submit.indexOf('await saveRemoteReply');
  const clear = submit.indexOf("textarea.value = ''");
  const cancel = submit.indexOf('cancelReply()', save);
  const catchIndex = submit.indexOf('} catch (error) {');
  assert.ok(save >= 0 && clear > save && cancel > save && catchIndex > cancel,
    'reply draft and reply target must clear only after saveRemoteReply succeeds');
  const catchBody = submit.slice(catchIndex);
  assert.doesNotMatch(catchBody, /textarea\.value\s*=\s*''/);
  assert.doesNotMatch(catchBody, /cancelReply\(\)/);
  assert.match(catchBody, /if \(submit\) submit\.disabled = false/);
});
