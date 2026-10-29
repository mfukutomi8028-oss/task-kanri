import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Ver.247 and 543 product: inbox event creation remains idempotent at the server event key', () => {
  const sidecar = read('workflow-v152.js');
  const writer = read('workspace-inbox-event-v543.js');
  const begin = sidecar.indexOf('async function writeInboxEvent(');
  const end = sidecar.indexOf('const normalizeReadAt=', begin);
  assert.ok(begin >= 0 && end > begin, 'the original event API must be inspectable');
  const delegate = sidecar.slice(begin, end);
  assert.match(sidecar, /window\.WorkBoardInboxEventV543\.create\(/);
  assert.match(delegate, /return inboxEventPersistence\.write\(recipient,eventId,event\)/);
  assert.match(sidecar, /if\(!data\.inbox\[user\]\[id\]\)data\.inbox\[user\]\[id\]=item/);
  assert.match(writer, /runTransaction\(target,current=>current\|\|item,\{applyLocally:false\}\)/);
  assert.match(writer, /workflowV152\/inbox\//);
  assert.match(writer, /const localOnly = getRemoteState\(\) === 'local-only'/);
  assert.doesNotMatch(writer, /\br\.set\(|\br\.remove\(|\bonValue\(/);
});

test('Ver.247 and 542 product: individual read toggle retains expected base through one canonical writer', () => {
  const source = read('workflow-v152.js');
  const shared = read('workspace-inbox-read-v542.js');
  const writer = source.match(/async function markInboxRead\([\s\S]*?\n  \}\n  async function markAllInboxRead/)?.[0] || '';
  assert.ok(writer, 'markInboxRead must remain inspectable');
  assert.match(source, /window\.WorkBoardInboxReadV542\.create\(/);
  assert.match(writer, /expectedReadAt/);
  assert.match(writer, /arguments\.length>=4/);
  assert.match(writer, /return inboxReadPersistence\.write\(eventId,read,userKey\(user\),expectedReadAt,arguments\.length>=4\)/);
  assert.match(shared, /workflowV152\/inbox\//);
  assert.match(shared, /runTransaction\(target, current =>/);
  assert.match(shared, /current === null && !coldProbe/);
  assert.match(shared, /normalizeReadAt\(current\.readAt\) !== expected/);
  assert.match(shared, /return \{ \.\.\.current, readAt: next \}/);
  assert.match(shared, /conflict: true/);
  assert.match(shared, /applyLocally: false/);
  assert.doesNotMatch(shared, /\br\.set\(|\br\.remove\(|\bonValue\(/);
});

test('Ver.247 product: mark-all freezes the visible unread ids before any remote write', () => {
  const source = read('workflow-v152.js');
  const start = source.indexOf('async function markAllInboxRead(');
  const end = source.indexOf('function applyArchiveLocal(', start);
  assert.ok(start >= 0 && end > start, 'bulk-read must remain its own frozen-snapshot routine');
  const writer = source.slice(start, end);
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
  assert.match(workflow?.reason || '', /個別既読/);
  assert.match(workflow?.reason || '', /一括既読/);
});

// Ver.517: historical notification-idempotency-v250.test.mjs checks are co-located with their current Protocol owner.
{
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const interaction = read('comment-reactions-v191.js');
const observer = read('inbox-events-v183.js');
const workflow = read('workflow-v152.js');
const eventWriter = read('workspace-inbox-event-v543.js');
const manifest = read('release-manifest.js');

test('Ver.250 notification audit remains valid in later releases while reply writer and observer share the same event id shape', () => {
  const release = Number(manifest.match(/VERSION\s*=\s*['"](\d+)['"]/)?.[1] || 0);
  assert.ok(release >= 249, `notification idempotency audit must remain valid in release >= 249, got ${release}`);
  assert.match(interaction, /cleanEventId\('reply', taskId, replyId, recipient\)/);
  assert.match(observer, /eventId\(kind,id,cid,recipient\)/);
  assert.match(observer, /const kind=isReply\?'reply':isMention\?'mention':'comment'/);
});

test('Ver.250 audit keeps reaction writer and observer on the same revision-scoped event id shape', () => {
  assert.match(interaction, /cleanEventId\("reaction", taskId, commentIdValue, emoji, user, Number\(saved\.revision \|\| 0\)\)/);
  assert.match(observer, /eventId\('reaction',taskId,cid,emoji,reactor,nextRevision\)/);
});

test('Ver.250 audit proves inbox writes are idempotent at the event key', () => {
  assert.match(eventWriter, /runTransaction\(target,current=>current\|\|item,\{applyLocally:false\}\)/,
    'duplicate writer/observer attempts must preserve the first record at the shared event key');
  assert.match(workflow, /if\(!data\.inbox\[user\]\[id\]\)data\.inbox\[user\]\[id\]=item/,
    'local cache must also avoid duplicating an already-known event key');
});
}

// Ver.518: unchanged former inbox-events-polling-v333.test.mjs tests retained alongside their active owner.
{
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [inboxEvents, manifest, responsibilityText, browserAudit] = await Promise.all([
  read('inbox-events-v183.js'),
  read('release-manifest.js'),
  read('patch-responsibilities.json'),
  read('tests/inbox-events-polling-audit-v333.spec.mjs')
]);
const responsibilities = JSON.parse(responsibilityText);

test('Ver.333 audit: local-only inbox generation still owns the 1500ms snapshot poll', () => {
  assert.match(inboxEvents, /pollTimer=setInterval\(\(\)=>\{[\s\S]*?W\.taskMap\(\)[\s\S]*?processSnapshot\(map\)[\s\S]*?\},1500\)/);
  assert.match(inboxEvents, /r\.onValue\(ref,s=>\{remoteReady=true;processSnapshot\(s\.val\(\)\|\|\{\}\)\}/);
  assert.doesNotMatch(inboxEvents, /addEventListener\(['"]workflow-v1(?:48|49|50|52)-update/);
});

test('Ver.333 audit: browser test suppresses only the inbox-owned timer and manually proves its detection role', () => {
  assert.match(browserAudit, /Number\(delay\) === 1500 && stack\.includes\('inbox-events-v183\.js'\)/);
  assert.match(browserAudit, /callbacks: 0, suppressed: true/);
  assert.match(browserAudit, /data-quick-task-status/);
  assert.match(browserAudit, /work-board-inbox-pending-v254/);
  assert.match(browserAudit, /record\.callback\(\)/);
  assert.doesNotMatch(browserAudit, /page\.route\([^\n]*inbox-events-v183\.js/);
});

test('Ver.333 audit: retained polling evidence remains valid in later aligned releases', () => {
  const release = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);
  assert.ok(release >= 283, `expected release 283 or later, got ${release}`);
  assert.equal(responsibilities.baselineRelease, String(release));
});
}
