import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Ver.338 uses one dark chip palette and a common completion control', () => {
  const css = read('color-themes-v329.css');
  const todo = read('ui-todo-light-v189.css');
  const controls = read('todo-controls-v144.js');
  assert.match(css, /--wb-dark-chip-fill:var\(--wb-dark-inset\)/);
  assert.match(css, /--wb-dark-complete-fill:color-mix/);
  assert.match(css, /body \.activity-panel :is\([\s\S]*?\.activity-title-main[\s\S]*?background: transparent !important/);
  for (const selector of ['.activity-count', '.activity-kind', '.todo-section-chip',
    '.todo-preview-badge', '.todo-memo-indicator', '.work-memo-category-v167',
    '.schedule-card .location-badge']) {
    assert.ok(css.includes(selector), 'missing neutral dark chip '+selector);
  }
  assert.match(todo, /\.todo-state-toggle-v144,\s*\.todo-preview-state-hint-v144\s*\{/);
  assert.match(todo, /\.todo-state-toggle-v144\.is-completed,\s*\.todo-preview-state-hint-v144\.is-completed/);
  assert.match(controls, /hint\.classList\.toggle\('is-completed', Boolean\(input\.checked\)\)/);
  assert.doesNotMatch(css, /background: #254438 !important/);
});

test('Ver.338 reuses the actual draggable item as the browser drag image', () => {
  const app = read('app.js');
  const memo = read('work-features-v167.js');
  assert.match(app, /window\.WORK_BOARD_SET_SORT_DRAG_PREVIEW_V338 = setSortDragPreviewV338/);
  assert.match(app, /transfer\.setDragImage\(source, x, y\)/);
  assert.match(app, /setSortDragPreviewV338\(event, row\)/);
  assert.match(app, /setSortDragPreviewV338\(event, panel\)/);
  assert.match(app, /setSortDragPreviewV338\(event, source\)/);
  assert.match(memo, /WORK_BOARD_SET_SORT_DRAG_PREVIEW_V338\?\.\(event, card\)/);
  assert.doesNotMatch(app, /setDragImage\(source, Math\.min\(80, source\.offsetWidth/);
  assert.match(app, /bindTodoDragListV531\(list, segment\)/);
  assert.match(memo, /moveMemoV531\(source, target\.dataset\.memoSortId, after\)/);
});

test('Ver.339 quiet connection and notification status colours preserve semantics', () => {
  const css=read('color-themes-v329.css');
  for(const selector of ['.sidebar .connection-pill','.connection-pill.remote-online',
    '.connection-pill.remote-degraded','.notification-status.granted',
    '.notification-status.denied']) {
    assert.ok(css.includes(selector),'missing dark status selector '+selector);
  }
  assert.match(css,/--wb-dark-complete-ink/);
  assert.match(css,/\.notification-status \{[\s\S]*?--wb-dark-chip-fill/);
});

test('Ver.349 manifest and HTML use the matching release cache key', () => {
  const manifest = read('release-manifest.js');
  const html = read('index.html');
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  const release = manifest.match(/version:\s*"(\d+)"/)?.[1];
  assert.ok(Number(release) >= 349, 'dark theme contract remains in supported releases');
  assert.match(html, new RegExp('app\\.js\\?v=' + release + '(?:["&])'));
  assert.equal(inventory.baselineRelease, release);
});

test('Ver.341 dark semantics cover real category/priority badges and task detail counter surfaces', () => {
  const css = read('color-themes-v329.css');
  const app = read('app.js');
  assert.match(app, /class="badge status-未着手 category-badge"/);
  for (const selector of [
    '.badge:is(', '.category-badge', '.priority-緊急', '.priority-高',
    '.priority-中', '.priority-低', '.status-未着手', '.status-対応中',
    '.status-確認待ち', '.status-保留', '.status-完了',
    '.due-today-badge', '.overdue-badge', '.stale-badge',
    '.recurrence-badge', '.favorite-button',
    '.detail-status-control-v146', '.detail-status-label-v146 strong',
    '.task-detail-tab-v149 > span', '.task-detail-tab-v149.active > span'
  ]) {
    assert.ok(css.includes(selector), 'missing dark semantic surface: ' + selector);
  }
  assert.match(css, /--wb-dark-tone-warning-bg:color-mix/);
  assert.match(css, /--wb-dark-state-overdue:color-mix/);
  assert.doesNotMatch(css, /background:\s*#fff6cf\s*!important/);
});
