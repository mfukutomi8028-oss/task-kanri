import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function extract(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' missing');
  const end = source.indexOf('\nfunction ', start + 1);
  assert.ok(end > start, name + ' boundary missing');
  return source.slice(start, end);
}
const functions = ['scopeHasMine', 'scopeHasDone', 'getFilteredTasks', 'renderTimeline'].map(extract).join('\n');
const done = '完了';
const open = '未着手';
const all = [
  { id: 'mine-done', status: done, assignee: 'QA', dueDate: '2026-10-09' },
  { id: 'peer-done', status: done, assignee: 'Peer', dueDate: '2026-10-09' },
  { id: 'mine-open', status: open, assignee: 'QA', dueDate: '2026-10-09' },
  { id: 'peer-open', status: open, assignee: 'Peer', dueDate: '2026-10-09' },
  { id: 'mine-undated-done', status: done, assignee: 'QA', dueDate: '' },
  { id: 'mine-outside-done', status: done, assignee: 'QA', dueDate: '2026-12-01' }
].map(task => ({ ...task, title: task.id, priority: '中', pinned: false, updatedAt: 1, tags: [], comments: [] }));

function exercise(scope, filter, range) {
  const state = { scope, timelineRange: range, tasks: all };
  const elements = {
    searchInput: { value: '' }, statusFilter: { value: filter }, assigneeFilter: { value: '' },
    priorityFilter: { value: '' }, categoryFilter: { value: '' }, sortSelect: { value: 'updated' },
    pinOnly: { checked: false }, favoriteOnly: { checked: false },
    overdueOnly: { checked: false }, todayOnly: { checked: false },
    timelineView: { innerHTML: '', querySelectorAll: () => [], querySelector: () => null }
  };
  const base = new Date(2026, 9, 9);
  const context = {
    state, elements, selected: [], normalizeText: x => String(x || '').toLowerCase(),
    startOfToday: () => base, scopeHasMine: undefined, scopeHasDone: undefined,
    isCurrentUserOrGroupAssignee: x => x === 'QA', isCompletedStatus: x => x === done,
    isTaskStarred: () => false, isOverdue: () => false, dueScore: () => 0,
    compareSmartTasks: () => 0, PRIORITY_ORDER: { '中': 2 }, toDate: x => new Date(x),
    getTimelineStartDate: () => base, getTimelineDays: () => range === 'month' ? 31 : 14,
    addDays: (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n),
    toISODate: d => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'),
    dayKindClass: () => '', getJapaneseHolidayName: () => '', isTodayDate: () => false,
    escapeHtml: x => String(x), formatMonthDay: () => '10/9',
    getStatusList: () => [open, done], timelineTask: t => '<article data-task-id="' + t.id + '"></article>',
    bindTaskDragSources() {}, bindTimelineTaskDrops() {},
    normalizeUser: x => x, userColor: () => '#fff'
  };
  runInNewContext(functions + '\nselected = getFilteredTasks().map(x => x.id); renderTimeline(getFilteredTasks());', context);
  return { selected: [...context.selected], html: elements.timelineView.innerHTML };
}
for (const range of ['14', 'month']) {
  for (const scope of ['all', 'mine', 'done', 'mineDone']) {
    for (const filter of ['', done, open]) {
      test('timeline filtered rows agree with task query: ' + range + '/' + scope + '/' + (filter || 'all'), () => {
        const { selected, html } = exercise(scope, filter, range);
        const completed = scope === 'done' || scope === 'mineDone' || filter === done;
        const rows = [...html.matchAll(/class="timeline-row-label">([^<]+)/g)].map(x => x[1]);
        assert.deepEqual(rows, [completed ? done : open]);
        const visible = [...html.matchAll(/class="timeline-cell[^"]*"[^>]*>([\s\S]*?)<\/div>/g)]
          .flatMap(x => [...x[1].matchAll(/data-task-id="([^"]+)"/g)].map(m => m[1]));
        assert.deepEqual(visible, selected.filter(id => all.find(t => t.id === id).dueDate === '2026-10-09'));
        const undated = html.split('class="timeline-undated-list"')[1] || '';
        assert.equal(undated.includes('data-task-id="mine-undated-done"'), selected.includes('mine-undated-done'));
        assert.equal(html.includes('data-task-id="mine-outside-done"'), false);
      });
    }
  }
}
test('timeline completion contract shares board canonical predicate', () => {
  const board = extract('renderBoard');
  const timeline = extract('renderTimeline');
  const predicate = 'scopeHasDone() || isCompletedStatus(elements.statusFilter.value)';
  assert.ok(board.includes(predicate));
  assert.ok(timeline.includes(predicate));
  assert.ok(!timeline.includes('state.scope === "done"'));
});
