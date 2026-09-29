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
    documentListeners: count(source, /document\.addEventListener\s*\(/g),
    windowListeners: count(source, /window\.addEventListener\s*\(/g),
    mediaListeners: count(source, /(?:matchMedia\([^)]*\)|\bmedia\w*)\.addEventListener\s*\(/g),
    intervals: count(source, /\bsetInterval\s*\(/g),
    timeouts: count(source, /\b(?:window\.)?setTimeout\s*\(/g),
    animationFrames: count(source, /\brequestAnimationFrame\s*\(/g)
  };
}

test('Ver.325 audit inventories every active JavaScript runtime owner', () => {
  const manifest = read('release-manifest.js');
  const dynamicScripts = extractStringArray(manifest, 'dynamicScripts');
  const mobileScripts = extractStringArray(manifest, 'mobileScripts');
  const assets = ['app.js', 'config.js', ...dynamicScripts, ...mobileScripts];

  assert.equal(new Set(assets).size, assets.length, 'active JavaScript inventory must not contain duplicates');
  for (const asset of assets) {
    assert.ok(fs.existsSync(path.join(ROOT, asset)), `active runtime asset is missing: ${asset}`);
  }

  const inventory = assets.map(inspectAsset);
  console.log('V325_FINAL_RUNTIME_INVENTORY', JSON.stringify(inventory));

  const totals = inventory.reduce((sum, item) => {
    for (const key of ['mutationObservers', 'documentListeners', 'windowListeners', 'mediaListeners', 'intervals', 'timeouts', 'animationFrames']) {
      sum[key] += item[key];
    }
    return sum;
  }, {
    mutationObservers: 0,
    documentListeners: 0,
    windowListeners: 0,
    mediaListeners: 0,
    intervals: 0,
    timeouts: 0,
    animationFrames: 0
  });
  console.log('V325_FINAL_RUNTIME_TOTALS', JSON.stringify(totals));

  assert.ok(inventory.some(item => item.asset === 'desktop-sidebar-v242.js'), 'desktop sidebar must remain in active inventory');
  assert.ok(inventory.some(item => item.asset === 'mobile-shell-v234.js'), 'conditional mobile shell must be included in the audit');
});

test('Ver.325 audit keeps release inventory and responsibility baseline synchronized', () => {
  const manifest = read('release-manifest.js');
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const release = manifest.match(/version:\s*["'](\d+)["']/)?.[1];

  assert.equal(release, '280');
  assert.equal(String(responsibilities.baselineRelease), release);
});
