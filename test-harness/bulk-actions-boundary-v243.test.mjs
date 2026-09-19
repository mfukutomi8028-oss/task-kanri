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

test('Ver.243 product: v243 bulk runtime is active once and legacy v174 remains rollback-only', () => {
  const manifest = read('release-manifest.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');

  assert.equal(manifest.match(/version:\s*"(\d+)"/)?.[1], '243');
  assert.equal(scripts.filter(name => name === 'bulk-actions-v243.js').length, 1);
  assert.equal(required.filter(name => name === 'bulk-actions-v243.js').length, 1);
  assert.ok(!scripts.includes('bulk-actions-v174.js'));
  assert.ok(!required.includes('bulk-actions-v174.js'));
  assert.ok(fs.existsSync(path.join(ROOT, 'bulk-actions-v174.js')), 'legacy v174 must remain physically available for rollback/cache compatibility');
});

test('Ver.243 product: remote non-delete bulk warms and transacts the tasks collection instead of room root', () => {
  const bulk = read('bulk-actions-v243.js');
  assert.match(bulk, /const tasksRef = api\.ref\(api\.db, `rooms\/\$\{api\.roomId\}\/tasks`\)/);
  assert.match(bulk, /await api\.get\(tasksRef\)/);
  assert.match(bulk, /api\.runTransaction\(tasksRef/);
  assert.match(bulk, /normalizeRevision\(current\.revision\) !== normalizeRevision\(original\.revision\)/);
  assert.match(bulk, /applyOneTask\(records, original, action, target, api\)/);
  assert.doesNotMatch(bulk, /runTransaction\([^\n]*roomRef/);
});

test('Ver.243 product: bulk completion preserves history, revision and recurring child semantics', () => {
  const bulk = read('bulk-actions-v243.js');
  assert.match(bulk, /saved\.history = appendHistory\(saved\.history, `一括操作で\$\{bulkActionLabel\(action\)\}しました。`/);
  assert.match(bulk, /saved\.revision = normalizeRevision\(current\.revision\) \+ 1/);
  assert.match(bulk, /const becameCompleted = String\(before\.status \|\| ''\) !== COMPLETE/);
  assert.match(bulk, /const childId = `rec-\$\{original\.id\}-\$\{nextDueDate\}`/);
  assert.match(bulk, /recurringParentId: original\.id/);
  assert.match(bulk, /nextRecurringTaskId: ''/);
  assert.match(bulk, /operationId: childId/);
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

test('Ver.243 product: responsibility inventory records v243 runtime and later cleanup remains outside bulk actions', () => {
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  assert.equal(inventory.baselineRelease, '243');
  const group = inventory.groups.find(item => item.id === 'bulk-actions');
  assert.ok(group);
  assert.equal(group.consolidation, 'consolidated-v243');
  assert.deepEqual(group.assets, ['bulk-actions-v243.js']);

  const next = inventory.priorityCandidates?.[0];
  assert.ok(next);
  assert.equal(next.order, 1);
  assert.ok(Array.isArray(next.scope) && next.scope.length >= 1);
  assert.ok(next.scope.every(asset => asset !== 'bulk-actions-v243.js'), 'completed bulk runtime must not return to the active cleanup priority');
});
