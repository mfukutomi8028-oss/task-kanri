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

function currentRelease() {
  return manifest.match(/version:\s*"(\d+)"/)?.[1] || '';
}

test('Ver.232 version-display retirement remains active in later releases', () => {
  const release = currentRelease();
  assert.ok(Number(release) >= 234);
  assert.match(manifest, new RegExp(`const VERSION = '${release}';`));
  assert.match(manifest, new RegExp(`installFirstPaintGuardV${release}`));
  assert.match(manifest, new RegExp(`wb-first-paint-v${release}`));

  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  assert.ok(!scripts.includes('version-display-lock.js'));
  assert.ok(!required.includes('version-display-lock.js'));
  assert.ok(fs.existsSync(new URL('../version-display-lock.js', import.meta.url)));
});

test('Ver.232 config still owns semantic version metadata and post-boot focus/pageshow recovery', () => {
  assert.match(config, /function setVersion\(\)/);
  assert.match(config, /classList\.contains\("app-version"\)/);
  assert.match(config, /classList\.contains\("workboard-version-display"\)/);
  assert.match(config, /element\.dataset\.releaseVersion !== VERSION/);
  assert.match(config, /window\.WORK_BOARD_RELEASE_VERSION !== VERSION/);
  assert.match(config, /window\.WORK_BOARD_VERSION !== VERSION/);
  assert.match(config, /window\.addEventListener\("pageshow", setVersion\)/);
  assert.match(config, /window\.addEventListener\("focus", setVersion\)/);
  assert.doesNotMatch(config, /setTimeout\(setVersion,\s*300\)/);
  assert.doesNotMatch(config, /setTimeout\(setVersion,\s*1200\)/);
});

test('Ver.232 version display presentation remains a dedicated active CSS asset', () => {
  const styles = extractStringArray(manifest, 'dynamicStyles');
  const required = extractStringArray(manifest, 'requiredAssets');

  assert.equal(styles.filter(name => name === 'ui-version-display-v232.css').length, 1);
  assert.equal(required.filter(name => name === 'ui-version-display-v232.css').length, 1);
  assert.match(displayCss, /\.workboard-version-display\s*\{/);
  assert.match(displayCss, /display:\s*block/);
  assert.match(displayCss, /font-weight:\s*900/);
});

test('Ver.232 responsibility remains consolidated while later cleanup advances independently', () => {
  assert.equal(responsibilities.baselineRelease, currentRelease());
  const foundation = responsibilities.groups.find(group => group.id === 'legacy-foundation');
  assert.ok(foundation);
  assert.equal(foundation.consolidation, 'consolidated-v232');
  assert.deepEqual(foundation.assets, ['ui-version-display-v232.css']);
  assert.match(foundation.reason, /version-display-lock\.js/);
  assert.match(foundation.reason, /config\.js/);
  assert.match(foundation.reason, /ui-version-display-v232\.css/);

  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next, 'later cleanup must keep an explicit next priority');
  assert.ok(Array.isArray(next.scope) && next.scope.length > 0, 'later cleanup priority needs a live scope');
  assert.ok(!next.scope.includes('version-display-lock.js'),
    'retired Ver.232 sidecar must not return as a live cleanup priority');
});
