import {test,expect} from '@playwright/test';

// Keep the canonical bridge isolated; test real Origin UI controls.
async function launch(page,width){
 await page.setViewportSize({width,height:width<800?844:900});
 await page.route('**/*',route=>
  new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 const room='origin-bulk-toolbar-v640-'+width;
 await page.addInitScript(id=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskRoomId',id);
  localStorage.setItem('systemTaskUser','OriginBulkToolbarQA');
 },room);
 await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await expect(root).toBeVisible();
 await root.locator((width<768?'#mobileNav':'#desktopNav')+' [data-route="tasks"]').click();
 return root;
}
async function seed(page,count){
 return page.evaluate(async count=>{
  const b=window.WorkBoardPaletteBridge,s=b.readSnapshot(),ids=[];
  const d=new Date();d.setDate(d.getDate()+8);
  const due=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  for(let i=0;i<count;i++){
   const result=await b.dispatch({
    type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,
    title:'選択操作の検証 '+String(i+1).padStart(2,'0'),description:'操作バー追従を検証',
    status:s.statuses[0],priority:'中',assignee:s.users[0],category:s.categories[0],
    requester:'',tags:'',checklist:'手順',checklistDone:[false],
    dueDate:due,dueTime:'14:00',pinned:false
   });
   if(!result?.ok)throw Error(JSON.stringify(result));
   ids.push(result.id);
  }
  return ids;
 },count);
}
for(const width of [320,390,1366]){
 test('Origin '+width+'px bulk toolbar remains actionable and clearing selection restores checkbox focus',async({page})=>{
  test.setTimeout(180000);
  const root=await launch(page,width);
  const ids=await seed(page,32);
  const query=root.locator('#originTaskQuery');
  await query.fill('選択操作の検証');
  const rows=root.locator('.origin-task-collection .item-row');
  await expect(rows).toHaveCount(24);
  const selectedId=await rows.nth(12).locator('.item-name').getAttribute('data-id');
  const checkbox=root.locator('.origin-task-collection [data-action="bulk-toggle"][data-id="'+selectedId+'"]');
  await checkbox.evaluate(el=>{
   el.focus({preventScroll:true});
   el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await expect(checkbox).toBeChecked();
  const bar=root.locator('.bulkbar');
  await expect(bar).toBeVisible();
  const height=await bar.locator('[data-action="bulk-clear"]').evaluate(el=>el.getBoundingClientRect().height);
  expect(height).toBeGreaterThanOrEqual(44);
  // Simulate working deeper in a long list, then taking the batch action.
  await rows.nth(20).scrollIntoViewIfNeeded();
  await page.evaluate(()=>window.scrollBy({top:260,behavior:'instant'}));
  const position=await bar.evaluate(el=>{
   const r=el.getBoundingClientRect();
   const header=el.getRootNode().querySelector('.header').getBoundingClientRect();
   return {top:r.top,bottom:r.bottom,headerBottom:header.bottom,viewport:innerHeight};
  });
  expect(position.top).toBeGreaterThanOrEqual(position.headerBottom-5);
  expect(position.bottom).toBeLessThan(position.viewport-45);
  const before=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks.length);
  await bar.locator('[data-action="bulk-clear"]').click();
  await expect(bar).toHaveCount(0);
  await expect(checkbox).not.toBeChecked();
  await expect(checkbox).toBeFocused();
  await expect(query).toHaveValue('選択操作の検証');
  expect(await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks.length)).toBe(before);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
 });
}
