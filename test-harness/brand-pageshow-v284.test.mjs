import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const brand = readFileSync('brand-v185.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));

const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.284 audit: product release stays at 264 with matching responsibility baseline', () => {
  assert.equal(release, 264, `audit must not bump product release, got ${release}`);
  assert.equal(String(responsibilities.baselineRelease), '264');
});

test('Ver.284 audit: brand runtime still uses apply for startup and pageshow recovery', () => {
  assert.match(brand, /function apply\(\)[\s\S]*patchBrandMark\(\);[\s\S]*patchBrowserIcons\(\);[\s\S]*patchNotifications\(\);[\s\S]*dataset\.brandVersion = VERSION/);
  assert.match(brand, /if \(document\.readyState === 'loading'\)[\s\S]*DOMContentLoaded', apply[\s\S]*else \{\s*apply\(\);\s*\}/);
  assert.match(brand, /window\.addEventListener\('pageshow', apply\)/);
});

test('Ver.284 audit: startup favicon correction remains apply-owned and idempotent', () => {
  const calls = brand.match(/\bpatchBrowserIcons\(\);/g) || [];
  assert.equal(calls.length, 1, 'expected only the apply-owned patchBrowserIcons call');
  assert.match(brand, /function browserIconsAreCurrent\(\)/);
  assert.match(brand, /if \(!document\.head \|\| browserIconsAreCurrent\(\)\) return;/);
});

test('Ver.284 audit: responsibility ledger still points to the cold-boot pageshow audit', () => {
  const candidate = responsibilities.priorityCandidates?.[0];
  assert.match(candidate?.goal || '', /Ver\.284監査/);
  assert.match(candidate?.goal || '', /cold boot/);
  assert.match(candidate?.goal || '', /pageshow/);
});
