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

test('Ver.253 product advances the formal release after the Ver.260 notification-loss audit', () => {
  assert.match(manifest, /const VERSION = '253'/);
});

test('failed observer deliveries are persisted before write and removed only after ok:true', () => {
  assert.match(observer, /pendingStorageKey=`work-board-inbox-pending-v253:\$\{W\.ROOM_ID\}`/);
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

test('pending fallback queue is bounded, expires old entries, and does not flush without a remote connection', () => {
  assert.match(observer, /PENDING_LIMIT=200,PENDING_MAX_AGE=14\*24\*60\*60\*1000/);
  assert.match(observer, /\.slice\(-PENDING_LIMIT\)/);
  assert.match(observer, /now-queuedAt>PENDING_MAX_AGE/);
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
