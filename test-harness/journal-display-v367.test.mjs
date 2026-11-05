import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const js = read('journal-display-v367.js');
const css = read('journal-display-v367.css');
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
  assert.equal(ownership.baselineRelease,'374');
  assert.match(manifest,/version: "374"/);
  assert.match(selector,/\['journal', 'Journal'/);
});
