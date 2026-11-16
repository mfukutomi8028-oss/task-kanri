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
    checklist:record.checklist??'検証手順',checklistDone:record.checklistDone||[],dueDate:dateOffset(record.days),
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
   {title:'とても長い案件名でスマートフォンの表示を確認するタスク'.repeat(2),days:0},
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


test('Origin task queue and list expose the first unfinished check and honest progress without editing data',async({page})=>{
 test.setTimeout(90000);
 const root=await launch(page,1366,'next-check');
 const ids=await seedTasks(page,[
  {title:'院内端末の点検を進める',days:0,priority:'高',
   checklist:'済：現状を確認\n次：設定差分を確認\n後：所管部署へ回答',checklistDone:[true,false,false]},
  {title:'確認作業が完了した案件',days:1,
   checklist:'端末を確認\n利用者へ連絡',checklistDone:[true,true]},
  {title:'手順が未登録の案件',days:2,checklist:''}
 ]);
 const before=await page.evaluate(()=>
  JSON.stringify(window.WorkBoardPaletteBridge.readSnapshot().tasks));
 const first=root.locator('.origin-next-task-card[data-id="'+ids[0]+'"]');
 await expect(first.locator('.origin-next-task-checks')).toBeVisible();
 await expect(first.locator('.origin-next-task-step')).toContainText('次：設定差分を確認');
 await expect(first.locator('.origin-next-task-step')).not.toContainText('済：現状を確認');
 await expect(first.locator('.origin-next-task-progress')).toContainText('1 / 3 完了');
 await expect(first.locator('progress.origin-next-task-meter')).toHaveAttribute('value','1');
 await expect(first.locator('progress.origin-next-task-meter')).toHaveAttribute('max','3');
 const second=root.locator('.origin-next-task-card[data-id="'+ids[1]+'"]');
 await expect(second.locator('.origin-next-task-step')).toContainText('すべて完了');
 await expect(second.locator('progress.origin-next-task-meter')).toHaveAttribute('value','2');
 const third=root.locator('.origin-next-task-card[data-id="'+ids[2]+'"]');
 await expect(third.locator('.origin-next-task-checks')).toHaveCount(0);
 const rows=root.locator('.origin-task-collection .item-row');
 await expect(rows.nth(0).locator('.origin-task-progress-pill')).toContainText('残り2件');
 await expect(rows.nth(1).locator('.origin-task-progress-pill')).toContainText('2 / 2 完了');
 await expect(rows.nth(2).locator('.origin-task-progress-pill')).toHaveCount(0);
 await root.locator('.origin-density-button').click();
 await expect(root.locator('.origin-task-collection')).not.toHaveClass(/origin-tasks-compact/);
 await expect(root.locator('.origin-task-collection .item-row').nth(0)
   .locator('.origin-task-insight-next')).toContainText('次：設定差分を確認');
 await expect(root.locator('.origin-task-collection .item-row').nth(1)
   .locator('.origin-task-insight-next')).toContainText('すべて完了');
 expect(await page.evaluate(()=>
  JSON.stringify(window.WorkBoardPaletteBridge.readSnapshot().tasks))).toBe(before);
});

for(const width of [320,390]){
 test('Origin unfinished checklist preview remains readable without horizontal overflow at '+width+'px',async({page})=>{
  test.setTimeout(90000);
  const root=await launch(page,width,'next-check-mobile');
  await seedTasks(page,[{
   title:'少し長いタイトルのタスクを確認し作業手順を整理する'.repeat(2),
   days:0,priority:'高',
   checklist:'完了した作業\n未完了：設定と現在の仕様を詳しく突き合わせる'.repeat(3),
   checklistDone:[true,false,false,false]
  }]);
  const card=root.locator('.origin-next-task-card').first();
  await expect(card.locator('.origin-next-task-step')).toBeVisible();
  await expect(card.locator('.origin-next-task-meter')).toBeVisible();
  const visible=await card.evaluate(el=>{
   const outer=el.getBoundingClientRect(),preview=el.querySelector('.origin-next-task-step').getBoundingClientRect();
   return {inCard:preview.top>=outer.top-1&&preview.bottom<=outer.bottom+1,width:outer.width};
  });
  expect(visible.inCard).toBe(true);
  expect(visible.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(3);
 });
}
