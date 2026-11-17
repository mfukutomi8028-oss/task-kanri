import {test,expect} from '@playwright/test';

// Real Origin Shadow DOM and canonical bridge. Each test uses an isolated offline room.
async function launch(page,width,slug){
 await page.setViewportSize({width,height:width<800?844:900});
 await page.route('**/*',route=>
  new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 const room='origin-selection-scope-20261117-'+slug+'-'+width;
 await page.addInitScript(id=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskRoomId',id);
  localStorage.setItem('systemTaskUser','OriginScopeQA');
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
  const date=new Date();date.setDate(date.getDate()+8);
  const due=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  const ids=[];
  for(let i=0;i<3;i++){
   const saved=await bridge.dispatch({
    type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,
    title:'選択解除テスト '+String(i+1).padStart(2,'0'),
    description:'selected scope must be clear',status:s.statuses[0],
    priority:'中',assignee:s.users[0],category:s.categories[0],
    requester:'',tags:'',checklist:'',checklistDone:[],dueDate:due,dueTime:'14:00',pinned:false
   });
   if(!saved?.ok)throw Error('task.create '+JSON.stringify(saved));
   ids.push(saved.id);
  }
  const target=s.statuses.find(status=>status!==s.statuses[0]&&status!=='完了');
  if(!target)throw Error('No non-completed alternate status');
  return {ids,target};
 });
}
async function choose(root,ids){
 for(const id of ids){
  const box=root.locator('.origin-task-collection [data-action="bulk-toggle"][data-id="'+id+'"]');
  await box.evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});
 }
 await expect(root.locator('.bulkbar')).toContainText(ids.length+'件選択中');
}
async function assertScopeCleared(page,root,count){
 await expect(root.locator('.bulkbar')).toHaveCount(0);
 const toast=root.locator('#originToast');
 await expect(toast).toBeVisible();
 await expect(toast).toContainText('選択中の'+count+'件を解除');
 await expect(toast).toContainText('タスクは変更していません');
 await expect(toast).toHaveAttribute('role','status');
 const tasks=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks);
 expect(tasks.filter(t=>t.title.startsWith('選択解除テスト')).every(t=>!t.completed)).toBe(true);
}
for(const width of [320,390,1366]){
 test('Origin '+width+'px informs when search scope clears selected tasks, and keeps the query',async({page})=>{
  test.setTimeout(120000);
  const root=await launch(page,width,'query');
  const {ids,target}=await seed(page);
  await root.locator('#originTaskQuery').fill('選択解除テスト');
  await choose(root,ids.slice(0,2));
  await root.locator('#originBulkStatus').selectOption(target);
  await root.locator('#originTaskQuery').fill('選択解除テスト 03');
  await assertScopeCleared(page,root,2);
  const query=root.locator('#originTaskQuery');
  await expect(query).toHaveValue('選択解除テスト 03');
  await expect(query).toBeFocused();
  await expect(root.locator('.origin-task-collection .item-row')).toHaveCount(1);
  await choose(root,[ids[2]]);
  await expect(root.locator('#originBulkStatus')).toHaveValue('');
  await expect(root.locator('[data-action="bulk-status-apply"]')).toBeDisabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
 });
}
test('Origin 390px announces filter reset while preserving canonical tasks',async({page})=>{
 test.setTimeout(120000);
 const root=await launch(page,390,'filter');
 const {ids,target}=await seed(page);
 await root.locator('#originTaskQuery').fill('選択解除テスト');
 await choose(root,[ids[0]]);
 await root.locator('#originBulkStatus').selectOption(target);
 await root.locator('[data-action="task-filter"][data-value="all"]').click();
 await assertScopeCleared(page,root,1);
 await choose(root,[ids[1]]);
 await expect(root.locator('#originBulkStatus')).toHaveValue('');
 await expect(root.locator('[data-action="bulk-status-apply"]')).toBeDisabled();
});
test('Origin desktop layout/sort changes explain discarded choices without altering data',async({page})=>{
 test.setTimeout(120000);
 const root=await launch(page,1366,'sort-layout');
 const {ids}=await seed(page);
 await root.locator('#originTaskQuery').fill('選択解除テスト');
 await choose(root,[ids[0]]);
 await root.locator('#originTaskSort').selectOption('priority');
 await assertScopeCleared(page,root,1);
 await choose(root,[ids[1]]);
 await root.locator('[data-action="task-layout"][data-value="board"]').click();
 await assertScopeCleared(page,root,1);
});
test('Origin 320px explains removal of hidden selections on group collapse',async({page})=>{
 test.setTimeout(120000);
 const root=await launch(page,320,'collapse');
 const {ids}=await seed(page);
 await root.locator('#originTaskQuery').fill('選択解除テスト');
 await root.locator('[data-action="task-advanced-toggle"]').click();
 await root.locator('#groupSelect').selectOption('status');
 await choose(root,[ids[0]]);
 await root.locator('.origin-task-group [data-action="task-group-toggle"]').first().click();
 await assertScopeCleared(page,root,1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
});

test('Origin 390px explicit filter reset explains why an active bulk selection was removed',async({page})=>{
 test.setTimeout(120000);
 const root=await launch(page,390,'reset');
 const {ids}=await seed(page);
 await root.locator('#originTaskQuery').fill('選択解除テスト');
 await choose(root,[ids[0]]);
 await root.locator('[data-action="task-reset"]').click();
 await assertScopeCleared(page,root,1);
 await expect(root.locator('#originTaskQuery')).toHaveValue('');
});

test('Offscreen query updates announce the selection release exactly once',async({page})=>{
 test.setTimeout(90000);
 const root=await launch(page,390,'offscreen');
 const {ids}=await seed(page);
 await root.locator('#originTaskQuery').fill('選択解除テスト');
 await choose(root,[ids[0]]);
 const offscreen=await page.evaluate(()=>{
  const s=document.getElementById('modernOriginRoot').shadowRoot;
  const field=s.getElementById('originTaskQuery');
  field.style.transform='translateY(-4000px)';
  const hidden=field.getBoundingClientRect().bottom<0;
  const toast=s.getElementById('originToast');
  window.__scopeToastWrites=0;
  new MutationObserver(records=>{window.__scopeToastWrites+=records.filter(x=>x.type==='childList').length;})
   .observe(toast,{childList:true});
  field.value='選択解除テスト 02';
  field.dispatchEvent(new Event('input',{bubbles:true}));
  return hidden;
 });
 expect(offscreen).toBe(true);
 await expect(root.locator('#originToast')).toContainText('選択中の1件を解除');
 await expect.poll(()=>page.evaluate(()=>window.__scopeToastWrites)).toBe(1);
 await expect(root.locator('.bulkbar')).toHaveCount(0);
 await expect(root.locator('#originTaskQuery')).toHaveValue('選択解除テスト 02');
});
