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

test('Ver.253 audit keeps the formal product release at Ver.250', () => {
  const manifest = read('release-manifest.js');
  assert.match(manifest, /const VERSION = '250'/);
});

test('reaction writer currently enters Firebase without checking the shared connection state', () => {
  const comments = read('comment-reactions-v191.js');
  const toggle = functionBlock(comments, 'toggleReaction', 'openReply');
  assert.match(toggle, /const api = await firebase\(\)/);
  assert.doesNotMatch(toggle, /isRemoteOnline\(\)/,
    'audit reproducer: reaction writer has no writable-mode guard before Firebase');
});

test('reaction click delegates directly to toggleReaction while reply submit has an explicit non-online guard', () => {
  const comments = read('comment-reactions-v191.js');
  assert.match(comments, /if \(!isRemoteOnline\(\)\) \{[\s\S]*返信内容は保持しています/,
    'reply boundary already protects non-online submissions');
  assert.match(comments, /const reactionButton = event\.target\.closest\("\[data-comment-reaction-id\]\[data-comment-reaction-emoji\]\"\)[\s\S]*toggleReaction\(/,
    'reaction action currently invokes the remote writer directly');
});

test('failed reaction attempts have no optimistic local mutation path before Firebase succeeds', () => {
  const comments = read('comment-reactions-v191.js');
  const toggle = functionBlock(comments, 'toggleReaction', 'openReply');
  const firebaseCall = toggle.indexOf('const api = await firebase()');
  const cacheWrite = toggle.indexOf('writeCachedTask(taskId, saved)');
  assert.ok(firebaseCall >= 0 && cacheWrite > firebaseCall,
    'cache is updated only from a transaction result, so a pre-write failure cannot create a ghost reaction');
  assert.doesNotMatch(toggle.slice(0, firebaseCall), /writeCachedTask|localStorage\.setItem/);
});
