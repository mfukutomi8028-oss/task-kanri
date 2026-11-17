import {test,expect} from '@playwright/test';

// Real Origin and canonical bridge, with outgoing connections blocked.
async function launch(page,width,slug){
 await page.setViewportSize({width,height:width<800?844:900});
 await page.route('**/*',route=>
  new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 const room='origin-bulk-status-v641-'+slug+'-'+width;
 await page.addInitScript(id=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskRoomId',id);
  localStorage.setItem('systemTaskUser','OriginBulkStatusQA');
 },room);
 await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await expect(root).toBeVisible();
 await root.locator((width<768?'#mobileNav':'#desktopNav')+' [data-route="tasks"]').click();
 return root;
}
async function seed(page,count=4){
 return page.evaluate(async count=>{
  const b=window.WorkBoardPaletteBridge,s=b.readSnapshot(),ids=[];
  const d=new Date();d.setDate(d.getDate()+6);
  const due=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  for(let i=0;i<count;i++){
   const saved=await b.dispatch({
    type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,
    title:'一括状態操作 '+String(i+1).padStart(2,'0'),
    description:'複数タスクの状態を安全に変更する',
    status:s.statuses[0],priority:'中',assignee:s.users[0],
    category:s.categories[0],requester:'',tags:'',checklist:'手順',
    checklistDone:[false],dueDate:due,dueTime:'14:00',pinned:false
   });
   if(!saved?.ok)throw Error('task.create '+JSON.stringify(saved));
   ids.push(saved.id);
  }
  const target=s.statuses.find(status=>status!==s.statuses[0]&&status!=='完了');
  if(!target)throw Error('No non-completion alternate status');
  return {ids,initial:s.statuses[0],target};
 },count);
}
async function selectTask(root,id){
 const box=root.locator('.origin-task-collection [data-action="bulk-toggle"][data-id="'+id+'"]');
 await box.evaluate(el=>{
  el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await expect(box).toBeChecked();
}
for(const width of [390,1366]){
 test('Origin '+width+'px changes only selected statuses through the canonical bulk writer',async({page})=>{
  test.setTimeout(120000);
  const root=await launch(page,width,'status-write');
  const state=await seed(page,4);
  const query=root.locator('#originTaskQuery');
  await query.fill('一括状態操作');
  const rows=root.locator('.origin-task-collection .item-row');
  await expect(rows).toHaveCount(4);
  const ids=await Promise.all([0,1,2].map(i=>rows.nth(i).locator('.item-name').getAttribute('data-id')));
  await selectTask(root,ids[0]);
  await selectTask(root,ids[1]);
  await expect(root.locator('.bulkbar')).toContainText('2件選択中');
  const selector=root.locator('#originBulkStatus');
  const apply=root.locator('[data-action="bulk-status-apply"]');
  await expect(selector).toBeVisible();
  await expect(apply).toBeDisabled();
  await selector.selectOption(state.target);
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(root.locator('.bulkbar')).toHaveCount(0);
  await expect(query).toHaveValue('一括状態操作');
  await expect(root.locator('#originToast')).toContainText('2件');
  const saved=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks);
  expect(saved.find(task=>task.id===ids[0])?.status).toBe(state.target);
  expect(saved.find(task=>task.id===ids[1])?.status).toBe(state.target);
  expect(saved.find(task=>task.id===ids[2])?.status).toBe(state.initial);
  expect(saved.find(task=>task.id===ids[0])?.completed).toBe(false);
  await expect(root.locator('.origin-task-collection .item-name[data-id="'+ids[2]+'"]')).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
 });
}
for(const width of [320,390,1366]){
 test('Origin '+width+'px makes selected task and its 44px touch target visible',async({page})=>{
  test.setTimeout(120000);
  const root=await launch(page,width,'selection-visual');
  await seed(page,3);
  const modes=width===390?['list','board','timeline']:['list'];
  for(const mode of modes){
   await root.locator('[data-action="task-layout"][data-value="'+mode+'"]').click();
   const rows=root.locator('.origin-task-collection .item-row');
   await expect(rows).toHaveCount(3);
   const row=rows.first();
   const hit=row.locator('.origin-task-select-hit');
   const checked=row.locator('[data-action="bulk-toggle"]');
   await expect(hit).toBeVisible();
   const rect=await hit.evaluate(el=>el.getBoundingClientRect().toJSON());
   expect(rect.width).toBeGreaterThanOrEqual(44);
   expect(rect.height).toBeGreaterThanOrEqual(44);
   const before=await row.evaluate(el=>getComputedStyle(el).backgroundColor);
   await hit.click();
   await expect(checked).toBeChecked();
   await expect(row).toHaveClass(/origin-task-selected/);
   const after=await row.evaluate(el=>getComputedStyle(el).backgroundColor);
   expect(after).not.toBe(before);
   await expect(root.locator('.bulkbar')).toContainText('1件選択中');
   await hit.click();
   await expect(checked).not.toBeChecked();
   await expect(row).not.toHaveClass(/origin-task-selected/);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
  }
 });
}
