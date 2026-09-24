import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Ver.254 product: pending enqueue writes one event key and legacy aggregate is migration-only', () => {
  const source = read('inbox-events-v183.js');

  assert.match(source, /const legacyPendingStorageKey=`work-board-inbox-pending-v253:\$\{W\.ROOM_ID\}`/);
  assert.match(source, /const pendingStoragePrefix=`work-board-inbox-pending-v254:\$\{W\.ROOM_ID\}:/);
  assert.match(source, /function pendingEventStorageKey\(recipient,id\)/);
  assert.match(source, /function migrateLegacyPending\(\)/);
  assert.match(source, /localStorage\.removeItem\(legacyPendingStorageKey\)/);

  const queue = source.match(/function queuePending\(recipient,id,event\)\{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.match(queue, /pendingEventStorageKey\(recipient,id\)/);
  assert.match(queue, /localStorage\.setItem\(storageKey,JSON\.stringify\(entry\)\)/);
  assert.doesNotMatch(queue, /writePending|Object\.fromEntries/);

  const clear = source.match(/function clearPending\(recipient,id\)\{([^\n]*)\}/)?.[1] || '';
  assert.match(clear, /localStorage\.removeItem\(pendingEventStorageKey\(recipient,id\)\)/);
  assert.doesNotMatch(source, /function writePending\(map\)/);
});

test('Ver.254 product: delivery still persists before remote write and clears only on success', () => {
  const source = read('inbox-events-v183.js');
  const deliver = source.match(/async function deliver\(recipient,id,event\)\{([\s\S]*?)\n  \}/)?.[1] || '';

  assert.match(deliver, /queuePending\(recipient,id,event\)/);
  assert.match(deliver, /await W\.writeInboxEvent\(recipient,id,event\)/);
  assert.ok(deliver.indexOf('queuePending(recipient,id,event)') < deliver.indexOf('await W.writeInboxEvent(recipient,id,event)'));
  assert.match(deliver, /if\(result\?\.ok\)clearPending\(recipient,id\)/);
});

test('Ver.254 product: per-event scan keeps the 200 item and 14 day queue boundaries', () => {
  const source = read('inbox-events-v183.js');
  assert.match(source, /PENDING_LIMIT=200,PENDING_MAX_AGE=14\*24\*60\*60\*1000/);
  assert.match(source, /key\?\.startsWith\(pendingStoragePrefix\)/);
  assert.match(source, /entries\.slice\(0,Math\.max\(0,entries\.length-PENDING_LIMIT\)\)/);
  assert.match(source, /Date\.now\(\)-queuedAt>PENDING_MAX_AGE/);
});
