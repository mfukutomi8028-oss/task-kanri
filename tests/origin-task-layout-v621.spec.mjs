import {test,expect} from '@playwright/test';

// Exercise Origin's real presentation and canonical bridge in a self-contained room.
async function launch(page,width,slug){
 await page.setViewportSize({width,height:width<800?844:900});
 await page.route('**/*',route=>
  new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 const room='origin-board-timeline-v621-'+slug+'-'+width;
 await page.addInitScript(id=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskRoomId',id);
  localStorage.setItem('systemTaskUser','LayoutQA');
 },room);
 await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await expect(root).toBeVisible();
 await root.locator((width<768?'#mobileNav':'#desktopNav')+' [data-route="tasks"]').click();
 return root;
}

async function addTasks(page,records){
 return page.evaluate(async items=>{
  const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
  const dateOffset=offset=>{
   if(offset===null)return '';
   const day=new Date();day.setDate(day.getDate()+offset);
   return [day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),
    String(day.getDate()).padStart(2,'0')].join('-');
  };
  const result=[];
  for(const item of items){
   const created=await bridge.dispatch({
    type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,
    title:item.title,description:'確認用の説明 '+item.title,
    status:item.status||'未着手',priority:item.priority||'中',
    assignee:s.users?.[0]||s.currentUser,category:s.categories[0],
    requester:'',tags:'',dueDate:dateOffset(item.days),dueTime:'14:00',
    checklist:'設計確認\\n動作確認',checklistDone:[true,false],pinned:false
   });
   if(!created?.ok)throw Error(JSON.stringify(created));
   result.push(created.id);
  }
  return result;
 },records);
}
async function taskRevisionSnapshot(page){
 return page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks.map(t=>({
  id:t.id,revision:t.revision,status:t.status,dueDate:t.dueDate,completed:t.completed
 })).sort((a,b)=>a.id.localeCompare(b.id)));
}

for(const width of [320,390,1366]){
 test('Origin '+width+'px board shows ordered status columns and card facts without overflow',async({page})=>{
  test.setTimeout(90000);
  const root=await launch(page,width,'board-facts');
  const ids=await addTasks(page,[
   {title:'最終確認の手配',days:-2,status:'確認待ち',priority:'高'},
   {title:'保守点検の開始',days:4,status:'未着手'},
   {title:'設定変更の作業',days:0,status:'対応中'}
  ]);
  const initial=await taskRevisionSnapshot(page);
  await root.locator('[data-action="task-layout"][data-value="board"]').click();
  const board=root.locator('.origin-task-layout-board');
  await expect(board).toBeVisible();
  const groupNames=await board.locator(':scope > .origin-task-group .group-title strong').allTextContents();
  const statusOrder=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().statuses);
  expect(groupNames).toEqual(statusOrder.filter(name=>groupNames.includes(name)));
  const row=board.locator('.item-row',{hasText:'最終確認の手配'});
  await expect(row.locator('.origin-board-facts')).toContainText('担当');
  await expect(row.locator('.origin-board-facts')).toContainText('期限');
  await expect(row.locator('.origin-board-due.urgent')).toBeVisible();
  await expect(row.locator('.origin-task-progress-pill')).toContainText('残り1件');
  await expect(row.locator('[data-action="list-quick-edit"]')).toBeVisible();
  await expect(row.locator('[data-action="task-inline-status"]')).toBeVisible();
  const dimensions=await board.evaluate(el=>({
   documentOverflow:document.documentElement.scrollWidth-window.innerWidth,
   boardOverflow:el.scrollWidth-el.clientWidth,
   display:getComputedStyle(el).display
  }));
  expect(dimensions.documentOverflow).toBeLessThanOrEqual(3);
  if(width<768){
   expect(dimensions.boardOverflow).toBeLessThanOrEqual(3);
   expect(dimensions.display).toBe('grid');
  }
  expect(await taskRevisionSnapshot(page)).toEqual(initial);
  if(width===1366){
   const select=board.locator('[data-action="task-inline-status"][data-id="'+ids[0]+'"]');
   await select.selectOption('対応中');
   await expect.poll(()=>page.evaluate(id=>
    window.WorkBoardPaletteBridge.readSnapshot().tasks.find(t=>t.id===id)?.status,ids[0])
   ).toBe('対応中');
   await expect(board.locator('.item-row',{hasText:'最終確認の手配'}).locator('.origin-board-facts')).toBeVisible();
  }
 });
}

for(const width of [320,390,1366]){
 test('Origin '+width+'px timeline groups by actual due date, chronologically even in priority sort',async({page})=>{
  test.setTimeout(90000);
  const root=await launch(page,width,'timeline-dates');
  await addTasks(page,[
   {title:'将来の確認',days:5,priority:'緊急'},
   {title:'期限切れの対応',days:-2,priority:'低'},
   {title:'今日の対応',days:0,priority:'中'},
   {title:'期限なしの棚卸し',days:null,priority:'高'}
  ]);
  const initial=await taskRevisionSnapshot(page);
  await root.locator('[data-action="task-layout"][data-value="timeline"]').click();
  if(width<768)await root.locator('[data-action="task-advanced-toggle"]').click();
  await root.locator('#originTaskSort').selectOption('priority');
  const timeline=root.locator('.origin-task-layout-timeline');
  await expect(timeline).toBeVisible();
  const groups=timeline.locator(':scope > .origin-task-group');
  await expect(groups).toHaveCount(4);
  const dates=await groups.evaluateAll(elements=>elements.map(el=>el.getAttribute('data-origin-date')));
  const snapshot=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks.map(t=>t.dueDate));
  expect(dates).toEqual(snapshot.filter(Boolean).sort().concat(''));
  await expect(groups.first().locator('.origin-task-group-toggle')).toContainText('期限');
  await expect(groups.last().locator('.origin-task-group-toggle')).toContainText('期限未設定');
  await expect(timeline.locator('.origin-task-progress-pill')).toHaveCount(4);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
  await timeline.locator('.item-row',{hasText:'今日の対応'}).locator('.item-name').click();
  await expect(root.locator('#sheet')).toContainText('今日の対応');
  await root.locator('#sheet .sheet-close').click();
  expect(await taskRevisionSnapshot(page)).toEqual(initial);
 });
}
