import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const workflow = read('workflow-core-v150.js');
const dependencies = read('dependencies-v149.js');
const savedViews = read('saved-views-v148.js');
const relationships = read('relationships-v152.js');
const inventory = JSON.parse(read('patch-responsibilities.json'));

test('Ver.248 product boundary stays active in Ver.248 or later releases', () => {
  const manifest = read('release-manifest.js');
  const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);
  assert.ok(release >= 248, `expected Ver.248 or later, got ${release}`);
  assert.match(manifest, new RegExp(`const VERSION = ["']${release}["']`));
  for (const asset of ['workflow-core-v150.js', 'dependencies-v149.js', 'saved-views-v148.js', 'relationships-v152.js']) assert.ok(manifest.includes(asset));
});

test('Ver.248 product: dependency write commits only against rendered expected base', () => {
  assert.match(workflow, /async function writeDependencies\(taskId,ids,expectedIds\)/);
  assert.match(workflow, /sameIdList\(current,expected,id\)/);
  assert.match(workflow, /conflict:true/);
  assert.match(dependencies, /writeDependencies\(task\.id,\[\.\.\.ids,id\],ids\)/);
  assert.match(dependencies, /writeDependencies\(task\.id,ids\.filter\([^\n]+,ids\)/);
});

test('Ver.248 product: saved-view write protects exact server metadata and UI create expects null', () => {
  assert.match(workflow, /async function writeSavedView\(id,view,expectedView\)/);
  assert.match(workflow, /sameSavedViewValue\(current,expected\)/);
  assert.match(workflow, /updatedAt:Number\(item\.updatedAt\|\|0\)/);
  assert.match(savedViews, /writeSavedView\(created, view, null\)/);
  assert.match(savedViews, /if \(result\?\.ok\) W\.notify/);
});

test('Ver.248 product: relation root transaction protects direct base and repairs reverse-only edges', () => {
  assert.match(workflow, /async function writeRelations\(taskId,ids,expectedIds\)/);
  assert.match(workflow, /const direct=normalizeIdList\(next\[id\],id\)/);
  assert.match(workflow, /sameIdList\(direct,expected,id\)/);
  assert.match(workflow, /Object\.entries\(next\).*map&&typeof map==='object'&&map\[id\]===true/s);
  assert.match(relationships, /writeRelations\(id,\[\.\.\.ids,other\],ids\)/);
  assert.match(relationships, /writeRelations\(id,ids\.filter\([^\n]+,ids\)/);
});

test('Ver.248 product: four emulator regressions run in isolated browser processes', () => {
  const pkg = JSON.parse(read('package.json'));
  const runner = read('test-harness/run-firebase-v248-audit.mjs');
  assert.match(pkg.scripts?.['test:firebase:browser'] || '', /run-firebase-browser\.mjs && node test-harness\/run-firebase-v248-audit\.mjs/);
  for (const phrase of ['stale dependency edit preserves the remote winner','stale saved view preserves newer server metadata','stale relation edit preserves newer peer','relation writer repairs a reverse-only orphan edge']) assert.ok(runner.includes(`'${phrase}'`));
  assert.match(runner, /spawnSync\(process\.execPath/);
});

test('Ver.248 product: inventory keeps the hardened workflowV148 boundary in later releases', () => {
  assert.ok(Number(inventory.baselineRelease || 0) >= 248,
    `expected responsibility baseline Ver.248 or later, got ${inventory.baselineRelease}`);
  assert.equal(inventory.groups?.find(item => item.id === 'workflow-and-detail')?.consolidation, 'consolidated-v248');
});
