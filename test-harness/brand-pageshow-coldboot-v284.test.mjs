import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const brand = readFileSync('brand-v185.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('BRAND_PAGESHOW_COLD_BOOT_AUDIT_V284.md', 'utf8');

const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.284 audit: product release remains 264 with matching responsibility baseline', () => {
  assert.equal(release, 264, `audit must not bump release, got ${release}`);
  assert.equal(String(responsibilities.baselineRelease), '264');
});

test('Ver.284 audit: startup remains one canonical apply while pageshow still reuses the same apply', () => {
  const calls = brand.match(/\bpatchBrowserIcons\(\);/g) || [];
  assert.equal(calls.length, 1, 'favicon correction must remain apply-owned');
  assert.match(brand, /function apply\(\)[\s\S]*patchBrandMark\(\);[\s\S]*patchBrowserIcons\(\);[\s\S]*patchNotifications\(\);[\s\S]*dataset\.brandVersion = VERSION/);
  assert.match(brand, /window\.addEventListener\('pageshow', apply\)/);
});

test('Ver.284 audit: no-drift guards protect brand, favicon and Notification writes but dataset assignment is unconditional', () => {
  assert.match(brand, /if \(img\.getAttribute\('src'\) !== SVG_ICON\) img\.setAttribute\('src', SVG_ICON\)/);
  assert.match(brand, /if \(!document\.head \|\| browserIconsAreCurrent\(\)\) return;/);
  assert.match(brand, /if \(!current \|\| current\.__workBoardBrandVersion === VERSION\) return;/);
  assert.match(brand, /document\.documentElement\.dataset\.brandVersion = VERSION;/);
});

test('Ver.284 audit: current ledger explicitly targets the cold-boot pageshow pass without changing runtime', () => {
  assert.match(responsibilities.priorityCandidates?.[0]?.goal || '', /Ver\.284監査/);
  assert.match(responsibilities.priorityCandidates?.[0]?.goal || '', /pageshow/);
  assert.match(responsibilities.priorityCandidates?.[0]?.goal || '', /no-drift/);
});

test('Ver.284 audit: durable audit record concludes cold-boot pass is redundant while persisted recovery remains required', () => {
  assert.match(audit, /cold boot初回pageshowを実行しなくても、startup `apply\(\)` だけで最終canonical状態は完全に成立した/);
  assert.match(audit, /BFCache相当のpersisted pageshow recoveryには独立した復旧価値がある/);
  assert.match(audit, /Ver\.285製品化候補/);
  assert.match(audit, /`persisted=false` は `apply\(\)` を再実行しない/);
  assert.match(audit, /`persisted=true` では従来どおり `apply\(\)` を実行する/);
});
