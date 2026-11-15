import {test, expect} from '@playwright/test';

// Origin's real Shadow DOM with a synthetic, offline room. Never contact Firebase.
async function launch(page,width){
  const room='origin-command-hierarchy-'+width;
  await page.setViewportSize({width,height:width<=390?844:900});
  await page.route('**/*',route=>
    new URL(route.request().url()).origin==='http://127.0.0.1:4173'
      ?route.continue():route.abort('blockedbyclient'));
  await page.addInitScript(id=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskRoomId',id);
    localStorage.setItem('systemTaskUser','OriginCommandHierarchy');
  },room);
  await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  const root=page.locator('#modernOriginRoot');
  await expect(root).toBeVisible();
  return root;
}
const noOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);

for(const width of [320,390]){
  test('Origin '+width+'px offers a visible return to today after choosing another day',async({page})=>{
    test.setTimeout(90000);
    const root=await launch(page,width);
    const today=await root.locator('.day-chip.active').getAttribute('data-date');
    const other=root.locator('.day-chip:not(.active)').first();
    await other.click();
    await expect(root.locator('.day-chip.active')).not.toHaveAttribute('data-date',today);
    const reset=root.locator('.page-heading .heading-meta [data-action="pick-today"]');
    await expect(reset).toBeVisible();
    expect((await reset.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await reset.click();
    await expect(root.locator('.day-chip.active')).toHaveAttribute('data-date',today);
    expect(await noOverflow(page)).toBeLessThanOrEqual(3);
  });

  test('Origin '+width+'px keeps task, ToDo and memo counts in visible page headings',async({page})=>{
    test.setTimeout(90000);
    const root=await launch(page,width);
    const nav=root.locator('#mobileNav');
    for(const [route,pattern] of [['tasks',/登録\s*\d+件/],['todos',/未完了\s*\d+件/],['notes',/保存\s*\d+件/]]){
      await nav.locator('[data-route="'+route+'"]').click();
      const badge=root.locator('.page-heading .heading-meta');
      await expect(badge,route+' heading metadata').toBeVisible();
      expect(await badge.innerText()).toMatch(pattern);
      expect(await noOverflow(page)).toBeLessThanOrEqual(3);
    }
  });

  test('Origin '+width+'px retains immediate task search and expandable advanced controls',async({page})=>{
    test.setTimeout(90000);
    const root=await launch(page,width);
    await root.locator('#mobileNav [data-route="tasks"]').click();
    await expect(root.locator('#originTaskQuery')).toBeVisible();
    const filters=root.locator('[data-action="task-advanced-toggle"]');
    await filters.click();
    await expect(filters).toHaveAttribute('aria-expanded','true');
    await expect(root.locator('#originTaskSort')).toBeVisible();
    await expect(root.locator('#originTaskStatusRail .status-marker').first()).toBeVisible();
    expect(await noOverflow(page)).toBeLessThanOrEqual(3);
  });
}

for(const width of [1280,1366]){
  test('Origin '+width+'px puts task search and view selection together with search first in reading order',async({page})=>{
    test.setTimeout(90000);
    const root=await launch(page,width);
    await root.locator('#desktopNav [data-route="tasks"]').click();
    const search=root.locator('#originTaskQuery');
    const view=root.locator('.origin-layout-controls [data-action="task-layout"]').first();
    await expect(search).toBeVisible();
    await expect(view).toBeVisible();
    const layout=await root.locator('.origin-task-tools,.origin-layout-controls').evaluateAll(
      els=>els.map(el=>({top:el.getBoundingClientRect().top})));
    expect(Math.abs(layout[0].top-layout[1].top)).toBeLessThanOrEqual(12);
    expect(await search.evaluate((el,button)=>{
      const v=el.getRootNode().querySelector('.origin-layout-controls [data-action="task-layout"]');
      return Boolean(el.compareDocumentPosition(v)&Node.DOCUMENT_POSITION_FOLLOWING);
    })).toBe(true);
    expect(await noOverflow(page)).toBeLessThanOrEqual(3);
  });

  test('Origin '+width+'px uses compact task status filters without losing selection',async({page})=>{
    const root=await launch(page,width);
    await root.locator('#desktopNav [data-route="tasks"]').click();
    const markers=root.locator('#originTaskStatusRail .status-marker');
    await expect(markers).toHaveCount(5);
    const heights=await markers.evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));
    expect(Math.max(...heights)).toBeLessThanOrEqual(54);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
    await markers.first().click();
    await expect(markers.first()).toHaveAttribute('aria-pressed','true');
    expect(await noOverflow(page)).toBeLessThanOrEqual(3);
  });
}
