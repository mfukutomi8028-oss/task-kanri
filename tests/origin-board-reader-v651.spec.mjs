import {test,expect} from '@playwright/test';

// Isolated Origin room; no Firebase writes or production data.
async function openOrigin(page,width,slug){
 await page.setViewportSize({width,height:width<768?844:900});
 await page.route('**/*',route=>
  new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 const room='origin-board-reader-20261119-'+slug+'-'+width;
 await page.addInitScript(id=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskRoomId',id);
  localStorage.setItem('systemTaskUser','OriginReaderQA');
 },room);
 await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await expect(root).toBeVisible();
 await root.locator((width<768?'#mobileNav':'#desktopNav')+' [data-route="tasks"]').click();
 return root;
}

async function seedTasks(page){
 return page.evaluate(async()=>{
  const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
  const statuses=s.statuses.filter(x=>x!=='完了').slice(0,4);
  const now=new Date();now.setDate(now.getDate()+10);
  const due=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  const created=[];
  for(let i=0;i<statuses.length;i++){
   const result=await bridge.dispatch({
    type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,
    title:'ボード改善の確認 '+String(i+1),description:'この仕事内容と次に取るべき行動を視認性よく確認する。'.repeat(8),
    status:statuses[i],priority:i===0?'高':'中',assignee:s.users[0],category:s.categories[0],
    requester:'',tags:'事務,改善',checklist:'確認事項\n次の作業',
    checklistDone:[true,false],dueDate:due,dueTime:'15:30',pinned:false
   });
   if(!result?.ok)throw Error('task.create '+JSON.stringify(result));
   created.push({id:result.id,title:'ボード改善の確認 '+String(i+1),status:statuses[i]});
  }
  return created;
 });
}

for(const width of [320,390,1366]){
 test('Origin '+width+'px uses readable board cards in both densities with accessible actions',async({page})=>{
  test.setTimeout(150000);
  const root=await openOrigin(page,width,'board');
  const tasks=await seedTasks(page);
  await root.locator('[data-action="task-layout"][data-value="board"]').click();
  const board=root.locator('.origin-task-layout-board');
  await expect(board).toBeVisible();
  const cards=board.locator('.origin-board-card');
  await expect(cards).toHaveCount(tasks.length);
  const first=cards.first();
  await expect(first.locator('.item-name')).toBeVisible();
  await expect(first.locator('.origin-board-card-meta')).toContainText('担当');
  await expect(first.locator('.origin-board-card-meta')).toContainText('期限');
  await expect(first.locator('[data-action="task-inline-status"]')).toBeVisible();
  await expect(first.locator('[data-action="list-quick-edit"]')).toBeVisible();
  await expect(first.locator('[data-action="task-done"]')).toBeVisible();
  const compact=await first.evaluate(el=>({
   brief:!!el.querySelector('.origin-board-card-brief'),
   width:el.getBoundingClientRect().width
  }));
  expect(compact.brief).toBe(false);
  expect(compact.width).toBeGreaterThan(220);
  if(width<768){
   await root.locator('[data-action="task-advanced-toggle"]').click();
   await expect(root.locator('[data-action="task-density"]')).toBeVisible();
  }
  await root.locator('[data-action="task-density"]').click();
  await expect(board).not.toHaveClass(/origin-tasks-compact/);
  await expect(cards.first().locator('.origin-board-card-brief')).toBeVisible();
  await expect(cards.first().locator('.origin-board-card-description')).toContainText('この仕事内容');
  await expect(cards.first().locator('.origin-board-card-next')).toContainText('次の作業');
  // The board is presentation-only, never a new data owner.
  expect((await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks)).length).toBe(tasks.length);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
 });
}
test('Origin desktop board distributes four status lanes across the available width',async({page})=>{
 test.setTimeout(120000);
 const root=await openOrigin(page,1366,'lanes');
 const tasks=await seedTasks(page);
 expect(tasks.length).toBeGreaterThanOrEqual(4);
 await root.locator('[data-action="task-layout"][data-value="board"]').click();
 const board=root.locator('.origin-task-layout-board');
 await expect(board.locator(':scope > .origin-task-group')).toHaveCount(4);
 const coverage=await board.evaluate(el=>{
  const cols=[...el.querySelectorAll(':scope > .origin-task-group')];
  const left=cols[0].getBoundingClientRect().left;
  const right=cols[cols.length-1].getBoundingClientRect().right;
  return (right-left)/el.getBoundingClientRect().width;
 });
 expect(coverage).toBeGreaterThan(0.96);
});
test('Origin detail gives the description full width and hides the redundant auto-save badge',async({page})=>{
 test.setTimeout(100000);
 const root=await openOrigin(page,1366,'reader');
 const tasks=await seedTasks(page);
 const status=root.locator('#originTaskViewState');
 await expect(status).toBeHidden();
 await root.locator('.origin-task-collection .item-name[data-id="'+tasks[0].id+'"]').click();
 const sizes=await root.locator('#originTaskOverview').evaluate(el=>{
  const canvas=el.closest('.origin-task-detail-canvas'),main=canvas.querySelector('.origin-task-detail-main');
  return {canvas:canvas.getBoundingClientRect().width,main:main.getBoundingClientRect().width,
    overviewTop:el.getBoundingClientRect().top,mainTop:main.getBoundingClientRect().top};
 });
 expect(sizes.main/sizes.canvas).toBeGreaterThan(0.92);
 expect(sizes.mainTop).toBeGreaterThan(sizes.overviewTop);
});
test('Origin comment navigation always aligns the composer from work and related tabs',async({page})=>{
 test.setTimeout(120000);
 const root=await openOrigin(page,390,'jump');
 const tasks=await seedTasks(page);
 await root.locator('.origin-task-collection .item-name[data-id="'+tasks[0].id+'"]').click();
 const nav=root.locator('#sheet .origin-reader-nav');
 const move=async section=>nav.locator('[data-action="detail-jump"][data-value="'+section+'"]').click();
 const placement=()=>root.locator('#originCommentForm').evaluate(form=>{
  const shell=form.closest('.sheet-body');
  const nav=shell.querySelector('.origin-reader-nav');
  const section=form.closest('#originTaskComments');
  return {top:section.getBoundingClientRect().top,
   navBottom:nav.getBoundingClientRect().bottom,
   scrollTop:shell.scrollTop,formTop:form.getBoundingClientRect().top};
 });
 await move('originTaskWork');
 await move('originTaskComments');
 await expect(root.locator('#originCommentForm textarea[name="text"]')).toBeFocused();
 const fromWork=await placement();
 await move('originTaskLinks');
 await move('originTaskComments');
 await expect(root.locator('#originCommentForm textarea[name="text"]')).toBeFocused();
 const fromRelated=await placement();
 expect(Math.abs(fromRelated.top-fromWork.top)).toBeLessThanOrEqual(5);
 expect(fromRelated.formTop).toBeGreaterThanOrEqual(fromRelated.navBottom-2);
 expect(fromRelated.formTop).toBeLessThanOrEqual(fromRelated.navBottom+130);
});

test('Origin status board retains an empty lane after moving its final task',async({page})=>{
 test.setTimeout(120000);
 const root=await openOrigin(page,1366,'stable-empty-lane');
 const tasks=await seedTasks(page);
 await root.locator('[data-action="task-layout"][data-value="board"]').click();
 const board=root.locator('.origin-task-layout-board');
 const lanes=board.locator(':scope > .origin-task-group');
 const initial=await lanes.count();
 expect(initial).toBeGreaterThanOrEqual(4);
 const source=lanes.filter({has:page.locator('[data-id="'+tasks[0].id+'"][data-action="task-inline-status"]')});
 const other=tasks[1].status;
 await source.locator('[data-id="'+tasks[0].id+'"][data-action="task-inline-status"]').selectOption({label:other});
 await expect(board.locator('.origin-task-group')).toHaveCount(initial);
 const empty=board.locator('.origin-task-group').filter({has:page.locator('.group-title strong', {hasText:tasks[0].status})});
 await expect(empty.locator('.origin-board-lane-empty')).toContainText('この状態のタスクはありません');
 await expect(empty.locator('.origin-group-count')).toContainText('0件');
 await root.locator('[data-action="filter-status"][data-status="'+tasks[1].status+'"]').click();
 await expect(board.locator(':scope > .origin-task-group')).toHaveCount(1);
});

for(const width of [320,390]){
 test('Origin '+width+'px mobile board section navigation reveals a vertical lane without changing the task filter',async({page})=>{
  test.setTimeout(150000);
  const root=await openOrigin(page,width,'lane-nav');
  const tasks=await seedTasks(page);
  expect(tasks.length).toBe(4);
  await root.locator('[data-action="task-layout"][data-value="board"]').click();
  const board=root.locator('.origin-task-layout-board');
  const nav=root.locator('.origin-board-lane-nav');
  await expect(nav).toBeVisible();
  await expect(nav.locator('[data-action="board-lane-jump"]')).toHaveCount(4);
  const destination=board.locator(':scope > .origin-task-group').last();
  const last=nav.locator('[data-action="board-lane-jump"]').last();
  // On mobile the board lanes stack vertically, not horizontally.
  // Jumping to the last lane must reveal its heading below the sticky header.
  const before=await destination.locator('.origin-task-group-toggle').evaluate(el=>el.getBoundingClientRect().top);
  expect(before).toBeGreaterThan(650);
  await last.focus();
  await last.press('Enter');
  await expect(destination.locator('.origin-task-group-toggle')).toBeFocused();
  await expect.poll(()=>destination.locator('.origin-task-group-toggle').evaluate(el=>{
   const top=el.getBoundingClientRect().top;
   const header=el.getRootNode().querySelector('.header');
   const blockedUntil=Math.max(0,header?.getBoundingClientRect().bottom||0);
   return top>=blockedUntil-3&&top<window.innerHeight-100;
  })).toBe(true);
  expect(await page.evaluate(()=>window.scrollY)).toBeGreaterThan(0);
  await expect(root.locator('[data-action="task-filter"][data-value="active"]')).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks.length)).toBe(tasks.length);
  await root.locator('[data-action="task-advanced-toggle"]').click();
  await root.locator('[data-action="filter-status"][data-status="'+tasks[0].status+'"]').click();
  await expect(board.locator(':scope > .origin-task-group')).toHaveCount(1);
  await expect(root.locator('.origin-board-lane-nav')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
 });
}


test('Origin completed ToDo history is visible, dated and survives page reload',async({page})=>{
 test.setTimeout(120000);
 const root=await openOrigin(page,390,'todo-history');
 await root.locator('#mobileNav [data-route="todos"]').click();
 const add=root.locator('.origin-todo-add');
 await add.locator('input[name="title"]').fill('完了履歴で遡るToDo');
 await add.locator('button[type="submit"]').click();
 await expect(root.locator('.origin-todo-list .todo-text')).toContainText('完了履歴で遡るToDo');
 await root.locator('.origin-todo-list [data-action="todo-check"]').first().evaluate(el=>el.click());
 await root.locator('[data-action="todo-history-jump"]').click();
 const history=root.locator('#originCompletedTodos');
 await expect(history).toBeVisible();
 await expect(history).toContainText('完了履歴で遡るToDo');
 await expect(history.locator('time')).toHaveCount(1);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const reloaded=page.locator('#modernOriginRoot');
 await reloaded.locator('#mobileNav [data-route="todos"]').click();
 await reloaded.locator('[data-action="todo-history-jump"]').click();
 await expect(reloaded.locator('#originCompletedTodos')).toBeVisible();
 await expect(reloaded.locator('#originCompletedTodos')).toContainText('完了履歴で遡るToDo');
});

test('Origin task display returns to top when changing layout or sort',async({page})=>{
 test.setTimeout(120000);
 const root=await openOrigin(page,1366,'view-top');
 await page.setViewportSize({width:1366,height:430});
 await seedTasks(page);
 const scrollDown=async()=>page.evaluate(()=>{
  window.scrollTo(0,document.documentElement.scrollHeight);
  return window.scrollY;
 });
 expect(await scrollDown()).toBeGreaterThan(100);
 await root.locator('[data-action="task-layout"][data-value="board"]').evaluate(el=>el.click());
 expect(await page.evaluate(()=>window.scrollY)).toBeLessThan(30);
 expect(await scrollDown()).toBeGreaterThan(100);
 await root.locator('[data-action="task-layout"][data-value="list"]').evaluate(el=>el.click());
 expect(await page.evaluate(()=>window.scrollY)).toBeLessThan(30);
 expect(await scrollDown()).toBeGreaterThan(100);
 await root.locator('#originTaskSort').evaluate(el=>{el.value='priority';el.dispatchEvent(new Event('change',{bubbles:true}))});
 expect(await page.evaluate(()=>window.scrollY)).toBeLessThan(30);
});

test('Origin supports a secondary task sort, direction and clear grouping',async({page})=>{
 test.setTimeout(120000);
 const root=await openOrigin(page,1366,'multi-sort');
 await seedTasks(page);
 await root.locator('#groupSelect').selectOption('assignee');
 const primary=root.locator('#originTaskSort');
 await primary.selectOption('due');
 await root.locator('[data-action="task-sort-advanced"]').click();
 const secondary=root.locator('#originTaskSortSecondary');
 await expect(secondary).toBeVisible();
 await secondary.selectOption('priority');
 await expect(root.locator('.origin-task-collection .item-name').first()).toContainText('ボード改善の確認 1');
 await root.locator('#originTaskSecondaryDirection').selectOption('desc');
 await expect(root.locator('.origin-task-collection .item-name').first()).not.toContainText('ボード改善の確認 1');
 await expect(root.locator('#groupSelect')).toHaveValue('assignee');
});

test('Origin retries a stale saved-view conflict without showing a false save error',async({page})=>{
 test.setTimeout(120000);
 const root=await openOrigin(page,1366,'stale-view');
 await page.evaluate(()=>{
  const api=window.WorkBoardWorkflowV152;
  const original=api.writeSavedView.bind(api);
  window.__originSaveAttempts=0;
  api.writeSavedView=async(...args)=>{
   window.__originSaveAttempts++;
   if(window.__originSaveAttempts===1){
    api.workflow.savedViews[args[0]]={taskLayout:'list',taskGrouping:'deadline',columnSort:{key:'due',direction:'asc'},updatedAt:Date.now()};
    return {ok:false,conflict:true};
   }
   return original(...args);
  };
 });
 await root.locator('[data-action="task-layout"][data-value="board"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__originSaveAttempts)).toBeGreaterThanOrEqual(2);
 await expect(root.locator('#originTaskViewState')).toBeHidden();
 await expect(root.locator('[data-action="task-layout"][data-value="board"]')).toHaveAttribute('aria-pressed','true');
});

test('Origin shows theme-aware update age after seven days without modifying task data', async ({ page }) => {
  test.setTimeout(120000);
  const room='origin-board-reader-20261119-stale-age-1366';
  await page.addInitScript(roomId => {
    const day=86400000,now=Date.now();
    const create=(id,days,status='未着手',useCreated=false)=>({
      id,title:'更新経過確認 '+id,status,assignee:'OriginReaderQA',priority:'中',category:'PC',
      description:'',requester:'',tags:[],checklist:[],comments:[],history:[],
      recurrence:'none',recurrenceRule:{},dueDate:'',dueTime:'',pinned:false,
      createdAt:now-days*day,updatedAt:useCreated?0:now-days*day,revision:1
    });
    localStorage.setItem('system-task-tasks:'+roomId,JSON.stringify([
      create('stale-9',9),create('stale-created',8,'未着手',true),
      create('recent-6',6),create('completed-12',12,'完了')
    ]));
  },room);
  const root=await openOrigin(page,1366,'stale-age');
  const list=root.locator('.origin-task-layout-list');
  const row=id=>list.locator('.item-row:has(.item-name[data-id="'+id+'"])');
  await expect(row('stale-9').locator('.origin-task-stale-badge')).toContainText('更新なし 9日');
  await expect(row('stale-created').locator('.origin-task-stale-badge')).toContainText('更新なし 8日');
  await expect(row('recent-6').locator('.origin-task-stale-badge')).toHaveCount(0);
  await root.locator('[data-action="task-filter"][data-value="all"]').click();
  await expect(row('completed-12').locator('.origin-task-stale-badge')).toHaveCount(0);
  await root.locator('[data-action="task-layout"][data-value="board"]').click();
  await expect(root.locator('.origin-task-layout-board .origin-task-stale-badge').first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
});
