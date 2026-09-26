import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const brand = readFileSync('brand-v185.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const audit = readFileSync('BRAND_BFCACHE_RECOVERY_AUDIT_V288.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.288 audit stays on the Ver.287 release baseline', () => {
  assert.equal(release, 266);
});

test('Ver.288 audit preserves startup apply and persisted-only pageshow recovery', () => {
  assert.match(brand, /if \(document\.readyState === 'loading'\)[\s\S]*DOMContentLoaded', apply[\s\S]*else \{\s*apply\(\);/);
  assert.match(brand, /window\.addEventListener\('pageshow', event => \{[\s\S]*if \(event\.persisted\) apply\(\);[\s\S]*\}\);/);
  assert.doesNotMatch(brand, /window\.addEventListener\('pageshow', apply\)/);
});

test('Ver.288 audit keeps all four recovery responsibilities idempotent', () => {
  assert.match(brand, /if \(img\.getAttribute\('src'\) !== SVG_ICON\) img\.setAttribute\('src', SVG_ICON\)/);
  assert.match(brand, /if \(!document\.head \|\| browserIconsAreCurrent\(\)\) return;/);
  assert.match(brand, /if \(!current \|\| current\.__workBoardBrandVersion === VERSION\) return;/);
  assert.match(brand, /if \(document\.documentElement\.dataset\.brandVersion !== VERSION\) \{\s*document\.documentElement\.dataset\.brandVersion = VERSION;/);
});

test('Ver.288 audit records the product decision gate before narrowing recovery', () => {
  assert.match(audit, /does \*\*not\*\* assume that the BFCache pass is removable/);
  assert.match(audit, /non-persisted `pageshow` remains a no-op/);
  assert.match(audit, /synthetic drift in each responsibility is repaired by persisted recovery/);
  assert.match(audit, /Only promote a Ver\.289 product change if the audit demonstrates a strictly smaller recovery boundary/);
});
