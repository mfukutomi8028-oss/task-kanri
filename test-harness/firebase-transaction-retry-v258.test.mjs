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

// Ver.505: preserve the original Ver.255 Firebase retry Protocol tests verbatim.
{
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function asyncFunctionBlock(source, name, nextName) {
  const start = source.indexOf(`async function ${name}`);
  const end = source.indexOf(`\n  function ${nextName}`, start);
  assert.ok(start >= 0 && end > start, `${name} block must exist`);
  return source.slice(start, end);
}

test('Ver.252 Firebase module retry hardening remains published in later releases', () => {
  const match = read('release-manifest.js').match(/const VERSION = '(\d+)'/);
  assert.ok(match && Number(match[1]) >= 252);
});
test('Firebase loader changes only the retry module specifier after an import failure', () => {
  const source = read('comment-reactions-v191.js');
  const block = asyncFunctionBlock(source, 'firebase', 'showMessage');
  assert.match(source, /let firebaseImportRetry = 0/);
  assert.match(block, /const importRetry = firebaseImportRetry/);
  assert.match(block, /retrySuffix = importRetry > 0/);
  assert.match(block, /firebase-app\.js\$\{retrySuffix\}/);
  assert.match(block, /firebase-database\.js\$\{retrySuffix\}/);
  assert.match(block, /firebaseImportRetry === importRetry/);
  assert.match(block, /firebaseImportRetry \+= 1/);
  assert.match(block, /if \(firebasePromise === pending\) firebasePromise = null/);
});
test('reaction import failure is contained by catch/finally without optimistic cache mutation before Firebase resolves', () => {
  const source = read('comment-reactions-v191.js');
  const toggle = asyncFunctionBlock(source, 'toggleReaction', 'openReply');
  const firebaseAwait = toggle.indexOf('const api = await firebase()');
  const firstCacheWrite = toggle.indexOf('writeCachedTask(taskId, saved)');
  const catchIndex = toggle.indexOf('} catch (error) {');
  const finallyIndex = toggle.indexOf('} finally {');
  const busyClear = toggle.indexOf('busy.delete(operation)');
  const enableButtons = toggle.indexOf('button.disabled = false');

  assert.ok(firebaseAwait >= 0, 'reaction writer must await Firebase module initialization');
  assert.ok(firstCacheWrite > firebaseAwait, 'local cache must not mutate before Firebase resolves and transaction returns');
  assert.ok(catchIndex > firebaseAwait && finallyIndex > catchIndex,
    'Firebase initialization failure must flow through writer catch/finally');
  assert.ok(busyClear > finallyIndex && enableButtons > busyClear,
    'failed writer must clear busy state and re-enable reaction controls');
});
}


// Ver.505: preserve the original Ver.256 Firebase retry Protocol tests verbatim.
{
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

test('Ver.256 audit remains valid in Ver.252 or later product releases', () => {
  const match = read('release-manifest.js').match(/const VERSION = '(\d+)'/);
  assert.ok(match && Number(match[1]) >= 252);
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
}


// Ver.505: preserve the original Ver.257 Firebase retry Protocol tests verbatim.
{
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

test('Ver.257 audit remains valid in Ver.252 or later product releases', () => {
  const match = read('release-manifest.js').match(/const VERSION = '(\d+)'/);
  assert.ok(match && Number(match[1]) >= 252);
});

test('retry generation advances only when module import itself fails', () => {
  const block = asyncBlock(read('comment-reactions-v191.js'), 'firebase', 'showMessage');
  const importCatch = block.indexOf('} catch (error) {\n        if (firebaseImportRetry === importRetry) firebaseImportRetry += 1');
  const initializeApp = block.indexOf('appModule.initializeApp(window.firebaseConfig)');
  const getDatabase = block.indexOf('databaseModule.getDatabase(app)');
  assert.ok(importCatch >= 0 && initializeApp > importCatch && getDatabase > initializeApp,
    'initializeApp/getDatabase must stay outside the import-failure generation catch');
  const afterInitialize = block.slice(initializeApp);
  assert.doesNotMatch(afterInitialize, /firebaseImportRetry\s*\+=\s*1/);
});

test('initialization failure releases only the shared pending promise for same-module retry', () => {
  const block = asyncBlock(read('comment-reactions-v191.js'), 'firebase', 'showMessage');
  assert.match(block, /if \(firebasePromise === pending\) firebasePromise = null/);
  assert.match(block, /const retrySuffix = importRetry > 0 \? `\?wb-retry=\$\{importRetry\}` : ""/);
});
}

test('Ver.505 retired Ver.255-257 Firebase retry Protocol suites stay absent', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'test-harness', 'firebase-module-retry-v255.test.mjs')), false,
    'retired Firebase retry Protocol must not reappear: firebase-module-retry-v255.test.mjs');
  assert.equal(fs.existsSync(path.join(ROOT, 'test-harness', 'firebase-singleflight-v256.test.mjs')), false,
    'retired Firebase retry Protocol must not reappear: firebase-singleflight-v256.test.mjs');
  assert.equal(fs.existsSync(path.join(ROOT, 'test-harness', 'firebase-init-retry-v257.test.mjs')), false,
    'retired Firebase retry Protocol must not reappear: firebase-init-retry-v257.test.mjs');
});
