import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function asyncFunctionBlock(source, name, nextName) {
  const start = source.indexOf(`async function ${name}`);
  const end = source.indexOf(`\n  function ${nextName}`, start);
  assert.ok(start >= 0 && end > start, `${name} block must exist`);
  return source.slice(start, end);
}

test('Ver.255 audit keeps the formal product release at Ver.251', () => {
  assert.match(read('release-manifest.js'), /const VERSION = '251'/);
});

test('Firebase module loader clears only its own rejected cached promise before rethrowing', () => {
  const source = read('comment-reactions-v191.js');
  const block = asyncFunctionBlock(source, 'firebase', 'showMessage');
  assert.match(block, /if \(firebasePromise\) return firebasePromise/);
  assert.match(block, /const pending = \(async \(\) => \{/);
  assert.match(block, /firebasePromise = pending/);
  assert.match(block, /catch \(error\) \{[\s\S]*if \(firebasePromise === pending\) firebasePromise = null;[\s\S]*throw error;/);
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
