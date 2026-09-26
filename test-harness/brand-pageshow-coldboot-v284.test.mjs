import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const brand = readFileSync('brand-v185.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('BRAND_PAGESHOW_COLD_BOOT_AUDIT_V284.md', 'utf8');

const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.285 product: release and responsibility baseline advance together to 265 or later', () => {
  assert.ok(release >= 265, `expected release >= 265, got ${release}`);
  assert.equal(String(responsibilities.baselineRelease), String(release));
});

test('Ver.285 product: startup keeps one canonical apply and pageshow recovery is persisted-only', () => {
  const calls = brand.match(/\bpatchBrowserIcons\(\);/g) || [];
  assert.equal(calls.length, 1, 'favicon correction must remain apply-owned');
  assert.match(brand, /function apply\(\)[\s\S]*patchBrandMark\(\);[\s\S]*patchBrowserIcons\(\);[\s\S]*patchNotifications\(\);[\s\S]*dataset\.brandVersion = VERSION/);
  assert.doesNotMatch(brand, /window\.addEventListener\('pageshow', apply\)/);
  assert.match(brand, /window\.addEventListener\('pageshow', event => \{[\s\S]*if \(event\.persisted\) apply\(\);[\s\S]*\}\);/);
});

test('Ver.285 product: no-drift guards remain while dataset assignment stays available for Ver.286 audit', () => {
  assert.match(brand, /if \(img\.getAttribute\('src'\) !== SVG_ICON\) img\.setAttribute\('src', SVG_ICON\)/);
  assert.match(brand, /if \(!document\.head \|\| browserIconsAreCurrent\(\)\) return;/);
  assert.match(brand, /if \(!current \|\| current\.__workBoardBrandVersion === VERSION\) return;/);
  assert.match(brand, /document\.documentElement\.dataset\.brandVersion = VERSION;/);
});

test('Ver.285 product: ledger retains Ver.284 evidence and Ver.285 product after later audits advance', () => {
  const iconGroup = responsibilities.groups.find(group => group.id === 'icon-system');
  assert.ok(iconGroup?.reason.includes('Ver.284監査'));
  assert.ok(iconGroup?.reason.includes('Ver.285製品'));
  assert.ok(
    iconGroup?.reason.includes('Ver.286監査') ||
      (responsibilities.priorityCandidates || []).some(candidate => /Ver\.286監査/.test(candidate?.goal || '')),
    'Ver.286 audit must remain recorded either as completed history or the current candidate'
  );
  assert.ok(
    iconGroup?.reason.includes('data-brand-version') ||
      (responsibilities.priorityCandidates || []).some(candidate => /data-brand-version/.test(candidate?.goal || '')),
    'data-brand-version audit history must remain durable after promotion'
  );
});

test('Ver.284 audit record remains durable evidence for the persisted-only product decision', () => {
  assert.match(audit, /cold boot初回pageshowを実行しなくても、startup `apply\(\)` だけで最終canonical状態は完全に成立した/);
  assert.match(audit, /BFCache相当のpersisted pageshow recoveryには独立した復旧価値がある/);
  assert.match(audit, /Ver\.285製品化候補/);
  assert.match(audit, /`persisted=false` は `apply\(\)` を再実行しない/);
  assert.match(audit, /`persisted=true` では従来どおり `apply\(\)` を実行する/);
});
