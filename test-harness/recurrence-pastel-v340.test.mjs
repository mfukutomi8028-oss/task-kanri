import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const PASTELS=['pastel-blue','pastel-lilac','pastel-mint','pastel-rose','pastel-peach','pastel-lemon'];
function contrast(first,second) {
  const luminance = hex => [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
    .map(c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4))
    .reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
  const a=luminance(first),b=luminance(second);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}

test('Ver.343 recurrence generation keeps the deadline optional and carries it forward',()=>{
  const app=read('app.js'),html=read('index.html');
  assert.doesNotMatch(app,/繰り返しを設定するには期限日を入力してください/);
  assert.match(app,/function nextRecurringChild\(parent\)/);
  assert.match(app,/getRecurringDates\(parent.recurrence, rule, afterDate, 1\)/);
  assert.match(app,/function nextRecurringDeadline\(parent, rule, repeatDate\)/);
  assert.match(app,/const dueDate = nextRecurringDeadline\(parent, rule, repeatDate\)/);
  assert.match(app,/dueTime: dueDate \? String\(parent\.dueTime \|\| ""\) : ""/);
  assert.match(app,/recurrenceRule: \{ \.\.\.rule, seriesId: rule.seriesId \|\| parent.id, occurrenceDate: repeatDate \}/);
  assert.match(app,/if \(child && \(child.recurringParentId !== original.id/);
  assert.doesNotMatch(app,/function maybeCreateNextRecurringTask\(/);
  assert.doesNotMatch(app,/function getRecurringDueDates\(/);
  assert.doesNotMatch(app,/applyRecurrenceDefaultsFromDueDate/);
  assert.match(html,/id="taskRecurrenceAnchorDate"/);
  assert.match(html,/完了時に次回のタスクを作成します/);
  assert.doesNotMatch(html,/期限日とは独立しており/);
  assert.doesNotMatch(app,/期限日は別設定/);
  assert.match(app,/function getRecurringDates\(recurrence, rule = \{\}, afterDate = todayISO\(\), count = 1\)/);
});

test('Ver.340 six pastel light palettes have usable text contrast',()=>{
  const css=read('color-themes-v329.css'),js=read('color-themes-v329.js');
  for(const id of PASTELS){
    assert.equal(js.split("id: '"+id+"'").length-1,1,id+' JS owner');
    assert.match(js,new RegExp("id: '"+id+"', label: '[^']+', group: 'pastel'"));
    const matched=css.match(new RegExp(':root\\[data-wb-color-theme="'+id+'"\\][^\\{]*\\{([^}]+)\\}'));
    assert.ok(matched,id+' CSS owner');
    const value=name=>matched[1].match(new RegExp('--wb-theme-'+name+':(#[0-9a-fA-F]{6});'))?.[1];
    for(const name of ['page','surface','surface-soft','sidebar-a','sidebar-b','sidebar-c',
      'hero-a','hero-b','ink','muted','accent','highlight-ink','highlight-a','highlight-b','line']) {
      assert.ok(value(name),id+' missing '+name);
    }
    for(const surface of ['sidebar-a','sidebar-c','hero-a','hero-b']){
      assert.ok(contrast(value('ink'),value(surface))>=4.5,id+' '+surface+' contrast');
    }
    assert.ok(contrast(value('muted'),value('page'))>=4.5,id+' muted contrast');
    assert.ok(contrast(value('highlight-ink'),value('highlight-b'))>=4.5,id+' action contrast');
  }
  assert.match(js,/\['pastel','パステルテーマ'\]/);
  assert.match(js,/groups\.get\(theme\.group \|\| theme\.mode \|\| 'light'\)/);
  assert.match(css,/data-wb-color-theme\^="pastel-".*\.hero/);
  assert.match(css,/color:var\(--wb-theme-ink\) !important;/);
  assert.match(js,/const STORAGE_PREFIX = 'workBoardColorThemeV329:'/);
});

test('Ver.340 version and handoff are synchronized',()=>{
  const manifest=read('release-manifest.js'),html=read('index.html');
  assert.match(manifest,/version: "346"/);
  assert.match(html,/app\.js\?v=346/);
  assert.equal(JSON.parse(read('patch-responsibilities.json')).baselineRelease,'346');
});

test('Ver.342 light section headers inherit their theme hue and pastel gradients stay light', () => {
  const css=read('color-themes-v329.css');
  const own='html[data-wb-color-mode="light"][data-wb-color-theme]:not([data-wb-color-theme="default"])';
  assert.ok(css.includes(own));
  for(const selector of [
    '.activity-panel .activity-head','.today-panel .today-panel-sort-head-v531',
    '.today-panel > h4','.today-todo-preview','.board-column > .column-head',
    '.schedule-head','.work-memo-head-v167','.list-column-sort-status'
  ]) assert.ok(css.includes(selector), 'missing theme-owned heading: '+selector);
  assert.match(css,/--wb-theme-section-gradient:linear-gradient/);
  assert.match(css,/--wb-theme-section-panel:linear-gradient/);
  assert.match(css,/data-wb-color-theme\^="pastel-"\] body \.sidebar/);
  assert.match(css,/data-wb-color-theme\^="pastel-"\] body \.hero/);
  assert.match(css,/\.wb-color-theme-option\[data-theme\^="pastel-"\] \.wb-color-theme-preview-sidebar/);
});

test('Ver.343 recurrence grid gives the calendar priority over numeric fields', () => {
  const css=read('style.css'),html=read('index.html');
  assert.match(css,/grid-template-columns: minmax\(280px, 330px\) 106px minmax\(260px, 320px\)/);
  assert.match(css,/@container \(max-width: 720px\)/);
  assert.match(css,/\.recurrence-grid > #monthlyDayOptions/);
  assert.match(css,/\.recurrence-grid > \[hidden\]/);
  assert.match(html,/class="recurrence-anchor-field"/);
  assert.match(html,/class="recurrence-interval-field"/);
  assert.doesNotMatch(html,/taskRecurrenceAnchorHelp/);
});

test('Ver.345 pastel gradients never use black shadow sources and pin labels are themed', () => {
  const css=read('color-themes-v329.css');
  const start=css.indexOf('/* Ver.345: the six pastels');
  const end=css.indexOf('/* Local preference controls:',start);
  assert.ok(start>=0 && end>start, 'one canonical pastel surface owner');
  const section=css.slice(start,end);
  for (const name of ['--wb-pastel-sidebar-start:#ffffff','--wb-pastel-hero-start:#ffffff',
    '--wb-pastel-sidebar-end:color-mix(in srgb,#ffffff 48%',
    '--wb-pastel-hero-end:color-mix(in srgb,#ffffff 52%',
    '.desktop-sidebar-pin-v158', '.desktop-sidebar-pin-label-v158',
    '.hero .hero-room-badge', '.desktop-sidebar-expanded,.desktop-sidebar-pinned']) {
    assert.ok(section.includes(name),'missing pastel contract: '+name);
  }
  for (const forbidden of ['rgba(0,0,0', 'rgba(7,31,45', 'rgba(8,48,75']) {
    assert.ok(!section.includes(forbidden),'pastel owner contains dark legacy shadow: '+forbidden);
  }
  assert.ok(section.includes('background:var(--wb-pastel-hero-gradient) !important'));
  assert.ok(section.includes('box-shadow:0 3px 12px var(--wb-pastel-soft-shadow)'));
  assert.ok(section.includes('color:var(--wb-theme-ink) !important'));
});

test('Ver.346 recurrence preview uses native expandable dates and legible labels',()=>{
  const app=read('app.js'),html=read('index.html'),css=read('style.css');
  assert.ok(app.includes('document.createElement("details")'));
  assert.ok(app.includes('more.className = "recurrence-preview-more"'));
  assert.ok(app.includes('preview.replaceChildren(...nodes)'));
  assert.ok(html.includes('id="recurrencePreview" class="recurrence-preview" aria-live="polite"'));
  assert.ok(css.includes('.recurrence-preview-more[open]'));
  assert.match(css,/font-size: 16px;\n  font-weight: 800;\n}\n\n.weekly-options/);
  assert.match(css,/font-size: 14px;\n  line-height: 1.4;\n  font-weight: 900;/);
});
test('Ver.346 light-only theme tokens cover nonsemantic detail/editor/schedule surfaces',()=>{
  const css=read('color-themes-v329.css');
  const marker=css.indexOf('/* Ver.346: non-semantic surfaces');
  const end=css.indexOf('/* Ver.345: the six pastels',marker);
  assert.ok(marker>0 && end>marker);
  const chunk=css.slice(marker,end);
  for(const selector of ['#detailBody .field-card','#detailBody .check-item:not(.done)',
    '#detailBody .task-detail-tabs-v149','#detailBody .task-comment-compose-v149',
    '#taskDialog .recurrence-options','#taskDialog .date-segment-control-v127',
    '#scheduleCopyDialog .schedule-copy-preview','#taskDialog .task-dialog-view-tab-v319.active',
    '.workflow-mention-dialog-v156']) {
    assert.ok(chunk.includes(selector),'not themed: '+selector);
  }
  assert.ok(chunk.includes('data-wb-color-mode="light"'));
  assert.ok(chunk.includes(':not([data-wb-color-theme="default"])'));
  assert.ok(!chunk.includes('.priority-緊急'));
});
