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
