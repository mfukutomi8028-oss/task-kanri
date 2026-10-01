import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function inspectAsset(asset) {
  const source = read(asset);
  return {
    asset,
    bytes: Buffer.byteLength(source, 'utf8'),
    mutationObservers: count(source, /new\s+MutationObserver\s*\(/g),
    documentAdds: count(source, /document\.addEventListener\s*\(/g),
    documentRemoves: count(source, /document\.removeEventListener\s*\(/g),
    windowAdds: count(source, /window\.addEventListener\s*\(/g),
    windowRemoves: count(source, /window\.removeEventListener\s*\(/g),
    mediaAdds: count(source, /(?:matchMedia\([^)]*\)|\bmedia\w*)\.addEventListener\s*\(/g),
    intervals: count(source, /\bsetInterval\s*\(/g),
    timeouts: count(source, /\b(?:window\.)?setTimeout\s*\(/g),
    animationFrames: count(source, /\brequestAnimationFrame\s*\(/g)
  };
}

function activeInventory() {
  const manifest = read('release-manifest.js');
  const dynamicScripts = extractStringArray(manifest, 'dynamicScripts');
  const mobileScripts = extractStringArray(manifest, 'mobileScripts');
  const assets = ['release-manifest.js', 'app.js', 'config.js', ...dynamicScripts, ...mobileScripts];
  assert.equal(new Set(assets).size, assets.length, 'active JavaScript inventory must not contain duplicates');
  for (const asset of assets) {
    assert.ok(fs.existsSync(path.join(ROOT, asset)), `active runtime asset is missing: ${asset}`);
  }
  return assets.map(inspectAsset);
}

test('Ver.345 audit re-inventories every active JavaScript runtime wakeup owner at Release 288+', () => {
  const inventory = activeInventory();
  const keys = [
    'mutationObservers', 'documentAdds', 'documentRemoves', 'windowAdds', 'windowRemoves',
    'mediaAdds', 'intervals', 'timeouts', 'animationFrames'
  ];
  const totals = Object.fromEntries(keys.map(key => [key, 0]));
  for (const item of inventory) {
    for (const key of keys) totals[key] += item[key];
  }

  const owners = inventory.filter(item => keys.some(key => item[key] > 0));
  console.log('V345_RUNTIME_OWNER_SUMMARY', JSON.stringify(owners));
  console.log('V345_RUNTIME_TOTALS', JSON.stringify(totals));

  const names = new Set(inventory.map(item => item.asset));
  for (const expected of [
    'list-column-sort-v229.js',
    'desktop-sidebar-v242.js',
    'comment-mentions-v191.js',
    'work-features-v167.js',
    'mobile-shell-v234.js'
  ]) {
    assert.ok(names.has(expected), `${expected} must remain in the active runtime inventory`);
  }
});

test('Ver.345 audit confirms recently cleaned long-lived owners remain narrowed instead of reopening them by static count alone', () => {
  const listSort = read('list-column-sort-v229.js');
  assert.match(listSort, /new\s+MutationObserver\(handleObservedListRender\)\.observe\(listView,\s*\{\s*childList:\s*true\s*\}\)/);
  assert.doesNotMatch(listSort, /\.observe\(listView,\s*\{[^}]*subtree:\s*true/);
  assert.match(listSort, /const\s+SORT_SELECT_SELECTOR\s*=\s*['"]#sortSelect['"]/);
  assert.match(listSort, /select\.addEventListener\(['"]input['"],\s*handleBaseSortChange\)/);
  assert.doesNotMatch(listSort, /document\.addEventListener\(['"](?:input|change)['"]/);

  const mentions = read('comment-mentions-v191.js');
  assert.match(mentions, /function\s+bindMentionEscapeV327\s*\(/);
  assert.match(mentions, /document\.addEventListener\(['"]keydown['"],\s*handleMentionEscapeV327\)/);
  assert.match(mentions, /document\.removeEventListener\(['"]keydown['"],\s*handleMentionEscapeV327\)/);
  assert.match(mentions, /new\s+MutationObserver\([\s\S]*?\)\.observe\(detail,\s*\{\s*childList:\s*true,\s*subtree:\s*true\s*\}\)/);
  assert.match(mentions, /mutationTouchesMentionSurfaceV329/);

  const sidebar = read('desktop-sidebar-v242.js');
  assert.match(sidebar, /document\.removeEventListener\(['"]keydown['"]/);
  assert.match(sidebar, /removeEventListener\(['"]pointermove['"]/);
  assert.doesNotMatch(sidebar, /\bsetInterval\s*\(/);

  const mobile = read('mobile-shell-v234.js');
  assert.match(mobile, /document\.removeEventListener\(['"]keydown['"]/);
  assert.match(mobile, /document\.removeEventListener\(['"]click['"]/);
  assert.match(mobile, /observe\(boardView,\s*\{\s*childList:\s*true\s*\}\)/);
  assert.doesNotMatch(mobile, /\bsetInterval\s*\(/);

  const work = read('work-features-v167.js');
  assert.doesNotMatch(work, /\bsetInterval\s*\(/);
  assert.match(work, /midnightTimer\s*=\s*setTimeout\s*\(/);
  assert.match(work, /attributeFilter:\s*\[['"]open['"]\]/);
  assert.match(work, /workMemoViewV167/);
});

test('Ver.345 audit remains evidence-only and keeps release inventory synchronized with responsibility baseline', () => {
  const manifest = read('release-manifest.js');
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const release = manifest.match(/version:\s*["'](\d+)["']/)?.[1];

  assert.ok(Number(release) >= 288);
  assert.equal(String(responsibilities.baselineRelease), release);
});
