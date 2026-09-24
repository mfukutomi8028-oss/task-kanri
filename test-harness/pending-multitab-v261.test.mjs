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

test('Ver.261 audit keeps product release at 253 and audits only current notification owners', () => {
  assert.match(manifest, /const VERSION = '253'/);
  assert.equal(inventory.baselineRelease, '253');
  const next = inventory.priorityCandidates?.[0];
  assert.deepEqual(next?.scope, ['inbox-events-v183.js', 'workflow-v152.js']);
  assert.match(next?.goal || '', /Ver\.261監査/);
});

test('pending queue is room-shared across tabs while flush single-flight is only per runtime', () => {
  assert.match(observer, /pendingStorageKey=`work-board-inbox-pending-v253:\$\{W\.ROOM_ID\}`/);
  assert.match(observer, /let previous=null,pollTimer=0,flushPromise=null,remoteReady=false/);
  assert.match(observer, /if\(flushPromise\)return flushPromise/);
  assert.doesNotMatch(observer, /BroadcastChannel|navigator\.locks|storage\s*event/i);
});

test('each successful pending event is cleared by current storage state and failed events are retained', () => {
  assert.match(observer, /if\(result\?\.ok\)\{clearPending\(entry\.recipient,entry\.id\);delivered\+=1\}/);
  assert.match(observer, /function clearPending\(recipient,id\)\{const map=readPending\(\),key=pendingId\(recipient,id\);if\(!\(key in map\)\)return;delete map\[key\];writePending\(map\)\}/);
});

test('server inbox writer remains deterministic-id idempotent for concurrent tab retries', () => {
  assert.match(workflow, /runTransaction\(target,current=>current\|\|item,\{applyLocally:false\}\)/);
});

test('local-only inbox writes report ok:true so transient queue entries can be cleared', () => {
  assert.match(workflow, /if\(!r\)return\{ok:remoteState==='local-only',localOnly:remoteState==='local-only'\}/);
  assert.match(observer, /if\(result\?\.ok\)clearPending\(recipient,id\)/);
});
