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

test('Ver.231 audit evidence remains: manifest is the version source and config owns normal synchronization', () => {
  const release = manifest.match(/version:\s*"(\d+)"/)?.[1];
  assert.ok(release && Number(release) >= 230, 'current release must preserve the Ver.231 audit boundary');

  assert.match(manifest, /window\.WORK_BOARD_RELEASE_VERSION = window\.WORK_BOARD_RELEASE\.version;/);
  assert.match(manifest, /window\.WORK_BOARD_VERSION = window\.WORK_BOARD_RELEASE\.version;/);
  assert.match(config, /const VERSION = window\.WORK_BOARD_RELEASE\?\.version;/);
  assert.match(config, /function setVersion\(\)/);
  assert.match(config, /window\.WORK_BOARD_RELEASE_VERSION = VERSION;/);
  assert.match(config, /window\.WORK_BOARD_VERSION = VERSION;/);
  assert.match(config, /document\.querySelectorAll\("\.app-version, \.workboard-version-display"\)/);
});

test('Ver.231 audited sidecar remains physically compatible and contains only manifest-derived recovery/presentation behavior', () => {
  assert.ok(fs.existsSync(new URL('../version-display-lock.js', import.meta.url)));
  assert.match(displayLock, /window\.WORK_BOARD_RELEASE\?\.version/);
  assert.doesNotMatch(displayLock, /const VERSION\s*=\s*["']\d+["']/);
  assert.match(displayLock, /element\.classList\.remove\("app-version"\)/);
  assert.match(displayLock, /element\.classList\.add\("workboard-version-display"\)/);
  assert.match(displayLock, /element\.dataset\.releaseVersion = version/);
  assert.match(displayLock, /window\.addEventListener\("pageshow", apply\)/);
  assert.match(displayLock, /window\.addEventListener\("focus", apply\)/);

  assert.match(html, /<div class="app-version"[^>]*>Ver\.143<\/div>/,
    'static HTML fallback remains available for old cached bootstraps');
  assert.match(baseStyle, /\.app-version\s*\{/,
    'legacy fallback CSS remains available for old cached bootstraps');
});

test('later releases may retire the audited sidecar only after its responsibilities move to canonical owners', () => {
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  const release = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);

  if (release <= 231) {
    assert.equal(scripts.filter(name => name === 'version-display-lock.js').length, 1);
    assert.equal(required.filter(name => name === 'version-display-lock.js').length, 1);
  } else {
    assert.ok(!scripts.includes('version-display-lock.js'));
    assert.ok(!required.includes('version-display-lock.js'));
    assert.match(config, /window\.addEventListener\("pageshow", setVersion\)/);
    assert.match(config, /window\.addEventListener\("focus", setVersion\)/);
    assert.match(config, /element\.classList\.add\("workboard-version-display"\)/);
    assert.match(config, /element\.dataset\.releaseVersion = VERSION/);
  }
});
