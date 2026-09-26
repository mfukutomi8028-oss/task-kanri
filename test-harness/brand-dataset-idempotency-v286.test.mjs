import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const brand = readFileSync('brand-v185.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));

const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.286 audit: product release remains 265 with matching responsibility baseline', () => {
  assert.equal(release, 265);
  assert.equal(String(responsibilities.baselineRelease), '265');
});

test('Ver.286 audit: pageshow recovery stays persisted-only', () => {
  assert.match(brand, /window\.addEventListener\('pageshow', event => \{[\s\S]*if \(event\.persisted\) apply\(\);[\s\S]*\}\);/);
  assert.doesNotMatch(brand, /window\.addEventListener\('pageshow', apply\)/);
});

test('Ver.286 audit: brand, favicon and Notification remain guarded while dataset assignment is unconditional', () => {
  assert.match(brand, /if \(img\.getAttribute\('src'\) !== SVG_ICON\) img\.setAttribute\('src', SVG_ICON\)/);
  assert.match(brand, /if \(!document\.head \|\| browserIconsAreCurrent\(\)\) return;/);
  assert.match(brand, /if \(!current \|\| current\.__workBoardBrandVersion === VERSION\) return;/);
  assert.match(brand, /document\.documentElement\.dataset\.brandVersion = VERSION;/);
  assert.doesNotMatch(brand, /if \(document\.documentElement\.dataset\.brandVersion !== VERSION\)/);
});

test('Ver.286 audit: responsibility ledger targets persisted no-drift dataset idempotency only', () => {
  const goal = responsibilities.priorityCandidates?.[0]?.goal || '';
  assert.match(goal, /Ver\.286監査/);
  assert.match(goal, /persisted=true/);
  assert.match(goal, /data-brand-version/);
  assert.match(goal, /idempotent/);
});
