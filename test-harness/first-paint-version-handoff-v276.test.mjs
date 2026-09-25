import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const index = read('index.html');
const manifest = read('release-manifest.js');
const config = read('config.js');
const responsibilities = JSON.parse(read('patch-responsibilities.json'));

function currentRelease() {
  return manifest.match(/version:\s*"(\d+)"/)?.[1] || '';
}

test('Ver.276 audit: release stays 260 and first-paint handoff remains audit-only', () => {
  assert.equal(currentRelease(), '260');
  assert.equal(responsibilities.baselineRelease, '260');
  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.match(next.goal, /Ver\.276監査/);
  assert.match(next.goal, /release-manifest\.js/);
  assert.match(next.goal, /config\.js/);
});

test('Ver.276 audit: static legacy version loads manifest before config under the first-paint guard', () => {
  const manifestIndex = index.indexOf('<script src="release-manifest.js?v=143"></script>');
  const configIndex = index.indexOf('<script src="config.js?v=143"></script>');
  assert.ok(manifestIndex >= 0);
  assert.ok(configIndex > manifestIndex);
  assert.match(index, /<div class="app-version" title="現在のバージョン">Ver\.143<\/div>/);
  assert.match(manifest, /root\.classList\.add\(bootClass\)/);
  assert.match(manifest, /html\.\$\{bootClass\} body \{ visibility: hidden !important; \}/);
});

test('Ver.276 audit: manifest DOMContentLoaded pass owns version text only', () => {
  const handler = manifest.match(/document\.addEventListener\('DOMContentLoaded', \(\) => \{[\s\S]*?\}, \{ once: true \}\);/)?.[0] || '';
  assert.ok(handler.length > 0);
  assert.match(handler, /querySelectorAll\('\.app-version, \.workboard-version-display'\)/);
  assert.match(handler, /node\.textContent = `Ver\.\$\{VERSION\}`/);
  assert.doesNotMatch(handler, /classList/);
  assert.doesNotMatch(handler, /title\s*=/);
  assert.doesNotMatch(handler, /dataset\.releaseVersion/);
  assert.doesNotMatch(handler, /WORK_BOARD_RELEASE_VERSION/);
  assert.doesNotMatch(handler, /WORK_BOARD_VERSION/);
});

test('Ver.276 audit: config start performs complete version synchronization before and after asset loading', () => {
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

test('Ver.276 audit: first-paint reveal stays gated by assets-ready with a four-second safety fallback', () => {
  assert.match(manifest, /window\.addEventListener\('workboard:assets-ready', handleAssetsReady, \{ once: true \}\)/);
  assert.match(manifest, /function handleAssetsReady\(\) \{[\s\S]*?finalizeLegacyIconCompatibility\(\);[\s\S]*?revealCurrentUi\(\);[\s\S]*?\}/);
  assert.match(manifest, /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => \{/);
  assert.match(manifest, /root\.classList\.remove\(bootClass\)/);
  assert.match(manifest, /window\.setTimeout\(revealCurrentUi, 4000\)/);
});

test('Ver.276 audit: focus/pageshow recovery remains config-owned independently of initial handoff', () => {
  assert.match(config, /window\.addEventListener\("pageshow", setVersion\)/);
  assert.match(config, /window\.addEventListener\("focus", setVersion\)/);
  assert.doesNotMatch(config, /setTimeout\(setVersion, 300\)/);
  assert.doesNotMatch(config, /setTimeout\(setVersion, 1200\)/);
});
