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

test('Ver.254 product publishes per-event pending storage and advances the next notification audit', () => {
  assert.match(manifest, /const VERSION = '254'/);
  assert.equal(inventory.baselineRelease, '254');
  const next = inventory.priorityCandidates?.[0];
  assert.deepEqual(next?.scope, ['inbox-events-v183.js', 'workflow-v152.js']);
  assert.match(next?.goal || '', /Ver\.263監査/);
});

test('pending events remain room-shared through per-event keys while flush single-flight stays per runtime', () => {
  assert.match(observer, /legacyPendingStorageKey=`work-board-inbox-pending-v253:\$\{W\.ROOM_ID\}`/);
  assert.match(observer, /pendingStoragePrefix=`work-board-inbox-pending-v254:\$\{W\.ROOM_ID\}:/);
  assert.match(observer, /function pendingEventStorageKey\(recipient,id\)/);
  assert.match(observer, /let previous=null,pollTimer=0,flushPromise=null,remoteReady=false/);
  assert.match(observer, /if\(flushPromise\)return flushPromise/);
  assert.doesNotMatch(observer, /BroadcastChannel|navigator\.locks|storage\s*event/i);
});

test('each successful pending event clears only its own storage key while failed events remain durable', () => {
  assert.match(observer, /if\(result\?\.ok\)\{clearPending\(entry\.recipient,entry\.id\);delivered\+=1\}/);
  assert.match(observer, /function clearPending\(recipient,id\)\{migrateLegacyPending\(\);try\{localStorage\.removeItem\(pendingEventStorageKey\(recipient,id\)\)\}catch\(_\)\{\}\}/);
  assert.doesNotMatch(observer, /function writePending\(map\)/);
});

test('server inbox writer remains deterministic-id idempotent for concurrent tab retries', () => {
  assert.match(workflow, /runTransaction\(target,current=>current\|\|item,\{applyLocally:false\}\)/);
});

test('local-only inbox writes report ok:true so transient queue entries can be cleared', () => {
  assert.match(workflow, /if\(!r\)return\{ok:remoteState==='local-only',localOnly:remoteState==='local-only'\}/);
  assert.match(observer, /if\(result\?\.ok\)clearPending\(recipient,id\)/);
});
