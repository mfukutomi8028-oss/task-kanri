import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = read('release-manifest.js');
const config = read('config.js');
const displayLock = read('version-display-lock.js');
const html = read('index.html');
const baseStyle = read('style.css');

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.231 audit: release manifest is the canonical version source and config owns normal startup synchronization', () => {
  const release = manifest.match(/version:\s*"(\d+)"/)?.[1];
  assert.ok(release && Number(release) >= 230, 'current release must be Ver.230 or later');

  assert.match(manifest, /window\.WORK_BOARD_RELEASE_VERSION = window\.WORK_BOARD_RELEASE\.version;/);
  assert.match(manifest, /window\.WORK_BOARD_VERSION = window\.WORK_BOARD_RELEASE\.version;/);
  assert.match(manifest, /document\.querySelectorAll\('\.app-version, \.workboard-version-display'\)[\s\S]*node\.textContent = `Ver\.\$\{VERSION\}`/);

  assert.match(config, /const VERSION = window\.WORK_BOARD_RELEASE\?\.version;/);
  assert.match(config, /function setVersion\(\)/);
  assert.match(config, /window\.WORK_BOARD_RELEASE_VERSION = VERSION;/);
  assert.match(config, /window\.WORK_BOARD_VERSION = VERSION;/);
  assert.match(config, /document\.querySelectorAll\("\.app-version, \.workboard-version-display"\)/);
  assert.match(config, /setVersion\(\);[\s\S]*patchBrandIcons\(\);/);
  assert.match(config, /for \(const \[src, marker\] of SCRIPTS\)[\s\S]*setVersion\(\);/);
  assert.match(config, /setTimeout\(setVersion, 300\);/);
  assert.match(config, /setTimeout\(setVersion, 1200\);/);
});

test('Ver.231 audit: version-display-lock adds post-boot drift recovery and semantic presentation, not a second version source', () => {
  assert.match(displayLock, /window\.WORK_BOARD_RELEASE\?\.version/);
  assert.doesNotMatch(displayLock, /const VERSION\s*=\s*["']\d+["']/);
  assert.doesNotMatch(displayLock, /Ver\.122|Ver\.143|Ver\.230/);

  assert.match(displayLock, /element\.classList\.remove\("app-version"\)/);
  assert.match(displayLock, /element\.classList\.add\("workboard-version-display"\)/);
  assert.match(displayLock, /element\.dataset\.releaseVersion = version/);
  assert.match(displayLock, /const STYLE_ID = "workBoardVersionDisplayStyle"/);
  assert.match(displayLock, /\.workboard-version-display/);
  assert.match(displayLock, /window\.addEventListener\("pageshow", apply\)/);
  assert.match(displayLock, /window\.addEventListener\("focus", apply\)/);

  assert.match(html, /<div class="app-version"[^>]*>Ver\.143<\/div>/,
    'static HTML still exposes the legacy fallback node for startup compatibility');
  assert.match(baseStyle, /\.app-version\s*\{/,
    'base CSS still provides a usable fallback when the display lock is absent');
});

test('Ver.231 audit: version-display-lock remains one active foundation asset until its unique recovery/presentation duties are consolidated', () => {
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');

  assert.equal(scripts.filter(name => name === 'version-display-lock.js').length, 1);
  assert.equal(required.filter(name => name === 'version-display-lock.js').length, 1);
  assert.ok(scripts.indexOf('version-display-lock.js') > scripts.indexOf('date-segment-controls-v230.js'),
    'display normalization must continue after the date presentation controller in the current audited runtime');
});
