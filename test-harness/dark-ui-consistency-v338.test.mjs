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

test('Ver.340 manifest and HTML use the matching release cache key', () => {
  const manifest = read('release-manifest.js');
  const html = read('index.html');
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  assert.match(manifest, /version: "340"/);
  assert.match(html, /app\.js\?v=340/);
  assert.equal(inventory.baselineRelease, '340');
});
