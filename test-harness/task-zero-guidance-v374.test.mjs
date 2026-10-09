import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function extractFunction(name) {
  const match = app.match(new RegExp(`function ${name}\\([^]*?\\n\\}`, 'm'));
  assert.ok(match, `${name} is missing`);
  return match[0];
}

function fixture({ scope = 'all', tasks = [{ id: 'one' }], values = {}, checked = {} } = {}) {
  const state = { scope, tasks };
  const elements = Object.fromEntries(['searchInput','assigneeFilter','statusFilter','priorityFilter','categoryFilter']
    .map(key => [key, { value: values[key] || '' }]));
  for (const name of ['overdueOnly','todayOnly','pinOnly','favoriteOnly']) elements[name] = { checked: Boolean(checked[name]) };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const context = { state, elements, escapeHtml: esc, scopeHasMine: () => scope === 'mine' || scope === 'mineDone', scopeHasDone: () => scope === 'done' || scope === 'mineDone' };
  const functions = ['taskZeroContextV374','renderTaskZeroGuideV374','bindTaskZeroActionsV374'].map(extractFunction).join('\n');
  runInNewContext(functions, context);
  return { html: context.renderTaskZeroGuideV374(), context };
}

test('Ver.374 initial empty data is clearly different from a filtered empty result', () => {
  const newBoard = fixture({ tasks: [] }).html;
  assert.match(newBoard, /まだタスクがありません/);
  assert.match(newBoard, /data-new-task-empty/);
  assert.doesNotMatch(newBoard, /data-task-zero-clear-v374/);
  const filtered = fixture({ values: { searchInput: 'not-in-any-task' } }).html;
  assert.match(filtered, /この条件に一致するタスクはありません/);
  assert.match(filtered, /検索「not-in-any-task」/);
  assert.match(filtered, /data-task-zero-clear-v374/);
  assert.doesNotMatch(filtered, /data-new-task-empty/);
});

test('Ver.374 shows combined completion and main filter labels, including optional flags', () => {
  const html = fixture({ scope:'mineDone', values: { statusFilter: '完了', assigneeFilter: 'QA374', priorityFilter:'高', categoryFilter:'その他' }, checked: { overdueOnly:true, todayOnly:true, pinOnly:true, favoriteOnly:true } }).html;
  for (const label of ['自分の担当','完了','状態: 完了','担当者: QA374','優先度: 高','分類: その他','期限超過のみ','今日のみ','固定のみ','スターのみ']) assert.ok(html.includes(label), label);
  const implicit = fixture().html;
  assert.match(implicit, /表示できる未完了タスクがありません/);
  assert.doesNotMatch(implicit, /data-task-zero-clear-v374/);
});

test('Ver.374 does not inject search text or leak full long search terms in rendered HTML', () => {
  const html = fixture({ values: { searchInput: '<img src=x onerror=alert(1)>' } }).html;
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
  const huge = fixture({ values: { searchInput:'x'.repeat(200) } }).html;
  assert.ok(!huge.includes('x'.repeat(70)));
  assert.match(huge, /…/);
});

test('Ver.374 clear uses the canonical sidebar reset event and new-task action only when applicable', () => {
  const { context } = fixture();
  let cleared = 0, opened = 0;
  context.elements.resetFilters = { click: () => cleared++ };
  context.openTaskDialog = () => opened++;
  const hooks = {};
  const container = { querySelector: selector => ({ addEventListener: (_, fn) => { hooks[selector] = fn; } }) };
  context.bindTaskZeroActionsV374(container);
  hooks['[data-task-zero-clear-v374]']();
  hooks['[data-new-task-empty]']();
  assert.equal(cleared,1);
  assert.equal(opened,1);
});

test('Ver.374 guide binds only for empty task views and stays outside Today/Todo and persistence', () => {
  assert.match(app, /elements\.boardView\.innerHTML = columns \+ addColumn;/);
  assert.match(app, /if \(!tasks\.length\) elements\.boardView\.insertAdjacentHTML\("afterbegin", renderTaskZeroGuideV374\(\)\);/);
  assert.match(app, /elements\.listView\.querySelector\("\[data-bulk-all\]"\)/);
  assert.match(app, /<tr class="task-zero-row-v374"><td colspan="9">\$\{renderTaskZeroGuideV374\(\)\}<\/td><\/tr>/);
  assert.equal((app.match(/function taskZeroContextV374\(/g) || []).length, 1);
  assert.equal((app.match(/function bindTaskZeroActionsV374\(/g) || []).length, 1);
  assert.match(css, /\.board-view \.task-zero-guide-v374/);
  assert.match(css, /\.task-table tr\.task-zero-row-v374 > td:first-child/);
  assert.ok(packageJson.scripts['test:protocol'].includes('test-harness/task-zero-guidance-v374.test.mjs'));
});
