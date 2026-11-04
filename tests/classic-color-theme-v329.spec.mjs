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

test('Ver.345: all six pastels keep the hero/sidebar bright and the pin text legible',async({page})=>{
  test.setTimeout(120000);
  await boot(page,1440);
  await page.evaluate(()=>localStorage.setItem('work-board-desktop-sidebar-pinned-v158','1'));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await expect(page.locator('body')).toHaveClass(/desktop-sidebar-pinned/);
  const palettes=['pastel-blue','pastel-lilac','pastel-mint','pastel-rose','pastel-peach','pastel-lemon'];
  const read=()=>page.evaluate(()=>{
    const node=selector=>document.querySelector(selector);
    const style=selector=>getComputedStyle(node(selector));
    const parseColor=input=>{
      const s=String(input||'');
      const open=s.indexOf('('), close=s.indexOf(')',open+1);
      if(open<0 || close<open)throw new Error('Unknown computed color '+s);
      const values=s.slice(open+1,close).replaceAll(',', ' ').replaceAll('/', ' ')
        .split(' ').filter(Boolean);
      if(s.startsWith('rgb(')||s.startsWith('rgba('))return values.slice(0,3).map(Number);
      if(s.startsWith('color(srgb '))return values.slice(1,4).map(v=>Number(v)*255);
      throw new Error('Unknown computed color '+s);
    };
    const lightness=(value)=>{
      const v=parseColor(value).map(n=>{
        const x=n/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
      });
      return .2126*v[0]+.7152*v[1]+.0722*v[2];
    };
    const contrast=(a,b)=>{const x=lightness(a),y=lightness(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
    const button=style('.desktop-sidebar-pin-v158');
    const label=style('.desktop-sidebar-pin-label-v158');
    const hero=style('.hero');
    const room=style('.hero-room-badge');
    const sidebar=style('.sidebar');
    const themeInk=style('.sidebar .brand h1').color;
    const backdrop=button.backgroundColor;
    return {
      theme:document.documentElement.dataset.wbColorTheme,
      hero:hero.backgroundImage,
      sidebar:sidebar.backgroundImage,
      shadow:sidebar.boxShadow,
      roomShadow:room.boxShadow,
      roomColor:room.backgroundColor,
      pinColor:button.color,
      labelColor:label.color,
      themeInk,
      labelOpacity:label.opacity,
      pinBackground:backdrop,
      pinContrast:contrast(button.color,backdrop),
      pinTextContrast:contrast(label.color,backdrop)
    };
  });
  for(const palette of palettes){
    await page.locator('#wbColorThemeButton').evaluate(el=>el.click());
    const dlg=page.locator('#wbColorThemeDialog');
    await expect(dlg).toBeVisible();
    await dlg.locator('[data-theme="'+palette+'"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-wb-color-theme',palette);
    const sample=await read();
    expect(sample.hero,palette+' gradient').toContain('linear-gradient');
    expect(sample.sidebar,palette+' sidebar gradient').toContain('linear-gradient');
    expect(sample.hero,palette+' white origin').toContain('rgb(255, 255, 255)');
    expect(sample.sidebar,palette+' white origin').toContain('rgb(255, 255, 255)');
    expect(sample.labelColor,palette+' pin label color').toBe(sample.themeInk);
    expect(sample.pinColor,palette+' pin button color').toBe(sample.themeInk);
    expect(sample.pinTextContrast,palette+' WCAG AA normal text').toBeGreaterThanOrEqual(4.5);
    expect(sample.pinContrast,palette+' WCAG AA button').toBeGreaterThanOrEqual(4.5);
    expect(Number(sample.labelOpacity),palette+' faded pin label').toBe(1);
    expect(sample.roomShadow,palette+' legacy black room badge shadow').not.toContain('rgba(7, 31, 45');
    expect(sample.roomShadow,palette+' legacy black room badge shadow').not.toContain('rgba(0, 0, 0');
    expect(sample.shadow,palette+' legacy navy sidebar shadow').not.toContain('rgba(8, 48, 75');
    if(palette==='pastel-rose'){
      await dlg.locator('.wb-color-theme-close').click();
      await expect(page.locator('.hero')).toBeVisible();
      await page.screenshot({animations:'disabled'});
    }else{
      await dlg.locator('.wb-color-theme-close').click();
    }
  }
});
