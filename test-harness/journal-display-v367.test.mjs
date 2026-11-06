import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
  assert.match(js,/function attachMemoIndexFollowV402\(/);
  assert.match(js,/function detachMemoIndexFollowV402\(/);
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
  assert.match(app,/j430-todo-ruler/);
  assert.match(app,/j430-schedule-herbarium/);
  assert.match(js,/journalMemoFastenerByIdV430/);
  assert.match(css,/\.j430-filter-option\[aria-pressed/);
  assert.match(css,/\.j425-list-props \.j430-list-pen/);
  assert.match(css,/\.j425-todo-props \.j430-todo-ruler/);
  assert.match(css,/\.j425-schedule-props \.j430-schedule-herbarium/);
  assert.match(css,/\.j430-memo-seal/);
  const props=read('assets/journal-fasteners-v425.svg');
  for(const fastener of ['binder','clip','pin','tape','washi','corner','grommet','bulldog'])assert.match(props,new RegExp('<symbol id="'+fastener+'"'));
  assert.ok(props.length>4500,'fastener vectors should have real metal/paper details');
  assert.doesNotMatch(app,/function renderClassicMemoDuplicateV430/);
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
