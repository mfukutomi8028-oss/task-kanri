import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [savedViews, app, index, manifest, responsibilityText, browserProduct] = await Promise.all([
  read('saved-views-v148.js'),
  read('app.js'),
  read('index.html'),
  read('release-manifest.js'),
  read('patch-responsibilities.json'),
  read('tests/saved-views-polling-v334.spec.mjs')
]);
const responsibilities = JSON.parse(responsibilityText);

test('Ver.334 product: saved-view completion retires the 250ms retry polling without adding another completion observer', () => {
  assert.doesNotMatch(savedViews, /setInterval\s*\(/);
  assert.doesNotMatch(savedViews, /attempts\s*>=\s*24/);
  assert.doesNotMatch(savedViews, /\},\s*250\s*\)/);
  assert.doesNotMatch(savedViews, /saveObserver/);
  assert.doesNotMatch(savedViews, /savedFilterList/);
  assert.match(savedViews, /if \(event\.target\.closest\?\.\('#saveCurrentFilter'\)\) \{ begin\(\); setTimeout\(finish, 0\); return; \}/);
});

test('Ver.334 product: the compatibility handoff relies on the canonical synchronous saved-filter cache write', () => {
  assert.match(savedViews, /ctx\s*=\s*\{\s*before:\s*ids\(\),\s*view:\s*snapshot\(\)\s*\}/);
  assert.match(savedViews, /const created = \[\.\.\.ids\(\)\]\.find\(id => !ctx\.before\.has\(id\)\)/);
  assert.match(savedViews, /ctx\s*=\s*null;\s*\n\s*if \(!created\) return;/);
  assert.match(savedViews, /W\.writeSavedView\(created,\s*view,\s*null\)/);

  assert.match(app, /async function saveSavedFilters\(\) \{\s*\n\s*localStorage\.setItem\(savedFiltersKey\(\), JSON\.stringify\(state\.savedFilters\)\);\s*\n\s*return persistMetaFields/);
  assert.match(app, /state\.savedFilters = \[\.\.\.state\.savedFilters, \{ id: `filter-\$\{Date\.now\(\)\.toString\(36\)\}-\$\{Math\.random\(\)\.toString\(36\)\.slice\(2,8\)\}`,[\s\S]*?const result = await saveSavedFilters\(\)/);
});

test('Ver.334 product: current product has no legacy saved-filter create/list controls and active browser coverage stays on live sort ownership', () => {
  assert.doesNotMatch(index, /id=["']saveCurrentFilter["']/);
  assert.doesNotMatch(index, /id=["']savedFilterList["']/);
  assert.match(browserProduct, /#saveCurrentFilter/);
  assert.match(browserProduct, /toHaveCount\(0\)/);
  assert.match(browserProduct, /#sortSelect/);
  assert.match(browserProduct, /work-board-base-sort/);
  assert.match(browserProduct, /stack\.includes\('saved-views-v148\.js'\)/);
  assert.match(browserProduct, /ownedIntervals/);
  assert.doesNotMatch(browserProduct, /page\.route\([^\n]*saved-views-v148\.js/);
});

test('Ver.334 product: release and responsibility baseline advance together to 284', () => {
  const release = manifest.match(/version:\s*"(\d+)"/)?.[1];
  assert.equal(release, '284');
  assert.equal(responsibilities.baselineRelease, '284');

  const workflowGroup = responsibilities.groups?.find(group => group.id === 'workflow-and-detail');
  assert.match(workflowGroup?.reason || '', /Ver\.334製品/);
  assert.match(workflowGroup?.reason || '', /saved-views-v148\.js/);
  assert.match(workflowGroup?.reason || '', /release 284/);

  const next = responsibilities.priorityCandidates?.[0];
  assert.deepEqual(next?.scope, ['saved-views-v148.js']);
  assert.match(next?.goal || '', /Ver\.335/);
  assert.match(next?.precondition || '', /Ver\.334/);
});
