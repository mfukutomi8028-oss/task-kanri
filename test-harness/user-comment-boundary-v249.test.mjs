import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Ver.249 product publishes release Ver.249', () => {
  const manifest = read('release-manifest.js');
  assert.match(manifest, /const VERSION = '249'/);
  assert.match(manifest, /version:\s*"249"/);
  assert.doesNotMatch(manifest, /const VERSION = '248'/);
});

test('user registration keeps the proven shared-meta transaction boundary', () => {
  const source = read('user-registration-v191.js');

  assert.match(source, /rooms\/\$\{roomId\(\)\}\/meta/);
  assert.match(source, /runTransaction\(metaRef,current=>/);
  assert.match(source, /const users=Array\.isArray\(meta\.users\)\?\[\.\.\.meta\.users\]/,
    'each transaction retry must derive the user list from the latest server meta');
  assert.match(source, /if\(hasUser\(users,name\)\)\{duplicate=true;return\}/,
    'same-name additions must abort inside the transaction');
  assert.match(source, /for\(const field of \['users','userColors','usersUpdatedAt'\]\)revisions\[field\]=Number\(revisions\[field\]\|\|0\)\+1/,
    'all three user meta revisions must advance atomically');
});

test('mention picker remains presentation-only and owns no shared Firebase write', () => {
  const source = read('comment-mentions-v191.js');

  assert.match(source, /W\.users\?\.\(\)/);
  assert.match(source, /textarea\.value=textarea\.value\.slice/);
  assert.doesNotMatch(source, /runTransaction|firebaseConfig|firebasedatabase|rooms\/\$\{|ensureRemote|\.ref\(/,
    'mention picker must only select users and edit the local comment textarea');
});

test('Ver.249 reaction UI carries the rendered current-user state into every reaction action', () => {
  const source = read('comment-reactions-v191.js');

  assert.match(source, /button\.dataset\.commentReactionExpectedPressed = pressed \? "true" : "false"/,
    'chips and picker choices must retain the state the user actually saw');
  assert.match(source, /function createPicker\(commentIdValue, map, user\)/);
  assert.match(source, /const picker = createPicker\(id, map, user\)/);
  assert.match(source, /const expectedValue = reactionButton\.dataset\.commentReactionExpectedPressed/);
  assert.match(source, /toggleReaction\(taskId, reactionButton\.dataset\.commentReactionId, reactionButton\.dataset\.commentReactionEmoji, expectedValue === "true"\)/);
});

test('Ver.249 reaction writer commits only when server current matches the rendered expected base', () => {
  const source = read('comment-reactions-v191.js');

  assert.match(source, /async function toggleReaction\(taskId, commentIdValue, emoji, expectedPressed\)/);
  assert.match(source, /const intendedPressed = !expectedPressed/);
  assert.match(source, /const currentPressed = users\.includes\(user\)/);
  assert.match(source, /if \(currentPressed !== expectedPressed\) \{ conflict = true; return; \}/,
    'same-user remote reaction changes must abort the stale toggle');
  assert.match(source, /if \(!result\.committed\) \{/);
  assert.match(source, /writeCachedTask\(taskId, saved\)/,
    'aborted transactions must restore the remote winner to the local cache');
  assert.match(source, /別の端末でリアクションが更新されています。最新の状態を反映しました。/);
  assert.match(source, /revision: revision \+ 1/,
    'fresh operations must keep the existing revision increment contract');
});

test('Ver.249 reaction notification remains revision-scoped and only follows a committed add intent', () => {
  const source = read('comment-reactions-v191.js');

  assert.match(source, /const added = normalizeReactionUsers\(savedComment\?\.reactions\?\.\[emoji\]\)\.includes\(user\)/);
  assert.match(source, /cleanEventId\("reaction", taskId, commentIdValue, emoji, user, Number\(saved\.revision \|\| 0\)\)/,
    'notification identity must remain tied to the committed task revision');
  assert.match(source, /if \(intendedPressed && added\) \{/,
    'remove intent and stale conflict paths must not generate an add notification');
});

test('Ver.249 inventory records the hardened user/comment boundary and the next audit target', () => {
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  const group = inventory.groups?.find(item => item.id === 'user-and-comments');
  const next = inventory.priorityCandidates?.find(item => item.order === 1);

  assert.equal(inventory.baselineRelease, '249');
  assert.equal(group?.consolidation, 'extended-v215');
  assert.match(group?.reason || '', /Ver\.249製品/);
  assert.match(group?.reason || '', /expected base/);
  assert.ok(next);
  assert.match(next.goal || '', /Ver\.250監査/);
  assert.match(next.precondition || '', /Ver\.249製品/);
});
