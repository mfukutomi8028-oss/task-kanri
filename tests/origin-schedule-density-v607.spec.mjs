import {test,expect} from '@playwright/test';

// Test synthetic appointments in isolated offline rooms only.
async function startOrigin(page,width,slug){
 await page.setViewportSize({width,height:width<500?844:900});
 await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'
   ?r.continue():r.abort('blockedbyclient'));
 const room='origin-schedule-density-v607-'+width+'-'+slug;
 await page.addInitScript(room=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskRoomId',room);
  localStorage.setItem('systemTaskUser','福冨');
 },room);
 await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(e=>e.click());
 const root=page.locator('#modernOriginRoot');
 await expect(root).toBeVisible();
 return root;
}
async function seedTwoDays(page,slug){
 return page.evaluate(async slug=>{
  const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
  const neighborOffset=new Date().getDay()===0?-1:1;
  const dates=[];
  for(const [offset,title] of [[0,'今日の予定'+slug],[neighborOffset,'別日の予定'+slug]]){
   const start=new Date();start.setHours(9,0,0,0);start.setDate(start.getDate()+offset);
   const end=new Date(start.getTime()+45*60000);
   const result=await bridge.dispatch({type:'schedule.create',revision:0,
     ownerRoom:s.roomId,ownerUser:s.currentUser,
     values:{title,startAt:start.toISOString(),endAt:end.toISOString(),
       assignee:s.currentUser,category:s.categories[0],relatedTaskId:'',
       location:'確認室',memo:''}});
   if(!result?.ok)throw Error('Synthetic schedule create failed '+result?.error);
   const date=[start.getFullYear(),String(start.getMonth()+1).padStart(2,'0'),String(start.getDate()).padStart(2,'0')].join('-');
   dates.push({date,title});
  }
  return {today:dates[0],neighbor:dates[1]};
 },slug);
}
async function noHorizontalOverflow(page){
 return page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
}

for(const width of [320,390]){
 test('Origin '+width+' mobile week shows seven compact day summaries and details only for selected day',async({page})=>{
  test.setTimeout(90000);
  const root=await startOrigin(page,width,'week');
  const {today,neighbor}=await seedTwoDays(page,'週');
  await root.locator('#mobileNav [data-route="calendar"]').click();
  const week=root.locator('.mobile-agenda');
  await expect(week).toHaveAttribute('data-density','compact');
  await expect(week.locator('.agenda-day')).toHaveCount(7);
  const todayRow=week.locator('.agenda-day[data-date="'+today.date+'"]');
  const nextRow=week.locator('.agenda-day[data-date="'+neighbor.date+'"]');
  await expect(todayRow.locator('.agenda-entry')).toHaveCount(1);
  await expect(nextRow.locator('.agenda-entry')).toHaveCount(0);
  await expect(nextRow.locator('.origin-agenda-day-preview')).toContainText(neighbor.title);
  await expect(root.locator('.origin-schedule-day-overview')).toHaveAttribute('data-date',today.date);
  const emptyDay=week.locator('.agenda-day.origin-agenda-empty').first();
  await expect(emptyDay).toBeVisible();
  const height=await emptyDay.evaluate(e=>e.getBoundingClientRect().height);
  expect(height).toBeLessThan(86);
  await nextRow.locator('[data-action="schedule-week-focus"]').click();
  await expect(root.locator('.origin-schedule-day-overview')).toHaveAttribute('data-date',neighbor.date);
  await expect(week.locator('.agenda-day[data-date="'+neighbor.date+'"] .agenda-entry')).toContainText(neighbor.title);
  const selectedChip=root.locator('.origin-week-jump [data-date="'+neighbor.date+'"]');
  await expect(selectedChip).toHaveAttribute('aria-pressed','true');
  expect(await noHorizontalOverflow(page)).toBeLessThanOrEqual(3);
 });

 test('Origin '+width+' expands every day on demand and retains all week links',async({page})=>{
  test.setTimeout(90000);
  const root=await startOrigin(page,width,'expanded');
  const {today,neighbor}=await seedTwoDays(page,'展開');
  await root.locator('#mobileNav [data-route="calendar"]').click();
  const toggle=root.locator('[data-action="schedule-week-density"]');
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  const week=root.locator('.mobile-agenda');
  await expect(week).toHaveAttribute('data-density','all');
  await expect(week.locator('.agenda-day[data-date="'+today.date+'"] .agenda-entry')).toHaveCount(1);
  const neighborEvent=week.locator('.agenda-day[data-date="'+neighbor.date+'"] .agenda-entry');
  await expect(neighborEvent).toContainText(neighbor.title);
  await neighborEvent.click();
  await expect(root.locator('#sheet')).toContainText(neighbor.title);
  await root.locator('#sheet .sheet-close').click();
  await expect(neighborEvent).toBeFocused();
  await toggle.click();
  await expect(week).toHaveAttribute('data-density','compact');
  await expect(week.locator('.agenda-day[data-date="'+neighbor.date+'"] .origin-agenda-day-preview')).toContainText(neighbor.title);
  expect(await noHorizontalOverflow(page)).toBeLessThanOrEqual(3);
 });
}

test('Origin 390 mobile shows the active query when advanced filters are collapsed',async({page})=>{
 test.setTimeout(90000);
 const root=await startOrigin(page,390,'filters');
 await seedTwoDays(page,'検索');
 await root.locator('#mobileNav [data-route="calendar"]').click();
 const toggle=root.locator('[data-action="schedule-filter-toggle"]');
 await toggle.click();
 await root.locator('#originScheduleSearch').fill('検索に一致しない文字列');
 await toggle.click();
 await expect(root.locator('#originScheduleSearch')).toBeHidden();
 const criteria=root.locator('.origin-schedule-active-criteria');
 await expect(criteria).toBeVisible();
 await expect(criteria).toContainText('検索に一致しない文字列');
 await expect(criteria).toContainText('0件');
 await root.locator('[data-action="schedule-filter-reset"]').click();
 await expect(criteria).toHaveCount(0);
 await expect(root.locator('.origin-schedule-day-overview .origin-schedule-day-count')).toContainText('1件');
 expect(await noHorizontalOverflow(page)).toBeLessThanOrEqual(3);
});

test('Origin desktop retains the seven-column week without redundant compact controls',async({page})=>{
 test.setTimeout(90000);
 const root=await startOrigin(page,1280,'desktop');
 await seedTwoDays(page,'PC');
 await root.locator('#desktopNav [data-route="calendar"]').click();
 await expect(root.locator('.origin-week-board .weekday-col')).toHaveCount(7);
 await expect(root.locator('.origin-week-focus')).toBeVisible();
 await expect(root.locator('[data-action="schedule-week-density"]')).toHaveCount(0);
 await expect(root.locator('.mobile-agenda')).toHaveCount(0);
 expect(await noHorizontalOverflow(page)).toBeLessThanOrEqual(3);
});
