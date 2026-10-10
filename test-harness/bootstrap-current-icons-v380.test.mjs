import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LEGACY_RUNTIME_ALIASES } from './build-pages-runtime-v382.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const manifest = fs.readFileSync(path.join(ROOT, 'release-manifest.js'), 'utf8');
const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'patch-responsibilities.json'), 'utf8'));
const map = [
  ['nav-today-v87.png', 'nav-today-v169.svg'],
  ['nav-todo-v142.svg', 'nav-todo-v168.svg'],
  ['nav-task-v87.png', 'nav-task-v169.svg'],
  ['nav-schedule-v87.png', 'nav-schedule-v169.svg'],
  ['summary-mine.png', 'nav-mine-v169.svg'],
  ['nav-star-menu.png', 'nav-star-v169.svg'],
  ['nav-done.png', 'nav-done-v169.svg'],
  ['summary-open.png', 'summary-open-v169.svg'],
  ['summary-overdue.png', 'summary-overdue-v169.svg'],
  ['summary-today.png', 'nav-today-v169.svg']
];

test('Ver.380: bootstrap nav and summary icons use canonical SVG without legacy URLs', () => {
  const tags = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(x => x[1]);
  assert.ok(tags.length >= 12, 'bootstrap icon inventory unexpectedly small');
  for (const [legacy, canonical] of map) {
    assert.ok(!tags.some(src => src.includes(legacy)), 'HTML must not request old icon: ' + legacy);
    assert.ok(tags.some(src => src.includes(canonical)), 'canonical bootstrap icon missing: ' + canonical);
    assert.ok(fs.existsSync(path.join(ROOT, 'assets', canonical)), 'canonical SVG missing: ' + canonical);
  }
  assert.match(html, /<link rel="icon" type="image\/png" href="assets\/brand\.png\?v=143"/,
    'brand bootstrap is intentionally kept for a separate audit');
  assert.match(html, /<script src="release-manifest\.js\?v=143"><\/script>/);
  assert.match(html, /<script src="config\.js\?v=143"><\/script>/);
  assert.match(html, /<div class="app-version" title="現在のバージョン">Ver\.143<\/div>/);
});

test('Ver.380: retired HTML icon sources remain first-paint/cache compatible', () => {
  assert.match(manifest, /function upgradeImage\(img\)/);
  assert.match(manifest, /finalizeLegacyIconCompatibility\(\)/);
  for (const [old, current] of map) {
    assert.ok(manifest.includes("'assets/" + old + "'"), 'legacy compatibility lookup removed: ' + old);
    assert.ok(manifest.includes("'assets/" + current + "'"), 'legacy compatibility destination removed: ' + current);
    if (old === 'summary-today.png') {
      assert.equal(fs.existsSync(path.join(ROOT, 'assets', old)), false,
        'duplicate summary PNG must be retired from Git');
      assert.equal(LEGACY_RUNTIME_ALIASES['assets/summary-today.png'], 'assets/nav-today-v87.png',
        'retired summary URL must be reconstructed in Pages');
      assert.ok(fs.existsSync(path.join(ROOT, 'assets/nav-today-v87.png')),
        'canonical binary source for legacy summary URL is missing');
    } else {
      assert.ok(fs.existsSync(path.join(ROOT, 'assets', old)),
        'legacy HTML asset must remain physically available: ' + old);
    }
  }
  const version = manifest.match(/version:\s*"(\d+)"/)?.[1] || '';
  assert.equal(version, '304');
  assert.equal(ledger.baselineRelease, version);
});

test('Ver.380: legacy brand and dynamic work-memo boot paths remain compatible', () => {
  assert.match(html, /assets\/brand\.png\?v=143/);
  assert.match(fs.readFileSync(path.join(ROOT, 'work-features-v167.js'), 'utf8'), /nav-memo-v167\.svg/);
  assert.ok(fs.existsSync(path.join(ROOT, 'assets/nav-memo-v167.svg')));
});
