import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const config = read('config.js');
const manifest = read('release-manifest.js');
const responsibilities = JSON.parse(read('patch-responsibilities.json'));

function currentRelease() {
  return manifest.match(/version:\s*"(\d+)"/)?.[1] || '';
}

test('Ver.275 product: release advances and version lifecycle cleanup becomes active', () => {
  assert.equal(currentRelease(), '260');
  assert.equal(responsibilities.baselineRelease, '260');
  assert.match(manifest, /installFirstPaintGuardV260/);
  assert.match(manifest, /wb-first-paint-v260/);
});

test('Ver.275 product: config keeps two direct refreshes and recovery events without delayed timers', () => {
  const start = config.match(/async function start\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(start.length > 0);
  assert.equal((start.match(/setVersion\(\);/g) || []).length, 2,
    'start must keep pre-load and post-load version synchronization');
  assert.match(config, /window\.addEventListener\("pageshow", setVersion\)/);
  assert.match(config, /window\.addEventListener\("focus", setVersion\)/);
  assert.doesNotMatch(config, /setTimeout\(setVersion,\s*300\)/);
  assert.doesNotMatch(config, /setTimeout\(setVersion,\s*1200\)/);
});

test('Ver.275 product: setVersion only writes metadata when current state differs', () => {
  const setVersion = config.match(/function setVersion\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(setVersion.length > 0);
  assert.match(setVersion, /WORK_BOARD_RELEASE_VERSION !== VERSION/);
  assert.match(setVersion, /WORK_BOARD_VERSION !== VERSION/);
  assert.match(setVersion, /classList\.contains\("app-version"\)/);
  assert.match(setVersion, /!element\.classList\.contains\("workboard-version-display"\)/);
  assert.match(setVersion, /element\.textContent !== expected/);
  assert.match(setVersion, /element\.title !== expectedTitle/);
  assert.match(setVersion, /element\.dataset\.releaseVersion !== VERSION/);
});

test('Ver.275 product: retired version sidecar remains inactive while config and manifest are canonical owners', () => {
  assert.match(manifest, /"ui-version-display-v232\.css"/);
  assert.doesNotMatch(manifest, /dynamicScripts:[\s\S]*?"version-display-lock\.js"/);
  const foundation = responsibilities.groups.find(group => group.id === 'legacy-foundation');
  assert.ok(foundation);
  assert.deepEqual(foundation.assets, ['ui-version-display-v232.css']);
  assert.match(foundation.reason, /release-manifest\.js\/config\.js/);
  assert.match(foundation.reason, /Ver\.275/);
});
