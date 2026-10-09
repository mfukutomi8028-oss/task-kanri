// Test-only candidate. Never loaded by release-manifest.js and never writes a file.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

export function completedBoardCandidate(source) {
  const start = source.indexOf('function renderBoard(tasks) {');
  const end = source.indexOf('\nfunction openTaskDialogFromTimeline(', start);
  assert.ok(start >= 0 && end > start, 'renderBoard boundaries changed');
  const before = source.slice(start, end);
  const predicate = 'state.scope === "done"';
  assert.equal(before.split(predicate).length - 1, 2, 'expected exactly two legacy board predicates');
  const anchor = '  const statuses = getStatusList();';
  assert.equal(before.split(anchor).length - 1, 1);
  const after = before.replace(anchor, `${anchor}\n  const completedView = scopeHasDone() || isCompletedStatus(elements.statusFilter.value);`)
    .replaceAll(predicate, 'completedView');
  return source.slice(0, start) + after + source.slice(end);
}

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} missing`);
  const end = source.indexOf('\nfunction ', start + 1);
  assert.ok(end > start, `${name} boundary missing`);
  return source.slice(start, end);
}

function exercise(source, scope, statusFilter = '') {
  const done = '\u5b8c\u4e86', todo = '\u672a\u7740\u624b';
  const state = { scope, tasks: [
    { id: 'mine-done', assignee: 'QA373', status: done },
    { id: 'peer-done', assignee: 'Peer373', status: done },
    { id: 'mine-open', assignee: 'QA373', status: todo },
    { id: 'peer-open', assignee: 'Peer373', status: todo }
  ].map(task => ({ ...task, title: task.id, tags: [], pinned: false, updatedAt: 1 })) };
  const elements = Object.fromEntries(['searchInput','statusFilter','assigneeFilter','priorityFilter','categoryFilter','sortSelect']
    .map(name => [name, { value: name === 'statusFilter' ? statusFilter : name === 'sortSelect' ? 'updated' : '' }]));
  for (const name of ['pinOnly','favoriteOnly','overdueOnly','todayOnly']) elements[name] = { checked: false };
  elements.boardView = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
  const context = { state, elements, normalizeText: value => String(value || '').toLowerCase(),
    startOfToday: () => new Date(2026, 9, 9), isCurrentUserOrGroupAssignee: name => name === 'QA373',
    isCompletedStatus: status => status === done, getStatusList: () => [todo, done],
    taskCard: task => `<article data-task-id="${task.id}"></article>`, emptyColumn: () => '',
    escapeHtml: value => String(value), bindTaskCards() {}, bindBoardTaskDrops() {}, bindReorder() {}, reorderStatuses() {} };
  const names = ['scopeHasMine','scopeHasDone','makeScope','toggleScopeFilter','getFilteredTasks','renderBoard'];
  runInNewContext(names.map(name => functionSource(source, name)).join('\n') +
    '\nselected = getFilteredTasks().map(task => task.id); renderBoard(getFilteredTasks());', context);
  return { selected: [...context.selected], cards: [...elements.boardView.innerHTML.matchAll(/data-task-id="([^"]+)"/g)].map(match => match[1]),
    addStatus: elements.boardView.innerHTML.includes('data-add-status') };
}

export function verifyCompletedBoardCandidate(source) {
  const candidate = completedBoardCandidate(source);
  const legacy = exercise(source, 'mineDone');
  assert.deepEqual(legacy.selected, ['mine-done']);
  assert.deepEqual(legacy.cards, []);
  assert.equal(legacy.addStatus, true);
  // All code outside renderBoard, including filtering, writes and timeline, stays byte-identical.
  const originalBoard = functionSource(source, 'renderBoard');
  const candidateBoard = functionSource(candidate, 'renderBoard');
  assert.equal(source.replace(originalBoard, ''), candidate.replace(candidateBoard, ''));
  const matrix = [];
  for (const scope of ['all','mine','done','mineDone']) {
    for (const status of ['', '\u5b8c\u4e86', '\u672a\u7740\u624b']) {
      const actual = exercise(candidate, scope, status);
      const expected = exercise(source, scope, status).selected;
      assert.deepEqual(actual.selected, expected, 'candidate must not change the selected tasks');
      assert.deepEqual(actual.cards, expected, `board/query mismatch: ${scope}/${status}`);
      assert.equal(actual.addStatus, !(scope === 'done' || scope === 'mineDone' || status === '\u5b8c\u4e86'));
      matrix.push({ scope, status, ...actual });
    }
  }
  assert.throws(() => completedBoardCandidate(candidate), /legacy board predicates/);
  assert.throws(() => completedBoardCandidate(''), /boundaries/);
  return { legacy, matrixCases: matrix.length, outsideBoardUnchanged: true, matrix };
}


// Product checks run the actual app.js functions without applying the candidate.
// The candidate above remains a historical reproduction utility, not runtime.
export function verifyCompletedBoardProduct(source) {
  const board = functionSource(source, 'renderBoard');
  assert.ok(board.includes('const completedView = scopeHasDone() || isCompletedStatus(elements.statusFilter.value);'));
  assert.ok(!board.includes('state.scope === "done"'));
  const matrix = [];
  const done = '\u5b8c\u4e86', todo = '\u672a\u7740\u624b';
  for (const scope of ['all', 'mine', 'done', 'mineDone']) {
    for (const status of ['', done, todo]) {
      const onlyMine = scope === 'mine' || scope === 'mineDone';
      const completed = scope === 'done' || scope === 'mineDone' || status === done;
      const kind = completed ? 'done' : 'open';
      const expected = status === todo && completed ? []
        : onlyMine ? [`mine-${kind}`] : [`mine-${kind}`, `peer-${kind}`];
      const actual = exercise(source, scope, status);
      assert.deepEqual(actual.selected, expected, `query fixture mismatch: ${scope}/${status}`);
      assert.deepEqual(actual.cards, expected, `product board mismatch: ${scope}/${status}`);
      assert.equal(actual.addStatus, !completed);
      matrix.push({ scope, status, ...actual });
    }
  }
  return { matrixCases: matrix.length, productSource: true, matrix };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  console.log(JSON.stringify(verifyCompletedBoardProduct(source), null, 2));
}
