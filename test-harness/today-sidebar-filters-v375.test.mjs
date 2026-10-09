import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const from = app.indexOf('function renderTodayView() {');
const to = app.indexOf('function renderTodayTodoPreview() {', from);
assert.ok(from !== -1 && to > from, 'Today canonical renderer source required');
const renderer = app.slice(from, to);
const task = (id, assignee, category) => ({
  id, title: id, status: '未着手', assignee, category, dueDate: '2026-10-09'
});
const schedule = (id, assignee, category) => ({
  id, title: id, assignee, category, startAt: '2026-10-09T10:00:00'
});

function exercise({ mine = false, assignee = '', category = '' } = {}) {
  const view = { innerHTML: '', handlers: {}, querySelector(selector) {
    if (selector === '[data-today-filter-clear-v375]') {
      return { addEventListener: (event, callback) => { this.handlers[event] = callback; } };
    }
    return null;
  }, querySelectorAll: () => [] };
  let resetCount = 0;
  const elements = {
    todayView: view,
    assigneeFilter: { value: assignee }, categoryFilter: { value: category },
    resetFilters: { click() { resetCount++; } }
  };
  const ctx = {
    state: { tasks: [task('mine-pc', 'QA375', 'PC'),task('peer-other', 'Peer375', 'other'),task('mine-other', 'QA375', 'other')],
      schedules: [schedule('mine-pc-meeting','QA375','PC'),schedule('peer-other-meeting','Peer375','other'),schedule('mine-other-meeting','QA375','other')] },
    elements, Date,
    startOfToday: () => new Date('2026-10-09T00:00:00'), todayISO: () => '2026-10-09',
    isCompletedStatus: s => s === 'done', normalizeText: s => String(s ?? ''),
    scopeHasMine: () => mine, isCurrentUserOrGroupAssignee: name => name === 'QA375',
    scheduleLocalDate: s => s.startAt.slice(0,10),isOverdue: () => false,
    isDueToday: t => t.dueDate === '2026-10-09',isUnsortedTask: () => false, compareSmartTasks:()=>0,
    taskCard: t => `<article data-fixture-task="${t.id}"></article>`,
    scheduleCard: s => `<article data-fixture-schedule="${s.id}"></article>`,
    renderActivityPanel: () => '<section data-fixture-notifications></section>',
    renderTodayTodoPreview: () => '<section data-fixture-todo></section>',
    todayPanel: (title, body) => `<section data-fixture-panel="${title}">${body}</section>`,
    todayEmpty: (title, desc) => `<aside data-fixture-empty>${title}: ${desc}</aside>`,
    bindTaskCards() {}, bindScheduleCardsInRoot() {}, bindActivityPanel() {},
    bindTodayTodoPreview() {}, openTaskDialog() {}, openScheduleDialog() {},
    escapeHtml: v => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))
  };
  runInNewContext(renderer + '\nrenderTodayView();',ctx);
  return {
    taskIds: [...view.innerHTML.matchAll(/data-fixture-task="([^"]+)/g)].map(m=>m[1]),
    scheduleIds: [...view.innerHTML.matchAll(/data-fixture-schedule="([^"]+)/g)].map(m=>m[1]),
    html: view.innerHTML, clickClear: () => { assert.ok(view.handlers.click,'clear event bound'); view.handlers.click(); },
    resetCount: () => resetCount
  };
}

const cases = [
  ['default',{},['mine-pc','peer-other','mine-other'],['mine-pc-meeting','peer-other-meeting','mine-other-meeting'],false],
  ['mine',{mine:true},['mine-pc','mine-other'],['mine-pc-meeting','mine-other-meeting'],true],
  ['assignee',{assignee:'QA375'},['mine-pc','mine-other'],['mine-pc-meeting','mine-other-meeting'],true],
  ['category',{category:'PC'},['mine-pc'],['mine-pc-meeting'],true],
  ['mine and category',{mine:true,category:'other'},['mine-other'],['mine-other-meeting'],true],
  ['assignee and category',{assignee:'Peer375',category:'PC'},[],[],true],
  ['all three',{mine:true,assignee:'QA375',category:'other'},['mine-other'],['mine-other-meeting'],true]
];
for (const [name,filters,expectedTasks,expectedSchedules,hasSummary] of cases) {
  test(`Ver.375 canonical Today source: ${name}`, () => {
    const result=exercise(filters);
    assert.deepEqual(result.taskIds,expectedTasks);
    assert.deepEqual(result.scheduleIds,expectedSchedules);
    assert.equal(result.html.includes('data-today-filter-summary-v375'),hasSummary);
    assert.ok(result.html.includes('data-fixture-notifications'));
    assert.ok(result.html.includes('data-fixture-todo'));
  });
}

test('Ver.375 active conditions are escaped; canonical sidebar reset is invoked', () => {
  const data=exercise({assignee:'<img src=x onerror=alert(1)>',category:'PC'});
  assert.ok(data.html.includes('&lt;img'));
  assert.ok(!data.html.includes('<img'));
  assert.ok(data.html.includes('data-today-filter-clear-v375'));
  data.clickClear();
  assert.equal(data.resetCount(),1);
});

test('Ver.375 empty panel does not claim there is no underlying data', () => {
  const empty=exercise({assignee:'Peer375',category:'PC'});
  assert.match(empty.html,/data-fixture-empty/);
  assert.match(empty.html,/\u8868\u793a\u6761\u4ef6\u306b\u8a72\u5f53/);
  assert.ok(!empty.html.includes('<img'));
  const all=exercise();
  assert.doesNotMatch(all.html,/data-today-filter-clear-v375/);
});

test('Ver.375 isolation: only Today schedule/task panels changed', () => {
  assert.ok(app.includes('elements.todayView.querySelector("[data-today-filter-clear-v375]")?.addEventListener'));
  assert.ok(app.includes('.filter(matchesTodaySidebarFilters)'));
  assert.ok(app.includes('matchesTodaySidebarFilters(t)'));
  assert.ok(css.includes('.today-filter-summary-v375'));
  assert.equal((app.match(/function renderTodayView\(/g)||[]).length,1);
});
