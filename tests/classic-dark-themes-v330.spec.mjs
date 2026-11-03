import { test, expect } from '@playwright/test';

const ROOM='test-classic-dark-theme-v330';
const DARK=['night-navy','night-charcoal','night-forest','night-plum','night-mocha'];
async function boot(page,width){
  await page.setViewportSize({width,height:900});
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.origin==='http://127.0.0.1:4173' ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(({room})=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null;},set(){}});
    if(sessionStorage.getItem('v330-dark-fixture')!=='1'){
      localStorage.clear();
      localStorage.setItem('systemTaskUser','DarkQA');
      localStorage.setItem('systemTaskRoomId',room);
      sessionStorage.setItem('v330-dark-fixture','1');
    }
  },{room:ROOM});
  await page.goto('/?room='+ROOM,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await expect(page.locator('#wbColorThemeButton')).toHaveCount(1);
}
async function choose(page,id){
  await page.locator('#wbColorThemeButton').evaluate(el=>el.click());
  await expect(page.locator('#wbColorThemeDialog')).toBeVisible();
  await page.locator('#wbColorThemeDialog [data-theme="'+id+'"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-wb-color-theme',id);
  await page.locator('.wb-color-theme-close').click();
}
for(const width of [1366,390]){
  test('dark palette color and persistence work on '+width+'px',async({page})=>{
    await boot(page,width);
    await page.locator('#wbColorThemeButton').evaluate(el=>el.click());
    await expect(page.locator('#wbColorThemeDialog .wb-color-theme-group')).toHaveCount(2);
    await expect(page.locator('#wbColorThemeDialog .wb-color-theme-option')).toHaveCount(13);
    await page.locator('.wb-color-theme-close').click();
    for(const id of DARK){
      await choose(page,id);
      await expect(page.locator('html')).toHaveAttribute('data-wb-color-mode','dark');
      const colors=await page.evaluate(()=>{
        const html=document.documentElement,card=document.querySelector('.summary-card');
        const b=getComputedStyle(document.body),a=getComputedStyle(card),meta=document.querySelector('meta[name="theme-color"]');
        const accent=getComputedStyle(html).getPropertyValue('--wb-theme-accent').trim();
        return {body:b.backgroundColor,card:a.backgroundColor,ink:a.color,accent,meta:meta?.content,scroll:document.documentElement.scrollWidth>innerWidth+2};
      });
      expect(colors.body).not.toBe('rgb(238, 247, 251)');
      expect(colors.card).not.toBe('rgb(255, 255, 255)');
      expect(colors.ink).not.toBe('rgb(16, 34, 54)');
      expect(colors.scroll).toBeFalsy();
    }
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
    await expect(page.locator('html')).toHaveAttribute('data-wb-color-theme',DARK.at(-1));
    await choose(page,'default');
    await expect(page.locator('html')).toHaveAttribute('data-wb-color-mode','light');
    await expect(page.locator('.summary-card')).toHaveCSS('background-color','rgba(255, 255, 255, 0.92)');
  });
}
