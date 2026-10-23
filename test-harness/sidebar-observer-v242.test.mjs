import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FROZEN_RETIRED_JS_BLOBS_V406, FROZEN_RETIRED_JS_BLOBS_V415 } from './build-pages-runtime-v382.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.242+ product: semantic sidebar replaces Ver.181 and archives historical rollback sources', () => {
  const manifest = read('release-manifest.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  const release = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);

  assert.ok(release >= 242, 'Ver.242 sidebar contract must remain present in later releases');
  assert.equal(scripts.filter(name => name === 'desktop-sidebar-v242.js').length, 1);
  assert.ok(required.includes('desktop-sidebar-v242.js'));
  assert.ok(!scripts.includes('desktop-sidebar-v181.js'));
  assert.ok(!required.includes('desktop-sidebar-v181.js'));

  const frozen = JSON.parse(read('compat/frozen-legacy-runtime-v397.json'));
  for (const legacy of ['desktop-sidebar-v181.js', 'desktop-sidebar-compat-v159.js', 'sidebar-polish-v160.js']) {
    assert.equal(Object.hasOwn({ ...FROZEN_RETIRED_JS_BLOBS_V406, ...FROZEN_RETIRED_JS_BLOBS_V415 }, legacy), true,
      'historical sidebar source must have fixed original Git SHA: ' + legacy);
    assert.equal(fs.existsSync(path.join(ROOT, legacy)), false,
      'historical sidebar source should no longer remain in Git root: ' + legacy);
    assert.equal(typeof frozen[legacy], 'string', 'old sidebar script must stay available to cached HTML: ' + legacy);
  }
});

test('Ver.318 product: proven v158 state owner remains while retired compatibility and semantic takeover stay absent', () => {
  const sidebar = read('desktop-sidebar-v242.js');
  const retired = JSON.parse(read('compat/frozen-legacy-runtime-v397.json'))['desktop-sidebar-v181.js'];
  assert.equal(typeof retired, 'string', 'retired consolidated sidebar original should remain archived');
  assert.equal(FROZEN_RETIRED_JS_BLOBS_V415['desktop-sidebar-v181.js'],
    '6f4a3b5002a0025e25361fc56c3294cf7e7ce09e',
    'historical consolidated sidebar Git SHA must remain pinned');
  const compat = JSON.parse(read('compat/frozen-legacy-runtime-v397.json'))['desktop-sidebar-compat-v159.js'];
  assert.equal(typeof compat, 'string', 'historical v159 compatibility body must remain frozen');

  assert.match(sidebar, /function installDesktopSidebarV158\(\)/,
    'v158 must remain the active desktop state owner');
  assert.match(sidebar, /const DESKTOP_QUERY = "\(min-width: 861px\)"/);
  assert.match(sidebar, /ensurePinButton\(\);\s*bindEvents\(\);\s*applyState\(\);/s);
  assert.doesNotMatch(sidebar, /function labelNavigationButtons\(\)/,
    'Ver.318 semantic takeover must remain retired');
  assert.doesNotMatch(sidebar, /desktopSidebarLabel/);
  assert.equal(sidebar.indexOf(compat), -1, 'v159 compatibility must be absent from active runtime');
  assert.ok(retired.indexOf(compat) >= 0, 'v159 compatibility must remain available in Ver.181 rollback source');
  assert.doesNotMatch(sidebar, /installDesktopSidebarCompatibilityV159/);
  assert.doesNotMatch(sidebar, /const mobile = window\.matchMedia\("\(max-width: 860px\)"\)/);
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

test('sidebar consolidation history remains recorded while later audits may legitimately revisit the active owner', () => {
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  const group = inventory.groups.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.ok(group);
  assert.equal(group.consolidation, 'consolidated-v242');
  assert.ok(group.assets.includes('desktop-sidebar-v242.js'));
  assert.ok(!group.assets.includes('desktop-sidebar-v181.js'));
  assert.match(group.reason, /Ver\.290製品/);
  assert.match(group.reason, /V159 compatibility IIFE/);
  assert.match(group.reason, /V158 core/);
  assert.match(group.reason, /Ver\.318製品/);

  const next = inventory.priorityCandidates?.[0];
  assert.ok(next);
  assert.equal(next.order, 1);
  assert.ok(Array.isArray(next.scope) && next.scope.length > 0);
  assert.ok(!next.scope.includes('desktop-sidebar-v181.js'));
  assert.match(next.precondition, /Ver\.\d+/);
});

// Ver.521: デスクトップ／モバイル境界の元の4テストを既存サイドバー責務へ移管。
test('Ver.290+ product: desktop and mobile owners agree on the 861/860 breakpoint without duplicate desktop compatibility', () => {
  const desktop = read('desktop-sidebar-v242.js');
  const mobile = read('mobile-shell-v234.js');
  const mobileCss = read('ui-mobile-shell-v234.css');

  assert.match(desktop, /const DESKTOP_QUERY = "\(min-width: 861px\)"/);
  assert.doesNotMatch(desktop, /window\.matchMedia\("\(max-width: 860px\)"\)/,
    'Ver.290 desktop runtime must not keep the retired V159 mobile-side compatibility query');
  assert.match(mobile, /const MOBILE_QUERY = "\(max-width: 860px\)"/);
  assert.match(mobileCss, /@media \(max-width: 860px\)/);
});

test('Ver.241+ product: mobile shell stays conditional but desktop cold boot can acquire it once after entering mobile', () => {
  const manifest = read('release-manifest.js');
  const config = read('config.js');
  const dynamicScripts = extractStringArray(manifest, 'dynamicScripts');
  const mobileScripts = extractStringArray(manifest, 'mobileScripts');
  const optionalAssets = extractStringArray(manifest, 'optionalAssets');

  assert.ok(Number(manifest.match(/version:\s*"(\d+)"/)?.[1]) >= 241);
  assert.ok(!dynamicScripts.includes('mobile-shell-v234.js'));
  assert.deepEqual(mobileScripts, ['mobile-shell-v234.js']);
  assert.ok(optionalAssets.includes('mobile-shell-v234.js'));

  assert.match(config, /const MOBILE_QUERY = "\(max-width: 860px\)"/);
  assert.match(config, /const mobileMedia = window\.matchMedia\(MOBILE_QUERY\)/);
  assert.match(config, /const MOBILE_SCRIPTS = \(INVENTORY\.mobileScripts \|\| \[\]\)\.map/);
  assert.match(config, /\.\.\.\(isMobile \? MOBILE_SCRIPTS : \[\]\)/,
    'mobile cold boot must keep mobile scripts before normal dynamic scripts');
  assert.match(config, /async function ensureMobileScripts\(\)/);
  assert.match(config, /if \(!mobileMedia\.matches \|\| !MOBILE_SCRIPTS\.length\) return \[\]/);
  assert.match(config, /if \(mobileScriptsLoadPromise\) return mobileScriptsLoadPromise/,
    'runtime mobile loading must be one-shot');
  assert.match(config, /for \(const \[src, marker\] of MOBILE_SCRIPTS\)[\s\S]*loadScript\(src, marker\)/);
  assert.match(config, /mobileMedia\.addEventListener\("change", handleMobileChange\)/);
  assert.match(config, /if \(!event\.matches \|\| !initialLoadComplete\) return;\s*void ensureMobileScripts\(\)/);
  assert.match(config, /if \(!isMobile && mobileMedia\.matches\) \{\s*await ensureMobileScripts\(\);\s*\}/,
    'a resize during initial loading must be recovered before assets-ready');
  assert.match(config, /script\[data-workboard-stable=\"\$\{marker\}\"\]/,
    'existing loader marker remains the duplicate-request guard');
});

test('Ver.242+ product: mobile observer remains board-scoped while desktop polish has no body observer', () => {
  const desktop = read('desktop-sidebar-v242.js');
  const mobile = read('mobile-shell-v234.js');
  const release = Number(read('release-manifest.js').match(/version:\s*"(\d+)"/)?.[1] || 0);

  assert.match(mobile, /const boardView = document\.getElementById\("boardView"\)/);
  if (release >= 271) {
    assert.match(mobile, /new MutationObserver\(/);
    assert.match(mobile, /\.observe\(boardView, \{ childList: true \}\)/);
    assert.doesNotMatch(mobile, /observe\(boardView, \{ childList: true, subtree: true \}\)/);
  } else {
    assert.match(mobile, /new MutationObserver\(scheduleBoardTabs\)\.observe\(boardView, \{ childList: true, subtree: true \}\)/);
  }

  assert.match(desktop, /button\.querySelectorAll\('\.desktop-sidebar-pin-icon-v158'\)\.forEach\(node => node\.remove\(\)\)/);
  assert.doesNotMatch(desktop, /new MutationObserver/);
  assert.doesNotMatch(desktop, /observer\.observe\(document\.body/);
});

test('Ver.241+ product: navigation synchronization is mobile-owned and desktop navigation remains app-owned', () => {
  const desktop = read('desktop-sidebar-v242.js');
  const mobile = read('mobile-shell-v234.js');

  assert.match(mobile, /if \(event\.target\?\.closest\?\.\("\.nav-item"\)\)/);
  assert.match(mobile, /closeMobileMenu\(\);\s*syncMobileHeaderTitle\(\);\s*patchMobileBoardTabs\(\)/);
  assert.match(desktop, /const navItem = event\.target\.closest\("\.nav-item"\)/);
  assert.doesNotMatch(desktop, /work-mobile-title/);
  assert.doesNotMatch(desktop, /work-mobile-menu-open/);
});
