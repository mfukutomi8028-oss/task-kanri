import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function asyncBlock(source, name, nextName) {
  const start = source.indexOf(`async function ${name}`);
  const end = source.indexOf(`\n  function ${nextName}`, start);
  assert.ok(start >= 0 && end > start, `${name} block must exist`);
  return source.slice(start, end);
}

test('Ver.256 audit keeps the formal product release at Ver.252', () => {
  assert.match(read('release-manifest.js'), /const VERSION = '252'/);
});

test('Firebase helper owns one shared pending promise before awaiting retry imports', () => {
  const source = read('comment-reactions-v191.js');
  const block = asyncBlock(source, 'firebase', 'showMessage');
  const reuse = block.indexOf('if (firebasePromise) return firebasePromise');
  const retry = block.indexOf('const importRetry = firebaseImportRetry');
  const pending = block.indexOf('const pending = (async () =>');
  const publish = block.indexOf('firebasePromise = pending');
  const awaitPending = block.indexOf('return await pending');
  assert.ok(reuse >= 0 && retry > reuse && pending > retry && publish > pending && awaitPending > publish,
    'shared firebasePromise must be published before callers await the retry-generation imports');
});

test('only the owner of a failed import generation advances retry and clears its pending promise', () => {
  const source = read('comment-reactions-v191.js');
  const block = asyncBlock(source, 'firebase', 'showMessage');
  assert.match(block, /if \(firebaseImportRetry === importRetry\) firebaseImportRetry \+= 1/);
  assert.match(block, /if \(firebasePromise === pending\) firebasePromise = null/);
  assert.doesNotMatch(block, /firebasePromise = null[\s\S]*firebaseImportRetry \+= 1[\s\S]*firebaseImportRetry \+= 1/);
});

test('reaction and reply writers both acquire Firebase only through the shared helper', () => {
  const source = read('comment-reactions-v191.js');
  const reaction = asyncBlock(source, 'toggleReaction', 'openReply');
  const reply = asyncBlock(source, 'saveRemoteReply', 'handleReplySubmit');
  assert.equal((reaction.match(/await firebase\(\)/g) || []).length, 1);
  assert.equal((reply.match(/await firebase\(\)/g) || []).length, 1);
  assert.doesNotMatch(reaction, /initializeApp|getDatabase|firebase-app\.js|firebase-database\.js/);
  assert.doesNotMatch(reply, /initializeApp|getDatabase|firebase-app\.js|firebase-database\.js/);
});
