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
 assert.match(origin,/detailPager\(kind,id\)\+body/);
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
 assert.match(origin,/if\(kind==='todos'\)\{body=/);
 assert.doesNotMatch(origin,/kind==='todos'\)\{body=.*<dt>期限日<\/dt>/);
 assert.match(origin,/name="memo" placeholder="必要な情報を記録/);
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
 assert.match(origin,/if\(taskComposing\|\|memoComposing\|\|scheduleComposing\)return/);
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
 assert.match(origin,/data-action="schedule-classic"/);
 assert.match(origin,/editing&&id&&!\(kind==='events'&&item\.recurrenceSeriesId\)/);
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
 assert.match(origin,/class="origin-event-times"/);
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
 assert.ok(origin.includes("memoLayout='cards'"));
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
 assert.ok(origin.includes("taskCollapsedGroups.clear();selectedBulk.clear();return render()"));
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
 assert.match(origin,/if\(restoreFocus\)restorePanelReturnPosition\(kind,id\)/);
 assert.match(origin,/panelReturnSearch=a==='search-open'/);
 assert.match(origin,/if\(panelReturnSearch&&search\?\.value\.trim\(\)\)search\.focus/);
 assert.match(origin,/const nearest=ids\.slice\(/);
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
