import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Ver.249 audit keeps the product release at Ver.248', () => {
  const manifest = read('release-manifest.js');
  assert.match(manifest, /const VERSION = '248'/);
  assert.match(manifest, /version:\s*"248"/);
  assert.doesNotMatch(manifest, /version:\s*"249"/);
});

test('user registration serializes shared meta additions in one server transaction', () => {
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
  assert.doesNotMatch(source, /runTransaction|firebaseConfig|firebasedatabase|rooms\/\$\{|\.set\(|\.update\(|\.remove\(/,
    'mention picker must only select users and edit the local comment textarea');
});

test('current reaction writer is a server-current toggle without a rendered expected base', () => {
  const source = read('comment-reactions-v191.js');

  assert.match(source, /async function toggleReaction\(taskId, commentIdValue, emoji\)/);
  assert.match(source, /runTransaction\(target, current =>/);
  assert.match(source, /const found = users\.indexOf\(user\);\s*if \(found >= 0\) users\.splice\(found, 1\);\s*else users\.push\(user\);/,
    'the current writer decides add/remove from server current state');
  assert.match(source, /revision: revision \+ 1/);
  assert.doesNotMatch(source, /toggleReaction\([^)]*expected|expectedReaction|expectedPressed|intendedState/,
    'the click does not pass the rendered reaction state as an expected base or explicit intent');
});

test('reaction notification id is revision-scoped after the toggle commits', () => {
  const source = read('comment-reactions-v191.js');

  assert.match(source, /const added = normalizeReactionUsers\(savedComment\?\.reactions\?\.\[emoji\]\)\.includes\(user\)/);
  assert.match(source, /cleanEventId\("reaction", taskId, commentIdValue, emoji, user, Number\(saved\.revision \|\| 0\)\)/,
    'notification identity must remain tied to the committed task revision');
  assert.match(source, /if \(added\) \{/,
    'only a committed add path should emit the writer-side reaction notification');
});
