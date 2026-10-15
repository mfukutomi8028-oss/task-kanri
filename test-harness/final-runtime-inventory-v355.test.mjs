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

function count(source, pattern) { return [...source.matchAll(pattern)].length; }

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
  const assets = ['release-manifest.js', 'app.js', 'config.js', ...extractStringArray(manifest, 'dynamicScripts'), ...extractStringArray(manifest, 'mobileScripts')];
  assert.equal(new Set(assets).size, assets.length, 'active JavaScript inventory must not contain duplicates');
  assets.forEach(asset => assert.ok(fs.existsSync(path.join(ROOT, asset)), `missing active asset: ${asset}`));
  return assets.map(inspectAsset);
}

test('Ver.355 re-inventories all active JavaScript wakeup owners at Release 292', () => {
  const inventory = activeInventory();
  const keys = ['mutationObservers','documentAdds','documentRemoves','windowAdds','windowRemoves','mediaAdds','intervals','timeouts','animationFrames'];
  const totals = Object.fromEntries(keys.map(key => [key, inventory.reduce((sum, item) => sum + item[key], 0)]));
  const owners = inventory.filter(item => keys.some(key => item[key] > 0));
  console.log('V355_RUNTIME_OWNER_SUMMARY', JSON.stringify(owners));
  console.log('V355_RUNTIME_TOTALS', JSON.stringify(totals));
  assert.ok(owners.length > 0);

  // Preserve the original Ver.345 named-owner inventory contract.
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

test('Ver.355 confirms recently cleaned wakeup scopes remain narrowed', () => {
  const reactions = read('comment-reactions-v191.js');
  assert.match(reactions, /root\.addEventListener\(['"]submit['"]/);
  assert.match(reactions, /root\.addEventListener\(["']click["']/);
  assert.match(reactions, /root\.addEventListener\(['"]keydown['"]/);
  assert.match(reactions, /document\.addEventListener\(["']click["'],\s*handlePickerOutsideClick,\s*true\)/);
  assert.match(reactions, /document\.removeEventListener\(["']click["'],\s*handlePickerOutsideClick,\s*true\)/);
  assert.match(reactions, /mutationTouchesCommentSurfaceV354/);
  assert.doesNotMatch(reactions, /document\.addEventListener\(['"](?:submit|keydown)['"],\s*event\s*=>/);

  const listSort = read('list-column-sort-v229.js');
  assert.doesNotMatch(listSort, /document\.addEventListener\(['"](?:input|change|click|keydown)['"]/);
  assert.doesNotMatch(listSort, /\.observe\([^,]+,\s*\{[^}]*subtree:\s*true/);

  const saved = read('saved-views-v148.js');
  assert.doesNotMatch(saved, /document\.addEventListener\(['"](?:input|change)['"]/);
  assert.doesNotMatch(saved, /\bsetInterval\s*\(/);

  for (const asset of ['dependencies-v149.js', 'work-features-v167.js', 'mobile-shell-v234.js']) {
    assert.doesNotMatch(read(asset), /\bsetInterval\s*\(/, `${asset} must stay interval-free`);
  }
});

test('Ver.355 audit remains durable after later releases while the recorded priority contract is preserved', () => {
  const manifest = read('release-manifest.js');
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const release = manifest.match(/version:\s*["'](\d+)["']/)?.[1];
  assert.ok(Number(release) >= 292);
  assert.equal(String(responsibilities.baselineRelease), release);
  assert.match(JSON.stringify(responsibilities.priorityCandidates || []), /Ver\.355 final runtime wakeup inventory refresh/);
});

// Preserve the still-live Ver.345 listener/observer ownership contracts without a duplicate inventory helper.
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
  assert.match(sidebar, /function\s+syncDocumentLifecycleV324\s*\(/);
  assert.match(sidebar, /const\s+shouldBind\s*=\s*Boolean\(media\.matches\s*&&\s*!pinned\s*&&\s*expanded\)/);
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
  assert.match(work, /workMemoViewV167/);
});

test('Ver.345 audit finding remains durable after Ver.346 audit and Ver.347 keydown scope productization', () => {
  const reactions = read('comment-reactions-v191.js');
  assert.match(reactions, /function\s+bindGlobalEvents\s*\(root\)/);
  assert.match(reactions, /root\.addEventListener\(['"]keydown['"],\s*event\s*=>/);
  assert.doesNotMatch(reactions, /document\.addEventListener\(['"]keydown['"],\s*event\s*=>/);
  assert.match(reactions, /event\.key\s*===\s*['"]Escape['"]/);
  assert.match(reactions, /\(event\.ctrlKey\s*\|\|\s*event\.metaKey\)\s*&&\s*event\.key\s*===\s*['"]Enter['"]/);
  assert.match(reactions, /const\s+root\s*=\s*document\.getElementById\(["']detailBody["']\)/);
  assert.match(reactions, /bindGlobalEvents\(root\)/);
  assert.match(reactions, /\.observe\(root,\s*\{\s*childList:\s*true,\s*subtree:\s*true\s*\}\)/);
});
