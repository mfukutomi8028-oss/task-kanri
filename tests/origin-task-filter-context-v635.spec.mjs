import {test,expect} from '@playwright/test';

// Actual Origin screen, private local-only room and canonical task bridge.
async function launch(page,width){
 await page.setViewportSize({width,height:width<800?844:900});
 await page.route('**/*',route=>
  new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 const room='origin-filter-context-v635-'+width;
 await page.addInitScript(id=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskRoomId',id);
  localStorage.setItem('systemTaskUser','FilterContextQA');
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
  if(s.statuses.length<3)throw Error('test requires at least three statuses');
  const due=new Date();due.setDate(due.getDate()+15);
  const date=[due.getFullYear(),String(due.getMonth()+1).padStart(2,'0'),String(due.getDate()).padStart(2,'0')].join('-');
  const ids={first:[],second:[],unused:s.statuses[2]};
  for(let i=0;i<44;i++){
   const second=i>=32;
   const record=await bridge.dispatch({
    type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,
    title:'絞り込み位置確認 '+String(i+1).padStart(2,'0'),
    description:'フィルター更新後の位置・フォーカスを検証',
    status:s.statuses[second?1:0],priority:'中',
    assignee:s.users[0],category:s.categories[0],requester:'',tags:'',
    checklist:'確認項目',checklistDone:[false],dueDate:date,dueTime:'14:00',pinned:false
   });
   if(!record?.ok)throw Error('task.create '+JSON.stringify(record));
   ids[second?'second':'first'].push(record.id);
  }
  ids.secondStatus=s.statuses[1];
  return ids;
 });
}
async function align(page,id){
 return page.evaluate(taskId=>{
  const mount=document.querySelector('#modernOriginRoot').shadowRoot;
  const row=[...mount.querySelectorAll('.origin-task-collection .item-row')]
   .find(node=>node.querySelector('.item-name')?.dataset.id===taskId);
  if(!row)throw Error('task missing before filter');
  window.scrollTo({top:window.scrollY+row.getBoundingClientRect().top-190,behavior:'instant'});
  return row.getBoundingClientRect().top;
 },id);
}
async function coordinates(page,id){
 return page.evaluate(taskId=>{
  const mount=document.querySelector('#modernOriginRoot').shadowRoot;
  const row=[...mount.querySelectorAll('.origin-task-collection .item-row')]
   .find(node=>node.querySelector('.item-name')?.dataset.id===taskId);
  return {top:row?.getBoundingClientRect().top??null,
   bottom:row?.getBoundingClientRect().bottom??null,height:innerHeight};
 },id);
}
async function choose(root,selector){
 await root.locator(selector).evaluate(el=>{
  el.focus({preventScroll:true});
  el.click();
 });
}
for(const width of [390,1366]){
 test('Origin '+width+'px filter preserves same task, finds a new matching task, and recovers from zero results',async({page})=>{
  test.setTimeout(160000);
  const root=await launch(page,width);
  const ids=await seed(page);
  const tasksBefore=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks
   .map(t=>({id:t.id,revision:t.revision,status:t.status,dueDate:t.dueDate})));
  if(width<768)await root.locator('[data-action="task-advanced-toggle"]').click();
  const collection=root.locator('.origin-task-collection');
  await collection.locator('[data-action="task-show-all"]').first().click();
  const anchorId=ids.first[19];
  const initial=await align(page,anchorId);
  expect(initial).toBeGreaterThan(120);
  expect(initial).toBeLessThan(270);

  await choose(root,'[data-action="task-filter"][data-value="all"]');
  await expect(root.locator('[data-action="task-filter"][data-value="all"]')).toHaveAttribute('aria-pressed','true');
  await expect(collection.locator('.item-name[data-id="'+anchorId+'"]')).toBeVisible();
  const same=await coordinates(page,anchorId);
  expect(Math.abs(same.top-initial)).toBeLessThan(75);

  await align(page,anchorId);
  await choose(root,'[data-action="filter-status"][data-status="'+ids.secondStatus+'"]');
  await expect(root.locator('[data-action="filter-status"][data-status="'+ids.secondStatus+'"]')).toHaveAttribute('aria-pressed','true');
  await expect(collection.locator('.item-name[data-id="'+anchorId+'"]')).toHaveCount(0);
  // The nearest survivor may differ from creation order after sorting.
  const focusedId=await root.evaluate(el=>el.shadowRoot.activeElement?.dataset.id||'');
  expect(ids.second).toContain(focusedId);
  const next=await coordinates(page,focusedId);
  expect(next.top).not.toBeNull();
  expect(next.top).toBeGreaterThan(70);
  expect(next.top).toBeLessThan(next.height-45);
  await expect(collection.locator('.item-name[data-id="'+focusedId+'"]')).toBeFocused();

  await choose(root,'[data-action="task-filter"][data-value="late"]');
  await expect(root.locator('.origin-task-empty')).toBeVisible();
  const recover=root.locator('.origin-task-empty [data-action="task-reset"]');
  await expect(recover).toBeFocused();
  const recoveryPosition=await recover.evaluate(el=>el.getBoundingClientRect());
  expect(recoveryPosition.top).toBeGreaterThan(70);
  expect(recoveryPosition.top).toBeLessThan(width<800?844:900);

  await recover.click();
  const query=root.locator('#originTaskQuery');
  await query.fill('絶対に存在しない検索文字列');
  await expect(query).toBeFocused();
  await expect(root.locator('.origin-task-empty [data-action="task-reset"]')).toBeVisible();
  expect(await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks
   .map(t=>({id:t.id,revision:t.revision,status:t.status,dueDate:t.dueDate})))).toEqual(tasksBefore);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
 });
}

test('Origin 320px filter controls keep keyboard focus with no task reading anchor',async({page})=>{
 test.setTimeout(90000);
 const root=await launch(page,320);
 await root.locator('[data-action="task-advanced-toggle"]').click();
 const all=root.locator('[data-action="task-filter"][data-value="all"]');
 await all.focus();
 await all.press('Enter');
 await expect(all).toBeFocused();
 await expect(all).toHaveAttribute('aria-pressed','true');
 const status=root.locator('[data-action="filter-status"]').first();
 await status.focus();
 await status.press('Enter');
 await expect(status).toBeFocused();
 await expect(root.locator('.origin-task-empty')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
});
