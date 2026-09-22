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

test('Ver.254 audit keeps the formal product release at Ver.251', () => {
  const manifest = read('release-manifest.js');
  assert.match(manifest, /const VERSION = '(?:251|252)'/);
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
