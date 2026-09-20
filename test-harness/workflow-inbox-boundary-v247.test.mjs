import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Ver.247 product: inbox event creation remains server-idempotent by event id', () => {
  const source = read('workflow-v152.js');
  const writer = source.match(/async function writeInboxEvent\([\s\S]*?\n  \}\n  function normalizeReadAt/)?.[0] || '';
  assert.ok(writer, 'writeInboxEvent must remain inspectable');
  assert.match(writer, /runTransaction\(target,current=>current\|\|item/);
  assert.match(writer, /workflowV152\/inbox\/\$\{u\}\/\$\{id\}/);
  assert.doesNotMatch(writer, /await r\.set\(target,item\)/);
});

test('Ver.247 product: individual read toggle commits only against the rendered read state', () => {
  const source = read('workflow-v152.js');
  const writer = source.match(/async function markInboxRead\([\s\S]*?\n  \}\n  async function markAllInboxRead/)?.[0] || '';
  assert.ok(writer, 'markInboxRead must remain inspectable');
  assert.match(writer, /expectedReadAt/);
  assert.match(writer, /arguments\.length>=4\?normalizeReadAt\(expectedReadAt\):before/);
  assert.match(writer, /workflowV152\/inbox\/\$\{u\}\/\$\{id\}`/);
  assert.match(writer, /runTransaction\(target,current=>/);
  assert.match(writer, /normalizeReadAt\(current\.readAt\)!==expected/);
  assert.match(writer, /return\{\.\.\.current,readAt:next\}/);
  assert.match(writer, /conflict:true/);
  assert.doesNotMatch(writer, /await r\.set\(/);
});

test('Ver.247 product: mark-all freezes the visible unread ids before any remote write', () => {
  const source = read('workflow-v152.js');
  const writer = source.match(/async function markAllInboxRead\([\s\S]*?\n  \}\n  function normalizeArchiveValue/)?.[0] || '';
  assert.ok(writer, 'markAllInboxRead must remain inspectable');
  assert.match(writer, /targets=Object\.entries\(map\)/);
  assert.match(writer, /filter\(\(\[,item\]\)=>item&&typeof item==='object'&&!normalizeReadAt\(item\.readAt\)\)/);
  assert.match(writer, /markInboxRead\(target\.id,true,user,target\.expectedReadAt\)/);
  assert.match(writer, /count:targets\.length/);
  assert.doesNotMatch(writer, /runTransaction\(target,current=>/);
  assert.doesNotMatch(writer, /Object\.values\(next\)\.forEach/);
});

test('Ver.247 product: inbox UI passes rendered readAt bases for per-item actions', () => {
  const ui = read('inbox-ui-v183.js');
  assert.match(ui, /if\(!hasReaction\)\{await W\.markAllInboxRead\(\);renderAll\(\);return\}/);
  assert.match(ui, /targets\.map\(item=>W\.markInboxRead\(item\.id,true,undefined,item\.readAt\)\)/);
  assert.match(ui, /W\.markInboxRead\(id,!Boolean\(item\.readAt\),undefined,item\.readAt\)/);
  assert.match(ui, /W\.markInboxRead\(id,true,undefined,before\?\.readAt\)/);
});

test('Ver.247 product: event generator keeps deterministic ids for assign, status, comments, replies and reactions', () => {
  const events = read('inbox-events-v183.js');
  assert.match(events, /eventId\('assign',id,next\.revision/);
  assert.match(events, /eventId\('status',id,next\.revision/);
  assert.match(events, /eventId\(kind,id,cid,recipient\)/);
  assert.match(events, /eventId\('reaction',taskId,cid,emoji,reactor,nextRevision\)/);
  assert.match(events, /await W\.writeInboxEvent\(recipient,id,event\)/);
});

test('Ver.247 product: later releases retain the hardened inbox boundary', () => {
  const manifest = read('release-manifest.js');
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  const workflow = inventory.groups.find(group => group.id === 'workflow-and-detail');
  const release = Number(manifest.match(/const VERSION = '(\d+)'/)?.[1] || 0);
  const baseline = Number(inventory.baselineRelease || 0);
  const consolidation = Number(String(workflow?.consolidation || '').match(/v(\d+)/)?.[1] || 0);

  assert.ok(release >= 247);
  assert.ok(baseline >= 247);
  assert.ok(consolidation >= 247);
  assert.match(workflow?.reason || '', /Ver\.247製品/);
  assert.match(workflow?.reason || '', /markInboxRead/);
  assert.match(workflow?.reason || '', /一括既読/);
});
