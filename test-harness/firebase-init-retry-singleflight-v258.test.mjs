import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function asyncBlock(source, name, nextName) {
  const start = source.indexOf(`async function ${name}`);
  const normalEnd = source.indexOf(`\n  function ${nextName}`, start);
  const asyncEnd = source.indexOf(`\n  async function ${nextName}`, start);
  const ends = [normalEnd, asyncEnd].filter(index => index > start);
  const end = ends.length ? Math.min(...ends) : -1;
  assert.ok(start >= 0 && end > start, `${name} block must exist`);
  return source.slice(start, end);
}

test('Ver.258 audit keeps the formal product release at Ver.252', () => {
  assert.match(read('release-manifest.js'), /const VERSION = '252'/);
});

test('post-init-failure retry still publishes one shared pending promise before module completion', () => {
  const block = asyncBlock(read('comment-reactions-v191.js'), 'firebase', 'showMessage');
  const reuse = block.indexOf('if (firebasePromise) return firebasePromise');
  const pending = block.indexOf('const pending = (async () =>');
  const publish = block.indexOf('firebasePromise = pending');
  const awaitPending = block.indexOf('return await pending');
  assert.ok(reuse >= 0 && pending > reuse && publish > pending && awaitPending > publish,
    'all retry callers must share the same pending firebase promise');
});

test('initialization failures do not advance the module retry generation', () => {
  const block = asyncBlock(read('comment-reactions-v191.js'), 'firebase', 'showMessage');
  const importAdvance = block.indexOf('if (firebaseImportRetry === importRetry) firebaseImportRetry += 1');
  const initialize = block.indexOf('appModule.initializeApp(window.firebaseConfig)');
  const getDb = block.indexOf('databaseModule.getDatabase(app)');
  assert.ok(importAdvance >= 0 && initialize > importAdvance && getDb > initialize);
  assert.doesNotMatch(block.slice(initialize), /firebaseImportRetry\s*\+=\s*1/);
});

test('reaction and reply continue to acquire Firebase through the same helper', () => {
  const source = read('comment-reactions-v191.js');
  const reaction = asyncBlock(source, 'toggleReaction', 'openReply');
  const reply = asyncBlock(source, 'saveRemoteReply', 'handleReplySubmit');
  assert.equal((reaction.match(/await firebase\(\)/g) || []).length, 1);
  assert.equal((reply.match(/await firebase\(\)/g) || []).length, 1);
});
