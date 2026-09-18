import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const savedViews = read('saved-views-v148.js');
const columnSidecar = read('list-column-sort-v229.js');
const legacy = read('list-sort-v131.js');
const manifest = read('release-manifest.js');

test('Ver.229 saved views owns primary task sort persistence and restoration', () => {
  assert.match(savedViews, /work-board-base-sort:/);
  assert.match(savedViews, /VALID_BASE_SORTS/);
  assert.match(savedViews, /localStorage\.setItem\(baseSortKey,\s*value\)/);
  assert.match(savedViews, /select\.dispatchEvent\(new Event\(['"]input['"],\s*\{ bubbles: true \}\)\)/);
  assert.match(savedViews, /document\.addEventListener\(['"]input['"],\s*handleBaseSortEvent,\s*true\)/);
  assert.match(savedViews, /document\.addEventListener\(['"]change['"],\s*handleBaseSortEvent,\s*true\)/);
});

test('Ver.229 list-column sidecar owns only secondary list sorting', () => {
  assert.match(columnSidecar, /work-board-list-column-sort:/);
  assert.doesNotMatch(columnSidecar, /work-board-base-sort:/);
  assert.match(columnSidecar, /data-list-sort-key/);
  assert.match(columnSidecar, /list-column-sort-status/);
  assert.match(columnSidecar, /function sortRows\(/);
  assert.match(columnSidecar, /tbody\.appendChild\(fragment\)/);
  assert.match(columnSidecar, /document\.addEventListener\(['"]keydown['"]/);
  assert.match(columnSidecar, /new MutationObserver\(scheduleEnhance\)\.observe\(listView,\s*\{ childList: true, subtree: true \}\)/);
});

test('Ver.229 activates split ownership in safe load order', () => {
  const dynamicScripts = manifest.match(/dynamicScripts:\s*\[([\s\S]*?)\]/);
  const requiredAssets = manifest.match(/requiredAssets:\s*\[([\s\S]*?)\]/);
  assert.ok(dynamicScripts, 'dynamicScripts inventory must exist');
  assert.ok(requiredAssets, 'requiredAssets inventory must exist');
  assert.match(manifest, /version:\s*["']229["']/);
  assert.match(dynamicScripts[1], /saved-views-v148\.js/);
  assert.match(dynamicScripts[1], /list-column-sort-v229\.js/);
  assert.match(requiredAssets[1], /list-column-sort-v229\.js/);
  assert.doesNotMatch(dynamicScripts[1], /list-sort-v131\.js/);
  assert.doesNotMatch(requiredAssets[1], /list-sort-v131\.js/);
  assert.ok(dynamicScripts[1].indexOf('saved-views-v148.js') < dynamicScripts[1].indexOf('list-column-sort-v229.js'),
    'primary sort persistence must restore before the list-column sidecar initializes');
});

test('Ver.229 retains the combined legacy source only for rollback compatibility', () => {
  assert.match(legacy, /work-board-base-sort:/);
  assert.match(legacy, /work-board-list-column-sort:/);
});
