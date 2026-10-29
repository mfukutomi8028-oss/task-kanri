import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { FROZEN_RETIRED_JS_BLOBS_V421 } from './build-pages-runtime-v382.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.243+ product: v243 bulk runtime remains active once and legacy v174 remains rollback-only', () => {
  const manifest = read('release-manifest.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  const version = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);

  assert.ok(version >= 243, 'Ver.243 bulk contract must remain valid in later releases');
  assert.equal(scripts.filter(name => name === 'bulk-actions-v243.js').length, 1);
  assert.equal(required.filter(name => name === 'bulk-actions-v243.js').length, 1);
  assert.equal(scripts.filter(name => name === 'workspace-bulk-update-v547.js').length, 1);
  assert.equal(required.filter(name => name === 'workspace-bulk-update-v547.js').length, 1);
  assert.ok(scripts.indexOf('workspace-bulk-update-v547.js') < scripts.indexOf('bulk-actions-v243.js'));
  assert.ok(!scripts.includes('bulk-actions-v174.js'));
  assert.ok(!required.includes('bulk-actions-v174.js'));
  assert.equal(fs.existsSync(path.join(ROOT, 'bulk-actions-v174.js')), false,
    'legacy bulk controller must leave Git root');
  const archive = JSON.parse(read('compat/frozen-legacy-runtime-v397.json'));
  assert.equal(typeof archive['bulk-actions-v174.js'], 'string', 'cached bulk source must remain archived');
  assert.equal(FROZEN_RETIRED_JS_BLOBS_V421['bulk-actions-v174.js'],
    'f6c3370f2556a0b4b464b4e935d004ecf24839bc', 'original V174 Git blob remains pinned');
});

test('Ver.243/547 product: shared owner warms tasks child and transacts expected task revisions', () => {
  const bulk = read('bulk-actions-v243.js');
  const writer = read('workspace-bulk-update-v547.js');
  assert.match(bulk, /WorkBoardBulkUpdateV547\.create\(\{currentUser,defaultOpenStatus\}\)/);
  assert.match(bulk, /sharedBulk\.commit\(api,selected,action,target\)/);
  assert.match(writer, /rooms\/\$\{api\.roomId\}\/tasks/);
  assert.match(writer, /await api\.get\(tasksRef\)/);
  assert.match(writer, /api\.runTransaction\(tasksRef/);
  assert.match(writer, /normalizeRevision\(current\.revision\) !== normalizeRevision\(original\.revision\)/);
  assert.match(writer, /applyOneTask\(records, original, action, target, api\)/);
  assert.match(writer, /applyLocally: false/);
  assert.doesNotMatch(writer, /runTransaction\([^\n]*roomRef/);
  assert.doesNotMatch(bulk, /api\.runTransaction\(tasksRef/);
});

test('Ver.243/547 product: shared completion preserves history, revision and recurring child semantics', () => {
  const writer = read('workspace-bulk-update-v547.js');
  const bulk = read('bulk-actions-v243.js');
  assert.match(bulk, /nextRecurringDueDate=sharedBulk\.nextRecurringDueDate/);
  assert.match(bulk, /applyOneTask=sharedBulk\.applyOneTask/);
  assert.match(writer, /saved\.history = appendHistory\(saved\.history, \x60一括操作で\$\{bulkActionLabel\(action\)\}しました。\x60/);
  assert.match(writer, /saved\.revision = normalizeRevision\(current\.revision\) \+ 1/);
  assert.match(writer, /const becameCompleted = String\(before\.status \|\| ''\) !== COMPLETE/);
  assert.match(writer, /const childId = \x60rec-\$\{original\.id\}-\$\{nextDueDate\}\x60/);
  assert.match(writer, /recurringParentId: original\.id/);
  assert.match(writer, /nextRecurringTaskId: ''/);
  assert.match(writer, /operationId: childId/);
  assert.doesNotMatch(writer, /\bonValue\(|\bdocument\b/);
});

test('Ver.243 product: remote delete delegates to the existing app delete control and has no independent task/knowledge delete transaction', () => {
  const bulk = read('bulk-actions-v243.js');
  const app = read('app.js');

  assert.match(bulk, /document\.querySelector\('\.detail-panel \[data-action="delete"\]'\)/);
  assert.match(bulk, /row\.click\(\)/);
  assert.match(bulk, /button\.click\(\)/);
  assert.match(bulk, /waitCanonicalDeleteOutcome/);
  assert.doesNotMatch(bulk, /cleanupRelations/);
  assert.doesNotMatch(bulk, /baseKnowledgeId|linkedByOriginalId/);

  assert.match(app, /const latestRoot = await readCurrentDeleteTarget\(\)/);
  assert.match(app, /const taskRef = ref\(state\.db, taskPath\)/);
  assert.match(app, /const remote = await runTransaction\(taskRef,[\s\S]*\{ applyLocally: false \}\)/);
  assert.match(app, /if \(!current \|\| current\.taskId !== base\.id\) return current;\s*return null/);
  assert.match(app, /applyCommittedResult\(\{ snapshot: finalRoot, affectedPaths, mutationKind: 'task-delete' \}\)/);
});

test('Ver.243 product: canonical delete protocol/barrier remains the source of deletion conflict semantics', () => {
  const protocol = read('task-delete-v134.js');
  assert.match(protocol, /export function classifyDeleteConflict\(base, root\)/);
  assert.match(protocol, /hasKnowledgeOwnershipMismatch/);
  assert.match(protocol, /export function reduceDeleteSync\(state, action\)/);
  assert.match(protocol, /phase: 'committed-awaiting-ack'/);
});

test('Ver.243+ product: responsibility inventory keeps v243 bulk runtime while later cleanup stays outside bulk actions', () => {
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  assert.ok(Number(inventory.baselineRelease) >= 243, 'Ver.243 bulk ownership must survive later release baselines');
  const group = inventory.groups.find(item => item.id === 'bulk-actions');
  assert.ok(group);
  assert.equal(group.consolidation, 'consolidated-v243');
  assert.deepEqual(group.assets, ['workspace-bulk-update-v547.js', 'bulk-actions-v243.js']);

  const next = inventory.priorityCandidates?.[0];
  assert.ok(next);
  assert.equal(next.order, 1);
  assert.ok(Array.isArray(next.scope) && next.scope.length >= 1);
  assert.ok(next.scope.every(asset => asset !== 'bulk-actions-v243.js'), 'completed bulk runtime must not return to the active cleanup priority');
});

test('Ver.243 bulk runtime parses and legacy v174 stays in frozen URL archive', () => {
  const current = path.join(ROOT, 'bulk-actions-v243.js');
  const legacy = path.join(ROOT, 'bulk-actions-v174.js');
  assert.ok(fs.existsSync(current));
  assert.equal(fs.existsSync(legacy), false, 'legacy bulk helper must leave Git root');
  const archive = JSON.parse(fs.readFileSync(path.join(ROOT, 'compat/frozen-legacy-runtime-v397.json'), 'utf8'));
  assert.equal(typeof archive['bulk-actions-v174.js'], 'string', 'cached old bulk JS must remain published');
  const parsed = spawnSync(process.execPath, ['--check', current], { encoding: 'utf8' });
  assert.equal(parsed.status, 0, parsed.stderr || parsed.stdout);
});
