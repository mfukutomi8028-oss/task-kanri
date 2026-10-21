import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

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

test('Ver.248 product: saved-view write keeps exact server metadata protection after legacy UI retirement', () => {
  assert.match(workflow, /async function writeSavedView\(id,view,expectedView\)/);
  assert.match(workflow, /sameSavedViewValue\(current,expected\)/);
  assert.match(workflow, /updatedAt:Number\(item\.updatedAt\|\|0\)/);
  assert.match(workflow, /runTransaction\(target,current=>\{if\(!sameSavedViewValue\(current,expected\)\)/);
  assert.match(workflow, /writeDependencies,writeSavedView,writeRelations,writeReminder/);
  assert.doesNotMatch(savedViews, /writeSavedView\(/);
  assert.doesNotMatch(savedViews, /saveCurrentFilter/);
  assert.match(inventory.groups?.find(item => item.id === 'workflow-and-detail')?.reason || '', /Ver\.336製品/);
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
  const runner = read('test-harness/run-firebase-grep-audits-v480.mjs');
  assert.match(pkg.scripts?.['test:firebase:browser'] || '', /run-firebase-browser\.mjs && node test-harness\/run-firebase-grep-audits-v480\.mjs/);
  for (const phrase of ['stale dependency edit preserves the remote winner','stale saved view preserves newer server metadata','stale relation edit preserves newer peer','relation writer repairs a reverse-only orphan edge']) assert.ok(runner.includes(`'${phrase}'`));
  assert.match(runner, /spawnSync\(process\.execPath/);
  assert.match(runner, /WORK_BOARD_FIREBASE_E2E: '1'/);
  assert.match(runner, /--workers=1', '--grep', grep/);
  assert.match(runner, /if \(result\.error\)/);
  assert.match(runner, /if \(\(result\.status \?\? 1\) !== 0\)/);
});

test('Ver.248 product: inventory keeps the hardened workflowV148 boundary in later releases', () => {
  assert.ok(Number(inventory.baselineRelease || 0) >= 248,
    `expected responsibility baseline Ver.248 or later, got ${inventory.baselineRelease}`);
  assert.equal(inventory.groups?.find(item => item.id === 'workflow-and-detail')?.consolidation, 'consolidated-v248');
});

// Ver.519: retained unchanged Ver.332 Protocol checks after owner co-location.
{
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [dependencies, workflowCore, manifest, responsibilityText, browserProduct] = await Promise.all([
  read('dependencies-v149.js'),
  read('workflow-core-v150.js'),
  read('release-manifest.js'),
  read('patch-responsibilities.json'),
  read('tests/dependencies-polling-audit-v331.spec.mjs')
]);
const responsibilities = JSON.parse(responsibilityText);

test('Ver.332 product: dependency sidecar keeps event and DOM reconciliation while retiring the 60s timer', () => {
  assert.match(dependencies, /window\.addEventListener\('workflow-v148-update',schedule\)/);
  assert.match(dependencies, /window\.addEventListener\('workflow-v149-update',schedule\)/);
  assert.match(dependencies, /new MutationObserver\([\s\S]*?schedule\(\)[\s\S]*?mainContent/);
  assert.doesNotMatch(dependencies, /setInterval\(schedule,60000\)/);
  assert.match(dependencies, /window\.WorkBoardCompletionGuardV149=\{guardCompletion,blockers,wouldCycle\}/);
  assert.match(dependencies, /patch\(\);\s*\n?\}\)\(\);/);
});

test('Ver.332 product: workflow dependency writes keep explicit reconciliation events', () => {
  assert.match(workflowCore, /function emit\(\)\{persist\(\);window\.dispatchEvent\(new CustomEvent\('workflow-v148-update'\)\);window\.dispatchEvent\(new CustomEvent\('workflow-v149-update'\)\);window\.dispatchEvent\(new CustomEvent\('workflow-v150-update'\)\)\}/);
  assert.match(workflowCore, /function applyDependenciesLocal[\s\S]*?emit\(\)/);
  assert.match(workflowCore, /async function writeDependencies[\s\S]*?applyDependenciesLocal/);
});

test('Ver.332 product: browser regression exercises the active runtime and proves no dependency 60s timer is registered', () => {
  assert.match(browserProduct, /Number\(delay\) === 60000 && stack\.includes\('dependencies-v149\.js'\)/);
  assert.match(browserProduct, /owned60s: window\.__v332DependencyIntervals\.length/);
  assert.match(browserProduct, /toEqual\(\{ owned60s: 0 \}\)/);
  assert.match(browserProduct, /data-quick-task-status/);
  assert.match(browserProduct, /data-remove-dependency-v149/);
  assert.doesNotMatch(browserProduct, /page\.route\([^\n]*dependencies-v149\.js/);
});

test('Ver.332 product: release 283 promotion remains recorded in later aligned releases', () => {
  const release = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);
  assert.ok(release >= 283, `expected release 283 or later, got ${release}`);
  assert.equal(responsibilities.baselineRelease, String(release));

  const workflowGroup = responsibilities.groups?.find(group => group.id === 'workflow-and-detail');
  assert.match(workflowGroup?.reason || '', /Ver\.331監査/);
  assert.match(workflowGroup?.reason || '', /Ver\.332製品/);
  assert.match(workflowGroup?.reason || '', /release 283/);
});
}
