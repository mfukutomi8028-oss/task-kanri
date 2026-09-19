import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = read('release-manifest.js');
const config = read('config.js');
const displayCss = read('ui-version-display-v232.css');
const responsibilities = JSON.parse(read('patch-responsibilities.json'));

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.232 manifest retires version-display-lock while keeping the old file for cached-release compatibility', () => {
  assert.match(manifest, /const VERSION = '232';/);
  assert.match(manifest, /version:\s*"232"/);
  assert.match(manifest, /installFirstPaintGuardV232/);
  assert.match(manifest, /wb-first-paint-v232/);

  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  assert.ok(!scripts.includes('version-display-lock.js'));
  assert.ok(!required.includes('version-display-lock.js'));
  assert.ok(fs.existsSync(new URL('../version-display-lock.js', import.meta.url)));
});

test('Ver.232 config owns semantic version metadata and post-boot focus/pageshow recovery', () => {
  assert.match(config, /function setVersion\(\)/);
  assert.match(config, /element\.classList\.remove\("app-version"\)/);
  assert.match(config, /element\.classList\.add\("workboard-version-display"\)/);
  assert.match(config, /element\.dataset\.releaseVersion = VERSION/);
  assert.match(config, /window\.WORK_BOARD_RELEASE_VERSION = VERSION/);
  assert.match(config, /window\.WORK_BOARD_VERSION = VERSION/);
  assert.match(config, /window\.addEventListener\("pageshow", setVersion\)/);
  assert.match(config, /window\.addEventListener\("focus", setVersion\)/);
  assert.match(config, /setTimeout\(setVersion, 300\)/);
  assert.match(config, /setTimeout\(setVersion, 1200\)/);
});

test('Ver.232 version display presentation is a dedicated active CSS asset', () => {
  const styles = extractStringArray(manifest, 'dynamicStyles');
  const required = extractStringArray(manifest, 'requiredAssets');

  assert.equal(styles.filter(name => name === 'ui-version-display-v232.css').length, 1);
  assert.equal(required.filter(name => name === 'ui-version-display-v232.css').length, 1);
  assert.match(displayCss, /\.workboard-version-display\s*\{/);
  assert.match(displayCss, /display:\s*block/);
  assert.match(displayCss, /font-weight:\s*900/);
});

test('Ver.232 responsibility inventory records the retired sidecar and next bootstrap audit', () => {
  assert.equal(responsibilities.baselineRelease, '232');
  const foundation = responsibilities.groups.find(group => group.id === 'legacy-foundation');
  assert.ok(foundation);
  assert.equal(foundation.consolidation, 'consolidated-v232');
  assert.deepEqual(foundation.assets, ['ui-version-display-v232.css']);
  assert.match(foundation.reason, /version-display-lock\.js/);
  assert.match(foundation.reason, /config\.js/);

  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.ok(next.scope.includes('index.html'));
  assert.match(next.goal, /\?v=143/);
});
