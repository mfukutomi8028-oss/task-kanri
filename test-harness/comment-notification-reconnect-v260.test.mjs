import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const observer = read('inbox-events-v183.js');
const workflow = read('workflow-v152.js');
const manifest = read('release-manifest.js');
const inventory = JSON.parse(read('patch-responsibilities.json'));

test('Ver.254 product notification recovery remains published in release 254 or later', () => {
  const release = Number(manifest.match(/const VERSION = '(\d+)'/)?.[1] || 0);
  const publicRelease = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);
  assert.ok(release >= 254);
  assert.equal(publicRelease, release);
  assert.ok(Number(inventory.baselineRelease) >= 254);
});

test('failed observer deliveries are persisted per event before write and removed only after ok:true', () => {
  assert.match(observer, /legacyPendingStorageKey=`work-board-inbox-pending-v253:\$\{W\.ROOM_ID\}`/);
  assert.match(observer, /pendingStoragePrefix=`work-board-inbox-pending-v254:\$\{W\.ROOM_ID\}:/);
  assert.match(observer, /function pendingEventStorageKey\(recipient,id\)/);
  const deliverStart = observer.indexOf('async function deliver(recipient,id,event)');
  const deliverEnd = observer.indexOf('\n  async function flushPending()', deliverStart);
  assert.ok(deliverStart >= 0 && deliverEnd > deliverStart, 'deliver block must exist');
  const block = observer.slice(deliverStart, deliverEnd);
  const queue = block.indexOf('queuePending(recipient,id,event)');
  const write = block.indexOf('await W.writeInboxEvent(recipient,id,event)');
  const clear = block.indexOf('if(result?.ok)clearPending(recipient,id)');
  assert.ok(queue >= 0 && write > queue && clear > write,
    'fallback event must be durable before delivery and cleared only after a confirmed successful write');
});

test('pending fallback queue remains bounded, expires old entries, migrates legacy storage, and does not flush without a remote connection', () => {
  assert.match(observer, /PENDING_LIMIT=200,PENDING_MAX_AGE=14\*24\*60\*60\*1000/);
  assert.match(observer, /Date\.now\(\)-queuedAt>PENDING_MAX_AGE/);
  assert.match(observer, /entries\.slice\(0,Math\.max\(0,entries\.length-PENDING_LIMIT\)\)/);
  assert.match(observer, /function migrateLegacyPending\(\)/);
  assert.match(observer, /localStorage\.removeItem\(legacyPendingStorageKey\)/);
  assert.match(observer, /if\(!remoteReady\)return\{ok:false,offline:true\}/);
});

test('remote startup and later task snapshots retry retained events through the same inbox writer', () => {
  assert.match(observer, /if\(remoteReady\)void flushPending\(\)/);
  assert.match(observer, /if\(r\)\{remoteReady=true;await flushPending\(\);const ref=/);
  assert.match(observer, /await W\.writeInboxEvent\(entry\.recipient,entry\.id,entry\.event\)/);
});

test('deterministic reply and reaction event ids remain unchanged and server inbox writes stay idempotent', () => {
  assert.match(observer, /eventId\(kind,id,cid,recipient\)/);
  assert.match(observer, /eventId\('reaction',taskId,cid,emoji,reactor,nextRevision\)/);
  assert.match(workflow, /runTransaction\(target,current=>current\|\|item,\{applyLocally:false\}\)/);
});

// Ver.499: The original Ver.259 notification fallback assertions remain unchanged.
{
const interaction = read('comment-reactions-v191.js');
test('Ver.259 audit remains valid in Ver.252 or later product releases', () => {
  const match = manifest.match(/const VERSION = '(\d+)'/);
  assert.ok(match && Number(match[1]) >= 252);
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
    'observer may advance its task baseline because failed events are retained independently');
  assert.match(observer, /queuePending\(recipient,id,event\)[\s\S]*?W\.writeInboxEvent\(recipient,id,event\)[\s\S]*?if\(result\?\.ok\)clearPending\(recipient,id\)/,
    'observer fallback must retain failed deterministic events until a confirmed successful write');
  assert.match(workflow, /if\(!data\.inbox\[u\]\[id\]\)data\.inbox\[u\]\[id\]=item/,
    'local inbox cache must preserve one record per deterministic id');
  assert.match(workflow, /runTransaction\(target,current=>current\|\|item,\{applyLocally:false\}\)/,
    'remote inbox writer must preserve the first event at the shared deterministic id');
  assert.match(workflow, /catch\(e\)\{console\.warn\('Ver\.152 inbox write failed',e\);return\{ok:false\}\}/,
    'transient inbox failure must be reported without throwing into the already-committed task writer');
});
}

test('Ver.499 retired Ver.259 notification fallback Protocol stays absent', () => {
  assert.equal(fs.existsSync(new URL('./comment-notification-fallback-v259.test.mjs', import.meta.url)), false);
});
