import {test,expect} from '@playwright/test';

// The canonical bridge uses only a local test room; external Firebase is blocked.
async function launch(page,width){
 await page.setViewportSize({width,height:width<800?844:900});
 await page.route('**/*',route=>
  new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 const room='origin-search-anchor-v637-'+width;
 await page.addInitScript(id=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskRoomId',id);
  localStorage.setItem('systemTaskUser','SearchAnchorQA');
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
   const match=i>=6;
   const record=await bridge.dispatch({
    type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,
    title:(match?'継続対象':'対象外')+' 検索復帰 '+String(i+1).padStart(2,'0'),
    description:'検索語変更と詳細復帰の検証',status:s.statuses[0],priority:'中',
    assignee:s.users[0],category:s.categories[0],requester:'',tags:'',
    checklist:'確認手順',checklistDone:[false],
    dueDate:day(match?5:2),dueTime:'14:00',pinned:false
   });
   if(!record?.ok)throw Error('task.create failed: '+JSON.stringify(record));
  }
 });
}
async function top(page,id){
 return page.evaluate(id=>{
  const mount=document.querySelector('#modernOriginRoot').shadowRoot;
  const row=[...mount.querySelectorAll('.origin-task-collection .item-row')]
   .find(node=>node.querySelector('.item-name')?.dataset.id===id);
  return row?.getBoundingClientRect().top??null;
 },id);
}
async function align(page,id){
 await page.evaluate(id=>{
  const mount=document.querySelector('#modernOriginRoot').shadowRoot;
  const row=[...mount.querySelectorAll('.origin-task-collection .item-row')]
   .find(node=>node.querySelector('.item-name')?.dataset.id===id);
  if(!row)throw Error('target task not mounted');
  window.scrollTo({top:window.scrollY+row.getBoundingClientRect().top-190,behavior:'instant'});
 },id);
 const pos=await top(page,id);
 expect(pos).toBeGreaterThan(110);
 expect(pos).toBeLessThan(290);
 return pos;
}
async function editSearch(root,value){
 await root.locator('#originTaskQuery').evaluate((input,text)=>{
  input.focus({preventScroll:true});
  input.value=text;
  input.dispatchEvent(new Event('input',{bubbles:true}));
 },value);
 await expect(root.locator('#originTaskQuery')).toHaveValue(value);
}
for(const width of [390,1366]){
 test('Origin '+width+'px search refinement, clear and detail return keep the current task visible',async({page})=>{
  test.setTimeout(180000);
  const root=await launch(page,width);
  await seed(page);
  const snapshotBefore=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks
   .map(t=>({id:t.id,status:t.status,revision:t.revision,title:t.title})));
  if(width<768)await root.locator('[data-action="task-advanced-toggle"]').click();
  await root.locator('#groupSelect').selectOption('status');
  await root.locator('[data-action="task-show-all"]').first().click();
  const id=await root.locator('.origin-task-collection .item-name[data-kind="tasks"]')
   .filter({hasText:'継続対象'}).nth(25).getAttribute('data-id');
  expect(id).toBeTruthy();
  const before=await align(page,id);
  await editSearch(root,'継続対象');
  await expect(root.locator('#originTaskQuery')).toBeFocused();
  // This row now falls beyond the 24-row batch after the query resets pagination.
  await expect(root.locator('.origin-task-collection .item-name[data-id="'+id+'"]')).toBeVisible();
  expect(Math.abs((await top(page,id))-before)).toBeLessThan(80);

  // Details must return to the same filtered result, scroll offset and keyboard target.
  const detailBefore=await align(page,id);
  await root.locator('.origin-task-collection .item-name[data-id="'+id+'"]')
   .evaluate(el=>el.click());
  await expect(root.locator('#overlay')).toBeVisible();
  await root.locator('#sheet .sheet-close[data-action="close"]').evaluate(el=>el.click());
  await expect(root.locator('#overlay')).toBeHidden();
  await expect(root.locator('#originTaskQuery')).toHaveValue('継続対象');
  await expect(root.locator('.origin-task-collection .item-name[data-id="'+id+'"]')).toBeFocused();
  expect(Math.abs((await top(page,id))-detailBefore)).toBeLessThan(80);

  // Clear the live query while preserving the same reading position and caret.
  const clearBefore=await align(page,id);
  await editSearch(root,'');
  await expect(root.locator('#originTaskQuery')).toBeFocused();
  await expect(root.locator('.origin-task-collection .item-name[data-id="'+id+'"]')).toBeVisible();
  expect(Math.abs((await top(page,id))-clearBefore)).toBeLessThan(80);

  // Reset button also disappears after click; focus must not remain lost or off-screen.
  await editSearch(root,'継続対象');
  const resetBefore=await align(page,id);
  await root.locator('[data-action="task-reset"]').evaluate(el=>{el.focus({preventScroll:true});el.click()});
  await expect(root.locator('#originTaskQuery')).toHaveValue('');
  await expect(root.locator('.origin-task-collection .item-name[data-id="'+id+'"]')).toBeFocused();
  expect(Math.abs((await top(page,id))-resetBefore)).toBeLessThan(80);
  expect(await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks
   .map(t=>({id:t.id,status:t.status,revision:t.revision,title:t.title})))).toEqual(snapshotBefore);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
 });
}
test('Origin 320px zero-result search retains editable focus and reset stays accessible',async({page})=>{
 test.setTimeout(90000);
 const root=await launch(page,320);
 await page.evaluate(async()=>{
  const b=window.WorkBoardPaletteBridge,s=b.readSnapshot();
  const d=new Date();d.setDate(d.getDate()+2);
  const due=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const result=await b.dispatch({
   type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,
   title:'320px検索操作テスト',description:'入力中のフォーカス保持',
   status:s.statuses[0],priority:'中',assignee:s.users[0],category:s.categories[0],
   requester:'',tags:'',checklist:'確認',checklistDone:[false],dueDate:due,dueTime:'14:00',pinned:false
  });
  if(!result?.ok)throw Error('seed task failed: '+JSON.stringify(result));
 });
 const search=root.locator('#originTaskQuery');
 await search.fill('絶対に一致しない検索条件');
 await expect(search).toBeFocused();
 await expect(root.locator('.origin-task-empty [data-action="task-reset"]')).toBeVisible();
 const pos=await root.locator('.origin-task-empty [data-action="task-reset"]')
  .evaluate(el=>el.getBoundingClientRect().top);
 expect(pos).toBeGreaterThan(0);
 expect(pos).toBeLessThan(844);
 await root.locator('.origin-task-empty [data-action="task-reset"]').click();
 await expect(search).toBeFocused();
 await expect(search).toHaveValue('');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
});
