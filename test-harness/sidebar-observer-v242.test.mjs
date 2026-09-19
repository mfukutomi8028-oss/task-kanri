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

test('Ver.242 audit: sidebar polish observer watches the entire body only to enforce text-only pin presentation', () => {
  const sidebar = read('desktop-sidebar-v181.js');
  const manifest = read('release-manifest.js');

  assert.equal(manifest.match(/version:\s*"(\d+)"/)?.[1], '241', 'audit must not bump the product release');
  assert.match(sidebar, /function refineDesktopSidebarPinV160\(\)/);
  assert.match(sidebar, /const observer = new MutationObserver\(\(\) => apply\(\)\)/);
  assert.match(sidebar, /observer\.observe\(document\.body, \{ childList: true, subtree: true \}\)/);

  const polishStart = sidebar.indexOf('(function refineDesktopSidebarPinV160()');
  const polish = sidebar.slice(polishStart);
  assert.match(polish, /document\.querySelector\('\.desktop-sidebar-pin-v158'\)/);
  assert.match(polish, /button\.querySelectorAll\('\.desktop-sidebar-pin-icon-v158'\)\.forEach\(node => node\.remove\(\)\)/);
  assert.match(polish, /button\.classList\.add\('desktop-sidebar-pin-text-only-v160'\)/);
  assert.doesNotMatch(polish, /localStorage/);
  assert.doesNotMatch(polish, /data-desktop-sidebar-state/);
  assert.doesNotMatch(polish, /addEventListener\(['"]click/);
});

test('Ver.242 audit: core creates the pin once before polish and later pin updates never recreate the removed icon', () => {
  const sidebar = read('desktop-sidebar-v181.js');
  const coreAt = sidebar.indexOf('(function installDesktopSidebarV158()');
  const compatAt = sidebar.indexOf('(function installDesktopSidebarCompatibilityV159()');
  const polishAt = sidebar.indexOf('(function refineDesktopSidebarPinV160()');
  assert.ok(coreAt >= 0 && compatAt > coreAt && polishAt > compatAt, 'consolidated execution order must remain core -> compat -> polish');

  const core = sidebar.slice(coreAt, compatAt);
  assert.match(core, /function ensurePinButton\(\)/);
  assert.match(core, /pinButton = document\.createElement\("button"\)/);
  assert.match(core, /class="desktop-sidebar-pin-icon-v158"/);
  assert.match(core, /const icon = pinButton\.querySelector\("\.desktop-sidebar-pin-icon-v158"\)/);
  assert.match(core, /if \(icon\) icon\.textContent = pinned \? "📍" : "📌"/);
  assert.doesNotMatch(core, /createElement\([^\n]*desktop-sidebar-pin-icon-v158/);
});

test('Ver.242 audit: no other active runtime asset owns or recreates the desktop pin/icon markup', () => {
  const manifest = read('release-manifest.js');
  const active = [
    'app.js',
    ...extractStringArray(manifest, 'dynamicScripts'),
    ...extractStringArray(manifest, 'mobileScripts')
  ];
  const unique = [...new Set(active)];

  for (const asset of unique) {
    if (asset === 'desktop-sidebar-v181.js') continue;
    const source = read(asset);
    assert.doesNotMatch(source, /desktop-sidebar-pin-v158|desktop-sidebar-pin-icon-v158|desktop-sidebar-pin-text-only-v160/,
      `${asset} must not own desktop pin presentation`);
  }
});

test('Ver.242 audit: completed Ver.241 mobile-shell boundary remains separate from sidebar polish observer cleanup', () => {
  const config = read('config.js');
  const sidebar = read('desktop-sidebar-v181.js');

  assert.match(config, /function ensureMobileScripts\(\)/);
  assert.match(config, /mobileMedia\.addEventListener\("change", handleMobileChange\)/);
  assert.match(sidebar, /const DESKTOP_QUERY = "\(min-width: 861px\)"/);
  assert.match(sidebar, /const mobile = window\.matchMedia\("\(max-width: 860px\)"\)/);

  const polish = sidebar.slice(sidebar.indexOf('(function refineDesktopSidebarPinV160()'));
  assert.doesNotMatch(polish, /matchMedia/);
  assert.doesNotMatch(polish, /mobile-shell-v234/);
});
