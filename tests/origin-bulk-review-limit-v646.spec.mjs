import {test,expect} from '@playwright/test';

// Exercise the actual Origin view and canonical writer with an isolated offline room.
async function origin(page,width,slug){
 await page.setViewportSize({width,height:width<800?844:900});
 await page.route('**/*',route=>
  new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 const room='origin-bulk-review-v646-'+width+'-'+slug;
 await page.addInitScript(id=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskRoomId',id);
  localStorage.setItem('systemTaskUser','OriginBulkReviewQA');
 },room);
 await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await expect(root).toBeVisible();
 await root.locator((width<768?'#mobileNav':'#desktopNav')+' [data-route="tasks"]').click();
 return root;
}
async function createTasks(page,count,tag){
 return page.evaluate(async({count,tag})=>{
  const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
  const due=new Date();due.setDate(due.getDate()+10);
  const date=[due.getFullYear(),String(due.getMonth()+1).padStart(2,'0'),String(due.getDate()).padStart(2,'0')].join('-');
  const ids=[];
  for(let i=0;i<count;i++){
   const saved=await bridge.dispatch({
    type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,
    title:tag+' '+String(i+1).padStart(3,'0'),description:'review coverage',
    status:s.statuses[0],priority:'中',assignee:s.users[0],
    category:s.categories[0],requester:'',tags:'',checklist:'',
    checklistDone:[],dueDate:date,dueTime:'15:00',pinned:false
   });
   if(!saved?.ok)throw Error('create failed '+JSON.stringify(saved));
   ids.push(saved.id);
  }
  const target=s.statuses.find(x=>x!==s.statuses[0]&&x!=='完了');
  if(!target)throw Error('No alternate status');
  return {ids,target,initial:s.statuses[0]};
 },{count,tag});
}
async function selectFirstTwo(root){
 const rows=root.locator('.origin-task-collection .item-row');
 await expect(rows).toHaveCount(3);
 const selected=await Promise.all([0,1].map(async i=>rows.nth(i).locator('[data-action="bulk-toggle"]').getAttribute('data-id')));
 for(const id of selected){
  await root.locator('.origin-task-collection [data-action="bulk-toggle"][data-id="'+id+'"]').evaluate(el=>{
   el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));
  });
 }
 await expect(root.locator('.bulkbar')).toContainText('2件選択中');
 return selected;
}
for(const width of [390,1366]){
 test('Origin '+width+'px status review lists exact tasks; cancel does not write; confirm updates',async({page})=>{
  test.setTimeout(120000);
  const root=await origin(page,width,'status');
  const record=await createTasks(page,3,'事前確認の状態');
  await root.locator('#originTaskQuery').fill('事前確認の状態');
  const ids=await selectFirstTwo(root);
  const trigger=root.locator('[data-action="bulk-status-apply"]');
  await root.locator('#originBulkStatus').selectOption(record.target);
  await trigger.click();
  const dialog=root.locator('#originBulkReviewDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('open','');
  await expect(dialog.locator('#originBulkReviewCount')).toContainText('2件');
  await expect(dialog.locator('#originBulkReviewTarget')).toContainText(record.target);
  await expect(dialog.locator('.origin-bulk-review-items li')).toHaveCount(2);
  for(const id of ids){
   const t=(await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks)).find(x=>x.id===id);
   await expect(dialog.locator('.origin-bulk-review-items')).toContainText(t.title);
  }
  await dialog.locator('#originBulkReviewCancel').click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(root.locator('.bulkbar')).toContainText('2件選択中');
  const unchanged=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks);
  expect(ids.every(id=>unchanged.find(t=>t.id===id)?.status===record.initial)).toBe(true);
  await trigger.click();
  await dialog.locator('#originBulkReviewConfirm').click();
  await expect(dialog).not.toBeVisible();
  await expect(root.locator('.bulkbar')).toHaveCount(0);
  const updated=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks);
  expect(ids.every(id=>updated.find(t=>t.id===id)?.status===record.target)).toBe(true);
  expect(updated.find(t=>t.id===record.ids.find(x=>!ids.includes(x)))?.status).toBe(record.initial);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
 });
}
test('Complete action previews selected task names; Escape and cancel are safe',async({page})=>{
 test.setTimeout(120000);
 const root=await origin(page,320,'complete');
 const data=await createTasks(page,3,'事前確認の完了');
 await root.locator('#originTaskQuery').fill('事前確認の完了');
 const ids=await selectFirstTwo(root);
 await root.locator('[data-action="bulk-done"]').click();
 const dialog=root.locator('#originBulkReviewDialog');
 await expect(dialog).toBeVisible();
 await expect(dialog.locator('#originBulkReviewTarget')).toContainText('完了');
 await expect(dialog.locator('.origin-bulk-review-items li')).toHaveCount(2);
 await page.keyboard.press('Escape');
 await expect(dialog).not.toBeVisible();
 const unchanged=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks);
 expect(ids.every(id=>!unchanged.find(t=>t.id===id)?.completed)).toBe(true);
 await root.locator('[data-action="bulk-done"]').click();
 await dialog.locator('#originBulkReviewConfirm').click();
 await expect(dialog).not.toBeVisible();
 await expect(root.locator('.bulkbar')).toHaveCount(0);
 const saved=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks);
 expect(ids.every(id=>saved.find(t=>t.id===id)?.completed)).toBe(true);
 expect(saved.find(t=>t.id===data.ids.find(x=>!ids.includes(x)))?.completed).toBe(false);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
});
test('Review blocks stale revisions without changing the other selected tasks',async({page})=>{
 test.setTimeout(120000);
 const root=await origin(page,390,'stale');
 const data=await createTasks(page,3,'事前確認の競合');
 await root.locator('#originTaskQuery').fill('事前確認の競合');
 const ids=await selectFirstTwo(root);
 await root.locator('#originBulkStatus').selectOption(data.target);
 await root.locator('[data-action="bulk-status-apply"]').click();
 const dialog=root.locator('#originBulkReviewDialog');
 await expect(dialog).toBeVisible();
 const output=await page.evaluate(async({id,target})=>
  window.WorkBoardPaletteBridge.dispatch({type:'task.status',id,status:target}),{id:ids[0],target:data.target});
 expect(output?.ok).toBe(true);
 await dialog.locator('#originBulkReviewConfirm').click();
 await expect(dialog).not.toBeVisible();
 await expect(root.locator('#originToast')).toContainText('再確認');
 const current=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks);
 expect(current.find(t=>t.id===ids[1]).status).toBe(data.initial);
});
test('More than 200 mounted rows cannot be silently selected as a single bulk action',async({page})=>{
 test.setTimeout(240000);
 const root=await origin(page,390,'cap-201');
 await createTasks(page,201,'上限確認');
 const rows=root.locator('.origin-task-collection .item-row');
 await root.locator('#originTaskQuery').fill('上限確認');
 await expect(rows).toHaveCount(24);
 await root.locator('[data-action="task-show-all"]').click();
 await expect(rows).toHaveCount(201);
 const selectAll=root.locator('#originTaskSelectShown');
 await expect(selectAll).toBeDisabled();
 await expect(root.locator('.origin-task-summary')).toContainText('200件まで');
 await expect(root.locator('.bulkbar')).toHaveCount(0);
});
