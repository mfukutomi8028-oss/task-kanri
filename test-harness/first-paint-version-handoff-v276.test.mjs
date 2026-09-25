import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const index = read('index.html');
const manifest = read('release-manifest.js');
const config = read('config.js');
const audit = read('FIRST_PAINT_VERSION_HANDOFF_AUDIT_V276.md');
const responsibilities = JSON.parse(read('patch-responsibilities.json'));

function currentRelease() {
  return manifest.match(/version:\s*"(\d+)"/)?.[1] || '';
}

test('Ver.277 product: release and responsibility baseline advance together to 261', () => {
  assert.equal(currentRelease(), '261');
  assert.equal(responsibilities.baselineRelease, '261');
  assert.match(audit, /manifest.*version/i);
  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.match(next.goal, /Ver\.278監査/);
  assert.match(next.goal, /config\.js/);
  assert.match(next.goal, /後段setVersion/);
});

test('Ver.277 product: static legacy version still loads manifest before config under first-paint guard', () => {
  const manifestIndex = index.indexOf('<script src="release-manifest.js?v=143"></script>');
  const configIndex = index.indexOf('<script src="config.js?v=143"></script>');
  assert.ok(manifestIndex >= 0);
  assert.ok(configIndex > manifestIndex);
  assert.match(index, /<div class="app-version" title="現在のバージョン">Ver\.143<\/div>/);
  assert.match(manifest, /const VERSION = '261'/);
  assert.match(manifest, /const bootClass = 'wb-first-paint-v261'/);
  assert.match(manifest, /root\.classList\.add\(bootClass\)/);
  assert.match(manifest, /html\.\$\{bootClass\} body \{ visibility: hidden !important; \}/);
});

test('Ver.277 product: manifest DOMContentLoaded keeps legacy image sweep but no longer writes version text', () => {
  const handler = manifest.match(/document\.addEventListener\('DOMContentLoaded', \(\) => \{[\s\S]*?\}, \{ once: true \}\);/)?.[0] || '';
  assert.ok(handler.length > 0);
  assert.match(handler, /document\.querySelectorAll\('img'\)\.forEach\(upgradeImage\)/);
  assert.doesNotMatch(handler, /\.app-version/);
  assert.doesNotMatch(handler, /\.workboard-version-display/);
  assert.doesNotMatch(handler, /textContent\s*=/);
  assert.doesNotMatch(handler, /WORK_BOARD_RELEASE_VERSION/);
  assert.doesNotMatch(handler, /WORK_BOARD_VERSION/);
});

test('Ver.277 product: config remains the sole semantic version synchronizer at loader boundaries', () => {
  const start = config.match(/async function start\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(start.length > 0);
  assert.equal((start.match(/setVersion\(\);/g) || []).length, 2);
  assert.ok(start.indexOf('setVersion();') < start.indexOf('STYLES.map'));
  assert.ok(start.lastIndexOf('setVersion();') > start.indexOf('for (const [src, marker] of SCRIPTS)'));

  const setVersion = config.match(/function setVersion\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(setVersion.length > 0);
  assert.match(setVersion, /element\.classList\.contains\("app-version"\)/);
  assert.match(setVersion, /element\.classList\.contains\("workboard-version-display"\)/);
  assert.match(setVersion, /element\.textContent !== expected/);
  assert.match(setVersion, /element\.title !== expectedTitle/);
  assert.match(setVersion, /element\.dataset\.releaseVersion !== VERSION/);
  assert.match(setVersion, /window\.WORK_BOARD_RELEASE_VERSION = VERSION/);
  assert.match(setVersion, /window\.WORK_BOARD_VERSION = VERSION/);
});

test('Ver.277 product: first-paint reveal and legacy image compatibility stay unchanged', () => {
  assert.match(manifest, /new MutationObserver\(records =>/);
  assert.match(manifest, /document\.querySelectorAll\('img'\)\.forEach\(upgradeImage\)/);
  assert.match(manifest, /iconObserver\.disconnect\(\)/);
  assert.match(manifest, /window\.addEventListener\('workboard:assets-ready', handleAssetsReady, \{ once: true \}\)/);
  assert.match(manifest, /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => \{/);
  assert.match(manifest, /root\.classList\.remove\(bootClass\)/);
  assert.match(manifest, /window\.setTimeout\(revealCurrentUi, 4000\)/);
});

test('Ver.277 product: focus/pageshow recovery remains config-owned', () => {
  assert.match(config, /window\.addEventListener\("pageshow", setVersion\)/);
  assert.match(config, /window\.addEventListener\("focus", setVersion\)/);
  assert.doesNotMatch(config, /setTimeout\(setVersion, 300\)/);
  assert.doesNotMatch(config, /setTimeout\(setVersion, 1200\)/);
});