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
  const runner = read('test-harness/run-firebase-v263-audit.mjs');
  const pkg = JSON.parse(read('package.json'));
  assert.match(suite, /demo-task-kanri/);
  assert.match(suite, /test-firebase-emulator-pending-cross-tab-v263/);
  assert.match(suite, /127\.0\.0\.1/);
  assert.match(suite, /firebaseio\\\.com\|firebasedatabase\\\.app/);
  assert.match(suite, /WORK_BOARD_TEST/);
  assert.match(suite, /productionRequests/);
  assert.match(runner, /firebase-emulator-pending-cross-tab-v263\.spec\.mjs/);
  assert.match(pkg.scripts?.['test:firebase:browser'] || '', /run-firebase-v263-audit\.mjs/);
  assert.match(pkg.scripts?.['test:firebase'] || '', /--project demo-task-kanri/);
});
