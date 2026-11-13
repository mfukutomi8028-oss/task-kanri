import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const manifest = read('release-manifest.js');
const index = read('index.html');
const app = read('app.js');
const modern = read('modern-display-v356.js');
const config = read('config.js');

test('startup: preserve the room/user mode before the first paint', () => {
  const choice = manifest.indexOf('root.dataset.wbDisplay = savedMode();');
  const guard = manifest.indexOf('root.classList.add(bootClass);');
  assert.ok(choice > 0 && choice < guard);
  assert.match(manifest, /workBoardDisplayV356:/);
  assert.match(manifest, /systemTaskRoomId/);
  assert.match(manifest, /systemTaskUser/);
  assert.match(modern, /window.WorkBoardStartup\?\.readMode/);
});

test('startup: reveal requires app, assets, and selected display', () => {
  assert.match(manifest, /!assetsReady \|\| !coreReady \|\| !selectedDisplayReady\(\)/);
  assert.match(manifest, /document.getElementById\('wbJournalHeaderV367'\)/);
  assert.match(manifest, /root.dataset.modernOriginReady === 'true'/);
  assert.doesNotMatch(manifest, /setTimeout\(revealCurrentUi,\s*4000\)/);
  assert.match(index, /id="wbBootScreen"/);
  assert.match(manifest, /retry.hidden = false/);
  assert.match(app, /WORK_BOARD_CORE_READY = true/);
  for (const file of ['origin-modern-v372.js','journal-display-v367.js'])
    assert.match(read(file), /new Event\('workboard:display-ready'\)/);
});

test('startup: retired cache deletion controls and handlers are fully removed', () => {
  assert.doesNotMatch(index, /(?:roomCacheHelp|clearRoomCache)/);
  assert.doesNotMatch(app, /(?:roomCacheHelp|clearRoomCache|roomCacheKeys|syncRoomCacheClearUi)/);
  for (const file of ['ui-sidebar-v180.css','modern-display-v356.css','color-themes-v329.css','journal-display-v367.css','journal-display-v367.js'])
    assert.doesNotMatch(read(file), /(?:roomCacheHelp|clearRoomCache)/);
});

test('startup: parallel preload keeps dependency-sensitive JS execution order', () => {
  assert.match(config, /SCRIPT_PRELOAD_AHEAD = 6/);
  assert.match(config, /link.rel = 'preload'/);
  assert.match(config, /preloadUpcomingScripts\(scriptIndex\+\+\)/);
  assert.match(config, /await loadScript\(src, marker\)/);
  assert.match(config, /const stylesReady = Promise\.all\(/);
  assert.match(config, /styleResults\.push\(\.\.\.await stylesReady\)/);
  assert.ok(config.indexOf('const stylesReady = Promise.all(') < config.lastIndexOf('await loadScript(src, marker)'));
  assert.ok(config.lastIndexOf('await loadScript(src, marker)') < config.indexOf('await stylesReady'));
  assert.ok(config.indexOf('await stylesReady') < config.lastIndexOf('notifyAssetsReady(styleResults, scriptResults)'));
});

test('startup: load only the active screen bundle; keep cascade slots across later mode changes', () => {
  assert.match(manifest, /deferredDisplayAssets:\s*\{/);
  assert.match(manifest, /modern:\s*\{ styles: \[\], scripts: \["origin-modern-v372\.js"\] \}/);
  assert.match(manifest, /journal:\s*\{ styles: \["journal-display-v367\.css"\], scripts: \["journal-display-v367\.js"\] \}/);
  assert.match(config, /const INITIAL_MODE = document\.documentElement\.dataset\.wbDisplay \|\| 'classic'/);
  assert.match(config, /const STYLES = ALL_STYLES\.filter/);
  assert.match(config, /const SCRIPTS = \[/);
  assert.match(config, /preserveStyleOrder\(\);/);
  assert.match(config, /document\.head\.insertBefore\(link, styleSlots\.get\(marker\) \|\| null\)/);
  assert.match(config, /new MutationObserver\(handleDisplayChange\)/);
  assert.match(config, /const styleResults = await Promise\.all\(/);
  assert.match(config, /for \(const \[src, marker\] of scripts\) scriptResults\.push\(await loadScript\(src, marker\)\)/);
  assert.match(config, /if \(document\.documentElement\.dataset\.wbDisplay !== INITIAL_MODE\) handleDisplayChange\(\)/);
});

test('startup: retired screen bundles cannot block or modify the three-mode startup', () => {
  const common=read('modern-display-v356.css');
  assert.doesNotMatch(manifest,/palette-display-v358|palette-next-v369|palette:\s*\{/);
  assert.doesNotMatch(modern,/loadPaletteNext|wbPaletteNextPreview/);
  assert.match(common,/\.wb-display-segments-v356\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important\}/);
  assert.match(config,/deferredStyleModes\.get\(marker\) === mode/);
  assert.match(config,/deferredScriptModes\.get\(marker\) === mode/);
});

test('mode switch: failed assets are retried and the old selected view remains recoverable', () => {
  const css = read('modern-display-v356.css');
  assert.match(config, /if \(link\.dataset\.failed\) link\.remove\(\)/);
  assert.match(config, /if \(existing\.dataset\.failed\) existing\.remove\(\)/);
  assert.match(config, /if \(!ok && displayLoads\.get\(mode\) === loading\) displayLoads\.delete\(mode\)/);
  assert.match(config, /window\.WorkBoardDisplayAssets = Object\.freeze\(\{ ensure: ensureDisplayAssets \}\)/);
  assert.match(modern, /beginSwitch\(next\)/);
  assert.match(modern, /watchSwitchAssets\(next\)/);
  assert.match(modern, /data-wb-display-retry/);
  assert.match(modern, /data-wb-display-classic/);
  assert.match(modern, /workboard:display-ready/);
  assert.match(css, /#wbDisplaySwitchV459\[hidden\]/);
  assert.match(manifest, /journal-display-v367\.css"\]\[data-loaded="true"\]/);
  assert.match(modern, /journal-display-v367\.css"\]\[data-loaded="true"\]/);
});
