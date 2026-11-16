import {test,expect} from '@playwright/test';

// Local-only room; exercise real Origin and the canonical bridge without Firebase writes.
async function launch(page,width,slug){
 await page.setViewportSize({width,height:width<800?844:900});
 await page.route('**/*',route=>
  new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 const room='origin-layout-anchor-'+slug+'-'+width;
 await page.addInitScript(id=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskRoomId',id);
  localStorage.setItem('systemTaskUser','LayoutAnchorQA');
 },room);
 await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await expect(root).toBeVisible();
 await root.locator((width<768?'#mobileNav':'#desktopNav')+' [data-route="tasks"]').click();
 return root;
}
async function seed(page){
 return page.evaluate(async()=>{
  const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
  const ids=[];
  for(let i=0;i<36;i++){
   const result=await bridge.dispatch({type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,
    revision:0,title:'画面位置保持 '+String(i+1).padStart(2,'0'),
    description:'表示切替でも操作位置を失わない',status:'未着手',priority:'中',
    assignee:s.currentUser,category:s.categories[0],requester:'',tags:'',
    checklist:'',dueDate:'',dueTime:'',pinned:false});
   if(!result?.ok)throw Error('task.create failed '+JSON.stringify(result));
   ids.push(result.id);
  }
  return ids;
 });
}
for(const width of [390,1366]){
 test('Origin '+width+'px layout change keeps the previously visible task near its screen position even beyond 24 rows',async({page})=>{
  test.setTimeout(120000);
  const root=await launch(page,width,'more-than-batch');
  const ids=await seed(page);
  const original=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks
   .map(t=>({id:t.id,revision:t.revision,status:t.status})));
  if(width<768)await root.locator('[data-action="task-advanced-toggle"]').click();
  await root.locator('#groupSelect').selectOption('status');
  await root.locator('#originTaskSort').selectOption('updated');
  const list=root.locator('.origin-task-collection');
  await list.locator('[data-action="task-show-all"]').click();
  const target=ids[29];
  await expect(list.locator('.item-name[data-id="'+target+'"]')).toBeVisible();
  await page.evaluate(id=>{
   const host=document.querySelector('#modernOriginRoot').shadowRoot;
   const row=[...host.querySelectorAll('.origin-task-collection .item-row')]
    .find(el=>el.querySelector('.item-name')?.dataset.id===id);
   window.scrollTo(0,window.scrollY+row.getBoundingClientRect().top-190);
  },target);
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(500);
  const before=await list.locator('.item-name[data-id="'+target+'"]').evaluate(el=>
   el.closest('.item-row').getBoundingClientRect().top);
  expect(before).toBeGreaterThan(115);
  expect(before).toBeLessThan(320);
  // DOM click avoids Playwright's automatic scroll-to-click changing the reading anchor.
  await root.locator('[data-action="task-layout"][data-value="board"]').evaluate(el=>el.click());
  const card=root.locator('.origin-task-layout-board .item-name[data-id="'+target+'"]');
  await expect(card).toBeVisible();
  const after=await card.evaluate(el=>el.closest('.item-row').getBoundingClientRect().top);
  expect(Math.abs(after-before)).toBeLessThan(75);
  await expect(root.locator('#originTaskSort')).toHaveValue('updated');
  await expect(root.locator('#originTaskQuery')).toHaveValue('');
  expect(await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks
   .map(t=>({id:t.id,revision:t.revision,status:t.status})))).toEqual(original);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
 });
}
