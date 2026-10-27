import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const manifest = read('release-manifest.js');
const html = read('index.html');
const css = read('ui-design-d3l-v535.css');
const js = read('ui-preferences-v536.js');
const app = read('app.js');

test('Ver.536 appearance assets are owned and loaded once, classic stays default', () => {
  const group = JSON.parse(read('patch-responsibilities.json')).groups;
  assert.equal(group.filter(g => g.assets.includes('ui-design-d3l-v535.css')).length, 1);
  assert.equal(group.filter(g => g.assets.includes('ui-preferences-v536.js')).length, 1);
  assert.equal((manifest.match(/"ui-preferences-v536\.js"/g) || []).length, 2);
  assert.equal((manifest.match(/"ui-design-d3l-v535\.css"/g) || []).length, 2);
  assert.match(html, /name="wbPreferenceDesign" value="classic" checked/);
  assert.match(html, /name="wbPreferenceDesign" value="signal"/);
  assert.match(js, /validDesign = new Set\(\['classic', 'signal'\]\)/);
  assert.match(js, /design: validDesign\.has\(raw\?\.design\) \? raw\.design : 'classic'/);
  assert.match(js, /document\.body\.dataset\.wbDesign = selected\.design/);
  assert.doesNotMatch(css, /(?:^|\n)\s*\.sidebar\s*\{/);
  assert.match(css, /body\[data-wb-design="signal"\]/);
  assert.match(css, /body\[data-wb-design="signal"\]\[data-wb-tone="midnight"\]/);
  assert.doesNotMatch(js, /(?:getDatabase\(|fetch\(|XMLHttpRequest|WebSocket|setInterval)/i);
  assert.doesNotThrow(() => new Function(js));
});

test('Ver.536 preferences are scoped by room and user without schema migration', () => {
  assert.match(js, /work-board-appearance-v536:/);
  assert.match(js, /systemTaskRoomId/);
  assert.match(js, /systemTaskUser/);
  assert.match(js, /encodeURIComponent\(currentRoom\(\)\)/);
  assert.match(js, /encodeURIComponent\(currentUser\(\)\)/);
  assert.match(js, /localStorage\.setItem\(storageKey\(\)/);
  assert.match(js, /root\.addEventListener\('change'/);
  assert.match(js, /roomSource\.dispatchEvent\(new Event\('input'/);
  for (const id of ['manageUsers', 'manageStatuses', 'manageCategories']) {
    assert.match(html, new RegExp('data-wb-existing-setting="' + id + '"'));
  }
});

test('Ver.536 keeps canonical ToDo entry, ordering, schedule modes, and visual icon assets', () => {
  const start = app.indexOf('function renderTodoView()');
  const end = app.indexOf('function bindTodoWorkspace', start);
  assert.ok(start > 0 && end > start);
  const todo = app.slice(start, end);
  assert.ok(todo.indexOf('data-todo-form') < todo.indexOf('data-todo-lists'),
    'ToDo creation must remain above existing list');
  assert.match(app, /enableTodayPanelOrderingV531\(elements\.todayView\)/);
  assert.match(app, /data-schedule-mode="calendar">月カレンダー/);
  assert.match(app, /renderScheduleCalendar\(schedules\)/);
  assert.match(app, /data-schedule-mode="list">一覧/);
  assert.match(css, /schedule-calendar/);
  assert.match(css, /nav-icon img[^\{]*\{filter:none !important/);
  assert.doesNotMatch(css, /grid-template-areas|data-today-panel-key[^{}]*order\s*:/);
});

test('Ver.536 settings dialog is reachable and does not duplicate existing configuration controls', () => {
  assert.match(html, /id="wbOpenSettings"/);
  assert.match(html, /id="wbSettingsDialog"/);
  assert.match(html, /id="wbSettingsRoomName"/);
  assert.match(html, /name="wbPreferenceTone" value="bright" checked/);
  assert.match(html, /name="wbPreferenceTone" value="midnight"/);
  assert.match(js, /toneGroup\.disabled = selected\.design !== 'signal'/);
  assert.match(js, /existing\.click\(\)/);
  assert.match(js, /workboard:appearance-changed/);
  const segment = html.slice(html.indexOf('id="wbSettingsDialog"'), html.indexOf('<dialog id="statusManageDialog"'));
  assert.doesNotMatch(segment, /id="newStatusName"/);
});

test('Ver.536 登録済みメモとクイック追加の色補正をミッドナイトだけに限定する', () => {
  // 宣言の存在だけでなく、対象セレクターを含む同じ規則の色指定を検証する。
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const scope = 'body[data-wb-design="signal"][data-wb-tone="midnight"]';
  const ruleFor = suffix => {
    const selector = `${scope} ${suffix}`;
    const matches = rules.filter(rule => rule[1].split(',').map(value => value.trim()).includes(selector));
    assert.equal(matches.length, 1, selector);
    return matches[0][2];
  };
  const quickAdd = ruleFor('.main #quickAddInput');
  assert.match(quickAdd, /background:\s*var\(--signal-subtle\)\s*!important/);
  assert.match(quickAdd, /color:\s*var\(--signal-text\)\s*!important/);
  assert.match(quickAdd, /border-color:\s*var\(--signal-border\)\s*!important/);
  assert.match(ruleFor('.work-memo-card-head-v167 h4'), /color:\s*var\(--signal-text\)\s*!important/);
});
