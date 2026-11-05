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
  assert.match(manifest, /document.getElementById\('paletteNextRoot'\)/);
  assert.doesNotMatch(manifest, /setTimeout\(revealCurrentUi,\s*4000\)/);
  assert.match(index, /id="wbBootScreen"/);
  assert.match(manifest, /retry.hidden = false/);
  assert.match(app, /WORK_BOARD_CORE_READY = true/);
  for (const file of ['origin-modern-v372.js','journal-display-v367.js','palette-next-v369.js'])
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
  assert.match(config, /preloadUpcomingScripts\(index\)/);
  assert.match(config, /await loadScript\(src, marker\)/);
});
