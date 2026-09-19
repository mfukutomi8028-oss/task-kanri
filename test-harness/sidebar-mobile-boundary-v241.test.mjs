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

test('Ver.241 audit: desktop and mobile owners agree on the 861/860 breakpoint', () => {
  const desktop = read('desktop-sidebar-v181.js');
  const mobile = read('mobile-shell-v234.js');
  const mobileCss = read('ui-mobile-shell-v234.css');

  assert.match(desktop, /const DESKTOP_QUERY = "\(min-width: 861px\)"/);
  assert.match(desktop, /window\.matchMedia\("\(max-width: 860px\)"\)/);
  assert.match(mobile, /const MOBILE_QUERY = "\(max-width: 860px\)"/);
  assert.match(mobileCss, /@media \(max-width: 860px\)/);
});

test('Ver.241 audit: mobile shell is boot-conditional, so a desktop cold boot cannot acquire it after resize', () => {
  const manifest = read('release-manifest.js');
  const config = read('config.js');
  const dynamicScripts = extractStringArray(manifest, 'dynamicScripts');
  const mobileScripts = extractStringArray(manifest, 'mobileScripts');
  const optionalAssets = extractStringArray(manifest, 'optionalAssets');

  assert.equal(manifest.match(/version:\s*"(\d+)"/)?.[1], '240', 'audit must not bump product release');
  assert.ok(!dynamicScripts.includes('mobile-shell-v234.js'));
  assert.deepEqual(mobileScripts, ['mobile-shell-v234.js']);
  assert.ok(optionalAssets.includes('mobile-shell-v234.js'));

  assert.match(config, /const isMobile = window\.matchMedia\("\(max-width: 860px\)"\)\.matches/);
  assert.match(config, /\.\.\.\(isMobile \? \(INVENTORY\.mobileScripts \|\| \[\]\)\.map/);
  assert.doesNotMatch(config, /matchMedia\("\(max-width: 860px\)"\)[\s\S]*addEventListener\("change"/,
    'loader currently has no runtime media-change path for conditional mobile scripts');
});

test('Ver.241 audit: mobile observer is board-scoped while desktop polish keeps a body-wide compatibility observer', () => {
  const desktop = read('desktop-sidebar-v181.js');
  const mobile = read('mobile-shell-v234.js');

  assert.match(mobile, /const boardView = document\.getElementById\("boardView"\)/);
  assert.match(mobile, /new MutationObserver\(scheduleBoardTabs\)\.observe\(boardView, \{ childList: true, subtree: true \}\)/);

  assert.match(desktop, /const observer = new MutationObserver\(\(\) => apply\(\)\)/);
  assert.match(desktop, /observer\.observe\(document\.body, \{ childList: true, subtree: true \}\)/);
  assert.match(desktop, /button\.querySelectorAll\('\.desktop-sidebar-pin-icon-v158'\)\.forEach\(node => node\.remove\(\)\)/);
});

test('Ver.241 audit: navigation synchronization is mobile-owned and desktop navigation remains app-owned', () => {
  const desktop = read('desktop-sidebar-v181.js');
  const mobile = read('mobile-shell-v234.js');

  assert.match(mobile, /if \(event\.target\?\.closest\?\.\("\.nav-item"\)\)/);
  assert.match(mobile, /closeMobileMenu\(\);\s*syncMobileHeaderTitle\(\);\s*patchMobileBoardTabs\(\)/);
  assert.match(desktop, /const navItem = event\.target\.closest\("\.nav-item"\)/);
  assert.doesNotMatch(desktop, /work-mobile-title/);
  assert.doesNotMatch(desktop, /work-mobile-menu-open/);
});
