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

const WAKE_KEYS = [
  'mutationObservers', 'documentAdds', 'documentRemoves', 'windowAdds', 'windowRemoves',
  'mediaAdds', 'intervals', 'timeouts', 'animationFrames'
];

test('Ver.355 audit inventories every active Release 292 JavaScript wakeup owner', () => {
  const inventory = activeInventory();
  const totals = Object.fromEntries(WAKE_KEYS.map(key => [key, 0]));
  for (const item of inventory) {
    for (const key of WAKE_KEYS) totals[key] += item[key];
  }
  const owners = inventory.filter(item => WAKE_KEYS.some(key => item[key] > 0));
  console.log('V355_RUNTIME_OWNER_SUMMARY', JSON.stringify(owners));
  console.log('V355_RUNTIME_TOTALS', JSON.stringify(totals));

  const names = new Set(inventory.map(item => item.asset));
  for (const expected of [
    'list-column-sort-v229.js', 'desktop-sidebar-v242.js', 'comment-mentions-v191.js',
    'comment-reactions-v191.js', 'work-features-v167.js', 'mobile-shell-v234.js'
  ]) {
    assert.ok(names.has(expected), `${expected} must remain in the active runtime inventory`);
  }
});

test('Ver.355 audit confirms cleaned long-lived scopes remain narrowed', () => {
  const listSort = read('list-column-sort-v229.js');
  assert.match(listSort, /select\.addEventListener\(['"]input['"],\s*handleBaseSortChange\)/);
  assert.doesNotMatch(listSort, /document\.addEventListener\(['"](?:input|change)['"]/);
  assert.match(listSort, /observe\(listView,\s*\{\s*childList:\s*true\s*\}\)/);

  const mentions = read('comment-mentions-v191.js');
  assert.match(mentions, /document\.removeEventListener\(['"]keydown['"],\s*handleMentionEscapeV327\)/);
  assert.match(mentions, /mutationTouchesMentionSurfaceV329/);

  const sidebar = read('desktop-sidebar-v242.js');
  assert.match(sidebar, /function\s+syncDocumentLifecycleV324\s*\(/);
  assert.match(sidebar, /document\.removeEventListener\(["']keydown["'],\s*handleDocumentKeydownV324\)/);
  assert.match(sidebar, /document\.removeEventListener\(["']dragend["'],\s*handleDocumentDragEndV324,\s*true\)/);
  assert.match(sidebar, /document\.removeEventListener\(["']drop["'],\s*handleDocumentDropV324,\s*true\)/);
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
});

test('Ver.355 audit confirms Ver.347-354 comment reaction wakeup reductions remain active', () => {
  const reactions = read('comment-reactions-v191.js');
  assert.match(reactions, /const\s+root\s*=\s*document\.getElementById\(["']detailBody["']\)/);
  assert.match(reactions, /root\.addEventListener\(['"]keydown['"]/);
  assert.match(reactions, /root\.addEventListener\(['"]submit['"]/);
  assert.match(reactions, /root\.addEventListener\(['"]click['"]/);
  assert.doesNotMatch(reactions, /document\.addEventListener\(['"]keydown['"]/);
  assert.doesNotMatch(reactions, /document\.addEventListener\(['"]submit['"]/);
  assert.match(reactions, /function\s+setPickerOutsideClick\s*\(active\)/);
  assert.match(reactions, /document\.addEventListener\(['"]click['"],\s*handlePickerOutsideClick,\s*true\)/);
  assert.match(reactions, /document\.removeEventListener\(['"]click['"],\s*handlePickerOutsideClick,\s*true\)/);
  assert.match(reactions, /mutationTouchesCommentSurfaceV354/);
  assert.match(reactions, /\.observe\(root,\s*\{\s*childList:\s*true,\s*subtree:\s*true\s*\}\)/);
});

test('Ver.355 audit stays at Release 292 and hands the next isolated audit to archive polling', () => {
  const manifest = read('release-manifest.js');
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const release = manifest.match(/version:\s*["'](\d+)["']/)?.[1];
  assert.equal(release, '292');
  assert.equal(String(responsibilities.baselineRelease), '292');
  const priority = responsibilities.priorityCandidates?.[0];
  assert.ok(priority, 'priority candidate must exist');
  assert.deepEqual(priority.scope, ['archive-ui-v182.js']);
  assert.match(priority.goal, /Ver\.356 archive auto-archive polling audit/);
});
