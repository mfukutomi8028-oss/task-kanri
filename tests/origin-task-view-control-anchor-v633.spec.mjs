import {test,expect} from '@playwright/test';

// Isolated local-only room. No remote Firebase writes.
async function launch(page,width){
 await page.setViewportSize({width,height:width<800?844:900});
 await page.route('**/*',route=>
  new URL(route.request().url()).origin==='http://127.0.0.1:4173'
    ?route.continue():route.abort('blockedbyclient'));
 const room='origin-control-anchor-v633-'+width;
 await page.addInitScript(id=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskRoomId',id);
  localStorage.setItem('systemTaskUser','ControlAnchorQA');
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
  const dayOffset=offset=>{
   const d=new Date();d.setDate(d.getDate()+offset);
   return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  };
  const ids=[];
  for(let i=0;i<36;i++){
   const result=await bridge.dispatch({
    type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,
    title:'閲覧位置確認 '+String(i+1).padStart(2,'0'),
    description:'表示条件の変更でも仕事の位置を維持する',
    status:s.statuses[0],priority:i<24?'低':'高',
    assignee:s.users[0],category:s.categories[0],requester:'',tags:'',
    checklist:'確認手順',checklistDone:[false],
    dueDate:dayOffset(i<24?1:9),dueTime:'14:00',pinned:false
   });
   if(!result?.ok)throw new Error('task.create '+JSON.stringify(result));
   ids.push(result.id);
  }
  return ids;
 });
}

async function alignTask(page,id){
 return page.evaluate(taskId=>{
  const shadow=document.querySelector('#modernOriginRoot').shadowRoot;
  const row=Array.from(shadow.querySelectorAll('.origin-task-collection .item-row'))
    .find(el=>el.querySelector('.item-name')?.dataset.id===taskId);
  if(!row)throw Error('selected task row was not mounted');
  window.scrollTo({top:window.scrollY+row.getBoundingClientRect().top-190,behavior:'instant'});
  return row.getBoundingClientRect().top;
 },id);
}

async function rowTop(page,id){
 return page.evaluate(taskId=>{
  const shadow=document.querySelector('#modernOriginRoot').shadowRoot;
  const row=Array.from(shadow.querySelectorAll('.origin-task-collection .item-row'))
    .find(el=>el.querySelector('.item-name')?.dataset.id===taskId);
  return row?.getBoundingClientRect().top??null;
 },id);
}

async function changeSelectWithoutChangingScroll(root,id,value){
 await root.locator('#'+id).evaluate((select,next)=>{
  select.focus({preventScroll:true});
  select.value=next;
  select.dispatchEvent(new Event('change',{bubbles:true}));
 },value);
}

for(const width of [390,1366]){
 test('Origin '+width+'px resets sort/group to top but retains focus and density reading position',async({page})=>{
  test.setTimeout(120000);
  const root=await launch(page,width);
  await seedTasks(page);
  const before=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks
    .map(t=>({id:t.id,revision:t.revision,status:t.status,priority:t.priority,dueDate:t.dueDate})));
  if(width<768)await root.locator('[data-action="task-advanced-toggle"]').click();
  await root.locator('#groupSelect').selectOption('status');
  await expect(root.locator('#originTaskSort')).toHaveValue('due');
  const collection=root.locator('.origin-task-collection');
  await collection.locator('[data-action="task-show-all"]').click();
  const id=await collection.locator('.item-name[data-action="open"]').nth(13).getAttribute('data-id');
  expect(id).toBeTruthy();

  // Ver.656 intentionally returns to the top after a sort or group change.
  // The chosen low-priority task moves beyond the initial 24-row page.
  const start=await alignTask(page,id);
  expect(start).toBeGreaterThan(120);
  expect(start).toBeLessThan(260);
  await changeSelectWithoutChangingScroll(root,'originTaskSort','priority');
  await expect(root.locator('#originTaskSort')).toHaveValue('priority');
  await expect(root.locator('#originTaskSort')).toBeFocused();
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeLessThan(20);
  await expect(collection.locator('.item-row')).toHaveCount(24);
  const showAll=collection.locator('[data-action="task-show-all"]');
  await expect(showAll).toHaveCount(1);
  await showAll.evaluate(el=>el.click());
  await expect(collection.locator('.item-name[data-id="'+id+'"]')).toBeVisible();

  await alignTask(page,id);
  await changeSelectWithoutChangingScroll(root,'groupSelect','deadline');
  await expect(root.locator('#groupSelect')).toHaveValue('deadline');
  await expect(root.locator('#groupSelect')).toBeFocused();
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeLessThan(20);
  await expect(collection.locator('.item-name[data-id="'+id+'"]')).toBeVisible();

  const densityBefore=await alignTask(page,id);
  const density=root.locator('[data-action="task-density"]');
  const oldPressed=await density.getAttribute('aria-pressed');
  await density.evaluate(el=>{el.focus({preventScroll:true});el.click()});
  await expect(density).toBeFocused();
  expect(await density.getAttribute('aria-pressed')).not.toBe(oldPressed);
  await expect(collection.locator('.item-name[data-id="'+id+'"]')).toBeVisible();
  expect(Math.abs((await rowTop(page,id))-densityBefore)).toBeLessThan(75);

  expect(await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks
    .map(t=>({id:t.id,revision:t.revision,status:t.status,priority:t.priority,dueDate:t.dueDate})))).toEqual(before);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
 });
}

test('Origin 320px keyboard can still operate task sort, grouping and density after re-render',async({page})=>{
 test.setTimeout(90000);
 const root=await launch(page,320);
 await root.locator('[data-action="task-advanced-toggle"]').click();
 for(const [id,value] of [['originTaskSort','priority'],['groupSelect','status']]){
  const input=root.locator('#'+id);
  await input.focus();
  await input.selectOption(value);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue(value);
 }
 const density=root.locator('[data-action="task-density"]');
 await density.focus();
 await density.press('Enter');
 await expect(density).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
});
