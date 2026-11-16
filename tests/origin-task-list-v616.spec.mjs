import {test,expect} from '@playwright/test';

// Offline synthetic room: exercise the real Origin + canonical bridge without remote Firebase.
async function launch(page,width,slug){
 await page.setViewportSize({width,height:width<800?844:900});
 await page.route('**/*',route=>
  new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 const room='origin-next-queue-v611-'+slug+'-'+width;
 await page.addInitScript(id=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskRoomId',id);
  localStorage.setItem('systemTaskUser','OriginQueueQA');
 },room);
 await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await expect(root).toBeVisible();
 await root.locator((width<768?'#mobileNav':'#desktopNav')+' [data-route="tasks"]').click();
 return root;
}

async function seedTasks(page,items){
 return page.evaluate(async records=>{
  const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
  const dateOffset=offset=>{
   const day=new Date();day.setDate(day.getDate()+offset);
   return [day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),
    String(day.getDate()).padStart(2,'0')].join('-');
  };
  if(!s.statuses.includes('未着手')||!s.statuses.includes('対応中')||
    !s.statuses.includes('確認待ち'))throw Error('Expected test status vocabulary');
  const ids=[];
  for(const record of records){
   const result=await bridge.dispatch({
    type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,
    title:record.title,description:'入力を保持する説明 '+record.title,
    status:record.status||'未着手',priority:record.priority||'中',
    assignee:s.users?.[0]||s.currentUser,category:s.categories[0],requester:'',tags:'',
    checklist:record.checklist??'検証手順',
    checklistDone:record.checklistDone??String(record.checklist??'検証手順').split('\n').filter(Boolean).map(()=>false),
    dueDate:dateOffset(record.days),
    dueTime:'14:00',pinned:false
   });
   if(!result?.ok)throw Error('task.create '+JSON.stringify(result));
   ids.push(result.id);
  }
  return ids;
 },items);
}


for(const width of [320,390,1366]){
 test('Origin '+width+'px places task search directly after heading without recommendation queue',async({page})=>{
  test.setTimeout(90000);
  const root=await launch(page,width,'no-recommendation');
  await seedTasks(page,[
   {title:'端末更新計画の確認',days:0,priority:'高'},
   {title:'担当部署の作業日程を調整',days:3}
  ]);
  await expect(root.locator('.origin-next-task-queue')).toHaveCount(0);
  await expect(root.locator('[data-action="task-next-start"]')).toHaveCount(0);
  await expect(root.locator('.origin-task-collection .item-row')).toHaveCount(2);
  await expect(root.locator('#originTaskQuery')).toBeVisible();
  const geometry=await root.locator('#workspace').evaluate(workspace=>{
   const heading=workspace.querySelector('.page-heading').getBoundingClientRect();
   const command=workspace.querySelector('.origin-task-command').getBoundingClientRect();
   return {gap:command.top-heading.bottom,viewportOverflow:document.documentElement.scrollWidth-innerWidth};
  });
  expect(geometry.gap).toBeGreaterThanOrEqual(-2);
  expect(geometry.gap).toBeLessThan(70);
  expect(geometry.viewportOverflow).toBeLessThanOrEqual(3);
  await root.locator('#originTaskQuery').fill('更新計画');
  await expect(root.locator('.origin-task-collection .item-row')).toHaveCount(1);
  await expect(root.locator('.origin-task-collection .item-name')).toContainText('端末更新計画');
  await expect(root.locator('.origin-task-summary')).toContainText('表示 1件');
 });
 test('Origin '+width+'px task status control is touch-sized and retains keyboard focus',async({page})=>{
  test.setTimeout(90000);
  const root=await launch(page,width,'status-hit');
  const [id]=await seedTasks(page,[{title:'点検結果の確認',days:1}]);
  const control=root.locator('.origin-task-collection [data-action="task-inline-status"][data-id="'+id+'"]');
  await expect(control).toBeVisible();
  const rect=await control.evaluate(el=>el.getBoundingClientRect().toJSON());
  expect(rect.height).toBeGreaterThanOrEqual(44);
  expect(rect.width).toBeGreaterThanOrEqual(44);
  await control.focus();
  await expect(control).toBeFocused();
  expect(await control.evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
  await control.selectOption('対応中');
  await expect.poll(()=>page.evaluate(taskId=>
   window.WorkBoardPaletteBridge.readSnapshot().tasks.find(t=>t.id===taskId)?.status,id)
  ).toBe('対応中');
  await expect(control).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
 });
}

for(const width of [390,1366]){
 test('Origin '+width+'px keeps checklist progress in its task list after queue retirement',async({page})=>{
  test.setTimeout(90000);
  const root=await launch(page,width,'checklist-kept');
  const [id]=await seedTasks(page,[{
   title:'ネットワーク機器の設定確認',days:0,priority:'高',
   checklist:'構成確認\n差分の照合\n報告書の作成',checklistDone:[true,false,false]
  }]);
  const original=await page.evaluate(taskId=>{
   const t=window.WorkBoardPaletteBridge.readSnapshot().tasks.find(x=>x.id===taskId);
   return {checklist:t.checklist.map(x=>({text:x.text,done:x.done})),revision:t.revision};
  },id);
  const row=root.locator('.origin-task-collection .item-row',{hasText:'ネットワーク機器の設定確認'});
  await expect(row.locator('.origin-task-progress-pill')).toContainText('残り2件');
  if(width<768)await root.locator('[data-action="task-advanced-toggle"]').click();
  await root.locator('[data-action="task-density"]').click();
  await expect(row.locator('.origin-task-insight-next')).toContainText('差分の照合');
  await expect(row.locator('.origin-task-insight-next')).not.toContainText('構成確認');
  await expect(row.locator('.origin-task-progress-pill')).toContainText('残り2件');
  await expect(row.locator('[data-action="list-quick-edit"]')).toBeVisible();
  await expect(row.locator('[data-action="task-done"]')).toBeVisible();
  const after=await page.evaluate(taskId=>{
   const t=window.WorkBoardPaletteBridge.readSnapshot().tasks.find(x=>x.id===taskId);
   return {checklist:t.checklist.map(x=>({text:x.text,done:x.done})),revision:t.revision};
  },id);
  expect(after).toEqual(original);
  await expect(root.locator('.origin-next-task-queue')).toHaveCount(0);
 });
}

test('Origin empty task list has no queue while retaining task creation',async({page})=>{
 test.setTimeout(90000);
 const root=await launch(page,390,'empty-tasks');
 await expect(root.locator('.origin-next-task-queue')).toHaveCount(0);
 await expect(root.locator('.origin-task-collection .empty')).toBeVisible();
 await expect(root.locator('.origin-page-primary[data-action="new"][data-kind="tasks"]')).toBeVisible();
 await expect(root.locator('#originTaskQuery')).toBeVisible();
});
