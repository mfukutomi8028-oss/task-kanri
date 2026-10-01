import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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
