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
    checklist:'検証手順',dueDate:dateOffset(record.days),
    dueTime:'14:00',pinned:false
   });
   if(!result?.ok)throw Error('task.create '+JSON.stringify(result));
   ids.push(result.id);
  }
  return ids;
 },items);
}

test('Origin task action queue explains the next three choices without listing waiting work',async({page})=>{
 test.setTimeout(90000);
 const root=await launch(page,1366,'priority');
 const ids=await seedTasks(page,[
  {title:'確認待ちの緊急案件',days:-5,priority:'緊急',status:'確認待ち'},
  {title:'来週の低優先案件',days:10,priority:'低'},
  {title:'期限超過の進行中案件',days:-2,priority:'中',status:'対応中'},
  {title:'今日が期限の確認業務',days:0,priority:'中'},
  {title:'来週の高優先案件',days:5,priority:'高'}
 ]);
 const queue=root.locator('.origin-next-task-queue');
 await expect(queue).toBeVisible();
 const cards=queue.locator('.origin-next-task-card');
 await expect(cards).toHaveCount(3);
 await expect(cards.locator('.origin-next-task-title')).toHaveText([
  '期限超過の進行中案件','今日が期限の確認業務','来週の高優先案件'
 ]);
 await expect(cards.locator('.origin-next-task-reason')).toContainText([
  '期限超過','今日が期限','高優先'
 ]);
 expect(await cards.evaluateAll(nodes=>nodes.map(n=>n.dataset.id))).toEqual([
  ids[2],ids[3],ids[4]
 ]);
 await expect(root.locator('.origin-task-collection .item-row')).toHaveCount(5);
});

test('Origin task action queue starts an unstarted task using canonical status-only write',async({page})=>{
 test.setTimeout(90000);
 const root=await launch(page,1366,'start');
 const [id]=await seedTasks(page,[{title:'着手する設備点検',days:1,priority:'中'}]);
 const before=await page.evaluate(taskId=>{
  const task=window.WorkBoardPaletteBridge.readSnapshot().tasks.find(t=>t.id===taskId);
  return {title:task.title,description:task.description,priority:task.priority,
   dueDate:task.dueDate,checklist:task.checklist,revision:task.revision,status:task.status};
 },id);
 expect(before.status).toBe('未着手');
 const card=root.locator('.origin-next-task-card[data-id="'+id+'"]');
 const start=card.locator('[data-action="task-next-start"]');
 await expect(start).toBeVisible();
 await start.click();
 await expect.poll(async()=>page.evaluate(taskId=>
  window.WorkBoardPaletteBridge.readSnapshot().tasks.find(t=>t.id===taskId)?.status,id)
 ).toBe('対応中');
 const after=await page.evaluate(taskId=>{
  const task=window.WorkBoardPaletteBridge.readSnapshot().tasks.find(t=>t.id===taskId);
  return {title:task.title,description:task.description,priority:task.priority,
   dueDate:task.dueDate,checklist:task.checklist,revision:task.revision,status:task.status};
 },id);
 const {revision,...unchanged}=before;
 expect(after).toMatchObject({...unchanged,status:'対応中'});
 expect(after.revision).toBeGreaterThan(revision);
 await expect(card.locator('[data-action="task-next-start"]')).toHaveCount(0);
 await card.locator('.origin-next-task-title').click();
 await expect(root.locator('#sheet')).toContainText('着手する設備点検');
 await root.locator('#sheet .sheet-close').click();
 await expect(card.locator('.origin-next-task-title')).toBeFocused();
});

test('Origin task action queue follows search filters and never shows unrelated tasks',async({page})=>{
 test.setTimeout(90000);
 const root=await launch(page,1366,'filter');
 await seedTasks(page,[
  {title:'医療機器点検資料をまとめる',days:0},
  {title:'採用ページの更新を確認',days:0}
 ]);
 const queue=root.locator('.origin-next-task-queue');
 await expect(queue.locator('.origin-next-task-card')).toHaveCount(2);
 await root.locator('#originTaskQuery').fill('資料');
 await expect(queue.locator('.origin-next-task-card')).toHaveCount(1);
 await expect(queue.locator('.origin-next-task-title')).toHaveText('医療機器点検資料をまとめる');
 await root.locator('#originTaskQuery').fill('一致しない文字列');
 await expect(root.locator('.origin-next-task-queue')).toHaveCount(0);
 await root.locator('#originTaskQuery').fill('');
 await expect(queue.locator('.origin-next-task-card')).toHaveCount(2);
});

for(const width of [320,390,1280]){
 test('Origin '+width+'px action queue stays readable, accessible, and within viewport',async({page})=>{
  test.setTimeout(90000);
  const root=await launch(page,width,'responsive');
  await seedTasks(page,[
   {title:'とても長い案件名でスマートフォンの表示を確認するタスク'.repeat(3),days:0},
   {title:'別の検査資料を確認する',days:2,priority:'高'},
   {title:'進行中の案件を確認する',days:3,status:'対応中'}
  ]);
  const queue=root.locator('.origin-next-task-queue');
  await expect(queue).toBeVisible();
  const cards=queue.locator('.origin-next-task-card');
  await expect(cards).toHaveCount(3);
  for(const card of await cards.all()){
   const action=card.locator('.origin-next-task-title');
   const rect=await action.boundingBox();
   expect(rect.height).toBeGreaterThanOrEqual(44);
   expect(rect.width).toBeGreaterThanOrEqual(44);
   await action.focus();
   expect(await action.evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
 });
}
