import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [dependencies, workflowCore, manifest, responsibilityText, browserAudit] = await Promise.all([
  read('dependencies-v149.js'),
  read('workflow-core-v150.js'),
  read('release-manifest.js'),
  read('patch-responsibilities.json'),
  read('tests/dependencies-polling-audit-v331.spec.mjs')
]);
const responsibilities = JSON.parse(responsibilityText);

test('Ver.331 audit: dependency sidecar still owns one 60s reconciliation fallback during audit', () => {
  assert.match(dependencies, /window\.addEventListener\('workflow-v148-update',schedule\)/);
  assert.match(dependencies, /window\.addEventListener\('workflow-v149-update',schedule\)/);
  assert.match(dependencies, /new MutationObserver\([\s\S]*?schedule\(\)[\s\S]*?mainContent/);
  assert.match(dependencies, /setInterval\(schedule,60000\)/);
  assert.match(dependencies, /window\.WorkBoardCompletionGuardV149=\{guardCompletion,blockers,wouldCycle\}/);
});

test('Ver.331 audit: workflow dependency writes already emit explicit reconciliation events', () => {
  assert.match(workflowCore, /function emit\(\)\{persist\(\);window\.dispatchEvent\(new CustomEvent\('workflow-v148-update'\)\);window\.dispatchEvent\(new CustomEvent\('workflow-v149-update'\)\);window\.dispatchEvent\(new CustomEvent\('workflow-v150-update'\)\)\}/);
  assert.match(workflowCore, /function applyDependenciesLocal[\s\S]*?emit\(\)/);
  assert.match(workflowCore, /async function writeDependencies[\s\S]*?applyDependenciesLocal/);
});

test('Ver.331 audit: browser candidate suppresses only the dependencies-owned 60s interval and keeps active runtime intact', () => {
  assert.match(browserAudit, /Number\(delay\) === 60000 && stack\.includes\('dependencies-v149\.js'\)/);
  assert.match(browserAudit, /callbacks: 0, suppressed: true/);
  assert.match(browserAudit, /data-quick-task-status/);
  assert.match(browserAudit, /data-remove-dependency-v149/);
  assert.doesNotMatch(browserAudit, /page\.route\([^\n]*dependencies-v149\.js/);
});

test('Ver.331 audit: release and baseline remain 282 because product runtime is unchanged', () => {
  const release = manifest.match(/version:\s*"(\d+)"/)?.[1];
  assert.equal(release, '282');
  assert.equal(responsibilities.baselineRelease, '282');
});
