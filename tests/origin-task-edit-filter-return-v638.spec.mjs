import {test,expect} from '@playwright/test';

async function launch(page,width){
 await page.setViewportSize({width,height:width<800?844:900});
 await page.route('**/*',route=>
  new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 const room='origin-task-edit-return-v638-'+width;
 await page.addInitScript(id=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskRoomId',id);
  localStorage.setItem('systemTaskUser','TaskEditReturnQA');
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
  const day=offset=>{
   const d=new Date();d.setDate(d.getDate()+offset);
   return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  };
  for(let i=0;i<42;i++){
   const result=await bridge.dispatch({
    type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,
    title:'編集復帰対象 '+String(i+1).padStart(2,'0'),
    description:'編集保存後の検索・位置復元を検証',
    status:s.statuses[0],priority:'中',assignee:s.users[0],category:s.categories[0],
    requester:'',tags:'',checklist:'確認手順',checklistDone:[false],
    dueDate:day(5),dueTime:'14:00',pinned:false
   });
   if(!result?.ok)throw Error('task.create '+JSON.stringify(result));
  }
  return {first:s.statuses[0],second:s.statuses[1],farDue:day(60)};
 });
}
async function align(page,id){
 return page.evaluate(id=>{
  const mount=document.querySelector('#modernOriginRoot').shadowRoot;
  const row=[...mount.querySelectorAll('.origin-task-collection .item-row')]
   .find(node=>node.querySelector('.item-name')?.dataset.id===id);
  if(!row)throw Error('task row not mounted: '+id);
  window.scrollTo({top:window.scrollY+row.getBoundingClientRect().top-190,behavior:'instant'});
  return row.getBoundingClientRect().top;
 },id);
}
async function top(page,id){
 return page.evaluate(id=>{
  const mount=document.querySelector('#modernOriginRoot').shadowRoot;
  const row=[...mount.querySelectorAll('.origin-task-collection .item-row')]
   .find(node=>node.querySelector('.item-name')?.dataset.id===id);
  return row?.getBoundingClientRect().top??null;
 },id);
}
async function openAndEdit(root,id,change){
 const title=root.locator('.origin-task-collection .item-name[data-id="'+id+'"]');
 await title.click();
 const sheet=root.locator('#sheet');
 await expect(sheet.locator('#panelHeading')).toBeVisible();
 await sheet.locator('[data-action="edit"]').click();
 const form=sheet.locator('#editForm[data-kind="tasks"]');
 await expect(form).toBeVisible();
 await change(form);
 await root.locator('button[form="editForm"]').click();
 await expect(root.locator('#overlay')).toBeHidden();
}

for(const width of [390,1366]){
 test('Origin '+width+'px task edit keeps the search and returns to reordered or adjacent matching tasks',async({page})=>{
  test.setTimeout(180000);
  const root=await launch(page,width);
  const states=await seed(page);
  if(width<768)await root.locator('[data-action="task-advanced-toggle"]').click();
  await root.locator('#groupSelect').selectOption('status');
  await root.locator('#originTaskSort').selectOption('due');
  const query=root.locator('#originTaskQuery');
  await query.fill('編集復帰対象');
  const rows=root.locator('.origin-task-collection .item-row');
  await expect(rows).toHaveCount(24);

  // A saved due-date change moves the same task beyond the initial 24 rows.
  const movedId=await rows.nth(15).locator('.item-name').getAttribute('data-id');
  const beforeMove=await align(page,movedId);
  await openAndEdit(root,movedId,async form=>{
   await form.locator('[name="due"]').fill(states.farDue);
  });
  await expect(query).toHaveValue('編集復帰対象');
  await expect(rows).toHaveCount(42);
  const moved=root.locator('.origin-task-collection .item-name[data-id="'+movedId+'"]');
  await expect(moved).toBeVisible();
  await expect(moved).toBeFocused();
  expect(Math.abs((await top(page,movedId))-beforeMove)).toBeLessThan(90);
  expect(await page.evaluate(id=>window.WorkBoardPaletteBridge.readSnapshot().tasks
   .find(task=>task.id===id)?.dueDate,movedId)).toBe(states.farDue);

  // A title edit removes the inspected task from the query; focus the next match.
  const titleTarget=rows.nth(8);
  const titleId=await titleTarget.locator('.item-name').getAttribute('data-id');
  const titleNextId=await rows.nth(9).locator('.item-name').getAttribute('data-id');
  const beforeTitle=await align(page,titleId);
  await openAndEdit(root,titleId,async form=>{
   await form.locator('[name="title"]').fill('検索条件から外れたタスク');
  });
  await expect(query).toHaveValue('編集復帰対象');
  await expect(root.locator('.origin-task-collection .item-name[data-id="'+titleId+'"]')).toHaveCount(0);
  const titleNext=root.locator('.origin-task-collection .item-name[data-id="'+titleNextId+'"]');
  await expect(titleNext).toBeFocused();
  expect(Math.abs((await top(page,titleNextId))-beforeTitle)).toBeLessThan(90);

  // A status edit removes the task from the selected status filter; retain the next match.
  await root.locator('[data-action="filter-status"][data-status="'+states.first+'"]').click();
  await expect(rows).toHaveCount(24);
  const statusId=await rows.nth(6).locator('.item-name').getAttribute('data-id');
  const statusNextId=await rows.nth(7).locator('.item-name').getAttribute('data-id');
  const beforeStatus=await align(page,statusId);
  await openAndEdit(root,statusId,async form=>{
   await form.locator('[name="status"]').selectOption(states.second);
  });
  await expect(query).toHaveValue('編集復帰対象');
  await expect(root.locator('[data-action="filter-status"][data-status="'+states.first+'"]')).toHaveAttribute('aria-pressed','true');
  await expect(root.locator('.origin-task-collection .item-name[data-id="'+statusId+'"]')).toHaveCount(0);
  const statusNext=root.locator('.origin-task-collection .item-name[data-id="'+statusNextId+'"]');
  await expect(statusNext).toBeFocused();
  expect(Math.abs((await top(page,statusNextId))-beforeStatus)).toBeLessThan(90);

  const saved=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks
   .map(task=>({id:task.id,title:task.title,status:task.status,dueDate:task.dueDate})));
  expect(saved).toHaveLength(42);
  expect(saved.find(task=>task.id===movedId).dueDate).toBe(states.farDue);
  expect(saved.find(task=>task.id===titleId).title).toBe('検索条件から外れたタスク');
  expect(saved.find(task=>task.id===statusId).status).toBe(states.second);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
 });
}
