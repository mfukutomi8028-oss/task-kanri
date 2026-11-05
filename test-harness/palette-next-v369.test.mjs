import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const manifest=read('release-manifest.js');
const css=read('palette-next-v369.css');
const shell=read('palette-next-v369.js');
const memo=read('work-features-v167.js');
const app=read('app.js');
const mode=read('modern-display-v356.js');
const responsibilities=JSON.parse(read('patch-responsibilities.json'));

test('Palette opens independent NEXT without a fifth choice or separate preview link',()=>{
  const activeStyles=manifest.match(/dynamicStyles:\s*\[([^\]]+)\]/)?.[1]||'';
  const activeScripts=manifest.match(/dynamicScripts:\s*\[([^\]]+)\]/)?.[1]||'';
  assert.match(activeStyles,/palette-display-v358\.css/);
  assert.match(activeScripts,/palette-display-v358\.js/);
  assert.match(manifest,/palette-next-v369\.css/);
  assert.match(mode,/new Set\(\['classic', 'modern', 'palette', 'journal'\]\)/);
  assert.match(mode,/if \(next === 'palette'\) loadPaletteNext\(\)/);
  assert.doesNotMatch(mode,/wbPaletteNextPreviewV369/);
  assert.match(shell,/dataset\.wbDisplay === 'palette'/);
  assert.doesNotMatch(shell,/\['preview','Palette NEXT'\]/);
  assert.ok(Number(responsibilities.baselineRelease) >= 369);
});

test('Palette NEXT owns its independent DOM and uses only the canonical bridge',()=>{
  assert.match(shell,/id = 'paletteNextRoot'/);
  assert.match(shell,/document\.body\.appendChild\(root\)/);
  assert.match(shell,/WorkBoardPaletteBridge/);
  assert.match(shell,/bridge\.subscribe/);
  assert.doesNotMatch(shell,/\.sidebar\b|\.nav-item\b|#todayView|#todoView|\.today-grid|#scheduleDialog/);
  assert.doesNotMatch(shell,/runTransaction|firebase|document\.write/);
  assert.match(css,/#paletteNextRoot/);
  assert.match(css,/data-wb-palette-next-preview="true"/);
  assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
});

test('Palette NEXT dispatch uses canonical business writers and exposes read-only snapshots',()=>{
  const start=app.indexOf('/* Palette NEXT Phase 1');
  const end=app.indexOf('// v31: すべての定義が完了してから初期化する',start);
  assert.ok(start>0&&end>start);
  const bridge=app.slice(start,end);
  for (const action of ['createTodo','toggleTodo','updateTodoDetails','deleteTodo',
    'reorderTodo','completeTaskWithMemo','changeStatus','toggleTaskFavorite']) {
    assert.match(bridge,new RegExp('\\b'+action+'\\('));
  }
  assert.match(bridge,/readSnapshot: paletteNextSnapshot/);
  assert.match(bridge,/paletteNextSubscribers\.add\(listener\)/);
  assert.match(app,/notifyPaletteNextSubscribers\(\);\s*\n\}/);
  assert.doesNotMatch(bridge,/runTransaction|set\(ref\(|update\(ref\(|remove\(ref\(|onValue\(/);
});

test('Palette NEXT preserves current Classic and Modern runtime files for rollback',()=>{
  assert.ok(read('palette-display-v358.css').length>100);
  assert.ok(read('palette-display-v358.js').length>100);
  assert.ok(read('modern-display-v356.css').length>100);
  assert.ok(read('journal-display-v367.js').length>100);
  assert.ok(Number(manifest.match(/version: "(\d+)"/)?.[1] || 0) >= 369);
});

test('Palette NEXT live memo feed uses existing memo-owner subscriptions',()=>{
  const memo=read('work-features-v167.js');
  assert.match(memo,/WorkBoardPaletteMemoBridgeV369/);
  assert.match(memo,/memoList\(\{ ignoreFilters: true \}\)/);
  assert.match(memo,/notifyPaletteMemoPreview\(\)/);
  assert.match(shell,/memoBridge\?\.subscribe\?\./);
  assert.doesNotMatch(shell,/runTransaction|initializeApp|getDatabase|onValue\(/);
});
test('Palette NEXT has a safe canonical multi-action boundary',()=>{
  assert.match(mode,/loadPaletteNext\(\)/);
  assert.match(app,/case 'task.bulk.update':/);
  assert.match(app,/action: command\.type === 'task.bulk.complete'/);
  assert.match(shell,/data-pn-bulk-id/);
  assert.match(shell,/data-pn-bulk-all/);
  assert.match(shell,/data-pn-bulk-apply/);
  assert.match(shell,/bulkSelectedEntries\(\)/);
  assert.match(shell,/revision-or-relation-mismatch/);
  assert.doesNotMatch(shell,/\.click\(\).*#listView/);
});

test('Ver.371 task editor uses the same canonical revision-safe task writers',()=>{
  const source=app.slice(app.indexOf('// Palette NEXT shares the canonical business writers'),
    app.indexOf('window.WorkBoardPaletteBridge = Object.freeze'));
  assert.match(source,/savePaletteNextTaskV370/);
  assert.match(source,/commitTaskDraft\('task-form', existing, draft\)/);
  assert.match(source,/persistTask\(draft\)/);
  assert.match(source,/makeTaskChangeInfo\(existing, draft\)/);
  assert.match(source,/normalizeTask\(/);
  assert.match(source,/revision-or-relation-mismatch/);
  assert.doesNotMatch(source,/runTransaction|set\(ref|update\(ref|initializeApp/);
  assert.match(app,/case 'task.create':/);
  assert.match(app,/case 'task.update':/);
  assert.match(shell,/data-pn-form="task-editor"/);
  assert.match(shell,/state\.editor/);
});

test('Ver.371 memo editor shares the Classic memo validator and CAS repository',()=>{
  const memo=read('work-features-v167.js');
  assert.match(memo,/async function saveMemoValuesV370/);
  assert.match(memo,/const result = await saveMemoValuesV370\(/);
  assert.match(memo,/const ok = await commitMemo\(draft, expectedRevision\)/);
  assert.match(memo,/case 'memo.create':/);
  assert.match(memo,/case 'memo.update':/);
  assert.match(memo,/case 'memo.pin':/);
  assert.match(memo,/case 'memo.delete':/);
  assert.match(shell,/data-pn-form="memo-editor"/);
  assert.match(shell,/memoBridge\?\.dispatch\?\./);
  assert.match(css,/html\[data-wb-palette-next-preview="true"\] body \.app-shell:not\(#paletteNextRoot\)/);
});

test('Ver.377 schedule view uses canonical draft, copy generator and persistence without duplicate Firebase code',()=>{
  assert.match(app,/function buildScheduleDraftFromValuesV372\(/);
  assert.match(app,/return buildScheduleDraftFromValuesV372\(/);
  const start=app.indexOf('// Palette NEXT schedule adapter');
  const end=app.indexOf('// Palette NEXT shares the canonical business writers',start);
  assert.ok(start>0 && end>start);
  const adapter=app.slice(start,end);
  for(const fn of [
    'buildScheduleDraftFromValuesV372','buildScheduleCopyDates',
    'scheduleCopyConflicts','copyScheduleOccurrences','persistSchedule',
    'getScheduleConflicts','makeScheduleChangeInfo'
  ]) assert.match(adapter,new RegExp('\\b'+fn+'\\('));
  for(const action of ['schedule.create','schedule.update','schedule.preview-copy',
    'schedule.preview-batch','schedule.copy','schedule.batch','schedule.delete'])
    assert.match(app,new RegExp("case '"+action.replaceAll('.','\\.')+"':"));
  assert.doesNotMatch(adapter,/runTransaction\(|set\(ref\(|update\(ref\(|initializeApp\(/);
  assert.match(app,/isRecurringDeleteCandidate\('schedule',existing\)/);
  assert.match(app,/result = await deleteSchedule\(id,revision\)/);
  assert.match(shell,/data-pn-form="schedule-editor"/);
  assert.match(shell,/data-pn-form="schedule-copy"/);
  assert.match(shell,/data-pn-copy-preview/);
  assert.match(css,/#paletteNextRoot \.pn-calendar-toolbar/);
  // The schedule contract debuted in 377; subsequent UI releases must retain it.
  const publishedVersion = Number(manifest.match(/version: "(\d+)"/)?.[1] || 0);
  assert.ok(publishedVersion >= 377);
  assert.equal(Number(responsibilities.baselineRelease), publishedVersion);
});

test('Palette visual ownership is a single editorial token system across five routes',()=>{
  for(const signature of [
    'const iconPaths', 'function todayPage()', 'function todoPage()',
    'function taskPage()', 'function schedulePage()', 'function memoPage()',
    'pn-home-grid', 'pn-todo-overview', 'pn-task-sheet', 'pn-schedule-sheet',
    'pn-memo-number'
  ]) assert.ok(shell.includes(signature),'Missing Palette visual landmark: '+signature);
  for(const selector of [
    '#paletteNextRoot .pn-hero', '#paletteNextRoot .pn-pagehead',
    '#paletteNextRoot .pn-memotile', '#paletteNextRoot .pn-detail',
    '#paletteNextRoot .pn-schedule-sheet', '#paletteNextRoot .pn-bulkbar',
    '#paletteNextRoot .pn-mobile-nav'
  ]) assert.ok(css.includes(selector),'Missing self-contained Palette CSS: '+selector);
  assert.match(css,/--pn-paper:/);
  assert.match(css,/\.wb-pn\[data-theme="dark"\]/);
  assert.match(css,/@media\(max-width:780px\)/);
  assert.doesNotMatch(shell,/pn-preview-label/);
  assert.doesNotMatch(shell,/pn-preview-back/);
  assert.doesNotMatch(shell,/runTransaction|getDatabase|set\(ref\(/);
});

test('Palette user-selected memo paper colors reuse canonical six-color memo schema',()=>{
  assert.match(memo,/MEMO_PAPER_COLORS = Object\.freeze/);
  assert.match(memo,/MEMO_PAPER_COLORS\.includes\(proposedPaperColor\)/);
  assert.match(memo,/paperColor: MEMO_PAPER_COLORS\.includes\(memo\.paperColor\)/);
  assert.match(shell,/const memoColors = Object\.freeze/);
  assert.match(shell,/name="paperColor"/);
  assert.match(shell,/command\.paperColor=memoPaperColor\(values\.get\('paperColor'\)\)/);
  assert.match(shell,/data-paper-color/);
  assert.match(shell,/data-pn-memo-filter/);
  assert.match(css,/\.pn-memotile\[data-paper-color="mint"\]/);
  assert.match(css,/\.pn-memotile\[data-paper-color="lavender"\]/);
  assert.doesNotMatch(css,/\.pn-memotile:nth-child/);
  assert.doesNotMatch(shell,/runTransaction|firebase\/database|localStorage\.setItem/);
});

test('Palette topbar creates ToDo, task, schedule and memo without copy-paste dialogs',()=>{
  assert.match(shell,/id="pnQuickCreateMenu"/);
  for(const type of ['todo','task','schedule','memo']){
    assert.match(shell,new RegExp("data-pn-quick-create"));
    assert.match(shell,new RegExp("kind==='"+type+"'|\\['todo','ToDo'|\\['"+type+"','"));
  }
  assert.match(shell,/openEditor\(kind,'',quickCreateTrigger\)/);
  assert.match(shell,/state\.route='todos'/);
  assert.doesNotMatch(shell,/＋ ToDo<\/button>/);
  assert.doesNotMatch(shell,/必要なことを見渡して、ひとつずつ心地よく進める場所/);
  assert.doesNotMatch(shell,/<p>'\+escape\(description\)/);
});

test('Palette schedule uses compact day actions and advisory overlaps without a second writer',()=>{
 assert.match(shell,/function syncScheduleOverlap\(form\)/);
 assert.match(shell,/data-pn-day-step/);
 assert.match(shell,/data-pn-duration/);
 assert.match(shell,/pnScheduleOverlap/);
 assert.match(shell,/same assignee|同じ担当者/);
 assert.match(css,/\.pn-day-actions/);
 assert.match(css,/\.pn-duration-row/);
 assert.doesNotMatch(shell,/runTransaction\(|firebase\/database/);
});
test('Palette memo detail changes the existing paper color through canonical revision checked writer',()=>{
 assert.match(shell,/async function changeMemoColor\(id,color,button\)/);
 assert.match(shell,/type:'memo.update',id:memo.id,revision:Number\(memo.revision\)/);
 assert.match(shell,/data-pn-memo-color/);
 assert.match(shell,/keepDetail:true/);
 assert.match(css,/\.pn-memo-quick-swatch\[aria-pressed="true"\]/);
 assert.match(shell,/data-pn-cancel/);
 assert.match(css,/\.pn-checkmark/);
});

test('Palette schedule details and list offer canonical linked-task navigation',()=>{
 assert.match(shell,/function scheduleMatches\(item\)/);
 assert.match(shell,/data-pn-linked-task/);
 assert.match(shell,/data-pn-related-back/);
 assert.match(shell,/data-pn-plan-task/);
 assert.match(shell,/state\.detailReturn/);
 assert.match(shell,/function filterScheduleTaskChoices\(form\)/);
 assert.match(shell,/name="relatedTaskId"/);
 assert.match(css,/\.pn-schedule-content/);
 assert.match(css,/\.pn-schedule-related/);
 assert.match(css,/\.pn-related-field/);
 assert.match(css,/\.pn-detail-nav/);
 assert.match(app,/case 'schedule\.create':/);
 assert.match(app,/case 'schedule\.update':/);
 assert.doesNotMatch(shell,/runTransaction\(|getDatabase\(|set\(ref\(|localStorage\.setItem/);
});


test('Palette account switch delegates only to the canonical existing user selector',()=>{
 const start=app.indexOf('window.WorkBoardPaletteBridge = Object.freeze({');
 const end=app.indexOf('// Modern origin. reuses',start);
 const boundary=app.slice(start,end);
 assert.ok(start>0&&end>start);
 assert.match(boundary,/selectUser\(value\)/);
 assert.match(boundary,/state\.users\.includes\(next\)/);
 assert.match(boundary,/if \(next !== previous\) setCurrentUser\(next\)/);
 assert.match(app,/localStorage\.setItem\("systemTaskUser", state\.currentUser\)/);
 assert.match(shell,/data-pn-account-trigger/);
 assert.match(shell,/data-pn-select-user/);
 assert.match(shell,/state\.snapshot\.users/);
 assert.match(shell,/bridge\.selectUser\(next\)/);
 assert.match(shell,/if\(state\.editor&&!window\.confirm/);
 assert.match(shell,/if\(state\.busy\)/);
 assert.match(css,/\.pn-account-trigger/);
 assert.match(css,/\.pn-account-menu/);
 assert.match(css,/grid-template-columns:minmax\(80px,1fr\) 38px 38px 72px 41px/);
 assert.doesNotMatch(shell,/localStorage\.setItem|firebase\/database|getDatabase\(/);
});


test('Palette account picker filters only existing users and keeps the canonical account owner',()=>{
 assert.match(shell,/function filterAccountChoices\(\)/);
 assert.match(shell,/function syncAccountControl\(\)/);
 assert.match(shell,/function accountTone\(name\)/);
 assert.match(shell,/id="pnAccountSearch"/);
 assert.match(shell,/data-pn-select-user/);
 assert.match(shell,/item\.hidden|row\.hidden=Boolean\(term\)/);
 assert.match(shell,/state\.query=''/);
 assert.match(shell,/root\.querySelector\('#pnSearch'\)\.value=''/);
 assert.match(shell,/bridge\.selectUser\(next\)/);
 assert.match(shell,/if\(state\.editor&&!window\.confirm/);
 assert.match(shell,/if\(state\.busy\)/);
 assert.match(css,/\.pn-account-profile/);
 assert.match(css,/\.pn-account-search/);
 assert.match(css,/\.pn-account-options button\[hidden\]/);
 assert.match(css,/grid-template-columns:minmax\(80px,1fr\) 38px 38px 72px 41px/);
 assert.doesNotMatch(shell,/localStorage\.setItem|firebase\/database|getDatabase\(/);
});


test('Palette studio inspector unifies detail surfaces without creating extra writers',()=>{
  for(const key of ['task','schedule','memo','todo']){
    assert.match(shell,new RegExp("inspectorTop\\('"+key+"'"),key+' detail is native');
    if(key!=='task')assert.match(css,new RegExp('data-inspect-kind="'+key+'"|data-inspector="'+key+'"'));
  }
  for(const symbol of ['inspectorTop','inspectorNav','inspectorSection','inspectorMeta',
    'inspectorTags','inspectorDateTime'])assert.match(shell,new RegExp('function '+symbol+'\\('));
  assert.match(shell,/class="pn-inspect-progress"/);
  assert.match(shell,/role="progressbar"/);
  assert.match(shell,/class="pn-inspect-checklist"/);
  assert.match(shell,/class="pn-inspect-history"/);
  assert.match(shell,/class="pn-inspect-timeband"/);
  assert.match(shell,/kind==='task'\?'tasks'/);
  assert.match(shell,/data-pn-related-back/);
  assert.match(shell,/data-pn-plan-task/);
  assert.match(shell,/data-pn-edit="schedule"/);
  assert.match(shell,/data-pn-memo-color/);
  assert.match(shell,/id="pnTodoEdit"/);
  assert.match(shell,/drawer\.dataset\.viewId/);
  assert.match(css,/\.pn-detail\[data-inspector\]/);
  assert.match(css,/\.pn-inspect-hero/);
  assert.match(css,/\.pn-inspect-actions/);
  assert.match(css,/@media\(max-width:780px\)/);
  // Inspectors read canonical snapshots and delegate edits; no shadow storage.
  assert.doesNotMatch(shell,/firebase\/database|getDatabase\(|runTransaction\(|localStorage\.setItem/);
});

test('Palette presents account switching as a visible work context on desktop and mobile',()=>{
  assert.match(shell,/pn-account-meta/);
  assert.match(shell,/利用者切替/);
  assert.match(shell,/pn-account-strip/);
  assert.match(shell,/id="pnAccountStripName"/);
  assert.match(shell,/data-pn-account-shortcut/);
  assert.match(shell,/root\.querySelector\('#pnAccountStripName'\)\.textContent=current/);
  assert.match(shell,/accountOpenAnchor/);
  assert.match(shell,/bridge\.selectUser\(next\)/);
  assert.match(css,/\.pn-account-strip-action/);
  assert.match(css,/\.pn-account-meta small/);
  assert.match(css,/\.pn-account-swap/);
  assert.doesNotMatch(shell,/firebase\/database|localStorage\.setItem/);
});


test('Palette task collection uses semantic status and compact progress, not extra storage',()=>{
  assert.match(shell,/function taskVisualTone\(task\)/);
  assert.match(shell,/function taskListRow\(task\)/);
  assert.match(shell,/class="pn-task-overview"/);
  assert.match(shell,/data-metric=/);
  assert.match(shell,/data-task-tone=/);
  assert.match(shell,/data-due-tone=/);
  assert.match(shell,/class="pn-task-mini-progress"/);
  assert.match(shell,/role="progressbar"/);
  assert.match(shell,/class="pn-task-mobile-due"/);
  assert.match(shell,/data-pn-bulk-id/);
  assert.match(shell,/data-pn-detail="task"/);
  assert.match(shell,/data-pn-cmd="task.star"/);
  assert.match(shell,/data-has-events=/);
  assert.match(shell,/class="pn-day-event-dot"/);
  assert.match(css,/\.pn-task-overview/);
  assert.match(css,/\.pn-flowrow\[data-task-tone="overdue"\]/);
  assert.match(css,/\.pn-flowrow\[data-task-tone="due"\]/);
  assert.match(css,/\.pn-task-mini-progress/);
  assert.match(css,/\.pn-task-mobile-due/);
  assert.match(css,/\.pn-day-event-dot/);
  // The list stays a snapshot rendering, leaving canonical task and schedule
  // writers/optimistic locking fully owned by app.js.
  assert.doesNotMatch(shell,/getDatabase\(|runTransaction\(|firebase\/database|localStorage\.setItem/);
});


test('Palette daily collections keep the same authored surfaces without extra save paths',()=>{
  assert.match(shell,/function taskRow\(task,index\)/);
  assert.match(shell,/data-focus-tone=/);
  assert.match(shell,/data-focus-risk=/);
  assert.match(shell,/class="pn-focusmeta"/);
  assert.match(shell,/class="pn-notice-marker"/);
  assert.match(shell,/class="pn-notice-text"/);
  assert.match(css,/\.pn-focusrow\[data-focus-tone="overdue"\]/);
  assert.match(css,/\.pn-focuscue\[data-focus-risk="due"\]/);
  assert.doesNotMatch(css,/\.pn-focusrow:nth-child/);
  assert.doesNotMatch(css,/\.pn-notice:nth-child/);
  assert.match(css,/\.pn-surface-schedule \.pn-scheduleopen/);
  assert.match(css,/\.pn-schedule-sheet \.pn-scheduleopen/);
  assert.match(css,/\.pn-memotile\[data-paper-color="mint"\]/);
  assert.match(css,/\.pn-memotile\[data-paper-color="peach"\]/);
  assert.match(shell,/data-pn-cmd="todo.toggle"/);
  assert.match(shell,/data-pn-detail="schedule"/);
  assert.doesNotMatch(shell,/localStorage\.setItem|getDatabase\(|runTransaction\(/);
});

test('Palette ToDo composition places optional memo before the create action',()=>{
  const start=shell.indexOf('function todoPage()');
  const end=shell.indexOf('function bulkSelectedEntries()',start);
  const todo=shell.slice(start,end);
  const titleIndex=todo.indexOf('id="pnTodoInput"');
  const memoIndex=todo.indexOf('id="pnTodoMemo"');
  const submitIndex=todo.indexOf('pn-compose-footer');
  assert.ok(titleIndex>=0 && titleIndex<memoIndex && memoIndex<submitIndex,
    'A predictable title → optional note → right-aligned create order is required');
  assert.match(todo,/aria-label="ToDoの内容"/);
  assert.match(todo,/role="progressbar"/);
  assert.match(todo,/aria-valuenow=/);
  assert.match(css,/\.pn-compose-footer\{display:flex;justify-content:flex-end/);
  assert.match(css,/@media\(max-width:780px\)/);
});

test('Palette weekly agenda reuses canonical schedules and preserves one-day navigation',()=>{
 const start=shell.indexOf('  function schedulePage() {');
 const end=shell.indexOf('  function memoPage() {',start);
 assert.ok(start>=0&&end>start);
 const agenda=shell.slice(start,end);
 assert.match(agenda,/state\.scheduleView==='week'/);
 assert.match(agenda,/const dayItems=new Map\(dates\.map/);
 assert.match(agenda,/data-pn-schedule-view/);
 assert.match(agenda,/data-pn-agenda-day/);
 assert.match(agenda,/data-pn-agenda-add/);
 assert.match(agenda,/data-pn-open-day/);
 assert.match(agenda,/scheduleMatches\(item\)/);
 assert.match(agenda,/items\.map\(scheduleRow\)/);
 assert.match(shell,/openEditor\('schedule','',target,\{startAt:day\+'T09:00',endAt:day\+'T10:00'\}\)/);
 assert.match(css,/\.pn-week-agenda\{display:grid/);
 assert.match(css,/\.pn-week-agenda-add/);
 assert.doesNotMatch(agenda,/firebase|localStorage\.setItem|runTransaction/);
});

test('Palette keeps live full-width search accessible on narrow phones and in Today',()=>{
  const mobile=css.slice(css.indexOf('@media(max-width:480px){'));
  assert.match(mobile,/#paletteNextRoot \.pn-search\{\s*display:flex/);
  assert.doesNotMatch(mobile,/#paletteNextRoot \.pn-search\{display:none/);
  assert.match(shell,/id="pnSearch" type="search"/);
  assert.match(shell,/placeholder="Palette内を検索"/);
  assert.match(shell,/aria-label="この画面の内容を検索"/);
  assert.match(shell,/state\.query=event\.target\.value;render\(\)/);
  assert.match(shell,/focusTaskIds\.map\(id=>all\.find/);
  assert.match(shell,/\.filter\(task=>task&&match/);
  assert.match(shell,/!t\.completed&&match\(t\.text/);
  assert.match(shell,/localDate\(item\.startAt\)===state\.snapshot\.today&&scheduleMatches\(item\)/);
});

test('Palette completed ToDos are progressively disclosed without hiding search matches',()=>{
  assert.match(shell,/doneExpanded:false/);
  assert.match(shell,/const doneLimit=6,hasSearch=Boolean\(state\.query\.trim\(\)\)/);
  assert.match(shell,/const visibleDone=hasSearch\|\|state\.doneExpanded\?done:done\.slice\(0,doneLimit\)/);
  assert.match(shell,/id="pnDoneItems"/);
  assert.match(shell,/data-pn-done-toggle/);
  assert.match(shell,/aria-controls="pnDoneItems"/);
  assert.match(shell,/state\.doneExpanded=!state\.doneExpanded/);
  assert.match(shell,/state\.snapshot\.currentUser!==snapshot\.currentUser\)state\.doneExpanded=false/);
  assert.match(css,/\.pn-done-toggle\{/);
  assert.doesNotMatch(shell,/firebase\/database|runTransaction\(|getDatabase\(|localStorage\.setItem/);
});

test('Palette enlarges ToDo hit area while maintaining a consistent small checkbox illustration',()=>{
  assert.match(css,/\.pn-check\{\s*position:relative;display:grid;place-items:center;[\s\S]*?width:42px;height:42px/);
  assert.match(css,/\.pn-check:before\{\s*content:'';position:absolute;width:23px;height:23px/);
  assert.match(css,/\.pn-check\[aria-pressed="true"\]:before/);
  assert.match(css,/\.pn-checkmark\{[\s\S]*?position:relative;z-index:1/);
  assert.match(css,/\.pn-section-eyebrow\{color:var\(--pn-muted\);font-size:11px/);
  assert.match(css,/@media\(max-width:480px\)/);
});

test('Palette lets users jump to a date without mutating schedule data and reflects duration presets',()=>{
  const start=shell.indexOf('  function schedulePage() {');
  const end=shell.indexOf('  function memoPage() {',start);
  const agenda=shell.slice(start,end);
  assert.match(agenda,/data-pn-date-jump/);
  assert.match(agenda,/aria-label="予定の表示日"/);
  assert.match(agenda,/escape\(state\.selectedDay\)/);
  assert.match(agenda,/dates\[0\]\+' 〜 '\+dates\[6\]/);
  assert.match(agenda,/data-is-today/);
  assert.match(shell,/el\.hasAttribute\('data-pn-date-jump'\)/);
  assert.match(shell,/state\.selectedDay=day;\s*render\(\)/);
  assert.match(shell,/minutes===Number\(button\.dataset\.pnDuration\)/);
  assert.match(css,/\.pn-calendar-navigation\{display:flex/);
  assert.match(css,/\.pn-date-jump input\{/);
  assert.match(css,/\.pn-duration\[aria-pressed="true"\]/);
  assert.doesNotMatch(agenda,/getDatabase\(|runTransaction\(|localStorage\.setItem/);
});
