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
  for (const type of ['Today', 'Todo', 'Task', 'Weekly', 'Memo']) {
    const composing = ({Today:'composeTodaySheet',Todo:'composeTodoSheet',Task:'composeTaskRegister',
      Weekly:'composeWeeklyPages',Memo:'composeMemoSheets'})[type];
    const restoring = ({Today:'restoreTodaySheet',Todo:'restoreTodoSheet',Task:'restoreTaskRegister',
      Weekly:'restoreWeeklyPages',Memo:'restoreMemoSheets'})[type];
    assert.ok(js.includes('function ' + composing + '()'), composing);
    assert.ok(js.includes('function ' + restoring + '()'), restoring);
  }
  assert.match(js, /watchJournalViews/);
  assert.match(js, /new MutationObserver\(requestJournalCompose\)/);
  assert.match(js, /consoleEl\.append\(heading, toolbar, controls\)/);
  assert.match(js, /left\.append\(heading, stats\)/);
  assert.match(js, /ledger\.append\(card\)/);
});

test('Paper design is genuinely different between Linen and Margin, not a color-only theme', () => {
  const normalized = css.replace(/\/\*[\s\S]*?\*\//g,'');
  assert.equal((normalized.match(/\{/g)||[]).length,(normalized.match(/\}/g)||[]).length);
  assert.match(css,/html\[data-wb-display="journal"\]/);
  assert.match(css,/data-wb-journal-theme="linen"/);
  assert.match(css,/data-wb-journal-theme="margin"/);
  assert.match(css,/grid-template-columns:minmax\(0,1\.28fr\) minmax\(0,\.72fr\)/);
  assert.match(css,/j-day-spread-v372/);
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
  assert.match(memoOwner, /paperColor: color, updatedBy: currentUser\(\)/);
  assert.match(memoOwner, /const proposedPaperColor = values\.paperColor \?\? existing\?\.paperColor \?\? 'ivory'/);
  assert.doesNotMatch(js, /\b(?:initializeApp|runTransaction|setDatabase)\s*\(/);
});

test('Journal entry folios reparent actual inputs and restore them without duplicate business writers', () => {
  const memo=read('work-features-v167.js');
  assert.match(js,/function journalEntryDecorateV385\(dialog, spec\)/);
  assert.match(js,/function journalMemoEditorV385\(dialog\)/);
  assert.match(js,/function restoreJournalEntriesV385\(\)/);
  assert.match(js,/function journalEntryMoveV385\(node, destination, record\)/);
  assert.match(js,/document\.createComment\('journal-input-original-position'\)/);
  assert.match(js,/marker\.replaceWith\(node\)/);
  assert.match(js,/data-journal-entry-jump/);
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
