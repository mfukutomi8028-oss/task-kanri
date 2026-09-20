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
  assert.ok(scripts.indexOf('workflow-v152.js') < scripts.indexOf('archive-ui-v182.js'));
  assert.ok(scripts.indexOf('archive-ui-v182.js') < scripts.indexOf('duplicate-merge-v182.js'));
});

test('Ver.246 product: archive and duplicate metadata writers use expected-base child transactions', () => {
  const v152 = read('workflow-v152.js');
  const archiveWriter = v152.match(/async function archiveTask\([\s\S]*?\n  \}\n  async function unarchiveTask/)?.[0] || '';
  const unarchiveWriter = v152.match(/async function unarchiveTask\([\s\S]*?\n  \}\n  function normalizeDuplicateValue/)?.[0] || '';
  const duplicateWriter = v152.match(/async function markDuplicate\([\s\S]*?\n  \}\n  load\(\)/)?.[0] || '';

  assert.match(archiveWriter, /expectedArchive/);
  assert.match(archiveWriter, /runTransaction\(/);
  assert.match(archiveWriter, /sameArchiveValue/);
  assert.match(archiveWriter, /conflict:true/);
  assert.doesNotMatch(archiveWriter, /await r\.set\(/);

  assert.match(unarchiveWriter, /expectedArchive/);
  assert.match(unarchiveWriter, /runTransaction\(/);
  assert.match(unarchiveWriter, /sameArchiveValue/);
  assert.match(unarchiveWriter, /return null/);
  assert.match(unarchiveWriter, /conflict:true/);
  assert.doesNotMatch(unarchiveWriter, /await r\.remove\(/);

  assert.match(duplicateWriter, /expectedDuplicate/);
  assert.match(duplicateWriter, /runTransaction\(/);
  assert.match(duplicateWriter, /sameDuplicateValue/);
  assert.match(duplicateWriter, /conflict:true/);
  assert.doesNotMatch(duplicateWriter, /await r\.set\(/);
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

test('Ver.246 product: duplicate merge performs revision and workflow-state checks inside one room transaction', () => {
  const merge = read('duplicate-merge-v182.js');
  const writer = merge.match(/async function mergeDuplicate\([\s\S]*?\n  \}\n  function patchDetail/)?.[0] || '';

  assert.ok(writer, 'mergeDuplicate must remain inspectable');
  assert.match(writer, /expectedSourceRevision/);
  assert.match(writer, /expectedTargetRevision/);
  assert.match(writer, /r\.runTransaction\(roomRef,current=>/);
  assert.match(writer, /if\(current===null\)\{conflictReason='cold';return null\}/);
  assert.match(writer, /tx\.committed&&committedValue===null/);
  assert.match(writer, /Number\(rawS\.revision\|\|0\)!==expectedSourceRevision/);
  assert.match(writer, /Number\(rawT\.revision\|\|0\)!==expectedTargetRevision/);
  assert.match(writer, /rawDuplicates\[source\]\|\|rawArchives\[source\]/);
  assert.match(writer, /tasks=\{\.\.\.rawTasks,\[target\]:targetNext,\[source\]:sourceNext\}/);
  assert.match(writer, /duplicates=\{\.\.\.rawDuplicates,\[source\]:/);
  assert.match(writer, /archives=\{\.\.\.rawArchives,\[source\]:/);
  assert.match(writer, /return\{\.\.\.room,tasks,workflowV152:/);
  assert.match(writer, /conflict:true/);
  assert.doesNotMatch(writer, /await r\.get\(roomRef\)/);
  assert.doesNotMatch(writer, /Promise\.all\(\[r\.get\(sourceRef\),r\.get\(targetRef\)\]\)/);
  assert.doesNotMatch(writer, /await r\.update\(roomRef,updates\)/);
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
