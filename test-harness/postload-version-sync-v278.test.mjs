import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = read('release-manifest.js');
const config = read('config.js');
const responsibilities = JSON.parse(read('patch-responsibilities.json'));
const auditRecord = read('POSTLOAD_VERSION_SYNC_AUDIT_V278.md');
const browserRegression = read('tests/postload-version-sync-audit-v278.spec.mjs');

function currentRelease() {
  return manifest.match(/version:\s*"(\d+)"/)?.[1] || '';
}

test('Ver.279 product advances release and responsibility baseline together to 262', () => {
  assert.equal(currentRelease(), '262');
  assert.equal(responsibilities.baselineRelease, '262');
  assert.match(auditRecord, /後段 `setVersion\(\)` に独立したユーザー可視・復旧価値は確認できない/);
  assert.match(auditRecord, /Ver\.279製品として後段 `setVersion\(\)` だけを撤去/);
});

test('Ver.279 product keeps exactly one startup setVersion before asset loading', () => {
  const start = config.match(/async function start\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(start.length > 0);
  assert.equal((start.match(/setVersion\(\);/g) || []).length, 1);
  const first = start.indexOf('setVersion();');
  const styles = start.indexOf('STYLES.map');
  const scripts = start.indexOf('for (const [src, marker] of SCRIPTS)');
  assert.ok(first >= 0 && first < styles);
  assert.ok(first < scripts);
  const postloadSlice = start.slice(scripts);
  assert.doesNotMatch(postloadSlice, /setVersion\(\);/);
});

test('Ver.279 product preserves focus/pageshow recovery and first-paint handoff contracts', () => {
  assert.match(config, /window\.addEventListener\("pageshow", setVersion\)/);
  assert.match(config, /window\.addEventListener\("focus", setVersion\)/);
  assert.doesNotMatch(config, /setTimeout\(setVersion, 300\)/);
  assert.doesNotMatch(config, /setTimeout\(setVersion, 1200\)/);
  assert.match(manifest, /window\.addEventListener\('workboard:assets-ready', handleAssetsReady, \{ once: true \}\)/);
  assert.match(manifest, /window\.setTimeout\(revealCurrentUi, 4000\)/);
  assert.match(manifest, /const VERSION = '262'/);
});

test('Ver.279 browser regression runs against the product config without route rewriting', () => {
  assert.doesNotMatch(browserRegression, /rewriteConfigForAudit|suppressPostloadSync|route\.fulfill/);
  assert.match(browserRegression, /const VERSION = '262'/);
  assert.match(browserRegression, /Ver\.279 product/);
});

test('Ver.279 responsibility ledger records consolidation and advances to a separate next audit', () => {
  const versionGroup = responsibilities.groups.find(group => group.id === 'legacy-foundation');
  assert.ok(versionGroup);
  assert.match(versionGroup.reason, /Ver\.278監査/);
  assert.match(versionGroup.reason, /Ver\.279製品/);
  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.match(next.goal, /Ver\.280監査/);
  assert.match(next.goal, /patchBrandIcons/);
});
