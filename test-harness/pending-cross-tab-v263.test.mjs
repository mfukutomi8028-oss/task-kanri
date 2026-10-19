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

test('Ver.263 audit remains recorded after later product releases', () => {
  const release = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);
  assert.ok(release >= 254, 'Ver.263 pending audit must remain covered by release 254 or later');
  assert.ok(Number(inventory.baselineRelease) >= 254, 'responsibility baseline must not move behind Ver.254');
  const workflowGroup = inventory.groups?.find(group => group.id === 'workflow-and-detail');
  assert.match(workflowGroup?.reason || '', /Ver\.263監査/);
  assert.match(workflowGroup?.reason || '', /製品runtimeの追加修正は不要/);
});

test('legacy v253 migration never overwrites an existing v254 event and removes only the aggregate after scanning it', () => {
  const migrate = observer.match(/function migrateLegacyPending\(\)\{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.match(migrate, /Object\.values\(raw&&typeof raw==='object'\?raw:\{\}\)/);
  assert.match(migrate, /if\(!localStorage\.getItem\(storageKey\)\)localStorage\.setItem\(storageKey,JSON\.stringify\(entry\)\)/);
  assert.match(migrate, /localStorage\.removeItem\(legacyPendingStorageKey\)/);
  assert.ok(migrate.indexOf('if(!localStorage.getItem(storageKey))') < migrate.indexOf('localStorage.removeItem(legacyPendingStorageKey)'));
});

test('queue and clear remain event-key scoped so one tab cannot erase an unrelated pending event', () => {
  const queue = observer.match(/function queuePending\(recipient,id,event\)\{([\s\S]*?)\n  \}/)?.[1] || '';
  const clear = observer.match(/function clearPending\(recipient,id\)\{([^\n]*)\}/)?.[1] || '';
  assert.match(queue, /pendingEventStorageKey\(recipient,id\)/);
  assert.match(queue, /localStorage\.setItem\(storageKey,JSON\.stringify\(entry\)\)/);
  assert.match(clear, /localStorage\.removeItem\(pendingEventStorageKey\(recipient,id\)\)/);
  assert.doesNotMatch(queue, /localStorage\.setItem\(legacyPendingStorageKey/);
  assert.doesNotMatch(clear, /pendingStoragePrefix|legacyPendingStorageKey/);
});

test('flush uses a snapshot but clears only successful event keys; later events remain eligible for retry', () => {
  const flush = observer.match(/async function flushPending\(\)\{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.match(flush, /const entries=Object\.values\(readPending\(\)\)/);
  assert.match(flush, /await W\.writeInboxEvent\(entry\.recipient,entry\.id,entry\.event\)/);
  assert.match(flush, /if\(result\?\.ok\)\{clearPending\(entry\.recipient,entry\.id\);delivered\+=1\}/);
  assert.doesNotMatch(flush, /localStorage\.clear|removeItem\(legacyPendingStorageKey\)/);
});

test('server writer keeps deterministic event ids idempotent when two tabs flush the same key', () => {
  assert.match(workflow, /workflowV152\/inbox\/\$\{u\}\/\$\{id\}/);
  assert.match(workflow, /runTransaction\(target,current=>current\|\|item,\{applyLocally:false\}\)/);
});

test('Ver.263 emulator audit is isolated and registered without weakening the existing Firebase safety boundary', () => {
  const suite = read('tests/firebase-emulator-pending-cross-tab-v263.spec.mjs');
  const runner = read('test-harness/run-firebase-audit-suites-v479.mjs');
  const pkg = JSON.parse(read('package.json'));
  assert.match(suite, /demo-task-kanri/);
  assert.match(suite, /test-firebase-emulator-pending-cross-tab-v263/);
  assert.match(suite, /127\.0\.0\.1/);
  assert.match(suite, /firebaseio\\\.com\|firebasedatabase\\\.app/);
  assert.match(suite, /WORK_BOARD_TEST/);
  assert.match(suite, /productionRequests/);
  assert.match(runner, /firebase-emulator-pending-cross-tab-v263\.spec\.mjs/);
  assert.match(pkg.scripts?.['test:firebase:browser'] || '', /run-firebase-audit-suites-v479\.mjs/);
  assert.match(runner, /WORK_BOARD_FIREBASE_E2E: '1'/);
  assert.match(runner, /spawnSync\(process\.execPath, \[cli, 'test', spec, '--workers=1'\]/);
  assert.match(runner, /cwd: ROOT/);
  assert.match(runner, /if \(result\.error\)/);
  assert.match(runner, /if \(\(result\.status \?\? 1\) !== 0\) process\.exit/);
  assert.match(pkg.scripts?.['test:firebase'] || '', /--project demo-task-kanri/);
});

// Ver.503: retain Ver.261 per-event pending contracts with their original assertions.
{
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const observer = read('inbox-events-v183.js');
const workflow = read('workflow-v152.js');
const manifest = read('release-manifest.js');
const inventory = JSON.parse(read('patch-responsibilities.json'));

test('Ver.254 product per-event pending storage remains published in release 254 or later', () => {
  const release = Number(manifest.match(/const VERSION = '(\d+)'/)?.[1] || 0);
  assert.ok(release >= 254);
  assert.ok(Number(inventory.baselineRelease) >= 254);
  const workflowGroup = inventory.groups?.find(group => group.id === 'workflow-and-detail');
  assert.ok(workflowGroup?.assets?.includes('inbox-events-v183.js'));
  assert.ok(workflowGroup?.assets?.includes('workflow-v152.js'));
  assert.match(workflowGroup?.reason || '', /Ver\.254製品/);
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
}

// Ver.503: retain Ver.262 enqueue contracts with their original assertions.
{
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
}

test('Ver.503 retired Ver.261/262 pending Protocol suites remain absent', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'test-harness', 'pending-multitab-v261.test.mjs')), false,
    'retired Ver.261 pending Protocol must not reappear');
  assert.equal(fs.existsSync(path.join(ROOT, 'test-harness', 'pending-enqueue-v262.test.mjs')), false,
    'retired Ver.262 pending Protocol must not reappear');
});
