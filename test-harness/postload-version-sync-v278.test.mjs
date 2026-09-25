import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = read('release-manifest.js');
const config = read('config.js');
const responsibilities = JSON.parse(read('patch-responsibilities.json'));
const browserAudit = read('tests/postload-version-sync-audit-v278.spec.mjs');

function currentRelease() {
  return manifest.match(/version:\s*"(\d+)"/)?.[1] || '';
}

test('Ver.278 audit starts from the Ver.277 release/baseline without product runtime changes', () => {
  assert.equal(currentRelease(), '261');
  assert.equal(responsibilities.baselineRelease, '261');
  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.match(next.goal, /Ver\.278監査/);
  assert.match(next.goal, /後段setVersion/);
});

test('Ver.278 audit target is exactly the pre-load and post-load setVersion pair in config start()', () => {
  const start = config.match(/async function start\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(start.length > 0);
  assert.equal((start.match(/setVersion\(\);/g) || []).length, 2);
  const first = start.indexOf('setVersion();');
  const styles = start.indexOf('STYLES.map');
  const scripts = start.indexOf('for (const [src, marker] of SCRIPTS)');
  const second = start.lastIndexOf('setVersion();');
  const ready = start.indexOf('notifyAssetsReady');
  assert.ok(first >= 0 && first < styles);
  assert.ok(second > scripts);
  assert.ok(second < ready || ready < 0);
});

test('Ver.278 audit keeps focus/pageshow recovery and first-paint handoff contracts intact', () => {
  assert.match(config, /window\.addEventListener\("pageshow", setVersion\)/);
  assert.match(config, /window\.addEventListener\("focus", setVersion\)/);
  assert.doesNotMatch(config, /setTimeout\(setVersion, 300\)/);
  assert.doesNotMatch(config, /setTimeout\(setVersion, 1200\)/);
  assert.match(manifest, /window\.addEventListener\('workboard:assets-ready', handleAssetsReady, \{ once: true \}\)/);
  assert.match(manifest, /window\.setTimeout\(revealCurrentUi, 4000\)/);
});

test('Ver.278 browser audit suppresses only the post-load call in a routed test copy of config.js', () => {
  assert.match(browserAudit, /rewriteConfigForAudit/);
  assert.match(browserAudit, /const needle = `      setVersion\(\);\\n    \} catch \(error\) \{`/);
  assert.match(browserAudit, /suppressPostloadSync \? '' : '      setVersion\(\);\\n'/);
  assert.match(browserAudit, /route\.fulfill\(\{ response, body, contentType: 'application\/javascript; charset=utf-8' \}\)/);
  assert.doesNotMatch(browserAudit, /update_file|release-manifest\.js.*replace|config\.js.*writeFile/);
});
