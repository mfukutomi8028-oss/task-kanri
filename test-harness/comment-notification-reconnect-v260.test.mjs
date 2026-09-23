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

test('Ver.260 audit keeps the formal product release at Ver.252', () => {
  assert.match(manifest, /const VERSION = '252'/);
});

test('current observer advances its snapshot baseline before notification jobs settle', () => {
  const publish = observer.indexOf('previous=current;');
  const settle = observer.indexOf('if(jobs.length)await Promise.allSettled(jobs);');
  assert.ok(publish >= 0 && settle > publish,
    'current observer must record the audited limitation: baseline advances before notification delivery settles');
});

test('a fresh observer treats its first snapshot as baseline without reconstructing historical notification events', () => {
  assert.match(observer, /if\(previous===null\)\{previous=current;return\}/,
    'reconnect starts from the current task snapshot and does not replay deltas that happened before subscription');
});

test('inbox write failure resolves as ok:false, so the observer has no rejected job to retain for retry', () => {
  assert.match(workflow, /catch\(e\)\{console\.warn\('Ver\.152 inbox write failed',e\);return\{ok:false\}\}/,
    'remote inbox failures are contained as ok:false');
  assert.match(observer, /async function deliver\(recipient,id,event\)\{if\(!recipient\|\|recipient===event\.actor\)return;await W\.writeInboxEvent\(recipient,id,event\)\}/,
    'observer delivery currently does not inspect the ok:false result');
});

test('deterministic reply and reaction event ids remain available for a future durable retry fix', () => {
  assert.match(observer, /eventId\(kind,id,cid,recipient\)/);
  assert.match(observer, /eventId\('reaction',taskId,cid,emoji,reactor,nextRevision\)/);
});
