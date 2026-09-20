import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Ver.247 audit: inbox event creation is server-idempotent by event id', () => {
  const source = read('workflow-v152.js');
  const writer = source.match(/async function writeInboxEvent\([\s\S]*?\n  \}\n  async function markInboxRead/)?.[0] || '';

  assert.ok(writer, 'writeInboxEvent must remain inspectable');
  assert.match(writer, /runTransaction\(target,current=>current\|\|item/);
  assert.match(writer, /workflowV152\/inbox\/\$\{u\}\/\$\{id\}/);
  assert.doesNotMatch(writer, /await r\.set\(target,item\)/);
});

test('Ver.247 audit: individual read toggle is a direct readAt set without an expected base', () => {
  const source = read('workflow-v152.js');
  const writer = source.match(/async function markInboxRead\([\s\S]*?\n  \}\n  async function markAllInboxRead/)?.[0] || '';

  assert.ok(writer, 'markInboxRead must remain inspectable');
  assert.match(writer, /item\.readAt=read\?Date\.now\(\):0/);
  assert.match(writer, /await r\.set\(r\.ref\(r\.db,`rooms\/\$\{ROOM_ID\}\/workflowV152\/inbox\/\$\{u\}\/\$\{id\}\/readAt`\),item\.readAt\)/);
  assert.doesNotMatch(writer, /runTransaction\(/);
  assert.doesNotMatch(writer, /expected/);
});

test('Ver.247 audit: mark-all transaction currently marks every unread server item, including concurrent arrivals', () => {
  const source = read('workflow-v152.js');
  const writer = source.match(/async function markAllInboxRead\([\s\S]*?\n  \}\n  function normalizeArchiveValue/)?.[0] || '';

  assert.ok(writer, 'markAllInboxRead must remain inspectable');
  assert.match(writer, /Object\.values\(map\)\.forEach/);
  assert.match(writer, /runTransaction\(target,current=>/);
  assert.match(writer, /Object\.values\(next\)\.forEach\(item=>\{if\(item&&typeof item==='object'&&!item\.readAt\)item\.readAt=now\}\)/);
  assert.doesNotMatch(writer, /Object\.keys\(map\)/);
  assert.doesNotMatch(writer, /targetIds/);
});

test('Ver.247 audit: inbox UI delegates no-reaction mark-all directly to the broad writer', () => {
  const ui = read('inbox-ui-v183.js');
  assert.match(ui, /if\(!hasReaction\)\{await W\.markAllInboxRead\(\);renderAll\(\);return\}/);
  assert.match(ui, /targets\.map\(item=>W\.markInboxRead\(item\.id,true\)\)/);
});

test('Ver.247 audit: event generator derives deterministic ids for assign, status, comments, replies and reactions', () => {
  const events = read('inbox-events-v183.js');
  assert.match(events, /eventId\('assign',id,next\.revision/);
  assert.match(events, /eventId\('status',id,next\.revision/);
  assert.match(events, /eventId\(kind,id,cid,recipient\)/);
  assert.match(events, /eventId\('reaction',taskId,cid,emoji,reactor,nextRevision\)/);
  assert.match(events, /await W\.writeInboxEvent\(recipient,id,event\)/);
});
