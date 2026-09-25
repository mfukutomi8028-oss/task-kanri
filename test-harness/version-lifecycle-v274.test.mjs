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

test('Ver.274 audit: release stays 259 and version lifecycle remains audit-only', () => {
  assert.equal(currentRelease(), '259');
  assert.equal(responsibilities.baselineRelease, '259');
  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.match(next.goal, /Ver\.274監査/);
  assert.match(next.goal, /config\.js/);
  assert.match(next.goal, /setVersion/);
});

test('Ver.274 audit: config owns six current version refresh paths', () => {
  const start = config.match(/async function start\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(start.length > 0);
  assert.equal((start.match(/setVersion\(\);/g) || []).length, 2,
    'start must currently invoke setVersion before and after asset loading');
  assert.match(config, /window\.addEventListener\("pageshow", setVersion\)/);
  assert.match(config, /window\.addEventListener\("focus", setVersion\)/);
  assert.match(config, /setTimeout\(setVersion, 300\)/);
  assert.match(config, /setTimeout\(setVersion, 1200\)/);
});

test('Ver.274 audit: setVersion has conditional text but unconditional metadata assignments', () => {
  const setVersion = config.match(/function setVersion\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(setVersion.length > 0);
  assert.match(setVersion, /if \(element\.textContent !== expected\) element\.textContent = expected/);
  assert.match(setVersion, /element\.title = `現在のバージョン \$\{expected\}`/);
  assert.match(setVersion, /element\.dataset\.releaseVersion = VERSION/);
  assert.match(setVersion, /window\.WORK_BOARD_RELEASE_VERSION = VERSION/);
  assert.match(setVersion, /window\.WORK_BOARD_VERSION = VERSION/);
});

test('Ver.274 audit: retired version sidecar remains inactive while config and manifest are canonical owners', () => {
  assert.match(manifest, /"ui-version-display-v232\.css"/);
  assert.doesNotMatch(manifest, /dynamicScripts:[\s\S]*?"version-display-lock\.js"/);
  const foundation = responsibilities.groups.find(group => group.id === 'legacy-foundation');
  assert.ok(foundation);
  assert.deepEqual(foundation.assets, ['ui-version-display-v232.css']);
  assert.match(foundation.reason, /release-manifest\.js\/config\.js/);
});
