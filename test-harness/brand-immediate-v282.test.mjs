import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const brand = readFileSync('brand-v185.js', 'utf8');
const config = readFileSync('config.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));

const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);
const standaloneNeedle = `  // Correct the loader's compatibility favicon as soon as this runtime arrives.\n  patchBrowserIcons();`;

test('Ver.282 audit: baseline remains release 263 or later without product runtime change', () => {
  assert.ok(release >= 263, `expected release >= 263, got ${release}`);
  assert.equal(String(responsibilities.baselineRelease), String(release));
});

test('Ver.282 audit: brand runtime currently invokes browser icon correction twice during normal startup path', () => {
  const calls = brand.match(/\bpatchBrowserIcons\(\);/g) || [];
  assert.equal(calls.length, 2, 'expected one standalone call plus one apply-owned call');
  assert.ok(brand.includes(standaloneNeedle), 'standalone startup correction must remain present during audit');
  assert.match(brand, /function apply\(\)[\s\S]*patchBrandMark\(\);[\s\S]*patchBrowserIcons\(\);[\s\S]*patchNotifications\(\)/);
});

test('Ver.282 audit: dynamic loader guarantees brand execution after loading state on the normal path', () => {
  assert.match(manifest, /["']brand-v185\.js["']/);
  assert.match(config, /document\.addEventListener\(["']DOMContentLoaded["'],\s*start/);
  assert.match(config, /for \(const \[src, marker\] of SCRIPTS\)[\s\S]*await loadScript\(src, marker\)/);
  assert.match(brand, /if \(document\.readyState === 'loading'\)[\s\S]*else \{\s*apply\(\);\s*\}/);
});

test('Ver.282 audit: counterfactual removes only the standalone call and preserves canonical apply plus pageshow recovery', () => {
  const counterfactual = brand.replace(
    standaloneNeedle,
    `  // Ver.282 audit counterfactual: standalone favicon correction suppressed.`
  );

  assert.notEqual(counterfactual, brand, 'counterfactual replacement must match the current source');
  assert.equal((counterfactual.match(/\bpatchBrowserIcons\(\);/g) || []).length, 1);
  assert.match(counterfactual, /function apply\(\)[\s\S]*patchBrandMark\(\);[\s\S]*patchBrowserIcons\(\);[\s\S]*patchNotifications\(\)/);
  assert.match(counterfactual, /window\.addEventListener\('pageshow', apply\)/);
  assert.match(counterfactual, /document\.documentElement\.dataset\.brandVersion = VERSION/);
});
