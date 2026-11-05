import { test, expect } from '@playwright/test';

// The former Palette presentation is kept only as a fallback if NEXT fails to load.
// The visible Palette choice now activates Palette NEXT.
const room='test-palette-selector-next';
async function open(page,width=1366) {
  await page.setViewportSize({width,height:850});
  await page.route('**/*',route=>{
    const origin=new URL(route.request().url()).origin;
    return origin==='http://127.0.0.1:4173'?route.continue():route.abort('blockedbyclient');
  });
  await page.addInitScript(({room})=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskUser','PaletteTester');
    localStorage.setItem('systemTaskRoomId',room);
  },{room});
  await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.locator('[data-wb-display-choice="palette"]').evaluate(el=>el.click());
  await expect(page.locator('#paletteNextRoot .wb-pn')).toBeVisible({timeout:15000});
}

test('Palette selector activates NEXT with four designs and no preview link',async({page})=>{
  await open(page);
  await expect(page.locator('#wbDisplayChoiceV356 [data-wb-display-choice]')).toHaveCount(4);
  await expect(page.locator('#wbPaletteNextPreviewV369')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','palette');
  await expect(page.locator('.app-shell')).toBeHidden();
  await expect(page.locator('.pn-hero')).toBeVisible();
  await page.locator('#pnMode').selectOption('classic');
  await expect(page.locator('.app-shell')).toBeVisible();
});

test('Palette NEXT uses its own mobile navigation and editor',async({page})=>{
  await open(page,390);
  await expect(page.locator('#wbPaletteMobileDockV358')).toBeHidden();
  await expect(page.locator('.pn-mobile-nav')).toBeVisible();
  await page.locator('.pn-mobile-nav [data-pn-route="tasks"]').click();
  await expect(page.locator('.pn-flowtabs')).toBeVisible();
  await page.locator('[data-pn-edit="task"]').first().click();
  await expect(page.locator('#pnDetail [data-pn-form="task-editor"]')).toBeVisible();
  await page.locator('#pnDetail [data-pn-close]').click();
  await page.locator('.pn-mobile-nav [data-pn-route="memos"]').click();
  await expect(page.locator('.pn-memogrid')).toBeVisible();
});

test('Palette NEXT retains user mode and is readable with dark theme',async({page})=>{
  await open(page);
  await page.locator('[data-pn-theme]').click();
  await expect(page.locator('#pnApp')).toHaveAttribute('data-theme','dark');
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#paletteNextRoot .wb-pn')).toBeVisible({timeout:15000});
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','palette');
});
