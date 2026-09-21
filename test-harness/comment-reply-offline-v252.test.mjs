import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Ver.252 audit keeps release at Ver.249 and local reply marker compatibility active', () => {
  const manifest = read('release-manifest.js');
  const comments = read('comment-reactions-v191.js');
  assert.match(manifest, /const VERSION = '249'/);
  assert.match(comments, /const LOCAL_REPLY_PREFIX = "\[\[wb-reply:"/);
  assert.match(comments, /rawText\.match\(\/\^\\\[\\\[wb-reply:/);
});

test('Ver.252 audit records that non-online reply fallback delegates to the canonical comment form', () => {
  const comments = read('comment-reactions-v191.js');
  assert.match(comments, /if \(!isRemoteOnline\(\)\) \{[\s\S]*textarea\.value = `\[\[wb-reply:\$\{replyTarget\.commentId\}\]\] \$\{text\}`;[\s\S]*return false;\n    \}/);
  assert.match(comments, /document\.addEventListener\('submit',[\s\S]*handleReplySubmit\(form, event\);[\s\S]*\}, true\);/);
});

test('Ver.252 audit records the degraded-mode draft-loss boundary in the canonical form', () => {
  const app = read('app.js');
  assert.match(app, /if \(!\['local-only', 'remote-online'\]\.includes\(state\.connectionMode\)\) \{[\s\S]*error: "write-not-available"/,
    'remote-loading and remote-degraded reject canonical writes');
  assert.match(app, /\$\("commentForm"\)\?\.addEventListener\("submit", async \(event\) => \{[\s\S]*await addComment\(task\.id, text, type\);[\s\S]*\$\("commentText"\)\.value = "";/,
    'canonical comment form clears the composer even when addComment reports a rejected write');
});

test('Ver.252 audit records that local-only marker fallback currently churns task-wide update metadata', () => {
  const app = read('app.js');
  assert.match(app, /async function addComment\(id, text, type = "作業メモ"\)[\s\S]*draft\.lastChange = makeActivityChange\(`/);
  assert.match(app, /async function addComment\(id, text, type = "作業メモ"\)[\s\S]*draft\.updatedAt = Date\.now\(\); draft\.updatedBy = getCurrentUser\(\);/,
    'local-only directed replies currently flow through ordinary comment update metadata');
});
