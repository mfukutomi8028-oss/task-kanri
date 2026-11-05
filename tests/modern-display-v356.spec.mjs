import { test, expect } from '@playwright/test';

const ROOM='modern-origin-v373-browser';
async function boot(page,width=1366){
  await page.setViewportSize({width,height:900});
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.origin==='http://127.0.0.1:4173'?route.continue():route.abort('blockedbyclient');
  });
  await page.addInitScript(room=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskUser','OriginModernTester');
    localStorage.setItem('systemTaskRoomId',room);
  }, ROOM);
  await page.goto('/?room='+ROOM,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await expect(page.locator('[data-wb-display-choice="modern"]')).toHaveCount(1);
}
async function modern(page){
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','modern');
  const root=page.locator('#modernOriginRoot');
  await expect(page.locator('html')).toHaveAttribute('data-modern-origin-ready','true');
  await expect(root).toBeVisible();
  await expect(root.locator('#workspace')).toBeVisible();
  await expect(page.locator('.app-shell')).toHaveCSS('display','none');
  return root;
}
test('Origin is a separate live Modern workspace with safe Classic return',async ({page})=>{
  test.setTimeout(90000);
  await boot(page);
  const root=await modern(page);
  await expect(root.locator('#originDisplaySelect')).toBeVisible();
  await expect(root.locator('#workspace')).toBeVisible();
  await root.locator('#desktopNav [data-route="tasks"]').click();
  await expect(root.locator('#workspace')).toContainText('タスク');
  await root.locator('#desktopNav [data-route="todos"]').click();
  await expect(root.locator('#workspace')).toContainText('ToDo');
  await root.locator('#originDisplaySelect').selectOption('classic');
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','classic');
  await expect(root).toBeHidden();
  await expect(page.locator('.app-shell')).toBeVisible();
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  await expect(root).toBeVisible();
  await expect(page.locator('.app-shell')).toBeHidden();
  // Direct startup with a persisted Modern preference must show origin only.
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','modern');
  await expect(page.locator('html')).toHaveAttribute('data-modern-origin-ready','true');
  await expect(page.locator('#modernOriginRoot')).toBeVisible();
  await expect(page.locator('.app-shell')).toBeHidden();
});
for(const width of [390,768,980,1366]){
  test('Origin navigation is usable without page overflow at '+width+'px',async ({page})=>{
    test.setTimeout(90000);
    await boot(page,width);
    const root=await modern(page);
    const nav=root.locator(width<=770?'#mobileNav':'#desktopNav');
    await expect(nav.locator('[data-route="tasks"]')).toBeVisible();
    await nav.locator('[data-route="tasks"]').click();
    await expect(root.locator('#workspace')).toContainText('タスク');
    await nav.locator('[data-route="calendar"]').click();
    await expect(root.locator('#workspace')).toContainText('予定');
    const metrics=await page.evaluate(()=>({document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
    expect(metrics.document).toBeLessThanOrEqual(width+3);
    expect(metrics.body).toBeLessThanOrEqual(width+3);
  });
}
test('Origin dark mode does not replace Classic theme ownership',async ({page})=>{
  await boot(page);
  const root=await modern(page);
  const previous=await root.getAttribute('data-theme');
  await root.locator('#themeBtn').click();
  await expect(root).not.toHaveAttribute('data-theme',previous);
  await root.locator('#originDisplaySelect').selectOption('classic');
  await expect(page.locator('#todayView')).toBeVisible();
});