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
  assert.ok(shell.includes("editorFrame('task'"));
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
  assert.ok(shell.includes("editorFrame('memo'"));
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
  assert.match(shell,/switchPaletteRoute\('todos',\{quickTodo:true\}\)/);
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
 assert.match(shell,/editorHasChanges\(\)\|\|todoDetailHasChanges\(\)\|\|state\.todoDraft\.text\.trim\(\)/);
  assert.match(shell,/window\.confirm\('入力中の変更を破棄して利用者を切り替えますか？'\)/);
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
 assert.match(shell,/function resetAccountViewState\(\)/);
 assert.match(shell,/if\(search\)search\.value=''/);
 assert.match(shell,/bridge\.selectUser\(next\)/);
 assert.match(shell,/editorHasChanges\(\)\|\|todoDetailHasChanges\(\)\|\|state\.todoDraft\.text\.trim\(\)/);
  assert.match(shell,/window\.confirm\('入力中の変更を破棄して利用者を切り替えますか？'\)/);
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

test('Palette ToDo entry uses an inline action and a disclosure for optional notes',()=>{
  const start=shell.indexOf('function todoPage()');
  const end=shell.indexOf('function bulkSelectedEntries()',start);
  const todo=shell.slice(start,end);
  const titleIndex=todo.indexOf('id="pnTodoInput"');
  const submitIndex=todo.indexOf('pn-compose-footer');
  const memoIndex=todo.indexOf('id="pnTodoMemo"');
  assert.ok(titleIndex>=0 && titleIndex<submitIndex && submitIndex<memoIndex,
    'The primary row must contain title and save; optional notes stay below');
  assert.match(todo,/class="pn-compose-main"/);
  assert.match(todo,/data-pn-todo-memo-toggle/);
  assert.match(todo,/aria-expanded="/);
  assert.match(todo,/id="pnTodoMemoField"/);
  assert.match(todo,/aria-label="ToDoの内容"/);
  assert.match(todo,/role="progressbar"/);
  assert.match(todo,/aria-valuenow=/);
  assert.match(css,/\.pn-compose-main\{/);
  assert.match(css,/\.pn-compose-memo\[hidden\]\{display:none\}/);
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
  assert.match(shell,/state\.query=event\.target\.value/);
  assert.match(shell,/state\.queries\[state\.route\]=state\.query/);
  assert.match(shell,/render\(\);/);
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
  assert.match(shell,/if\(state\.snapshot\.currentUser!==snapshot\.currentUser\)\{/);
  assert.match(shell,/state\.doneExpanded=false;\s*state\.expandedAgendaDays\.clear\(\);\s*state\.todoDraft=\{text:'',memo:''\};/);
  assert.match(css,/\.pn-done-toggle\{/);
  assert.doesNotMatch(shell,/firebase\/database|runTransaction\(|getDatabase\(|localStorage\.setItem/);
});

test('Palette enlarges ToDo hit area while maintaining a consistent small checkbox illustration',()=>{
  assert.match(css,/\.pn-check\{\s*position:relative;display:grid;place-items:center;[\s\S]*?width:44px;height:44px/);
  assert.match(css,/\.pn-check:before\{\s*content:'';position:absolute;width:23px;height:23px/);
  assert.match(css,/\.pn-check\[aria-pressed="true"\]:before/);
  assert.match(css,/\.pn-checkmark\{[\s\S]*?position:relative;z-index:1/);
  assert.match(css,/\.pn-section-eyebrow\{color:var\(--pn-muted\);font-size:11px/);
  assert.match(css,/@media\(max-width:480px\)/);
});

test('Palette optional memo preserves draft on rerender and resets after save or account switch',()=>{
  assert.match(shell,/todoMemoExpanded:false/);
  assert.match(shell,/state\.todoMemoExpanded=!state\.todoMemoExpanded/);
  assert.match(shell,/if\(command\.type==='todo\.create'\)\{state\.todoDraft=\{text:'',memo:''\};state\.todoMemoExpanded=false;\}/);
  assert.match(shell,/state\.todoMemoExpanded=false;/);
  assert.match(shell,/state\.todoDraft\.memo=root\.querySelector\('#pnTodoMemo'\)/);
  assert.doesNotMatch(shell,/localStorage\.setItem|getDatabase\(|runTransaction\(/);
});

test('Palette ToDo composer preserves drafts and caret while canonical snapshots refresh',()=>{
 assert.match(shell,/todoDraft:\{text:'',memo:''\}/);
 assert.match(shell,/escape\(state\.todoDraft\.text\)/);
 assert.match(shell,/escape\(state\.todoDraft\.memo\)/);
 assert.match(shell,/state\.todoDraft\.text=root\.querySelector\('#pnTodoInput'\)/);
 assert.match(shell,/state\.todoDraft\.memo=root\.querySelector\('#pnTodoMemo'\)/);
 assert.match(shell,/field\.setSelectionRange\(activeField\.start,activeField\.end\)/);
 assert.match(shell,/if\(command\.type==='todo\.create'\)\{state\.todoDraft=/);
 assert.match(shell,/if\(command\.type==='todo\.create' && active\(\) && state\.route==='todos'\)/);
 assert.match(shell,/state\.todoDraft=\{text:'',memo:''\};/);
 assert.match(shell,/editorHasChanges\(\)\|\|todoDetailHasChanges\(\)\|\|state\.todoDraft\.text\.trim\(\)/);
 assert.doesNotMatch(shell,/localStorage\.setItem|getDatabase\(|runTransaction\(/);
});
test('Palette task metrics and multi-select use dense rows with finger-sized labels',()=>{
 assert.match(css,/grid-template-columns:42px minmax\(0,1fr\) 90px 42px/);
 assert.match(css,/grid-template-columns:42px minmax\(0,1fr\) 42px/);
 assert.match(css,/min-width:42px;width:42px;height:42px/);
 assert.match(css,/\.pn-bulkcheck:focus-within/);
 assert.match(css,/\.pn-task-metric\{[\s\S]*?min-height:65px/);
 assert.match(shell,/data-pn-bulk-id/);
 assert.match(shell,/bulkSelectedEntries\(\)/);
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


test('Palette ToDo uses its title as the single detail action in Today and ToDo views',()=>{
 const start=shell.indexOf('  function todoRow('),end=shell.indexOf('  function taskRow(',start);
 assert.ok(start>=0&&end>start);
 const row=shell.slice(start,end);
 assert.match(row,/class="pn-todotext pn-todoopen/);
 assert.match(row,/data-pn-detail="todo"/);
 assert.equal((row.match(/data-pn-detail="todo"/g)||[]).length,1);
 assert.match(row,/data-pn-cmd="todo\.toggle"/);
 assert.match(row,/data-pn-cmd="todo\.move"/);
 assert.match(css,/\.pn-todoopen\{/);
 assert.match(css,/\.pn-todoopen:focus-visible/);
 assert.match(css,/\.pn-todoopen:hover/);
});
test('Palette preserves keyboard focus on regenerated task and ToDo controls',()=>{
 assert.match(shell,/function focusRebuiltControl\(attribute,value=''\)/);
 assert.match(shell,/focusRebuiltControl\('data-pn-bulk-id',id\)/);
 assert.match(shell,/focusRebuiltControl\('data-pn-bulk-all'\)/);
 assert.match(shell,/focusRebuiltControl\('data-pn-bulk-action'\)/);
 assert.match(shell,/focusRebuiltControl\('data-pn-filter',state\.taskFilter\)/);
 assert.match(shell,/!result\?\.ok \|\| !\['todo\.toggle','todo\.move'\]\.includes\(type\)/);
 assert.match(shell,/const same=controls\.find\(el=>el\.dataset\.id===id/);
 assert.match(shell,/focus\(\{preventScroll:true\}\)/);
 assert.doesNotMatch(shell,/getDatabase\(|runTransaction\(|localStorage\.setItem/);
});

test('Palette divides daily schedules by local time and discloses busy weekly agendas without data writers',()=>{
  const start=shell.indexOf('  function schedulePage() {');
  const end=shell.indexOf('  function memoPage() {',start);
  const agenda=shell.slice(start,end);
  assert.match(shell,/function schedulePeriod\(item\)/);
  assert.match(shell,/function schedulePeriodSummary\(items\)/);
  assert.match(shell,/function scheduleDayGroups\(items\)/);
  assert.match(shell,/expandedAgendaDays:new Set\(\)/);
  assert.match(agenda,/schedules\.length\?scheduleDayGroups\(schedules\)/);
  assert.match(agenda,/allItems\.slice\(0,4\)/);
  assert.match(agenda,/searching\|\|expanded\?allItems/);
  assert.match(agenda,/data-pn-agenda-toggle/);
  assert.match(agenda,/aria-controls="pnAgendaList-/);
  assert.match(agenda,/schedulePeriodSummary\(allItems\)/);
  assert.match(shell,/if\(target\.dataset\.pnAgendaToggle\)/);
  assert.match(shell,/state\.expandedAgendaDays\.clear\(\)/);
  assert.match(css,/\.pn-timehead h3/);
  assert.match(css,/\.pn-agenda-periods/);
  assert.match(css,/\.pn-agenda-toggle\{/);
  assert.doesNotMatch(agenda,/getDatabase\(|runTransaction\(|localStorage\.setItem/);
});

test('Palette editor studio keeps canonical writers and separates scrolling content from actions',()=>{
  const taskStart=shell.indexOf('  function taskEditorMarkup(task) {');
  const memoStart=shell.indexOf('  function memoEditorMarkup(memo) {',taskStart);
  const editEnd=shell.indexOf('  function openEditor(',memoStart);
  const task=shell.slice(taskStart,memoStart),memo=shell.slice(memoStart,editEnd);
  assert.match(shell,/function editorFrame\(kind,title,kicker,body,submitLabel\)/);
  assert.match(shell,/class="pn-edit-shell"/);
  assert.match(shell,/class="pn-editor-scroll"/);
  assert.match(shell,/class="pn-editor-actions"/);
  assert.match(task,/editorFrame\('task'/);
  assert.match(task,/pn-editor-grid-primary/);
  assert.match(task,/pn-editor-grid-content/);
  assert.match(task,/name="pinned"/);
  for(const field of ['title','assignee','status','priority','category','dueDate','dueTime',
    'requester','tags','description','checklist'])assert.ok(task.includes("'"+field+"'"),field);
  assert.match(memo,/editorFrame\('memo'/);
  assert.match(memo,/name="paperColor"/);
  assert.match(memo,/memoColors\.map/);
  assert.match(css,/\.pn-edit-shell\{/);
  assert.match(css,/\.pn-editor-scroll\{/);
  assert.match(css,/\.pn-edit-memo-layout\{/);
  assert.match(css,/\.pn-detail\[data-inspector="memo"\] \.pn-inspect-actions\{/);
  assert.match(css,/position:static;bottom:auto;/);
  assert.doesNotMatch(task+memo,/localStorage\.setItem|getDatabase\(|runTransaction\(/);
});
test('Palette task sort is view-only and does not add persistence paths',()=>{
  assert.match(shell,/taskSort:'due'/);
  assert.match(shell,/data-pn-task-sort/);
  assert.match(shell,/\['due','期限順'\]/);
  assert.match(shell,/\['priority','優先度順'\]/);
  assert.match(shell,/\['updated','更新順'\]/);
  assert.match(shell,/state\.taskSort=el\.value/);
  assert.match(css,/\.pn-task-view-tools\{/);
});

test('Palette task and memo inspectors share the visible list order without writing data',()=>{
  const start=shell.indexOf('  function visibleSortedTasks() {');
  const end=shell.indexOf('  function scheduleMatches(item) {',start);
  const task=shell.slice(start,end);
  const memoStart=shell.indexOf('  function matchedMemos() {');
  const memoEnd=shell.indexOf('  function memoPage() {',memoStart);
  const memoView=shell.slice(memoStart,memoEnd);
  assert.ok(start>=0&&end>start&&memoStart>=0&&memoEnd>memoStart);
  assert.match(task,/return filteredTasks\(\)\.sort/);
  assert.match(task,/const tasks=visibleSortedTasks\(\)/);
  assert.match(memoView,/return sortedMemos\(visible\)/);
  assert.match(shell,/const items=visibleSortedMemos\(matched\)/);
  assert.match(shell,/function inspectorSequenceRows\(kind\)/);
  assert.match(shell,/kind==='task'&&state\.route==='tasks'&&!state\.detailReturn/);
  assert.match(shell,/kind==='memo'&&state\.route==='memos'/);
  assert.match(shell,/function taskDetailNavigator\(id\)/);
  assert.match(shell,/function memoDetailNavigator\(id\)/);
  assert.match(shell,/inspectorNav\(false,memoDetailNavigator\(item\.id\)\)/);
  assert.match(shell,/data-pn-inspect-step="-1"/);
  assert.match(shell,/data-pn-inspect-step="1"/);
  assert.match(shell,/if\(target\.hasAttribute\('data-pn-inspect-step'\)\)/);
  assert.match(shell,/state\.detail=\{kind,id:next\.id\}/);
  assert.match(shell,/data-pn-memo-reveal/);
  assert.match(shell,/state\.query='';/);
  assert.match(css,/\.pn-inspect-sequence\{/);
  assert.match(css,/\.pn-inspect-outside-filter\{/);
  assert.doesNotMatch(task+memoView,/getDatabase\(|runTransaction\(|localStorage\.setItem/);
});

test('Palette memo gallery preserves the canonical manual arrangement with optional view-only sorts',()=>{
  const start=shell.indexOf('  function sortedMemos(items) {');
  const end=shell.indexOf('  const pages={today:',start);
  assert.ok(start>=0&&end>start);
  const source=shell.slice(start,end);
  assert.match(shell,/memoSort:'manual'/);
  assert.match(source,/if\(state\.memoSort==='manual'\)return items/);
  assert.match(source,/return \[\.\.\.items\]\.sort/);
  assert.match(source,/Number\(Boolean\(b\.pinned\)\)-Number\(Boolean\(a\.pinned\)\)/);
  for(const mode of ['manual','updated','title','category'])
    assert.ok(source.includes("['"+mode+"','")||mode==='manual');
  assert.match(source,/data-pn-memo-sort/);
  assert.match(source,/data-pn-memo-clear-filter/);
  assert.match(source,/class="pn-memo-results"/);
  assert.match(shell,/state\.memoSort=el\.value/);
  assert.match(css,/\.pn-memo-utility\{/);
  assert.match(css,/\.pn-memo-filter-clear\{/);
  assert.doesNotMatch(source,/localStorage\.setItem\(|runTransaction\(|memoBridge\.dispatch/);
  // The canonical writer already preserves updatedAt for a paperColor-only edit.
  assert.match(memo,/updatedAt: colorOnly \? Number\(existing\.updatedAt/);
});

test('Palette four inspectors use one semantic action renderer without new writers',()=>{
  const start=shell.indexOf('  function inspectorActionBar(primary,secondary=[],danger=');
  const end=shell.indexOf('  async function dispatch(',start);
  assert.ok(start>=0&&end>start);
  const source=shell.slice(start,end);
  assert.match(source,/class="pn-inspect-actions pn-inspect-actionbar"/);
  assert.match(source,/class="pn-inspect-action-primary"/);
  assert.match(source,/class="pn-inspect-action-secondary"/);
  assert.match(source,/class="pn-inspect-action-danger"/);
  assert.equal((source.match(/inspectorActionBar\(/g)||[]).length,5,
    'One renderer and exactly one call for each of the four inspector kinds');
  for(const command of ['task.complete','task.reopen','task.star','schedule.delete',
    'memo.pin','memo.delete','todo.delete'])assert.ok(source.includes(command),command);
  for(const action of ['data-pn-plan-task','data-pn-copy="schedule"',
    'data-pn-edit="memo"','type="submit"'])
    assert.ok(source.includes(action),action);
  // Task/schedule edit lives in their sticky inspector header, not twice on screen.
  const nav=shell.slice(shell.indexOf('  function inspectorNav('),
    shell.indexOf('  // The inspector follows',shell.indexOf('  function inspectorNav(')));
  assert.match(nav,/data-pn-inspect-edit-shortcut/);
  assert.match(nav,/data-pn-edit="'\+state\.detail\.kind/);
  assert.match(nav,/\['task','schedule'\]\.includes\(state\.detail\?\.kind\)/);
  assert.match(source,/primary\?'<div class="pn-inspect-action-primary"/);
  assert.equal((source.match(/inspectorActionBar\(\s*''/g)||[]).length,2,
    'Task and schedule have no redundant footer edit control');
  assert.doesNotMatch(source,/'<div class="pn-inspect-actions">'/,
    'Do not retain alternative/legacy inspector action structures');
  assert.match(css,/\.pn-inspect-action-primary,/);
  assert.match(css,/\.pn-inspect-action-secondary\{/);
  assert.match(css,/\.pn-inspect-action-danger\{/);
  assert.match(css,/\.pn-detail\[data-inspector="memo"\] \.pn-inspect-actions\{/);
  assert.match(css,/position:static;bottom:auto/);
  assert.doesNotMatch(source,/runTransaction\(|getDatabase\(|localStorage\.setItem\(/);
});


test('Ver.430 Palette density keeps canonical actions and readable compact surfaces',()=>{
  assert.match(css,/grid-template-columns:40px minmax\(0,1fr\)/);
  assert.match(css,/min-height:154px;padding:15px 16px 13px/);
  assert.match(css,/min\(100%,235px\)/);
  assert.match(css,/-webkit-line-clamp:3/);
  assert.match(shell,/name="memo" rows="3" maxlength="4000"/);
  assert.match(shell,/inspectorActionBar\(/);
  assert.match(shell,/data-pn-cmd="todo.delete"/);
  assert.match(shell,/function visibleSortedMemos\(/);
});

test('Ver.431 task history progressively discloses older entries without modifying data',()=>{
  const start=shell.indexOf('  function inspectorHistoryList(rows) {');
  const detail=shell.slice(shell.indexOf('  function updateDetail() {'),shell.indexOf('  async function dispatch('));
  assert.ok(start>0);
  assert.match(detail,/history\.slice\(0,3\)/);
  assert.match(detail,/history\.slice\(3\)/);
  assert.match(detail,/data-pn-history-more/);
  assert.match(detail,/historyWasOpen/);
  assert.match(css,/\.pn-inspect-history-more summary\{/);
  assert.doesNotMatch(detail,/runTransaction\(|localStorage\.setItem\(/);
});

test('Ver.431 ToDo and schedule inspect their visible list in place, with unsaved ToDo guard',()=>{
  const start=shell.indexOf('  function inspectorSequenceRows(kind) {');
  const end=shell.indexOf('  function inspectorSection(',start);
  const nav=shell.slice(start,end);
  const click=shell.slice(shell.indexOf("    if(target.hasAttribute('data-pn-inspect-step'))"),shell.indexOf('    if(target.dataset.pnLinkedTask)'));
  assert.match(nav,/kind==='todo'&&state\.route==='todos'/);
  assert.match(nav,/kind==='schedule'&&state\.route==='schedule'/);
  assert.match(nav,/workspace\.querySelectorAll\('\[data-pn-detail=/);
  assert.match(shell,/inspectorNav\(false,inspectorSequence\('schedule',item\.id\)\)/);
  assert.match(shell,/inspectorNav\(false,inspectorSequence\('todo',item\.id\)\)/);
  assert.match(click,/\['task','memo','todo','schedule'\]/);
  assert.match(click,/form\.elements\.namedItem\('memo'\)/);
  assert.match(click,/window\.confirm\('未保存のToDo変更があります/);
  assert.match(shell,/\['task','memo','todo','schedule'\]\.includes\(previous\?\.kind\)/);
  assert.doesNotMatch(nav+click,/getDatabase\(|runTransaction\(|localStorage\.setItem\(/);
});

test('Palette remembers per-tab queries and task filter without extra persistent state',()=>{
  assert.match(shell,/queries:Object\.fromEntries\(nav\.map/);
  assert.match(shell,/state\.queries\[state\.route\]=state\.query/);
  assert.match(shell,/state\.query=state\.queries\[next\]\|\|''/);
  assert.match(shell,/state\.queries=Object\.fromEntries\(nav\.map/);
  const route=shell.slice(shell.indexOf('  function switchPaletteRoute('),
    shell.indexOf("  root.addEventListener('click',event=>"));
  assert.doesNotMatch(route,/state\.taskFilter='all'/);
  assert.match(route,/state\.bulkSelected\.clear\(\)/);
  assert.match(route,/state\.query=state\.queries\[next\]\|\|''/);
  assert.doesNotMatch(route,/localStorage\.setItem|getDatabase\(|runTransaction\(/);
});

test('Palette preserves the focused record through snapshot redraw and offers inspector arrow keys',()=>{
  const render=shell.slice(shell.indexOf('  function render() {'),shell.indexOf('  function closeDetail() {'));
  assert.match(render,/focusedRow=focused\?\.closest/);
  assert.match(render,/focusedRecord\.kind/);
  assert.match(render,/matching\?\.focus\(\{preventScroll:true\}\)/);
  assert.match(shell,/event\.key==='ArrowRight'\?'1':'-1'/);
  assert.match(shell,/!\['INPUT','TEXTAREA','SELECT'\]\.includes/);
  assert.match(shell,/step\.click\(\)/);
  assert.doesNotMatch(render,/localStorage\.setItem|getDatabase\(|runTransaction\(/);
});

test('Ver.445 Palette scoped search labels and all account switches reset local filters',()=>{
  assert.match(shell,/const searchScopeNames=\{today:'今日の項目',tasks:'タスク',todos:'ToDo',schedule:'予定',memos:'メモ'\}/);
  assert.match(shell,/function syncSearchScope\(\)/);
  assert.match(shell,/search\.setAttribute\('aria-label',label\)/);
  assert.match(shell,/function resetAccountViewState\(\)/);
  const reset=shell.slice(shell.indexOf('  function resetAccountViewState(){'),
    shell.indexOf("  root.addEventListener('click',event=>"));
  for(const source of ['state.taskFilter=','state.memoColorFilter=','state.query=',
    'state.queries=','state.todoDraft='])
    assert.ok(reset.includes(source),source);
  assert.match(shell,/if\(state\.snapshot\.currentUser!==snapshot\.currentUser\)\{[\s\S]*?resetAccountViewState\(\)/);
  assert.match(shell,/if\(state\.detail\|\|state\.editor\)closeDetail\(\)/);
  assert.doesNotMatch(reset,/localStorage\.setItem\(|runTransaction\(|getDatabase\(/);
});

test('Palette restores the reading position by tab, but Quick Create starts a clean ToDo list',()=>{
  const start=shell.indexOf('  function switchPaletteRoute(');
  const end=shell.indexOf("  root.addEventListener('click',event=>",start);
  const nav=shell.slice(start,end);
  assert.ok(start>0&&end>start);
  assert.match(nav,/state\.scrollPositions\[state\.route\]=Math\.max\(0,window\.scrollY\)/);
  assert.match(nav,/state\.scrollPositions\.todos=0/);
  assert.match(nav,/state\.queries\.todos=''/);
  assert.match(nav,/window\.scrollTo\(\{top,behavior:'instant'\}\)/);
  assert.match(nav,/focus\(\{preventScroll:true\}\)/);
  assert.match(shell,/switchPaletteRoute\('todos',\{quickTodo:true\}\)/);
  assert.match(shell,/switchPaletteRoute\(target\.dataset\.pnRoute\)/);
  assert.match(shell,/state\.scrollPositions=Object\.fromEntries/);
  assert.doesNotMatch(nav,/localStorage\.setItem\(|getDatabase\(|runTransaction\(/);
  // Compact smartphone headers leave room for real content; touch targets stay 44px.
  assert.match(css,/\.pn-compose-footer \.pn-button\{min-width:105px;min-height:44px/);
  assert.match(css,/\.pn-workspace\{padding:16px 15px calc\(115px/);
});


test('Palette Today prioritizes due records and reports full counts without new save paths',()=>{
  const start=shell.indexOf('  function todayPage() {');
  const end=shell.indexOf('  function pageHead(',start);
  const today=shell.slice(start,end);
  assert.ok(start>0&&end>start);
  assert.match(today,/focusTaskIds\.map\(id=>all\.find/);
  assert.match(today,/focusPreview=searching\|\|state\.todayFocusExpanded\?focus:focus\.slice\(0,4\)/);
  assert.match(today,/const todoMatches=state\.snapshot\.todos/);
  assert.match(today,/todoMatches\.length/);
  assert.match(today,/const schedulesAll=state\.snapshot\.schedules/);
  assert.match(today,/schedulesAll\.length/);
  assert.match(today,/const urgent=all\.filter/);
  assert.match(today,/data-pn-today-risk/);
  assert.match(today,/upcomingPreview\.map\(scheduleRow\)/);
  assert.match(today,/previousPreview\.map\(scheduleRow\)/);
  assert.match(today,/data-pn-today-focus-toggle/);
  assert.match(shell,/state\.todayFocusExpanded=false/);
  assert.match(shell,/state\.queries\.tasks=''/);
  assert.match(css,/\.pn-today-attention\{/);
  assert.match(css,/\.pn-home-grid \.pn-surface-schedule\{order:2\}/);
  assert.match(css,/\.pn-home-grid \.pn-surface-todo\{order:3\}/);
  assert.doesNotMatch(today,/runTransaction\(|getDatabase\(|firebase\/database|localStorage\.setItem/);
});


test('Palette Today detail navigation reuses visible order and ToDo focus after a confirmed save',()=>{
  const today=shell.slice(shell.indexOf('  function todayPage() {'),shell.indexOf('  function pageHead('));
  const inspector=shell.slice(shell.indexOf('  function inspectorSequenceRows(kind) {'),
    shell.indexOf('  function inspectorSequence(kind,id) {'));
  const schedule=shell.slice(shell.indexOf('  function scheduleRow(item) {'),
    shell.indexOf('  function schedulePage() {'));
  const command=shell.slice(shell.indexOf('    if(target.dataset.pnCmd) {'),
    shell.indexOf("  root.addEventListener('submit',event=>"));
  assert.match(inspector,/state\.route==='today'&&!state\.detailReturn/);
  assert.match(inspector,/kind==='task'\?state\.snapshot\.tasks/);
  assert.match(inspector,/workspace\.querySelectorAll\('\[data-pn-detail=/);
  assert.match(schedule,/const inToday=state\.route==='today'/);
  assert.match(schedule,/inToday\?'関連 · '/);
  assert.match(schedule,/inToday\?'':'<button class="pn-schedule-link"/);
  assert.match(today,/upcomingPreview\.map\(scheduleRow\)/);
  assert.match(command,/const todoList=type==='todo\.toggle'\?target\.closest\('\.pn-todolist'\)/);
  assert.match(command,/const nextTodoId=todoIndex>=0/);
  assert.match(command,/if\(state\.route!==routeAtClick\|\|state\.snapshot\.currentUser!==userAtClick\)return/);
  assert.match(command,/available\.find\(el=>el\.dataset\.id===nextTodoId\)\|\|available\[0\]/);
  assert.match(command,/saved\.completed\?'ToDoを完了しました'/);
  assert.match(css,/\.pn-surface-schedule \.pn-schedule-actions:empty\{display:none\}/);
  assert.doesNotMatch(inspector+schedule+command,/getDatabase\(|runTransaction\(|localStorage\.setItem\(/);
});


test('Palette task/schedule inspector exposes one sticky edit action while preserving owners',()=>{
  const nav=shell.slice(shell.indexOf('  function inspectorNav('),
    shell.indexOf('  // The inspector follows',shell.indexOf('  function inspectorNav(')));
  const detail=shell.slice(shell.indexOf('  function updateDetail() {'),
    shell.indexOf('  async function dispatch(',shell.indexOf('  function updateDetail() {')));
  assert.match(nav,/data-pn-inspect-edit-shortcut/);
  assert.match(nav,/data-pn-edit="'\+state\.detail\.kind/);
  assert.match(nav,/data-id="'\+/);
  assert.match(nav,/data-pn-related-back/);
  assert.match(nav,/data-pn-close/);
  assert.doesNotMatch(detail,/data-pn-edit="task"/);
  assert.doesNotMatch(detail,/data-pn-edit="schedule"/);
  assert.match(detail,/data-pn-plan-task/);
  assert.match(detail,/data-pn-copy="schedule"/);
  assert.match(css,/\.pn-detail-nav \.pn-inspect-edit-shortcut\{/);
  assert.match(css,/\.pn-inspect-edit-shortcut:focus-visible/);
  assert.match(css,/min-height:44px/);
  assert.doesNotMatch(nav+detail,/getDatabase\(|runTransaction\(|localStorage\.setItem\(/);
});


test('Palette inspector prioritizes task facts and schedule relations without shadow records',()=>{
  const helper=shell.slice(shell.indexOf('  function inspectorMeta('),
    shell.indexOf('  function inspectorTags(',shell.indexOf('  function inspectorMeta(')));
  const detail=shell.slice(shell.indexOf('  function updateDetail() {'),
    shell.indexOf('  async function dispatch(',shell.indexOf('  function updateDetail() {')));
  assert.match(helper,/function inspectorMeta\(rows,layout=''\)/);
  assert.match(helper,/pn-inspect-facts-task/);
  assert.match(helper,/pn-inspect-facts-schedule/);
  assert.match(helper,/function inspectorScheduleContext\(item,linked\)/);
  assert.match(helper,/class="pn-inspect-agenda"/);
  assert.match(helper,/data-pn-linked-task/);
  assert.match(helper,/data-schedule-id/);
  assert.match(detail,/\['担当者',item\.assignee\|\|'未設定'\],\s*\['期限',/);
  assert.match(detail,/\['進捗',checks\.length\?done\+/);
  assert.match(detail,/\.\.\.\(item\.requester\?\[\['依頼元',item\.requester\]\]:\[\]\)/);
  assert.match(detail,/inspectorScheduleContext\(item,linked\)/);
  assert.match(detail,/inspectorMeta\(\[\s*\['担当者',item\.assignee\|\|'未設定'\],\s*\['分類',item\.category\|\|'その他'\],\s*\['繰り返し',/);
  assert.match(detail,/class="pn-inspect-timeband"/);
  assert.doesNotMatch(detail,/inspectorSection\('01','関連タスク'/);
  assert.match(css,/\.pn-inspect-facts-task\{/);
  assert.match(css,/\.pn-inspect-facts-schedule\{/);
  assert.match(css,/\.pn-inspect-agenda\{/);
  assert.doesNotMatch(helper+detail,/getDatabase\(|runTransaction\(|localStorage\.setItem\(/);
});


test('Palette inspector restores the current card and reading position without cross-user focus',()=>{
  const anchors=shell.slice(shell.indexOf('  let lastFocused = null;'),
    shell.indexOf('  function setTheme()',shell.indexOf('  let lastFocused = null;')));
  const close=shell.slice(shell.indexOf('  function closeDetail('),
    shell.indexOf('  function editorOptions(',shell.indexOf('  function closeDetail(')));
  const navigation=shell.slice(shell.indexOf('  function switchPaletteRoute('),
    shell.indexOf("  root.addEventListener('click',event=>"));
  const click=shell.slice(shell.indexOf("  root.addEventListener('click',event=>"),
    shell.indexOf("  root.addEventListener('submit',event=>"));
  assert.match(anchors,/let inspectorReturnPoint = null/);
  assert.match(anchors,/function rememberInspectorOrigin\(kind,id\)/);
  assert.match(anchors,/route:state\.route,user:state\.snapshot\.currentUser,kind,id/);
  assert.match(anchors,/scrollY:Math\.max\(0,window\.scrollY\)/);
  assert.match(anchors,/function revealInspectorReturn\(button,point\)/);
  assert.match(anchors,/scrollTo\(\{top:Math\.min\(limit,point\.scrollY\),behavior:'instant'\}\)/);
  assert.match(anchors,/dockVisible\?dock\.top-12:window\.innerHeight-12/);
  assert.match(anchors,/button\.focus\(\{preventScroll:true\}\)/);
  assert.match(close,/function closeDetail\(restore=true\)/);
  assert.match(close,/point\.user===bridge\.readSnapshot\(\)\.currentUser/);
  assert.match(close,/point\?\.route===state\.route/);
  assert.match(close,/button\.dataset\.pnDetail===point\.kind&&button\.dataset\.id===point\.id/);
  assert.match(close,/revealInspectorReturn\(restored,point\)/);
  assert.match(close,/inspectorReturnPoint=null/);
  assert.match(click,/rememberInspectorOrigin\(target\.dataset\.pnDetail,target\.dataset\.id\)/);
  assert.match(click,/inspectorReturnPoint\.id=next\.id/);
  assert.match(click,/if\(scheduleId\)rememberInspectorOrigin\('schedule',scheduleId\)/);
  assert.match(click,/drawer\.querySelector\('\[data-pn-close\]'\)\?\.focus\(\{preventScroll:true\}\)/);
  assert.match(navigation,/if\(state\.detail\|\|state\.editor\)closeDetail\(false\)/);
  assert.match(css,/\[data-pn-returned\]:focus\{/);
  assert.doesNotMatch(anchors+close+navigation,/localStorage\.setItem\(|runTransaction\(|getDatabase\(/);
});


test('Palette mobile touch targets remain at least 44px without oversized fixed footers',()=>{
  assert.match(css,/\.pn-check\{[\s\S]*?flex:0 0 44px;width:44px;height:44px;min-height:44px/);
  assert.match(css,/\.pn-todoopen\{[\s\S]*?min-height:44px/);
  assert.match(css,/\.pn-week-agenda-list \.pn-scheduleopen\{min-height:44px/);
  assert.match(css,/\.pn-week-agenda-add\{[\s\S]*?min-height:44px/);
  assert.match(css,/\.pn-schedule-link\{[\s\S]*?min-height:44px/);
  assert.match(css,/\.pn-task-star\{[\s\S]*?min-width:44px;min-height:44px/);
  assert.match(css,/\.pn-detail-nav \.pn-button\{min-height:44px\}/);
  assert.match(css,/\.pn-inspect-sequence button\{[\s\S]*?min-height:44px/);
  assert.match(css,/\.pn-related-task\{[\s\S]*?min-height:44px/);
  assert.match(css,/\.pn-flowrow button\.pn-flowtitle\{min-height:44px\}/);
  assert.match(css,/\.pn-todolist li \.pn-smallbtn\{[^}]*min-width:44px;min-height:44px\}/);
  assert.match(css,/html\[data-wb-display="palette"\]\{[\s\S]*?scroll-padding-bottom:calc\(110px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css,/max-height:min\(34dvh,210px\);overflow-y:auto;overscroll-behavior:contain/);
  assert.doesNotMatch(shell,/localStorage\.setItem\(|runTransaction\(|getDatabase\(/);
});


test('Palette schedule and copy editors share one keyboard-safe studio without new writers',()=>{
  const schedule=shell.slice(shell.indexOf('  function scheduleEditorMarkup('),
    shell.indexOf('  function scheduleCopyMarkup('));
  const copy=shell.slice(shell.indexOf('  function scheduleCopyMarkup('),
    shell.indexOf('  function copyConfigFromForm('));
  const frame=shell.slice(shell.indexOf('  function editorFrame('),
    shell.indexOf('  function editorSection('));
  const viewport=shell.slice(shell.indexOf('  function syncEditorViewport('),
    shell.indexOf('  function openEditor(',shell.indexOf('  function syncEditorViewport(')));
  assert.match(schedule,/return editorFrame\('schedule'/);
  assert.match(schedule,/pn-editor-grid-schedule-time/);
  assert.match(schedule,/pn-editor-grid-schedule-detail/);
  assert.match(schedule,/data-pn-batch-new/);
  assert.match(schedule,/id="pnScheduleOverlap"/);
  assert.match(copy,/return editorFrame\(editor\.kind/);
  assert.match(copy,/class="pn-copy-review-stage"/);
  assert.match(copy,/data-pn-copy-preview/);
  assert.match(copy,/id="pnCopyReview"/);
  assert.doesNotMatch(copy,/class="pn-editor-actions"/);
  assert.match(frame,/function editorFrame\(kind,title,kicker,body,submitLabel\)/);
  assert.match(frame,/data-pn-form="schedule-editor"/);
  assert.match(frame,/data-pn-form="schedule-copy"/);
  assert.match(frame,/class="pn-editor-scroll"/);
  assert.match(frame,/class="pn-editor-actions"/);
  assert.match(frame,/data-pn-copy-submit disabled/);
  assert.match(viewport,/window\.visualViewport/);
  assert.match(viewport,/window\.innerHeight,document\.documentElement\.clientHeight/);
  assert.match(viewport,/drawer\.style\.setProperty\('--pn-editor-bottom-offset'/);
  assert.match(viewport,/pane\.scrollTop\+=adjust/);
  assert.match(shell,/window\.visualViewport\?\.addEventListener\('resize',syncEditorViewport\)/);
  assert.match(css,/\.pn-detail\[data-editor\]:not\(\[data-editor=""\]\)/);
  assert.match(css,/--pn-editor-visible-height,94dvh/);
  assert.match(css,/pn-editor-grid-schedule-time/);
  assert.match(css,/\.pn-copy-review-stage\{/);
  assert.doesNotMatch(schedule+copy+frame+viewport,/localStorage\.setItem\(|runTransaction\(|getDatabase\(/);
});


test('Palette dirty editors guard exit paths without adding another storage layer',()=>{
  const helpers=shell.slice(shell.indexOf('  const editorOriginalValues=new WeakMap();'),
    shell.indexOf('  function editorOptions(',shell.indexOf('  const editorOriginalValues=new WeakMap();')));
  const route=shell.slice(shell.indexOf('  function switchPaletteRoute('),
    shell.indexOf("  root.addEventListener('click',event=>",shell.indexOf('  function switchPaletteRoute(')));
  const click=shell.slice(shell.indexOf("  root.addEventListener('click',event=>"),
    shell.indexOf("  root.addEventListener('submit',event=>"));
  assert.match(helpers,/const editorOriginalValues=new WeakMap\(\)/);
  assert.match(helpers,/new FormData\(form\)\.entries\(\)/);
  assert.match(helpers,/function editorHasChanges\(\)/);
  assert.match(helpers,/function todoDetailHasChanges\(\)/);
  assert.match(helpers,/window\.confirm\('未保存の変更があります。保存せずに破棄しますか？'\)/);
  assert.match(click,/if\(target\.hasAttribute\('data-pn-close'\)\|\|target\.hasAttribute\('data-pn-cancel'\)\)\{\s*if\(!confirmLeaveEditor\(\)\)return/);
  assert.match(click,/const resume=target\.hasAttribute\('data-pn-cancel'\)\?scheduleEditReturn:null/);
  assert.match(click,/if\(resume&&resume\.route===state\.route&&[\s\S]*?state\.detail=\{kind:'schedule',id:resume\.id\}/);
  assert.match(click,/\}else closeDetail\(\);\s*return;/);
  assert.match(click,/if\(target\.hasAttribute\('data-pn-copy-back'\)\)\{\s*if\(!confirmLeaveEditor\(\)\)return/);
  assert.match(route,/if\(\(state\.editor\|\|state\.detail\)&&!confirmLeaveEditor\(\)\)return false/);
  assert.match(shell,/if\(requested!=='palette'&&\(state\.detail\|\|state\.editor\)&&!confirmLeaveEditor\(\)\)/);
  assert.match(shell,/if\(event\.key==='Escape'&&\(state\.detail\|\|state\.editor\)\)\{[\s\S]*?if\(!confirmLeaveEditor\(\)\)return/);
  assert.match(shell,/const returnBaseline=editor\.returnBaseline/);
  assert.match(shell,/rememberEditorValues\(form,returnBaseline\)/);
  assert.match(shell,/rememberEditorValues\(drawer\.querySelector\('\.pn-editor-form'\)\)/);
  assert.match(shell,/data-pn-editor-feedback role="alert" hidden/);
  assert.match(shell,/root\.addEventListener\('invalid',event=>/);
  assert.match(shell,/showEditorIssue\(editedForm,message/);
  assert.match(css,/\.pn-editor-feedback\[hidden\]\{display:none\}/);
  assert.doesNotMatch(helpers,/localStorage\.setItem\(|getDatabase\(|runTransaction\(/);
});


test('Palette confirms actual saved schedule IDs before offering a navigation action',()=>{
  const start=shell.indexOf('  function confirmedScheduleReview(');
  const end=shell.indexOf('  function dateParts(',start);
  assert.ok(start>0&&end>start);
  const reviewCode=shell.slice(start,end);
  let latest={};
  const bridge={readSnapshot:()=>latest};
  const review=new Function('bridge','localDate',
    reviewCode+'return confirmedScheduleReview;')(bridge,value=>String(value).slice(0,10));
  const before={currentUser:'職員A',schedules:[
    {id:'old',title:'既存予定',startAt:'2026-11-06T08:00'}]};
  latest={currentUser:'職員A',schedules:[
    ...before.schedules,{id:'new',title:'新規予定',startAt:'2026-11-09T09:00'}]};
  assert.deepEqual(review({type:'schedule.create',values:{title:'新規予定'}},before,{ok:true}),
    {id:'new',day:'2026-11-09',user:'職員A',count:1});
  assert.deepEqual(review({type:'schedule.update',id:'old'},before,{ok:true}),
    {id:'old',day:'2026-11-06',user:'職員A',count:1});
  latest={currentUser:'職員A',schedules:[
    ...before.schedules,{id:'late',title:'繰り返し',startAt:'2026-11-16T09:00'},
    {id:'early',title:'繰り返し',startAt:'2026-11-09T09:00'}]};
  assert.deepEqual(review({type:'schedule.batch',values:{title:'繰り返し'}},
    before,{ok:true,count:2}),
    {id:'early',day:'2026-11-09',user:'職員A',count:2});
  assert.equal(review({type:'schedule.batch',values:{title:'存在しない'}},before,{ok:true}),null);
  latest.currentUser='職員B';
  assert.equal(review({type:'schedule.batch',values:{title:'繰り返し'}},before,{ok:true}),null);
  assert.equal(review({type:'schedule.create',values:{title:'新規予定'}},before,{ok:false}),null);
  assert.match(shell,/action\.dataset\.pnSavedSchedule=review\.id/);
  assert.match(shell,/action\.dataset\.pnSavedUser=review\.user/);
  assert.match(shell,/if\(target\.hasAttribute\('data-pn-saved-schedule'\)\)/);
  assert.match(shell,/snap\.currentUser!==user\|\|state\.snapshot\.currentUser!==user/);
  assert.match(shell,/state\.queries\.schedule='';state\.scrollPositions\.schedule=0/);
  assert.match(shell,/const sortedDates=\[\.\.\.\(result\.dates\|\|\[\]\)\]\.sort\(\)/);
  assert.match(shell,/class="pn-copy-review-meta"/);
  assert.match(css,/\.pn-toast-action\{/);
  assert.match(css,/\.pn-copy-review-meta\{/);
  assert.doesNotMatch(reviewCode,/localStorage\.setItem\(|runTransaction\(|getDatabase\(/);
});


test('Palette recurring schedules expose a single read-only series index and a safe Classic deletion path',()=>{
  const start=shell.indexOf('  function seriesOccurrences(item) {');
  const end=shell.indexOf('  function schedulePage()',start);
  const panelStart=shell.indexOf('  function inspectorSeriesContext(item) {');
  const panelEnd=shell.indexOf('  function inspectorScheduleContext(',panelStart);
  assert.ok(start>0&&end>start&&panelStart>0&&panelEnd>panelStart);
  const sample=[
    {id:'third',recurrenceSeriesId:'series-A',title:'定例',startAt:'2027-11-15T10:00',endAt:'2027-11-15T11:00'},
    {id:'foreign',recurrenceSeriesId:'series-B',title:'別系列',startAt:'2027-11-07T08:00',endAt:'2027-11-07T09:00'},
    {id:'first',recurrenceSeriesId:'series-A',title:'定例',startAt:'2027-11-01T10:00',endAt:'2027-11-01T11:00'},
    {id:'single',title:'単発予定',startAt:'2027-11-01T13:00',endAt:'2027-11-01T14:00'},
    {id:'second',recurrenceSeriesId:'series-A',title:'定例',startAt:'2027-11-08T10:00',endAt:'2027-11-08T11:00'}
  ];
  const state={route:'schedule',snapshot:{schedules:sample,tasks:[]}};
  const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  const ld=v=>String(v).slice(0,10),lt=v=>String(v).slice(11,16);
  const date=v=>String(v).slice(5).replace('-','/');
  const funcs=new Function('state','escape','localDate','localTime','dateParts',
    shell.slice(start,end)+'return {seriesOccurrences,scheduleRow};')(state,esc,ld,lt,date);
  const reviewed=new Set();
  const context=new Function('escape','localDate','localTime','dateParts','seriesOccurrences',
    'inspectorReturnPoint','state','seriesIndexMarkup','currentSeriesIndex',
    shell.slice(panelStart,panelEnd)+'return inspectorSeriesContext;')
    (esc,ld,lt,date,funcs.seriesOccurrences,null,state,()=> '',
      ()=>({viewed:{add:id=>reviewed.add(id)}}));
  const order=funcs.seriesOccurrences(sample[0]).map(row=>row.id);
  assert.deepEqual(order,['first','second','third']);
  assert.deepEqual(funcs.seriesOccurrences(sample[3]),[]);
  const recurringRow=funcs.scheduleRow(sample[2]);
  const regularRow=funcs.scheduleRow(sample[3]);
  assert.match(recurringRow,/data-pn-recurring="true"/);
  assert.match(recurringRow,/pn-schedule-series-badge/);
  assert.match(recurringRow,/繰り返し · 3件/);
  assert.doesNotMatch(regularRow,/data-pn-recurring|pn-schedule-series-badge/);
  const middle=context(sample[4]),first=context(sample[2]);
  assert.equal(reviewed.has('second'),true);
  assert.match(middle,/3件登録済み · 2件目/);
  assert.match(middle,/data-pn-series-open="first"/);
  assert.match(middle,/data-pn-series-open="third"/);
  assert.doesNotMatch(middle,/data-pn-series-open="foreign"/);
  assert.match(first,/3件登録済み · 1件目/);
  assert.doesNotMatch(first,/data-pn-series-open="first"/);
  assert.match(first,/class="pn-series-jump is-unavailable"/);
  assert.equal(context(sample[3]),'');
  const click=shell.slice(shell.indexOf("    if(target.dataset.pnSeriesOpen){"),
    shell.indexOf('    if(target.dataset.pnLinkedTask){'));
  assert.match(click,/seriesOccurrences\(current\)\.find\(row=>row\.id===target\.dataset\.pnSeriesOpen\)/);
  assert.match(click,/if\(!next\)return/);
  assert.match(click,/modeController\.selectMode\('classic'\)/);
  assert.doesNotMatch(click,/bridge\.dispatch\(|schedule\.delete/);
  assert.match(shell,/item\.recurrenceSeriesId\s*\?\s*'<button class="pn-button flat pn-series-classic-action"/);
  assert.match(css,/\.pn-schedule-series-badge\{/);
  assert.match(css,/\.pn-series-neighbors\{/);
  assert.match(css,/\.pn-series-jump[\s\S]*?min-height:55px/);
});


test('Palette optional series view groups canonical weekly occurrences without hiding search matches',()=>{
  const from=shell.indexOf('  function scheduleSeriesPage(');
  const to=shell.indexOf('  function schedulePage()',from);
  assert.ok(from>0&&to>from);
  const src=shell.slice(from,to);
  const first='2027-11-01',second='2027-11-02',third='2027-11-03';
  const events=[
    {id:'s1',recurrenceSeriesId:'A',title:'週内定例',startAt:first+'T09:00'},
    {id:'single1',title:'単発会議',startAt:first+'T11:00'},
    {id:'s2',recurrenceSeriesId:'A',title:'週内定例',startAt:second+'T09:00'},
    {id:'s3',recurrenceSeriesId:'A',title:'週内定例',startAt:third+'T09:00'},
    {id:'s4',recurrenceSeriesId:'B',title:'別の定例',startAt:third+'T12:00'}
  ];
  const days=['2027-11-01','2027-11-02','2027-11-03',
    '2027-11-04','2027-11-05','2027-11-06','2027-11-07'];
  const items=new Map(days.map(day=>[day,events.filter(e=>e.startAt.startsWith(day))]));
  const state={query:'',expandedSeriesGroups:new Set()};
  const escape=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const scheduleRow=item=>'<button data-pn-detail="schedule" data-id="'+escape(item.id)+'">'+
    escape(item.title)+'</button>';
  const seriesOccurrences=item=>events.filter(e=>e.recurrenceSeriesId===item.recurrenceSeriesId);
  const localDate=v=>String(v).slice(0,10);
  const dateParts=v=>String(v).slice(5).replace('-','/');
  const overviewStart=shell.indexOf('  function scheduleSeriesOverview(');
  const overviewEnd=shell.indexOf('  function scheduleRow(',overviewStart);
  const overviewCode=shell.slice(overviewStart,overviewEnd);
  const localTime=v=>String(v).slice(11,16);
  const grouped=new Function('state','scheduleRow','seriesOccurrences','localDate','localTime',
    'dateParts','escape','nearestSeriesWeek',overviewCode+src+'return scheduleSeriesPage;')
    (state,scheduleRow,seriesOccurrences,localDate,localTime,dateParts,escape,()=> '');
  const collapsed=grouped(items,days);
  assert.match(collapsed,/2系列 · 繰り返し 4件 · 単発 1件/);
  assert.match(collapsed,/週内定例/);
  assert.match(collapsed,/この週 3件 · 系列全体 3件/);
  assert.match(collapsed,/data-pn-series-sort/);
  assert.match(collapsed,/直近の予定順/);
  assert.match(collapsed,/pn-series-week-upcoming/);
  assert.match(collapsed,/pn-series-week-count/);

  assert.match(collapsed,/登録期間 <strong>2027\/11\/1 〜 2027\/11\/3/);
  assert.match(collapsed,/表示週以降 <strong>3件/);
  assert.match(collapsed,/次週以降の予定<\/span><strong>この週が最終/);
  assert.match(collapsed,/単発会議/);
  assert.equal((collapsed.match(/data-pn-series-week=/g)||[]).length,2);
  assert.equal((collapsed.match(/data-pn-detail="schedule"/g)||[]).length,1);
  assert.match(collapsed,/aria-expanded="false"/);
  assert.match(collapsed,/pn-series-week-items[^>]+hidden/);
  state.expandedSeriesGroups.add('A');
  const expanded=grouped(items,days);
  assert.equal((expanded.match(/data-pn-detail="schedule"/g)||[]).length,4);
  assert.match(expanded,/data-id="s1"/);
  assert.match(expanded,/data-id="s2"/);
  assert.match(expanded,/data-id="s3"/);
  assert.doesNotMatch(expanded,/data-pn-detail="schedule" data-id="s4"/);
  assert.match(expanded,/aria-expanded="true"/);
  state.expandedSeriesGroups.clear();
  state.query='週内定例';
  const searched=grouped(new Map(days.map(day=>[day,
    items.get(day).filter(item=>item.title.includes(state.query))])),days);
  assert.equal((searched.match(/data-pn-detail="schedule"/g)||[]).length,3);
  assert.doesNotMatch(searched,/data-pn-series-group-toggle=/);
  assert.match(searched,/検索結果を表示中/);
  assert.doesNotMatch(searched,/単発会議/);
  state.query='';
  assert.match(grouped(new Map(days.map(day=>[day,
    items.get(day).filter(item=>!item.recurrenceSeriesId)])),days),
    /この週に該当する繰り返し予定はありません/);
  assert.match(shell,/scheduleView:'day', seriesSort:'upcoming', expandedSeriesGroups:new Set\(\)/);
  assert.match(shell,/state\.expandedSeriesGroups\.clear\(\)/);
  assert.match(shell,/\['day','1日'\],\['week','週間一覧'\],\['series','系列で見る'\]/);
  assert.match(shell,/if\(!\['day','week','series'\]\.includes\(target\.dataset\.pnScheduleView\)\)return/);
  assert.match(shell,/if\(target\.hasAttribute\('data-pn-series-group-toggle'\)\)/);
  assert.match(shell,/button\.dataset\.pnSeriesGroupToggle===id/);
  assert.match(css,/\.pn-series-week-grid\{/);
  assert.match(css,/\.pn-series-week-items\[hidden\]\{display:none\}/);
  assert.doesNotMatch(src,/localStorage\.setItem\(|runTransaction\(|getDatabase\(/);
});


test('Palette series search and date jumps follow only matching recurring weeks without data writes',()=>{
  const start=shell.indexOf('  function matchingScheduleSeries() {');
  const end=shell.indexOf('  function scheduleSeriesPage(',start);
  assert.ok(start>0&&end>start);
  const code=shell.slice(start,end);
  const state={query:'',selectedDay:'2027-11-10',snapshot:{schedules:[
    {id:'a1',title:'会議準備',recurrenceSeriesId:'A',startAt:'2027-11-01T10:00'},
    {id:'single',title:'会議準備',startAt:'2027-11-09T09:00'},
    {id:'a2',title:'件名を変更済み',recurrenceSeriesId:'A',startAt:'2027-11-17T10:00'},
    {id:'b1',title:'別の定例',recurrenceSeriesId:'B',startAt:'2027-11-22T12:00'},
    {id:'a3',title:'件名を変更済み',recurrenceSeriesId:'A',startAt:'2027-12-01T10:00'}
  ]}};
  const localDate=value=>{
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return '';
    return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),
      String(date.getDate()).padStart(2,'0')].join('-');
  };
  const scheduleMatches=item=>String(item.title||'').includes(state.query);
  const {matchingScheduleSeries,scheduleWeekStart,nearestSeriesWeek}=
    new Function('state','scheduleMatches','localDate',
      code+'return {matchingScheduleSeries,scheduleWeekStart,nearestSeriesWeek};')
      (state,scheduleMatches,localDate);
  assert.equal(scheduleWeekStart('2027-11-10'),'2027-11-08');
  assert.equal(scheduleWeekStart('2027-11-15'),'2027-11-15');
  assert.equal(scheduleWeekStart('invalid'),'');
  assert.equal(nearestSeriesWeek(-1),'2027-11-01');
  assert.equal(nearestSeriesWeek(1),'2027-11-15');
  state.query='会議準備';
  assert.deepEqual([...matchingScheduleSeries()],['A']);
  assert.equal(nearestSeriesWeek(-1),'2027-11-01');
  // The second occurrence has a different title but must remain discoverable.
  assert.equal(nearestSeriesWeek(1),'2027-11-15');
  state.selectedDay='2027-11-20';
  assert.equal(nearestSeriesWeek(1),'2027-11-29');
  state.query='別の定例';
  assert.equal(nearestSeriesWeek(1),'2027-11-22');
  assert.equal(nearestSeriesWeek(-1),'');
  state.query='一致なし';
  assert.deepEqual([...matchingScheduleSeries()],[]);
  assert.equal(nearestSeriesWeek(1),'');
  assert.equal(nearestSeriesWeek(-1),'');
  assert.equal(nearestSeriesWeek(0),'');
  const page=shell.slice(shell.indexOf('  function schedulePage() {'),
    shell.indexOf('  // The canonical memo bridge already owns',shell.indexOf('  function schedulePage() {')));
  assert.match(page,/const matchedSeries=state\.scheduleView==='series'&&state\.query\.trim\(\)/);
  assert.match(page,/matchedSeries\.has\(item\.recurrenceSeriesId\)/);
  assert.match(page,/relatedMatch\|\|scheduleMatches\(item\)/);
  const series=shell.slice(shell.indexOf('  function scheduleSeriesPage('),
    shell.indexOf('  function schedulePage() {'));
  assert.match(series,/data-pn-edit="schedule" data-id=/);
  assert.match(series,/今週最初の回を編集/);
  assert.match(series,/data-pn-series-week-jump="-1"/);
  assert.match(series,/data-pn-series-week-jump="1"/);
  assert.match(series,/系列の各回を含む/);
  assert.match(shell,/state\.selectedDay=week;\s*render\(\)/);
  assert.match(shell,/if\(!week\)return/);
  assert.match(css,/\.pn-series-week-nav\{/);
  assert.match(css,/\.pn-series-week-edit\{/);
  assert.doesNotMatch(code+series,/localStorage\.setItem\(|runTransaction\(|getDatabase\(/);
});

test('Palette schedule series inspector returns to the occurrence week and resumes a single edit',()=>{
  const panelStart=shell.indexOf('  function inspectorSeriesContext(item) {');
  const panelEnd=shell.indexOf('  function inspectorScheduleContext(',panelStart);
  const panel=shell.slice(panelStart,panelEnd);
  assert.match(panel,/data-pn-series-show-week=/);
  assert.match(panel,/この回がある週を一覧で見る/);
  const showWeek=shell.slice(shell.indexOf('    if(target.dataset.pnSeriesShowWeek){'),
    shell.indexOf('    if(target.dataset.pnSeriesOpen){'));
  assert.match(showWeek,/item\.id!==state\.detail\.id/);
  assert.match(showWeek,/state\.selectedDay=day/);
  assert.match(showWeek,/state\.scheduleView='series'/);
  assert.match(showWeek,/state\.expandedSeriesGroups\.add\(item\.recurrenceSeriesId\)/);
  assert.match(showWeek,/matchingScheduleSeries\(\)\.has\(item\.recurrenceSeriesId\)/);
  assert.match(showWeek,/closeDetail\(false\)/);
  assert.match(showWeek,/row\.focus\(\{preventScroll:true\}\)/);
  const open=shell.slice(shell.indexOf('  function openEditor('),
    shell.indexOf('  async function changeMemoColor(',shell.indexOf('  function openEditor(')));
  assert.match(open,/rememberInspectorOrigin\('schedule',id\)/);
  assert.match(open,/scheduleEditReturn=kind==='schedule'/);
  const cancel=shell.slice(shell.indexOf("    if(target.hasAttribute('data-pn-close')"),
    shell.indexOf("    if(target.hasAttribute('data-pn-bulk-clear')"));
  assert.match(cancel,/scheduleEditReturn/);
  assert.match(cancel,/state\.detail=\{kind:'schedule',id:resume\.id\}/);
  const dispatch=shell.slice(shell.indexOf('  async function dispatch('),
    shell.indexOf('  function resetAccountViewState()'));
  assert.match(dispatch,/command\.type==='schedule\.update'&&resume/);
  assert.match(dispatch,/inspectorReturnPoint=origin/);
  assert.match(css,/\.pn-series-view-actions button\{/);
  assert.doesNotMatch(showWeek+panel,/runTransaction\(|localStorage\.setItem\(|bridge\.dispatch\(/);
});


test('Palette series overview derives week-relative dates and counts from canonical occurrences only',()=>{
  const start=shell.indexOf('  function scheduleSeriesOverview(');
  const end=shell.indexOf('  function scheduleRow(',start);
  assert.ok(start>0&&end>start);
  const code=shell.slice(start,end);
  const sample=[
    {id:'a2',recurrenceSeriesId:'A',title:'変更後',startAt:'2027-01-04T09:00'},
    {id:'b1',recurrenceSeriesId:'B',title:'別系列',startAt:'2027-01-02T08:00'},
    {id:'a3',recurrenceSeriesId:'A',title:'変更後',startAt:'2027-01-11T09:00'},
    {id:'a1',recurrenceSeriesId:'A',title:'元の件名',startAt:'2026-12-28T09:00'}
  ];
  const seriesOccurrences=item=>sample.filter(x=>x.recurrenceSeriesId===item.recurrenceSeriesId)
    .sort((a,b)=>a.startAt.localeCompare(b.startAt));
  const localDate=value=>String(value||'').slice(0,10);
  const {scheduleSeriesOverview,scheduleSeriesDateLabel}=new Function(
    'seriesOccurrences','localDate',code+
    'return {scheduleSeriesOverview,scheduleSeriesDateLabel};'
  )(seriesOccurrences,localDate);
  const first=scheduleSeriesOverview(sample[0],'2026-12-28','2027-01-03');
  assert.equal(first.total,3);
  assert.equal(first.firstDay,'2026-12-28');
  assert.equal(first.lastDay,'2027-01-11');
  assert.equal(first.fromWeekCount,3);
  assert.equal(first.next?.id,'a2');
  const second=scheduleSeriesOverview(sample[0],'2027-01-04','2027-01-10');
  assert.equal(second.fromWeekCount,2);
  assert.equal(second.next?.id,'a3');
  const last=scheduleSeriesOverview(sample[0],'2027-01-11','2027-01-17');
  assert.equal(last.fromWeekCount,1);
  assert.equal(last.next,null);
  const after=scheduleSeriesOverview(sample[0],'2027-01-18','2027-01-24');
  assert.equal(after.fromWeekCount,0);
  assert.equal(after.next,null);
  assert.equal(scheduleSeriesDateLabel(first.firstDay),'2026/12/28');
  assert.equal(scheduleSeriesDateLabel(first.lastDay),'2027/1/11');
  assert.equal(scheduleSeriesDateLabel(''), '—');
  assert.doesNotMatch(code,/bridge\.dispatch\(|runTransaction\(|localStorage\.setItem\(/);
  assert.match(css,/\.pn-series-week-facts\{/);
  assert.match(css,/\.pn-series-week-next\{/);
});


test('Palette series sorts upcoming entries first without changing occurrences or cross-user state',()=>{
  const start=shell.indexOf('  function scheduleSeriesOverview(');
  const end=shell.indexOf('  function scheduleRow(',start);
  assert.ok(start>0&&end>start);
  const code=shell.slice(start,end);
  const sample=[
    {id:'a1',recurrenceSeriesId:'A',title:'Zeta',startAt:'2027-01-04T09:00'},
    {id:'b1',recurrenceSeriesId:'B',title:'Beta',startAt:'2027-01-06T10:00'},
    {id:'b2',recurrenceSeriesId:'B',title:'Beta新版',startAt:'2027-02-01T09:00'},
    {id:'c1',recurrenceSeriesId:'C',title:'Alpha',startAt:'2027-01-07T11:00'},
    {id:'c2',recurrenceSeriesId:'C',title:'Alpha',startAt:'2027-01-15T12:00'}
  ];
  const seriesOccurrences=item=>sample.filter(x=>x.recurrenceSeriesId===item.recurrenceSeriesId)
    .sort((a,b)=>a.startAt.localeCompare(b.startAt));
  const localDate=value=>String(value||'').slice(0,10);
  const {scheduleSeriesOverview,sortScheduleSeriesGroups}=
    new Function('seriesOccurrences','localDate',code+
      'return {scheduleSeriesOverview,sortScheduleSeriesGroups};')
    (seriesOccurrences,localDate);
  const now=Date.parse('2027-01-06T09:00:00');
  const groups=['A','B','C'].map(id=>{
    const items=sample.filter(item=>item.recurrenceSeriesId===id&&
      item.startAt<'2027-01-11');
    return {id,items,overview:scheduleSeriesOverview(items[0],
      '2027-01-04','2027-01-10',now)};
  });
  assert.equal(groups[0].overview.upcoming,null);
  assert.equal(groups[0].overview.upcomingTime,Infinity);
  assert.equal(groups[1].overview.upcoming.id,'b1');
  assert.equal(groups[1].overview.total,2);
  assert.equal(groups[2].overview.upcoming.id,'c1');
  assert.deepEqual(sortScheduleSeriesGroups([...groups],'upcoming').map(x=>x.id),
    ['B','C','A']);
  assert.deepEqual(sortScheduleSeriesGroups([...groups],'week').map(x=>x.id),
    ['A','B','C']);
  assert.deepEqual(sortScheduleSeriesGroups([...groups],'title').map(x=>x.id),
    ['C','B','A']);
  assert.equal(groups[0].items[0].id,'a1');
  const expired=scheduleSeriesOverview(sample[1],'2027-01-04','2027-01-10',
    Date.parse('2027-03-01T09:00:00'));
  assert.equal(expired.upcoming,null);
  assert.equal(expired.next?.id,'b2');
  const series=shell.slice(shell.indexOf('  function scheduleSeriesPage('),
    shell.indexOf('  function schedulePage() {'));
  assert.match(series,/sortScheduleSeriesGroups\(/);
  assert.match(series,/state\.seriesSort/);
  assert.match(series,/直近の予定/);
  const change=shell.slice(shell.indexOf("  root.addEventListener('change'"),
    shell.indexOf("  root.querySelector('#pnSearch').addEventListener('input'"));
  assert.match(change,/state\.seriesSort=el\.value/);
  assert.match(change,/focusRebuiltControl\('data-pn-series-sort'\)/);
  assert.match(shell,/seriesSort:'upcoming'/);
  assert.match(shell,/state\.seriesSort='upcoming'/);
  assert.match(css,/\.pn-series-sort select\{/);
  assert.match(css,/\.pn-series-week-upcoming\{/);
  assert.doesNotMatch(code+series,/bridge\.dispatch\(|runTransaction\(|localStorage\.setItem\(/);
});


test('Palette next recurrence action opens the current canonical future entry and keeps its list origin',()=>{
  const overviewStart=shell.indexOf('  function scheduleSeriesOverview(');
  const overviewEnd=shell.indexOf('  function scheduleRow(',overviewStart);
  const pageStart=shell.indexOf('  function scheduleSeriesPage(');
  const pageEnd=shell.indexOf('  function schedulePage()',pageStart);
  const source=shell.slice(overviewStart,overviewEnd)+shell.slice(pageStart,pageEnd);
  const rows=[
    {id:'past',title:'元の件名',recurrenceSeriesId:'series-A',startAt:'2025-01-06T09:00'},
    {id:'future',title:'改題した未来の予定',recurrenceSeriesId:'series-A',startAt:'2032-08-02T13:00'},
    {id:'ended',title:'終了済み',recurrenceSeriesId:'series-B',startAt:'2025-01-07T09:00'}
  ];
  const state={query:'',seriesSort:'upcoming',expandedSeriesGroups:new Set()};
  const localDate=value=>String(value||'').slice(0,10);
  const localTime=value=>String(value||'').slice(11,16);
  const dateParts=value=>String(value||'').slice(5).replace('-','/');
  const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const seriesOccurrences=item=>rows.filter(row=>
    row.recurrenceSeriesId===item.recurrenceSeriesId)
    .sort((a,b)=>a.startAt.localeCompare(b.startAt));
  const scheduleRow=item=>'<button data-pn-detail="schedule" data-id="'+item.id+'"></button>';
  const grouped=new Function('state','scheduleRow','seriesOccurrences','localDate','localTime',
    'dateParts','escape','nearestSeriesWeek',source+'return scheduleSeriesPage;')
    (state,scheduleRow,seriesOccurrences,localDate,localTime,dateParts,escape,()=> '');
  const days=['2025-01-06','2025-01-07','2025-01-08','2025-01-09',
    '2025-01-10','2025-01-11','2025-01-12'];
  const items=new Map(days.map(day=>[day,rows.filter(row=>row.startAt.startsWith(day))]));
  const html=grouped(items,days);
  assert.match(html,/data-pn-series-week="series-A"/);
  assert.match(html,/data-pn-series-next-open="future" data-pn-series-id="series-A"/);
  assert.match(html,/改題した未来の予定/);
  assert.match(html,/type="button" class="pn-series-week-upcoming"/);
  assert.doesNotMatch(html,/data-pn-series-next-open="ended"/);
  assert.doesNotMatch(html,/data-pn-detail="schedule" data-id="future"/);
  const details=shell.slice(shell.indexOf('  function inspectorSeriesContext(item) {'),
    shell.indexOf('  function inspectorScheduleContext(',shell.indexOf('  function inspectorSeriesContext(item) {')));
  assert.match(details,/data-pn-series-return/);
  assert.match(details,/inspectorReturnPoint\?\.seriesId===item\.recurrenceSeriesId/);
  const callbacks=shell.slice(shell.indexOf("    if(target.hasAttribute('data-pn-series-return')){"),
    shell.indexOf('    if(target.dataset.pnSeriesShowWeek){'));
  assert.match(callbacks,/state\.route!=='schedule'/);
  assert.match(callbacks,/card\?\.dataset\.pnSeriesWeek!==seriesId/);
  assert.match(callbacks,/row\.recurrenceSeriesId===seriesId/);
  assert.match(callbacks,/scheduleSeriesOverview\(series,'',''\)\.upcoming/);
  assert.match(callbacks,/next\.id!==target\.dataset\.pnSeriesNextOpen/);
  assert.match(callbacks,/rememberInspectorOrigin\('schedule',next\.id\)/);
  assert.match(callbacks,/inspectorReturnPoint\.seriesId=seriesId/);
  assert.match(callbacks,/state\.detail=\{kind:'schedule',id:next\.id\}/);
  assert.match(callbacks,/closeDetail\(\);return/);
  assert.doesNotMatch(callbacks,/bridge\.dispatch\(|runTransaction\(|localStorage\.setItem\(/);
  const close=shell.slice(shell.indexOf('  function closeDetail('),
    shell.indexOf('  // Unsaved form state belongs',shell.indexOf('  function closeDetail(')));
  assert.match(close,/point\.seriesId/);
  assert.match(close,/card\.dataset\.pnSeriesWeek===point\.seriesId/);
  assert.match(close,/data-pn-series-next-open/);
  assert.match(css,/#paletteNextRoot button\.pn-series-week-upcoming\{/);
  assert.match(css,/#paletteNextRoot button\.pn-series-week-upcoming:focus-visible/);
});


test('Palette series inspector navigator spans off-week siblings without losing its original card',()=>{
  const start=shell.indexOf('  function inspectorSequenceRows(kind) {');
  const end=shell.indexOf('  function taskDetailNavigator(',start);
  assert.ok(start>0&&end>start);
  const source=shell.slice(start,end);
  const sample=[
    {id:'a3',recurrenceSeriesId:'A',title:'改題',startAt:'2027-04-19T10:00'},
    {id:'b1',recurrenceSeriesId:'B',title:'別の系列',startAt:'2027-04-05T13:00'},
    {id:'a1',recurrenceSeriesId:'A',title:'初回',startAt:'2027-04-05T09:00'},
    {id:'single',title:'単発',startAt:'2027-04-05T15:00'},
    {id:'a2',recurrenceSeriesId:'A',title:'途中の回',startAt:'2027-04-12T09:00'}
  ];
  const state={
    route:'schedule',scheduleView:'series',detail:{kind:'schedule',id:'a1'},
    snapshot:{schedules:sample,currentUser:'職員A'}
  };
  const seriesOccurrences=item=>sample.filter(row=>
    row.recurrenceSeriesId&&row.recurrenceSeriesId===item?.recurrenceSeriesId)
    .sort((a,b)=>a.startAt.localeCompare(b.startAt));
  const visibleIds=['a1','b1','single'];
  const workspace={querySelectorAll(selector){
    return selector==='[data-pn-detail="schedule"]'
      ?visibleIds.map(id=>({dataset:{id}})):[];
  }};
  const {inspectorSequenceRows,inspectorSequence}=new Function(
    'state','workspace','seriesOccurrences','visibleSortedTasks','visibleSortedMemos',
    source+'return {inspectorSequenceRows,inspectorSequence};'
  )(state,workspace,seriesOccurrences,()=>[],()=>[]);
  assert.deepEqual(inspectorSequenceRows('schedule').map(row=>row.id),['a1','a2','a3']);
  assert.match(inspectorSequence('schedule','a1'),/系列内 1 \/ 3/);
  assert.match(inspectorSequence('schedule','a2'),/系列内 2 \/ 3/);
  assert.match(inspectorSequence('schedule','a3'),/系列内 3 \/ 3/);
  assert.match(inspectorSequence('schedule','a2'),/data-pn-series-position="true"/);
  assert.doesNotMatch(inspectorSequence('schedule','a1'),/別の系列/);
  state.scheduleView='week';
  assert.deepEqual(inspectorSequenceRows('schedule').map(row=>row.id),visibleIds);
  assert.doesNotMatch(inspectorSequence('schedule','a1'),/系列内/);
  state.scheduleView='series';
  state.detail.id='b1';
  assert.deepEqual(inspectorSequenceRows('schedule').map(row=>row.id),['b1']);

  const click=shell.slice(shell.indexOf("    if(target.hasAttribute('data-pn-inspect-step'))"),
    shell.indexOf("    if(target.hasAttribute('data-pn-series-return'))"));
  const sibling=shell.slice(shell.indexOf('    if(target.dataset.pnSeriesOpen){'),
    shell.indexOf("    if(target.hasAttribute('data-pn-series-classic'))"));
  const close=shell.slice(shell.indexOf('  function closeDetail('),
    shell.indexOf('  // Unsaved form state belongs',shell.indexOf('  function closeDetail(')));
  const launch=shell.slice(shell.indexOf('    if(target.dataset.pnSeriesNextOpen){'),
    shell.indexOf('    if(target.dataset.pnSeriesShowWeek){'));
  const openRow=shell.slice(shell.indexOf('    if(target.dataset.pnDetail) {'),
    shell.indexOf('    if(target.dataset.pnCmd) {'));
  assert.match(click,/const keepSeriesOrigin=/);
  assert.match(click,/if\(!keepSeriesOrigin\)\{/);
  assert.match(sibling,/if\(visible&&!keepSeriesOrigin\)\{/);
  assert.match(close,/const restored=seriesCard\?/);
  assert.match(close,/originalSeriesButton\|\|seriesCard\.querySelector/);
  assert.match(close,/point\?\.seriesOrigin==='row'/);
  assert.match(launch,/inspectorReturnPoint\.seriesOrigin='upcoming'/);
  assert.match(openRow,/inspectorReturnPoint\.seriesOrigin='row'/);
  assert.match(css,/\.pn-inspect-sequence-position\[data-pn-series-position="true"\]/);
  assert.doesNotMatch(source+click+sibling+close,
    /getDatabase\(|runTransaction\(|localStorage\.setItem\(/);
});


test('Palette series edit review shows the exact occurrence and offers the next one only after a confirmed save',()=>{
  const editorStart=shell.indexOf('  function scheduleEditorMarkup(');
  const editorEnd=shell.indexOf('  function scheduleCopyMarkup(',editorStart);
  const reviewStart=shell.indexOf('  function scheduleSavedReviewMarkup(');
  const reviewEnd=shell.indexOf('  function inspectorSeriesContext(',reviewStart);
  assert.ok(editorStart>0&&editorEnd>editorStart&&reviewStart>0&&reviewEnd>reviewStart);
  const occurrences=[
    {id:'a2',title:'変更 & 確認',startAt:'2027-01-12T09:00',
      endAt:'2027-01-12T10:00',recurrenceSeriesId:'A'},
    {id:'b1',title:'別系列',startAt:'2027-01-06T08:00',
      endAt:'2027-01-06T09:00',recurrenceSeriesId:'B'},
    {id:'a1',title:'最初',startAt:'2027-01-05T09:00',
      endAt:'2027-01-05T10:00',recurrenceSeriesId:'A'},
    {id:'a3',title:'最後',startAt:'2027-01-19T09:00',
      endAt:'2027-01-19T10:00',recurrenceSeriesId:'A'}
  ];
  const state={route:'schedule',scheduleView:'series',selectedDay:'2027-01-12',
    snapshot:{currentUser:'職員A',roomId:'room1',schedules:occurrences,
      users:['職員A'],assignees:['職員A'],categories:['通常'],tasks:[]}};
  const seriesOccurrences=item=>occurrences.filter(row=>
    row.recurrenceSeriesId===item?.recurrenceSeriesId)
    .sort((a,b)=>a.startAt.localeCompare(b.startAt));
  const escape=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const localDate=v=>String(v||'').slice(0,10);
  const localTime=v=>String(v||'').slice(11,16);
  const scheduleSeriesDateLabel=v=>String(v||'').replaceAll('-','/');
  const editor=new Function('state','seriesOccurrences','scheduleSeriesDateLabel',
    'escape','localDate','localTime','localDateTimeInput','currentDate',
    'editorSection','editorInput','editorSelect','editorTextArea','editorFrame',
    shell.slice(editorStart,editorEnd)+'return scheduleEditorMarkup;'
  )(state,seriesOccurrences,scheduleSeriesDateLabel,escape,localDate,localTime,
    v=>v,()=>state.selectedDay,(number,title,body)=>body,
    (label,name,value)=>'<input name="'+name+'" value="'+escape(value||'')+'">',
    ()=>'select',()=>'<textarea></textarea>',(kind,title,kicker,body)=>body);
  const edit=editor(occurrences[0]);
  assert.match(edit,/この1件だけを編集/);
  assert.match(edit,/系列内 2 \/ 3/);
  assert.match(edit,/元の日時：2027\/01\/12 09:00/);
  assert.doesNotMatch(edit,/別系列/);
  assert.doesNotMatch(editor(null),/pn-series-edit-scope/);
  assert.doesNotMatch(editor({...occurrences[0],recurrenceSeriesId:''}),
    /pn-series-edit-scope/);
  const saved={id:'a2',seriesId:'A',user:'職員A',room:'room1',route:'schedule'};
  const confirmation=new Function('scheduleSavedReview','state','seriesOccurrences',
    'escape','scheduleSeriesDateLabel','localDate','localTime',
    shell.slice(reviewStart,reviewEnd)+'return scheduleSavedReviewMarkup;'
  )(saved,state,seriesOccurrences,escape,scheduleSeriesDateLabel,localDate,localTime);
  const result=confirmation(occurrences[0]);
  assert.match(result,/role="status"/);
  assert.match(result,/この回の変更を保存しました/);
  assert.match(result,/系列内 2 \/ 3/);
  assert.match(result,/data-pn-series-save-next="a3"/);
  assert.match(result,/pn-series-save-next-title/);
  assert.doesNotMatch(result,/data-pn-series-save-next="b1"/);
  saved.id='a3';
  assert.match(confirmation(occurrences[3]),/これが系列の最後の回です/);
  assert.doesNotMatch(confirmation(occurrences[3]),/data-pn-series-save-next/);
  saved.room='another-room';
  assert.equal(confirmation(occurrences[3]),'');
  saved.room='room1';saved.user='別の利用者';
  assert.equal(confirmation(occurrences[3]),'');
  saved.user='職員A';state.scheduleView='week';
  assert.equal(confirmation(occurrences[3]),'');
  const flow=shell.slice(shell.indexOf('  async function dispatch('),
    shell.indexOf('  // Clearing the user',shell.indexOf('  async function dispatch(')));
  assert.match(flow,/if\(result\?\.ok\)/);
  assert.match(flow,/resume\.room===state\.snapshot\.roomId/);
  assert.match(flow,/scheduleSavedReview=saved\.recurrenceSeriesId/);
  assert.match(shell,/scheduleSavedReviewMarkup\(item\)/);
  const nextClick=shell.slice(shell.indexOf('    if(target.dataset.pnSeriesSaveNext){'),
    shell.indexOf("    if(target.hasAttribute('data-pn-inspect-step'))"));
  assert.match(nextClick,/review\.room!==state\.snapshot\.roomId/);
  assert.match(nextClick,/next\.id!==target\.dataset\.pnSeriesSaveNext/);
  assert.match(nextClick,/step\.click\(\)/);
  assert.doesNotMatch(nextClick,/bridge\.dispatch\(|runTransaction\(|localStorage\.setItem\(/);
  assert.match(css,/\.pn-series-edit-scope\{/);
  assert.match(css,/\.pn-series-save-review\{/);
  assert.match(css,/\.pn-series-save-next:focus-visible\{/);
});


test('Palette recurrence comparison searches renamed instances and pages without changing canonical data',()=>{
  const start=shell.indexOf('  function currentSeriesIndex(item) {');
  const end=shell.indexOf('  function inspectorScheduleContext(',start);
  assert.ok(start>0&&end>start);
  const source=shell.slice(start,end);
  const rows=Array.from({length:21},(_,i)=>({
    id:'A'+(i+1),recurrenceSeriesId:'A',
    title:i===13?'夜間の追加予定':'定例ミーティング',
    startAt:'2027-02-'+String(i+1).padStart(2,'0')+'T09:00',
    assignee:i%2?'職員B':'職員A',category:i===13?'夜間':'会議'
  }));
  rows.push({id:'B',recurrenceSeriesId:'B',title:'他系列',
    startAt:'2027-02-01T10:00',assignee:'別部署'});
  rows.push({id:'single',title:'単発予定',startAt:'2027-02-02T09:00'});
  const state={route:'schedule',scheduleView:'series',
    snapshot:{schedules:rows,currentUser:'職員A',roomId:'room-A'}};
  const escape=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const localDate=v=>String(v||'').slice(0,10);
  const localTime=v=>String(v||'').slice(11,16);
  const dateLabel=day=>day.replace(/^(\d{4})-(\d{2})-(\d{2})$/,
    (_,year,month,date)=>year+'/'+Number(month)+'/'+Number(date));
  const seriesOccurrences=item=>rows.filter(x=>item?.recurrenceSeriesId&&
    x.recurrenceSeriesId===item.recurrenceSeriesId)
    .sort((a,b)=>a.startAt.localeCompare(b.startAt));
  const funcs=new Function('state','escape','localDate','localTime','dateParts',
    'scheduleSeriesDateLabel','seriesOccurrences','inspectorReturnPoint',
    'let seriesIndexState=null;\n'+source+
    'return {currentSeriesIndex,filteredSeriesIndex,seriesIndexResults,'+
    'seriesIndexMarkup,inspectorSeriesContext};'
  )(state,escape,localDate,localTime,v=>v.slice(5),dateLabel,seriesOccurrences,null);
  const item=rows[0];
  const index=funcs.currentSeriesIndex(item);
  const initial=funcs.inspectorSeriesContext(item);
  assert.match(initial,/系列の予定一覧から選ぶ/);
  assert.match(initial,/21件の日時・件名・担当者を比較/);
  assert.doesNotMatch(initial,/data-pn-series-index open/);
  assert.match(initial,/1 \/ 3ページ/);
  assert.match(initial,/data-pn-series-index-open="A1"[^>]*aria-current="true"/);
  assert.match(initial,/data-pn-series-index-open="A8"/);
  assert.doesNotMatch(initial,/data-pn-series-index-open="A9"/);
  assert.doesNotMatch(initial,/data-pn-series-index-open="B"/);
  assert.equal((initial.match(/data-pn-series-index-open=/g)||[]).length,8);
  index.open=true;index.page=1;
  const middle=funcs.seriesIndexMarkup(item);
  assert.match(middle,/data-pn-series-index open/);
  assert.match(middle,/2 \/ 3ページ/);
  assert.match(middle,/data-pn-series-index-open="A9"/);
  assert.doesNotMatch(middle,/data-pn-series-index-open="A17"/);
  index.page=2;
  assert.equal((funcs.seriesIndexResults(item).match(/data-pn-series-index-open=/g)||[]).length,5);
  index.query='夜間';
  assert.deepEqual(funcs.filteredSeriesIndex(item).map(row=>row.id),['A14']);
  assert.match(funcs.seriesIndexResults(item),/data-pn-series-index-open="A14"/);
  assert.equal(index.page,0);
  index.query='職員b';
  assert.equal(funcs.filteredSeriesIndex(item).length,10);
  index.query='2027/2/14';
  assert.deepEqual(funcs.filteredSeriesIndex(item).map(row=>row.id),['A14']);
  index.query='該当なし';
  assert.match(funcs.seriesIndexResults(item),/一致する予定はありません/);
  index.query='';index.page=1;
  funcs.inspectorSeriesContext(rows[9]);
  assert.equal(funcs.currentSeriesIndex(rows[9]),index);
  assert.equal(index.page,1);
  assert.equal(index.open,true);
  funcs.inspectorSeriesContext(rows[21]); // Different series resets search and expansion.
  assert.equal(funcs.currentSeriesIndex(rows[21]).seriesId,'B');
  assert.equal(funcs.currentSeriesIndex(rows[21]).open,false);
  assert.equal(funcs.currentSeriesIndex(rows[21]).query,'');
  const events=shell.slice(shell.indexOf('    if(target.dataset.pnSeriesIndexOpen){'),
    shell.indexOf("    if(target.hasAttribute('data-pn-series-return'))"));
  assert.match(events,/seriesOccurrences\(current\)/);
  assert.match(events,/seriesIndexState\?\.seriesId!==current\.recurrenceSeriesId/);
  assert.match(events,/state\.detail=\{kind:'schedule',id:targetRow\.id\}/);
  assert.match(events,/refreshSeriesIndexResults\(\)/);
  const input=shell.slice(shell.indexOf("  root.addEventListener('input'"),
    shell.indexOf("  root.addEventListener('change'"));
  assert.match(input,/data-pn-series-index-search/);
  assert.match(input,/seriesIndexState\.page=0/);
  const close=shell.slice(shell.indexOf('  function closeDetail('),
    shell.indexOf('  // Unsaved form state belongs'));
  assert.match(close,/seriesIndexState=null/);
  assert.match(shell,/seriesIndexState=indexBeforeSave/);
  assert.match(css,/\.pn-series-index-item\{/);
  assert.match(css,/\.pn-series-index-pages button\{/);
  assert.doesNotMatch(source+events,/bridge\.dispatch\(|runTransaction\(|localStorage\.setItem\(/);
});


test('Palette series comparison edits exactly the visible occurrence with a stable return',()=>{
  const begin=shell.indexOf('  function currentSeriesIndex(item) {');
  const end=shell.indexOf('  function inspectorSeriesContext(item) {',begin);
  assert.ok(begin>0&&end>begin);
  const rows=Array.from({length:12},(_,i)=>({
    id:'A'+(i+1),recurrenceSeriesId:'A',
    title:i===9?'変更 & 特別会議':'定例会議',
    startAt:'2027-02-'+String(i+1).padStart(2,'0')+'T09:00',
    assignee:i%2?'職員B':'職員A',category:'会議'
  }));
  rows.push({id:'foreign',recurrenceSeriesId:'B',title:'別系列',
    startAt:'2027-02-01T13:00'});
  const state={route:'schedule',scheduleView:'series',detail:{kind:'schedule',id:'A1'},
    snapshot:{schedules:rows,currentUser:'職員A',roomId:'room1'}};
  const escape=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const localDate=v=>String(v||'').slice(0,10);
  const localTime=v=>String(v||'').slice(11,16);
  const seriesOccurrences=item=>rows.filter(x=>
    x.recurrenceSeriesId===item?.recurrenceSeriesId)
    .sort((a,b)=>a.startAt.localeCompare(b.startAt));
  const fns=new Function('state','escape','localDate','localTime',
    'scheduleSeriesDateLabel','seriesOccurrences',
    'let seriesIndexState=null;\n'+shell.slice(begin,end)+
    'return {currentSeriesIndex,filteredSeriesIndex,seriesIndexResults};'
  )(state,escape,localDate,localTime,v=>String(v).replaceAll('-','/'),seriesOccurrences);
  const index=fns.currentSeriesIndex(rows[0]);index.open=true;
  const first=fns.seriesIndexResults(rows[0]);
  assert.equal((first.match(/data-pn-series-index-open=/g)||[]).length,8);
  assert.equal((first.match(/data-pn-series-index-edit=/g)||[]).length,8);
  assert.match(first,/<\/button><button type="button" class="pn-series-index-edit"/);
  assert.doesNotMatch(first,/data-pn-series-index-edit="foreign"/);
  index.page=1;
  const second=fns.seriesIndexResults(rows[0]);
  assert.equal((second.match(/data-pn-series-index-edit=/g)||[]).length,4);
  assert.match(second,/data-pn-series-index-edit="A10"/);
  assert.match(second,/変更 &amp; 特別会議/);
  assert.doesNotMatch(second,/data-pn-series-index-edit="A1"/);
  const a=shell.indexOf('    if(target.dataset.pnSeriesIndexEdit){');
  const b=shell.indexOf("    if(target.hasAttribute('data-pn-series-review-index'))",a);
  assert.ok(a>0&&b>a);
  const handler=shell.slice(a,b);
  let opened=null;
  const control={dataset:{pnSeriesIndexEdit:'A10'},closest:()=>({})};
  const click=new Function('state','seriesIndexState','filteredSeriesIndex','openEditor',
    'let scheduleSavedReview={id:"old"};'+
    'function run(target){'+handler+'}'+
    'return {run,review:()=>scheduleSavedReview};'
  )(state,index,fns.filteredSeriesIndex,(kind,id,button)=>{
    opened={kind,id,button,detailId:state.detail.id};
  });
  click.run(control);
  assert.deepEqual(opened,{kind:'schedule',id:'A10',button:control,detailId:'A10'});
  assert.equal(click.review(),null);
  assert.equal(index.page,1);assert.equal(index.open,true);
  opened=null;control.dataset.pnSeriesIndexEdit='A1';
  click.run(control);
  assert.equal(opened,null); // An off-page stale button is rejected.
  state.detail={kind:'schedule',id:'foreign'};
  control.dataset.pnSeriesIndexEdit='A10';
  click.run(control);
  assert.equal(opened,null); // Another series cannot be edited through A.
  const editor=shell.slice(shell.indexOf('  function openEditor('),
    shell.indexOf('  async function changeMemoColor('));
  assert.match(editor,/viaSeriesIndex:Boolean/);
  const cancel=shell.slice(shell.indexOf("    if(target.hasAttribute('data-pn-close')"),
    shell.indexOf("    if(target.hasAttribute('data-pn-bulk-clear')"));
  assert.match(cancel,/resume\.room===state\.snapshot\.roomId/);
  assert.match(cancel,/returnToList=resume\.viaSeriesIndex/);
  const flow=shell.slice(shell.indexOf('  async function dispatch('),
    shell.indexOf('  // Clearing the user'));
  assert.match(flow,/viaSeriesIndex:Boolean\(resume\.viaSeriesIndex\)/);
  assert.match(flow,/scheduleSavedReview=saved\.recurrenceSeriesId/);
  const saved=shell.slice(shell.indexOf('  function scheduleSavedReviewMarkup('),
    shell.indexOf('  function currentSeriesIndex('));
  assert.match(saved,/data-pn-series-review-index/);
  const returnPanel=shell.slice(b,shell.indexOf('    if(target.dataset.pnSeriesIndexOpen){',b));
  assert.match(returnPanel,/review\.room!==state\.snapshot\.roomId/);
  assert.match(returnPanel,/index\.open=true/);
  assert.doesNotMatch(handler+returnPanel,/bridge\.dispatch\(|runTransaction\(|localStorage\.setItem\(/);
  assert.match(css,/\.pn-series-index-entry\{/);
  assert.match(css,/\.pn-series-index-edit:focus-visible\{/);
  assert.match(css,/\.pn-series-save-back-index:focus-visible\{/);
});


test('Palette comparison identifies a saved edit and recovers an occurrence hidden by its former filter',()=>{
  const start=shell.indexOf('  function currentSeriesIndex(item) {');
  const end=shell.indexOf('  function inspectorSeriesContext(item) {',start);
  assert.ok(start>0&&end>start);
  const schedules=Array.from({length:18},(_,i)=>({
    id:'A'+(i+1),recurrenceSeriesId:'series-A',
    title:i===12?'改題済みの予定':'通常会議',
    startAt:'2027-03-'+String(i+1).padStart(2,'0')+'T09:00',
    endAt:'2027-03-'+String(i+1).padStart(2,'0')+'T10:00',
    assignee:i===12?'職員B':'職員A',category:'会議'
  }));
  schedules.push({id:'B1',recurrenceSeriesId:'series-B',
    title:'別の系列',startAt:'2027-03-01T09:00'});
  const state={route:'schedule',scheduleView:'series',
    detail:{kind:'schedule',id:'A1'},
    snapshot:{schedules,currentUser:'職員A',roomId:'room1'}};
  const seriesOccurrences=item=>schedules.filter(row=>
    item?.recurrenceSeriesId&&row.recurrenceSeriesId===item.recurrenceSeriesId)
    .sort((a,b)=>a.startAt.localeCompare(b.startAt));
  const escape=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const localDate=v=>String(v||'').slice(0,10);
  const localTime=v=>String(v||'').slice(11,16);
  const dateLabel=v=>String(v||'').replaceAll('-','/');
  const fns=new Function('state','seriesOccurrences','escape','localDate','localTime',
    'scheduleSeriesDateLabel',
    'let seriesIndexState=null;\n'+shell.slice(start,end)+
    'return {currentSeriesIndex,filteredSeriesIndex,seriesIndexResults,'+
    'seriesIndexChangeLabels,seriesIndexSavedFeedback,seriesIndexMatchesQuery};'
  )(state,seriesOccurrences,escape,localDate,localTime,dateLabel);
  const index=fns.currentSeriesIndex(schedules[0]);
  index.open=true;index.query='通常会議';index.page=0;
  const changes=fns.seriesIndexChangeLabels({
    title:'通常会議',startAt:'2027-03-13T09:00',endAt:'2027-03-13T10:00',
    assignee:'職員A',category:'会議'
  },schedules[12]);
  assert.deepEqual(changes,['件名','担当者']);
  assert.deepEqual(fns.seriesIndexChangeLabels(
    {startAt:'A',endAt:'A'},{startAt:'B',endAt:'B'}),['日時']);
  assert.deepEqual(fns.seriesIndexChangeLabels(null,schedules[12]),[]);
  index.recentEdit={id:'A13',seriesId:'series-A',
    user:'職員A',room:'room1',changes};
  const hidden=fns.seriesIndexResults(schedules[0]);
  assert.match(hidden,/最後に保存した回/);
  assert.match(hidden,/変更項目：件名・担当者/);
  assert.match(hidden,/検索条件から外れています/);
  assert.match(hidden,/data-pn-series-index-reveal/);
  assert.match(hidden,/検索を解除して表示/);
  assert.doesNotMatch(hidden,/data-pn-series-index-open="A13"/);
  // The source filter is preserved; this banner does not clear it by itself.
  assert.equal(index.query,'通常会議');
  assert.equal(index.page,0);

  index.query='';index.page=0;
  const anotherPage=fns.seriesIndexResults(schedules[0]);
  assert.match(anotherPage,/別のページにあります/);
  assert.match(anotherPage,/保存した回を表示/);
  assert.doesNotMatch(anotherPage,/data-pn-series-index-open="A13"/);
  index.page=1;
  const highlighted=fns.seriesIndexResults(schedules[0]);
  assert.match(highlighted,/pn-series-index-item[^"]*was-saved/);
  assert.match(highlighted,/data-pn-series-index-open="A13"/);
  assert.match(highlighted,/pn-series-index-saved-tag/);
  assert.match(highlighted,/下の一覧で強調表示しています/);
  assert.doesNotMatch(highlighted,/data-pn-series-index-reveal/);

  index.query='通常会議';index.page=0;
  let refreshed=0,focused=false,scrolled=false;
  const search={value:'通常会議'};
  const rowButton={dataset:{pnSeriesIndexOpen:'A13'},
    focus(){focused=true},scrollIntoView(){scrolled=true}};
  const drawer={querySelector(selector){
    return selector==='[data-pn-series-index-search]'?search:null;
  },querySelectorAll(selector){
    return selector==='[data-pn-series-index-open]'?[rowButton]:[];
  }};
  const target={hasAttribute:k=>k==='data-pn-series-index-reveal',
    closest:()=>({})};
  const begin=shell.indexOf("    if(target.hasAttribute('data-pn-series-index-reveal')){");
  const finish=shell.indexOf('    if(target.dataset.pnSeriesIndexEdit){',begin);
  assert.ok(begin>0&&finish>begin);
  const handler=shell.slice(begin,finish);
  new Function('state','seriesIndexState','seriesOccurrences','filteredSeriesIndex',
    'seriesIndexMatchesQuery','drawer','refreshSeriesIndexResults','target',
    'function trigger(){'+handler+'}trigger();'
  )(state,index,seriesOccurrences,fns.filteredSeriesIndex,fns.seriesIndexMatchesQuery,
    drawer,()=>{refreshed++},target);
  assert.equal(index.query,'');
  assert.equal(search.value,'');
  assert.equal(index.page,1);
  assert.equal(refreshed,1);
  assert.equal(focused,true);
  assert.equal(scrolled,true);
  assert.equal(index.open,true);

  state.snapshot.currentUser='別の利用者';
  assert.doesNotMatch(fns.seriesIndexResults(schedules[0]),/最後に保存した回/);
  assert.doesNotMatch(fns.seriesIndexResults(schedules[0]),/pn-series-index-saved-tag/);
  state.snapshot.currentUser='職員A';state.snapshot.roomId='room2';
  assert.doesNotMatch(fns.seriesIndexResults(schedules[0]),/最後に保存した回/);

  const dispatch=shell.slice(shell.indexOf('  async function dispatch('),
    shell.indexOf('  // Clearing the user'));
  assert.match(dispatch,/if\(result\?\.ok\)/);
  assert.match(dispatch,/seriesIndexChangeLabels\(editedScheduleBefore,saved\)/);
  assert.match(dispatch,/seriesIndexState\.recentEdit=/);
  assert.match(css,/\.pn-series-index-saved-action button:focus-visible/);
  assert.match(css,/\.pn-series-index-item\.was-saved/);
  assert.doesNotMatch(shell.slice(start,end)+handler,
    /bridge\.dispatch\(|runTransaction\(|localStorage\.setItem\(/);
});


test('Palette series before-after comparison shows only confirmed title time and owner changes',()=>{
  const begin=shell.indexOf('  function currentSeriesIndex(item) {');
  const end=shell.indexOf('  function inspectorSeriesContext(item) {',begin);
  assert.ok(begin>0&&end>begin);
  const rows=[
    {id:'a1',recurrenceSeriesId:'A',revision:2,title:'会議 <新>',
      startAt:'2027-04-02T10:30',endAt:'2027-04-02T11:45',
      assignee:'職員B',category:'会議'},
    {id:'a2',recurrenceSeriesId:'A',revision:1,title:'次の予定',
      startAt:'2027-04-09T09:00',endAt:'2027-04-09T10:00',
      assignee:'職員A'},
    {id:'other',recurrenceSeriesId:'B',revision:1,title:'別系列',
      startAt:'2027-04-02T10:30'}
  ];
  const state={route:'schedule',scheduleView:'series',
    detail:{kind:'schedule',id:'a1'},
    snapshot:{schedules:rows,currentUser:'職員A',roomId:'room1'}};
  const escape=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const localDate=v=>String(v||'').slice(0,10);
  const localTime=v=>String(v||'').slice(11,16);
  const seriesOccurrences=item=>rows.filter(row=>row.recurrenceSeriesId&&
    row.recurrenceSeriesId===item?.recurrenceSeriesId)
    .sort((a,b)=>a.startAt.localeCompare(b.startAt));
  const fns=new Function('state','seriesOccurrences','escape','localDate','localTime',
    'scheduleSeriesDateLabel',
    'let seriesIndexState=null;\n'+shell.slice(begin,end)+
    'return {currentSeriesIndex,seriesIndexComparison,'+
    'seriesIndexSavedFeedback,seriesIndexResults};'
  )(state,seriesOccurrences,escape,localDate,localTime,
    v=>String(v||'').replaceAll('-','/'));
  const before={
    title:'会議 <旧>',startAt:'2027-04-01T09:00',
    endAt:'2027-04-01T10:00',assignee:'職員A',memo:'変更なし'
  };
  const after=rows[0];
  const changed=fns.seriesIndexComparison(before,after);
  assert.deepEqual(changed.map(x=>x.label),['件名','日時','担当者']);
  assert.equal(changed[0].before,'会議 <旧>');
  assert.equal(changed[0].after,'会議 <新>');
  assert.equal(changed[1].before,'2027/04/01 09:00 〜 10:00');
  assert.equal(changed[1].after,'2027/04/02 10:30 〜 11:45');
  assert.equal(changed[2].before,'職員A');
  assert.equal(changed[2].after,'職員B');
  assert.deepEqual(fns.seriesIndexComparison(before,
    {...before,memo:'メモだけ変更'}),[]);
  assert.deepEqual(fns.seriesIndexComparison(null,after),[]);
  assert.deepEqual(fns.seriesIndexComparison(before,null),[]);
  assert.deepEqual(fns.seriesIndexComparison(before,
    {...before,endAt:'2027-04-01T10:30'}).map(x=>x.label),['日時']);
  const index=fns.currentSeriesIndex(after);
  index.open=true;index.page=0;index.query='';
  index.recentEdit={id:'a1',seriesId:'A',revision:2,
    user:'職員A',room:'room1',changes:['件名','日時','担当者'],
    comparison:changed};
  let html=fns.seriesIndexResults(after);
  assert.match(html,/変更前後を比較<small>3項目/);
  assert.match(html,/data-pn-series-index-diff>/);
  assert.doesNotMatch(html,/data-pn-series-index-diff open/);
  assert.equal((html.match(/<dd>/g)||[]).length,6);
  assert.match(html,/会議 &lt;旧&gt;/);
  assert.match(html,/会議 &lt;新&gt;/);
  assert.doesNotMatch(html,/<span>会議 <旧><\/span>/);
  assert.match(html,/pn-series-index-item[^"]*was-saved/);
  index.diffOpen=true;
  html=fns.seriesIndexResults(after);
  assert.match(html,/data-pn-series-index-diff open/);
  const summaryStart=shell.indexOf("    const diffSummary=event.target.closest(");
  const summaryEnd=shell.indexOf("    const indexSummary=event.target.closest(",summaryStart);
  assert.ok(summaryStart>0&&summaryEnd>summaryStart);
  const summaryCode=shell.slice(summaryStart,summaryEnd);
  const toggle=isOpen=>new Function('state','seriesIndexState','event',
    'function handle(){'+summaryCode+'}handle();'
  )(state,index,{target:{closest:()=>({parentElement:{open:isOpen}})}});
  toggle(true);
  assert.equal(index.diffOpen,false);
  toggle(false);
  assert.equal(index.diffOpen,true);
  index.recentEdit.comparison=[];
  assert.doesNotMatch(fns.seriesIndexResults(after),/data-pn-series-index-diff/);
  index.recentEdit.comparison=changed;
  rows[0].revision=3;
  assert.doesNotMatch(fns.seriesIndexResults(after),/最後に保存した回/);
  assert.doesNotMatch(fns.seriesIndexResults(after),/was-saved/);
  rows[0].revision=2;
  state.snapshot.currentUser='別ユーザー';
  assert.doesNotMatch(fns.seriesIndexResults(after),/変更前後を比較/);
  state.snapshot.currentUser='職員A';state.snapshot.roomId='別ルーム';
  assert.doesNotMatch(fns.seriesIndexResults(after),/変更前後を比較/);
  state.snapshot.roomId='room1';

  const dispatch=shell.slice(shell.indexOf('  async function dispatch('),
    shell.indexOf('  // Clearing the user'));
  assert.match(dispatch,/editedScheduleBefore=command\.type==='schedule\.update'/);
  assert.match(dispatch,/seriesIndexComparison\(editedScheduleBefore,saved\)/);
  assert.match(dispatch,/seriesIndexState\.diffOpen=false/);
  assert.match(dispatch,/if\(result\?\.ok\)/);
  assert.match(css,/\.pn-series-index-diff-row\{/);
  assert.match(css,/\.pn-series-index-diff>summary:focus-visible\{/);
  assert.doesNotMatch(shell.slice(begin,end)+summaryCode,
    /bridge\.dispatch\(|runTransaction\(|localStorage\.setItem\(/);
});


test('Palette series progress is session-only, editable, and scoped to current user and room',()=>{
  const begin=shell.indexOf('  function currentSeriesIndex(item) {');
  const end=shell.indexOf('  function inspectorSeriesContext(item) {',begin);
  assert.ok(begin>0&&end>begin);
  const rows=Array.from({length:12},(_,i)=>({
    id:'A'+i,recurrenceSeriesId:'A',revision:1,title:'定例会議',
    startAt:'2027-05-'+String(i+1).padStart(2,'0')+'T09:00'
  }));
  const state={route:'schedule',scheduleView:'series',
    detail:{kind:'schedule',id:'A0'},
    snapshot:{schedules:rows,currentUser:'職員A',roomId:'room1'}};
  const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('"','&quot;');
  const fns=new Function('state','seriesOccurrences','escape','localDate','localTime',
    'scheduleSeriesDateLabel','let seriesIndexState=null;\n'+shell.slice(begin,end)+
    'return {currentSeriesIndex,filteredSeriesIndex,seriesIndexResults};'
  )(state,item=>rows.filter(row=>row.recurrenceSeriesId===item.recurrenceSeriesId),
    esc,v=>String(v||'').slice(0,10),v=>String(v||'').slice(11,16),
    v=>String(v||'').replaceAll('-','/'));
  const index=fns.currentSeriesIndex(rows[0]);
  assert.match(fns.seriesIndexResults(rows[0]),/未確認 <strong>12<\/strong>/);
  index.viewed.add('A0');
  index.edited.set('A0',1);
  assert.match(fns.seriesIndexResults(rows[0]),/確認済み <strong>1<\/strong>/);
  assert.match(fns.seriesIndexResults(rows[0]),/編集済み <strong>1<\/strong>/);
  assert.match(fns.seriesIndexResults(rows[0]),/次の未確認を開く/);
  index.status='unchecked';
  assert.deepEqual(fns.filteredSeriesIndex(rows[0]).map(row=>row.id).slice(0,2),
    ['A1','A2']);
  assert.doesNotMatch(fns.seriesIndexResults(rows[0]),/data-pn-series-index-open="A0"/);
  rows[0].revision=2;
  index.status='all';
  assert.match(fns.seriesIndexResults(rows[0]),/確認済み <strong>1<\/strong>/);
  assert.match(fns.seriesIndexResults(rows[0]),/編集済み <strong>0<\/strong>/);
  state.snapshot.roomId='room2';
  assert.notEqual(fns.currentSeriesIndex(rows[0]),index);
  assert.equal(fns.currentSeriesIndex(rows[0]).viewed.size,0);
  state.snapshot.currentUser='職員B';
  assert.equal(fns.currentSeriesIndex(rows[0]).edited.size,0);
  const source=shell.slice(begin,end);
  const handlers=shell.slice(shell.indexOf('    if(target.dataset.pnSeriesIndexNextUnchecked){'),
    shell.indexOf('    if(target.dataset.pnSeriesIndexPage){'));
  assert.match(shell,/seriesIndexState\.edited\.set\(saved\.id/);
  assert.match(shell,/data-pn-series-index-status/);
  assert.match(css,/\.pn-series-index-progress\{/);
  assert.match(css,/\.pn-series-index-checked-tag\{/);
  assert.doesNotMatch(source+handlers,/bridge\.dispatch\(|runTransaction\(|localStorage\.setItem\(/);
});


test('Palette series next-edit traverses only canonical unedited occurrences without automatic writes',()=>{
  const begin=shell.indexOf('  function scheduleSavedReviewMarkup(item) {');
  const end=shell.indexOf('  function inspectorSeriesContext(item) {',begin);
  assert.ok(begin>0&&end>begin);
  const schedules=Array.from({length:4},(_,i)=>({
    id:'A'+i,recurrenceSeriesId:'A',revision:i===1?2:1,
    title:'定例会議 '+i,startAt:'2027-05-'+String(i+1).padStart(2,'0')+'T09:00'
  }));
  schedules.push({id:'B0',recurrenceSeriesId:'B',revision:1,
    title:'別系列',startAt:'2027-05-03T10:00'});
  const state={route:'schedule',scheduleView:'series',
    detail:{kind:'schedule',id:'A1'},
    snapshot:{schedules,currentUser:'職員A',roomId:'room1'}};
  const seriesOccurrences=item=>schedules.filter(row=>
    row.recurrenceSeriesId===item?.recurrenceSeriesId)
    .sort((a,b)=>a.startAt.localeCompare(b.startAt));
  const escape=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('"','&quot;');
  const localDate=v=>String(v||'').slice(0,10);
  const localTime=v=>String(v||'').slice(11,16);
  const fns=new Function('state','seriesOccurrences','escape','localDate','localTime',
    'scheduleSeriesDateLabel',
    'let scheduleSavedReview=null,seriesIndexState=null;\n'+shell.slice(begin,end)+
    'return {currentSeriesIndex,nextUneditedSeriesOccurrence,seriesIndexResults,'+
      'scheduleSavedReviewMarkup,setReview:x=>{scheduleSavedReview=x}};'
  )(state,seriesOccurrences,escape,localDate,localTime,
    v=>String(v||'').replaceAll('-','/'));
  const index=fns.currentSeriesIndex(schedules[1]);
  index.open=true;
  index.edited.set('A1',2);
  index.status='unedited'; // The saved anchor is not part of this filtered list.
  assert.equal(fns.nextUneditedSeriesOccurrence(schedules[1],'A1').id,'A2');
  index.status='all';
  assert.equal(fns.nextUneditedSeriesOccurrence(schedules[1],'A1').id,'A2');
  assert.match(fns.seriesIndexResults(schedules[1]),
    /data-pn-series-index-next-edit="A0"/);
  fns.setReview({id:'A1',seriesId:'A',user:'職員A',room:'room1',
    route:'schedule',viaSeriesIndex:true});
  assert.match(fns.scheduleSavedReviewMarkup(schedules[1]),
    /data-pn-series-save-edit-next="A2"/);
  index.edited.set('A2',1);
  assert.equal(fns.nextUneditedSeriesOccurrence(schedules[1],'A1').id,'A3');
  index.edited.set('A3',1);
  assert.equal(fns.nextUneditedSeriesOccurrence(schedules[1],'A1').id,'A0');
  index.edited.set('A0',1);
  assert.equal(fns.nextUneditedSeriesOccurrence(schedules[1],'A1'),null);
  assert.doesNotMatch(fns.seriesIndexResults(schedules[1]),
    /data-pn-series-index-next-edit=/);
  assert.doesNotMatch(fns.scheduleSavedReviewMarkup(schedules[1]),
    /data-pn-series-save-edit-next=/);
  // A remote revision change never counts as an already edited occurrence.
  schedules[2].revision=3;
  assert.equal(fns.nextUneditedSeriesOccurrence(schedules[1],'A1').id,'A2');
  state.snapshot.currentUser='職員B';
  assert.notEqual(fns.currentSeriesIndex(schedules[1]),index);
  assert.doesNotMatch(fns.scheduleSavedReviewMarkup(schedules[1]),
    /data-pn-series-save-edit-next=/);
  const handler=shell.slice(shell.indexOf(
    '    if(target.dataset.pnSeriesIndexNextEdit||target.dataset.pnSeriesSaveEditNext){'),
    shell.indexOf("    if(target.hasAttribute('data-pn-inspect-step'))"));
  assert.match(handler,/index\.user!==state\.snapshot\.currentUser/);
  assert.match(handler,/review\?\.viaSeriesIndex/);
  assert.match(handler,/candidate\.id!==requested/);
  assert.match(handler,/openEditor\('schedule',candidate\.id,target\)/);
  assert.match(shell,/trigger\?\.hasAttribute\?\.\('data-pn-series-save-edit-next'\)/);
  assert.match(css,/\.pn-series-save-edit-next:focus-visible/);
  assert.doesNotMatch(shell.slice(begin,end)+handler,
    /bridge\.dispatch\(|runTransaction\(|localStorage\.setItem\(/);
});


test('Palette counts a read in Day view and filters unedited recurrences without crossing series',()=>{
  const begin=shell.indexOf('  function currentSeriesIndex(item) {');
  const middle=shell.indexOf('  function inspectorSeriesContext(item) {',begin);
  const end=shell.indexOf('  function inspectorScheduleContext(item,linked) {',middle);
  assert.ok(begin>0&&middle>begin&&end>middle);
  const rows=Array.from({length:12},(_,i)=>({
    id:'A'+(i+1),recurrenceSeriesId:'A',revision:1,
    title:i===5?'特別会議':'通常会議',
    startAt:'2027-06-'+String(i+1).padStart(2,'0')+'T09:00',
    assignee:'職員A'
  }));
  rows.push({id:'other',recurrenceSeriesId:'B',revision:1,title:'別系列',
    startAt:'2027-06-03T14:00'});
  const state={route:'schedule',scheduleView:'day',
    detail:{kind:'schedule',id:'A1'},
    snapshot:{schedules:rows,currentUser:'職員A',roomId:'room1'}};
  const escape=v=>String(v??'').replaceAll('&','&amp;').replaceAll('"','&quot;');
  const localDate=v=>String(v||'').slice(0,10);
  const localTime=v=>String(v||'').slice(11,16);
  const seriesOccurrences=item=>rows.filter(row=>
    row.recurrenceSeriesId===item?.recurrenceSeriesId)
    .sort((a,b)=>a.startAt.localeCompare(b.startAt));
  const fns=new Function('state','seriesOccurrences','escape','localDate','localTime',
    'scheduleSeriesDateLabel','dateParts','inspectorReturnPoint',
    'let seriesIndexState=null;\n'+shell.slice(begin,middle)+shell.slice(middle,end)+
    'return {currentSeriesIndex,filteredSeriesIndex,'+
      'nextUneditedSeriesOccurrence,inspectorSeriesContext,seriesIndexResults};'
  )(state,seriesOccurrences,escape,localDate,localTime,
    v=>String(v||'').replaceAll('-','/'),v=>String(v||'').slice(5),null);
  const index=fns.currentSeriesIndex(rows[0]);
  assert.equal(index.viewed.size,0);
  const panel=fns.inspectorSeriesContext(rows[0]);
  assert.match(panel,/確認済み <strong>1<\/strong>/);
  assert.equal(index.viewed.has('A1'),true);
  index.status='unchecked';
  assert.equal(fns.filteredSeriesIndex(rows[0]).length,11);
  index.status='unedited';
  index.edited.set('A2',1);
  assert.equal(fns.filteredSeriesIndex(rows[0]).length,11);
  assert.match(fns.seriesIndexResults(rows[0]),/data-pn-series-index-next-edit=/);
  assert.match(fns.seriesIndexResults(rows[0]),/data-pn-series-index-reset/);
  assert.doesNotMatch(fns.seriesIndexResults(rows[0]),/data-pn-series-index-open="A2"/);
  index.query='特別会議';
  assert.deepEqual(fns.filteredSeriesIndex(rows[0]).map(x=>x.id),['A6']);
  assert.equal(fns.nextUneditedSeriesOccurrence(rows[0]).id,'A6');
  index.edited.set('A6',1);
  assert.equal(fns.nextUneditedSeriesOccurrence(rows[0]),null);
  rows[5].revision=2;
  assert.equal(fns.nextUneditedSeriesOccurrence(rows[0]).id,'A6');
  assert.doesNotMatch(fns.seriesIndexResults(rows[0]),/data-pn-series-index-open="other"/);
  state.route='today';
  fns.inspectorSeriesContext(rows[2]);
  assert.equal(index.viewed.has('A3'),true);
  const feedback=shell.slice(shell.indexOf('    if(target.hasAttribute('+
    "'data-pn-series-review-index'"),shell.indexOf('    if(target.dataset.pnSeriesIndexOpen){'));
  assert.match(feedback,/index\.page=Math\.floor\(position\/8\)/);
  assert.match(feedback,/data-pn-series-index-reveal/);
  assert.match(shell,/resume\.viaSeriesIndex\|\|state\.route==='schedule'/);
  assert.match(shell,/data-pn-series-index-reset/);
  assert.match(css,/\.pn-series-index-reset:focus-visible/);
  assert.doesNotMatch(shell.slice(begin,end),/bridge\.dispatch\(|runTransaction\(/);
});
