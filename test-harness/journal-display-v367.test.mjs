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

test('Ver.372 composes actual canonical controls into original notebook sheets, then restores them', () => {
  for (const type of ['Todo', 'Task', 'Weekly', 'Memo']) {
    const composing = ({Todo:'composeTodoSheet',Task:'composeTaskRegister',
      Weekly:'composeWeeklyPages',Memo:'composeMemoSheets'})[type];
    const restoring = ({Todo:'restoreTodoSheet',Task:'restoreTaskRegister',
      Weekly:'restoreWeeklyPages',Memo:'restoreMemoSheets'})[type];
    assert.ok(js.includes('function ' + composing + '()'), composing);
    assert.ok(js.includes('function ' + restoring + '()'), restoring);
  }
  assert.match(js, /watchJournalViews/);
  assert.match(js, /new MutationObserver\(requestJournalCompose\)/);
  assert.match(js, /consoleEl\.append\(heading, toolbar, controls\)/);
  assert.match(js, /if \(heading\) left\.append\(heading\)/);
  assert.match(js, /if \(tools\) left\.append\(tools\)/);
  assert.match(js, /ledger\.append\(card\)/);
});

test('Paper design is genuinely different between Linen and Margin, not a color-only theme', () => {
  const normalized = css.replace(/\/\*[\s\S]*?\*\//g,'');
  assert.equal((normalized.match(/\{/g)||[]).length,(normalized.match(/\}/g)||[]).length);
  assert.match(css,/html\[data-wb-display="journal"\]/);
  assert.match(css,/data-wb-journal-theme="linen"/);
  assert.match(css,/data-wb-journal-theme="margin"/);
  assert.match(css,/\.j420-today-spread/);
  assert.match(css,/\.j420-planner/);
  assert.match(css,/j-todo-spread-v372/);
  assert.match(css,/j-week-ledger-v372/);
  assert.match(css,/j-memo-spread-v372/);
  assert.match(css,/j-task-console-v372/);
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

test('Journal groups a real memo index, keeps the week planner under Schedule and persists safe paper colors', () => {
  assert.doesNotMatch(js, /id: 'week'/);
  assert.match(js, /\['today', 'todos', 'tasks', 'schedule'\]/);
  assert.match(js, /composeWeeklyPages\(\)/);
  assert.match(js, /function composeMemoIndex\(index, memo\)/);
  assert.match(js, /function sortMemoCards\(grid\)/);
  assert.match(js, /journalMemoSort === 'category'/);
  assert.match(js, /card\.scrollIntoView/);
  assert.match(css, /\.j-memo-index-link-v383/);
  assert.match(css, /\.work-memo-card-v167\[data-memo-paper-color="mint"\]/);
  assert.match(css, /\.work-memo-body-v167 \{[\s\S]*?background:#fff !important/);
  assert.match(memoOwner, /MEMO_PAPER_COLORS = Object\.freeze/);
  assert.match(memoOwner, /async function changeMemoPaperColor\(/);
  assert.match(memoOwner, /\.\.\.memo, id, paperColor: color/);
  assert.match(memoOwner, /updatedAt: colorOnly \? Number\(existing\.updatedAt/);
  assert.match(memoOwner, /const proposedPaperColor = values\.paperColor \?\? existing\?\.paperColor \?\? 'ivory'/);
  assert.doesNotMatch(js, /\b(?:initializeApp|runTransaction|setDatabase)\s*\(/);
});

test('Ver.389 JOURNAL resolves ToDo composition, paper inputs and canonical calendar note without duplicate writes', () => {
  const app=read('app.js');
  const memo=read('work-features-v167.js');
  const todo=read('todo-tools-v145.js');
  assert.match(js, /if \(!stats \|\| !workspace \|\| !form\) return/);
  assert.match(js, /if \(tools\) left\.append\(tools\)/);
  assert.match(css, /#todoView \.j-leaf-todo-compose-v372 > \.todo-tools-v145/);
  assert.match(css, /#todoView \.todo-state-toggle-v144\[aria-pressed="true"\]::before/);
  assert.match(css, /date-segment-year-v127 \{/);
  assert.match(css, /flex:0 0 6\.1ch !important/);
  assert.match(css, /word-break:keep-all !important/);
  assert.match(css, /\.j-entry-outline-v385 \{/);
  assert.match(css, /\.j-calendar-today-v389/);
  assert.match(app, /const journalMonth = document\.documentElement\.dataset\.wbDisplay === 'journal'/);
  assert.match(app, /const todayItems = todayInMonth/);
  assert.match(app, /data-schedule-id="\$\{escapeHtml\(item\.id\)\}"/);
  assert.match(app, /let composingMainSearch = false/);
  assert.match(app, /input\.addEventListener\('compositionend'/);
  assert.match(memo, /let composingMemoSearch = false/);
  assert.match(memo, /memoSearchInput\?\.addEventListener\('compositionend'/);
  assert.match(todo, /let composingSearch = false/);
  assert.match(css, /background:repeating-linear-gradient\(90deg,var\(--j-sage\)/);
  assert.match(css, /\.task-card\.priority-緊急/);
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

test('JOURNAL Ver.394 groups original settings controls, task actions and schedule switches', () => {
  assert.match(js,/function composeJournalSettingsV393\(\)/);
  assert.match(js,/function restoreJournalSettingsV393\(\)/);
  assert.match(js,/function journalRelocateV393\(node,destination,record\)/);
  assert.match(js,/function restoreJournalMovedV393\(record\)/);
  assert.match(js,/function composeTaskStructureV393\(consoleEl\)/);
  assert.match(js,/function restoreTaskStructureV393\(\)/);
  assert.match(js,/function composeScheduleStructureV393\(\)/);
  assert.match(js,/function restoreScheduleStructureV393\(\)/);
  assert.match(js,/function followJournalEntryOutlineV393\(dialog, outline, record\)/);
  assert.match(js,/dialog\.addEventListener\('scroll',schedule/);
  assert.match(js,/record\.listeners\.push/);
  assert.match(css,/\.j-settings-book-head-v393/);
  assert.match(css,/\.j-task-capture-v393/);
  assert.match(css,/\.j-task-browse-v393/);
  assert.match(css,/\.j-schedule-dates-v393/);
  assert.match(css,/\.j-schedule-modes-v393/);
  assert.match(css,/two different physical paper systems/);
  assert.match(css,/data-wb-journal-theme="margin"/);
});


test('JOURNAL Ver.396 reduces redundant structure while preserving original owners', () => {
  const memoOwner=read('work-features-v167.js');
  assert.match(js, /form\.append\(addButton\)/);
  assert.match(js, /originalMain\.append\(addButton\)/);
  assert.match(js, /journalMemoColorV396/);
  assert.match(js, /j-memo-color-hidden-v396/);
  assert.match(js, /getPaperColors\?\.\(\)/);
  assert.match(memoOwner, /getPaperColors: \(\) => MEMO_PAPER_COLORS\.map/);
  assert.match(js, /const legend = document\.createElement\('details'\)/);
  assert.match(js, /legend\.innerHTML = '<summary>色の意味<\/summary>'/);
  assert.match(css, /Compact task register: entry on the left/);
  assert.match(css, /Schedule page: a compact date strip/);
  assert.match(css, /\.j-memo-color-filters-v396/);
  assert.match(css, /position:relative !important;top:auto !important/);
  assert.match(css, /\.todo-create-form > \.todo-add-button/);
  assert.doesNotMatch(js, /<summary>絞り込み・分類の管理<\/summary>/);
  assert.doesNotMatch(js,/data-journal-settings-tab="filters"/);
  assert.doesNotMatch(js,/id="jSettingsFiltersV393"/);
  assert.doesNotMatch(js, /cloneNode\s*\(/);
  assert.doesNotMatch(js, /\b(?:initializeApp|runTransaction|setDatabase)\s*\(/);
});

test('JOURNAL paper board and scroll index use only existing read-only view owners', () => {
  assert.match(js,/\{ id: 'memo', label: 'メモ'/);
  assert.match(js,/function attachMemoIndexFollowV402\(/);
  assert.match(js,/function detachMemoIndexFollowV402\(/);
  assert.match(js,/document\.addEventListener\('scroll',request,\{capture:true,passive:true\}\)/);
  assert.match(js,/Math\.min\(limit,Math\.max\(0,12-top\)\)/);
  assert.match(css, /\.j420-island-grid/);
  assert.match(css, /\.j420-atelier-index/);
  assert.match(css, /\.jv-chronicle-day/);
  assert.match(css, /#todoView \.todo-check:checked::after/);
  assert.match(css, /#todoView \.todo-state-toggle-v144\[aria-pressed="true"\]::before/);
  assert.match(css, /#workMemoViewV167 \.j-leaf-memo-index-v372 \{\s*position:relative !important/);
  assert.doesNotMatch(js, /\b(?:initializeApp|setDatabase|runTransaction)\s*\(/);
});

test('Ver.412 JOURNAL removes settings clutter and uses native-looking page dividers',()=>{
  assert.match(js,/journalTabIconPathsV412/);
  assert.match(js,/tabIconV412\(entry.id\)/);
  assert.match(css,/\.j-tab-illustration-v412 svg/);
  assert.match(css,/\.j420-agenda-item/);
  assert.doesNotMatch(js,/<details class="j-settings-optional-filters-v396">/);
});

test('Ver.420 JOURNAL renders an independently structured Today diary and Task Atelier',()=>{
  const app=read('app.js');
  assert.match(app,/function journalTodayV420\(\)/);
  assert.match(app,/function journalAtelierV420\(tasks\)/);
  assert.match(app,/function journalAtelierNoteV420\(t\)/);
  assert.match(app,/let journalAtelierViewV420\s*=\s*'all'/);
  assert.match(app,/let journalSortV411\s*=\s*\{\s*key:/);
  assert.match(app,/function journalIndexV411\(tasks\)/);
  assert.match(app,/function journalChronicleV411\(tasks\)/);
  assert.match(css,/\.j420-today-spread/);
  assert.match(css,/\.j420-atelier-workbench/);
  assert.match(css,/\.j420-note-grid/);
  assert.match(css,/\.j420-paperclip/);
  assert.match(css,/\.j420-pen/);
  assert.match(css,/\.j420-project-note/);
  assert.doesNotMatch(js,/function composeTodaySheet\(/);
  assert.doesNotMatch(js,/function restoreTodaySheet\(/);
  assert.doesNotMatch(app,/function journalBoardV411\(/);
  assert.doesNotMatch(css,/\.jv-chapter-notes/);
  assert.match(css,/dialog\.j-entry-dialog-v385 \.dialog-head :is\(\[data-memo-close\]/);
  assert.doesNotMatch(css,/dialog\.j-entry-dialog-v385 :is\(\[data-memo-close\]/);
});
