import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const js = read('journal-display-v367.js');
const css = read('journal-display-v367.css');
const memoOwner = read('work-features-v167.js');
const selector = read('modern-display-v356.js');
const manifest = read('release-manifest.js');
const ownership = JSON.parse(read('patch-responsibilities.json'));

test('Journal remains an opt-in view with a single canonical data and write owner', () => {
  assert.match(selector, /new Set\(\['classic', 'modern', 'palette', 'journal'\]\)/);
  assert.match(js, /target\.click\(\)/);
  assert.match(js, /data-journal-create/);
  assert.match(js, /data-journal-sheet/);
  assert.match(js, /workBoardJournalThemeV367:/);
  assert.doesNotMatch(js, /\b(?:initializeApp|getDatabase|runTransaction|onValue|setDatabase|updateDatabase|removeDatabase)\s*\(/);
  assert.doesNotMatch(js, /iframe|contentWindow|cloneNode|document\.write/);
  assert.match(js, /composeJournalComposition/);
  assert.match(js, /restoreJournalComposition/);
});

test('JOURNAL composes only canonical Task and Memo DOM nodes and restores them on exit',()=>{
  const app=read('app.js');
  for(const name of ['composeTaskRegister','restoreTaskRegister','composeMemoSheets','restoreMemoSheets']){
    assert.match(js,new RegExp('function '+name+'\\('));
  }
  for(const name of ['composeTodoSheet','restoreTodoSheet','composeWeeklyPages','restoreWeeklyPages','composeScheduleStructureV393']){
    assert.doesNotMatch(js,new RegExp('function '+name+'\\('));
  }
  assert.match(app,/function journalTodoV425\(\)/);
  assert.match(app,/function journalScheduleV425\(\)/);
  assert.match(app,/function journalIndexV425\(tasks\)/);
  assert.match(js,/watchJournalViews/);
  assert.match(js,/new MutationObserver\(requestJournalCompose\)/);
  assert.match(js,/consoleEl\.append\(heading, toolbar, controls\)/);
});

test('Linen and Margin retain distinct paper textures across four workspaces',()=>{
  const normalized=css.replace(/\/\*[\s\S]*?\*\//g,'');
  assert.equal((normalized.match(/\{/g)||[]).length,(normalized.match(/\}/g)||[]).length);
  assert.match(css,/data-wb-journal-theme="linen"/);
  assert.match(css,/data-wb-journal-theme="margin"/);
  for(const cl of ['j425-todo-layout','j425-task-index-layout','j425-week-grid','j425-memo-spread']){
    assert.match(css,new RegExp('\\.'+cl));
  }
  assert.match(css,/prefers-reduced-motion:reduce/);
});

test('Journal paper controls and archived ToDo use one font and independent two-column history', () => {
  assert.match(css, /--j-text:"Yu Gothic UI"/);
  assert.match(css, /--j-serif:var\(--j-text\)/);
  assert.doesNotMatch(css, /Yu Mincho|Hiragino Mincho ProN|font-family:Georgia/);
  assert.match(css, /#todoView \.todo-item:not\(\.todo-history-item-v146\)/);
  assert.match(css, /#todoView \.todo-history-item-v146 \{[\s\S]*?grid-template-columns:minmax\(0,1fr\) max-content !important/);
  assert.match(css, /#todoView \.todo-history-title-row-v146 \.todo-text \{/);
  assert.match(css, /#todoView \.todo-history-date-v146 \{/);
  assert.match(css, /#todoView \.todo-history-item-v146 \{[\s\S]*?grid-template-columns:minmax\(0,1fr\) !important/);
  assert.match(css, /#scheduleView \.schedule-range-label \{[\s\S]*?border-radius:0 !important/);
  assert.match(css, /\.user-badge \.tiny-avatar,/);
  assert.match(css, /border-left:3px solid var\(--user-color/);
});

test('Memo archive and schedule use canonical stores and original memo colors',()=>{
  const app=read('app.js');
  assert.doesNotMatch(js,/id: 'week'/);
  assert.match(js,/function composeMemoIndex\(index, memo\)/);
  assert.match(js,/function sortMemoCards\(grid\)/);
  assert.match(js,/function updateMemoReaderV425\(spread\)/);
  assert.match(app,/function journalScheduleV425\(\)/);
  assert.match(app,/getFilteredSchedules\(range\)/);
  assert.match(memoOwner,/MEMO_PAPER_COLORS = Object\.freeze/);
  assert.match(memoOwner,/async function changeMemoPaperColor\(/);
  assert.match(memoOwner,/updatedAt: colorOnly \? Number\(existing\.updatedAt/);
  assert.doesNotMatch(js,/\b(?:initializeApp|runTransaction|setDatabase)\s*\(/);
});

test('JOURNAL ToDo and Schedule keep canonical creation, update and dialog actions',()=>{
  const app=read('app.js');
  assert.match(app,/function journalTodoV425\(\)/);
  assert.match(app,/function journalScheduleV425\(\)/);
  assert.match(app,/await createTodo\(/);
  assert.match(app,/await updateTodoDetails\(/);
  assert.match(app,/toggleTodo\(/);
  assert.match(app,/openScheduleDialog\(newScheduleSeedForDate\(/);
  assert.match(app,/function getFilteredSchedules\(range = getScheduleRange\(\)\)/);
  assert.match(css,/\.j425-todo-create/);
  assert.match(css,/\.j425-week-grid/);
  assert.doesNotMatch(js,/function composeTodoSheet\(/);
  assert.doesNotMatch(js,/function composeWeeklyPages\(/);
});

test('Journal entry folios reparent actual inputs and restore them without duplicate business writers', () => {
  const memo=read('work-features-v167.js');
  assert.match(js,/function journalEntryDecorateV385\(dialog, spec\)/);
  assert.match(js,/function journalMemoEditorV385\(dialog\)/);
  assert.match(js,/function restoreJournalEntriesV385\(\)/);
  assert.match(js,/function journalEntryMoveV385\(node, destination, record\)/);
  assert.match(js,/document\.createComment\('journal-input-original-position'\)/);
  assert.match(js,/marker\.replaceWith\(node\)/);
  assert.match(js,/button\.dataset\.journalEntryJump/);
  assert.match(js,/attributes:true,attributeFilter:\['open'\]/);
  assert.doesNotMatch(js,/\b(?:cloneNode|initializeApp|runTransaction|setDatabase)\s*\(/);
  assert.match(css,/JOURNAL INPUT FOLIOS v385/);
  assert.match(css,/\.j-entry-outline-v385/);
  assert.match(css,/\.j-entry-fields-v385/);
  assert.match(css,/\.j-entry-memo-pages-v385/);
  assert.match(css,/@media \(max-width:620px\)/);
  assert.match(memo,/id="workMemoPaperColorV385"/);
  assert.match(memo,/MEMO_PAPER_COLORS\.map/);
  assert.match(memo,/dialog\.querySelector\('#workMemoPaperColorV385'\)\.value/);
  assert.match(memo,/paperColor: dialog\.querySelector\('#workMemoPaperColorV385'\)\.value/);
  assert.match(memo,/const ok = await commitMemo\(draft, expectedRevision\)/);
});

test('Journal avoids Classic component carryover, duplicate summary and memo schedule leak', () => {
  assert.match(css,/body \.main > \.summary-grid/);
  assert.match(css,/body\.work-memo-mode-v167 \.main > :is\(#todayView/);
  assert.match(css,/body\.work-memo-mode-v167 \.main > #workMemoViewV167/);
  assert.match(css,/j-task-title-v372/);
  assert.match(css,/todo-item/);
  assert.match(css,/schedule-card/);
  assert.match(css,/work-memo-card-v167/);
  assert.match(css,/dashboard-kpi/);
  assert.match(css,/@media \(max-width:860px\)/);
  assert.match(css,/@media \(max-width:610px\)/);
  assert.doesNotMatch(css,/max-width:1560px/);
  assert.doesNotMatch(js,/今日の仕事を、手帳の1ページに/);
  assert.doesNotMatch(js,/この7日間の予定を見通します/);
  assert.match(js,/id="wbJournalPreferencesV370"/);
  assert.match(js,/function openPreferences\(\)/);
});

test('Journal v372 release assets stay registered once, without changing the other modes', () => {
  for (const filename of ['journal-display-v367.js', 'journal-display-v367.css']) {
    const groups=ownership.groups.filter(item=>item.assets.includes(filename));
    assert.equal(groups.length,1);
    assert.equal(groups[0].id,'journal-display');
    assert.match(manifest,new RegExp(filename.replaceAll('.','\\.')));
  }
  // This feature first shipped in 379. Future releases must keep its assets
  // and align their release inventory without pinning every following version.
  const currentRelease=Number(manifest.match(/version: "([0-9]+)"/)?.[1]||0);
  assert.ok(currentRelease>=379);
  assert.equal(Number(ownership.baselineRelease),currentRelease);
  assert.match(selector,/\['journal', 'Journal'/);
});

test('JOURNAL Ver.394 shares a top-level search while preserving canonical search owners', () => {
  const memo=read('work-features-v167.js');
  const todo=read('todo-tools-v145.js');
  assert.match(js,/id="wbJournalSearchV393"/);
  assert.match(js,/function syncGlobalSearchV393\(\)/);
  assert.match(js,/function restoreJournalSearchV393\(\)/);
  assert.match(js,/function journalSearchOwnersV393\(\)/);
  assert.match(js,/new Event\('input',\{bubbles:true\}\)/);
  assert.match(js,/journalSearchComposingV393/);
  assert.match(js,/clearJournalTodaySearchV393/);
  assert.match(memo,/WorkBoardMemoSearchBridgeV393 = Object\.freeze/);
  assert.match(todo,/WorkBoardTodoSearchBridgeV393 = Object\.freeze/);
  assert.match(css,/\.wb-journal-search-v393/);
  assert.match(css,/\.work-memo-search-v167,/);
  assert.match(css,/\.todo-search-box-v145 \{/);
  assert.doesNotMatch(js,/\.cloneNode\s*\(/);
});

test('JOURNAL preserves original settings, task editor and independent schedule',()=>{
  const app=read('app.js');
  assert.match(js,/function composeJournalSettingsV393\(\)/);
  assert.match(js,/function restoreJournalSettingsV393\(\)/);
  assert.match(js,/function journalRelocateV393\(node,destination,record\)/);
  assert.match(js,/function composeTaskStructureV393\(consoleEl\)/);
  assert.match(js,/function restoreTaskStructureV393\(\)/);
  assert.match(app,/journalScheduleStateV425/);
  assert.match(app,/openScheduleDialog\(/);
  assert.match(js,/function followJournalEntryOutlineV393\(/);
  assert.match(css,/\.j-settings-book-head-v393/);
  assert.match(css,/\.j-task-capture-v393/);
  assert.match(css,/data-wb-journal-theme="margin"/);
});

test('JOURNAL retains one canonical ToDo writer, memo color filters and concise settings',()=>{
  const app=read('app.js');
  assert.match(app,/function journalTodoV425\(\)/);
  assert.match(app,/await createTodo\(/);
  assert.match(app,/await updateTodoDetails\(/);
  assert.match(js,/journalMemoColorV396/);
  assert.match(js,/j-memo-color-hidden-v396/);
  assert.match(js,/getPaperColors\?\.\(\)/);
  assert.match(memoOwner,/getPaperColors: \(\) => MEMO_PAPER_COLORS\.map/);
  assert.match(js,/const legend = document\.createElement\('details'\)/);
  assert.match(css,/\.j-memo-color-filters-v396/);
  assert.doesNotMatch(js,/<summary>絞り込み・分類の管理<\/summary>/);
  assert.doesNotMatch(js,/cloneNode\s*\(/);
  assert.doesNotMatch(js,/\b(?:initializeApp|runTransaction|setDatabase)\s*\(/);
});

test('JOURNAL memo index and task folios remain read-only presentation owners',()=>{
  const app=read('app.js');
  // CSS owns the memo index position; never install scroll-time transforms.
  assert.doesNotMatch(js,/attachMemoIndexFollowV402|detachMemoIndexFollowV402|journalMemoFollowV402/);
  assert.match(css,/#workMemoViewV167 \.j425-memo-spread > \.j425-memo-index/);
  assert.match(css,/position:sticky!important/);
  assert.match(css,/\.j420-island-grid/);
  assert.match(css,/\.j425-index-record/);
  assert.match(css,/\.j425-task-preview/);
  assert.match(app,/function journalAtelierV420\(tasks\)/);
  assert.match(app,/function journalIndexV425\(tasks\)/);
  assert.match(app,/function journalChronicleV411\(tasks\)/);
  assert.doesNotMatch(js,/\b(?:initializeApp|setDatabase|runTransaction)\s*\(/);
});

test('Ver.412 JOURNAL removes settings clutter and uses native-looking page dividers',()=>{
  assert.match(js,/journalTabIconPathsV412/);
  assert.match(js,/tabIconV412\(entry.id\)/);
  assert.match(css,/\.j-tab-illustration-v412 svg/);
  assert.match(css,/\.j420-agenda-item/);
  assert.doesNotMatch(js,/<details class="j-settings-optional-filters-v396">/);
});

test('Ver.425 editorial screens and varied original SVG stationery are registered',()=>{
  const app=read('app.js');
  for(const name of ['journalTodayV420','journalAtelierV420','journalTodoV425','journalIndexV425','journalScheduleV425']){
    assert.match(app,new RegExp('function '+name+'\\('));
  }
  assert.match(js,/function updateMemoReaderV425\(spread\)/);
  assert.match(js,/memoFastenerV425\(card,previousFastener\)/);
  for(const cl of ['j425-todo-layout','j425-task-index-layout','j425-schedule-layout','j425-memo-gallery']){
    assert.match(css,new RegExp('\\.'+cl));
  }
  for(const prop of ['pen','plant','ruler','stamp','herbarium','date-stamp','fasteners']){
    const path='assets/journal-'+prop+'-v425.svg',asset=read(path);
    assert.match(asset,/^<svg[\s\S]*<\/svg>$/);
    assert.ok(asset.length>300,path);
  }
  assert.doesNotMatch(app,/class="j420-pen"/);
  assert.doesNotMatch(js,/function composeTodoSheet\(/);
  assert.doesNotMatch(js,/function composeWeeklyPages\(/);
  assert.match(css,/dialog\.j-entry-dialog-v385 \.dialog-head :is\(\[data-memo-close\]/);
});

test('Ver.430 paper archive facets and unique stationery are presentation-only',()=>{
  const app=read('app.js'),css=read('journal-display-v367.css'),js=read('journal-display-v367.js');
  assert.match(app,/function journalIndexPreviewV425\(t,index\)/);
  assert.match(app,/data-j430-facet/);
  assert.match(app,/data-j430-todo-fold/);
  assert.match(app,/journalTodoCollapsedV430/);
  assert.match(app,/journalScheduleCategoryV430/);
  assert.match(app,/data-j430-schedule-category/);
  assert.match(app,/j430-list-pen/);
  assert.match(app,/j442-todo-stationery/);
  assert.match(app,/j442-schedule-botanical/);
  assert.match(js,/journalMemoFastenerByIdV430/);
  assert.match(css,/\.j430-filter-option\[aria-pressed/);
  assert.match(css,/\.j425-list-props \.j430-list-pen/);
  assert.match(css,/\.j425-todo-props \.j442-todo-stationery/);
  assert.match(css,/\.j425-schedule-props \.j442-schedule-botanical/);
  assert.match(css,/\.j425-memo-gallery \.j442-memo-linen/);
  assert.doesNotMatch(app,/j430-todo-ruler|j430-schedule-datestamp/);
  assert.doesNotMatch(js,/j430-memo-seal|j430-memo-scrap/);
  assert.doesNotMatch(css,/\.j430-memo-seal|\.j425-paper-tabs/);
  for(const name of ['todo-stationery','schedule-botanical','memo-linen']){
    const filename='assets/journal-'+name+'-v442.svg';
    const svg=read(filename);
    assert.match(svg,/^<svg[\s\S]*<\/svg>$/);
    assert.doesNotMatch(svg,/(?:href|xlink:href)=["']https?:\/\//);
  }
  const props=read('assets/journal-fasteners-v425.svg');
  for(const fastener of ['binder','clip','pin','tape','washi','corner','grommet','bulldog'])assert.match(props,new RegExp('<symbol id="'+fastener+'"'));
  assert.ok(props.length>4500,'fastener vectors should have real metal/paper details');
  assert.doesNotMatch(app,/function renderClassicMemoDuplicateV430/);
});

test('JOURNAL V562 uses one dismissible desktop reader and retains the mobile inline note',()=>{
  const app=read('app.js'),css=read('journal-display-v367.css');
  assert.match(app,/let journalAtelierDeskNoteOpenV562=false/);
  assert.match(app,/data-j562-close-desk/);
  assert.match(app,/note.hidden=!inline&&!desktopOpen/);
  assert.match(app,/const closeDeskNoteV562=/);
  assert.match(css,/#j494AtelierNote\[hidden\]/);
  assert.match(css,/\.j562-desk-open/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\)!important/);
  assert.match(css,/@media\(min-width:761px\)/);
  assert.match(css,/\.j494-inline-note/);
  assert.doesNotMatch(app,/weekOverviewV463|data-j464-gap-date/);
});

test('JOURNAL memo fasteners keep a stable individual position without a generic tape overlay',()=>{
  const script=read('journal-display-v367.js');
  const styles=read('journal-display-v367.css');
  assert.match(script,/const hash=\[\.\.\.id\]\.reduce/);
  assert.match(script,/mark\.style\.setProperty\('--j-fastener-tilt'/);
  assert.match(script,/mark\.style\.setProperty\('--j-fastener-nudge'/);
  assert.match(styles,/\.j425-memo-fastener\.is-washi \{[^}]*--j-fastener-tilt/);
  assert.match(styles,/\.j425-memo-gallery \.work-memo-card-v167::before \{\s*content:none!important;display:none!important;/);
  assert.match(script,/card\.querySelector\(':scope > \.j425-memo-fastener'\)\?\.remove\(\)/);
  // Placement is local to temporary JOURNAL decorations, never shared memo data.
  assert.doesNotMatch(script,/Math\.random\(/);
});

test('Ver.440 JOURNAL Today uses a permanent local vector without duplicated CSS artwork',()=>{
  const app=read('app.js'),css=read('journal-display-v367.css');
  const release=read('release-manifest.js');
  const artwork=read('assets/journal-bookmark-seal-v440.svg');
  assert.match(app,/class="j440-today-bookmark" src="\.\/assets\/journal-bookmark-seal-v440\.svg"/);
  assert.match(css,/\.j425-today-stationery \.j440-today-bookmark/);
  assert.doesNotMatch(css,/\.j425-today-stationery::(?:before|after)/);
  assert.match(release,/"assets\/journal-bookmark-seal-v440\.svg"/);
  assert.match(artwork,/<svg[^>]+viewBox="0 0 300 116"/);
  assert.match(artwork,/<radialGradient id="wax"/);
  assert.doesNotMatch(artwork,/(?:href|xlink:href)=[\"']https?:\/\//);
});

test('JOURNAL editorial stationery keeps all eight active local illustrations compatible',()=>{
  const views=[
    ['journal-bookmark-seal-v440.svg','300 116'],
    ['journal-atelier-cards-v441.svg','260 116'],
    ['journal-pen-v425.svg','540 98'],
    ['journal-plant-v425.svg','360 255'],
    ['journal-todo-stationery-v442.svg','540 148'],
    ['journal-schedule-botanical-v442.svg','505 186'],
    ['journal-memo-linen-v442.svg','340 145']
  ];
  for(const [filename,size] of views){
    const svg=read('assets/'+filename);
    assert.match(svg,/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.ok(svg.includes('viewBox="0 0 '+size+'"'),filename+' preserves its intrinsic canvas');
    assert.match(svg,/<\/svg>\s*$/);
    assert.doesNotMatch(svg,/<(?:script|foreignObject|image)\b|(?:href|xlink:href)=["']https?:\/\//);
    assert.ok(svg.length>1200,filename+' contains real vector drawing');
  }
  const hardware=read('assets/journal-fasteners-v425.svg');
  for(const id of ['binder','clip','pin','tape','washi','corner','grommet','bulldog'])
    assert.match(hardware,new RegExp('<symbol id="'+id+'"'));
  assert.match(hardware,/<\/svg>\s*$/);
  assert.doesNotMatch(hardware,/<(?:script|foreignObject|image)\b|(?:href|xlink:href)=["']https?:\/\//);
});

test('Ver.443 JOURNAL condensed folios preserve meaningful details and allow touch calendar creation',()=>{
  const app=read('app.js'),styles=read('journal-display-v367.css');
  assert.match(app,/data-j443-add-schedule-date/);
  assert.match(app,/newScheduleSeedForDate\(button\.dataset\.j443AddScheduleDate\)/);
  assert.match(styles,/\.j425-week-column \.j443-add-on-date/);
  assert.match(styles,/@media\(pointer:coarse\)/);
  assert.match(app,/String\(t\.description\|\|''\)\.trim\(\)/);
  assert.match(app,/p\.total\?\x60<div class="j425-index-bar"/);
  assert.doesNotMatch(app,/詳細情報はまだありません。/);
  assert.doesNotMatch(app,/j430-todo-legend/);
  assert.doesNotMatch(app,/予定と仕事を、ひとつの時間軸で整える/);
  assert.match(styles,/\.j425-memo-masthead \.work-memo-head-v167 p \{display:none!important\}/);
});

test('JOURNAL mobile dock lists five workspaces and keeps settings',()=>{
  assert.match(js,/\['today', 'todos', 'tasks', 'schedule', 'memo'\]\.includes\(entry\.id\)/);
  assert.match(js,/more\.addEventListener\('click', openDrawer\)/);
  assert.match(css,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(css,/#workMemoViewV167 \.j425-memo-gallery \.work-memo-body-v167/);
});

test('Ver.445 JOURNAL fixes actual diary date, global query adapters and compact paper layout',()=>{
  const app=read('app.js'),journal=read('journal-display-v367.js'),style=read('journal-display-v367.css');
  assert.ok(app.includes("join('')||`<button type=\"button\" class=\"j434-chronicle-add\""));
  assert.doesNotMatch(app,/join\(''\)\|\|'<button type="button" class="j434-chronicle-add"/);
  assert.match(app,/dueDateInput\.dispatchEvent\(new Event\("change"/);
  assert.match(journal,/memoBridge\?\.setQuery\?\.\(value\)/);
  assert.match(journal,/todoBridge\?\.setQuery\?\.\(value\)/);
  assert.match(journal,/data-j425-todo-search/);
  assert.match(style,/\.j425-week-scroll \{/);
  assert.match(style,/scroll-snap-type:x proximity/);
  assert.match(style,/#todoView \.j425-todo-layout>\.j425-index-rail/);
});

test('Ver.447 JOURNAL collapses mobile task filters and omits empty ToDo trays',()=>{
  const app=read('app.js'),css=read('journal-display-v367.css');
  assert.match(app,/const populatedGroups=groups\.filter\(group=>group\.items\.length>0\)/);
  assert.match(app,/populatedGroups\.map\(g=>/);
  assert.match(app,/class="j447-todo-empty-state"/);
  assert.match(app,/let journalIndexFiltersExpandedV447=false/);
  assert.match(app,/data-j447-toggle-filters/);
  assert.match(app,/aria-controls="j447TaskFilterPanel"/);
  assert.match(css,/\.j447-task-filter-panel\.is-open/);
  assert.match(css,/@media\(min-width:761px\) and \(max-width:1190px\)/);
  assert.match(css,/\.j447-todo-empty-state/);
});

test('JOURNAL Ver.450 uses the canonical ToDo editor and a searchable memo index',()=>{
  const app=read('app.js');
  assert.match(app,/function journalTodoFocusV450\(id\)/);
  assert.match(app,/id="j450TodoNote"/);
  assert.match(app,/data-j450-todo-back/);
  assert.match(app,/await updateTodoDetails\(/);
  assert.match(js,/journalMemoIndexQueryV450/);
  assert.match(js,/journalMemoClosedGroupsV450/);
  assert.match(js,/dataset\.j450MemoFind/);
  assert.match(js,/document\.createElement\('details'\)/);
  assert.match(js,/dataset\.journalMemoId/);
  assert.match(css,/\.j450-todo-back/);
  assert.match(css,/\.j450-memo-index-find/);
  // Index-only filtering must provide a no-match explanation and a visible
  // reset without introducing another memo store or canonical card filter.
  assert.match(js,/dataset\.j558MemoIndexReset/);
  assert.match(js,/emptyMessage\.textContent/);
  assert.match(js,/count\.textContent = query \? matched/);
  assert.match(css,/\.j558-memo-index-empty\[hidden\]/);
  assert.doesNotMatch(js,/\b(?:initializeApp|runTransaction|setDatabase)\s*\(/);
});

test('JOURNAL compact schedule and memo reader handoff stay UI-only',()=>{
  const app=read('app.js'),journal=read('journal-display-v367.js');
  const styles=read('journal-display-v367.css');
  assert.match(app,/journalScheduleOptionsExpandedV451/);
  assert.match(app,/journalScheduleCompactMediaV451/);
  assert.match(app,/data-j451-schedule-options/);
  assert.match(app,/data-j425-mode/);
  assert.match(journal,/function selectMemoForReadingV451\(/);
  assert.match(journal,/j451-memo-back/);
  assert.match(styles,/JOURNAL V451/);
  assert.match(styles,/\.j425-week-column-body:empty::after/);
  assert.match(styles,/\.j451-schedule-options>summary/);
  assert.doesNotMatch(journal,/\b(?:initializeApp|runTransaction|setDatabase)\s*\(/);
});

test('JOURNAL V456 overlaps group one marker while preserving each canonical event',()=>{
  const app=read('app.js');
  const start=app.indexOf(' const renderJournalDayEventsV456=');
  const end=app.indexOf(' const dayColumn=(d,i)=>',start);
  assert.ok(start>0 && end>start,'JOURNAL overlap helper must exist in the schedule renderer');
  // Execute only this view-only rendering helper against simple fixtures.
  const helper=runInNewContext(app.slice(start,end)+'\nrenderJournalDayEventsV456;',{
    interval:52,
    renderEvent:(entry)=>'<button data-schedule-id="'+entry.id+'"></button>',
    escapeHtml:value=>String(value),
    formatScheduleTime:iso=>String(iso).slice(11,16),
    toISODate:date=>date.toISOString().slice(0,10)
  });
  const day='2026-11-06';
  const events=[
    {id:'later',startAt:day+'T15:00:00',endAt:day+'T16:00:00',title:'報告'},
    {id:'first',startAt:day+'T10:00:00',endAt:day+'T11:00:00',title:'会議'},
    {id:'second',startAt:day+'T10:30:00',endAt:day+'T11:30:00',title:'面談'}
  ];
  const markup=helper(events,day);
  assert.match(markup,/重複・近接 2件/);
  assert.match(markup,/data-j456-day-focus="2026-11-06"/);
  assert.equal((markup.match(/j456-overlap-cluster/g)||[]).length,1);
  for(const item of events){
    assert.equal((markup.match(new RegExp('data-schedule-id="'+item.id+'"','g'))||[]).length,1);
  }
  assert.match(app,/journalScheduleStateV425\.mode='day'/);
  assert.match(css,/\.j456-overlap-entries/);
  assert.match(css,/\.j425-week-grid\.is-single-day/);
  assert.match(js,/const visibleId=card\?\.dataset\.memoSortId\|\|''/);
  assert.match(js,/journalMemoFastenerByIdV430\.clear\(\)/);
});

test('JOURNAL V459 day review delegates edit/copy to the canonical dialogs',()=>{
  const app=read('app.js');
  assert.match(app,/let journalSchedulePreviewIdV459=''/);
  assert.match(app,/journalSchedulePreviewOwnerV459/);
  assert.match(app,/function journalScheduleV425\(\)/);
  assert.match(app,/const renderJournalDayRecordsV459=items=>/);
  assert.match(app,/mode==='day'\?renderJournalDayRecordsV459\(items\):renderJournalDayEventsV456\(items,iso\)/);
  assert.match(app,/data-j459-review/);
  assert.match(app,/id="j459SchedulePreview"/);
  assert.match(app,/data-j459-edit/);
  assert.match(app,/data-j459-copy/);
  assert.match(app,/data-j459-back/);
  assert.match(app,/data-j459-return-week/);
  assert.match(app,/journalPrepareNoteReturnV479\(record,'edit'\)/);
  assert.match(app,/journalPrepareNoteReturnV479\(record,'copy'\)/);
  assert.match(app,/openScheduleDialog\(record\)/);
  assert.match(app,/openScheduleCopyDialog\(record\)/);
  assert.match(app,/bindScheduleCardEvents\(\)/);
  assert.match(css,/JOURNAL V459/);
  assert.match(css,/\.j459-schedule-preview/);
  assert.match(css,/\.j459-day-review/);
  assert.match(css,/@media\(max-width:1190px\)/);
  assert.doesNotMatch(js,/\b(?:getDatabase|runTransaction|setDatabase)\s*\(/);
});

test('JOURNAL V460 day-note order and paging use a single readable canonical list',()=>{
  const app=read('app.js');
  const start=app.indexOf(' const orderJournalDayEventsV460=');
  const end=app.indexOf(' const renderJournalDayRecordsV459=',start);
  assert.ok(start>0&&end>start,'Chronological day-order helper must exist');
  const order=runInNewContext(app.slice(start,end)+'\norderJournalDayEventsV460;', {});
  const day='2026-11-06';
  const records=[
    {id:'last',startAt:day+'T16:00:00'},
    {id:'b',startAt:day+'T09:00:00'},
    {id:'a',startAt:day+'T09:00:00'}
  ];
  assert.deepEqual(Array.from(order(records),item=>item.id),['a','b','last']);
  assert.equal(records[0].id,'last','Canonical source order must not be mutated');
  assert.match(app,/selectedPositionV460===0\?'disabled':''/);
  assert.match(app,/selectedPositionV460===orderedDayV460\.length-1\?'disabled':''/);
  assert.match(app,/data-j460-preview-step="-1"/);
  assert.match(app,/data-j460-preview-step="1"/);
  assert.match(app,/const direction=Number\(button\.dataset\.j460PreviewStep\)/);
  assert.match(app,/const next=orderedDayV460\[current\+direction\]/);
  assert.match(css,/JOURNAL V460/);
  assert.match(css,/\.j460-preview-paging/);
  assert.match(css,/\.j459-day-record>\.j425-week-event/);
  assert.doesNotMatch(js,/\b(?:runTransaction|setDatabase|updateDatabase)\s*\(/);
});

test('JOURNAL V463 weekly availability merges overlaps and honors day boundaries',()=>{
  const app=read('app.js');
  const start=app.indexOf('function journalWeekAvailabilityV463(day, records) {');
  const end=app.indexOf('\nfunction journalScheduleV425(){',start);
  assert.ok(start>0&&end>start,'Weekly summary must be an isolated presentation helper');
  const summarize=runInNewContext(app.slice(start,end)+'\njournalWeekAvailabilityV463;');
  const day=new Date(2026,10,6);
  const meeting=(id,beginH,beginM,endH,endM)=>
    ({id,startAt:new Date(2026,10,6,beginH,beginM).toISOString(),
      endAt:new Date(2026,10,6,endH,endM).toISOString()});
  const events=[
    meeting('a',9,0,11,0),meeting('b',10,0,12,0),meeting('c',13,0,15,0)
  ];
  const overlap=summarize(day,events);
  assert.equal(overlap.busyMinutes,300,'09-12 plus 13-15 is five occupied hours');
  assert.equal(overlap.maxConcurrent,2);
  assert.equal(new Date(overlap.largestGap.start).getHours(),15);
  assert.equal(new Date(overlap.largestGap.end).getHours(),20);
  assert.equal(events.length,3,'Summarization must not modify canonical records');

  const adjacent=summarize(day,[meeting('a',9,0,10,0),meeting('b',10,0,11,0)]);
  assert.equal(adjacent.maxConcurrent,1,'Meetings touching at an endpoint are not overlapping');
  assert.equal(adjacent.busyMinutes,120);
  const overnight=summarize(day,[{
    startAt:new Date(2026,10,5,23).toISOString(),
    endAt:new Date(2026,10,6,10).toISOString()
  }]);
  assert.equal(overnight.busyMinutes,120,'Overnight meetings occupy 08-10 on this day');
  assert.equal(new Date(overnight.largestGap.start).getHours(),10);
  const empty=summarize(day,[]);
  assert.equal(empty.busyMinutes,0);
  assert.equal((empty.largestGap.end-empty.largestGap.start)/60000,720);
  const allDay=summarize(day,[{
    startAt:new Date(2026,10,6,0).toISOString(),
    endAt:new Date(2026,10,7,0).toISOString()
  }]);
  assert.equal(allDay.busyMinutes,720);
  assert.equal(allDay.largestGap,null);
  assert.doesNotMatch(app,/j463-week-overview|weekOverviewV463/);
  assert.doesNotMatch(app,/weekDurationControlsV562|data-j466-duration/);
  assert.match(app,/data-j425-day="\$\{iso\}"/);
  assert.match(app,/getFilteredSchedules\(\{start:new Date\(0\),end:addDays\(weekStart,7\)\}\)/);
  assert.doesNotMatch(css,/\.j562-week-controls|\.j466-duration-row/);
  assert.doesNotMatch(css,/\.j463-week-days/);
});

test('JOURNAL V464 gap draft respects length, precision and existing form ownership',()=>{
  const app=read('app.js');
  const start=app.indexOf('function journalGapScheduleSeedV464(day, gap, minimumGapMinutes=45) {');
  const end=app.indexOf('\nfunction journalScheduleV425(){',start);
  assert.ok(start>0&&end>start,'Draft seed helper stays independent from renderer');
  let calls=0;
  const iso=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),
    String(date.getDate()).padStart(2,'0')].join('-');
  const seed=runInNewContext(app.slice(start,end)+'\njournalGapScheduleSeedV464;',{
    toISODate:iso,newScheduleSeedForDate:date=>{
      calls++;
      return {title:'',assignee:'user',category:'その他',sourceDate:date};
    }
  });
  const day=new Date(2026,10,6);
  const t=(hour,minute,second=0)=>new Date(2026,10,6,hour,minute,second).getTime();
  const hourGap={start:t(10,15),end:t(12,30)};
  const hour=seed(day,hourGap);
  assert.equal(new Date(hour.startAt).getHours(),10);
  assert.equal(new Date(hour.startAt).getMinutes(),15);
  assert.equal(new Date(hour.endAt).getHours(),11);
  assert.equal(new Date(hour.endAt).getMinutes(),15);
  assert.equal(hour.sourceDate,iso(day));
  assert.equal(hour.id,undefined,'Prefilling must not turn a draft into an edit');
  assert.equal(hour.assignee,'user');
  const short=seed(day,{start:t(8,45),end:t(9,30)});
  assert.equal((new Date(short.endAt)-new Date(short.startAt))/60000,45);
  assert.equal(seed(day,{start:t(8,45),end:t(9,29)}),null,'Less than 45 minutes is not suggested');
  assert.equal(seed(day,null),null);
  const rounded=seed(day,{start:t(8,45,30),end:t(10,0)});
  assert.equal(new Date(rounded.startAt).getMinutes(),46);
  assert.equal(new Date(rounded.startAt).getSeconds(),0);
  assert.equal(calls,3,'Invalid gaps must never open or prepare a draft');
  assert.equal(hourGap.start,t(10,15),'Summary result is not mutated');

  assert.match(app,/data-j473-free-date/);
  assert.match(app,/openScheduleDialog\(suggestion\)/);
  assert.match(app,/journalEligibleGapWindowsV470\(/);
  assert.match(app,/getFilteredSchedules\(\{start:new Date\(0\),end:addDays\(weekStart,7\)\}\)/);
  assert.match(css,/JOURNAL V473/);
  assert.match(css,/\.j473-grid-gap/);
  assert.match(css,/\.j473-mobile-gaps/);
});

test('JOURNAL V466 duration and post-save focus stay within canonical schedule paths',()=>{
  const app=read('app.js');
  const start=app.indexOf('function journalGapScheduleSeedV464(day, gap, minimumGapMinutes=45) {');
  const end=app.indexOf('\nfunction journalScheduleV425(){',start);
  assert.ok(start>0 && end>start,'Existing V464 seed and V466 adapter must be adjacent');
  const iso=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),
    String(date.getDate()).padStart(2,'0')].join('-');
  const day=new Date(2026,10,6);
  const t=(h,m)=>new Date(2026,10,6,h,m).getTime();
  const seed=runInNewContext(app.slice(start,end)+'\njournalGapScheduleSeedV466;',{
    toISODate:iso,newScheduleSeedForDate:date=>({
      title:'',assignee:'current-user',category:'通常',seedDate:date
    })
  });
  const halfHour={start:t(9,0),end:t(9,30)};
  const fortyFive={start:t(9,0),end:t(9,45)};
  const fullHour={start:t(9,0),end:t(10,0)};
  const half=seed(day,halfHour,30);
  assert.equal((new Date(half.endAt)-new Date(half.startAt))/60000,30);
  assert.equal(half.seedDate,iso(day));
  assert.equal(half.id,undefined);
  assert.equal(seed(day,halfHour,60),null);
  assert.equal(seed(day,fortyFive,60),null);
  assert.equal((new Date(seed(day,fortyFive,30).endAt)-t(9,0))/60000,30);
  assert.equal((new Date(seed(day,fullHour,60).endAt)-t(9,0))/60000,60);
  assert.equal(seed(day,fullHour,15),null);
  assert.equal(seed(day,{start:t(9,0),end:t(9,29)},30),null);
  const edge={start:t(9,0)+30000,end:t(9,30)};
  assert.equal(seed(day,edge,30),null,'Second-level rounding must not cross a boundary');
  assert.equal(seed(day,fullHour,30).assignee,'current-user');

  assert.match(app,/const journalGapDurationV466=30/);
  assert.doesNotMatch(app,/data-j466-duration/);
  assert.match(app,/JOURNAL_SCHEDULE_DURATIONS_V565 = \[30, 60, 90, 120\]/);
  assert.match(read('index.html'),/data-j565-schedule-minutes="120"/);
  assert.match(app,/journalGapScheduleSeedV466\(/);
  assert.match(app,/data-j473-free-date/);
  assert.match(app,/dataset\.journalGapFocus='1'/);
  assert.match(app,/delete elements\.scheduleForm\.dataset\.journalGapFocus/);
  assert.match(app,/const followJournalGapV466 = !editingId/);
  assert.match(app,/if \(!result\.ok\) return showWriteFailure\(result, "予定を保存できませんでした。入力内容はそのままです。"\)/);
  assert.match(app,/journalSchedulePreviewIdV459=schedule\.id/);
  assert.match(css,/\.j565-schedule-duration/);
  assert.match(css,/\.j425-schedule-layout>\.j425-schedule-index/);
});

test('JOURNAL V469 chosen starts respect boundaries and existing form ownership',()=>{
  const app=read('app.js');
  const start=app.indexOf('function journalGapScheduleSeedV464(day, gap, minimumGapMinutes=45) {');
  const end=app.indexOf('\nfunction journalScheduleV425(){',start);
  assert.ok(start>0&&end>start);
  const iso=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  const day=new Date(2026,10,6);
  const t=(h,m,s=0)=>new Date(2026,10,6,h,m,s).getTime();
  const {starts,seed}=runInNewContext(app.slice(start,end)+
    '\n({starts:journalGapStartOptionsV469,seed:journalGapScheduleSeedV469})',{
      toISODate:iso,newScheduleSeedForDate:date=>({assignee:'member',seedDate:date})
    });
  const gap={start:t(10,0),end:t(12,0)};
  assert.deepEqual(Array.from(starts(gap,60)),[t(10,0),t(10,30),t(11,0)]);
  assert.equal(new Date(seed(day,gap,60,t(10,30)).startAt).getTime(),t(10,30));
  assert.equal(new Date(seed(day,gap,60,t(10,30)).endAt).getTime(),t(11,30));
  for(const invalid of [t(11,30),t(9,30),t(10,15),NaN])
    assert.equal(seed(day,gap,60,invalid),null);
  assert.equal(seed(day,{start:t(10,0),end:t(10,30)},60,t(10,0)),null);
  assert.deepEqual(Array.from(starts({start:t(10,15,30),end:t(11,0)},30)),[t(10,16),t(10,30)]);
  assert.deepEqual(Array.from(starts({start:t(10,15,30),end:t(10,45)},30)),[]);
  assert.equal(seed(day,gap,30,t(11,30)).assignee,'member');
  assert.match(app,/data-j476-mobile-start/);
  assert.match(app,/journalGapScheduleSeedV469\(date,gap,journalGapDurationV466,chosen\)/);
  assert.match(css,/JOURNAL V476/);
  assert.match(css,/\.j476-precision-fields/);
});

test('lazy JOURNAL activation reuses canonical navigation after mode already switched',()=>{
  assert.match(js,/function replayInitialJournalNavigation\(\)/);
  assert.match(js,/window\.WORK_BOARD_CORE_READY/);
  assert.match(js,/workboard:core-ready/);
  assert.match(js,/!main\.querySelector\('#todayView \.j420-today'\)/);
  assert.match(js,/!main\.querySelector\('#boardView \.j420-atelier'\)/);
});

test('JOURNAL V470 lists each valid free window without changing the longest summary',()=>{
  const app=read('app.js');
  const start=app.indexOf('function journalWeekAvailabilityV463(day, records) {');
  const end=app.indexOf('\nfunction journalScheduleV425(){',start);
  assert.ok(start>0 && end>start);
  const iso=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),
    String(date.getDate()).padStart(2,'0')].join('-');
  const day=new Date(2026,10,6);
  const t=(h,m)=>new Date(2026,10,6,h,m).getTime();
  const h=runInNewContext(app.slice(start,end)+
    '\n({summary:journalWeekAvailabilityV463,eligible:journalEligibleGapWindowsV470,seed:journalGapScheduleSeedV469})',{
      toISODate:iso,newScheduleSeedForDate:date=>({seedDate:date,assignee:'user'})
    });
  const meeting=(begin,end)=>({startAt:new Date(begin).toISOString(),endAt:new Date(end).toISOString()});
  const summary=h.summary(day,[
    meeting(t(9,0),t(10,0)),meeting(t(10,0),t(10,30)),
    meeting(t(12,0),t(13,0)),meeting(t(14,0),t(18,0))
  ]);
  assert.deepEqual(Array.from(summary.gaps,g=>[g.start,g.end]),[
    [t(8,0),t(9,0)],[t(10,30),t(12,0)],[t(13,0),t(14,0)],[t(18,0),t(20,0)]
  ]);
  assert.equal(summary.busyMinutes,390);
  assert.equal(summary.maxConcurrent,1);
  assert.equal(summary.largestGap.start,t(18,0));
  const windows=Array.from(h.eligible(summary,60));
  assert.equal(windows.length,4);
  const middle=windows.find(g=>g.start===t(10,30));
  assert.equal(new Date(h.seed(day,middle,60,t(11,0)).endAt).getTime(),t(12,0));
  assert.equal(h.seed(day,middle,60,t(11,30)),null);
  const short=h.summary(day,[meeting(t(8,0),t(8,30)),meeting(t(8,59),t(20,0))]);
  assert.equal(h.eligible(short,60).length,0);
  assert.equal(h.eligible(short,30).length,0);
  const half=h.summary(day,[meeting(t(8,30),t(20,0))]);
  assert.equal(h.eligible(half,60).length,0);
  assert.equal(h.eligible(half,30).length,1);
  assert.equal(h.summary(day,[meeting(t(8,0),t(20,0))]).gaps.length,0);
  assert.match(app,/data-j476-mobile-gap=/);
  assert.match(app,/data-j473-free-start=/);
  assert.match(app,/journalGapWindowByDateV470\.clear\(\)/);
  assert.match(css,/JOURNAL V473/);
  assert.match(css,/\.j473-mobile-gap-options/);
});

test('JOURNAL V473 snaps a grid tap only to an eligible start within the selected gap',()=>{
  const app=read('app.js');
  const start=app.indexOf('function journalWeekAvailabilityV463(day, records) {');
  const end=app.indexOf('\nfunction journalScheduleV425(){',start);
  assert.ok(start>0&&end>start);
  const iso=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),
    String(date.getDate()).padStart(2,'0')].join('-');
  const t=(h,m)=>new Date(2026,10,6,h,m).getTime();
  const h=runInNewContext(app.slice(start,end)+
    '\n({summary:journalWeekAvailabilityV463,eligible:journalEligibleGapWindowsV470,choose:journalGridStartFromPointV473,seed:journalGapScheduleSeedV469})',{
      toISODate:iso,newScheduleSeedForDate:date=>({seedDate:date,assignee:'user'})
    });
  const gap={start:t(10,0),end:t(12,0)};
  assert.equal(h.choose(gap,60,0),t(10,0));
  assert.equal(h.choose(gap,60,.25),t(10,30));
  assert.equal(h.choose(gap,60,.9),t(11,0),'Late click clamps to latest 60-minute start');
  assert.equal(h.choose(gap,30,.75),t(11,30));
  assert.equal(h.choose(gap,60,NaN),t(10,0),'Keyboard uses first valid start');
  assert.equal(h.choose({start:t(10,0),end:t(10,29)},30,.2),null);
  const day=new Date(2026,10,6);
  const seed=h.seed(day,gap,60,h.choose(gap,60,.25));
  assert.equal(new Date(seed.startAt).getTime(),t(10,30));
  assert.equal(new Date(seed.endAt).getTime(),t(11,30));
  assert.match(app,/const renderJournalWeekGapsV473=/);
  assert.match(app,/data-j473-free-date/);
  assert.match(app,/openJournalGapDraftV473\(iso,start,chosen,true\)/);
  assert.match(app,/journalWeekAvailabilityV463\(date,current\)/);
  assert.match(app,/\[data-j456-day-focus\],\[data-j473-free-date\]/);
  assert.match(css,/JOURNAL V473/);
  assert.match(css,/\.j473-grid-gap-layer/);
  assert.match(css,/\.j473-mobile-gaps/);
  assert.doesNotMatch(js,/\b(?:runTransaction|setDatabase|updateDatabase)\s*\(/);
});

test('JOURNAL V475 shows explicit selected interval and preserves the mobile disclosure',()=>{
  const app=read('app.js');
  assert.match(app,/const journalExplicitGapDaysV475=new Set\(\)/);
  assert.match(app,/const journalMobileGapOpenDaysV475=new Set\(\)/);
  assert.match(app,/journalExplicitGapDaysV475\.clear\(\)/);
  assert.match(app,/journalMobileGapOpenDaysV475\.clear\(\)/);
  assert.match(app,/journalGapStartOptionsV469\(gap,journalGapDurationV466\)\.includes\(rememberedStart\)/);
  assert.match(app,/class="j475-grid-selection"/);
  assert.match(app,/class="j476-mobile-choice"/);
  assert.match(app,/data-j475-mobile-date/);
  assert.match(app,/journalExplicitGapDaysV475\.add\(dateIso\)/);
  assert.match(app,/journalExplicitGapDaysV475\.add\(iso\)/);
  assert.match(app,/gridLeft=root\.querySelector\('\.j425-week-scroll'\)/);
  assert.match(css,/JOURNAL V475/);
  assert.match(css,/\.j475-grid-selection/);
  assert.match(css,/\[data-j475-selected="true"\]/);
});

test('JOURNAL V476 clear-choice is local only and phone controls use the existing draft path',()=>{
  const app=read('app.js');
  const start=app.indexOf('function journalClearGapChoiceV476(iso) {');
  const end=app.indexOf('\nfunction journalScheduleV425(){',start);
  assert.ok(start>0&&end>start);
  const iso='2026-11-06';
  const clearSource=app.slice(start,end);
  let removed=0;
  const {clear,windowMap,startMap,explicit}=runInNewContext(
    'const journalExplicitGapDaysV475=new Set(["'+iso+'"]);'+
    'const journalGapWindowByDateV470=new Map([["'+iso+'",1]]);'+
    'const journalGapStartByDateV469=new Map([["'+iso+'",2]]);'+
    clearSource+'\n({clear:journalClearGapChoiceV476,windowMap:journalGapWindowByDateV470,'+
    'startMap:journalGapStartByDateV469,explicit:journalExplicitGapDaysV475})');
  clear(iso);clear(iso);
  assert.equal(windowMap.has(iso),false);
  assert.equal(startMap.has(iso),false);
  assert.equal(explicit.has(iso),false);
  assert.doesNotMatch(clearSource,/(?:set|update|remove|runTransaction|openScheduleDialog)\s*\(/);
  assert.match(app,/data-j476-clear-date/);
  assert.match(app,/data-j476-mobile-gap/);
  assert.match(app,/data-j476-mobile-start/);
  assert.match(app,/data-j476-mobile-create/);
  assert.match(app,/journalMobilePrecisionOpenDaysV476\.clear\(\)/);
  assert.match(app,/if\(!details\.isConnected\)return/);
  assert.match(app,/openJournalGapDraftV473\(iso,gap\.start,chosen,true\)/);
  assert.match(css,/JOURNAL V476/);
  assert.match(css,/\.j476-mobile-precision/);
  assert.match(css,/\.j476-mobile-choice/);
});

test('JOURNAL V478 uses one movable day note with quick canonical actions',()=>{
  const app=read('app.js');
  assert.match(app,/function journalPositionDayPreviewV478\(\)/);
  assert.match(app,/const journalScheduleInlineMediaV478=window\.matchMedia\('\(max-width:1190px\)'\)/);
  assert.match(app,/journalScheduleInlineMediaV478\.addEventListener\('change',journalPositionDayPreviewV478\)/);
  assert.match(app,/if\(inline\)row\.after\(preview\)/);
  assert.match(app,/if\(holes\)holes\.after\(preview\)/);
  assert.match(app,/journalPositionDayPreviewV478\(\);/);
  assert.match(app,/preview\.classList\.toggle\('j478-inline-preview',inline\)/);
  assert.match(app,/aria-expanded="\$\{journalSchedulePreviewIdV459===item\.id\}"/);
  assert.match(app,/data-j459-back/);
  assert.match(app,/journalSchedulePreviewIdV459='';\s*journalScheduleV425\(\)/);
  assert.match(app,/journalPrepareNoteReturnV479\(record,'edit'\)/);
  assert.match(app,/journalPrepareNoteReturnV479\(record,'copy'\)/);
  assert.match(app,/openScheduleDialog\(record\)/);
  assert.match(app,/openScheduleCopyDialog\(record\)/);
  assert.match(css,/JOURNAL V478/);
  assert.match(css,/\.j478-inline-preview/);
  assert.match(css,/\.j478-preview-close/);
});

test('JOURNAL V479 keeps a single note return across edit, copy and cancellation',()=>{
  const app=read('app.js');
  assert.match(app,/let journalNoteDialogReturnV479=null/);
  assert.match(app,/function journalPrepareNoteReturnV479\(record,action\)/);
  assert.match(app,/function journalRestoreNoteV479\(\)/);
  assert.match(app,/context.room!==ROOM_ID \|\| context.user!==getCurrentUser\(\)/);
  assert.match(app,/journalScheduleStateV425.anchor=scheduleLocalDate\(record\)/);
  assert.match(app,/journalSchedulePreviewIdV459=record.id/);
  assert.match(app,/journalNoteDialogReturnV479=null;\s*journalExpandedMemoIdV481='';\s*journalGapWindowByDateV470.clear\(\)/);
  assert.match(app,/elements.scheduleDialog.addEventListener\('close'/);
  assert.match(app,/journalNoteDialogReturnV479\?\.action!=='edit'\|\|\$\("scheduleCopyDialog"\)\?\.open/);
  assert.match(app,/const returnToJournalNote = !fromNewForm/);
  assert.match(app,/journalNoteDialogReturnV479.action==='copy'/);
  assert.match(app,/if\(returnToJournalNote\)\{\s*journalRestoreNoteV479\(\);/);
  assert.match(app,/if \(reopenSource\) \{\s*if \(fromNewForm\)/);
  const fn=app.slice(app.indexOf('function journalRestoreNoteV479(){'),
    app.indexOf('\n// JOURNAL-only visible schedule summary'));
  assert.doesNotMatch(fn,/(?:persistSchedule|copyScheduleOccurrences|runTransaction|setDatabase|updateDatabase)\s*\(/);
});

test('JOURNAL V481 memo preview is escaped, compact and expands long text without losing it',()=>{
  const app=read('app.js');
  const start=app.indexOf('function journalPreviewMemoMarkupV481(memo,expanded=false){');
  const end=app.indexOf('\n// Only carry the visible day note',start);
  assert.ok(start>0&&end>start);
  const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const markup=runInNewContext(app.slice(start,end)+'\njournalPreviewMemoMarkupV481;', {escapeHtml:escape});
  assert.equal(markup(''), '');
  assert.equal(markup('   '), '');
  const short=markup('要確認 <script>');
  assert.match(short,/j481-memo-label/);
  assert.match(short,/要確認 &lt;script&gt;/);
  assert.doesNotMatch(short,/<details/);
  assert.doesNotMatch(short,/<script>/);
  assert.doesNotMatch(markup('あ'.repeat(240)),/<details/);
  const long='あ'.repeat(260)+'<img src=x onerror=alert(1)>';
  const brief=markup(long),expanded=markup(long,true);
  assert.match(brief,/<details class="j481-memo-details" >/);
  assert.match(expanded,/<details class="j481-memo-details" open>/);
  assert.match(brief,/j481-memo-excerpt/);
  assert.match(brief,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(brief,/<img/);
  assert.equal((brief.match(/j459-preview-memo/g)||[]).length,1);
  assert.match(app,/journalExpandedMemoIdV481=event.currentTarget.open\?journalSchedulePreviewIdV459:''/);
  assert.match(app,/j459-preview-meta j481-preview-meta/);
  assert.match(app,/class="j481-category"/);
  assert.match(css,/JOURNAL V481/);
  assert.match(css,/\.j481-memo-details/);
  assert.match(css,/\.j481-date-row/);
});

test('JOURNAL V484 paging keeps same-direction focus and the next note heading visible',()=>{
  const app=read('app.js');
  const start=app.indexOf(" root.querySelectorAll('[data-j460-preview-step]').forEach(");
  const end=app.indexOf("\n root.querySelector('[data-j459-edit]')",start);
  assert.ok(start>0&&end>start);
  const paging=app.slice(start,end);
  assert.match(paging,/if\(!\[-1,1\]\.includes\(direction\)\|\|current<0\)return/);
  assert.match(paging,/journalSchedulePreviewIdV459=next.id/);
  assert.match(paging,/const compact=journalScheduleInlineMediaV478.matches/);
  assert.match(paging,/const continueButton=compact\?preview\.querySelector/);
  assert.match(paging,/"\]:not\(\[disabled\]\)/);
  assert.match(paging,/preview\.scrollIntoView\(\{behavior:'auto',block:'start',inline:'nearest'\}\)/);
  assert.match(paging,/\(continueButton\|\|preview\)\.focus\(\{preventScroll:true\}\)/);
  assert.doesNotMatch(paging,/(?:persistSchedule|runTransaction|setDatabase|updateDatabase)\s*\(/);
  assert.match(css,/JOURNAL V484/);
  assert.match(css,/@media\(max-width:390px\)/);
  assert.match(css,/\.j481-preview-meta\s*\{/);
  assert.match(css,/-webkit-line-clamp:3/);
});

test('JOURNAL V488 pager precedes titles and long memo can close from its footer',()=>{
  const app=read('app.js');
  const start=app.indexOf(' const previewHtml=selectedSchedule?');
  const end=app.indexOf(' elements.scheduleView.innerHTML=',start);
  assert.ok(start>0&&end>start);
  const preview=app.slice(start,end);
  assert.ok(preview.indexOf('${pagingV460}')>=0);
  assert.ok(preview.indexOf('${pagingV460}')<preview.indexOf('<h3>'));
  assert.match(app,/data-j488-memo-collapse/);
  assert.match(app,/details\.open=false/);
  assert.match(app,/summary\?\.focus\(\{preventScroll:true\}\)/);
  assert.match(app,/target\.scrollIntoView\(\{behavior:'auto',block:'start'\}\)/);
  assert.match(css,/JOURNAL V488/);
  assert.match(css,/\.j488-memo-collapse/);
  assert.match(css,/\.j488-memo-close-label/);
});

test('JOURNAL V491 inline task/ToDo readers and compact memo remain presentation-only',()=>{
  const app=read('app.js');
  const memo=read('journal-display-v367.js');
  const begin=app.indexOf("function journalPositionSelectedReaderV491(kind)");
  const end=app.indexOf("journalInlineDetailMediaV491.addEventListener('change'",begin);
  assert.ok(begin>0&&end>begin);
  const move=app.slice(begin,end);
  assert.match(move,/row\.after\(reader\)/);
  assert.match(move,/layout\.append\(reader\)/);
  assert.match(move,/reader\.classList\.toggle\('j491-inline-detail',inline\)/);
  assert.match(move,/reader\.contains\(document\.activeElement\)/);
  assert.doesNotMatch(move,/(?:persist|transaction|setDatabase|updateDatabase|firebase)\s*\(/i);
  assert.match(app,/journalTodoInlineSelectedV491=journalTodoSelectedV425/);
  assert.match(app,/journalTaskInlineSelectedV491=filters\.selected/);
  assert.match(app,/journalPositionSelectedReaderV491\('todo'\)/);
  assert.match(app,/journalPositionSelectedReaderV491\('task'\)/);
  assert.match(app,/data-j491-task-return/);
  assert.match(memo,/j491-memo-footer-back/);
  assert.match(memo,/footerBack\.addEventListener\('click',\(\)=>back\.click\(\)\)/);
  assert.match(css,/JOURNAL V491/);
  assert.match(css,/\.j425-task-preview:not\(\.j491-inline-detail\)/);
  assert.match(css,/\.j425-todo-reading:not\(\.j491-inline-detail\)/);
  assert.match(css,/\.work-memo-card-v167\.j425-memo-selected/);
});

test('JOURNAL V494 task desk note moves one node and timeline detail restores focus',()=>{
  const app=read('app.js');
  const start=app.indexOf('function journalPositionAtelierNoteV494(');
  const end=app.indexOf("journalAtelierInlineMediaV494.addEventListener('change'",start);
  assert.ok(start>0&&end>start);
  const move=app.slice(start,end);
  assert.match(move,/card\.after\(note\)/);
  assert.match(move,/desktop\.append\(note\)/);
  assert.match(move,/root\.querySelector\('\.j420-atelier'\)/);
  assert.match(move,/note\.classList\.toggle\('j494-inline-note',inline\)/);
  assert.doesNotMatch(move,/(?:runTransaction|persist|firebase|database\.ref)\s*\(/i);
  assert.match(app,/data-j494-atelier-back/);
  assert.match(app,/data-j494-open-task/);
  assert.match(app,/journalOpenTimelineDetailV494/);
  assert.match(app,/new MutationObserver\(journalRestoreTaskOriginV536\)/);
  assert.match(app,/target\?\.focus\(\{preventScroll:true\}\)/);
  // The folio owns Escape. The existing detail observer and one dialog-close
  // hook now share the same resolver rather than duplicating return handlers.
  assert.doesNotMatch(app,/event\.key!=='Escape'\|\|!journalTaskV411\(\)/);
  assert.match(js,/if\(event\.key==='Escape'\)\{event\.preventDefault\(\);event\.stopPropagation\(\);close\.click\(\);return\}/);
  assert.match(css,/JOURNAL V494/);
  assert.match(css,/\.j420-project-note:not\(\.j494-inline-note\)/);
  assert.match(css,/\.jv-time-controls>button/);
  assert.match(css,/\.jv-day-item>\.j494-day-actions/);
});

test('JOURNAL V495 mobile detail reveals secondary actions without cloning canonical handlers',()=>{
  const folio=js.slice(js.indexOf('function installJournalFolioV411('));
  assert.match(folio,/const compact=window\.matchMedia\('\(max-width:760px\)'\)/);
  assert.match(folio,/details\.append\(secondary\)/);
  assert.match(folio,/if\(original\)actions\.append\(original\)/);
  assert.match(folio,/moreExpanded=details\.open/);
  assert.match(folio,/new MutationObserver\(enhance\)\.observe\(detailBody,\{childList:true\}\)/);
  assert.match(folio,/detailBody\.querySelector\('\[data-action="edit"\]'\)\?\.click\(\)/);
  assert.match(folio,/panel\.scrollTo\(\{top:0,behavior:'auto'\}\)/);
  assert.match(folio,/heading\.focus\(\{preventScroll:true\}\)/);
  assert.doesNotMatch(folio,/(?:runTransaction|onValue|persistTask|updateDatabase)\s*\(/);
  assert.match(css,/JOURNAL V495/);
  assert.match(css,/\.j495-detail-more:not\(\[open\]\)>\.sub-actions/);
  assert.match(css,/\.j495-detail-footer-edit/);
  assert.match(css,/overflow-wrap:anywhere!important/);
  assert.match(css,/@media\(max-width:350px\)/);
});

test('JOURNAL V497 mobile detail retains a useful sticky title and fresh open focus',()=>{
  const folio=js.slice(js.indexOf('function installJournalFolioV411('));
  assert.match(folio,/const originalHeadLabel=headLabel\?\.textContent\|\|'タスク詳細'/);
  assert.match(folio,/const title=active\(\)&&compact\.matches/);
  assert.match(folio,/headLabel\.textContent=title\|\|originalHeadLabel/);
  assert.match(folio,/headLabel\.removeAttribute\('title'\)/);
  assert.match(folio,/panel\.scrollTop=0/);
  assert.match(folio,/panel\.contains\(document\.activeElement\)\?null:document\.activeElement/);
  assert.match(folio,/if\(active\(\)&&!panel\.contains\(document\.activeElement\)\)close\.focus/);
  assert.match(css,/JOURNAL V497/);
  assert.match(css,/text-overflow:ellipsis;white-space:nowrap/);
  assert.match(css,/detail-title:focus/);
  assert.doesNotMatch(folio,/(?:runTransaction|onValue|persistTask|updateDatabase)\s*\(/);
});

test('JOURNAL V500 recent activity opens the requested task across desk filters',()=>{
  const app=read('app.js');
  const start=app.indexOf("root.querySelectorAll('[data-j420-log-task]')");
  const end=app.indexOf("root.querySelector('[data-j420-new-task]')",start);
  assert.ok(start>0&&end>start);
  const jump=app.slice(start,end);
  assert.match(jump,/const task=tasks\.find\(t=>t\.id===btn\.dataset\.j420LogTask\)/);
  assert.match(jump,/if\(!viewFns\[journalAtelierViewV420\]\?\.\(task\)\)journalAtelierViewV420='all'/);
  assert.match(jump,/if\(journalAtelierCategoryV420&&task\.category!==journalAtelierCategoryV420\)journalAtelierCategoryV420=''/);
  assert.match(jump,/journalAtelierSelectedV420=task\.id/);
  assert.match(jump,/journalFocusAtelierNoteV500\(elements\.boardView,true\)/);
  assert.equal((app.match(/journalFocusAtelierNoteV500\(/g)||[]).length,3);
  assert.match(css,/JOURNAL V500/);
  assert.match(css,/\.j420-project-note\.j494-inline-note \.j420-note-checks li/);
});

test('JOURNAL V502 phone index is view-only and uses one canonical set of filters',()=>{
  const app=read('app.js');
  assert.match(app,/let journalIndexExpandedV502=false/);
  assert.match(app,/data-j502-index-open="/);
  assert.match(app,/aria-controls="j502IndexContents"/);
  assert.match(app,/journalIndexExpandedV502=!journalIndexExpandedV502/);
  assert.match(app,/data-j502-toggle-index/);
  assert.match(css,/JOURNAL V502/);
  assert.match(css,/\.j420-atelier-index\[data-j502-index-open="false"\] \.j502-index-contents/);
  assert.match(css,/\.j420-note-actions button/);
  assert.doesNotMatch(app.slice(app.indexOf("root.querySelector('[data-j502-toggle-index]')"),app.indexOf("root.querySelector('[data-j420-new-task]')")),/(?:runTransaction|persistTask|updateDatabase)\s*\(/);
});

test('JOURNAL V504 chronicle keeps keyboard context and lets populated days create tasks',()=>{
  const app=read('app.js');
  const start=app.indexOf('function journalNavigateChronicleV504(');
  const end=app.indexOf('function journalDayItemV411(',start);
  assert.ok(start>0&&end>start,'find the existing JOURNAL-only chronicle implementation');
  const chronicle=app.slice(start,end);
  assert.match(chronicle,/const dateRows=dates\.map\(d=>/);
  assert.match(chronicle,/items\.length\?\x60<button type="button" class="j504-day-add"/);
  assert.match(chronicle,/data-jv-add-date="\$\{date\}"/);
  assert.match(chronicle,/journalNavigateChronicleV504\('\[data-timeline-prev\]'/);
  assert.match(chronicle,/journalNavigateChronicleV504\('\[data-timeline-range\]'/);
  assert.match(chronicle,/\.jv-section-head'\)\s*\?\.scrollIntoView/);
  assert.match(chronicle,/\.focus\(\{preventScroll:true\}\)/);
  assert.match(app,/journalTimelineReturnDateV504=source\?\.closest\('\[data-jv-date\]'\)/);
  assert.match(app,/const sourceDay=originalDay\?\.closest\('\.jv-chronicle-day'\)/);
  assert.match(app,/const fallback=sourceDay\?\.querySelector\('\.jv-date'\)/);
  assert.match(app,/sourceDay\?\.querySelector\('h4'\)/);
  assert.match(css,/JOURNAL V504/);
  assert.match(css,/\.jv-day-item>strong/);
  assert.match(css,/\.j504-day-add/);
  assert.doesNotMatch(chronicle,/(?:runTransaction|persistTask|updateDatabase|onValue|initializeApp)\s*\(/);
});

test('JOURNAL V505 date jump and edit return reuse the canonical timeline without extra writers',()=>{
  const app=read('app.js');
  const start=app.indexOf('function journalRememberTimelineSourceV505(');
  const end=app.indexOf('// JOURNAL V500:',start);
  const returnFlow=app.slice(start,end);
  assert.ok(start>0&&end>start,'the reading position is owned by the existing JOURNAL timeline');
  assert.match(returnFlow,/journalTimelineReturnTopV505=source\?source\.getBoundingClientRect\(\)\.top:null/);
  assert.match(returnFlow,/function journalOpenTimelineEditorV505\(id\)/);
  assert.match(returnFlow,/scrolling\.scrollTop\+=original\.getBoundingClientRect\(\)\.top-sourceTop/);
  assert.match(returnFlow,/target\?\.focus\(\{preventScroll:true\}\)/);
  const chronicle=app.slice(app.indexOf('function journalChronicleV411('),app.indexOf('function journalDayItemV411('));
  assert.match(chronicle,/const dayJumpOptions=dates\.map\(d=>/);
  assert.match(chronicle,/data-j505-date-jump aria-label="移動先の日付"/);
  assert.match(chronicle,/journalOpenTimelineEditorV505\(row\.dataset\.taskId\)/);
  assert.match(chronicle,/dateHeading\.scrollIntoView\(\{behavior:'auto',block:'start',inline:'nearest'\}\)/);
  assert.match(chronicle,/dateHeading\.focus\(\{preventScroll:true\}\)/);
  assert.match(css,/JOURNAL V505/);
  assert.match(css,/\.jv-time-controls>\.j505-date-jump/);
  assert.doesNotMatch(returnFlow+chronicle,/(?:runTransaction|persistTask|commitTaskDraft|initializeApp|onValue|updateDatabase)\s*\(/);
});

test('JOURNAL V507 chronology move resumes at actual destination and offers an origin return',()=>{
  const app=read('app.js');
  const start=app.indexOf('function journalOpenTimelineMoveV507(');
  const end=app.indexOf('function journalChronicleV411(',start);
  const presentation=app.slice(start,end);
  assert.ok(start>0&&end>start);
  assert.match(presentation,/journalTimelineMoveSourceV507=row\?/);
  assert.match(presentation,/function journalReturnTimelinePeriodV507\(source\)/);
  assert.match(presentation,/state\.timelineRange=source\.fromRange/);
  assert.match(presentation,/state\.timelineStart=source\.fromStart/);
  assert.match(presentation,/function journalRevealTimelineMoveV507\(source,id,dueDate,dueChanged\)/);
  assert.match(presentation,/if\(dueDate<first\|\|dueDate>last\)setTimelineStart\(dueDate\)/);
  assert.match(presentation,/notice\.append\(label,back,dismiss\)/);
  assert.match(presentation,/if\(row\)row\.after\(notice\)/);
  assert.doesNotMatch(presentation,/(?:runTransaction|commitTaskDraft|persistTask|updateDatabase|onValue)\s*\(/);
  const chronicle=app.slice(end,app.indexOf('function journalDayItemV411(',end));
  assert.doesNotMatch(chronicle,/data-j507-up/);
  assert.match(chronicle,/journalOpenTimelineMoveV507\(b\.dataset\.moveToTimeline\)/);
  // V523 checks the picker exists before focusing it, so direct focus is safe.
  assert.match(chronicle,/selector\.focus\(\{preventScroll:true\}\)/);
  const save=app.slice(app.indexOf('async function confirmTimelineMove('),app.indexOf('function openTaskDialog(',app.indexOf('async function confirmTimelineMove(')));
  assert.match(save,/if\s*\(!result\.ok\) return showWriteFailure/);
  assert.match(save,/if\(journalSource\)journalTimelineMoveCommittedV507=true/);
  assert.match(save,/if\(journalSource\)journalRevealTimelineMoveV507\(journalSource,task\.id,dueDate,dueChanged\)/);
  assert.match(css,/JOURNAL V507/);
  assert.match(css,/\.j507-move-result/);
  assert.doesNotMatch(css,/\.j507-week-up/);
});

test('JOURNAL V509 task page return positions have a single view-only switch and no writer',()=>{
  const app=read('app.js');
  const start=app.indexOf('const journalTaskPagePositionsV509=');
  const end=app.indexOf('// JOURNAL V494:',start);
  assert.ok(start>0&&end>start);
  const navigation=app.slice(start,end);
  assert.match(navigation,/board:null,list:null,timeline:null/);
  assert.match(navigation,/journalTaskPagePositionsV509\[previous\]=Math\.max\(0,-oldView\.getBoundingClientRect\(\)\.top\)/);
  assert.match(navigation,/const offset=journalTaskPagePositionsV509\[next\]\?\?0/);
  assert.match(navigation,/journalTaskPageSwitchTokenV509/);
  assert.match(navigation,/window\.scrollTo\(\{top:Math\.min\(maxTop,Math\.max\(0,pageTop\+offset\)\),behavior:'auto'\}\)/);
  assert.match(navigation,/active\?\.focus\(\{preventScroll:true\}\)/);
  assert.doesNotMatch(navigation,/(?:runTransaction|commitTaskDraft|persistTask|initializeApp|onValue|updateDatabase)\s*\(/);
  assert.match(app,/journalSwitchTaskPageV509\(btn\.dataset\.j420Layout\)/);
  assert.match(app,/journalSwitchTaskPageV509\(b\.dataset\.j425TaskLayout\)/);
  const diary=app.slice(app.indexOf('function journalChronicleV411('),app.indexOf('function journalDayItemV411('));
  assert.match(diary,/j509-chronicle-switch/);
  assert.match(diary,/data-j509-layout="board"/);
  assert.match(diary,/data-j509-layout="list"/);
  assert.match(diary,/journalSwitchTaskPageV509\(button\.dataset\.j509Layout\)/);
  assert.match(css,/JOURNAL V509/);
  assert.match(css,/\.j509-chronicle-switch button/);
});

test('JOURNAL V511 diary keeps one sticky navigator and one shared list-return owner',()=>{
  const app=read('app.js');
  const preview=app.slice(app.indexOf('function journalIndexPreviewV425('),app.indexOf('function journalIndexV425('));
  assert.match(preview,/class="j491-task-return j511-task-return-end" data-j491-task-return/);
  const index=app.slice(app.indexOf('function journalIndexV425('),app.indexOf('function journalNavigateChronicleV504('));
  assert.match(index,/root\.querySelectorAll\('\[data-j491-task-return\]'\)\.forEach/);
  assert.match(index,/const target=row\|\|root\.querySelector\('\[data-j425-query\]'\)/);
  assert.match(index,/target\.focus\(\{preventScroll:true\}\)/);
  const diary=app.slice(app.indexOf('function journalChronicleV411('),app.indexOf('function journalDayItemV411('));
  assert.match(diary,/class="j511-chronicle-travel"/);
  assert.match(diary,/data-j511-date-picker/);
  assert.match(diary,/root\.querySelector\('\[data-j511-date-picker\]'\)\?\.addEventListener/);
  assert.match(diary,/journalSwitchTaskPageV509\(button\.dataset\.j509Layout\)/);
  assert.match(css,/JOURNAL V511/);
  assert.match(css,/\.j511-chronicle-travel \{/);
  assert.match(css,/position:sticky;top:6px;z-index:9/);
  assert.match(css,/\.j511-task-return-end/);
  assert.doesNotMatch(index+diary,/(?:runTransaction|commitTaskDraft|persistTask|updateDatabase|onValue)\s*\(/);
});

test('JOURNAL V513 keeps the selected list row at its original reading position',()=>{
  const app=read('app.js');
  const index=app.slice(app.indexOf('function journalIndexV425('),app.indexOf('function journalNavigateChronicleV504('));
  assert.match(app,/let journalIndexReturnAnchorV513=null/);
  assert.match(index,/journalIndexReturnAnchorV513=journalInlineDetailMediaV491\.matches/);
  assert.match(index,/top:row\.getBoundingClientRect\(\)\.top,width:window\.innerWidth/);
  assert.match(index,/const anchor=journalIndexReturnAnchorV513/);
  assert.match(index,/journalIndexReturnAnchorV513=null/);
  assert.match(index,/row\.getBoundingClientRect\(\)\.top-anchor\.top/);
  assert.match(index,/requestAnimationFrame\(\(\)=>\{/);
  assert.match(index,/target\.focus\(\{preventScroll:true\}\)/);
  const diary=app.slice(app.indexOf('function journalChronicleV411('),app.indexOf('function journalDayItemV411('));
  assert.doesNotMatch(diary,/data-j507-up|j507-week-up|j507-week-end/);
  assert.match(diary,/data-j511-date-picker/);
  assert.doesNotMatch(css,/\.j507-week-up/);
  assert.match(css,/JOURNAL V513/);
  assert.doesNotMatch(index+diary,/(?:runTransaction|commitTaskDraft|persistTask|onValue|updateDatabase)\s*\(/);
});

test('JOURNAL V515 list rerenders restore the exact filter, sorting or search control',()=>{
  const app=read('app.js');
  const start=app.indexOf('let journalIndexRefreshTokenV515=0;');
  const end=app.indexOf('function journalIndexV425(tasks){',start);
  assert.ok(start>0&&end>start,'reusable index focus helper is present');
  const handler=app.slice(start,end);
  assert.match(handler,/journalIndexRefreshTokenV515/);
  assert.match(handler,/journalIndexV425\(tasks\)/);
  assert.match(handler,/target\.focus\(\{preventScroll:true\}\)/);
  assert.match(handler,/document\.scrollingElement\.scrollTop\+=target\.getBoundingClientRect\(\)\.top-previousTop/);
  assert.match(handler,/token!==journalIndexRefreshTokenV515/);
  assert.doesNotMatch(handler,/(?:runTransaction|persistTask|commitTaskDraft|updateDatabase|onValue)\s*\(/);
  const index=app.slice(end,app.indexOf('function journalNavigateChronicleV504(',end));
  // Six existing index controls plus V518's contextual empty-result reset.
  assert.equal((index.match(/journalRefreshIndexV515\(tasks,/g)||[]).length,7);
  assert.match(index,/journalRefreshIndexV515\(tasks,input,/);
  assert.match(index,/el\.setSelectionRange\(cursor,cursor\)/);
  assert.match(index,/node\.dataset\.j430Facet===key&&node\.dataset\.j430Value===value/);
  assert.match(index,/filters\.due=due/);
  assert.match(index,/filters\.sort=e\.target\.value/);
  assert.match(css,/JOURNAL V515/);
  assert.match(css,/\.j425-workbench-toolbar label:first-child/);
  assert.match(css,/\.j425-workbench-toolbar \.j425-index-counter/);
  // V430 desktop columns must not overrule V515's one-column mobile index.
  assert.match(css,/#listView \.j425-task-index-layout\s*\{\s*grid-template-columns:minmax\(0,1fr\)!important;/);
});

test('JOURNAL V516 desk restores the originating case and index control without new writers',()=>{
  const app=read('app.js');
  const restore=app.slice(app.indexOf("root.querySelector('[data-j494-atelier-back]')?.addEventListener"),app.indexOf("const input=root.querySelector('[data-j420-search]')"));
  assert.match(restore,/journalAtelierReturnAnchorV516/);
  assert.match(restore,/source\.getBoundingClientRect\(\)\.top-anchor\.top/);
  assert.match(restore,/source\?\.focus\(\{preventScroll:true\}\)/);
  const refresh=app.slice(app.indexOf('function journalRefreshAtelierControlV516('),app.indexOf('function journalAtelierV420(tasks){'));
  assert.match(refresh,/journalAtelierRefreshTokenV516/);
  assert.match(refresh,/journalAtelierV420\(tasks\)/);
  assert.match(refresh,/target\.focus\(\{preventScroll:true\}\)/);
  assert.doesNotMatch(refresh,/(?:runTransaction|persistTask|firebase|database\.ref)\s*\(/i);
  assert.match(css,/JOURNAL V516/);
  assert.match(css,/#boardView \.j420-atelier-desk \{\s*min-height:0/);
  assert.match(css,/#timelineView \.jv-time-controls>button/);
});


test('JOURNAL V518 empty index recovery reuses the canonical filter refresh and diary add',()=>{
  const app=read('app.js');
  const index=app.slice(app.indexOf('function journalIndexV425(tasks){'),app.indexOf('function journalNavigateChronicleV504('));
  assert.match(index,/const emptyResultsV518=/);
  assert.match(index,/ordered\.map\(record\)\.join\(''\)\|\|emptyResultsV518/);
  assert.match(index,/data-j518-empty-reset/);
  assert.match(index,/resetIndexFiltersV518\(\)/);
  assert.match(index,/journalRefreshIndexV515\(tasks,event\.currentTarget,\(\)=>root\.querySelector\('\[data-j425-query\]'\)\)/);
  assert.doesNotMatch(index,/(?:runTransaction|firebase\.database|setDoc|updateDoc)\s*\(/);
  const diary=app.slice(app.indexOf('function journalChronicleV411(tasks){'));
  assert.match(diary,/j434-chronicle-add/);
  assert.match(diary,/data-jv-add-date/);
  assert.match(css,/JOURNAL V518/);
  assert.match(css,/\.jv-chronicle-day\.is-empty/);
  assert.match(css,/\.j518-index-empty button/);
});


test('JOURNAL V519 reuses one detail close observer to return desk and index actions',()=>{
  const app=read('app.js');
  const start=app.indexOf('let journalTaskNoteReturnV519=null;');
  const end=app.indexOf('// JOURNAL V507:',start);
  assert.ok(start>0&&end>start);
  const helper=app.slice(start,end);
  assert.match(helper,/journalOpenTaskNoteV519/);
  assert.match(helper,/journalRestoreTaskNoteV519/);
  assert.match(helper,/origin\.width===window\.innerWidth/);
  assert.match(helper,/rowTop=row\?\.getBoundingClientRect\(\)\.top\?\?null/);
  assert.match(helper,/const sourceTop=target===button\?origin\.top:/);
  assert.match(helper,/target===row\|\|\(!row&&target===nearRow\)\?origin\.rowTop:null/);
  assert.match(helper,/scrolling\.scrollTop\+=target\.getBoundingClientRect\(\)\.top-sourceTop/);
  assert.match(helper,/target\.focus\(\{preventScroll:true\}\)/);
  assert.doesNotMatch(helper,/(?:runTransaction|persistTask|firebase|database\.ref)\s*\(/i);
  const resolver=app.slice(app.indexOf('function journalRestoreTaskOriginV536(){'),
    app.indexOf('// Escape belongs to JOURNAL',start));
  assert.match(resolver,/if\(journalTaskNoteReturnV519\)\{journalRestoreTaskNoteV519\(\);return;\}/);
  assert.match(resolver,/journalTimelineReturnTaskV494/);
  assert.match(resolver,/new MutationObserver\(journalRestoreTaskOriginV536\)/);
  assert.match(resolver,/elements\.taskDialog\?\.addEventListener\('close'/);
  assert.equal((resolver.match(/new MutationObserver\(/g)||[]).length,1);
  assert.match(app,/journalOpenTaskNoteV519\(journalAtelierSelectedV420,'board','detail'/);
  assert.match(app,/journalOpenTaskNoteV519\(filters.selected,'list','detail'/);
  assert.match(app,/journalOpenTaskNoteV519\(row\.dataset\.j425Row,'list','row'/);
});


test('JOURNAL V520 desk exposes empty filter recovery without creating new writers',()=>{
  const app=read('app.js');
  const start=app.indexOf('function journalAtelierV420(tasks){');
  const end=app.indexOf('// State is view-only, scoped to JOURNAL;',start);
  assert.ok(start>0&&end>start);
  const desk=app.slice(start,end);
  assert.match(desk,/const compactGroups=/);
  assert.match(desk,/viewTasks\.length>0/);
  assert.match(desk,/j520-empty-island/);
  assert.match(desk,/activeFilterCountV520/);
  assert.match(desk,/data-j520-empty-reset/);
  assert.match(desk,/data-j520-empty-new/);
  assert.match(desk,/const resetAtelierV520=/);
  assert.match(desk,/journalAtelierRefreshTokenV516/);
  assert.match(desk,/el\.getClientRects\(\)\.length>0/);
  assert.match(desk,/data-j420-search/);
  assert.doesNotMatch(desk,/(?:runTransaction|commitTaskDraft|persistTask|firebase\.database)\s*\(/i);
  assert.match(css,/JOURNAL V520/);
  assert.match(css,/\.j520-empty-island/);
  assert.match(css,/\.j520-index-filter-count/);
  assert.match(css,/\.j520-atelier-empty button/);
});


test('JOURNAL V522 quick-add returns to the same chronicle date without a second writer',()=>{
  const app=read('app.js');
  const start=app.indexOf('let journalChronicleCreateAnchorV522=null;');
  const end=app.indexOf('function journalChronicleV411(tasks){',start);
  assert.ok(start>0&&end>start);
  const helper=app.slice(start,end);
  assert.match(helper,/function journalOpenChronicleCreateV522\(source,date,status\)/);
  assert.match(helper,/openTaskDialogFromTimeline\(date,status\)/);
  assert.match(helper,/function journalRestoreChronicleCreateV522\(\)/);
  assert.match(helper,/elements\.taskDialog\?\.addEventListener\('close',journalRestoreChronicleCreateV522\)/);
  assert.match(helper,/state\.selectedId!==anchor\.selectedBefore/);
  assert.match(helper,/day\.getBoundingClientRect\(\)\.top-anchor\.top/);
  assert.match(helper,/target\.focus\(\{preventScroll:true\}\)/);
  assert.doesNotMatch(helper,/(?:runTransaction|commitTaskDraft|persistTask|firebase|onValue)\s*\(/);
  const chronicle=app.slice(end,app.indexOf('function journalDayItemV411(',end));
  assert.match(chronicle,/journalOpenChronicleCreateV522\(b,b\.dataset\.jvAddDate,getDefaultOpenStatus\(\)\)/);
  assert.match(chronicle,/journalOpenChronicleCreateV522\(row,row\.dataset\.jvDate,getDefaultOpenStatus\(\)\)/);
  assert.equal((helper.match(/addEventListener\('close',journalRestoreChronicleCreateV522\)/g)||[]).length,1);
});


test('JOURNAL V523 retains one selected day and opens the existing picker from the bookmark',()=>{
  const app=read('app.js');
  const start=app.indexOf("let journalChronicleSelectedDateV523='';");
  const end=app.indexOf('function journalDayItemV411(',start);
  assert.ok(start>0&&end>start,'diary date jump uses an existing JOURNAL view');
  const diary=app.slice(start,end);
  assert.match(diary,/dates\.some\(d=>toISODate\(d\)===journalChronicleSelectedDateV523\)/);
  assert.match(diary,/date===journalChronicleSelectedDateV523\?'selected':''/);
  assert.match(diary,/data-j505-date-jump aria-label="移動先の日付" id="j523ChronicleDateSelect"/);
  assert.match(diary,/data-j511-date-picker aria-controls="j523ChronicleDateSelect"/);
  assert.match(diary,/selector\.focus\(\{preventScroll:true\}\)/);
  assert.match(diary,/selector\.showPicker\(\)/);
  assert.match(diary,/selector\.scrollIntoView\(\{behavior:'auto',block:'start',inline:'nearest'\}\)/);
  assert.match(diary,/journalChronicleSelectedDateV523=date/);
  assert.match(diary,/badge\.textContent=date\?date\.slice\(5\)/);
  assert.doesNotMatch(diary,/(?:runTransaction|persistTask|commitTaskDraft|firebase\.database|onValue)\s*\(/i);
  assert.match(css,/JOURNAL V523/);
  assert.match(css,/\.j511-date-picker \.j523-selected-date/);
});


test('JOURNAL V525 diary view switch restores semantic date with pixel fallback',()=>{
  const app=read('app.js');
  const start=app.indexOf('let journalChronicleReadAnchorV525=null;');
  const end=app.indexOf('// JOURNAL V494:',start);
  assert.ok(start>0&&end>start);
  const nav=app.slice(start,end);
  assert.match(nav,/function journalCaptureChronicleReadAnchorV525\(view\)/);
  assert.match(nav,/j511-chronicle-travel/);
  assert.match(nav,/visibleHeight>=Math\.min\(32,Math\.max\(12,rect\.height\*\.2\)\)/);
  assert.match(nav,/date,top:day\.getBoundingClientRect\(\)\.top/);
  assert.match(nav,/if\(previous==='timeline'\)journalCaptureChronicleReadAnchorV525\(oldView\)/);
  assert.match(nav,/anchor\.start===toISODate\(getTimelineStartDate\(\)\)&&anchor\.range===state\.timelineRange/);
  assert.match(nav,/window\.scrollY\+day\.getBoundingClientRect\(\)\.top-anchor\.top/);
  assert.match(nav,/if\(!restoredDayV525\)/);
  assert.match(nav,/active\?\.focus\(\{preventScroll:true\}\)/);
  assert.doesNotMatch(nav,/(?:persistTask|commitTaskDraft|runTransaction|firebase|onValue)\s*\(/i);
});


test('JOURNAL V528 restores reading and focus only for remote subscription paints',()=>{
  const app=read('app.js');
  const start=app.indexOf('let journalSubscribedRenderV528 = false;');
  const render=app.slice(start,app.indexOf('function render() {',start));
  assert.match(render,/journalSubscribedRenderV528 = true/);
  assert.match(render,/try \{ render\(\); \}/);
  assert.match(render,/finally \{ journalSubscribedRenderV528 = false; \}/);
  const first=app.indexOf('let journalChronicleSyncRestoreTokenV528=0;');
  const last=app.indexOf('function journalChronicleV411(tasks){',first);
  assert.ok(first>0&&last>first);
  const helper=app.slice(first,last);
  assert.match(helper,/journalCaptureChronicleSyncAnchorV528/);
  assert.match(helper,/journalRestoreChronicleSyncAnchorV528/);
  assert.match(helper,/if\(!journalSubscribedRenderV528\|\|!journalTaskV411\(\)\|\|root\.hidden/);
  assert.match(helper,/j511-chronicle-travel/);
  assert.match(helper,/focusAttr/);
  assert.match(helper,/root\.querySelectorAll\('\['\+anchor\.focusAttr\+'\]'\)/);
  assert.match(helper,/journalChronicleSyncRestoreTokenV528/);
  assert.match(helper,/scrolling\.scrollTop\+=day\.getBoundingClientRect\(\)\.top-anchor\.top/);
  assert.match(helper,/focus\.focus\(\{preventScroll:true\}\)/);
  assert.doesNotMatch(helper,/(?:persistTask|runTransaction|updateDoc|firebase\.database|setDoc)\s*\(/);
  const diary=app.slice(last,app.indexOf('function journalDayItemV411(',last));
  assert.match(diary,/const syncAnchorV528=journalCaptureChronicleSyncAnchorV528\(elements\.timelineView\)/);
  assert.match(diary,/journalRestoreChronicleSyncAnchorV528\(syncAnchorV528,root\)/);
});


test('JOURNAL V530 desk and index keep snapshot focus without duplicate data owners',()=>{
  const app=read('app.js');
  const start=app.indexOf('let journalTaskSyncTokenV530 = 0;');
  const end=app.indexOf('function journalAtelierV420(tasks){',start);
  assert.ok(start>0&&end>start);
  const helper=app.slice(start,end);
  assert.match(helper,/function journalCaptureTaskPageSyncAnchorV530\(layout\)/);
  assert.match(helper,/function journalRestoreTaskPageSyncAnchorV530\(snapshot\)/);
  assert.match(helper,/journalSubscribedRenderV528/);
  assert.match(helper,/journalTaskSyncAttrsV530/);
  assert.match(helper,/data-j420-task-id/);
  assert.match(helper,/data-j425-row/);
  assert.match(helper,/document\.activeElement/);
  assert.match(helper,/getBoundingClientRect\(\)\.top-snapshot\.top/);
  assert.match(helper,/target\.focus\(\{preventScroll:true\}\)/);
  assert.match(helper,/target\.setSelectionRange\(snapshot\.search\.start,snapshot\.search\.end/);
  assert.doesNotMatch(helper,/(?:runTransaction|persistTask|commitTaskDraft|firebase\.database|onValue)\s*\(/i);
  const board=app.slice(end,app.indexOf('// State is view-only, scoped to JOURNAL;',end));
  const list=app.slice(app.indexOf('function journalIndexV425(tasks){'),
    app.indexOf('// JOURNAL V504: paging rerenders the toolbar.'));
  for(const [view,kind] of [[board,'board'],[list,'list']]){
    assert.match(view,new RegExp("journalCaptureTaskPageSyncAnchorV530\\('"+kind+"'\\)"));
    assert.match(view,/journalRestoreTaskPageSyncAnchorV530\(syncAnchorV530\)/);
    assert.match(view,/journalFinishSearchCompositionV530\(input\)/);
  }
  const schedule=app.slice(app.indexOf('let journalSubscribedRenderV528 = false;'),
    app.indexOf('function render() {'));
  assert.match(schedule,/journalSearchSyncDeferredV530 = true/);
  assert.match(schedule,/journalSearchComposingV530\?\.isConnected/);
  assert.match(schedule,/scheduleSubscribedRender\(\)/);
});

test('JOURNAL V532 reconciles deleted desk/list selections without new record owners',()=>{
  const app=read('app.js');
  const start=app.indexOf('function journalNearestSurvivingTaskV532(');
  const end=app.indexOf('function journalRestoreTaskPageSyncAnchorV530(',start);
  assert.ok(start>0&&end>start);
  const helper=app.slice(start,end);
  assert.match(helper,/const existing=new Set\(available\)/);
  assert.match(helper,/snapshot\.order\.indexOf\(snapshot\.selected\)/);
  assert.match(helper,/for\(let i=index\+1/);
  assert.match(helper,/for\(let i=index-1/);
  assert.doesNotMatch(helper,/(?:firebase|persistTask|runTransaction)\s*\(/i);
  const board=app.slice(app.indexOf('function journalAtelierV420(tasks){'),
    app.indexOf('// State is view-only, scoped to JOURNAL;',start));
  const list=app.slice(app.indexOf('function journalIndexV425(tasks){'),
    app.indexOf('// JOURNAL V504: paging rerenders the toolbar.'));
  assert.match(board,/journalNearestSurvivingTaskV532\(syncAnchorV530,viewTasks\.map\(t=>t\.id\)\)/);
  assert.match(list,/journalNearestSurvivingTaskV532\(syncAnchorV530,ordered\.map\(t=>t\.id\)\)/);
  assert.match(list,/journalTaskInlineSelectedV491=continueReaderV544\?filters\.selected:''/);
  const restore=app.slice(end,app.indexOf('function journalAtelierV420(tasks){',end));
  assert.match(restore,/snapshot\.focus\.name===rowAttr/);
  assert.match(restore,/\.is-selected/);
  const diary=app.slice(app.indexOf('function journalRestoreChronicleSyncAnchorV528('),
    app.indexOf('function journalChronicleV411(tasks){'));
  assert.match(diary,/ownerDate!==anchor\.date/);
  assert.match(diary,/day\?\.querySelector\('\.jv-date'\)/);
});

test('JOURNAL V534 transfers only view-level case selection and retains page/day anchors',()=>{
  const app=read('app.js');
  const start=app.indexOf('let journalTaskNavigationSelectionV534=');
  const end=app.indexOf('// JOURNAL V494:',start);
  assert.ok(start>0&&end>start);
  const nav=app.slice(start,end);
  assert.match(nav,/function journalRememberTaskNavigationV534\(layout,id\)/);
  assert.match(nav,/function journalTaskNavigationSourceV534\(layout,root\)/);
  assert.match(nav,/function journalTaskNavigationTargetV534\(root,layout,id\)/);
  assert.match(nav,/const handoffV534=journalTaskNavigationSourceV534\(previous,oldView\)/);
  assert.match(nav,/journalAtelierSelectedV420=handoffV534\.id/);
  assert.match(nav,/journalIndexStateV425\.selected=handoffV534\.id/);
  assert.match(nav,/const handoffVisibleV534=handoffTargetV534/);
  assert.match(nav,/next==='timeline'/);
  assert.match(nav,/handoffV534\?\.follow&&handoffVisibleV534/);
  assert.match(nav,/journalChronicleReadAnchorV525/);
  assert.match(nav,/journalTaskPagePositionsV509\[next\]/);
  assert.doesNotMatch(nav,/(?:runTransaction|persistTask|commitTaskDraft|onValue|firebase\.database)\s*\(/i);
  const board=app.slice(app.indexOf('function journalAtelierV420(tasks){'),
    app.indexOf('// State is view-only, scoped to JOURNAL;',start));
  const list=app.slice(app.indexOf('function journalIndexV425(tasks){'),
    app.indexOf('// JOURNAL V504: paging rerenders the toolbar.'));
  assert.match(board,/journalRememberTaskNavigationV534\('board',journalAtelierSelectedV420\)/);
  assert.match(list,/journalRememberTaskNavigationV534\('list',filters\.selected\)/);
  assert.match(app,/function journalRememberTimelineSourceV505\(id\)\{\s*journalRememberTaskNavigationV534\('timeline',id\)/);
});


test('JOURNAL V536 direct row editor and vanished diary row share one safe return lifecycle',()=>{
  const app=read('app.js');
  const start=app.indexOf('let journalTaskNoteReturnV519=null;');
  const end=app.indexOf('// Escape belongs to JOURNAL',start);
  const scope=app.slice(start,end);
  assert.ok(start>0&&end>start);
  assert.match(scope,/journalTimelineReturnDayV536=day\?\{/);
  assert.match(scope,/const sourceDay=originalDay\?\.closest\('\.jv-chronicle-day'\)/);
  assert.match(scope,/const fallback=sourceDay\?\.querySelector\('\.jv-date'\)/);
  assert.match(scope,/!original&&sourceDay&&scrolling&&dayAnchor/);
  assert.match(scope,/dayAnchor\.width===window\.innerWidth/);
  assert.match(scope,/sourceDay\.getBoundingClientRect\(\)\.top-dayAnchor\.top/);
  assert.match(scope,/if\(elements\.detailPanel\?\.classList\.contains\('open'\)\|\|elements\.taskDialog\?\.open\)return/);
  assert.match(scope,/requestAnimationFrame\(journalRestoreTaskOriginV536\)/);
  assert.doesNotMatch(scope,/(?:setDoc|commitTaskDraft|firebase\.database|persistTask|runTransaction)\s*\(/i);
});


test('JOURNAL V538 local editor return keeps neighboring case instead of resetting to first',()=>{
  const app=read('app.js');
  const from=app.indexOf('let journalTaskNoteReturnV519=null;');
  const until=app.indexOf('// JOURNAL V507:',from);
  assert.ok(from>0&&until>from);
  const note=app.slice(from,until);
  assert.match(note,/const order=\[\.\.\.\(root\?\.querySelectorAll\('\['\+rowAttr\+'\]'\)\|\|\[\]\)\]/);
  assert.match(note,/journalTaskNoteReturnV519=\{id,selected:id,order,layout,action,top,rowTop/);
  assert.match(note,/const nearRow=view\.querySelector\(board\?/);
  assert.match(note,/!row&&target===nearRow/);
  assert.match(note,/origin\.rowTop/);
  const board=app.slice(app.indexOf('function journalAtelierV420(tasks){'),
    app.indexOf('// State is view-only, scoped to JOURNAL;'));
  const list=app.slice(app.indexOf('function journalIndexV425(tasks){'),
    app.indexOf('// JOURNAL V504: paging rerenders the toolbar.'));
  assert.match(board,/const returnAnchorV538=journalTaskNoteReturnV519\?\.layout==='board'/);
  assert.match(board,/journalNearestSurvivingTaskV532\(returnAnchorV538,viewTasks\.map\(t=>t\.id\)\)/);
  assert.match(list,/const returnAnchorV538=journalTaskNoteReturnV519\?\.layout==='list'/);
  assert.match(list,/journalNearestSurvivingTaskV532\(returnAnchorV538,ordered\.map\(t=>t\.id\)\)/);
  assert.match(list,/journalTaskInlineSelectedV491=continueReaderV544\?filters\.selected:''/);
  assert.doesNotMatch(note,/(?:persistTask|setDoc|runTransaction|updateDatabase|onValue)\s*\(/i);
});


test('JOURNAL V540 mobile case pager reuses filtered index selection without a new writer',()=>{
  const app=read('app.js');
  const css=read('journal-display-v367.css');
  const start=app.indexOf('function journalIndexPreviewV425(');
  const end=app.indexOf('// JOURNAL V504: paging rerenders the toolbar.',start);
  const list=app.slice(start,end);
  assert.ok(start>0&&end>start);
  assert.match(list,/data-j540-case-step="-1"/);
  assert.match(list,/data-j540-case-step="1"/);
  assert.match(list,/const index=ordered\.findIndex\(task=>task\.id===filters\.selected\)/);
  assert.match(list,/const adjacent=ordered\[index\+step\]/);
  assert.match(list,/button\.disabled=!\(index>=0&&adjacent\)/);
  assert.match(list,/row\.click\(\)/);
  assert.match(list,/journalIndexStateV425\.selected!==adjacent\.id/);
  assert.match(list,/document\.scrollingElement\.scrollTop\+=target\.getBoundingClientRect\(\)\.top-beforeTop/);
  assert.match(list,/target\.focus\(\{preventScroll:true\}\)/);
  assert.doesNotMatch(list,/(?:runTransaction|persistTask|commitTaskDraft|updateDatabase)\s*\(/i);
  assert.match(css,/JOURNAL V540/);
  assert.match(css,/#listView \.j540-case-pager/);
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/min-height:44px/);
});


test('JOURNAL V544 keeps the mobile reader after a filtered edit and restores pager focus after sync',()=>{
  const app=read('app.js');
  const start=app.indexOf('let journalTaskNoteReturnV519=null;');
  const end=app.indexOf('// JOURNAL V507:',start);
  const origin=app.slice(start,end);
  const index=app.slice(app.indexOf('function journalIndexV425(tasks){'),
    app.indexOf('// JOURNAL V504: paging rerenders the toolbar.'));
  const sync=app.slice(app.indexOf('const journalTaskSyncAttrsV530 ='),
    app.indexOf('function journalAtelierV420(tasks){'));
  assert.ok(start>0&&end>start);
  assert.match(origin,/const inlineReader=layout==='list'/);
  assert.match(origin,/journalTaskInlineSelectedV491===id/);
  // Keep V544's invariants without freezing the transient return record's
  // member ordering; V558 also stores viewportHeight for responsive return.
  assert.match(origin,/width:window\.innerWidth/);
  assert.match(origin,/inlineReader/);
  assert.match(origin,/const continuedReader=!board&&origin\.inlineReader/);
  assert.match(origin,/const changedHeading=continuedReader&&selected!==origin\.id/);
  assert.match(origin,/\|\|changedHeading\|\|row\|\|nearRow/);
  assert.match(index,/const continueReaderV544=Boolean\(filters\.selected&&\(/);
  assert.match(index,/journalTaskInlineSelectedV491=continueReaderV544\?filters\.selected:''/);
  assert.match(index,/journalIndexReturnAnchorV513=continueReaderV544/);
  assert.match(sync,/'data-j540-case-step'/);
  assert.match(sync,/target\?\.matches\('\[data-j540-case-step\]'\)&&target\.disabled/);
  assert.match(sync,/const opposite=String\(-Number\(target\.dataset\.j540CaseStep\)\)/);
  assert.match(sync,/not\(:disabled\)/);
  assert.doesNotMatch(origin,/(?:commitTaskDraft|persistTask|runTransaction|setDoc)\s*\(/i);
});


test('JOURNAL V546 subscription keeps inline cases alive and exposes nearby empty recovery',()=>{
  const app=read('app.js');
  const sync=app.slice(app.indexOf('const journalTaskSyncAttrsV530 ='),
    app.indexOf('function journalAtelierV420(tasks){'));
  const index=app.slice(app.indexOf('function journalIndexV425(tasks){'),
    app.indexOf('// JOURNAL V504: paging rerenders the toolbar.'));
  assert.match(sync,/const inlineReader=layout==='list'&&journalInlineDetailMediaV491\.matches/);
  assert.match(sync,/journalTaskInlineSelectedV491===selected/);
  assert.match(sync,/order,selected,inlineReader,rowTop/);
  assert.match(sync,/const emptyReaderV546=snapshot\.layout==='list'&&snapshot\.inlineReader/);
  assert.match(sync,/const emptyTargetV546=emptyReaderV546/);
  assert.match(sync,/const anchor=emptyTargetV546\|\|/);
  assert.match(sync,/let target=emptyTargetV546\|\|/);
  assert.match(index,/syncAnchorV530\?\.inlineReader&&syncAnchorV530\.selected===previousSelectedV546/);
  assert.match(index,/journalTaskInlineSelectedV491=continueReaderV544\?filters\.selected:''/);
  assert.match(index,/const emptiedReaderV546=Boolean\(syncAnchorV530\?\.inlineReader&&!ordered\.length\)/);
  assert.match(index,/閲覧中の案件が同期更新で表示対象から外れました/);
  assert.match(index,/role="status"/);
  assert.match(index,/data-j518-empty-reset/);
  assert.doesNotMatch(sync,/(?:persistTask|runTransaction|commitTaskDraft|setDoc|onValue)\s*\(/i);
});


test('JOURNAL V548 keeps an open case reader across explicit search/filter/sort without writes',()=>{
  const app=read('app.js');
  const from=app.indexOf('let journalIndexRefreshTokenV515=0;');
  const to=app.indexOf('function journalIndexV425(tasks){',from);
  const handler=app.slice(from,to);
  const end=app.indexOf('// JOURNAL V504: paging rerenders the toolbar.',to);
  const index=app.slice(to,end);
  assert.ok(from>0&&to>from&&end>to);
  assert.match(handler,/let journalIndexExplicitReaderV548=null/);
  assert.match(handler,/const readerOpen=Boolean\(journalInlineDetailMediaV491\.matches/);
  assert.match(handler,/journalTaskInlineSelectedV491===selectedId/);
  assert.match(handler,/oldRows\.map\(row=>row\.dataset\.j425Row\)/);
  assert.match(handler,/inlineReader:true,rowTop/);
  assert.match(handler,/try\{journalIndexV425\(tasks\);\}/);
  assert.match(handler,/finally\{journalIndexExplicitReaderV548=null;\}/);
  assert.match(index,/const explicitReaderV548=journalIndexExplicitReaderV548/);
  assert.match(index,/journalNearestSurvivingTaskV532\(explicitReaderV548,ordered\.map\(t=>t\.id\)\)/);
  assert.match(index,/explicitReaderV548\?\.inlineReader&&explicitReaderV548\.selected===previousSelectedV546/);
  assert.match(index,/journalTaskInlineSelectedV491=continueReaderV544\?filters\.selected:''/);
  assert.match(handler,/if\(readerOpen&&journalTaskInlineSelectedV491===journalIndexStateV425\.selected\)/);
  assert.match(handler,/journalIndexReturnAnchorV513=\{/);
  assert.match(handler,/row\.getBoundingClientRect\(\)\.top/);
  assert.match(index,/journalRefreshIndexV515\(tasks,input/);
  assert.match(index,/input\.addEventListener\('compositionstart'/);
  assert.match(index,/input\.addEventListener\('compositionend'/);
  assert.doesNotMatch(handler+index,/(?:runTransaction|persistTask|commitTaskDraft|updateDatabase|onValue)\s*\(/i);
});


test('JOURNAL V549 discards stale filter focus when subscription sees a newer user focus',()=>{
  const app=read('app.js');
  const capture=app.slice(app.indexOf('function journalCaptureTaskPageSyncAnchorV530('),
    app.indexOf('function journalNearestSurvivingTaskV532('));
  const start=app.indexOf('let journalIndexRefreshTokenV515=0;');
  const end=app.indexOf('function journalIndexV425(tasks){',start);
  const helper=app.slice(start,end);
  assert.ok(capture.length>300&&helper.length>300);
  assert.match(helper,/let journalIndexPendingFocusV549=null/);
  assert.match(helper,/const pendingFocusV549=\{token,findNextControl\}/);
  assert.match(helper,/journalIndexPendingFocusV549=pendingFocusV549/);
  assert.match(helper,/if\(journalIndexPendingFocusV549===pendingFocusV549\)/);
  assert.match(helper,/journalIndexPendingFocusV549=null/);
  assert.match(helper,/token!==journalIndexRefreshTokenV515/);
  assert.match(helper,/current\.isConnected&&current!==target\)return/);
  assert.match(capture,/if\(layout==='list'&&active&&journalIndexPendingFocusV549/);
  assert.match(capture,/active!==journalIndexPendingFocusV549\.findNextControl\(\)/);
  assert.match(capture,/\+\+journalIndexRefreshTokenV515/);
  assert.match(capture,/journalIndexPendingFocusV549=null/);
  assert.match(capture,/const focus=journalTaskSyncDescriptorV530/);
  assert.doesNotMatch(capture+helper,
    /(?:runTransaction|persistTask|commitTaskDraft|updateDatabase|onValue)\s*\(/i);
});


test('JOURNAL V552 preserves mobile desk note across remote removal without new business writes',()=>{
  const app=read('app.js');
  const sync=app.slice(app.indexOf('function journalCaptureTaskPageSyncAnchorV530('),
    app.indexOf('function journalNearestSurvivingTaskV532('));
  const restore=app.slice(app.indexOf('function journalRestoreTaskPageSyncAnchorV530('),
    app.indexOf('function journalAtelierV420(tasks){'));
  const atelier=app.slice(app.indexOf('function journalAtelierV420(tasks){'),
    app.indexOf('// State is view-only, scoped to JOURNAL;'));
  assert.ok(sync.length>300&&restore.length>300&&atelier.length>300);
  assert.match(sync,/const atelierInlineReaderV552=layout==='board'&&journalAtelierInlineMediaV494\.matches/);
  assert.match(sync,/journalAtelierInlineOpenV494/);
  assert.match(sync,/atelierInlineReaderV552[,}]/);
  assert.match(atelier,/journalAtelierInlineOpenV494=Boolean\(syncAnchorV530\?\.atelierInlineReaderV552/);
  assert.match(atelier,/閲覧中の案件が同期更新で表示対象から外れました/);
  assert.match(restore,/const emptyAtelierV552=snapshot\.layout==='board'&&snapshot\.atelierInlineReaderV552/);
  assert.match(restore,/\[data-j520-empty-reset\],\[data-j520-empty-new\]/);
  assert.match(restore,/const anchor=emptyTargetV546\|\|emptyTargetV552\|\|/);
  assert.match(restore,/let target=emptyTargetV546\|\|emptyTargetV552\|\|/);
  assert.match(restore,/current\.isConnected\)return/);
  assert.doesNotMatch(sync+restore+atelier,
    /(?:runTransaction|persistTask|commitTaskDraft|setDoc|onValue)\s*\(/i);
});


test('JOURNAL V553 pages through displayed desk cases without business writes',()=>{
  const app=read('app.js');
  const css=read('journal-display-v367.css');
  const position=app.slice(app.indexOf('function journalPositionAtelierNoteV494('),
    app.indexOf('journalAtelierInlineMediaV494.addEventListener('));
  const sync=app.slice(app.indexOf('const journalTaskSyncAttrsV530 ='),
    app.indexOf('function journalAtelierV420(tasks){'));
  const atelier=app.slice(app.indexOf('function journalAtelierV420(tasks){'),
    app.indexOf('// State is view-only, scoped to JOURNAL;'));
  assert.ok(position.length>300&&sync.length>300&&atelier.length>300);
  assert.match(position,/pager\.hidden=!inline/);
  assert.match(position,/cards\.indexOf\(card\)/);
  assert.match(position,/button\.disabled=!inline\|\|index<0/);
  assert.match(atelier,/class="j553-atelier-pager"/);
  assert.match(atelier,/data-j553-case-step="-1"/);
  assert.match(atelier,/data-j553-case-step="1"/);
  assert.match(atelier,/const cards=\[\.\.\.root\.querySelectorAll\('\[data-j420-task-id\]'\)\]/);
  assert.match(atelier,/next\.click\(\)/);
  assert.match(atelier,/token!==journalAtelierPageTokenV553/);
  // V554 supersedes the V553 note-containment heuristic: a newer focus
  // anywhere (including another note control) must never be overwritten.
  assert.match(atelier,/const activeAtRequestV554=document\.activeElement/);
  assert.match(atelier,/current!==activeAtRequestV554/);
  assert.match(atelier,/journalAtelierSelectedV420!==id/);
  assert.match(atelier,/data-j494-atelier-back/);
  assert.match(sync,/'data-j553-case-step'/);
  assert.match(sync,/target\?\.matches\('\[data-j553-case-step\]'\)&&target\.disabled/);
  assert.match(sync,/const opposite=String\(-Number\(target\.dataset\.j553CaseStep\)\)/);
  assert.match(css,/\.j553-atelier-pager:not\(\[hidden\]\)/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\)/);
  assert.match(css,/min-height:44px/);
  assert.doesNotMatch(position+sync+atelier,
    /(?:persistTask|runTransaction|commitTaskDraft|setDoc|onValue)\s*\(/i);
});


test('JOURNAL V554 latest focus beats queued card and pager restoration',()=>{
  const app=read('app.js');
  const note=app.slice(app.indexOf('function journalFocusAtelierNoteV500('),
    app.indexOf('function journalAtelierCardV420('));
  const desk=app.slice(app.indexOf('function journalAtelierV420(tasks){'),
    app.indexOf('// State is view-only, scoped to JOURNAL;'));
  assert.ok(note.length>300&&desk.length>5000);
  assert.match(app,/let journalAtelierPagingV554=false/);
  assert.match(note,/const activeAtRequestV554=document\.activeElement/);
  assert.match(note,/current!==activeAtRequestV554/);
  assert.match(note,/current\.isConnected\)return/);
  assert.match(desk,/if\(!journalAtelierPagingV554\)journalFocusAtelierNoteV500\(root,true\)/);
  assert.match(desk,/journalAtelierPagingV554=true/);
  assert.match(desk,/try\{next\.click\(\);\}/);
  assert.match(desk,/finally\{journalAtelierPagingV554=false;\}/);
  assert.match(desk,/const activeAtRequestV554=document\.activeElement/);
  assert.match(desk,/current!==activeAtRequestV554/);
  assert.match(desk,/token!==journalAtelierPageTokenV553/);
  assert.doesNotMatch(note+desk,/(?:persistTask|runTransaction|commitTaskDraft|setDoc|onValue)\s*\(/i);
});


test('JOURNAL V556 keeps the visible note section across sync and phone width changes',()=>{
  const app=read('app.js');
  const anchor=app.slice(app.indexOf('let journalAtelierReaderAnchorV556=null;'),
    app.indexOf('// V553: invalidate queued mobile note navigation'));
  const capture=app.slice(app.indexOf('function journalCaptureTaskPageSyncAnchorV530('),
    app.indexOf('function journalNearestSurvivingTaskV532('));
  const restore=app.slice(app.indexOf('function journalRestoreTaskPageSyncAnchorV530('),
    app.indexOf('function journalAtelierV420(tasks){'));
  assert.ok(anchor.length>1200&&capture.length>400&&restore.length>500);
  assert.match(anchor,/\.j420-note-description/);
  assert.match(anchor,/\.j420-note-checks/);
  assert.match(anchor,/window\.addEventListener\('scroll'/);
  assert.match(anchor,/passive:true/);
  assert.match(anchor,/window\.addEventListener\('resize'/);
  assert.match(anchor,/anchor\.width===window\.innerWidth/);
  assert.match(anchor,/anchor\.id!==journalAtelierSelectedV420/);
  assert.match(anchor,/!note\.contains\(current\)/);
  assert.match(anchor,/journalCaptureAtelierReaderAnchorV556\(\)/);
  assert.match(capture,/const readerAnchorV556=layout==='board'&&atelierInlineReaderV552/);
  assert.match(capture,/focusWasVisibleV556:Boolean\(active&&visible\(active\)\)/);
  assert.match(restore,/const savedReadingV556=snapshot\.readerAnchorV556/);
  assert.match(restore,/savedReadingV556\.id===journalAtelierSelectedV420/);
  assert.match(restore,/const readingOffscreenV556=snapshot\.layout==='board'/);
  assert.match(restore,/!snapshot\.focusWasVisibleV556/);
  assert.match(restore,/&&\!readingOffscreenV556/);
  assert.doesNotMatch(anchor+capture+restore,
    /(?:persistTask|runTransaction|commitTaskDraft|setDoc|onValue)\s*\(/i);
});


test('JOURNAL V558 note return keeps modal source and newer focus across phone resize',()=>{
  const app=read('app.js');
  const modal=app.slice(app.indexOf('function journalOpenTaskNoteV519('),
    app.indexOf('// JOURNAL V507: transient source'));
  const reader=app.slice(app.indexOf('function journalCaptureAtelierReaderAnchorV556('),
    app.indexOf('// V553: invalidate queued mobile note navigation'));
  assert.ok(modal.length>1400&&reader.length>1200);
  assert.match(modal,/viewportHeight:window\.innerHeight/);
  assert.match(modal,/current\.getClientRects\(\)\.length/);
  assert.match(modal,/current\.matches\('button,input,select,textarea,a,\[tabindex\]'\)/);
  assert.match(modal,/target===button/);
  assert.match(modal,/origin\.top\/origin\.viewportHeight\*window\.innerHeight/);
  assert.match(modal,/scrolling\.scrollTop\+=rect\.top-desired/);
  assert.match(modal,/if\(board&&journalAtelierInlineOpenV494\)/);
  assert.match(modal,/journalCaptureAtelierReaderAnchorV556\(\)/);
  assert.match(reader,/if\(elements\.detailPanel\?\.classList\.contains\('open'\)\|\|elements\.taskDialog\?\.open\)return/);
  assert.match(reader,/anchor\.id!==journalAtelierSelectedV420/);
  assert.doesNotMatch(modal+reader,
    /(?:persistTask|runTransaction|commitTaskDraft|setDoc|onValue)\s*\(/i);
});
