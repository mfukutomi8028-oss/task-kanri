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

test('Ver.246 audit: workflow, archive UI, and duplicate merge load once in dependency order', () => {
  const manifest = read('release-manifest.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const version = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);

  assert.ok(version >= 245, 'Ver.246 audit starts from the released Ver.245 runtime');
  for (const asset of ['workflow-v152.js', 'archive-ui-v182.js', 'duplicate-merge-v182.js']) {
    assert.equal(scripts.filter(name => name === asset).length, 1, `${asset} must load exactly once`);
  }
  assert.ok(scripts.indexOf('workflow-v152.js') < scripts.indexOf('archive-ui-v182.js'));
  assert.ok(scripts.indexOf('archive-ui-v182.js') < scripts.indexOf('duplicate-merge-v182.js'));
});

test('Ver.246 audit: v152 archive and duplicate metadata writers use direct child set/remove without expected-base transactions', () => {
  const v152 = read('workflow-v152.js');
  const archiveWriter = v152.match(/async function archiveTask\([\s\S]*?\n  \}\n  async function unarchiveTask/)?.[0] || '';
  const unarchiveWriter = v152.match(/async function unarchiveTask\([\s\S]*?\n  \}\n  function duplicateOf/)?.[0] || '';
  const duplicateWriter = v152.match(/async function markDuplicate\([\s\S]*?\n  \}\n  load\(\)/)?.[0] || '';

  assert.ok(archiveWriter, 'archiveTask must remain inspectable');
  assert.ok(unarchiveWriter, 'unarchiveTask must remain inspectable');
  assert.ok(duplicateWriter, 'markDuplicate must remain inspectable');

  assert.match(archiveWriter, /workflowV152\/archives\/\$\{id\}/);
  assert.match(archiveWriter, /await r\.set\(/);
  assert.doesNotMatch(archiveWriter, /runTransaction\(/);

  assert.match(unarchiveWriter, /workflowV152\/archives\/\$\{id\}/);
  assert.match(unarchiveWriter, /await r\.remove\(/);
  assert.doesNotMatch(unarchiveWriter, /runTransaction\(/);

  assert.match(duplicateWriter, /workflowV152\/duplicates\/\$\{id\}/);
  assert.match(duplicateWriter, /await r\.set\(/);
  assert.doesNotMatch(duplicateWriter, /runTransaction\(/);
  assert.doesNotMatch(v152, /rooms\/\$\{ROOM_ID\}\/tasks(?:\/|`)/);
});

test('Ver.246 audit: archive UI delegates persistence but restore does not pass the rendered archive record as an expected base', () => {
  const ui = read('archive-ui-v182.js');

  assert.match(ui, /W\.archiveTask\(id,'manual'\)/);
  assert.match(ui, /W\.unarchiveTask\(b\.dataset\.restoreArchiveV153\)/);
  assert.doesNotMatch(ui, /workflowV152\/archives/);
  assert.doesNotMatch(ui, /\.set\(/);
  assert.doesNotMatch(ui, /\.remove\(/);
});

test('Ver.246 audit: duplicate merge checks revisions before a later unconditional room update, leaving a TOCTOU conflict window', () => {
  const merge = read('duplicate-merge-v182.js');
  const writer = merge.match(/async function mergeDuplicate\([\s\S]*?\n  \}\n  function patchDetail/)?.[0] || '';

  assert.ok(writer, 'mergeDuplicate must remain inspectable');
  assert.match(writer, /Promise\.all\(\[r\.get\(sourceRef\),r\.get\(targetRef\)\]\)/);
  assert.match(writer, /Number\(rawS\.revision\|\|0\)!==Number\(s\.revision\|\|0\)/);
  assert.match(writer, /Number\(rawT\.revision\|\|0\)!==Number\(t\.revision\|\|0\)/);
  assert.match(writer, /updates\[`tasks\/\$\{target\}`\]=targetNext/);
  assert.match(writer, /updates\[`tasks\/\$\{source\}`\]=sourceNext/);
  assert.match(writer, /updates\[`workflowV152\/duplicates\/\$\{source\}`\]/);
  assert.match(writer, /updates\[`workflowV152\/archives\/\$\{source\}`\]/);
  assert.match(writer, /await r\.update\(roomRef,updates\)/);
  assert.doesNotMatch(writer, /runTransaction\(/);
  assert.match(writer, /verifySource/);
  assert.match(writer, /verifyTarget/);
});

test('Ver.246 audit: responsibility inventory records archive/duplicate conflict evidence and narrows the next product fix', () => {
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  assert.equal(inventory.baselineRelease, '245');
  const group = inventory.groups.find(item => item.id === 'workflow-and-detail');
  assert.ok(group);
  assert.match(group.reason, /Ver\.246監査/);
  assert.match(group.reason, /TOCTOU/);
  assert.match(group.reason, /set\/remove/);

  const next = inventory.priorityCandidates?.[0];
  assert.ok(next);
  assert.equal(next.order, 1);
  assert.deepEqual(next.scope, ['workflow-v152.js', 'archive-ui-v182.js', 'duplicate-merge-v182.js']);
  assert.match(next.goal, /Ver\.246製品/);
  assert.match(next.goal, /remote winner/);
});
