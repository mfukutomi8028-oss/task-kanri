import {test,expect} from '@playwright/test';

// Real Origin Shadow DOM on an isolated, offline test room.
async function launchOrigin(page,width){
  const room='origin-mobile-clarity-v588-'+width;
  await page.setViewportSize({width,height:width===320?760:844});
  await page.route('**/*',route=>
    new URL(route.request().url()).origin==='http://127.0.0.1:4173'
      ?route.continue():route.abort('blockedbyclient'));
  await page.addInitScript(roomName=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskRoomId',roomName);
    localStorage.setItem('systemTaskUser','OriginMobileAudit');
  },room);
  await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  const host=page.locator('#modernOriginRoot');
  await expect(host).toBeVisible();
  return host;
}

for(const width of [320,390]){
  test('Origin mobile six main destinations remain on one tappable bottom row at '+width+'px',async({page})=>{
    test.setTimeout(90000);
    const host=await launchOrigin(page,width);
    const nav=host.locator('#mobileNav');
    const buttons=nav.locator('button[data-route]');
    await expect(buttons).toHaveCount(6);
    const geometry=await buttons.evaluateAll(els=>els.map(el=>{
      const r=el.getBoundingClientRect();
      return {x:r.x,y:r.y,width:r.width,height:r.height,font:parseFloat(getComputedStyle(el).fontSize)};
    }));
    expect(Math.max(...geometry.map(x=>x.y))-Math.min(...geometry.map(x=>x.y))).toBeLessThan(2);
    expect(geometry.every(x=>x.width>=44&&x.height>=44&&x.font>=11)).toBe(true);
    const adjacentGaps=geometry.slice(1).map((item,i)=>item.x-(geometry[i].x+geometry[i].width));
    expect(Math.min(...adjacentGaps)).toBeGreaterThanOrEqual(7);
    const navHeight=await nav.evaluate(el=>el.getBoundingClientRect().height);
    expect(navHeight).toBeLessThan(90);
    await nav.locator('[data-route="tools"]').click();
    await expect(nav.locator('[data-route="tools"]')).toHaveAttribute('aria-current','page');
    await nav.locator('[data-route="today"]').click();
    await expect(nav.locator('[data-route="today"]')).toHaveAttribute('aria-current','page');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
  });

  test('Origin primary mobile search fields use readable input size without viewport zoom at '+width+'px',async({page})=>{
    test.setTimeout(90000);
    const host=await launchOrigin(page,width);
    const fontSize=async locator=>locator.evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
    expect(await fontSize(host.locator('#originSearchInput'))).toBeGreaterThanOrEqual(16);

    await host.locator('#mobileNav [data-route="tasks"]').click();
    expect(await fontSize(host.locator('#originTaskQuery'))).toBeGreaterThanOrEqual(16);

    await host.locator('#mobileNav [data-route="todos"]').click();
    expect(await fontSize(host.locator('[data-form="quick-todo"] [name="title"]'))).toBeGreaterThanOrEqual(16);

    await host.locator('#mobileNav [data-route="notes"]').click();
    expect(await fontSize(host.locator('#originMemoQuery'))).toBeGreaterThanOrEqual(16);

    await host.locator('#mobileNav [data-route="calendar"]').click();
    await host.locator('[data-action="schedule-filter-toggle"]').click();
    await expect(host.locator('#originScheduleSearch')).toBeVisible();
    expect(await fontSize(host.locator('#originScheduleSearch'))).toBeGreaterThanOrEqual(16);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
  });
}

test('Origin desktop keeps its six destinations visible without showing mobile navigation',async({page})=>{
  test.setTimeout(90000);
  const host=await launchOrigin(page,1366);
  await expect(host.locator('#desktopNav [data-route]')).toHaveCount(6);
  await expect(host.locator('#mobileNav')).toBeHidden();
  await host.locator('#desktopNav [data-route="notes"]').click();
  await expect(host.locator('#workspace')).toContainText('業務メモ');
});
