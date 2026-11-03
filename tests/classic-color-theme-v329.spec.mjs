import { test, expect } from '@playwright/test';

const ROOM = 'test-classic-theme-v329';
async function boot(page, width) {
  await page.setViewportSize({width,height:900});
  await page.route('**/*', route => {
    const url=new URL(route.request().url());
    return url.origin==='http://127.0.0.1:4173' ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(({room}) => {
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null;},set(){}});
    if (!sessionStorage.getItem('color-theme-fixture')) {
      localStorage.clear();
      localStorage.setItem('systemTaskUser','ThemeTester');
      localStorage.setItem('systemTaskRoomId',room);
      sessionStorage.setItem('color-theme-fixture','1');
    }
  },{room:ROOM});
  await page.goto('/?room='+ROOM,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await expect(page.locator('#wbColorThemeButton')).toHaveCount(1);
}
for(const width of [1366,390]){
  test('Classic palette switches and survives reload at '+width+'px', async ({page}) => {
    await boot(page,width);
    const original=await page.locator('.hero').evaluate(el=>getComputedStyle(el).backgroundImage);
    await page.locator('#wbColorThemeButton').evaluate(el=>el.click());
    const dialog=page.locator('#wbColorThemeDialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-theme="lavender"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-wb-color-theme','lavender');
    const changed=await page.locator('.hero').evaluate(el=>getComputedStyle(el).backgroundImage);
    expect(changed).not.toBe(original);
    await dialog.locator('.wb-color-theme-close').click();
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
    await expect(page.locator('html')).toHaveAttribute('data-wb-color-theme','lavender');
    await page.locator('#wbColorThemeButton').evaluate(el=>el.click());
    await page.locator('#wbColorThemeDialog [data-theme="default"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-wb-color-theme','default');
    const restored=await page.locator('.hero').evaluate(el=>getComputedStyle(el).backgroundImage);
    expect(restored).toBe(original);
    await expect(page.locator('.nav-item[data-layout="today"]')).toHaveCount(1);
  });
}
