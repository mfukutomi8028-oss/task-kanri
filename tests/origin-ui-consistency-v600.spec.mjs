import {test, expect} from '@playwright/test';

// Exercise the real Origin Shadow DOM, using a synthetic offline room.
async function launch(page,width){
  const room='origin-ui-consistency-20261115-'+width;
  await page.setViewportSize({width,height:width<600?800:900});
  await page.route('**/*',route=>
    new URL(route.request().url()).origin==='http://127.0.0.1:4173'
      ?route.continue():route.abort('blockedbyclient'));
  await page.addInitScript(id=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskRoomId',id);
    localStorage.setItem('systemTaskUser','OriginConsistencyAudit');
  },room);
  await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  const root=page.locator('#modernOriginRoot');
  await expect(root).toBeVisible();
  return root;
}

for(const width of [320,390,1366]){
  test('Origin primary actions have consistent touch-friendly targets across views at '+width+'px',async({page})=>{
    test.setTimeout(90000);
    const root=await launch(page,width);
    const nav=width<768?'#mobileNav':'#desktopNav';
    async function check(selectors){
      for(const selector of selectors){
        const element=root.locator(selector).first();
        await expect(element).toBeVisible();
        const height=await element.evaluate(el=>el.getBoundingClientRect().height);
        expect(height,selector+' height').toBeGreaterThanOrEqual(44);
      }
    }
    await check(['.origin-today-shortcuts button','.text-button','.primary-button']);
    await root.locator(nav+' [data-route="tasks"]').click();
    await check(['.work-toolbar .tab-pills button','.origin-layout-controls .tab-pills button']);
    await root.locator(nav+' [data-route="notes"]').click();
    await check(['.memo-toolbar .tab-pills button','.origin-memo-layout button']);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
  });
}

test('Origin selection and keyboard focus remain perceivable without hover',async({page})=>{
  const root=await launch(page,1366);
  await root.locator('#desktopNav [data-route="tasks"]').click();
  const filter=root.locator('.work-toolbar .tab-pills button[aria-pressed="true"]').first();
  await expect(filter).toBeVisible();
  const selected=await filter.evaluate(el=>({
    bg:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color
  }));
  const unselected=root.locator('.work-toolbar .tab-pills button[aria-pressed="false"]').first();
  const idle=await unselected.evaluate(el=>({
    bg:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color
  }));
  expect(selected).not.toEqual(idle);
  // Enter keyboard modality before testing :focus-visible (not pointer focus).
  await page.keyboard.press('Tab');
  await unselected.focus();
  const focus=await unselected.evaluate(el=>getComputedStyle(el).outlineStyle);
  expect(focus).not.toBe('none');
});

test('Origin disabled controls do not animate or respond as enabled',async({page})=>{
  const root=await launch(page,1366);
  const button=root.locator('.origin-today-shortcuts button').first();
  await button.evaluate(el=>el.disabled=true);
  const before=await button.evaluate(el=>getComputedStyle(el).transform);
  await button.hover();
  await page.waitForTimeout(200);
  expect(await button.evaluate(el=>getComputedStyle(el).transform)).toBe(before);
});
