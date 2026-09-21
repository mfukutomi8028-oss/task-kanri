import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const interaction = read('comment-reactions-v191.js');
const manifest = read('release-manifest.js');

test('Ver.251 audit keeps product runtime at Ver.249 and reply writes on the canonical task transaction', () => {
  assert.match(manifest, /VERSION\s*=\s*['"](?:249|250)['"]/);
  assert.match(interaction, /async function saveRemoteReply\(taskId, parentId, text, type\)/);
  assert.match(interaction, /const target = api\.ref\(api\.db, `rooms\/\$\{roomId\(\)\}\/tasks\/\$\{taskId\}`\)/);
  assert.match(interaction, /api\.runTransaction\(target, current => \{/);
});

test('reply transaction revalidates the parent against server current before appending', () => {
  assert.match(interaction, /if \(!current \|\| !Array\.isArray\(current\.comments\)\) \{ missing = true; return; \}/);
  assert.match(interaction, /if \(!current\.comments\.some\(comment => String\(comment\?\.id \|\| ''\) === parentId\)\) \{ missing = true; return; \}/);
  assert.match(interaction, /const comments = current\.comments\.map\(comment => comment && typeof comment === 'object' \? \{ \.\.\.comment \} : comment\)/);
  assert.match(interaction, /comments\.push\(\{ id: replyId, author: user, type: replyType, text, createdAt, replyTo: parentId \}\)/);
});

test('reply transaction appends history from server current and increments revision once without task-wide update metadata churn', () => {
  assert.match(interaction, /const history = \[\.\.\.\(Array\.isArray\(current\.history\) \? current\.history : \[\]\), \{/);
  assert.match(interaction, /id: historyId,[\s\S]*text: `\$\{replyType\}を追加しました。`,[\s\S]*createdAt/);
  assert.match(interaction, /return \{ \.\.\.current, comments, history, revision: revision \+ 1 \};/);
  assert.doesNotMatch(interaction.match(/async function saveRemoteReply[\s\S]*?\n  \}/)?.[0] || '', /updatedAt\s*:/,
    'directed replies must not become room-wide task update metadata');
});

test('reply notification is emitted only after a committed snapshot and uses the committed parent author', () => {
  assert.match(interaction, /if \(!result\.committed \|\| missing\) throw new Error\('reply-conflict'\)/);
  assert.match(interaction, /const saved = result\.snapshot\?\.val\(\) \|\| \{\};/);
  assert.match(interaction, /const parent = \(Array\.isArray\(saved\.comments\) \? saved\.comments : \[\]\)\.find\(comment => String\(comment\?\.id \|\| ''\) === parentId\)/);
  assert.match(interaction, /await deliverPersonal\(recipient, cleanEventId\('reply', taskId, replyId, recipient\), \{/);
});
