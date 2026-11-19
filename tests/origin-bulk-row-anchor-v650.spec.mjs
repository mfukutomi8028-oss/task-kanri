import {test,expect} from '@playwright/test';

// Selecting a row re-renders the toolbar. Keep the same task visible and
// keyboard-focused even when the toolbar appears or disappears above it.
async function openOrigin(page,width){
 await page.setViewportSize({width,height:width<800?844:900});
 await page.route('**/*',route=>
  new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 const room='origin-bulk-row-anchor-20261119-'+width;
 await page.addInitScript(id=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskRoomId',id);
  localStorage.setItem('systemTaskUser','OriginAnchorQA');
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
 await page.evaluate(async()=>{
  const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
  const date=new Date();date.setDate(date.getDate()+7);
  const due=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  for(let i=0;i<30;i++){
   const saved=await bridge.dispatch({
    type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,
    title:'選択位置の検証 '+String(i+1).padStart(2,'0'),description:'長い一覧での選択位置を確認',
    status:s.statuses[0],priority:'中',assignee:s.users[0],category:s.categories[0],
    requester:'',tags:'',checklist:'',checklistDone:[],dueDate:due,dueTime:'14:00',pinned:false
   });
   if(!saved?.ok)throw Error('task.create '+JSON.stringify(saved));
  }
 });
}
for(const width of [320,390,1366]){
 test('Origin '+width+'px keeps a row anchored while a selection toolbar appears and disappears',async({page})=>{
  test.setTimeout(180000);
  const root=await openOrigin(page,width);
  await seedTasks(page);
  await root.locator('#originTaskQuery').fill('選択位置の検証');
  const rows=root.locator('.origin-task-collection .item-row');
  await expect(rows).toHaveCount(24);
  const id=await rows.nth(12).locator('[data-action="bulk-toggle"]').getAttribute('data-id');
  const row=root.locator('.origin-task-collection .item-row').filter({
   has:root.locator('[data-action="bulk-toggle"][data-id="'+id+'"]')
  });
  await row.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  const checkbox=root.locator('[data-action="bulk-toggle"][data-id="'+id+'"]');
  const before=await row.evaluate(el=>el.getBoundingClientRect().top);
  await checkbox.evaluate(el=>{
   el.focus({preventScroll:true});
   el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await expect(root.locator('.bulkbar')).toContainText('1件選択中');
  await expect(checkbox).toBeFocused();
  const after=await row.evaluate(el=>el.getBoundingClientRect().top);
  expect(Math.abs(after-before)).toBeLessThanOrEqual(6);
  await checkbox.evaluate(el=>{
   el.focus({preventScroll:true});
   el.checked=false;el.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await expect(root.locator('.bulkbar')).toHaveCount(0);
  await expect(checkbox).toBeFocused();
  const cleared=await row.evaluate(el=>el.getBoundingClientRect().top);
  expect(Math.abs(cleared-before)).toBeLessThanOrEqual(6);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
 });
}
