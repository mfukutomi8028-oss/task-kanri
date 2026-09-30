import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [savedViews, app, manifest, responsibilityText, browserAudit] = await Promise.all([
  read('saved-views-v148.js'),
  read('app.js'),
  read('release-manifest.js'),
  read('patch-responsibilities.json'),
  read('tests/saved-views-polling-audit-v334.spec.mjs')
]);
const responsibilities = JSON.parse(responsibilityText);

test('Ver.334 audit: saved views currently retries every 250ms up to 24 times', () => {
  assert.match(savedViews, /const timer = setInterval\(async \(\) => \{/);
  assert.match(savedViews, /attempts \+= 1/);
  assert.match(savedViews, /attempts >= 24/);
  assert.match(savedViews, /\}, 250\);/);
  assert.match(savedViews, /const created = \[\.\.\.ids\(\)\]\.find\(id => !ctx\.before\.has\(id\)\)/);
});

test('Ver.334 audit: canonical filter save publishes the new id to localStorage before awaiting shared persistence', () => {
  assert.match(app, /state\.savedFilters = \[\.\.\.state\.savedFilters, \{ id: `filter-\$\{Date\.now\(\)\.toString\(36\)\}-\$\{Math\.random\(\)\.toString\(36\)\.slice\(2,8\)\}`/);
  assert.match(app, /const result = await saveSavedFilters\(\)/);
  assert.match(app, /async function saveSavedFilters\(\) \{\s*localStorage\.setItem\(savedFiltersKey\(\), JSON\.stringify\(state\.savedFilters\)\);\s*return persistMetaFields/);
});

test('Ver.334 audit: browser test suppresses only the saved-views-owned timer and proves the id exists before its first tick', () => {
  assert.match(browserAudit, /Number\(delay\) === 250 && stack\.includes\('saved-views-v148\.js'\)/);
  assert.match(browserAudit, /idsAtRegistration/);
  assert.match(browserAudit, /expect\(registration\.idsAtRegistration\)\.toContain\(filter\.id\)/);
  assert.match(browserAudit, /await invokeOwnedPoll\(page\)/);
  assert.match(browserAudit, /for \(let i = 0; i < 24; i \+= 1\) await invokeOwnedPoll\(page\)/);
  assert.doesNotMatch(browserAudit, /page\.route\([^\n]*saved-views-v148\.js/);
});

test('Ver.334 audit: release and responsibility baseline remain 283 because product runtime is unchanged', () => {
  const release = manifest.match(/version:\s*"(\d+)"/)?.[1];
  assert.equal(release, '283');
  assert.equal(responsibilities.baselineRelease, '283');
});
