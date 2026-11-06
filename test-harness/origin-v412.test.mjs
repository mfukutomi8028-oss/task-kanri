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
 assert.match(origin,/if\(ok&&view==='notes'\)/);
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
 assert.match(origin,/aria-label="\$\{label\}を続けて確認。左右矢印キーでも移動できます"/);
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
