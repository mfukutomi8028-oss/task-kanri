import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FROZEN_RETIRED_JS_BLOBS_V418 } from './build-pages-runtime-v382.mjs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('app.js');
const savedViews = read('saved-views-v148.js');
const columnSidecar = read('list-column-sort-v229.js');
const legacy = JSON.parse(read('compat/frozen-legacy-runtime-v397.json'))['list-sort-v131.js'];
const sidecar = legacy; // Same immutable Ver.228 archive; do not load it twice.
const manifest = read('release-manifest.js');
const releaseVersion = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

// Ver.489: original three Ver.228 assertions are preserved verbatim here.
test('Ver.228 app owns the primary task sort before list DOM rendering', () => {
  assert.match(app, /sortSelect:\s*\$\(["']sortSelect["']\)/);
  assert.match(app, /elements\.sortSelect[\s\S]*?addEventListener\(["']input["'],\s*render\)/);
  assert.match(app, /const sort = elements\.sortSelect\.value;[\s\S]*?tasks\.sort\(\(a,b\)\s*=>\s*\{/);
  assert.match(app, /sort === ["']updated["'][\s\S]*?b\.updatedAt - a\.updatedAt/);
  assert.match(app, /sort === ["']priority["'][\s\S]*?PRIORITY_ORDER/);
  assert.match(app, /sort === ["']due["'][\s\S]*?dueScore/);
  // Ver.454: dormant saved-filter capture/apply was removed; the canonical
  // sort remains in getFilteredTasks() and flows into the list renderer.
  assert.match(app, /function renderCore\(\)[\s\S]*?const tasks = getFilteredTasks\(\);[\s\S]*?renderList\(tasks\);/);
  assert.doesNotMatch(app, /function applyFilterValues\(/);
});

test('Ver.228 measured the combined legacy sidecar persistence and secondary column enhancement', () => {
  assert.match(sidecar, /work-board-base-sort:/);
  assert.match(sidecar, /work-board-list-column-sort:/);
  assert.match(sidecar, /data-list-sort-key/);
  assert.match(sidecar, /list-column-sort-status/);
  assert.match(sidecar, /function sortRows\(/);
  assert.match(sidecar, /tbody\.appendChild\(fragment\)/);
  assert.match(sidecar, /document\.addEventListener\(["']click["']/);
  assert.match(sidecar, /document\.addEventListener\(["']keydown["']/);
  assert.match(sidecar, /new MutationObserver\(scheduleEnhance\)\.observe\(listView,\s*\{ childList: true, subtree: true \}\)/);
});

test('Ver.229 keeps the Ver.228 combined sidecar only as an inactive rollback reference', () => {
  const dynamicScripts = manifest.match(/dynamicScripts:\s*\[([\s\S]*?)\]/);
  const requiredAssets = manifest.match(/requiredAssets:\s*\[([\s\S]*?)\]/);
  assert.ok(dynamicScripts, 'dynamicScripts inventory must exist');
  assert.ok(requiredAssets, 'requiredAssets inventory must exist');
  assert.doesNotMatch(dynamicScripts[1], /list-sort-v131\.js/);
  assert.doesNotMatch(requiredAssets[1], /list-sort-v131\.js/);
  assert.equal(fs.existsSync(new URL('../list-sort-v131.js', import.meta.url)), false,
    'historical combined list sorter must leave Git root');
  assert.equal(typeof sidecar, 'string', 'old list sorter source must remain archived');
  assert.equal(FROZEN_RETIRED_JS_BLOBS_V418['list-sort-v131.js'],
    'c2261cdd64457eef94b8e0ace3fa1cbfbefae998', 'original list sorter Git SHA stays pinned');
});

// Original Ver.229 assertions remain unchanged below.
test('Ver.229 saved views owns primary task sort persistence and restoration', () => {
  assert.match(savedViews, /work-board-base-sort:/);
  assert.match(savedViews, /VALID_BASE_SORTS/);
  assert.match(savedViews, /localStorage\.setItem\(baseSortKey,\s*value\)/);
  assert.match(savedViews, /select\.dispatchEvent\(new Event\(['"]input['"],\s*\{ bubbles: true \}\)\)/);
  assert.match(savedViews, /document\.getElementById\(['"]sortSelect['"]\)/);
  assert.match(savedViews, /addEventListener\(['"]input['"],\s*persistBaseSort\)/);
});

test('Ver.229 list-column sidecar owns only secondary list sorting', () => {
  assert.match(columnSidecar, /work-board-list-column-sort:/);
  assert.doesNotMatch(columnSidecar, /work-board-base-sort:/);
  assert.match(columnSidecar, /data-list-sort-key/);
  assert.match(columnSidecar, /list-column-sort-status/);
  assert.match(columnSidecar, /function sortRows\(/);
  assert.match(columnSidecar, /tbody\.appendChild\(fragment\)/);
  assert.match(columnSidecar, /document\.querySelector\(LIST_SELECTOR\)\?\.addEventListener\(['"]click['"]/);
  assert.match(columnSidecar, /document\.querySelector\(LIST_SELECTOR\)\?\.addEventListener\(['"]keydown['"]/);
  assert.doesNotMatch(columnSidecar, /document\.addEventListener\(['"](?:click|keydown)['"]/);

  if (releaseVersion >= 288) {
    assert.match(columnSidecar, /function containsCanonicalListRender\(records\)/);
    assert.match(columnSidecar, /if \(!containsCanonicalListRender\(records\)\) return;/);
    assert.match(columnSidecar, /new MutationObserver\(handleObservedListRender\)\.observe\(listView,\s*\{ childList: true \}\)/);
    assert.doesNotMatch(columnSidecar, /new MutationObserver\([^)]*\)\.observe\(listView,\s*\{ childList: true, subtree: true \}\)/);
  } else {
    assert.match(columnSidecar, /new MutationObserver\(scheduleEnhance\)\.observe\(listView,\s*\{ childList: true, subtree: true \}\)/);
  }
});

test('Ver.229 split ownership remains active in later releases and keeps safe load order', () => {
  const dynamicScripts = manifest.match(/dynamicScripts:\s*\[([\s\S]*?)\]/);
  const requiredAssets = manifest.match(/requiredAssets:\s*\[([\s\S]*?)\]/);
  assert.ok(dynamicScripts, 'dynamicScripts inventory must exist');
  assert.ok(requiredAssets, 'requiredAssets inventory must exist');
  const version = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);
  assert.ok(version >= 229, 'Ver.229 list-sort ownership must remain active in later releases');
  assert.match(dynamicScripts[1], /saved-views-v148\.js/);
  assert.match(dynamicScripts[1], /list-column-sort-v229\.js/);
  assert.match(requiredAssets[1], /list-column-sort-v229\.js/);
  assert.doesNotMatch(dynamicScripts[1], /list-sort-v131\.js/);
  assert.doesNotMatch(requiredAssets[1], /list-sort-v131\.js/);
  assert.ok(dynamicScripts[1].indexOf('saved-views-v148.js') < dynamicScripts[1].indexOf('list-column-sort-v229.js'),
    'primary sort persistence must restore before the list-column sidecar initializes');
});

test('Ver.229 retains the combined legacy source only for rollback compatibility', () => {
  assert.equal(typeof legacy, 'string', 'old combined sort source must remain archived');
  assert.match(legacy, /work-board-base-sort:/);
  assert.match(legacy, /work-board-list-column-sort:/);
});

// The direct Protocol runner discovers every *.test.mjs independently.
test('Ver.489 consolidates legacy sort ownership without the superseded Ver.228 test file', () => {
  assert.equal(fs.existsSync(new URL('./list-sort-ownership-v228.test.mjs', import.meta.url)), false,
    'Ver.228 assertions belong to the canonical Ver.229 boundary suite');
});
