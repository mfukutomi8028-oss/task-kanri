import {test,expect} from '@playwright/test';

// Exercise the real Origin UI and canonical bridge without any network writes.
async function launch(page,width){
 await page.setViewportSize({width,height:width<800?844:900});
 await page.route('**/*',route=>
  new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 const room='origin-bulk-return-20261117-'+width;
 await page.addInitScript(id=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskRoomId',id);
  localStorage.setItem('systemTaskUser','OriginBulkReturnQA');
 },room);
 await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await expect(root).toBeVisible();
 await root.locator((width<768?'#mobileNav':'#desktopNav')+' [data-route="tasks"]').click();
 return root;
}

async function seed(page,count,title='一括復帰対象'){
 return page.evaluate(async({count,title})=>{
  const b=window.WorkBoardPaletteBridge,s=b.readSnapshot();
  const d=new Date();d.setDate(d.getDate()+10);
  const due=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),
    String(d.getDate()).padStart(2,'0')].join('-');
  const ids=[];
  for(let i=0;i<count;i++){
   const item=await b.dispatch({
    type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,
    title:title+' '+String(i+1).padStart(2,'0'),
    description:'一括処理後の操作位置を保持する',
    status:s.statuses[0],priority:'中',assignee:s.users[0],
    category:s.categories[0],requester:'',tags:'',checklist:'確認項目',
    checklistDone:[false],dueDate:due,dueTime:'14:00',pinned:false
   });
   if(!item?.ok)throw Error('task.create '+JSON.stringify(item));
   ids.push(item.id);
  }
  return {ids,firstStatus:s.statuses[0],secondStatus:s.statuses[1]};
 },{count,title});
}

async function selectBulk(root,id){
 const item=root.locator('.origin-task-collection [data-action="bulk-toggle"][data-id="'+id+'"]');
 await item.evaluate(el=>{
  el.checked=true;
  el.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await expect(root.locator('.origin-task-collection [data-action="bulk-toggle"][data-id="'+id+'"]'))
  .toBeChecked();
}
async function alignToReadingPosition(page,id){
 return page.evaluate(id=>{
  const s=document.querySelector('#modernOriginRoot').shadowRoot;
  const row=[...s.querySelectorAll('.origin-task-collection .item-row')]
   .find(el=>el.querySelector('.item-name')?.dataset.id===id);
  if(!row)throw Error('task row not mounted: '+id);
  window.scrollTo({top:window.scrollY+row.getBoundingClientRect().top-190,behavior:'instant'});
  return row.getBoundingClientRect().top;
 },id);
}
async function rowTop(page,id){
 return page.evaluate(id=>{
  const s=document.querySelector('#modernOriginRoot').shadowRoot;
  const row=[...s.querySelectorAll('.origin-task-collection .item-row')]
   .find(el=>el.querySelector('.item-name')?.dataset.id===id);
  return row?.getBoundingClientRect().top??null;
 },id);
}
async function completeSelected(page,root){
 page.once('dialog',dialog=>{void dialog.accept()});
 await root.locator('[data-action="bulk-done"]').evaluate(el=>{
  el.focus({preventScroll:true});
  el.click();
 });
 await expect(root.locator('.bulkbar')).toHaveCount(0);
}

for(const width of [390,1366]){
 test('Origin '+width+'px bulk completion focuses the next unfinished task at its reading position',async({page})=>{
  test.setTimeout(180000);
  const root=await launch(page,width);
  await seed(page,32);
  if(width<768)await root.locator('[data-action="task-advanced-toggle"]').click();
  await root.locator('#groupSelect').selectOption('status');
  const query=root.locator('#originTaskQuery');
  await query.fill('一括復帰対象');
  const rows=root.locator('.origin-task-collection .item-row');
  await expect(rows).toHaveCount(24);
  const selectedIds=await Promise.all([8,9].map(async n=>
   rows.nth(n).locator('.item-name').getAttribute('data-id')));
  const nextId=await rows.nth(10).locator('.item-name').getAttribute('data-id');
  await selectBulk(root,selectedIds[0]);
  await selectBulk(root,selectedIds[1]);
  const before=await alignToReadingPosition(page,selectedIds[1]);
  expect(before).toBeGreaterThan(105);
  expect(before).toBeLessThan(270);
  await completeSelected(page,root);
  const next=root.locator('.origin-task-collection .item-name[data-id="'+nextId+'"]');
  await expect(next).toBeVisible();
  await expect(next).toBeFocused();
  expect(Math.abs((await rowTop(page,nextId))-before)).toBeLessThan(110);
  await expect(query).toHaveValue('一括復帰対象');
  await expect(root.locator('.origin-task-collection [data-id="'+selectedIds[0]+'"]')).toHaveCount(0);
  await expect(root.locator('.origin-task-collection [data-id="'+selectedIds[1]+'"]')).toHaveCount(0);
  const tasks=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks);
  expect(selectedIds.every(id=>tasks.find(t=>t.id===id)?.completed)).toBe(true);
  expect(tasks.find(t=>t.id===nextId)?.completed).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
 });
}

test('Origin 320px bulk completing the last search match focuses the visible query',async({page})=>{
 test.setTimeout(90000);
 const root=await launch(page,320);
 const {ids}=await seed(page,1,'最後の一致');
 const query=root.locator('#originTaskQuery');
 await query.fill('最後の一致');
 await expect(root.locator('.origin-task-collection .item-row')).toHaveCount(1);
 await selectBulk(root,ids[0]);
 await completeSelected(page,root);
 await expect(root.locator('.origin-task-empty')).toBeVisible();
 await expect(query).toHaveValue('最後の一致');
 await expect(query).toBeFocused();
 const q=await query.evaluate(el=>({top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom}));
 expect(q.bottom).toBeGreaterThan(60);
 expect(q.top).toBeLessThan(844);
 expect(await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks.find(t=>t.id===ids[0])?.completed)).toBe(true);
});
