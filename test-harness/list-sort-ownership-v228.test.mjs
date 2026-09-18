import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('app.js');
const sidecar = read('list-sort-v131.js');
const manifest = read('release-manifest.js');

test('Ver.228 app owns the primary task sort before list DOM rendering', () => {
  assert.match(app, /sortSelect:\s*\$\(["']sortSelect["']\)/);
  assert.match(app, /elements\.sortSelect[\s\S]*?addEventListener\(["']input["'],\s*render\)/);
  assert.match(app, /const sort = elements\.sortSelect\.value;[\s\S]*?tasks\.sort\(\(a,b\)\s*=>\s*\{/);
  assert.match(app, /sort === ["']updated["'][\s\S]*?b\.updatedAt - a\.updatedAt/);
  assert.match(app, /sort === ["']priority["'][\s\S]*?PRIORITY_ORDER/);
  assert.match(app, /sort === ["']due["'][\s\S]*?dueScore/);
  assert.match(app, /sort:\s*elements\.sortSelect\.value/);
  assert.match(app, /if \(filter\.sort\) elements\.sortSelect\.value = filter\.sort/);
});

test('Ver.228 list-sort sidecar owns persistence and secondary column enhancement', () => {
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

test('Ver.228 audit keeps list-sort-v131 active while the ownership boundary is measured', () => {
  const dynamicScripts = manifest.match(/dynamicScripts:\s*\[([\s\S]*?)\]/);
  const requiredAssets = manifest.match(/requiredAssets:\s*\[([\s\S]*?)\]/);
  assert.ok(dynamicScripts, 'dynamicScripts inventory must exist');
  assert.ok(requiredAssets, 'requiredAssets inventory must exist');
  assert.match(dynamicScripts[1], /list-sort-v131\.js/);
  assert.match(requiredAssets[1], /list-sort-v131\.js/);
});
