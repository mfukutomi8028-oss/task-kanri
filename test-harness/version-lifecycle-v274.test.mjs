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

test('Ver.275 product: release and responsibility baseline advance together to 260', () => {
  assert.equal(currentRelease(), '260');
  assert.equal(responsibilities.baselineRelease, '260');
  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.match(next.goal, /Ver\.276監査/);
  assert.match(next.goal, /release-manifest\.js/);
  assert.match(next.goal, /config\.js/);
});

test('Ver.275 product: config keeps loader-boundary direct sync and recovery events without delayed version timers', () => {
  const start = config.match(/async function start\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(start.length > 0);
  assert.equal((start.match(/setVersion\(\);/g) || []).length, 2,
    'start must keep setVersion before and after asset loading');
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
