import {test,expect} from '@playwright/test';

// Synthetic, offline-only room: never access or mutate the production room.
async function launchOrigin(page,room,width){
  await page.setViewportSize({width,height:width<=390?780:900});
  await page.route('**/*',route=>
    new URL(route.request().url()).origin==='http://127.0.0.1:4173'
      ?route.continue():route.abort('blockedbyclient'));
  await page.addInitScript(roomName=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskUser','OriginAudit');
    localStorage.setItem('systemTaskRoomId',roomName);
  },room);
  await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  const host=page.locator('#modernOriginRoot');
  await expect(host).toBeVisible();
  return host;
}
async function createEvent(page,title,daysFromToday){
  return page.evaluate(async({title,daysFromToday})=>{
    const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
    const assignee=s.users?.[0]||s.currentUser;
    // A chosen user can be stored locally without belonging to the room's
    // canonical assignee list; schedule creation requires an actual member.
    const start=new Date();
    start.setDate(start.getDate()+daysFromToday);
    start.setHours(10,0,0,0);
    const end=new Date(start.getTime()+3600000);
    const result=await bridge.dispatch({
      type:'schedule.create',revision:0,ownerRoom:s.roomId,ownerUser:s.currentUser,
      values:{title,startAt:start.toISOString(),endAt:end.toISOString(),
        assignee,category:s.categories[0],
        relatedTaskId:'',location:'',memo:''}
    });
    if(!result?.ok)throw Error('schedule.create: '+result?.error);
    return result.id;
  },{title,daysFromToday});
}
for(const width of [320,1366]){
  test('Origin cross-week schedule search jump reaches its actual match ('+width+'px)',async({page})=>{
    test.setTimeout(90000);
    const host=await launchOrigin(page,'origin-global-jump-v586-'+width,width);
    const targetId=await createEvent(page,'全期間検索ジャンプ対象',21);
    await host.locator((width<=390?'#mobileNav':'#desktopNav')+' [data-route="calendar"]').click();
    if(width<=390)await host.locator('[data-action="schedule-filter-toggle"]').click();
    await host.locator('[data-action="schedule-search-scope"][data-value="all"]').click();
    await host.locator('#originScheduleSearch').fill('全期間検索ジャンプ対象');
    const match=host.locator('.origin-schedule-global-results [data-action="open"][data-kind="events"][data-id="'+targetId+'"]');
    await expect(match).toBeVisible();
    const jump=host.locator('[data-action="jump-result"][data-kind="events"]');
    await expect(jump).toBeEnabled();
    await expect(jump).toHaveAttribute('aria-label','全期間の検索結果の先頭へ移動');
    await jump.click();
    await expect(match).toBeFocused();
    await expect(host.locator('.origin-schedule-global-results .origin-schedule-global-head')).toContainText('1件一致');
  });
}
test('Origin global schedule jump skips an unrelated event in the current week',async({page})=>{
  test.setTimeout(90000);
  const host=await launchOrigin(page,'origin-global-jump-unrelated-week-v586',390);
  await createEvent(page,'週内の無関係な予定',0);
  const id=await createEvent(page,'本当に見つけたい全期間の予定',28);
  await host.locator('#mobileNav [data-route="calendar"]').click();
  await host.locator('[data-action="schedule-filter-toggle"]').click();
  await host.locator('[data-action="schedule-search-scope"][data-value="all"]').click();
  await host.locator('#originScheduleSearch').fill('本当に見つけたい');
  const match=host.locator('.origin-schedule-global-results [data-action="open"][data-id="'+id+'"]');
  await expect(match).toBeVisible();
  await host.locator('[data-action="jump-result"][data-kind="events"]').click();
  await expect(match).toBeFocused();
  await expect(host.locator('.mobile-agenda .agenda-entry')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
});
