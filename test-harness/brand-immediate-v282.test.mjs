import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const brand = readFileSync('brand-v185.js', 'utf8');
const config = readFileSync('config.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));

const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);
const standaloneNeedle = `  // Correct the loader's compatibility favicon as soon as this runtime arrives.\n  patchBrowserIcons();`;

test('Ver.283+ product: release and responsibility baseline remain aligned after release 264', () => {
  assert.ok(release >= 264, `expected release >= 264, got ${release}`);
  assert.equal(String(responsibilities.baselineRelease), String(release));
});

test('Ver.283 product: brand startup owns browser icon correction only through apply', () => {
  const calls = brand.match(/\bpatchBrowserIcons\(\);/g) || [];
  assert.equal(calls.length, 1, 'expected only the apply-owned patchBrowserIcons call');
  assert.ok(!brand.includes(standaloneNeedle), 'standalone startup correction must be retired');
  assert.match(brand, /function apply\(\)[\s\S]*patchBrandMark\(\);[\s\S]*patchBrowserIcons\(\);[\s\S]*patchNotifications\(\)/);
});

test('Ver.283 product: dynamic loader still reaches apply on the normal post-loading path', () => {
  assert.match(manifest, /["']brand-v185\.js["']/);
  assert.match(config, /document\.addEventListener\(["']DOMContentLoaded["'],\s*start/);
  assert.match(config, /for \(const \[src, marker\] of SCRIPTS\)[\s\S]*await loadScript\(src, marker\)/);
  assert.match(brand, /if \(document\.readyState === 'loading'\)[\s\S]*else \{\s*apply\(\);\s*\}/);
});

test('Ver.283+ product: canonical apply keeps brand, favicon and Notification together while later releases may narrow pageshow recovery', () => {
  assert.match(brand, /function apply\(\)[\s\S]*patchBrandMark\(\);[\s\S]*patchBrowserIcons\(\);[\s\S]*patchNotifications\(\);[\s\S]*dataset\.brandVersion = VERSION/);
  assert.match(brand, /window\.addEventListener\('pageshow'/);
  assert.match(brand, /function browserIconsAreCurrent\(\)/);
  assert.match(brand, /if \(!document\.head \|\| browserIconsAreCurrent\(\)\) return;/);
  if (release >= 265) {
    assert.match(brand, /if \(event\.persisted\) apply\(\)/);
  }
});

test('Ver.283 product: responsibility ledger retains the retirement after later brand cleanup', () => {
  const iconGroup = responsibilities.groups.find(group => group.id === 'icon-system');
  assert.ok(iconGroup?.reason.includes('Ver.282監査'));
  assert.ok(iconGroup?.reason.includes('Ver.283製品'));
});
