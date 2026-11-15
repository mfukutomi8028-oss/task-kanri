import {test, expect} from '@playwright/test';

// Synthetic offline rooms: all record writes use the canonical local bridge.
async function launch(page,width,label){
 await page.setViewportSize({width,height:width<=390?844:900});
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 const room='origin-schedule-return-v605-'+width+'-'+label;
 await page.addInitScript(roomName=>{
   Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
   localStorage.setItem('systemTaskUser','福冨');
   localStorage.setItem('systemTaskRoomId',roomName);
 },room);
 await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await expect(root).toBeVisible();
 return root;
}
async function seed(page,title){
 return page.evaluate(async title=>{
   const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
   const start=new Date();start.setHours(9,0,0,0);
   const end=new Date(start.getTime()+3600000);
   const result=await bridge.dispatch({type:'schedule.create',revision:0,
     ownerRoom:s.roomId,ownerUser:s.currentUser,
     values:{title,startAt:start.toISOString(),endAt:end.toISOString(),
       assignee:s.currentUser,category:s.categories[0],relatedTaskId:'',
       location:'会議室',memo:''}});
   if(!result?.ok)throw Error('Fixture schedule failed '+result?.error);
   const event=bridge.readSnapshot().schedules.find(e=>e.title===title);
   if(!event)throw Error('Seed event not found');
   const future=new Date(start);future.setDate(future.getDate()+7);
   const futureDate=[future.getFullYear(),String(future.getMonth()+1).padStart(2,'0'),String(future.getDate()).padStart(2,'0')].join('-');
   const originalDate=[start.getFullYear(),String(start.getMonth()+1).padStart(2,'0'),String(start.getDate()).padStart(2,'0')].join('-');
   return {id:event.id,originalDate,futureDate};
 },title);
}

test('Origin desktop week focus restores the exact side-rail appointment after closing detail',async({page})=>{
 test.setTimeout(90000);
 const root=await launch(page,1366,'desktop');
 const {id}=await seed(page,'サイド欄からの詳細確認');
 await root.locator('#desktopNav [data-route="calendar"]').click();
 const source=root.locator('.origin-week-focus-entry[data-id="'+id+'"]');
 await expect(source).toBeVisible();
 await source.click();
 await expect(root.locator('#sheet')).toContainText('サイド欄からの詳細確認');
 await root.locator('#sheet .sheet-close').click();
 await expect(source).toBeFocused();
 expect(await root.locator('.origin-schedule-view [data-value="week"]').getAttribute('aria-pressed')).toBe('true');
});

for(const width of [320,390]){
 test('Origin '+width+'px selected-day overview restores its original scroll and focus after detail close',async({page})=>{
   test.setTimeout(90000);
   const root=await launch(page,width,'overview');
   const {id}=await seed(page,'選択日概要から開いた予定');
   await root.locator('#mobileNav [data-route="calendar"]').click();
   const overview=root.locator('.origin-schedule-day-overview');
   const source=overview.locator('.origin-schedule-day-next[data-id="'+id+'"]');
   await source.scrollIntoViewIfNeeded();
   const originalTop=await source.evaluate(el=>el.getBoundingClientRect().top);
   await source.click();
   await expect(root.locator('#sheet')).toContainText('選択日概要から開いた予定');
   await root.locator('#sheet .sheet-close').click();
   await expect(source).toBeFocused();
   const position=await source.evaluate(el=>{
     const scroller=document.scrollingElement;
     return {top:el.getBoundingClientRect().top,scrollY:window.scrollY,
       maxScroll:Math.max(0,scroller.scrollHeight-window.innerHeight)};
   });
   // Preserve the original coordinate when scroll range allows it; when the
   // page edge clamps scrolling, verify the original control remains visible.
   const desiredScroll=position.scrollY+position.top-originalTop;
   if(desiredScroll>=0&&desiredScroll<=position.maxScroll){
     expect(Math.abs(position.top-originalTop)).toBeLessThanOrEqual(25);
   }else{
     await expect(source).toBeInViewport();
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
 });
}

test('Origin mobile editor changing a schedule week preserves context and offers an explicit destination',async({page})=>{
 test.setTimeout(90000);
 const root=await launch(page,390,'moved');
 const event=await seed(page,'日付変更した予定');
 await root.locator('#mobileNav [data-route="calendar"]').click();
 const source=root.locator('.origin-schedule-day-overview .origin-schedule-day-next[data-id="'+event.id+'"]');
 await source.click();
 await root.locator('#sheet [data-action="edit"]').click();
 const form=root.locator('#editForm[data-kind="events"]');
 await expect(form).toBeVisible();
 await form.locator('[name="startAt"]').fill(event.futureDate+'T10:00');
 await form.locator('[name="endAt"]').fill(event.futureDate+'T11:00');
 await root.locator('button[form="editForm"]').click();
 await expect(form).toHaveCount(0);
 await expect(root.locator('#originDateJump')).toHaveValue(event.originalDate);
 const notice=root.locator('.origin-schedule-move-notice');
 await expect(notice).toBeVisible();
 await expect(notice).toContainText('日付変更した予定');
 const go=notice.locator('[data-action="schedule-move-open"]');
 await expect(go).toBeFocused();
 await go.click();
 await expect(root.locator('#originDateJump')).toHaveValue(event.futureDate);
 await expect(root.locator('.origin-schedule-view [data-value="day"]')).toHaveAttribute('aria-pressed','true');
 await expect(root.locator('.origin-day-entry[data-id="'+event.id+'"]')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
});

test('Origin preserves schedule search conditions after a moved date until the user chooses the destination',async({page})=>{
 test.setTimeout(90000);
 const root=await launch(page,320,'filtered');
 const event=await seed(page,'変更前の予約');
 await root.locator('#mobileNav [data-route="calendar"]').click();
 const toggle=root.locator('[data-action="schedule-filter-toggle"]');
 await toggle.click();
 await root.locator('#originScheduleSearch').fill('変更前');
 await root.locator('.origin-schedule-day-overview .origin-schedule-day-next[data-id="'+event.id+'"]').click();
 await root.locator('#sheet [data-action="edit"]').click();
 const form=root.locator('#editForm[data-kind="events"]');
 await form.locator('[name="title"]').fill('変更後の予約');
 await form.locator('[name="startAt"]').fill(event.futureDate+'T10:00');
 await form.locator('[name="endAt"]').fill(event.futureDate+'T11:00');
 await root.locator('button[form="editForm"]').click();
 await expect(form).toHaveCount(0);
 await expect(root.locator('#originScheduleSearch')).toHaveValue('変更前');
 const go=root.locator('.origin-schedule-move-notice [data-action="schedule-move-open"]');
 await expect(go).toBeVisible();
 await expect(go).toContainText('条件を解除');
 await go.click();
 await expect(root.locator('#originDateJump')).toHaveValue(event.futureDate);
 await expect(root.locator('.origin-day-entry')).toContainText('変更後の予約');
 await root.locator('[data-action="calendar-view"][data-value="week"]').click();
 await toggle.click();
 await expect(root.locator('#originScheduleSearch')).toHaveValue('');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
});
