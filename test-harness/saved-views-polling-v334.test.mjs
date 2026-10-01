import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [savedViews, app, index, manifest, responsibilityText, browserAudit] = await Promise.all([
  read('saved-views-v148.js'),
  read('app.js'),
  read('index.html'),
  read('release-manifest.js'),
  read('patch-responsibilities.json'),
  read('tests/saved-views-polling-audit-v334.spec.mjs')
]);
const responsibilities = JSON.parse(responsibilityText);

test('Ver.334 audit evidence: browser audit records the dormant 250ms saved-views polling owner without replacing product source', () => {
  assert.match(browserAudit, /Number\(delay\) === 250 && stack\.includes\('saved-views-v148\.js'\)/);
  assert.match(browserAudit, /expect\(await ownedIntervalCount\(page\)\)\.toBe\(0\)/);
  assert.match(browserAudit, /#saveCurrentFilter/);
  assert.match(browserAudit, /work-board-base-sort/);
  assert.doesNotMatch(browserAudit, /page\.route\([^\n]*saved-views-v148\.js/);
});

test('Ver.334 audit evidence: current HTML still has no legacy saved-filter controls', () => {
  assert.doesNotMatch(index, /id=["']saveCurrentFilter["']/);
  assert.doesNotMatch(index, /id=["']savedFilterList["']/);
  assert.doesNotMatch(index, /data-apply-filter=/);
  assert.doesNotMatch(index, /data-delete-filter=/);
});

test('Ver.334 finding remains valid after later product retirement of the dormant bridge', () => {
  assert.match(app, /saveCurrentFilter:\s*\$\(["']saveCurrentFilter["']\)/);
  assert.match(app, /savedFilterList:\s*\$\(["']savedFilterList["']\)/);
  assert.match(savedViews, /function persistBaseSort\(\)/);
  assert.match(savedViews, /function restoreBaseSort\(\)/);
  assert.match(savedViews, /document\.getElementById\(['"]sortSelect['"]\)/);

  const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);
  assert.ok(release >= 283, `expected release 283 or later, got ${release}`);
  assert.equal(responsibilities.baselineRelease, String(release));

  const workflowGroup = responsibilities.groups?.find(group => group.id === 'workflow-and-detail');
  assert.match(workflowGroup?.reason || '', /Ver\.334監査/);

  if (release >= 284) {
    assert.doesNotMatch(savedViews, /setInterval\s*\(/);
    assert.doesNotMatch(savedViews, /saveCurrentFilter/);
    assert.match(workflowGroup?.reason || '', /Ver\.336製品/);
  }
  if (release >= 285) {
    assert.match(savedViews, /select\.addEventListener\(['"]input['"],\s*persistBaseSort\)/);
    assert.doesNotMatch(savedViews, /document\.addEventListener\(['"]change['"],\s*handleBaseSortEvent,\s*true\)/);
    assert.match(workflowGroup?.reason || '', /Ver\.338製品/);
  }
});
