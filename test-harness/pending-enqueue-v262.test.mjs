import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Ver.262 audit: pending queue enqueue is a shared localStorage read-modify-write without cross-tab serialization', () => {
  const source = read('inbox-events-v183.js');

  assert.match(source, /const pendingStorageKey=`work-board-inbox-pending-v253:\$\{W\.ROOM_ID\}`/);
  assert.match(source, /function readPending\(\)[\s\S]*localStorage\.getItem\(pendingStorageKey\)/);
  assert.match(source, /function writePending\(map\)[\s\S]*localStorage\.setItem\(pendingStorageKey/);
  assert.match(source, /function queuePending\(recipient,id,event\)[\s\S]*const map=readPending\(\),key=pendingId\(recipient,id\),existing=map\[key\];[\s\S]*writePending\(map\)/);

  assert.doesNotMatch(source, /navigator\.locks/);
  assert.doesNotMatch(source, /BroadcastChannel/);
  assert.doesNotMatch(source, /storage[^\n]*addEventListener|addEventListener\([^\n]*storage/);
});

test('Ver.262 audit: delivery persists the pending event before attempting the remote writer', () => {
  const source = read('inbox-events-v183.js');
  const deliver = source.match(/async function deliver\(recipient,id,event\)\{([\s\S]*?)\n  \}/)?.[1] || '';

  assert.match(deliver, /queuePending\(recipient,id,event\)/);
  assert.match(deliver, /await W\.writeInboxEvent\(recipient,id,event\)/);
  assert.ok(deliver.indexOf('queuePending(recipient,id,event)') < deliver.indexOf('await W.writeInboxEvent(recipient,id,event)'));
  assert.match(deliver, /if\(result\?\.ok\)clearPending\(recipient,id\)/);
});
