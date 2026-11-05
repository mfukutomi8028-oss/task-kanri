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

test('Palette opens independent NEXT without a fifth choice or separate preview link',()=>{
  const activeStyles=manifest.match(/dynamicStyles:\s*\[([^\]]+)\]/)?.[1]||'';
  const activeScripts=manifest.match(/dynamicScripts:\s*\[([^\]]+)\]/)?.[1]||'';
  assert.match(activeStyles,/palette-display-v358\.css/);
  assert.match(activeScripts,/palette-display-v358\.js/);
  assert.match(manifest,/palette-next-v369\.css/);
  assert.match(mode,/new Set\(\['classic', 'modern', 'palette', 'journal'\]\)/);
  assert.match(mode,/if \(next === 'palette'\) loadPaletteNext\(\)/);
  assert.doesNotMatch(mode,/wbPaletteNextPreviewV369/);
  assert.match(shell,/dataset\.wbDisplay === 'palette'/);
  assert.doesNotMatch(shell,/\['preview','Palette NEXT'\]/);
  assert.ok(Number(responsibilities.baselineRelease) >= 369);
});

test('Palette NEXT owns its independent DOM and uses only the canonical bridge',()=>{
  assert.match(shell,/id = 'paletteNextRoot'/);
  assert.match(shell,/document\.body\.appendChild\(root\)/);
  assert.match(shell,/WorkBoardPaletteBridge/);
  assert.match(shell,/bridge\.subscribe/);
  assert.doesNotMatch(shell,/\.sidebar\b|\.nav-item\b|#todayView|#todoView|\.today-grid|#scheduleDialog/);
  assert.doesNotMatch(shell,/runTransaction|firebase|document\.write/);
  assert.match(css,/#paletteNextRoot/);
  assert.match(css,/data-wb-palette-next-preview="true"/);
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
test('Palette NEXT has a safe canonical multi-action boundary',()=>{
  assert.match(mode,/loadPaletteNext\(\)/);
  assert.match(app,/case 'task.bulk.update':/);
  assert.match(app,/action: command\.type === 'task.bulk.complete'/);
  assert.match(shell,/data-pn-bulk-id/);
  assert.match(shell,/data-pn-bulk-all/);
  assert.match(shell,/data-pn-bulk-apply/);
  assert.match(shell,/bulkSelectedEntries\(\)/);
  assert.match(shell,/revision-or-relation-mismatch/);
  assert.doesNotMatch(shell,/\.click\(\).*#listView/);
});

test('Ver.371 task editor uses the same canonical revision-safe task writers',()=>{
  const source=app.slice(app.indexOf('// Palette NEXT shares the canonical business writers'),
    app.indexOf('window.WorkBoardPaletteBridge = Object.freeze'));
  assert.match(source,/savePaletteNextTaskV370/);
  assert.match(source,/commitTaskDraft\('task-form', existing, draft\)/);
  assert.match(source,/persistTask\(draft\)/);
  assert.match(source,/makeTaskChangeInfo\(existing, draft\)/);
  assert.match(source,/normalizeTask\(/);
  assert.match(source,/revision-or-relation-mismatch/);
  assert.doesNotMatch(source,/runTransaction|set\(ref|update\(ref|initializeApp/);
  assert.match(app,/case 'task.create':/);
  assert.match(app,/case 'task.update':/);
  assert.match(shell,/data-pn-form="task-editor"/);
  assert.match(shell,/state\.editor/);
});

test('Ver.371 memo editor shares the Classic memo validator and CAS repository',()=>{
  const memo=read('work-features-v167.js');
  assert.match(memo,/async function saveMemoValuesV370/);
  assert.match(memo,/const result = await saveMemoValuesV370\(/);
  assert.match(memo,/const ok = await commitMemo\(draft, expectedRevision\)/);
  assert.match(memo,/case 'memo.create':/);
  assert.match(memo,/case 'memo.update':/);
  assert.match(memo,/case 'memo.pin':/);
  assert.match(memo,/case 'memo.delete':/);
  assert.match(shell,/data-pn-form="memo-editor"/);
  assert.match(shell,/memoBridge\?\.dispatch\?\./);
  assert.match(css,/html\[data-wb-palette-next-preview="true"\] body \.app-shell:not\(#paletteNextRoot\)/);
});

test('Ver.377 schedule view uses canonical draft, copy generator and persistence without duplicate Firebase code',()=>{
  assert.match(app,/function buildScheduleDraftFromValuesV372\(/);
  assert.match(app,/return buildScheduleDraftFromValuesV372\(/);
  const start=app.indexOf('// Palette NEXT schedule adapter');
  const end=app.indexOf('// Palette NEXT shares the canonical business writers',start);
  assert.ok(start>0 && end>start);
  const adapter=app.slice(start,end);
  for(const fn of [
    'buildScheduleDraftFromValuesV372','buildScheduleCopyDates',
    'scheduleCopyConflicts','copyScheduleOccurrences','persistSchedule',
    'getScheduleConflicts','makeScheduleChangeInfo'
  ]) assert.match(adapter,new RegExp('\\b'+fn+'\\('));
  for(const action of ['schedule.create','schedule.update','schedule.preview-copy',
    'schedule.preview-batch','schedule.copy','schedule.batch','schedule.delete'])
    assert.match(app,new RegExp("case '"+action.replaceAll('.','\\.')+"':"));
  assert.doesNotMatch(adapter,/runTransaction\(|set\(ref\(|update\(ref\(|initializeApp\(/);
  assert.match(app,/isRecurringDeleteCandidate\('schedule',existing\)/);
  assert.match(app,/result = await deleteSchedule\(id,revision\)/);
  assert.match(shell,/data-pn-form="schedule-editor"/);
  assert.match(shell,/data-pn-form="schedule-copy"/);
  assert.match(shell,/data-pn-copy-preview/);
  assert.match(css,/#paletteNextRoot \.pn-calendar-toolbar/);
  // The schedule contract debuted in 377; subsequent UI releases must retain it.
  const publishedVersion = Number(manifest.match(/version: "(\d+)"/)?.[1] || 0);
  assert.ok(publishedVersion >= 377);
  assert.equal(Number(responsibilities.baselineRelease), publishedVersion);
});

test('Palette visual ownership is a single editorial token system across five routes',()=>{
  for(const signature of [
    'const iconPaths', 'function todayPage()', 'function todoPage()',
    'function taskPage()', 'function schedulePage()', 'function memoPage()',
    'pn-home-grid', 'pn-todo-overview', 'pn-task-sheet', 'pn-schedule-sheet',
    'pn-memo-number'
  ]) assert.ok(shell.includes(signature),'Missing Palette visual landmark: '+signature);
  for(const selector of [
    '#paletteNextRoot .pn-hero', '#paletteNextRoot .pn-pagehead',
    '#paletteNextRoot .pn-memotile', '#paletteNextRoot .pn-detail',
    '#paletteNextRoot .pn-schedule-sheet', '#paletteNextRoot .pn-bulkbar',
    '#paletteNextRoot .pn-mobile-nav'
  ]) assert.ok(css.includes(selector),'Missing self-contained Palette CSS: '+selector);
  assert.match(css,/--pn-paper:/);
  assert.match(css,/\.wb-pn\[data-theme="dark"\]/);
  assert.match(css,/@media\(max-width:780px\)/);
  assert.doesNotMatch(shell,/pn-preview-label/);
  assert.doesNotMatch(shell,/pn-preview-back/);
  assert.doesNotMatch(shell,/runTransaction|getDatabase|set\(ref\(/);
});
