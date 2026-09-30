import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [unpin, workflowCore, app, manifest, responsibilityText, browserAudit] = await Promise.all([
  read('completion-unpin-v150.js'),
  read('workflow-core-v150.js'),
  read('app.js'),
  read('release-manifest.js'),
  read('patch-responsibilities.json'),
  read('tests/completion-unpin-polling-audit-v330.spec.mjs')
]);
const responsibilities = JSON.parse(responsibilityText);

test('Ver.330 audit: local-only completion repair still owns one 1500ms polling fallback', () => {
  assert.match(unpin, /localRepair\(\);if\(!localTimer\)localTimer=setInterval\(localRepair,1500\)/);
  assert.match(unpin, /window\.addEventListener\('workflow-v150-update',[\s\S]*?localRepair\(\)/);
  assert.match(unpin, /if\(W\.dependencyState\?\.\(\)!=='local-only'\)return/);
  assert.match(unpin, /completed\(t\)&&t\.pinned===true/);
  assert.match(unpin, /pinned:false,revision:Number\(t\.revision\|\|0\)\+1/);
});

test('Ver.330 audit: workflow update is a workflow-core event, not a canonical task-write signal', () => {
  assert.match(workflowCore, /function emit\(\)\{persist\(\);window\.dispatchEvent\(new CustomEvent\('workflow-v148-update'\)\);window\.dispatchEvent\(new CustomEvent\('workflow-v149-update'\)\);window\.dispatchEvent\(new CustomEvent\('workflow-v150-update'\)\)\}/);
  assert.match(workflowCore, /function applyDependenciesLocal[\s\S]*?emit\(\)/);
  assert.match(workflowCore, /function applySavedViewLocal[\s\S]*?emit\(\)/);
  assert.match(workflowCore, /function applyRelationsLocal[\s\S]*?emit\(\)/);
  assert.doesNotMatch(app, /workflow-v150-update/);
});

test('Ver.330 audit: canonical status completion does not itself clear pinned state', () => {
  const transition = app.match(/async function transitionTaskStatus\(task, status, memo = ""\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.ok(transition.length > 0, 'canonical transitionTaskStatus must exist');
  assert.match(transition, /draft\.status = status/);
  assert.match(transition, /if \(isCompletedStatus\(status\)\)/);
  assert.doesNotMatch(transition, /draft\.pinned\s*=\s*false/);
  assert.doesNotMatch(transition, /pinned\s*:\s*false/);
});

test('Ver.330 audit: remote completion repair remains subscription-driven and transaction-protected', () => {
  assert.match(unpin, /remote\.onValue\(tasksRef/);
  assert.match(unpin, /remote\.runTransaction\(target,current=>/);
  assert.match(unpin, /String\(current\.status\|\|''\)!=='完了'\|\|current\.pinned!==true/);
  assert.match(unpin, /applyLocally:false/);
});

test('Ver.330 audit remains valid after later releases and browser audit measures the active runtime without product replacement', () => {
  const release = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);
  assert.ok(release >= 282);
  assert.equal(String(responsibilities.baselineRelease), String(release));
  assert.match(browserAudit, /setInterval/);
  assert.match(browserAudit, /workflow-v150-update/);
  assert.match(browserAudit, /system-task-tasks:/);
  assert.doesNotMatch(browserAudit, /page\.route\([^\n]*completion-unpin-v150\.js/);
});
