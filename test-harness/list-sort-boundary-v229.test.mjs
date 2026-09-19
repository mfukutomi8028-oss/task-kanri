import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const savedViews = read('saved-views-v148.js');
const currentColumnSidecar = read('list-column-sort-v239.js');
const auditedColumnSidecar = read('list-column-sort-v229.js');
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

test('Ver.239 list-column sidecar owns secondary sorting and its clear-to-primary rebuild bridge', () => {
  assert.match(currentColumnSidecar, /work-board-list-column-sort:/);
  assert.doesNotMatch(currentColumnSidecar, /work-board-base-sort:/);
  assert.match(currentColumnSidecar, /data-list-sort-key/);
  assert.match(currentColumnSidecar, /list-column-sort-status/);
  assert.match(currentColumnSidecar, /function sortRows\(/);
  assert.match(currentColumnSidecar, /tbody\.appendChild\(fragment\)/);
  assert.match(currentColumnSidecar, /document\.addEventListener\(['"]keydown['"]/);
  assert.match(currentColumnSidecar, /new MutationObserver\(scheduleEnhance\)\.observe\(listView,\s*\{ childList: true, subtree: true \}\)/);
  assert.match(currentColumnSidecar, /function requestPrimarySortRestore\(\)/);
  assert.match(currentColumnSidecar, /select\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/);
  assert.match(currentColumnSidecar, /requestPrimarySortRestore\(\);\s*scheduleEnhance\(\);/s,
    'primary rebuild RAF must be registered before the local enhancement RAF');
});

test('Ver.239 keeps safe sort ownership/load order while retiring the Ver.229 column source from active runtime', () => {
  const dynamicScripts = manifest.match(/dynamicScripts:\s*\[([\s\S]*?)\]/);
  const requiredAssets = manifest.match(/requiredAssets:\s*\[([\s\S]*?)\]/);
  assert.ok(dynamicScripts, 'dynamicScripts inventory must exist');
  assert.ok(requiredAssets, 'requiredAssets inventory must exist');
  const version = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);
  assert.ok(version >= 239, 'Ver.239 list-sort ownership must remain active in later releases');
  assert.match(dynamicScripts[1], /saved-views-v148\.js/);
  assert.match(dynamicScripts[1], /list-column-sort-v239\.js/);
  assert.match(requiredAssets[1], /list-column-sort-v239\.js/);
  assert.doesNotMatch(dynamicScripts[1], /list-column-sort-v229\.js/);
  assert.doesNotMatch(requiredAssets[1], /list-column-sort-v229\.js/);
  assert.doesNotMatch(dynamicScripts[1], /list-sort-v131\.js/);
  assert.doesNotMatch(requiredAssets[1], /list-sort-v131\.js/);
  assert.ok(dynamicScripts[1].indexOf('saved-views-v148.js') < dynamicScripts[1].indexOf('list-column-sort-v239.js'),
    'primary sort persistence must restore before the list-column sidecar initializes');
});

test('Ver.229 audited column source and the combined legacy source remain rollback references', () => {
  assert.match(auditedColumnSidecar, /work-board-list-column-sort:/);
  assert.doesNotMatch(auditedColumnSidecar, /requestPrimarySortRestore/);
  assert.doesNotMatch(auditedColumnSidecar, /dispatchEvent\(new Event\('input'/);
  assert.match(legacy, /work-board-base-sort:/);
  assert.match(legacy, /work-board-list-column-sort:/);
});
