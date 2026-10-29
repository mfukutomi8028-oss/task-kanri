import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const app = read('app.js');
const todoSync = read('todo-sync-v136.js');
const history = read('todo-history-v146.js');
const memo = read('work-features-v167.js');
const activityCss = read('ui-todo-light-v189.css');
const activityDialogCss = read('ui-todo-light-v189.css');
const todoCss = read('ui-todo-light-v189.css');

test('new ToDo records are assigned the smallest order in both local and remote create flows', () => {
  assert.equal((app.match(/order: \(orders\.length \? Math\.min\(\.\.\.orders\) - 1024 : 0\)/g) || []).length, 2);
  assert.match(todoSync, /\.sort\(\(a, b\) => a\.order - b\.order/);
});

test('ToDo archive keeps all saved completed records and searches beyond the first 50', () => {
  assert.match(history, /const PAGE_SIZE = 50/);
  assert.match(history, /history\.slice\(0, visibleCount\)/);
  assert.match(history, /readHistory\(\)\.filter\(todo => historyMatches\(todo, needle\)\)/);
  assert.match(history, /visibleCount \+= PAGE_SIZE/);
  assert.doesNotMatch(history, /HISTORY_DAYS|historyStart\(/);
});

test('activity notices always show a common kind/timestamp header and consistent title/detail order', () => {
  assert.match(app, /class="activity-topline-v531"/);
  assert.match(app, /<span class="activity-kind">\$\{escapeHtml\(item\.action\)\}<\/span>/);
  assert.match(app, /<time>\$\{escapeHtml\(formatDateTime\(item\.at\)\)\}<\/time>/);
  assert.match(activityCss, /\.activity-item \.activity-topline-v531/);
  assert.match(activityDialogCss, /\.activity-dialog \.activity-item \.activity-topline-v531/);
});

test('Today personal panel order persists separately from task/schedule shared writes', () => {
  assert.match(app, /const TODAY_PANEL_KEYS_V531 = \['schedule', 'overdue', 'due-today', 'unsorted', 'spare'\]/);
  assert.match(app, /workBoardTodayPanelOrderV531/);
  assert.match(app, /enableTodayPanelOrderingV531\(elements\.todayView\)/);
  assert.match(app, /function moveTodayPanelV531\(/);
  assert.match(app, /grid\.addEventListener\('drop'/);
});

test('dragging ToDos preserves mobile arrow controls and transaction-based revision checks', () => {
  assert.match(app, /function bindTodoDragListV531\(/);
  assert.match(app, /async function moveTodoByDropV531\(/);
  assert.match(app, /runTransaction\(state\.todosRef, updateRecords\)/);
  assert.match(app, /normalizeRevision\(record\.revision\) \+ 1/);
  assert.match(app, /bindTodoDragListV531\(ul, done \? 'completed-today' : 'open'\)/);
  assert.match(app, /const up = buildActionButton/);
  assert.match(app, /const down = buildActionButton/);
  assert.match(todoCss, /pointer: coarse/);
});

test('drag reorder planner moves a record in one order update and rebalances only on a tie', () => {
  const from = app.indexOf('function todoDragPlanV531(');
  const to = app.indexOf('async function moveTodoByDropV531(', from);
  assert.ok(from >= 0 && to > from);
  const planner = runInNewContext(app.slice(from, to) + '\ntodoDragPlanV531', {});
  const items = [
    {id:'first',order:0}, {id:'second',order:1024}, {id:'third',order:2048}
  ];
  assert.deepEqual(JSON.parse(JSON.stringify(planner(items, 'first', 'third', true))), [{ id:'first', order:3072 }]);
  assert.deepEqual(JSON.parse(JSON.stringify(planner(items, 'third', 'first', false))), [{ id:'third', order:-1024 }]);
  assert.equal(planner(items, 'first', 'second', false), null);
  const ties = [{id:'a',order:0},{id:'b',order:0},{id:'c',order:0}];
  const rebalance = planner(ties, 'c', 'b', false);
  assert.ok(rebalance.length >= 2);
  assert.ok(rebalance.every(change => Number.isFinite(change.order)));
});

test('business memo order is local per user, preserving the shared pin and memo write boundaries', () => {
  assert.match(memo, /workBoardMemoOrderV531/);
  assert.match(memo, /const pinDifference = Number\(Boolean\(b\.pinned\)\) - Number\(Boolean\(a\.pinned\)\)/);
  assert.match(memo, /function moveMemoV531\(/);
  assert.match(memo, /if \(featureState\.memoSearch \|\| featureState\.memoCategory\) return/);
  assert.match(memo, /localStorage\.setItem\(memoOrderKeyV531\(\), JSON\.stringify\(next\)\)/);
  const writer = read('workspace-memo-v539.js');
  assert.match(memo, /return memoRepository\.commit\(next, expectedRevision\)/);
  assert.ok(writer.includes('rooms/${state.roomId}/businessMemos/${next.id}'));
  assert.match(writer, /runTransaction\(ref\(state\.db/);
  assert.match(writer, /finiteRevision\(current\.revision\) !== finiteRevision\(expectedRevision\)/);
});

test('drop center respects drag direction while edge positions remain explicit', () => {
  const from = app.indexOf('function shouldDropAfterV531(');
  const to = app.indexOf('// PC操作用: 既存の▲▼ボタン', from);
  assert.ok(from >= 0 && to > from);
  const decide = runInNewContext(app.slice(from, to) + '\nshouldDropAfterV531', {});
  const nodes = [{ dataset: { todoId:'first' } }, { dataset: { todoId:'second' } }];
  for (const node of nodes) {
    node.parentElement = { children:nodes };
    node.getBoundingClientRect = () => ({ top:0, height:100 });
  }
  assert.equal(decide({ clientY:50 }, nodes[1], 'first', 'todoId'), true);
  assert.equal(decide({ clientY:50 }, nodes[0], 'second', 'todoId'), false);
  assert.equal(decide({ clientY:20 }, nodes[1], 'first', 'todoId'), false);
  assert.equal(decide({ clientY:80 }, nodes[0], 'second', 'todoId'), true);
});
