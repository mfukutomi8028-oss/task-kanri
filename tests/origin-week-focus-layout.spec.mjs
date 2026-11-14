import {test,expect} from '@playwright/test';

// All fixtures stay in an offline, synthetic room; no production room access.
async function launchOrigin(page,width){
  await page.setViewportSize({width,height:width===390?820:900});
  await page.route('**/*',route=>
    new URL(route.request().url()).origin==='http://127.0.0.1:4173'
      ?route.continue():route.abort('blockedbyclient'));
  const room='origin-week-focus-layout-'+width;
  await page.addInitScript(roomName=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskRoomId',roomName);
    localStorage.setItem('systemTaskUser','OriginWeekAudit');
  },room);
  await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  const host=page.locator('#modernOriginRoot');
  await expect(host).toBeVisible();
  await host.locator((width<=390?'#mobileNav':'#desktopNav')+' [data-route="calendar"]').click();
  return host;
}

async function seedWeek(page){
  return page.evaluate(async()=>{
    const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
    const monday=new Date();monday.setHours(0,0,0,0);
    monday.setDate(monday.getDate()-(monday.getDay()+6)%7);
    const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
    const create=async (offset,hour,title)=>{
      const start=new Date(monday);start.setDate(start.getDate()+offset);start.setHours(hour,0,0,0);
      const result=await bridge.dispatch({
        type:'schedule.create',revision:0,ownerRoom:s.roomId,ownerUser:s.currentUser,
        values:{title,startAt:start.toISOString(),endAt:new Date(start.getTime()+3600000).toISOString(),
          assignee:s.users?.[0]||s.currentUser,category:s.categories[0],
          relatedTaskId:'',location:'会議室A',memo:''}
      });
      if(!result?.ok)throw Error('test schedule.create: '+JSON.stringify(result));
      return result.id;
    };
    const ids=[];
    for(let i=0;i<4;i++)ids.push(await create(1,9+i,'週間フォーカス確認 '+(i+1)));
    await create(3,14,'別の日の予定');
    const tuesday=new Date(monday);tuesday.setDate(tuesday.getDate()+1);
    return {date:dateKey(tuesday),ids};
  });
}

for(const width of [960,1366]){
  test('Origin weekly planner offers a readable week grid and selected-day details at '+width+'px',async({page},testInfo)=>{
    test.setTimeout(90000);
    const host=await launchOrigin(page,width);
    const {date,ids}=await seedWeek(page);
    const layout=host.locator('.origin-week-layout');
    await expect(layout).toBeVisible();
    await expect(layout.locator('.weekday-col')).toHaveCount(7);
    const day=layout.locator('.weekday-col[data-date="'+date+'"]');
    await expect(day.locator('.schedule-event')).toHaveCount(2);
    await expect(day.locator('.origin-weekday-focus')).toContainText('4件');
    await day.locator('.origin-weekday-focus').click();
    await expect(day.locator('.origin-weekday-focus')).toHaveAttribute('aria-pressed','true');
    await expect(day.locator('.origin-weekday-focus')).toBeFocused();
    const focus=layout.locator('.origin-week-focus');
    await expect(focus).toContainText('4件');
    await expect(focus.locator('.origin-week-focus-entry')).toHaveCount(4);
    await expect(focus.locator('.origin-week-focus-entry').first()).toContainText('週間フォーカス確認 1');
    const positions=await layout.evaluate(el=>{
      const board=el.querySelector('.origin-week-board').getBoundingClientRect();
      const panel=el.querySelector('.origin-week-focus').getBoundingClientRect();
      return {boardRight:board.right,boardBottom:board.bottom,panelLeft:panel.left,panelTop:panel.top,overflow:document.documentElement.scrollWidth-innerWidth};
    });
    expect(positions.overflow).toBeLessThanOrEqual(3);
    if(width>=1101)expect(positions.panelLeft).toBeGreaterThanOrEqual(positions.boardRight-2);
    else expect(positions.panelTop).toBeGreaterThanOrEqual(positions.boardBottom-2);
    await testInfo.attach('origin-week-focus-'+width,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
    await focus.locator('.origin-week-focus-entry[data-id="'+ids[0]+'"]').click();
    await expect(host.locator('#sheet')).toContainText('週間フォーカス確認 1');
    const snapshot=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().schedules.map(e=>({id:e.id,revision:e.revision})));
    expect(snapshot.find(e=>e.id===ids[0]).revision).toBe(1);
  });
}

test('Origin mobile retains its existing 7-day jump without desktop detail rail',async({page})=>{
  const host=await launchOrigin(page,390);
  await expect(host.locator('.origin-week-layout')).toHaveCount(0);
  await expect(host.locator('.origin-week-jump [data-action="schedule-week-focus"]')).toHaveCount(7);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
});
