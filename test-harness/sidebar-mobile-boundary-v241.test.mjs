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

test('Ver.242 product: mobile observer remains board-scoped while desktop polish has no body observer', () => {
  const desktop = read('desktop-sidebar-v242.js');
  const mobile = read('mobile-shell-v234.js');

  assert.match(mobile, /const boardView = document\.getElementById\("boardView"\)/);
  assert.match(mobile, /new MutationObserver\(scheduleBoardTabs\)\.observe\(boardView, \{ childList: true, subtree: true \}\)/);

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
