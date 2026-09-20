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

test('Ver.248 audit: workflowV148 writers remain active while release stays Ver.247', () => {
  const manifest = read('release-manifest.js');
  assert.match(manifest, /VERSION\s*=\s*['"]247['"]/);
  for (const asset of ['workflow-core-v150.js', 'dependencies-v149.js', 'saved-views-v148.js', 'relationships-v152.js']) {
    assert.ok(manifest.includes(asset), `${asset} must remain active during audit`);
  }
});

test('Ver.248 audit: dependency write replaces one task map without comparing a rendered expected base', () => {
  assert.match(workflow, /async function writeDependencies\(taskId,ids\)/);
  assert.match(workflow, /workflowV148\/dependencies\/\$\{taskId\}/);
  assert.match(workflow, /runTransaction\(target,\(\)=>clean\.length\?next:null/);
  assert.doesNotMatch(workflow, /writeDependencies\([^)]*expected/i);
  assert.match(dependencies, /W\.writeDependencies\(task\.id,\[\.\.\.ids,id\]\)/);
  assert.match(dependencies, /W\.writeDependencies\(task\.id,ids\.filter/);
});

test('Ver.248 audit: saved-view write ignores server updatedAt ordering', () => {
  assert.match(workflow, /async function writeSavedView\(id,view\)/);
  assert.match(workflow, /workflowV148\/savedViews\/\$\{id\}/);
  assert.match(workflow, /runTransaction\(target,\(\)=>view/);
  assert.doesNotMatch(workflow, /current[^\n]{0,160}updatedAt/);
  assert.match(savedViews, /updatedAt:\s*Date\.now\(\)/);
  assert.match(savedViews, /W\.writeSavedView\(created, view\)/);
});

test('Ver.248 audit: relation root transaction can interpret a stale rendered set as authoritative', () => {
  assert.match(workflow, /async function writeRelations\(taskId,ids\)/);
  assert.match(workflow, /workflowV148\/relations/);
  assert.match(workflow, /previous=Object\.keys\(next\[id\]/);
  assert.match(workflow, /if\(clean\.includes\(other\)\)peer\[id\]=true;else delete peer\[id\]/);
  assert.match(relationships, /W\.writeRelations\(id,\[\.\.\.ids,other\]\)/);
  assert.match(relationships, /W\.writeRelations\(id,ids\.filter/);
});

test('Ver.248 audit: four emulator reproductions run in isolated browser processes', () => {
  const pkg = JSON.parse(read('package.json'));
  const runner = read('test-harness/run-firebase-v248-audit.mjs');
  assert.match(pkg.scripts?.['test:firebase:browser'] || '', /run-firebase-browser\.mjs && node test-harness\/run-firebase-v248-audit\.mjs/);
  assert.match(runner, /firebase-emulator-workflow-v148-audit-v248\.spec\.mjs/);
  assert.equal((runner.match(/'stale dependency edit overwrites a newer remote dependency'/g) || []).length, 1);
  assert.equal((runner.match(/'stale saved view can replace a newer server view'/g) || []).length, 1);
  assert.equal((runner.match(/'stale relation edit removes a newer remote peer'/g) || []).length, 1);
  assert.equal((runner.match(/'relation writer does not repair a reverse-only orphan edge'/g) || []).length, 1);
  assert.match(runner, /spawnSync\(process\.execPath/);
  assert.match(runner, /WORK_BOARD_FIREBASE_E2E:\s*'1'/);
});

test('Ver.248 audit: inventory keeps workflowV148 concurrency audit as the next product boundary', () => {
  assert.equal(inventory.baselineRelease, '247');
  const candidate = inventory.priorityCandidates?.find(item => item.order === 1);
  assert.ok(candidate);
  assert.deepEqual(candidate.scope, ['workflow-core-v150.js', 'dependencies-v149.js', 'saved-views-v148.js', 'relationships-v152.js']);
  assert.match(candidate.goal, /Ver\.248監査/);
  assert.match(candidate.goal, /stale overwrite/);
  assert.match(candidate.goal, /双方向整合性/);
  assert.match(candidate.precondition, /main Regression、Pagesがgreen/);
});
