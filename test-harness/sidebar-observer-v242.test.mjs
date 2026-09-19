import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.242 product: semantic sidebar replaces Ver.181 exactly once while rollback files remain physical', () => {
  const manifest = read('release-manifest.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  const release = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);

  assert.ok(release >= 242, 'Ver.242 sidebar contract must remain present in later releases');
  assert.equal(scripts.filter(name => name === 'desktop-sidebar-v242.js').length, 1);
  assert.ok(required.includes('desktop-sidebar-v242.js'));
  assert.ok(!scripts.includes('desktop-sidebar-v181.js'));
  assert.ok(!required.includes('desktop-sidebar-v181.js'));

  for (const legacy of ['desktop-sidebar-v181.js', 'sidebar-polish-v160.js']) {
    assert.ok(fs.existsSync(path.join(ROOT, legacy)), `${legacy} must remain available for rollback/cache compatibility`);
  }
});

test('Ver.242 product: proven v158 core and v159 compatibility remain byte-preserved in the semantic runtime', () => {
  const sidebar = read('desktop-sidebar-v242.js');
  const core = read('desktop-sidebar-v158.js');
  const compat = read('desktop-sidebar-compat-v159.js');

  const coreAt = sidebar.indexOf(core);
  const compatAt = sidebar.indexOf(compat);
  assert.ok(coreAt >= 0, 'v158 core body must remain byte-preserved');
  assert.ok(compatAt > coreAt, 'v159 compatibility must remain byte-preserved after v158 core');
  assert.match(sidebar, /const DESKTOP_QUERY = "\(min-width: 861px\)"/);
  assert.match(sidebar, /const mobile = window\.matchMedia\("\(max-width: 860px\)"\)/);
});

test('Ver.242 product: text-only pin keeps startup and pageshow correction without a MutationObserver', () => {
  const sidebar = read('desktop-sidebar-v242.js');
  const polishStart = sidebar.indexOf('(function refineDesktopSidebarPinV242()');
  assert.ok(polishStart >= 0, 'Ver.242 text-only polish must exist');
  const polish = sidebar.slice(polishStart);

  assert.match(polish, /document\.querySelector\('\.desktop-sidebar-pin-v158'\)/);
  assert.match(polish, /button\.querySelectorAll\('\.desktop-sidebar-pin-icon-v158'\)\.forEach\(node => node\.remove\(\)\)/);
  assert.match(polish, /button\.classList\.add\('desktop-sidebar-pin-text-only-v160'\)/);
  assert.match(polish, /function start\(\) \{\s*apply\(\);\s*\}/);
  assert.match(polish, /window\.addEventListener\('pageshow', apply\)/);
  assert.doesNotMatch(polish, /MutationObserver/);
  assert.doesNotMatch(polish, /observer\.observe/);
  assert.doesNotMatch(polish, /localStorage/);
  assert.doesNotMatch(polish, /data-desktop-sidebar-state/);
  assert.doesNotMatch(polish, /addEventListener\(['"]click/);
});

test('Ver.242 product: no other active runtime asset owns or recreates desktop pin presentation', () => {
  const manifest = read('release-manifest.js');
  const active = [
    'app.js',
    ...extractStringArray(manifest, 'dynamicScripts'),
    ...extractStringArray(manifest, 'mobileScripts')
  ];

  for (const asset of [...new Set(active)]) {
    if (asset === 'desktop-sidebar-v242.js') continue;
    const source = read(asset);
    assert.doesNotMatch(source, /desktop-sidebar-pin-v158|desktop-sidebar-pin-icon-v158|desktop-sidebar-pin-text-only-v160/,
      `${asset} must not own desktop pin presentation`);
  }
});

test('Ver.242 product: sidebar consolidation stays complete while later cleanup priorities advance independently', () => {
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  const group = inventory.groups.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.ok(group);
  assert.equal(group.consolidation, 'consolidated-v242');
  assert.ok(group.assets.includes('desktop-sidebar-v242.js'));
  assert.ok(!group.assets.includes('desktop-sidebar-v181.js'));
  assert.match(group.reason, /MutationObserver/);
  assert.match(group.reason, /初期apply\/pageshow/);

  const next = inventory.priorityCandidates?.[0];
  assert.ok(next);
  assert.equal(next.order, 1);
  assert.ok(Array.isArray(next.scope) && next.scope.length > 0);
  assert.ok(!next.scope.includes('desktop-sidebar-v181.js'));
  assert.ok(!next.scope.includes('desktop-sidebar-v242.js'));
  assert.match(next.precondition, /Ver\.\d+/);
});
