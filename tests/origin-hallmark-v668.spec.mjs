import {test,expect} from '@playwright/test';

// Test only synthetic offline data; never connect to the production database.
async function launch(page,width){
 const room='origin-hallmark-v668-'+width;
 await page.setViewportSize({width,height:width<=390?844:900});
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.continue():route.abort('blockedbyclient'));
 await page.addInitScript(id=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskRoomId',id);
  localStorage.setItem('systemTaskUser','OriginHallmarkQA');
 },room);
 await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await expect(root).toBeVisible();
 return root;
}
for(const width of [320,390,1366,1920]){
 test('Origin clear headings and task controls at '+width+'px',async({page})=>{
  test.setTimeout(90000);
  const root=await launch(page,width);
  const nav=root.locator(width<=390?'#mobileNav':'#desktopNav');
  for(const route of ['today','tasks','todos','calendar','notes','tools']){
   await nav.locator('[data-route="'+route+'"]').click();
   const heading=root.locator('#workspace .page-heading');
   await expect(heading.locator('h1')).toBeVisible();
   await expect(heading.locator('.eyebrow')).toHaveCount(0);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),route).toBeLessThanOrEqual(3);
   if(['tasks','calendar','notes'].includes(route)){
    const primary=heading.locator('.origin-page-primary');
    await expect(primary).toBeVisible();
    expect((await primary.boundingBox()).height).toBeGreaterThanOrEqual(44);
   }
  }
  await nav.locator('[data-route="tasks"]').click();
  await expect(root.locator('#originTaskQuery')).toBeVisible();
  if(width<=390){
   const toggle=root.locator('[data-action="task-advanced-toggle"]');
   if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
  }
  await expect(root.locator('#originTaskSort')).toBeVisible();
  const order=await root.locator('.origin-task-command').evaluate(el=>{
   const q=el.querySelector('#originTaskQuery'),v=el.querySelector('.origin-layout-controls'),s=el.querySelector('#originTaskSort');
   return Boolean(q.compareDocumentPosition(v)&Node.DOCUMENT_POSITION_FOLLOWING)&&Boolean(v.compareDocumentPosition(s)&Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
 });
}
test('Origin progress uses transform and reduced motion does not animate it',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 const root=await launch(page,1366);
 await root.locator('#desktopNav [data-route="todos"]').click();
 const progress=root.locator('.progress-fill');
 await expect(progress).toHaveCount(1);
 expect(await progress.evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
 expect(await progress.evaluate(el=>getComputedStyle(el).width)).not.toBe('0px');
});
