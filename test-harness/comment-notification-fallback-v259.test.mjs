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

test('Ver.259 audit keeps the formal product release at Ver.252', () => {
  assert.match(manifest, /const VERSION = '252'/);
});

test('direct reply and reaction notification failures are downstream of the committed task snapshot', () => {
  assert.match(interaction, /writeCachedTask\(taskId, saved\);[\s\S]*?await deliverPersonal\(recipient, cleanEventId\("reaction", taskId, commentIdValue, emoji, user, Number\(saved\.revision \|\| 0\)\)/,
    'reaction task snapshot must be cached before personal notification delivery');
  assert.match(interaction, /writeCachedTask\(taskId, saved\);[\s\S]*?await deliverPersonal\(recipient, cleanEventId\('reply', taskId, replyId, recipient\)/,
    'reply task snapshot must be cached before personal notification delivery');
  assert.match(interaction, /async function deliverPersonal[\s\S]*?try \{[\s\S]*?workflow\.writeInboxEvent[\s\S]*?\} catch \(error\) \{[\s\S]*?return \{ ok: false, error \}/,
    'personal notification failure must be contained instead of rolling back the task writer');
});

test('direct writers and observer fallback converge on the same deterministic event ids', () => {
  assert.match(interaction, /cleanEventId\('reply', taskId, replyId, recipient\)/);
  assert.match(observer, /eventId\(kind,id,cid,recipient\)/);
  assert.match(observer, /const kind=isReply\?'reply':isMention\?'mention':'comment'/);
  assert.match(interaction, /cleanEventId\("reaction", taskId, commentIdValue, emoji, user, Number\(saved\.revision \|\| 0\)\)/);
  assert.match(observer, /eventId\('reaction',taskId,cid,emoji,reactor,nextRevision\)/);
});

test('observer fallback and inbox storage remain idempotent across retries and reconnects', () => {
  assert.match(observer, /previous=current;[\s\S]*?Promise\.allSettled\(jobs\)/,
    'observer must advance its task baseline even when one delivery fails');
  assert.match(workflow, /if\(!data\.inbox\[u\]\[id\]\)data\.inbox\[u\]\[id\]=item/,
    'local inbox cache must preserve one record per deterministic id');
  assert.match(workflow, /runTransaction\(target,current=>current\|\|item,\{applyLocally:false\}\)/,
    'remote inbox writer must preserve the first event at the shared deterministic id');
  assert.match(workflow, /catch\(e\)\{console\.warn\('Ver\.152 inbox write failed',e\);return\{ok:false\}\}/,
    'transient inbox failure must be reported without throwing into the already-committed task writer');
});
