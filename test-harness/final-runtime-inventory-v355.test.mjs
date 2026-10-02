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

test('Ver.355 remains audit-only at Release 292 and keeps the Ver.355 priority contract', () => {
  const manifest = read('release-manifest.js');
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const release = manifest.match(/version:\s*["'](\d+)["']/)?.[1];
  assert.equal(release, '292');
  assert.equal(String(responsibilities.baselineRelease), '292');
  assert.match(JSON.stringify(responsibilities.priorityCandidates || []), /Ver\.355 final runtime wakeup inventory refresh/);
});
