import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [savedViews, index, manifest, responsibilityText, browserRegression, auditRegression, app, css] = await Promise.all([
  read('saved-views-v148.js'),
  read('index.html'),
  read('release-manifest.js'),
  read('patch-responsibilities.json'),
  read('tests/saved-views-retirement-v336.spec.mjs'),
  read('tests/saved-views-legacy-retirement-audit-v335.spec.mjs'),
  read('app.js'),
  read('style.css')
]);
const responsibilities = JSON.parse(responsibilityText);
const browserAudit = await read('tests/saved-views-polling-audit-v334.spec.mjs');

test('Ver.336 product: dormant saved-filter bridge is retired from active runtime', () => {
  assert.doesNotMatch(savedViews, /saveCurrentFilter/);
  assert.doesNotMatch(savedViews, /data-apply-filter/);
  assert.doesNotMatch(savedViews, /savedKey/);
  assert.doesNotMatch(savedViews, /columnKey/);
  assert.doesNotMatch(savedViews, /function\s+(?:ids|snapshot|begin|finish|apply|label)\s*\(/);
  assert.doesNotMatch(savedViews, /setInterval\s*\(/);
  assert.doesNotMatch(savedViews, /setTimeout\s*\(/);
  assert.doesNotMatch(savedViews, /new MutationObserver/);
  assert.doesNotMatch(savedViews, /document\.addEventListener\(['"]click['"]/);
});

test('Ver.336 product: primary sort persistence remains active after later listener-scope cleanup', () => {
  assert.match(savedViews, /work-board-base-sort/);
  assert.match(savedViews, /function currentBaseSort\(\)/);
  assert.match(savedViews, /function persistBaseSort\(\)/);
  assert.match(savedViews, /function restoreBaseSort\(\)/);
  assert.match(savedViews, /document\.getElementById\(['"]sortSelect['"]\)/);
  assert.match(savedViews, /addEventListener\(['"]input['"],\s*persistBaseSort\)/);
  assert.match(savedViews, /DOMContentLoaded/);
});

test('Ver.336 product: legacy controls remain absent and Ver.335 audit evidence is retained', () => {
  assert.doesNotMatch(index, /id=["']saveCurrentFilter["']/);
  assert.doesNotMatch(index, /id=["']savedFilterList["']/);
  assert.doesNotMatch(index, /data-apply-filter=/);
  assert.match(auditRegression, /Ver\.335 audit/);
  assert.match(auditRegression, /saved-views-v148\.js/);
});

test('Ver.336 product: browser regression locks zero dormant registrations and reload persistence', () => {
  assert.match(browserRegression, /saved-views-v148\.js/);
  assert.match(browserRegression, /ownedIntervals/);
  assert.match(browserRegression, /ownedObservers/);
  assert.match(browserRegression, /ownedTimeouts/);
  assert.match(browserRegression, /work-board-base-sort/);
  assert.match(browserRegression, /page\.reload/);
});

test('Ver.336 product: release 284 history remains recorded while later releases stay aligned', () => {
  const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);
  assert.ok(release >= 284, `expected release 284 or later, got ${release}`);
  assert.equal(responsibilities.baselineRelease, String(release));
  const workflowGroup = responsibilities.groups?.find(group => group.id === 'workflow-and-detail');
  assert.match(workflowGroup?.reason || '', /Ver\.335監査/);
  assert.match(workflowGroup?.reason || '', /Ver\.336製品/);
  assert.match(workflowGroup?.reason || '', /release 284/);
  if (release >= 285) assert.match(workflowGroup?.reason || '', /Ver\.338製品/);
});

test('Ver.454: the retired saved-filter pipeline cannot run or write old data', () => {
  const removed = [
    'loadSavedFilters', 'normalizeSavedFilter', 'setSavedFilters',
    'saveSavedFilters', 'allSavedFilters', 'renderSavedFilters',
    'captureCurrentFilter', 'applyFilterValues', 'applySavedFilter',
    'saveCurrentFilterFromPrompt', 'deleteSavedFilter'
  ];
  for (const name of removed) {
    assert.doesNotMatch(app, new RegExp('\\b(?:async\\s+)?function\\s+' + name + '\\s*\\('),
      'retired saved-filter helper must be gone from app.js: ' + name);
  }
  assert.doesNotMatch(app, /DEFAULT_SAVED_FILTERS|state\.savedFilters|meta\.savedFilters|savedFiltersUpdatedAt/);
  assert.doesNotMatch(app, /(?:saveCurrentFilter|savedFilterList):\s*\$\(/);
  assert.doesNotMatch(app, /\b(?:saveCurrentFilter|savedFilterList)\b/);
  assert.match(app, /function savedFiltersKey\(\)/);
  assert.match(app, /system-task-saved-filters:\$\{ROOM_ID\}/,
    'legacy saved-filter cache key must survive for explicit room cache clearing');
  assert.match(app, /function roomCacheKeys\(\)\s*\{[\s\S]*?savedFiltersKey\(\)/,
    'room cache reset must still include the historical key');
  assert.match(app, /function persistMetaFields\(fields\)/,
    'unrelated active Firebase metadata writer must remain');
  assert.match(savedViews, /work-board-base-sort/,
    'active task sort persistence must not be retired');
  assert.match(browserRegression, /Ver\.454 legacy saved filters remain inert/);
});

test('Ver.455: dead saved-filter decorations leave only the stale-HTML visibility guard', () => {
  assert.doesNotMatch(css, /\.saved-filter-list\s*\{\s*display:\s*grid\s*;/);
  assert.doesNotMatch(css, /\.saved-filter-item\s*\{\s*display:\s*grid\s*;/);
  assert.doesNotMatch(css, /\.saved-filter-item\s+button:first-child\s*\{/);
  assert.doesNotMatch(css, /\.delete-saved-filter\s*\{/);
  assert.match(css,
    /\.saved-filters-card\s*,\s*\.saved-filter-list\s*,\s*\.saved-filter-item\s*\{\s*display:\s*none\s*!important\s*;\s*\}/,
    'stale cached HTML must not revive removed saved-filter UI');
  assert.match(index, /class=["']side-card filters["']/,
    'current sidebar filtering section must remain');
  assert.match(index, /id=["']assigneeFilter["']/);
  assert.match(index, /id=["']sortSelect["']/);
  assert.match(savedViews, /work-board-base-sort/,
    'primary sort persistence is still owned by the active sidecar');
  assert.match(browserRegression, /Ver\.455 stale legacy saved-filter markup stays hidden/);
});

// Ver.494: retain Ver.334's three original audit tests and 23 assertions verbatim.
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

test('Ver.334 historical audit remains recorded while Ver.454 removes dead app controls', () => {
  // These two element placeholders existed during the Ver.334 audit, although
  // their HTML nodes were already gone. Ver.454 removes the stale placeholders.
  assert.doesNotMatch(app, /saveCurrentFilter:\s*\$\(["']saveCurrentFilter["']\)/);
  assert.doesNotMatch(app, /savedFilterList:\s*\$\(["']savedFilterList["']\)/);
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
    assert.match(savedViews, /addEventListener\(['"]input['"],\s*persistBaseSort\)/);
    assert.doesNotMatch(savedViews, /handleBaseSortEvent/);
    assert.match(workflowGroup?.reason || '', /Ver\.338製品/);
  }
});

test('Ver.494 retired Ver.334 polling Protocol stays absent', () => {
  assert.equal(existsSync(new URL('./saved-views-polling-v334.test.mjs', import.meta.url)), false);
});
