import {test,expect} from '@playwright/test';

async function launch(page,baseURL,width){
 const url=new URL(baseURL);
 const room='origin-hm-tasks-'+width;
 await page.setViewportSize({width,height:width<=390?760:900});
 await page.route('**/*',route=>new URL(route.request().url()).origin===url.origin?route.continue():route.abort('blockedbyclient'));
 await page.addInitScript(id=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskRoomId',id);
  localStorage.setItem('systemTaskUser','OriginHallmarkQA');
  localStorage.setItem('system-task-users:'+id,JSON.stringify(['OriginHallmarkQA','OriginHallmarkPeer']));
 },room);
 await page.clock.setFixedTime(new Date('2026-11-24T08:00:00+09:00'));
 await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await expect(root).toBeVisible();
 const seeded=await page.evaluate(async()=>{
  const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
  const result=await bridge.dispatch({
   type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,title:'端末点検',
   description:'表示検証用の合成データ',assignee:s.currentUser,status:s.statuses[0],category:s.categories[0],
   requester:'',tags:'',checklist:'',checklistDone:[],priority:'中',dueDate:'2026-11-25',dueTime:'',pinned:false
  });
  return result;
 });
 expect(seeded,JSON.stringify(seeded)).toMatchObject({ok:true});
 await root.locator((width<=770?'#mobileNav':'#desktopNav')+' [data-route="tasks"]').click();
 return root;
}

for(const width of [320,390]){
 test('Origin '+width+'px fits task views and filter disclosure on one touch row',async({page,baseURL},testInfo)=>{
  const root=await launch(page,baseURL,width);
  const board=root.getByRole('button',{name:'ボード',exact:true});
  const toggle=root.locator('[data-action="task-advanced-toggle"]');
  const query=root.getByRole('searchbox',{name:'タスクを検索'});
  const jump=root.getByRole('button',{name:'表示中のタスクの先頭へ移動'});
  await board.click();
  const task=root.getByRole('button',{name:'端末点検の詳細を開く',exact:true});
  await expect(task).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(root.locator('#originTaskSort')).toBeHidden();
  await page.evaluate(()=>window.scrollTo(0,0));
  const screenshot=process.env.ORIGIN_HALLMARK_EVIDENCE;
  if(screenshot)await page.screenshot({path:screenshot+'/'+width+'-board.png',animations:'disabled'});
  const b=await board.boundingBox(),f=await toggle.boundingBox(),card=await task.boundingBox();
  const q=await query.boundingBox(),j=await jump.boundingBox();
  await testInfo.attach('closed layout', {body:JSON.stringify({width,viewY:b.y,filtersY:f.y,cardTitleY:card.y,searchWidth:q.width}),contentType:'application/json'});
  if(screenshot)console.log(JSON.stringify({width,viewY:b.y,filtersY:f.y,cardTitleY:card.y,searchWidth:q.width}));
  expect.soft(Math.abs(b.y-f.y),'layout choices and details share one row').toBeLessThanOrEqual(3);
  const bottomNav=await root.locator('#mobileNav').boundingBox();
  expect.soft(card.y+card.height,'the first work item title is fully above the bottom navigation').toBeLessThanOrEqual(bottomNav.y);
  const lanes=await root.getByRole('navigation',{name:'ボードの状態列へ移動'}).getByRole('button').evaluateAll(
   buttons=>buttons.map(button=>{const r=button.getBoundingClientRect();return {y:r.y,height:r.height};}));
  expect.soft(new Set(lanes.map(lane=>lane.y)).size,'the four default status shortcuts fit one row').toBe(1);
  expect(lanes).toHaveLength(4);
  for(const lane of lanes)expect(lane.height).toBeGreaterThanOrEqual(44);
  for(const rect of [b,f,q,j])expect(rect.height).toBeGreaterThanOrEqual(44);
  expect(f.x).toBeGreaterThanOrEqual(b.x+b.width);
  expect(f.x+f.width).toBeLessThanOrEqual(width);

  await root.getByRole('button',{name:'自分の担当',exact:true}).click();
  await expect(task).toBeVisible();
  await expect(toggle.locator('.origin-advanced-count')).toContainText('1');
  expect.soft(Math.abs((await board.boundingBox()).y-(await toggle.boundingBox()).y),'applying a filter does not add a toolbar row').toBeLessThanOrEqual(3);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  const sort=root.locator('#originTaskSort');
  await expect(sort).toBeVisible();
  await expect(root.locator('#originTaskStatusRail .status-marker').first()).toBeVisible();
  // The disclosure is read/focused just before the sort and status controls.
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Tab');
  await expect.soft(sort).toBeFocused();
  await sort.selectOption('priority');
  await expect(task).toBeVisible();
  await toggle.click();
  await expect(sort).toBeHidden();
  await expect(query).toHaveValue('');
  await expect(board).toHaveAttribute('aria-pressed','true');
  await expect(jump).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 });
}

test('Origin desktop keeps search and view controls in their existing row',async({page,baseURL})=>{
 const root=await launch(page,baseURL,1366);
 const search=root.getByRole('searchbox',{name:'タスクを検索'});
 const toolArea=root.locator('.origin-task-tools');
 const views=root.locator('.origin-layout-controls');
 const sort=root.locator('#originTaskSort');
 await expect(search).toBeVisible();
 await expect(sort).toBeVisible();
 await expect(root.locator('[data-action="task-density"]')).toBeVisible();
 await expect(root.locator('[data-action="task-advanced-toggle"]')).toBeHidden();
 const searchBox=await toolArea.boundingBox(),viewBox=await views.boundingBox();
 expect(Math.abs(searchBox.y-viewBox.y)).toBeLessThanOrEqual(3);
 expect(viewBox.x).toBeGreaterThan(searchBox.x);
 expect((await sort.boundingBox()).y).toBeGreaterThan(viewBox.y);
});
