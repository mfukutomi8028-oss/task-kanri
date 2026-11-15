import {test, expect} from '@playwright/test';

// Offline, synthetic-room checks. Do not read or write any real board records.
async function launch(page,width,slug){
 const room='origin-schedule-focus-v603-'+slug+'-'+width;
 await page.setViewportSize({width,height:width<=390?844:900});
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 await page.addInitScript(id=>{
   Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
   localStorage.setItem('systemTaskRoomId',id);
   localStorage.setItem('systemTaskUser','福冨');
 },room);
 await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await expect(root).toBeVisible();
 return root;
}
async function seed(page,entries){
 return page.evaluate(async entries=>{
   const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
   const dates={};
   for(const {title,offset,hour} of entries){
     const start=new Date();start.setHours(hour,0,0,0);start.setDate(start.getDate()+offset);
     const end=new Date(start.getTime()+30*60000);
     const created=await bridge.dispatch({type:'schedule.create',revision:0,
       ownerRoom:s.roomId,ownerUser:s.currentUser,
       values:{title,startAt:start.toISOString(),endAt:end.toISOString(),
         assignee:s.currentUser,category:s.categories[0],relatedTaskId:'',location:'確認室',memo:''}});
     if(!created?.ok)throw Error('Fixture schedule failed: '+title+' / '+created?.error);
     dates[offset]=[start.getFullYear(),String(start.getMonth()+1).padStart(2,'0'),String(start.getDate()).padStart(2,'0')].join('-');
   }
   return dates;
 },entries);
}
const noOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);

for(const width of [320,390]){
 test('Origin '+width+'px gives selected day count, next appointment and direct detail',async({page})=>{
   test.setTimeout(90000);
   const root=await launch(page,width,'preview');
   // Pick a neighboring date inside this week, including on Sundays.
   const neighborOffset=await page.evaluate(()=>new Date().getDay()===0?-1:1);
   const dates=await seed(page,[
     {title:'選択日の午後確認',offset:0,hour:14},
     {title:'選択日の朝の確認',offset:0,hour:9},
     {title:'隣の日の連絡',offset:neighborOffset,hour:10}
   ]);
   await root.locator('#mobileNav [data-route="calendar"]').click();
   const focus=root.locator('.origin-schedule-day-overview');
   await expect(focus).toBeVisible();
   await expect(focus).toHaveAttribute('data-date',dates[0]);
   await expect(focus.locator('.origin-schedule-day-count')).toContainText('2件');
   const next=focus.locator('[data-action="open"][data-kind="events"]');
   await expect(next).toContainText('選択日の朝の確認');
   await next.click();
   await expect(root.locator('#sheet')).toContainText('選択日の朝の確認');
   await root.locator('#sheet .sheet-close').click();
   const revisions=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().schedules
     .filter(e=>['選択日の午後確認','選択日の朝の確認','隣の日の連絡'].includes(e.title))
     .map(e=>[e.id,e.revision]));
   expect(revisions).toHaveLength(3);
   await root.locator('.origin-week-jump [data-action="schedule-week-focus"][data-date="'+dates[neighborOffset]+'"]').click();
   await expect(focus).toHaveAttribute('data-date',dates[neighborOffset]);
   await expect(focus.locator('.origin-schedule-day-count')).toContainText('1件');
   await expect(focus).toContainText('隣の日の連絡');
   await focus.locator('[data-action="calendar-day"]').click();
   await expect(root.locator('.origin-day-focus')).toContainText('隣の日の連絡');
   await expect(root.locator('#originDateJump')).toHaveValue(dates[neighborOffset]);
   expect(await noOverflow(page)).toBeLessThanOrEqual(3);
 });

 test('Origin '+width+'px distinguishes filtered zero matches from no registrations',async({page})=>{
   test.setTimeout(90000);
   const root=await launch(page,width,'filter');
   await seed(page,[{title:'登録済みの面談',offset:0,hour:9},{title:'登録済みの会議',offset:0,hour:11}]);
   await root.locator('#mobileNav [data-route="calendar"]').click();
   const focus=root.locator('.origin-schedule-day-overview');
   await expect(focus.locator('.origin-schedule-day-count')).toContainText('2件');
   const toggle=root.locator('[data-action="schedule-filter-toggle"]');
   await toggle.click();
   await root.locator('#originScheduleSearch').fill('一致しない検索語xyz');
   await expect(focus.locator('.origin-schedule-day-count')).toContainText('一致0件');
   await expect(focus.locator('.origin-schedule-day-count')).toContainText('登録2件');
   await expect(focus.locator('.origin-schedule-day-empty')).toContainText('条件に一致する予定はありません');
   await focus.locator('[data-action="schedule-filter-reset"]').click();
   await expect(focus.locator('.origin-schedule-day-count')).toContainText('2件');
   await expect(focus).toContainText('登録済みの面談');
   expect(await noOverflow(page)).toBeLessThanOrEqual(3);
 });

 test('Origin '+width+'px adds a schedule to a selected empty day without changing data first',async({page})=>{
   test.setTimeout(90000);
   const root=await launch(page,width,'empty');
   await root.locator('#mobileNav [data-route="calendar"]').click();
   const focus=root.locator('.origin-schedule-day-overview');
   const chosen=await root.locator('#originDateJump').inputValue();
   await expect(focus.locator('.origin-schedule-day-count')).toContainText('0件');
   await expect(focus.locator('.origin-schedule-day-empty')).toContainText('予定はありません');
   await focus.locator('[data-action="new"][data-kind="events"]').click();
   const editor=root.locator('#editForm[data-kind="events"]');
   await expect(editor).toBeVisible();
   expect((await editor.locator('[name="startAt"]').inputValue()).slice(0,10)).toBe(chosen);
   expect(await noOverflow(page)).toBeLessThanOrEqual(3);
 });
}

for(const width of [1280,1366]){
 test('Origin '+width+'px shows weekly total but keeps the existing desktop day inspector',async({page})=>{
   test.setTimeout(90000);
   const root=await launch(page,width,'desktop');
   await seed(page,[{title:'週間の予定状況',offset:0,hour:9}]);
   await root.locator('#desktopNav [data-route="calendar"]').click();
   await expect(root.locator('.page-heading .heading-meta')).toContainText('今週 1件');
   await expect(root.locator('.origin-week-focus')).toBeVisible();
   await expect(root.locator('.origin-schedule-day-overview')).toHaveCount(0);
   await expect(root.locator('.origin-schedule-view [data-value="week"]')).toHaveAttribute('aria-pressed','true');
   expect(await noOverflow(page)).toBeLessThanOrEqual(3);
 });
}

for(const width of [320,390]){
 test('Origin '+width+'px keyboard reading order follows date, view and search controls',async({page})=>{
   const root=await launch(page,width,'order');
   await root.locator('#mobileNav [data-route="calendar"]').click();
   const order=await root.locator('.origin-calendar-controls > #originDateJump, .origin-calendar-controls > .origin-schedule-view, .origin-calendar-controls > .origin-schedule-filter-toggle')
     .evaluateAll(elements=>elements.map(el=>el.id==='originDateJump'?'date':el.classList.contains('origin-schedule-view')?'view':'filter'));
   expect(order).toEqual(['date','view','filter']);
   expect(await noOverflow(page)).toBeLessThanOrEqual(3);
 });
}
