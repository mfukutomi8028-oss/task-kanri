import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const interaction = read('comment-reactions-v191.js');
const observer = read('inbox-events-v183.js');
const workflow = read('workflow-v152.js');
const manifest = read('release-manifest.js');

test('Ver.250 notification audit remains valid in later releases while reply writer and observer share the same event id shape', () => {
  const release = Number(manifest.match(/VERSION\s*=\s*['"](\d+)['"]/)?.[1] || 0);
  assert.ok(release >= 249, `notification idempotency audit must remain valid in release >= 249, got ${release}`);
  assert.match(interaction, /cleanEventId\('reply', taskId, replyId, recipient\)/);
  assert.match(observer, /eventId\(kind,id,cid,recipient\)/);
  assert.match(observer, /const kind=isReply\?'reply':isMention\?'mention':'comment'/);
});

test('Ver.250 audit keeps reaction writer and observer on the same revision-scoped event id shape', () => {
  assert.match(interaction, /cleanEventId\("reaction", taskId, commentIdValue, emoji, user, Number\(saved\.revision \|\| 0\)\)/);
  assert.match(observer, /eventId\('reaction',taskId,cid,emoji,reactor,nextRevision\)/);
});

test('Ver.250 audit proves inbox writes are idempotent at the event key', () => {
  assert.match(workflow, /runTransaction\(target,current=>current\|\|item,\{applyLocally:false\}\)/,
    'duplicate writer/observer attempts must preserve the first record at the shared event key');
  assert.match(workflow, /if\(!data\.inbox\[u\]\[id\]\)data\.inbox\[u\]\[id\]=item/,
    'local cache must also avoid duplicating an already-known event key');
});
