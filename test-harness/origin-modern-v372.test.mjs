import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync('origin-modern-v372.js','utf8');
const css = readFileSync('modern-display-v356.css','utf8');
const app = readFileSync('app.js','utf8');
const manifest = readFileSync('release-manifest.js','utf8');
test('origin independent Modern reads the canonical data owner', () => {
  assert.match(source,/attachShadow/);
  assert.match(source,/WorkBoardPaletteBridge/);
  assert.match(source,/WorkBoardPaletteMemoBridgeV369/);
  assert.match(source,/workboard:canonical-bridge-ready/);
  assert.match(source,/originDisplaySelect/);
  assert.match(source,/WorkBoardPaletteMemoBridgeV369\?\.readSnapshot/);
  assert.doesNotMatch(source,/localStorage\.setItem/);
  assert.match(css,/data-modern-origin-ready/);
  assert.match(css,/body > \.app-shell/);
  assert.match(css,/data-wb-palette-next-preview/);
});
test('origin delegates schedule editing and safe task deletion', () => {
  assert.match(app,/WorkBoardOriginScheduleBridge = Object\.freeze/);
  assert.match(app,/openScheduleDialog\(record\)/);
  assert.match(app,/requestDeleteWithSeries\('task', id/);
  assert.match(app,/workboard:canonical-bridge-ready/);
  assert.doesNotMatch(source,/firebase\/database|runTransaction/);
});
test('origin belongs to the release manifest', () => {
  assert.doesNotMatch(manifest,/origin-modern-v372\.css/);
  assert.match(manifest,/origin-modern-v372\.js/);
  assert.match(css,/data-modern-origin-ready/);
  assert.match(source,/originSearchInput/);
  assert.match(source,/originToast/);
  assert.doesNotMatch(source,/この画面は新規設計のデモです/);
});

test('origin bulk completion delegates to a single revision-safe canonical transaction', () => {
  assert.match(source,/type:'task\.bulk\.complete',items/);
  assert.match(source,/selectedBulk\.clear\(\);render\(\)/);
  assert.doesNotMatch(source,/一括完了は既存のタスク画面から実行してください/);
  assert.match(app,/case 'task\.bulk\.complete'/);
  assert.match(app,/source: 'origin', ids, expectedRevisions,/);
  assert.match(app,/action: command\.type === 'task\.bulk\.complete' \? 'complete' : command\.action/);
  assert.match(app,/normalizeRevision\(task\.revision\) !== options\.expectedRevisions\[task\.id\]/);
  assert.match(app,/const result = await executeWrite\('bulk'/);
  assert.match(app,/normalizeRevision\(current\.revision\) !== normalizeRevision\(original\.revision\)/);
});

test('origin fully suppresses the former Modern view only when ready', () => {
  assert.match(css,/html\[data-wb-display="modern"\]\[data-modern-origin-ready="true"\]\[data-wb-color-theme\] body\.desktop-sidebar-v158 > \.app-shell/);
  assert.match(css,/body\.desktop-sidebar-v158 > \.app-shell\.detail-open/);
  assert.match(css,/html\[data-wb-display="modern"\]\[data-modern-origin-ready="true"\]:not\(\[data-wb-palette-next-preview="true"\]\) #modernOriginRoot/);
  assert.match(css,/#modernOriginRoot \{display:none !important;\}/);
});

test('origin shows the release manifest version instead of a separately maintained constant', () => {
  assert.match(source,/window\.WORK_BOARD_RELEASE_VERSION \|\| window\.WORK_BOARD_RELEASE\?\.version/);
  assert.match(source,/label\.textContent='WORKSPACE · Ver\.'\+release/);
  assert.match(source,/host\.dataset\.releaseVersion=release/);
});

test('origin schedule form submits canonical CAS commands without Classic modal',()=>{
  assert.match(source,/function originScheduleEditor\(v,id\)/);
  assert.match(source,/name="startAt" type="datetime-local"/);
  assert.match(source,/type:id\?'schedule.update':'schedule.create'/);
  assert.match(source,/f.dataset.revision=String\(original\?\.revision\?\?0\)/);
  assert.match(source,/type:'schedule.delete'/);
  assert.match(app,/case 'schedule.create':/);
  assert.match(app,/case 'schedule.update':/);
  assert.match(app,/case 'schedule.delete':/);
  assert.doesNotMatch(source,/if\(kind==='events' && edit\)\{window.WorkBoardOriginScheduleBridge/);
});

test('origin schedule UI is native and preserves canonical CAS ownership',()=>{
  assert.match(source,/function originScheduleEditor\(v,id\)/);
  assert.match(source,/name="startAt" type="datetime-local"/);
  assert.match(source,/name="endAt" type="datetime-local"/);
  assert.match(source,/data-action="schedule-duration"/);
  assert.match(source,/type:id\?'schedule.update':'schedule.create'/);
  assert.match(source,/f.dataset.revision=String\(original\?\.revision\?\?0\)/);
  assert.match(source,/type:'schedule.delete'/);
  assert.match(source,/schedule-classic/);
  for(const name of ['schedule.create','schedule.update','schedule.delete'])
    assert.match(app,new RegExp("case '"+name.replaceAll('.','\\.')+"':"));
  assert.doesNotMatch(source,/if\(kind==='events' && edit\)\{window.WorkBoardOriginScheduleBridge/);
});

test('origin task checklist delegates to canonical task writer',()=>{
 assert.match(source,/function taskPanel\(t\)/);
 assert.match(source,/function taskCheckToggle\(el\)/);
 assert.match(source,/checklistDone:rows\.map/);
 assert.match(app,/item\.done = command\.checklistDone\[index\]/);
});

test('origin task editor keeps canonical writes and supports check removal and deadline time',()=>{
 assert.match(source,/function taskCheckRow\(x=\{\}\)/);
 assert.match(source,/data-action="task-check-remove"/);
 assert.match(source,/name="dueTime" type="time"/);
 assert.match(source,/dueTime:fd.get\('due'\)/);
 assert.match(source,/originTaskError/);
 assert.match(source,/if\(busy\)/);
});

test('origin task state overview remains one compact row on desktop and accessible on mobile',()=>{
 assert.match(source,/status-rail\{display:grid;grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(source,/status-rail\{display:flex;gap:8px;overflow-x:auto/);
 assert.match(source,/class="todo-check task-select-check" data-action="bulk-toggle"/);
 assert.match(source,/\.todo-check:checked:after\{content:'';display:block/);
 assert.doesNotMatch(source,/style="width:16px;height:16px;flex-basis:16px"/);
});

test('origin displays canonical schedule save errors inside its own drawer without losing edits',()=>{
 assert.match(source,/function showEditorSaveError\(message,reason='retry'\)/);
 assert.match(source,/panelKind==='events' \? \$\('#originScheduleError'\)/);
 assert.match(source,/scheduleInvalid=command\.type\.startsWith\('schedule\.'\)/);
 assert.match(source,/showEditorSaveError\(msg,conflict\?'conflict':!editableWrite\|\|validation\?'validation':'retry'\)/);
 assert.match(source,/if\(reason!=='validation'\)showOriginSaveRecovery\(reason\)/);
 assert.match(source,/const canRetry=reason==='retry'&&Boolean\(form\.dataset\.id\)/);
 assert.match(source,/showEditorSaveError\(message\);notify\(message\)/);
});

test('origin ToDo forms follow canonical limits and reject validation without saving',()=>{
  assert.match(app,/todoTitleMaxLength: TODO_MAX_LENGTH/);
  assert.match(app,/todoMemoMaxLength: TODO_MEMO_MAX_LENGTH/);
  assert.match(app,/function rejectTodoInput\(message, field, reason, maxLength\)/);
  assert.match(app,/error: 'invalid-input', field, reason, maxLength/);
  assert.match(source,/maxlength="\$\{snapshot\.todoTitleMaxLength\}"/);
  assert.match(source,/maxlength="\$\{snapshot\.todoMemoMaxLength\}"/);
  assert.doesNotMatch(source,/maxlength="(?:130|220)"/);
  assert.match(source,/todoInvalid=command\.type\.startsWith\('todo\.'\)/);
});

test('origin ToDo editor saves content and completion in one revision-checked operation',()=>{
 assert.match(source,/kind==='memos'\?memoItems\.find\(x=>x\.id===id\):snapshot\.todos\.find\(x=>x\.id===id\)/);
 assert.match(source,/type:'todo\.update',id,text:title,memo:String\(fd\.get\('memo'\)\|\|''\)/);
 assert.match(source,/completed,revision,ownerRoom:f\.dataset\.ownerRoom,ownerUser:f\.dataset\.ownerUser/);
 assert.doesNotMatch(source,/if\(ok&&String\(fd\.get\('done'\)\)/);
 assert.match(app,/async function updateTodoDetails\(id, textInput, memoInput, options = \{\}\)/);
 assert.match(app,/commitTodoRecord\('todo-update', id, expectedRevision, current =>/);
 assert.match(app,/Object\.prototype\.hasOwnProperty\.call\(options, 'completed'\)/);
 assert.match(app,/next\.completedAt = options\.completed \? now : 0/);
 assert.match(app,/result = await updateTodoDetails\(id, command\.text, command\.memo \|\| '', command\)/);
});
test('origin ToDo create saves requested initial status without a second write',()=>{
 assert.match(source,/type:'todo\.create',text:title,memo:String\(fd\.get\('memo'\)\|\|''\),completed/);
 assert.match(app,/async function createTodo\(input, memoInput = '', options = \{\}\)/);
 assert.match(app,/record = \{ id, text, memo, completed, completedAt: completed \? now : 0, order:/);
 assert.match(app,/result = await createTodo\(command\.text, command\.memo \|\| '', command\)/);
});


test('origin history search uses filtered results without changing completion metrics',()=>{
 assert.match(source,/function originVisibleCompletedTodos\(\)/);
 assert.match(source,/const query=todoSearchHistory\?todoQuery\.trim\(\)\.toLocaleLowerCase\(\):''/);
 assert.match(source,/const totalDone=data\.todos\.length-pending\.length/);
 assert.match(source,/Math\.round\(totalDone\/data\.todos\.length\*100\)/);
 assert.match(source,/data-action="todo-search-history" aria-pressed="\$\{todoSearchHistory\}"/);
 assert.match(source,/todoSearchHistory\?' ・ 完了履歴 '\+done\.length\+'件':''/);
 assert.match(source,/if\(todoSearchHistory\)todoCompletedOpen=true/);
 assert.match(source,/todoSearchHistory=false;todoCompletedOpen=false/);
});
test('origin ToDo editing returns to a matching nearby editor while preserving global search',()=>{
 assert.match(source,/function restoreOriginTodoListReturn\(context,\{sameItem=false,action='todo-check'\}=\{\}\)/);
 assert.match(source,/const todoReturn=close&&savingPanel&&\['todo\.update','todo\.delete'\]\.includes\(command\.type\)&&!panelReturnSearch/);
 // Keep editing in the same list, but return to the completion control when
 // the edited ToDo moves between pending and completed sections.
 assert.match(source,/action:sameBucket\?'list-quick-edit':'todo-check'/);
 assert.match(source,/const sameBucket=beforeTodo&&beforeTodo\.done===command\.completed/);
 assert.match(source,/root\.querySelector\('#originTodoQuery'\)/);
 assert.match(source,/if\(a==='todo-search-history'\)/);
 assert.match(source,/kind==='todos'&&view==='todos'&&todoSearchHistory&&!todoCompletedOpen/);
});

test('origin ToDo search clear leaves history opt-in and search panel intact',()=>{
 assert.match(source,/data-action="todo-clear-query"/);
 const begin=source.indexOf(" if(a==='todo-clear-query'){");
 const end=source.indexOf(" if(a==='todo-search-toggle'){",begin);
 assert.ok(begin>0&&end>begin);
 const handler=source.slice(begin,end);
 assert.match(handler,/todoQuery=''/);
 assert.match(handler,/todoPendingLimit=TODO_RENDER_BATCH/);
 assert.match(handler,/todoCompletedLimit=TODO_RENDER_BATCH/);
 assert.match(handler,/#originTodoQuery/);
 assert.doesNotMatch(handler,/todoSearchHistory=false|todoSearchOpen=false|bridge\.dispatch|runTransaction/);
 assert.match(source,/origin-todo-search-history-wrap\{display:flex;justify-content:flex-start;flex-wrap:wrap;gap:8px/);
});


test('origin ToDo deletion preserves filtered list focus and protects the final match',()=>{
 assert.match(source,/async function deleteItem\(kind,id\)/);
 assert.match(source,/type:'todo\.delete',id,revision,ownerRoom:form\.dataset\.ownerRoom/);
 assert.match(source,/Number\(current\.revision\)!==revision/);
 assert.match(source,/command\.type==='todo\.delete'/);
 assert.match(source,/restoreOriginTodoListReturn\(todoReturn,\{action:'list-quick-edit'\}\)/);
 assert.match(source,/if\(!target\)\{\s*\/\/ After the final matching item is removed/);
 assert.match(source,/control\.scrollIntoView\(\{block:'nearest',inline:'nearest',behavior:'instant'\}\)/);
 assert.match(source,/showEditorSaveError\(msg,conflict\?'conflict':!editableWrite\|\|validation\?'validation':'retry'\)/);
});
test('canonical todo delete retains Classic confirmation and honors Origin edit-start revision',()=>{
 assert.match(app,/async function deleteTodo\(id, options = \{\}\)/);
 assert.match(app,/const guarded = Object\.prototype\.hasOwnProperty\.call\(options, 'revision'\)/);
 assert.match(app,/guarded && normalizeRevision\(todo\.revision\) !== expectedRevision/);
 assert.match(app,/if \(!confirm\(/);
 assert.match(app,/commitTodoRecord\('todo-delete', id, expectedRevision, current =>/);
 assert.match(app,/result = await deleteTodo\(id, command\)/);
});


test('origin empty ToDo result restores the appropriate section control',()=>{
 const from=source.indexOf("function restoreOriginTodoListReturn(");
 const until=source.indexOf("function originScheduleMeta(",from);
 assert.ok(from>0&&until>from);
 const restore=source.slice(from,until);
 assert.match(restore,/const queryInput=todoSearchOpen&&todoQuery\.trim\(\)\?root\.querySelector\('#originTodoQuery'\):null/);
 assert.match(restore,/context\.bucket==='completed'/);
 assert.match(restore,/:root\.querySelector\('\.origin-todo-add \[name="title"\]'\)\|\|root\.querySelector\('\.origin-todo-archive-toggle'\)/);
 assert.match(restore,/root\.querySelector\('\.origin-todo-archive-toggle'\)\|\|root\.querySelector\('\.origin-todo-add \[name="title"\]'\)/);
 assert.match(restore,/control\.focus\(\{preventScroll:true\}\)/);
 assert.match(restore,/control\.scrollIntoView\(\{block:'nearest',inline:'nearest',behavior:'instant'\}\)/);
});


test('origin return targets stay within filtered task and memo sequences',()=>{
 assert.match(source,/function originAdjacentReturnIds\(kind,id,currentIds\)/);
 assert.match(source,/const allowed=new Set\(currentIds\)/);
 assert.match(source,/ids\.slice\(index\+1\)\.concat\(ids\.slice\(0,index\)\.reverse\(\)\)/);
 assert.match(source,/function revealOriginAdjacentReturnCard\(kind,id\)/);
 assert.match(source,/taskVisible\(\)\.map\(t=>t\.id\)/);
 assert.match(source,/originVisibleMemos\(\)\.map\(m=>m\.id\)/);
 assert.match(source,/scheduleWeekResultIds:\[\]/);
 assert.match(source,/const target=revealOriginReturnCard\(kind,id\)\|\|revealOriginAdjacentReturnCard\(kind,id\)/);
 assert.match(source,/anchor\.action==='list-quick-edit'/);
 assert.match(source,/panelReturnAnchor=captureOriginReturnAnchor\(kind,id,el\)/);
 assert.match(source,/kind==='events'\?'.*origin-agenda-entry/s);
});
test('origin calendar return keeps global search order and reveals compact week day rows',()=>{
 assert.match(source,/const resultId=\[saved\.id,\.\.\.originAdjacentReturnIds\('events',saved\.id,available\)\]/);
 assert.match(source,/const resultIndex=available\.indexOf\(resultId\)/);
 assert.match(source,/scheduleExpandedDays\.add\(event\.date\)/);
 assert.match(source,/kind==='events'\?\$\('#workspace \[data-action="schedule-filter-toggle"\]'\)/);
});
