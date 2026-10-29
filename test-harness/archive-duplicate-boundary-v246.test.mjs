import { test } from 'node:test';
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

test('Ver.246 product: workflow, archive UI, and duplicate merge load once in dependency order', () => {
  const manifest = read('release-manifest.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const version = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);

  assert.ok(version >= 246, 'Ver.246 product must expose the formal release');
  for (const asset of ['workflow-v152.js', 'archive-ui-v182.js', 'duplicate-merge-v182.js']) {
    assert.equal(scripts.filter(name => name === asset).length, 1, `${asset} must load exactly once`);
  }
  assert.equal(scripts.filter(name => name === 'workspace-archive-v540.js').length, 1);
  assert.ok(scripts.indexOf('workspace-archive-v540.js') < scripts.indexOf('workflow-v152.js'));
  assert.equal(scripts.filter(name => name === 'workspace-duplicate-meta-v545.js').length, 1);
  assert.ok(scripts.indexOf('workspace-duplicate-meta-v545.js') < scripts.indexOf('workflow-v152.js'));
  assert.ok(scripts.indexOf('workflow-v152.js') < scripts.indexOf('archive-ui-v182.js'));
  assert.equal(scripts.filter(name => name === 'workspace-duplicate-atomic-v544.js').length, 1);
  assert.ok(scripts.indexOf('archive-ui-v182.js') < scripts.indexOf('workspace-duplicate-atomic-v544.js'));
  assert.ok(scripts.indexOf('workspace-duplicate-atomic-v544.js') < scripts.indexOf('duplicate-merge-v182.js'));
});

test('Ver.246 product: archive and duplicate metadata writers use expected-base child transactions', () => {
  const v152 = read('workflow-v152.js');
  const archiveSource = read('workspace-archive-v540.js');
  const archiveWriter = v152.match(/async function archiveTask\([\s\S]*?\n  \}\n  async function unarchiveTask/)?.[0] || '';
  const unarchiveWriter = v152.match(/async function unarchiveTask\([\s\S]*?\n  \}\n  function normalizeDuplicateValue/)?.[0] || '';
  const sharedArchive = archiveSource.match(/async function archive\([\s\S]*?\n    \}\n\n    async function restore/)?.[0] || '';
  const sharedRestore = archiveSource.match(/async function restore\([\s\S]*?\n    \}\n\n    return Object\.freeze/)?.[0] || '';
  const duplicateWriter = v152.match(/async function markDuplicate\([\s\S]*?\n  \}\n  load\(\)/)?.[0] || '';

  assert.match(archiveWriter, /expectedArchive/);
  assert.match(archiveWriter, /archivePersistence\.archive\(taskId, reason, expectedArchive, arguments\.length >= 3\)/);
  assert.match(sharedArchive, /runTransaction\(/);
  assert.match(sharedArchive, /same\(current, expected\)/);
  assert.match(sharedArchive, /conflict: true/);
  assert.match(sharedArchive, /applyLocally: false/);
  assert.doesNotMatch(sharedArchive, /await r\.set\(/);

  assert.match(unarchiveWriter, /expectedArchive/);
  assert.match(unarchiveWriter, /archivePersistence\.restore\(taskId, expectedArchive, arguments\.length >= 2\)/);
  assert.match(sharedRestore, /runTransaction\(/);
  assert.match(sharedRestore, /same\(current, expected\)/);
  assert.match(sharedRestore, /return null/);
  assert.match(sharedRestore, /conflict: true/);
  assert.match(sharedRestore, /applyLocally: false/);
  assert.doesNotMatch(sharedRestore, /await r\.remove\(/);

  const duplicateOwner = read('workspace-duplicate-meta-v545.js');
  assert.match(v152, /window\.WorkBoardDuplicateMetaV545\.create\(/);
  assert.match(duplicateWriter, /expectedDuplicate/);
  assert.match(duplicateWriter, /return duplicateMetadata\.write\(sourceId,targetId,expectedDuplicate,arguments\.length>=3\)/);
  assert.match(duplicateOwner, /runTransaction\(target, current =>/);
  assert.match(duplicateOwner, /if \(!same\(current, expected\)\)/);
  assert.match(duplicateOwner, /return \{ ok: false, conflict: true \}/);
  assert.match(duplicateOwner, /applyLocally: false/);
  assert.doesNotMatch(duplicateOwner, /await r\.set\(/);
  assert.doesNotMatch(v152, /rooms\/\$\{ROOM_ID\}\/tasks(?:\/|`)/);
});

test('Ver.246 product: archive restore passes the rendered archive record as the expected base', () => {
  const ui = read('archive-ui-v182.js');

  assert.match(ui, /W\.archiveTask\(id,'manual'\)/);
  assert.match(ui, /expected=entries\.find\(x=>x\.id===id\)\?\.info\|\|null/);
  assert.match(ui, /W\.unarchiveTask\(id,expected\)/);
  assert.doesNotMatch(ui, /workflowV152\/archives/);
  assert.doesNotMatch(ui, /\br\.set\(/);
  assert.doesNotMatch(ui, /\br\.remove\(/);
});

test('Ver.246 and 544 product: atomic merge owns the root transaction while Classic keeps confirmation and cleanup', () => {
  const ui = read('duplicate-merge-v182.js');
  const atomic = read('workspace-duplicate-atomic-v544.js');
  const writer = ui.match(/async function mergeDuplicate\([\s\S]*?\n  \}\n  function patchDetail/)?.[0] || '';
  const core = atomic.match(/async function commit\([\s\S]*?\n    \}\n    return Object\.freeze/)?.[0] || '';

  assert.ok(writer, 'Classic mergeDuplicate must remain inspectable');
  assert.ok(core, 'canonical atomic commit must remain inspectable');
  assert.match(ui, /window\.WorkBoardDuplicateAtomicV544\.create\(\{roomId:W\.ROOM_ID\}\)/);
  assert.match(writer, /expectedSourceRevision/);
  assert.match(writer, /expectedTargetRevision/);
  assert.match(writer, /duplicateAtomic\.commit\(\{remote:r,source,target,expectedSourceRevision,expectedTargetRevision,now,me\}\)/);
  assert.match(writer, /dependencyUse\(source\)/);
  assert.match(writer, /if\(!confirm\(/);
  assert.match(core, /r\.runTransaction\(roomRef,current=>/);
  assert.match(core, /if\(current===null\)\{conflictReason='cold';return null\}/);
  assert.match(core, /tx\.committed&&committedValue===null/);
  assert.match(core, /Number\(rawS\.revision\|\|0\)!==expectedSourceRevision/);
  assert.match(core, /Number\(rawT\.revision\|\|0\)!==expectedTargetRevision/);
  assert.match(core, /rawDuplicates\[source\]\|\|rawArchives\[source\]/);
  assert.match(core, /tasks=\{\.\.\.rawTasks,\[target\]:targetNext,\[source\]:sourceNext\}/);
  assert.match(core, /duplicates=\{\.\.\.rawDuplicates,\[source\]:/);
  assert.match(core, /archives=\{\.\.\.rawArchives,\[source\]:/);
  assert.match(core, /return\{\.\.\.room,tasks,workflowV152:/);
  assert.match(core, /conflict:true/);
  assert.match(core, /applyLocally:false/);
  assert.match(core, /統合結果を共同データで確認できませんでした/);
  assert.doesNotMatch(core, /await r\.get\(roomRef\)/);
  assert.doesNotMatch(core, /Promise\.all\(\[r\.get\(sourceRef\),r\.get\(targetRef\)\]\)/);
  assert.doesNotMatch(core, /await r\.update\(roomRef,updates\)/);
  assert.doesNotMatch(atomic, /\blocalStorage\b|\bdocument\b|\bonValue\(/);
  assert.ok(writer.indexOf('await duplicateAtomic.commit(') < writer.indexOf('syncDuplicateCache(source,target,now,me);'));
  assert.ok(writer.indexOf('syncDuplicateCache(source,target,now,me);') < writer.indexOf('W.writeRelations('));
  assert.ok(writer.indexOf('W.writeRelations(') < writer.indexOf('W.writeReminder?.(source,null)'));
});

test('Ver.246 product: responsibility inventory keeps the hardened boundary after later releases', () => {
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  assert.ok(Number(inventory.baselineRelease || 0) >= 246);
  const group = inventory.groups.find(item => item.id === 'workflow-and-detail');
  assert.ok(group);
  const consolidationVersion = Number(String(group.consolidation || '').match(/^consolidated-v(\d+)$/)?.[1] || 0);
  assert.ok(consolidationVersion >= 246);
  assert.match(group.reason, /Ver\.246製品/);
  assert.match(group.reason, /expected-base transaction/);
  assert.match(group.reason, /room root transaction/);
  assert.match(group.reason, /remote winner/);
});
