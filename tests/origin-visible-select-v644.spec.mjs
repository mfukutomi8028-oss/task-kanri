import {test,expect} from '@playwright/test';

// Verify the actual Origin UI and canonical writer; only network requests to localhost are allowed.
async function openTasks(page,width,caseId){
 await page.setViewportSize({width,height:width<800?844:900});
 await page.route('**/*',route=>
  new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 const room='origin-visible-select-20261117-'+caseId+'-'+width;
 await page.addInitScript(roomId=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskRoomId',roomId);
  localStorage.setItem('systemTaskUser','OriginVisibleSelectionQA');
 },room);
 await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await expect(root).toBeVisible();
 await root.locator((width<768?'#mobileNav':'#desktopNav')+' [data-route="tasks"]').click();
 return root;
}
async function seed(page,count,{splitStatus=false}={}){
 return page.evaluate(async({count,splitStatus})=>{
  const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot(),ids=[];
  const due=new Date();due.setDate(due.getDate()+9);
  const dueDate=[due.getFullYear(),String(due.getMonth()+1).padStart(2,'0'),String(due.getDate()).padStart(2,'0')].join('-');
  const alt=s.statuses.find(status=>status!==s.statuses[0]&&status!=='完了');
  if(!alt)throw Error('No alternate non-complete status');
  for(let i=0;i<count;i++){
   const created=await bridge.dispatch({
    type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,
    title:'画面内選択テスト '+String(i+1).padStart(2,'0'),
    description:'Non-visible tasks must not be selected',
    status:splitStatus&&i>=count/2?alt:s.statuses[0],
    priority:'中',assignee:s.users[0],category:s.categories[0],
    requester:'',tags:'',checklist:'',checklistDone:[],
    dueDate,dueTime:'12:00',pinned:false
   });
   if(!created?.ok)throw Error('task.create '+JSON.stringify(created));
   ids.push(created.id);
  }
  return {ids,initial:s.statuses[0],alternate:alt};
 },{count,splitStatus});
}
async function filterTasks(root){
 const query=root.locator('#originTaskQuery');
 await query.fill('画面内選択テスト');
 await expect(query).toHaveValue('画面内選択テスト');
 return root.locator('.origin-task-collection .item-row');
}
for(const width of [320,390,1366]){
 test('Origin '+width+'px selects only mounted rows and clears without losing focus',async({page})=>{
  test.setTimeout(150000);
  const root=await openTasks(page,width,'page-only');
  await seed(page,32);
  const rows=await filterTasks(root);
  await expect(rows).toHaveCount(24);
  const selectShown=root.locator('#originTaskSelectShown');
  await expect(selectShown).toBeVisible();
  await expect(selectShown).toContainText('24件');
  await expect(selectShown).toHaveAttribute('aria-pressed','false');
  const hit=await selectShown.evaluate(el=>el.getBoundingClientRect().toJSON());
  expect(hit.height).toBeGreaterThanOrEqual(44);
  await selectShown.click();
  await expect(root.locator('.bulkbar')).toContainText('24件選択中');
  await expect(selectShown).toHaveAttribute('aria-pressed','true');
  await expect(root.locator('.origin-task-collection [data-action="bulk-toggle"]:checked')).toHaveCount(24);
  await expect(root.locator('.origin-task-summary')).toContainText('残り8件');
  await selectShown.click();
  await expect(root.locator('.bulkbar')).toHaveCount(0);
  await expect(root.locator('.origin-task-collection [data-action="bulk-toggle"]:checked')).toHaveCount(0);
  await expect(selectShown).toHaveAttribute('aria-pressed','false');
  await expect(selectShown).toBeFocused();
  await expect(root.locator('#originTaskQuery')).toHaveValue('画面内選択テスト');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
 });
}
test('Expanding more rows preserves selection and selects only the newly visible remainder',async({page})=>{
 test.setTimeout(120000);
 const root=await openTasks(page,390,'expand');
 await seed(page,32);
 const rows=await filterTasks(root);
 await root.locator('#originTaskSelectShown').click();
 await expect(rows).toHaveCount(24);
 await root.locator('[data-action="task-show-all"]').click();
 await expect(rows).toHaveCount(32);
 await expect(root.locator('.bulkbar')).toContainText('24件選択中');
 await expect(root.locator('#originTaskSelectShown')).toHaveAttribute('aria-pressed','false');
 await root.locator('#originTaskSelectShown').click();
 await expect(root.locator('.bulkbar')).toContainText('32件選択中');
 await expect(root.locator('.origin-task-collection [data-action="bulk-toggle"]:checked')).toHaveCount(32);
 await root.locator('[data-action="bulk-clear"]').click();
 await expect(root.locator('.bulkbar')).toHaveCount(0);
 const firstCheck=rows.first().locator('[data-action="bulk-toggle"]');
 await firstCheck.evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});
 await expect(root.locator('.bulkbar')).toContainText('1件選択中');
 await root.locator('#originTaskSelectShown').click();
 await expect(root.locator('.bulkbar')).toContainText('32件選択中');
});
test('Bulk status changes affect mounted rows only, never the unexpanded results',async({page})=>{
 test.setTimeout(120000);
 const root=await openTasks(page,1366,'safe-write');
 const initial=await seed(page,29);
 const rows=await filterTasks(root);
 await expect(rows).toHaveCount(24);
 const mountedIds=await rows.locator('[data-action="bulk-toggle"]').evaluateAll(els=>els.map(el=>el.dataset.id));
 await root.locator('#originTaskSelectShown').click();
 await root.locator('#originBulkStatus').selectOption(initial.alternate);
 await root.locator('[data-action="bulk-status-apply"]').click();
 await expect(root.locator('#originBulkReviewDialog')).toBeVisible();
 await root.locator('#originBulkReviewConfirm').click();
 await expect(root.locator('.bulkbar')).toHaveCount(0);
 const saved=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks);
 for(const id of initial.ids){
  const record=saved.find(t=>t.id===id);
  expect(record.status).toBe(mountedIds.includes(id)?initial.alternate:initial.initial);
 }
 await expect(root.locator('#originTaskQuery')).toHaveValue('画面内選択テスト');
});
test('Collapsed board column is not selected even though its rows exist in the DOM',async({page})=>{
 test.setTimeout(120000);
 const root=await openTasks(page,390,'collapsed-board');
 await seed(page,4,{splitStatus:true});
 await filterTasks(root);
 await root.locator('[data-action="task-layout"][data-value="board"]').click();
 const groups=root.locator('.origin-task-collection .origin-task-group');
 await expect(groups).toHaveCount(2);
 await groups.first().locator('[data-action="task-group-toggle"]').click();
 await expect(groups.first().locator('.origin-task-group-rows')).toBeHidden();
 const visibleInputs=root.locator('.origin-task-collection .origin-task-group-rows:not([hidden]) [data-action="bulk-toggle"]');
 await expect(visibleInputs).toHaveCount(2);
 await root.locator('#originTaskSelectShown').click();
 await expect(root.locator('.bulkbar')).toContainText('2件選択中');
 await expect(root.locator('#originTaskSelectShown')).toHaveAttribute('aria-pressed','true');
 await groups.first().locator('[data-action="task-group-toggle"]').click();
 await expect(root.locator('#originTaskSelectShown')).toHaveAttribute('aria-pressed','false');
 await expect(root.locator('.origin-task-collection [data-action="bulk-toggle"]:checked')).toHaveCount(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
});
