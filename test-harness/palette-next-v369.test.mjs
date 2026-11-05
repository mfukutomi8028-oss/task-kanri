import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const manifest=read('release-manifest.js');
const css=read('palette-next-v369.css');
const shell=read('palette-next-v369.js');
const app=read('app.js');
const mode=read('modern-display-v356.js');
const responsibilities=JSON.parse(read('patch-responsibilities.json'));

test('Palette NEXT is optional in production while the legacy Palette stays active',()=>{
  const activeStyles=manifest.match(/dynamicStyles:\s*\[([^\]]+)\]/)?.[1]||'';
  const activeScripts=manifest.match(/dynamicScripts:\s*\[([^\]]+)\]/)?.[1]||'';
  assert.match(activeStyles,/palette-display-v358\.css/);
  assert.match(activeScripts,/palette-display-v358\.js/);
  assert.doesNotMatch(activeStyles,/palette-next-v369\.css/);
  assert.doesNotMatch(activeScripts,/palette-next-v369\.js/);
  assert.match(manifest,/optionalAssets: \["mobile-shell-v234\.js", "palette-next-v369\.css", "palette-next-v369\.js"\]/);
  assert.match(mode,/new Set\(\['classic', 'modern', 'palette', 'journal'\]\)/);
  assert.match(mode,/WorkBoardDisplayController/);
  assert.ok(Number(responsibilities.baselineRelease) >= 369);
  const palette=responsibilities.groups.find(item=>item.id==='palette-display');
  assert.deepEqual(palette.assets,['palette-display-v358.css','palette-display-v358.js']);
  assert.equal(responsibilities.groups.some(item=>item.id==='palette-next-preview'),false);
  assert.match(palette.reason,/palette-next-v369/);
});

test('Palette NEXT is a separate DOM root and never proxies hidden Classic controls',()=>{
  assert.match(shell,/id = 'paletteNextRoot'/);
  assert.match(shell,/document\.body\.appendChild\(root\)/);
  assert.match(shell,/WorkBoardPaletteBridge/);
  assert.match(shell,/bridge\.subscribe/);
  assert.doesNotMatch(shell,/\.sidebar\b|\.nav-item\b|#todayView|#todoView|\.today-grid|#scheduleDialog/);
  assert.doesNotMatch(shell,/runTransaction|firebase|document\.write|\.click\(\)\s*;\s*return/);
  assert.match(css,/#paletteNextRoot/);
  assert.match(css,/html\[data-wb-palette-next-preview="true"\] body \.app-shell/);
  assert.doesNotMatch(css,/html\[data-wb-display="palette"\] body \.app-shell/);
  assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
});

test('Palette NEXT dispatch uses canonical business writers and exposes read-only snapshots',()=>{
  const start=app.indexOf('/* Palette NEXT Phase 1');
  const end=app.indexOf('// v31: すべての定義が完了してから初期化する',start);
  assert.ok(start>0&&end>start);
  const bridge=app.slice(start,end);
  for (const action of ['createTodo','toggleTodo','updateTodoDetails','deleteTodo',
    'reorderTodo','completeTaskWithMemo','changeStatus','toggleTaskFavorite']) {
    assert.match(bridge,new RegExp('\\b'+action+'\\('));
  }
  assert.match(bridge,/readSnapshot: paletteNextSnapshot/);
  assert.match(bridge,/paletteNextSubscribers\.add\(listener\)/);
  assert.match(app,/notifyPaletteNextSubscribers\(\);\s*\n\}/);
  assert.doesNotMatch(bridge,/runTransaction|set\(ref\(|update\(ref\(|remove\(ref\(|onValue\(/);
});

test('Palette NEXT preserves current Classic and Modern runtime files for rollback',()=>{
  assert.ok(read('palette-display-v358.css').length>100);
  assert.ok(read('palette-display-v358.js').length>100);
  assert.ok(read('modern-display-v356.css').length>100);
  assert.ok(read('journal-display-v367.js').length>100);
  assert.ok(Number(manifest.match(/version: "(\d+)"/)?.[1] || 0) >= 369);
});

test('Palette NEXT live memo feed uses existing memo-owner subscriptions',()=>{
  const memo=read('work-features-v167.js');
  assert.match(memo,/WorkBoardPaletteMemoBridgeV369/);
  assert.match(memo,/memoList\(\{ ignoreFilters: true \}\)/);
  assert.match(memo,/notifyPaletteMemoPreview\(\)/);
  assert.match(shell,/memoBridge\?\.subscribe\?\./);
  assert.doesNotMatch(shell,/runTransaction|initializeApp|getDatabase|onValue\(/);
});
test('Palette NEXT entry is a lazy preview and existing choices remain unchanged',()=>{
  assert.match(mode,/wbPaletteNextPreviewV369/);
  assert.match(mode,/loadPaletteNextPreview/);
  assert.match(mode,/paletteNext', '1'/);
  assert.match(shell,/data-pn-exit/);
  assert.match(shell,/wbPaletteNextPreview/);
});
