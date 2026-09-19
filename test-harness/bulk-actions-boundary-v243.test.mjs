import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.243 audit: product remains Ver.242 while the remote bulk-delete sidecar stays active exactly once', () => {
  const manifest = read('release-manifest.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');

  assert.equal(manifest.match(/version:\s*"(\d+)"/)?.[1], '242', 'audit must not bump the product release');
  assert.equal(scripts.filter(name => name === 'bulk-actions-v174.js').length, 1);
  assert.equal(required.filter(name => name === 'bulk-actions-v174.js').length, 1);
});

test('Ver.243 audit: sidecar intercepts only remote bulk delete before app.js and owns a separate Firebase client', () => {
  const bulk = read('bulk-actions-v174.js');

  assert.match(bulk, /function canUseRemoteFix\(\)/);
  assert.match(bulk, /pill\?\.classList\.contains\('remote-online'\)/);
  assert.match(bulk, /if \(action !== 'delete'\) return/);
  assert.match(bulk, /event\.preventDefault\(\)/);
  assert.match(bulk, /event\.stopImmediatePropagation\(\)/);
  assert.match(bulk, /document\.addEventListener\('click',[\s\S]*\}, true\)/);
  assert.match(bulk, /app\.name === 'bulk-delete-v175'/);
  assert.match(bulk, /initializeApp\(config, 'bulk-delete-v175'\)/);
});

test('Ver.243 audit: sidecar refreshes its delete base immediately before deletion and bypasses the canonical delete protocol/barrier', () => {
  const bulk = read('bulk-actions-v174.js');

  assert.match(bulk, /const beforeSnapshot = await get\(taskRef\)/);
  assert.match(bulk, /let base = beforeSnapshot\.val\(\)/);
  assert.match(bulk, /runTransaction\(taskRef,[\s\S]*\{ applyLocally: false \}\)/);
  assert.match(bulk, /const afterSnapshot = await get\(taskRef\)/);
  assert.match(bulk, /const cleanupWarnings = await cleanupRelations\(api, id, String\(base\?\.knowledgeId \|\| ''\)\)/);

  assert.doesNotMatch(bulk, /captureDeleteBaseFromProtocol|planDeleteMutation|classifyDeleteConflictProtocol|reduceDeleteSync|applyCommittedResult/);
});

test('Ver.243 audit: legacy cleanup can delete the original knowledge id even after ownership changes', () => {
  const bulk = read('bulk-actions-v174.js');

  assert.match(bulk, /if \(baseKnowledgeId && room\.knowledge\?\.\[baseKnowledgeId\]\) knowledgeIds\.add\(baseKnowledgeId\)/);
  assert.match(bulk, /const linkedByTask = String\(current\.taskId \|\| ''\) === taskId/);
  assert.match(bulk, /const linkedByOriginalId = knowledgeId === baseKnowledgeId/);
  assert.match(bulk, /return linkedByTask \|\| linkedByOriginalId \? null : current/);
});

test('Ver.243 audit: non-delete bulk updates remain app-owned, revision-checked, and use applyTaskDraft', () => {
  const app = read('app.js');
  const start = app.indexOf('async function applyBulkAction()');
  const end = app.indexOf('function bulkActionLabel', start);
  assert.ok(start >= 0 && end > start, 'app bulk action implementation must exist');
  const bulkApply = app.slice(start, end);

  assert.match(bulkApply, /const selected = ids\.map\(id => state\.tasks\.find\(task => task\.id === id\)\)\.filter\(Boolean\)/);
  assert.match(bulkApply, /normalizeRevision\(current\.revision\) !== normalizeRevision\(original\.revision\)/);
  assert.match(bulkApply, /if \(action === 'status'\) task\.status = normalizeStatus\(target\)/);
  assert.match(bulkApply, /if \(action === 'assignee'\) task\.assignee = normalizeUser\(target\)/);
  assert.match(bulkApply, /if \(action === 'category'\) task\.category = normalizeCategory\(target\)/);
  assert.match(bulkApply, /const applied = applyTaskDraft\(next, original, task\)/);
  assert.match(bulkApply, /runTransaction\(state\.roomRef/);
});

test('Ver.243 audit: canonical single delete already solves the old room-cache bug with conflict checks, child transactions, safe cleanup and barrier application', () => {
  const app = read('app.js');
  const protocol = read('task-delete-v134.js');

  assert.match(app, /const latestRoot = await readCurrentDeleteTarget\(\)/);
  assert.match(app, /const plan = runPlan\(latestRoot\)/);
  assert.match(app, /const taskRef = ref\(state\.db, taskPath\)/);
  assert.match(app, /const remote = await runTransaction\(taskRef,[\s\S]*\{ applyLocally: false \}\)/);
  assert.match(app, /if \(!current \|\| current\.taskId !== base\.id\) return current;\s*return null/);
  assert.doesNotMatch(
    app.slice(app.indexOf('async function transactionDeleteRoom(base)'), app.indexOf('async function deleteTaskV134')),
    /linkedByOriginalId/,
    'canonical cleanup must never delete knowledge solely because an old id matches'
  );
  assert.match(app, /applyCommittedResult\(\{ snapshot: finalRoot, affectedPaths, mutationKind: 'task-delete' \}\)/);
  assert.match(app, /async function deleteTask\(id, options = \{\}\)/);
  assert.match(app, /const base = options\.base \|\| captureDeleteBase\(id\)/);

  assert.match(protocol, /export function classifyDeleteConflict\(base, root\)/);
  assert.match(protocol, /hasKnowledgeOwnershipMismatch/);
  assert.match(protocol, /export function reduceDeleteSync\(state, action\)/);
  assert.match(protocol, /phase: 'committed-awaiting-ack'/);
});

test('Ver.243 audit: bulk-actions inventory stays on hold until the delete-only sidecar is replaced by the canonical app path', () => {
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  const group = inventory.groups.find(item => item.id === 'bulk-actions');
  assert.ok(group);
  assert.equal(group.consolidation, 'hold');
  assert.deepEqual(group.assets, ['bulk-actions-v174.js']);

  const next = inventory.priorityCandidates?.[0];
  assert.ok(next);
  assert.equal(next.order, 1);
  assert.deepEqual(next.scope, ['bulk-actions-v174.js']);
});
