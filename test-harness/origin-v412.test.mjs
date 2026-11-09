import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const origin=readFileSync('origin-modern-v372.js','utf8');
const selector=readFileSync('modern-display-v356.js','utf8');
const memo=readFileSync('work-features-v167.js','utf8');

test('Origin is the display name while the stored modern mode remains compatible',()=>{
 assert.match(selector,/\['modern', 'Origin'/);
 assert.match(origin,/<option value=\\\"modern\\\">Origin<\/option>/);
 assert.match(origin,/originUserSelect/);
 assert.match(origin,/bridge\.selectUser\?\.\(next\)/);
});

test('Origin memo color is shared with the canonical bridge and supports existing color set',()=>{
 assert.match(memo,/MEMO_PAPER_COLORS = Object\.freeze/);
 assert.match(origin,/paperColor:t\.paperColor\|\|'ivory'/);
 assert.match(origin,/paperColor:memoColor\(fd\.get\('paperColor'\)\)/);
 assert.match(origin,/if\(a==='memo-color'\)/);
 assert.match(origin,/memoColorFilter/);
 assert.match(origin,/memoBridge\?\.categories/);
 assert.doesNotMatch(origin,/firebase\/database|runTransaction/);
});

test('Origin schedule controls use current canonical events without a second writer',()=>{
 for(const token of ['scheduleView','originDateJump','originScheduleAssignee','origin-agenda-entry'])
   assert.ok(origin.includes(token),token);
 assert.match(origin,/type:id\?'schedule.update':'schedule.create'/);
 assert.match(origin,/type:'schedule.delete'/);
});


test('Ver.415 paper-only changes preserve last content modification time across screens',()=>{
 assert.match(memo,/const contentUnchanged = Boolean\(existing\)/);
 assert.match(memo,/const colorOnly = contentUnchanged/);
 assert.match(memo,/updatedAt: colorOnly \? Number\(existing\.updatedAt/);
 assert.match(memo,/updatedBy: colorOnly \? String\(existing\.updatedBy/);
 assert.match(memo,/\.\.\.memo, id, paperColor: color/);
 assert.match(memo,/await commitMemo\(draft, expectedRevision\)/);
 assert.match(origin,/tags:\[\.\.\.m\.tags\]/);
});

test('Ver.415 Origin retains pending drafts, refocuses swatches and supports schedule search',()=>{
 assert.match(origin,/quickTodoDraft=''/);
 assert.match(origin,/function updateScheduleSearch\(input\)/);
 assert.match(origin,/scheduleComposing=true/);
 assert.match(origin,/id="originScheduleSearch"/);
 assert.match(origin,/origin-selected/);
 assert.match(origin,/input中の変更|入力中の変更を破棄して利用者を切り替えますか/);
 assert.match(origin,/if\(!ok\|\|view!=='notes'\|\|snapshot\.currentUser!==user/);
 assert.match(origin,/const swatch=Array\.from\(workspace\.querySelectorAll\('\[data-action="memo-color"\]'\)\)/);
 assert.match(origin,/target\?\.focus\(\{preventScroll:true\}\)/);
 assert.match(origin,/window\.confirm\(/);
 assert.match(origin,/\.header-inner\{flex-wrap:wrap/);
 assert.doesNotMatch(origin,/localStorage\.setItem/);
});

test('Origin memo library navigation keeps pinned order and adds safe view-only search',()=>{
 assert.ok(origin.includes("function renderNotes(){"));
 assert.ok(origin.includes("memoQuery.trim().toLocaleLowerCase()"));
 assert.ok(origin.includes("memoSort==='title'"));
 assert.ok(origin.includes("memoSort==='category'"));
 assert.ok(origin.includes("if(a==='memo-reset')"));
 assert.ok(origin.includes("if(t.id==='originMemoSort')"));
 assert.ok(origin.includes("function updateMemoQuery(input)"));
 assert.ok(origin.includes("if(e.target.id==='originMemoQuery'){memoComposing=false"));
 assert.ok(origin.includes("const pin=Number(Boolean(b.pinned))-Number(Boolean(a.pinned))"));
 assert.doesNotMatch(origin,/memoQuery.*localStorage\.setItem/);
});

test('Origin responsive desktop header keeps tabs on an independent row',()=>{
 assert.ok(origin.includes("@media (min-width:771px) and (max-width:1500px)"));
 assert.ok(origin.includes(".header-nav{order:2;flex:0 0 100%"));
 assert.ok(origin.includes(".header-tools{order:1;margin-left:auto"));
 assert.ok(origin.includes("id=\"originMemoQuery\""));
 assert.ok(origin.includes('class="origin-memo-result"'));
});

test('Origin detail pager follows visible list order, respects source filters, and restores focus',()=>{
 assert.match(origin,/function captureDetailSequence\(kind,id,trigger\)/);
 assert.match(origin,/button\.getClientRects\(\)\.length/);
 assert.match(origin,/function detailNeighbors\(kind,id\)/);
 assert.match(origin,/function detailPager\(kind,id\)/);
 assert.match(origin,/function navigateDetail\(direction\)/);
 assert.match(origin,/function restoreDetailFocus\(kind,id\)/);
 assert.match(origin,/data-action="detail-prev"/);
 assert.match(origin,/data-action="detail-next"/);
 assert.match(origin,/detailPager\(kind,id\)\+originRelatedBackBar\(\)\+body/);
 assert.match(origin,/captureDetailSequence\(kind,id,el\)/);
 assert.match(origin,/function closePanel\(force=false,restoreFocus=true\)/);
 assert.match(origin,/\.origin-detail-pager\{/);
 assert.doesNotMatch(origin,/detailSequence.*localStorage\.setItem/);
});

test('Origin compact task, ToDo and day schedule layouts use one canonical writer',()=>{
 assert.match(origin,/function taskDisplaySort\(a,b\)/);
 assert.match(origin,/function taskVisible\(\)/);
 assert.match(origin,/function updateTaskQuery\(input\)/);
 assert.match(origin,/taskComposing=true/);
 assert.match(origin,/if\(a==='task-reset'\)/);
 assert.match(origin,/if\(a==='task-density'\)/);
 assert.match(origin,/if\(t\.id==='originTaskSort'\)/);
 assert.match(origin,/origin-task-mobile-due/);
 assert.match(origin,/dueTime\?'\ '\+t\.dueTime/);
 assert.match(origin,/class="origin-todo-summary"/);
 assert.match(origin,/class="origin-todo-archive"/);
 assert.match(origin,/if\(a==='todo-completed-toggle'\)/);
 assert.match(origin,/id="originCompletedTodos"/);
 assert.doesNotMatch(origin,/今日・期限超過/);
 assert.match(origin,/if\(kind==='todos'\)\{/);
 assert.doesNotMatch(origin,/kind==='todos'\)\{body=.*<dt>期限日<\/dt>/);
 assert.match(origin,/name="memo" maxlength="\$\{snapshot\.todoMemoMaxLength\}" placeholder="必要な情報を記録/);
 assert.match(origin,/type:'todo\.update',id,text:title,memo:String\(fd\.get\('memo'\)\|\|''\)/);
 assert.match(origin,/type:'todo\.create',text:title,memo:String\(fd\.get\('memo'\)\|\|''\)/);
 assert.match(origin,/const dayView=/);
 assert.match(origin,/data-action="day-prev"/);
 assert.match(origin,/data-action="day-next"/);
 assert.match(origin,/data-action="calendar-day"/);
 assert.match(origin,/data-value="\$\{mode\}"/);
 assert.match(origin,/if\(a==='calendar-day'\)/);
 assert.match(origin,/if\(a==='day-prev'\|\|a==='day-next'\)/);
 assert.doesNotMatch(origin,/firebase\/database|runTransaction|localStorage\.setItem/);
});


test('Origin keeps workspace interaction stable during canonical refresh',()=>{
 assert.match(origin,/function captureOriginFocus\(\)/);
 assert.match(origin,/function restoreOriginFocus\(metadata\)/);
 assert.match(origin,/metadata\.selection/);
 assert.match(origin,/target\.focus\(\{preventScroll:true\}\)/);
 assert.match(origin,/function refreshFromCanonical\(\)/);
 assert.match(origin,/if\(taskComposing\|\|memoComposing\|\|scheduleComposing\|\|todoComposing\)return/);
 assert.match(origin,/bridge\.subscribe\(s=>\{snapshot=s;refreshFromCanonical\(\)\}\)/);
 assert.match(origin,/memoBridge\?\.subscribe\?\.\(items=>\{memoItems=items;refreshFromCanonical\(\)\}\)/);
 assert.match(origin,/function handleRoute\(route\)/);
 assert.match(origin,/viewScrollPositions\[view\]=window\.scrollY/);
 assert.match(origin,/viewScrollPositions\[route\]\|\|0/);
 assert.match(origin,/Object\.keys\(viewScrollPositions\)\.forEach/);
 assert.doesNotMatch(origin,/viewScrollPositions.*localStorage\.setItem/);
});


test('Origin Today dashboard keeps quick add above preview and links to detail',()=>{
 assert.match(origin,/function renderToday\(\)/);
 assert.match(origin,/const chosenToday=selectedDay===base/);
 assert.match(origin,/chosenToday\?'今日':'選択日'/);
 assert.match(origin,/origin-today-shortcuts/);
 assert.match(origin,/origin-today-todo-add/);
 assert.match(origin,/data-action="open" data-kind="todos" data-id="\$\{esc\(t\.id\)\}"/);
 assert.match(origin,/data-action="todo-check" data-id="\$\{esc\(t\.id\)\}"/);
 assert.match(origin,/priorityPool\.length>priority\.length/);
 assert.match(origin,/pendingTodos\.length>todos\.length/);
 assert.match(origin,/humanDue\(t\.due\)/);
 assert.doesNotMatch(origin,/<div class="banner-quiet">/);
 assert.doesNotMatch(origin,/class="ghost-row-action"/);
});


test('Origin inspector action hierarchy and details remain canonical',()=>{
 assert.match(origin,/function originPanelFooter\(kind,id,editing,item\)/);
 assert.match(origin,/originPanelFooter\(kind,id,true,v\)/);
 assert.match(origin,/originPanelFooter\(kind,id,false,t\)/);
 assert.match(origin,/data-action="task-done"/);
 assert.match(origin,/data-action="todo-toggle"/);
 assert.match(origin,/data-action="memo-task"/);
 assert.doesNotMatch(origin,/schedule-classic/);
 assert.match(origin,/const dangerous=editing&&id/);
 assert.match(origin,/type:'series.preview-delete'/);
 assert.match(origin,/type:'series.delete'/);
 assert.match(origin,/class="origin-sheet-danger"/);
 assert.match(origin,/class="origin-sheet-primary"/);
 assert.match(origin,/class="origin-sheet-secondary"/);
 assert.match(origin,/\.origin-sheet-primary button\{width:100%;min-width:0;min-height:44px\}/);
 assert.match(origin,/\.origin-sheet-danger\{border-top:1px solid var\(--line\)/);
 assert.match(origin,/function taskPanel\(t\)/);
 assert.match(origin,/origin-task-check-progress/);
 assert.match(origin,/history\.slice\(0,3\)/);
 assert.match(origin,/history\.slice\(3\)/);
 assert.match(origin,/origin-task-history-more/);
 assert.match(origin,/t\.dueTime\?' '\+t\.dueTime/);
 assert.match(origin,/class="origin-event-times origin-detail-main-fact"/);
 assert.match(origin,/class="memo-document origin-memo-paper"/);
 assert.match(origin,/data-paper-color="\$\{memoColor\(t\.paperColor\)\}"/);
 assert.match(origin,/class="origin-memo-swatch"/);
 assert.doesNotMatch(origin,/firebase\/database|runTransaction|localStorage\.setItem/);
});

test('Origin traps keyboard focus inside open inspector and respects unsaved edits',()=>{
 assert.match(origin,/function originSheetFocusable\(\)/);
 assert.match(origin,/function handleOriginModalKeys\(e\)/);
 assert.match(origin,/if\(e\.key==='Tab'\)/);
 assert.match(origin,/if\(e\.shiftKey&&\(!inside\|\|e\.target===first\)\)/);
 assert.match(origin,/if\(!e\.shiftKey&&\(!inside\|\|e\.target===last\)\)/);
 assert.match(origin,/if\(panelMode==='detail'&&!e\.altKey&&!e\.ctrlKey&&!e\.metaKey&&!e\.isComposing/);
 assert.match(origin,/e\.key==='ArrowLeft'\|\|e\.key==='ArrowRight'/);
 assert.match(origin,/navigateDetail\(direction\)/);
 assert.match(origin,/if\(panelOpen\)\{\s*\/\/ Prevent global search/);
 assert.match(origin,/if\(handleOriginModalKeys\(e\)\)return/);
 assert.match(origin,/id=\\"sheet\\" tabindex=\\"-1\\"/);
 assert.match(origin,/aria-label="\$\{label\}を続けて確認。[^"]*左右矢印キー[^"]*左右スワイプ[^"]*"/);
 assert.match(origin,/if\(!window\.confirm\('入力中の変更を破棄して閉じますか？'\)\)return false/);
});

test('Origin status write refreshes only the matching detail without losing position',()=>{
 assert.match(origin,/function refreshDetailAfterStatusWrite\(kind,id,action\)/);
 assert.match(origin,/!panelOpen\|\|panelMode!=='detail'\|\|panelKind!==kind\|\|panelId!==id/);
 assert.match(origin,/const scroll=\$\('#sheet \.sheet-body'\)\?\.scrollTop\|\|0/);
 assert.match(origin,/if\(body\)body\.scrollTop=scroll/);
 assert.match(origin,/refreshDetailAfterStatusWrite\('todos',id,'todo-toggle'\)/);
 assert.match(origin,/refreshDetailAfterStatusWrite\('tasks',id,'task-done'\)/);
 assert.match(origin,/if\(saved\)refreshDetailAfterStatusWrite/);
});


test('Origin global search uses ranked view-only results with accessible mobile and keyboard controls',()=>{
 assert.match(origin,/function renderSearch\(q\)/);
 assert.match(origin,/const tokens=term\.split\(\/\\s\+\/\)/);
 assert.match(origin,/matches\.sort\(\(a,b\)=>a\.score-b\.score/);
 assert.match(origin,/const filtered=searchKind==='all'\?matches:matches\.filter/);
 assert.match(origin,/data-action="search-kind"/);
 assert.match(origin,/data-action="search-open"/);
 assert.match(origin,/if\(e\.key==='ArrowDown'/);
 assert.match(origin,/if\(e\.key==='ArrowUp'/);
 assert.match(origin,/if\(e\.key==='Enter'&&e\.target===input&&hits\.length\)/);
 assert.match(origin,/addEventListener\('compositionend',e=>/);
 assert.match(origin,/aria-controls=\\"searchResults\\"/);
 assert.match(origin,/aria-expanded=\\"false\\"/);
 assert.match(origin,/function refreshFromCanonical\(\)/);
 assert.match(origin,/if\(open\)\{\s*renderSearch\(\$\('#originSearchInput'\)\.value\)/);
 assert.match(origin,/max-height:min\(68dvh,560px\)/);
 assert.doesNotMatch(origin,/localStorage\.setItem|firebase\/database|runTransaction/);
});

test('Origin task groups and memo list density stay view-only and retain filter scroll',()=>{
 assert.ok(origin.includes('taskCollapsedGroups=new Set()'));
 assert.ok(origin.includes('data-action="task-group-toggle"'));
 assert.ok(origin.includes('class="origin-task-group-rows"'));
 assert.ok(origin.includes("if(a==='task-group-toggle')"));
 assert.ok(origin.includes('aria-expanded="${!collapsed}"'));
 assert.ok(origin.includes("memoLayout=window.innerWidth<=420?'list':'cards'"));
 assert.ok(origin.includes('data-action="memo-layout"'));
 assert.ok(origin.includes('origin-memo-list'));
 assert.ok(origin.includes("if(a==='memo-layout')"));
 assert.ok(origin.includes('data-origin-scroll-key="task-status"'));
 assert.ok(origin.includes('data-origin-scroll-key="task-tabs"'));
 assert.ok(origin.includes('data-origin-scroll-key="memo-categories"'));
 assert.ok(origin.includes('data-origin-scroll-key="memo-colors"'));
 assert.ok(origin.includes('horizontalScroll=new Map'));
 assert.ok(origin.includes('el.scrollLeft=horizontalScroll.get'));
 assert.ok(origin.includes('origin-filter-current'));
 assert.ok(origin.includes('selectedBulk.delete(box.dataset.id)'));
 assert.ok(origin.includes("taskCollapsedGroups.clear();taskVisibleLimits.clear();selectedBulk.clear();return render()"));
 assert.doesNotMatch(origin,/localStorage\.setItem|firebase\/database|runTransaction/);
});


test('Origin sticky scroll does not create a host or body scroll container',()=>{
 const modernCss=readFileSync('modern-display-v356.css','utf8');
 assert.match(origin,/:host\{overflow-x:clip\}/);
 assert.match(modernCss,/html\[data-wb-display="modern"\]\[data-modern-origin-ready="true"\] body \{padding:0 !important;margin:0 !important;overflow-x:clip !important/);
 assert.match(origin,/\.header\{position:sticky;top:0;/);
 assert.match(origin,/viewScrollPositions\[view\]=window\.scrollY/);
 assert.match(origin,/window\.scrollTo\(\{top:Math\.max\(0,saved\),behavior:'instant'\}\)/);
});


test('Origin restores list focus only after save repaint and keeps search-origin navigation',()=>{
 const deferred=origin.indexOf('const returning=close&&panelOpen');
 const repaint=origin.indexOf('syncSnapshot();render();',deferred);
 const restore=origin.indexOf('restorePanelReturnPosition(returning.kind,returning.id)',deferred);
 assert.ok(deferred>=0&&repaint>deferred&&restore>repaint,'save must focus after repaint');
 assert.match(origin,/const replacing=panelOpen;[\s\S]*?if\(!replacing\)panelReturnScrollY=window\.scrollY/);
 assert.match(origin,/restorePanelReturnPosition\(origin\?\.kind\|\|kind,origin\?\.id\|\|id\)/);
 assert.ok(origin.includes("panelReturnSearch=a==='search-open'?{kind,id}:null"));
 assert.ok(origin.includes("if(panelReturnSearch&&search?.value.trim()){"));
 assert.ok(origin.includes("renderSearch(search.value);"));
 assert.ok(origin.includes("if(target)focusSearchResult(target);"));
 assert.ok(origin.includes("panelReturnSearch=null;"));
 // Restore the nearest visible record through the shared, scoped sequence helper.
 assert.match(origin,/target=originAdjacentReturnIds\(kind,id,visibleById\.keys\(\)\)/);
 assert.match(origin,/ids\.slice\(index\+1\)\.concat\(ids\.slice\(0,index\)\.reverse\(\)\)/);
 assert.match(origin,/document\.documentElement\.scrollHeight-window\.innerHeight/);
 assert.doesNotMatch(origin,/localStorage\.setItem|firebase\/database|runTransaction/);
});


test('Origin shared task, ToDo and schedule controls use readable typography and touch sizes',()=>{
 const rules=[
 ".origin-todo-main .todo-entry .todo-text{font-size:15px;line-height:1.5",
 ".origin-todo-main .todo-entry .todo-edit{flex:0 0 44px;width:44px;height:44px",
 ".origin-todo-add input{min-width:0;min-height:44px",
 ".origin-todo-archive-toggle{width:100%;",
 ".calendar-tools button{width:44px;height:44px",
 ".origin-day-controls button{display:grid;place-items:center;width:44px;height:44px",
 ".origin-schedule-view button{min-height:44px",
 ".origin-day-entry strong{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:14px",
 ".origin-day-entry time{font-size:12px",
 ".origin-agenda-entry strong{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:14px",
 ".origin-agenda-entry time{font-size:12px",
 ".origin-day-entry{grid-template-columns:84px minmax(0,1fr) 16px",
 ".status-marker .label{font-size:11px",
 ".select-small{min-height:44px",
 ".section-head h2{font-size:16px",
 ".tab-pills button{font-size:12px;font-weight:760;min-height:40px",
 "background:var(--accent);border-radius:10px;color:var(--on-accent)",
 ".day-chip.active{background:var(--accent);border-color:var(--accent);color:var(--on-accent)",
 ".origin-memo-colors span{font-size:11px;color:var(--ink-soft)",
 ".origin-memo-shell .memo-card h3{font-size:15px;line-height:1.45;margin-bottom:7px;display:-webkit-box",
 "@media(max-width:390px)"
];
 for(const rule of rules)assert.ok(origin.includes(rule),'Missing Origin display contract: '+rule);
 assert.doesNotMatch(origin,/localStorage\.setItem|firebase\/database|runTransaction/);
});

test("Origin Today clips only visible lines and retains complete schedule labels",()=>{
 assert.ok(origin.includes(".focus-name{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden"));
 assert.ok(origin.includes(".todo-title{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden"));
 assert.ok(origin.includes("class=\"agenda-entry\" data-action=\"open\" data-kind=\"events\" data-id=\"${esc(e.id)}\" title=\"${esc(e.title)}\""));
});

test("Origin long metadata wraps without expanding mobile viewport",()=>{
 assert.ok(origin.includes(".agenda-location{display:block;min-width:0"));
 assert.ok(origin.includes(".origin-agenda-entry small{min-width:0"));
 assert.ok(origin.includes(".origin-day-entry small{display:block;min-width:0"));
 assert.ok(origin.includes(".origin-task-collection .origin-task-meta{min-width:0;overflow-wrap:anywhere}"));
 assert.ok(origin.includes(".focus-meta>span{min-width:0;overflow-wrap:anywhere}"));
});

test("Origin compact inspector keeps full headings and all action groups scrollable",()=>{
 assert.ok(origin.includes(".sheet-head>div{min-width:0;flex:1 1 auto}"));
 assert.ok(origin.includes(".sheet-head h2{font-size:20px;max-height:min(26dvh,144px);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}"));
 assert.ok(origin.includes(".sheet-body{padding:16px 18px;scroll-padding-bottom:16px}"));
 assert.ok(origin.includes(".sheet-foot{padding:12px 18px max(15px,env(safe-area-inset-bottom,0px));max-height:min(38dvh,300px);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;flex:0 1 auto}"));
 assert.ok(origin.includes("<h2 id=\"panelHeading\" title=\"${esc(title)}\">${esc(title)}</h2>"));
});

test('Origin Today summary opens the matching task filter and selected-day calendar',()=>{
 assert.ok(origin.includes('class="origin-summary-filter" data-action="today-task-filter" data-value="active"'));
 assert.ok(origin.includes('data-action="today-task-filter" data-value="late"'));
 assert.ok(origin.includes('data-action="today-task-filter" data-value="waiting"'));
 assert.ok(origin.includes('data-action="today-calendar-day"'));
 assert.match(origin,/taskFilter=value==='waiting'\?'active':value/);
 assert.match(origin,/taskStatusChoice=value==='waiting'\?'確認待ち':''/);
 assert.match(origin,/taskQuery='';taskCollapsedGroups\.clear\(\);taskVisibleLimits\.clear\(\);selectedBulk\.clear\(\)/);
 assert.match(origin,/viewScrollPositions\.tasks=0/);
 assert.match(origin,/scheduleView='day'/);
 assert.match(origin,/viewScrollPositions\.calendar=0/);
});
test('Origin appointment list skips empty days but preserves weekly calendar',()=>{
 // Agenda-only construction is intentional: week/day views must not render
 // the duplicate agenda list while mobile week navigation stays available.
 assert.match(origin,/const agendaDays=scheduleView==='agenda'\?daysInWeek\.filter\(\(\{events\}\)=>events\.length>0\):\[\]/);
 assert.match(origin,/const agenda=scheduleView!=='agenda'\?'':agendaDays\.length/);
 assert.match(origin,/const weekJump=scheduleView==='week'&&calendarRenderedMobile/);
 assert.match(origin,/この週に該当する予定はありません/);
 assert.match(origin,/query\|\|scheduleAssignee!=='all'/);
 assert.match(origin,/scheduleView==='day'\?dayView:scheduleView==='agenda'\?agenda/);
 assert.match(origin,/class="week-board"/);
});

test('Origin mobile searches are visible before secondary task and memo filters',()=>{
 const taskSearch=origin.indexOf('<div class="origin-task-tools"');
 const statusFilters=origin.indexOf('<div class="status-rail"');
 const memoSearch=origin.indexOf('<div class="origin-memo-utility"');
 const categories=origin.indexOf('<div class="memo-toolbar">');
 assert.ok(taskSearch>0&&statusFilters>taskSearch);
 assert.ok(memoSearch>0&&categories>memoSearch);
 assert.match(origin,/data-action="jump-result" data-kind="tasks"/);
 assert.match(origin,/data-action="jump-result" data-kind="memos"/);
 assert.match(origin,/data-action="jump-result" data-kind="events"/);
 assert.match(origin,/function focusOriginFirstResult\(kind\)/);
 assert.match(origin,/first\.focus\(\{preventScroll:true\}\)/);
 assert.match(origin,/first\.scrollIntoView\(\{block:'center',inline:'nearest',behavior:'instant'\}\)/);
 assert.match(origin,/originTaskQuery:'tasks',originMemoQuery:'memos'/);
 assert.match(origin,/originScheduleSearch:'events',originTodoQuery:'todos'/);
});

test('Origin ToDo search filters pending titles and memos without hiding existing features',()=>{
 assert.match(origin,/todoSearchOpen=false,todoSearchHistory=false,todoQuery='',todoComposing=false/);
 assert.match(origin,/const q=todoQuery\.trim\(\)\.toLocaleLowerCase\(\)/);
 assert.match(origin,/function originVisiblePendingTodos\(\)/);
 assert.match(origin,/data\.todos\.filter\(t=>!t\.done&&\(!query\|\|\[t\.title,t\.memo\]/);
 assert.match(origin,/const shown=originVisiblePendingTodos\(\)/);
 assert.match(origin,/const mountedPending=shown\.slice\(0,todoPendingLimit\)/);
 assert.match(origin,/id="originTodoSearchPanel"/);
 assert.match(origin,/data-action="todo-search-toggle"/);
 assert.match(origin,/id="originTodoQuery"/);
 assert.match(origin,/aria-expanded="\$\{todoSearchOpen\}"/);
 assert.match(origin,/if\(a==='todo-search-toggle'\)/);
 assert.match(origin,/if\(!todoSearchOpen\)\{todoQuery='';todoSearchHistory=false;todoPendingLimit=TODO_RENDER_BATCH;todoCompletedLimit=TODO_RENDER_BATCH;\}/);
 assert.match(origin,/function updateTodoQuery\(input\)/);
 assert.match(origin,/if\(!e\.isComposing&&!todoComposing\)updateTodoQuery\(e\.target\)/);
 assert.match(origin,/if\(taskComposing\|\|memoComposing\|\|scheduleComposing\|\|todoComposing\)return/);
 assert.match(origin,/todoQuery='';todoSearchOpen=false/);
 assert.match(origin,/data-action="todo-completed-toggle"/);
 assert.match(origin,/data-form="quick-todo"/);
 assert.doesNotMatch(origin,/localStorage\.setItem|firebase\/database|runTransaction/);
});

test('Origin 320px hides only secondary task and memo controls while keeping search visible',()=>{
 assert.match(origin,/taskAdvancedOpen=false,memoAdvancedOpen=false/);
 assert.match(origin,/data-action="task-advanced-toggle"/);
 assert.match(origin,/data-action="memo-advanced-toggle"/);
 assert.match(origin,/aria-expanded="\$\{taskAdvancedOpen\}"/);
 assert.match(origin,/aria-expanded="\$\{memoAdvancedOpen\}"/);
 assert.match(origin,/originTaskStatusRail/);
 assert.match(origin,/originMemoColorFilters/);
 assert.match(origin,/origin-task-tools\[data-mobile-advanced=/);
 assert.match(origin,/origin-task-toolbar\[data-mobile-advanced=/);
 assert.match(origin,/origin-memo-filters\[data-mobile-advanced=/);
 assert.match(origin,/origin-memo-utility\[data-mobile-advanced=/);
 assert.match(origin,/if\(a==='task-advanced-toggle'\)/);
 assert.match(origin,/if\(a==='memo-advanced-toggle'\)/);
 assert.match(origin,/taskAdvancedOpen=false;memoAdvancedOpen=false;taskQuery=''/);
 assert.match(origin,/class="tab-pills" data-origin-scroll-key="task-tabs"/);
 assert.match(origin,/data-action="new" data-kind="tasks"/);
 assert.match(origin,/data-action="new" data-kind="memos"/);
});
test('Origin shows conditions from view-only filter state, not data fields',()=>{
 assert.match(origin,/const taskConditionCount=Number\(taskFilter!=='active'&&taskFilter!=='all'\)/);
 assert.match(origin,/Number\(Boolean\(taskStatusChoice\)\)/);
 assert.match(origin,/const memoConditionCount=Number\(memoFilter!=='all'\)/);
 assert.match(origin,/Number\(memoColorFilter!=='all'\)/);
 assert.match(origin,/origin-advanced-count/);
 assert.match(origin,/\.origin-mobile-advanced-switch\{display:none\}/);
 assert.doesNotMatch(origin,/localStorage\.setItem|firebase\/database|runTransaction/);
});

test('Origin task groups mount 24 rows at first and retain full filtered counts',()=>{
 assert.match(origin,/const TASK_RENDER_BATCH=24/);
 assert.match(origin,/taskVisibleLimits=new Map\(\)/);
 assert.match(origin,/const groupEntries=Object\.entries\(groups\)\.map/);
 assert.match(origin,/const limit=Math\.min\(rows\.length,savedLimit===Infinity/);
 assert.match(origin,/group\.rows\.slice\(0,group\.limit\)\.map\(task=>task\.id\)/);
 assert.match(origin,/for\(const id of selectedBulk\)if\(!selectable\.has\(id\)\)selectedBulk\.delete\(id\)/);
 assert.match(origin,/shown\.map\(taskRow\)\.join\(''\)/);
 assert.match(origin,/aria-label="\$\{esc\(name\)\}をさらに/);
 assert.match(origin,/data-action="task-load-more"/);
 assert.match(origin,/data-action="task-show-all"/);
 assert.match(origin,/renderedCount<visible\.length/);
 assert.match(origin,/taskVisibleLimits\.clear\(\)/);
 assert.match(origin,/data-group-key="\$\{esc\(groupKey\)\}"/);
 assert.match(origin,/origin-task-mobile-assignee/);
 assert.doesNotMatch(origin,/localStorage\.setItem|firebase\/database|runTransaction/);
});
test('Origin load-more restores keyboard focus and never bulk-selects unmounted rows',()=>{
 assert.match(origin,/if\(a==='task-load-more'\|\|a==='task-show-all'\)/);
 assert.match(origin,/rowGroup\.querySelectorAll\('\.item-row'\)\.length/);
 assert.match(origin,/taskVisibleLimits\.set\(groupKey,a==='task-show-all'\?Infinity:oldCount\+TASK_RENDER_BATCH\)/);
 assert.match(origin,/const next=updated\?\.querySelectorAll\('\.item-row'\)\[oldCount\]/);
 assert.match(origin,/first\.focus\(\{preventScroll:true\}\)/);
 assert.match(origin,/next\.scrollIntoView\(\{block:'nearest',behavior:'instant'\}\)/);
 assert.match(origin,/taskVisibleLimits\.clear\(\);selectedBulk\.clear\(\);render\(\);return/);
});

test('Origin memo library renders first 24 notes while retaining all filter results',()=>{
 assert.match(origin,/const MEMO_RENDER_BATCH=24/);
 assert.match(origin,/memoVisibleLimit=24/);
 assert.match(origin,/const mountedMemos=items\.slice\(0,memoVisibleLimit\)/);
 assert.match(origin,/const memoRemaining=items\.length-mountedMemos\.length/);
 assert.match(origin,/mountedMemos\.map\(m=>/);
 assert.match(origin,/表示 \$\{items\.length\}件 ／ 全体 \$\{data\.memos\.length\}件/);
 assert.match(origin,/data-action="memo-load-more"/);
 assert.match(origin,/data-action="memo-show-all"/);
 assert.match(origin,/memoVisibleLimit=a==='memo-show-all'\?Infinity:oldCount\+MEMO_RENDER_BATCH/);
 assert.match(origin,/next\.focus\(\{preventScroll:true\}\)/);
 assert.match(origin,/memoVisibleLimit=MEMO_RENDER_BATCH;return render\(\)/);
 assert.match(origin,/memoVisibleLimit=MEMO_RENDER_BATCH;render\(\);return/);
 assert.match(origin,/memoQuery=input\.value;memoVisibleLimit=MEMO_RENDER_BATCH;render\(\)/);
 assert.match(origin,/taskVisibleLimits\.clear\(\);memoVisibleLimit=MEMO_RENDER_BATCH/);
});
test('Origin memo cards expose secondary metadata and pin status without changing color controls',()=>{
 assert.match(origin,/class="origin-memo-metadata"/);
 assert.match(origin,/class="origin-memo-category"/);
 assert.match(origin,/class="origin-memo-date"/);
 assert.match(origin,/origin-memo-pinned/);
 assert.match(origin,/\$\{m\.pinned\?'固定 '\+icon\('pin',15\):icon\('right',15\)\}/);
 assert.match(origin,/class="origin-memo-colors"/);
 assert.match(origin,/data-action="memo-color"/);
 assert.match(origin,/data-action="memo-layout"/);
 assert.match(origin,/\.origin-memo-shell \.memo-card:focus-visible/);
 assert.doesNotMatch(origin,/localStorage\.setItem|firebase\/database|runTransaction/);
});

test('Origin detail return uses the original visible task or memo position',()=>{
 assert.match(origin,/function captureOriginReturnAnchor\(kind,id,trigger\)/);
 assert.match(origin,/function originReturnCard\(kind,id\)/);
 assert.match(origin,/function restorePanelReturnPosition\(kind,id\)/);
 assert.match(origin,/panelReturnAnchor=a==='open'\?captureOriginReturnAnchor\(kind,id,el\):null/);
 assert.match(origin,/const anchor=panelReturnAnchor/);
 assert.match(origin,/anchor&&anchor\.view===view&&anchor\.kind===kind/);
 assert.match(origin,/const target=revealOriginReturnCard\(kind,id\)/);
 assert.match(origin,/target\.focus\(\{preventScroll:true\}\)/);
 assert.match(origin,/window\.scrollY\+top-anchor\.top/);
 assert.match(origin,/panelReturnAnchor=null;panelReturnSearch=null/);
 assert.match(origin,/if\(panelReturnSearch&&search\?\.value\.trim\(\)\)/);
});
test('Origin restores edited records outside the first task or memo batch',()=>{
 assert.match(origin,/function originTaskGroupName\(task\)/);
 assert.match(origin,/const name=originTaskGroupName\(task\)/);
 assert.match(origin,/function originVisibleMemos\(\)/);
 assert.match(origin,/const items=originVisibleMemos\(\)/);
 assert.match(origin,/function revealOriginReturnCard\(kind,id\)/);
 assert.match(origin,/const visible=taskVisible\(\),item=visible\.find\(t=>t\.id===id\)/);
 assert.match(origin,/const index=visible\.filter\(t=>originTaskGroupName\(t\)===name\)/);
 assert.match(origin,/taskVisibleLimits\.set\(groupKey,Math\.ceil\(\(index\+1\)\/TASK_RENDER_BATCH\)\*TASK_RENDER_BATCH\)/);
 assert.match(origin,/const index=originVisibleMemos\(\)\.findIndex\(m=>m\.id===id\)/);
 assert.match(origin,/memoVisibleLimit=Math\.ceil\(\(index\+1\)\/MEMO_RENDER_BATCH\)\*MEMO_RENDER_BATCH/);
 assert.match(origin,/if\(changed\)render\(\)/);
 assert.doesNotMatch(origin,/localStorage\.setItem|firebase\/database|runTransaction/);
});

test('Origin detail pager spans filtered task and memo pages without mounting all rows',()=>{
 assert.match(origin,/function originPagedDetailIds\(kind\)/);
 assert.match(origin,/if\(kind==='memos'&&view==='notes'\)return originVisibleMemos\(\)\.map\(m=>m\.id\)/);
 assert.match(origin,/if\(kind!=='tasks'\|\|view!=='tasks'\)return null/);
 assert.match(origin,/for\(const task of taskVisible\(\)\)/);
 assert.match(origin,/const name=originTaskGroupName\(task\)/);
 assert.match(origin,/if\(taskCollapsedGroups\.has\(taskGrouping\+'\|'\+name\)\)continue/);
 assert.match(origin,/return Object\.values\(groups\)\.flat\(\)/);
 assert.match(origin,/const virtualIds=container\?\.id==='workspace'/);
 assert.match(origin,/if\(virtualIds!==null\)/);
 assert.match(origin,/for\(const candidate of virtualIds\)/);
 assert.match(origin,/seen\.add\(candidate\);ids\.push\(candidate\)/);
 assert.match(origin,/detailSequence=\{kind,view,ids\}/);
 assert.doesNotMatch(origin,/localStorage\.setItem|firebase\/database|runTransaction/);
});
test('Origin search hit pager still uses visible search results and detail return reveals pages',()=>{
 assert.match(origin,/const container=trigger\?\.closest\('#workspace'\)\|\|trigger\?\.closest\('#searchResults'\)/);
 assert.match(origin,/trigger\?\.dataset\.action==='open'/);
 assert.match(origin,/for\(const button of container\?\.querySelectorAll/);
 assert.match(origin,/!button\.getClientRects\(\)\.length/);
 assert.match(origin,/const target=revealOriginReturnCard\(kind,id\)/);
 assert.match(origin,/taskVisibleLimits\.set\(groupKey/);
 assert.match(origin,/memoVisibleLimit=Math\.ceil\(\(index\+1\)\/MEMO_RENDER_BATCH\)/);
});

test('Origin detail reader places type-specific summary before long text across all four domains',()=>{
 assert.match(origin,/function sheetFrame\(kicker,title,content,footer\)/);
 assert.match(origin,/const reading=panelMode==='detail'/);
 assert.match(origin,/class="origin-detail-reading" data-kind=/);
 assert.match(origin,/class="origin-task-overview" aria-label="タスクの要点"/);
 assert.match(origin,/class="origin-detail-main-fact \$\{t\.due/);
 assert.match(origin,/is-overdue/);
 assert.match(origin,/class="origin-detail-summary origin-todo-overview"/);
 assert.match(origin,/補足メモはありません。/);
 assert.match(origin,/class="detail-list origin-schedule-facts origin-detail-summary"/);
 assert.match(origin,/class="origin-event-times origin-detail-main-fact"/);
 assert.match(origin,/class="origin-detail-summary origin-memo-summary"/);
 assert.match(origin,/class="origin-detail-section origin-memo-document-section"/);
 assert.match(origin,/class="memo-document origin-memo-paper"/);
 assert.match(origin,/\.origin-detail-reading \.record-description\{white-space:pre-wrap/);
});
test('Origin reader is isolated from editing, preserves existing actions and dark-mode tokens',()=>{
 assert.match(origin,/panelMode==='detail'\s*\?/);
 assert.match(origin,/class="sheet-body">\$\{reading\}/);
 assert.match(origin,/form="editForm"/);
 assert.match(origin,/if\(!force&&panelMode==='edit'&&formSnapshot/);
 assert.match(origin,/function navigateDetail\(direction\)/);
 assert.match(origin,/data-action="detail-prev"/);
 assert.match(origin,/data-action="detail-next"/);
 assert.match(origin,/\.origin-detail-reading \.origin-detail-summary/);
 assert.match(origin,/background:color-mix\(in srgb,var\(--paper\) 88%,var\(--accent-bg\)\)/);
 assert.match(origin,/background:var\(--red-bg\)/);
 assert.match(origin,/\.origin-detail-reading \.origin-memo-paper/);
 assert.doesNotMatch(origin,/localStorage\.setItem|firebase\/database|runTransaction/);
});

test('Origin task and event inspector links are bidirectional with a local back stack',()=>{
 assert.match(origin,/const relatedEventLink=e=>/);
 assert.match(origin,/data-action="related-open" data-kind="events"/);
 assert.match(origin,/data-action="related-open" data-kind="tasks"/);
 assert.match(origin,/data-action="related-back"/);
 assert.match(origin,/function originRelatedBackBar\(\)/);
 assert.match(origin,/function openOriginRelatedDetail\(kind,id\)/);
 assert.match(origin,/function backOriginRelatedDetail\(\)/);
 assert.match(origin,/target\.relatedTaskId===panelId/);
 assert.match(origin,/findItem\('events',panelId\)\?\.relatedTaskId===id/);
 assert.match(origin,/let detailTrail=\[\]/);
 assert.match(origin,/detailTrail\.push\(previous\)/);
 assert.match(origin,/const previous=detailTrail\.pop\(\)/);
 assert.match(origin,/if\(a==='related-open'\)return openOriginRelatedDetail\(kind,id\)/);
 assert.match(origin,/if\(a==='related-back'\)return backOriginRelatedDetail\(\)/);
 assert.match(origin,/以前の関連タスク（現在は参照できません）/);
 assert.match(origin,/origin-related-link:focus-visible/);
});
test('Origin related-detail return preserves previous pager, body scroll and list focus',()=>{
 assert.match(origin,/sequence:detailSequence\?\{\.\.\.detailSequence,ids:\[\.\.\.detailSequence\.ids\]\}:null/);
 assert.match(origin,/scrollTop:\$\('#sheet \.sheet-body'\)\?\.scrollTop\|\|0/);
 assert.match(origin,/detailSequence=previous\.sequence/);
 assert.match(origin,/if\(body\)body\.scrollTop=previous\.scrollTop/);
 assert.match(origin,/relatedExpanded:Boolean\(\$\('#sheet \.origin-related-more'\)\?\.open\)/);
 assert.match(origin,/if\(relatedMore&&previous\.relatedExpanded\)relatedMore\.open=true/);
 assert.match(origin,/const origin=detailTrail\[0\]/);
 assert.match(origin,/restorePanelReturnPosition\(origin\?\.kind\|\|kind,origin\?\.id\|\|id\)/);
 assert.match(origin,/detailTrail=\[\];panelReturnSearch/);
 assert.match(origin,/if\(force\)detailTrail=\[\]/);
 assert.match(origin,/if\(!force&&panelMode==='edit'&&formSnapshot/);
 assert.doesNotMatch(origin,/localStorage\.setItem|firebase\/database|runTransaction/);
});
