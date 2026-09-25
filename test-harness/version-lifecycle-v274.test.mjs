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

test('Ver.275 product remains published in release 260 or later with matching responsibility baseline', () => {
  const release = currentRelease();
  assert.ok(Number(release) >= 260);
  assert.equal(responsibilities.baselineRelease, release);
});

test('Ver.275+ product: config keeps startup sync and recovery events without delayed version timers', () => {
  const release = currentRelease();
  const start = config.match(/async function start\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(start.length > 0);
  const calls = (start.match(/setVersion\(\);/g) || []).length;
  assert.equal(calls, Number(release) >= 262 ? 1 : 2,
    'later releases may retire the audited redundant post-load sync while keeping startup sync');
  assert.ok(start.indexOf('setVersion();') < start.indexOf('STYLES.map'));
  assert.match(config, /window\.addEventListener\("pageshow", setVersion\)/);
  assert.match(config, /window\.addEventListener\("focus", setVersion\)/);
  assert.doesNotMatch(config, /setTimeout\(setVersion, 300\)/);
  assert.doesNotMatch(config, /setTimeout\(setVersion, 1200\)/);
});

test('Ver.275 product: setVersion mutates semantic class and metadata only when drift exists', () => {
  const setVersion = config.match(/function setVersion\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(setVersion.length > 0);
  assert.match(setVersion, /const expectedTitle = `現在のバージョン \$\{expected\}`/);
  assert.match(setVersion, /if \(element\.classList\.contains\("app-version"\)\) element\.classList\.remove\("app-version"\)/);
  assert.match(setVersion, /if \(!element\.classList\.contains\("workboard-version-display"\)\) element\.classList\.add\("workboard-version-display"\)/);
  assert.match(setVersion, /if \(element\.textContent !== expected\) element\.textContent = expected/);
  assert.match(setVersion, /if \(element\.title !== expectedTitle\) element\.title = expectedTitle/);
  assert.match(setVersion, /if \(element\.dataset\.releaseVersion !== VERSION\) element\.dataset\.releaseVersion = VERSION/);
  assert.match(setVersion, /window\.WORK_BOARD_RELEASE_VERSION = VERSION/);
  assert.match(setVersion, /window\.WORK_BOARD_VERSION = VERSION/);
});

test('Ver.275 product: retired version sidecar remains inactive while config and manifest are canonical owners', () => {
  assert.match(manifest, /"ui-version-display-v232\.css"/);
  assert.doesNotMatch(manifest, /dynamicScripts:[\s\S]*?"version-display-lock\.js"/);
  const foundation = responsibilities.groups.find(group => group.id === 'legacy-foundation');
  assert.ok(foundation);
  assert.deepEqual(foundation.assets, ['ui-version-display-v232.css']);
  assert.match(foundation.reason, /Ver\.274監査/);
  assert.match(foundation.reason, /Ver\.275製品/);
  assert.match(foundation.reason, /300ms\/1200ms timerを撤去/);
});