import {test,expect} from '@playwright/test';

// Synthetic data only. Block all non-local HTTP requests and Firebase connections.
async function openOrigin(page,width,reduceMotion='no-preference'){
  await page.setViewportSize({width,height:width<768?820:900});
  await page.emulateMedia({reducedMotion:reduceMotion});
  await page.route('**/*',route=>
    new URL(route.request().url()).origin==='http://127.0.0.1:4173'
      ?route.continue():route.abort('blockedbyclient'));
  const room='origin-motion-audit-'+width+'-'+reduceMotion;
  await page.addInitScript(roomName=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskRoomId',roomName);
    localStorage.setItem('systemTaskUser','OriginMotionAudit');
  },room);
  await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  const host=page.locator('#modernOriginRoot');
  await expect(host).toBeVisible();
  await host.locator((width<768?'#mobileNav':'#desktopNav')+' [data-route="calendar"]').click();
  return host;
}

async function seedToday(page){
  return page.evaluate(async()=>{
    const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
    const start=new Date();start.setHours(10,0,0,0);
    const result=await bridge.dispatch({
      type:'schedule.create',revision:0,ownerRoom:s.roomId,ownerUser:s.currentUser,
      values:{title:'操作フィードバック確認',startAt:start.toISOString(),
        endAt:new Date(start.getTime()+3600000).toISOString(),
        assignee:s.users?.[0]||s.currentUser,category:s.categories[0],
        relatedTaskId:'',location:'研修室',memo:''}
    });
    if(!result?.ok)throw Error('fixture schedule.create: '+JSON.stringify(result));
    return result.id;
  });
}

const appearance=loc=>loc.evaluate(el=>{
  const cs=getComputedStyle(el);
  return {bg:cs.backgroundColor,shadow:cs.boxShadow,transform:cs.transform,
    border:cs.borderColor,duration:cs.transitionDuration,outline:cs.outlineStyle};
});

test('Origin desktop calendar offers visible hover and press feedback across controls',async({page})=>{
  test.setTimeout(90000);
  const host=await openOrigin(page,1366);
  const id=await seedToday(page);
  const rail=host.locator('.origin-week-focus-entry[data-id="'+id+'"]');
  await expect(rail).toBeVisible();
  const before=await appearance(rail);
  await rail.hover();
  await page.waitForTimeout(240);
  const hovered=await appearance(rail);
  expect([hovered.bg,hovered.shadow,hovered.transform,hovered.border]).not.toEqual(
    [before.bg,before.shadow,before.transform,before.border]);
  expect(hovered.duration).not.toBe('0s');
  const inactiveView=host.locator('.origin-schedule-view [data-action="calendar-view"][data-value="agenda"]');
  const viewBefore=await appearance(inactiveView);
  await inactiveView.hover();
  await page.waitForTimeout(240);
  const viewHover=await appearance(inactiveView);
  expect([viewHover.bg,viewHover.shadow,viewHover.transform]).not.toEqual(
    [viewBefore.bg,viewBefore.shadow,viewBefore.transform]);
  await page.mouse.down();
  await page.waitForTimeout(120);
  const pressed=await appearance(inactiveView);
  expect(pressed.transform).not.toBe('none');
  await page.mouse.up();
  await expect(inactiveView).toHaveAttribute('aria-pressed','true');
  const toolbarAction=host.locator('.origin-schedule-toolbar .secondary-button').first();
  await toolbarAction.hover();
  await page.waitForTimeout(240);
  const lifted=await appearance(toolbarAction);
  await page.mouse.down();
  await page.waitForTimeout(120);
  const depressed=await appearance(toolbarAction);
  expect(depressed.transform).not.toEqual(lifted.transform);
  await page.mouse.up();
  const select=host.locator('#originScheduleAssignee');
  const selectBefore=await appearance(select);
  await select.focus();
  const selectFocus=await appearance(select);
  expect([selectFocus.border,selectFocus.shadow,selectFocus.outline]).not.toEqual(
    [selectBefore.border,selectBefore.shadow,selectBefore.outline]);
});

test('Origin honors reduced motion for repeated controls while keeping selected state',async({page})=>{
  const host=await openOrigin(page,1366,'reduce');
  const date=await host.locator('.origin-weekday-focus[aria-pressed="false"]').first().getAttribute('data-date');
  const day=host.locator('.origin-weekday-focus[data-date="'+date+'"]');
  await expect(day).toBeVisible();
  const before=await appearance(day);
  const durations=before.duration.split(',').map(x=>parseFloat(x));
  expect(durations.every(x=>x===0)).toBe(true);
  await day.click();
  await expect(day).toHaveAttribute('aria-pressed','true');
  const active=host.locator('.origin-schedule-view button.active');
  await expect(active).toHaveAttribute('aria-pressed','true');
});

for(const width of [320,390]){
  test('Origin touch-sized calendar controls remain readable without horizontal overflow at '+width+'px',async({page})=>{
    const host=await openOrigin(page,width);
    const primary=host.locator('[data-action="schedule-filter-toggle"]');
    const day=host.locator('.origin-week-jump [data-action="schedule-week-focus"]').first();
    const size=await day.evaluate(el=>({rect:el.getBoundingClientRect().toJSON()}));
    expect(size.rect.height).toBeGreaterThanOrEqual(44);
    expect((await primary.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
    await primary.click();
    const search=host.locator('#originScheduleSearch');
    await expect(search).toBeVisible();
    await search.focus();
    const focused=await appearance(search);
    expect(focused.outline).not.toBe('none');
  });
}
