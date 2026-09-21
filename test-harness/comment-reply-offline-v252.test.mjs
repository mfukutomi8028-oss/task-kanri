import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Ver.250 product publishes the offline reply hardening release', () => {
  const manifest = read('release-manifest.js');
  assert.match(manifest, /const VERSION = '250'/);
  assert.match(manifest, /version:\s*"250"/);
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
