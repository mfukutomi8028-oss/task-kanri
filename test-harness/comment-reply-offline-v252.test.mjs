import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Ver.250 product publishes the offline reply hardening release', () => {
  const manifest = read('release-manifest.js');
  const release = Number(manifest.match(/const VERSION = '(\d+)'/)?.[1] || 0);
  assert.ok(release >= 250, `offline reply hardening must remain in release >= 250, got ${release}`);
  assert.match(manifest, /version:\s*"\d+"/);
});

test('configured but non-online reply submit is intercepted before the canonical form can clear the draft', () => {
  const comments = read('comment-reactions-v191.js');
  assert.match(comments, /if \(!isRemoteOnline\(\)\) \{[\s\S]*if \(window\.firebaseConfig\) \{[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopImmediatePropagation\(\);[\s\S]*返信内容は保持しています/);
  assert.match(comments, /return true;/);
});

test('local-only directed reply delegates through dataset without embedding protocol markers in the body', () => {
  const comments = read('comment-reactions-v191.js');
  const app = read('app.js');
  assert.match(comments, /textarea\.dataset\.commentReplyTargetV250 = replyTarget\.commentId/);
  assert.doesNotMatch(comments.match(/if \(!isRemoteOnline\(\)\) \{[\s\S]*?\n    \}/)?.[0] || '', /textarea\.value = `\[\[wb-reply:/);
  assert.match(app, /const replyTo = String\(textarea\.dataset\.commentReplyTargetV250 \|\| ""\)\.trim\(\)/);
  assert.match(app, /await addComment\(task\.id, text, type, \{ replyTo \}\)/);
});

test('canonical local-only reply stores structured replyTo and does not churn task-wide update metadata', () => {
  const app = read('app.js');
  assert.match(app, /async function addComment\(id, text, type = "作業メモ", options = \{\}\)/);
  assert.match(app, /const replyTo = state\.connectionMode === 'local-only' \? requestedReplyTo : ''/);
  assert.match(app, /if \(replyTo\) comment\.replyTo = replyTo/);
  assert.match(app, /if \(!replyTo\) \{[\s\S]*draft\.lastChange = makeActivityChange\([\s\S]*draft\.updatedAt = Date\.now\(\);[\s\S]*draft\.updatedBy = getCurrentUser\(\);[\s\S]*\}/,
    'ordinary comments keep task-wide metadata while directed local replies do not');
  assert.match(app, /const result = await persistTask\(draft\);[\s\S]*return result;/,
    'submitter must be able to keep the draft when persistence fails');
});

test('reply mode is cleared only after the canonical local writer reports success', () => {
  const app = read('app.js');
  const comments = read('comment-reactions-v191.js');
  assert.match(app, /if \(!result\?\.ok\) return;[\s\S]*textarea\.value = "";[\s\S]*workboard:local-reply-saved-v250/);
  assert.match(comments, /document\.addEventListener\('workboard:local-reply-saved-v250',[\s\S]*cancelReply\(\)/);
});

// Ver.504: preserve the Ver.251 remote reply transaction tests verbatim.
{
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const interaction = read('comment-reactions-v191.js');
const manifest = read('release-manifest.js');

test('Ver.251 reply audit remains valid in later product releases and reply writes use the canonical task transaction', () => {
  const release = Number(manifest.match(/VERSION\s*=\s*['"](\d+)['"]/)?.[1] || 0);
  assert.ok(release >= 249, `reply concurrency audit must remain valid in release >= 249, got ${release}`);
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
}

test('Ver.504 retired Ver.251 reply Protocol stays absent', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'test-harness', 'comment-reply-boundary-v251.test.mjs')), false,
    'retired Ver.251 reply Protocol must not reappear');
});
