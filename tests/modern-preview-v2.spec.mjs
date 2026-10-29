import { test, expect } from '@playwright/test';

const PALETTES = ['ink','ocean','forest','plum','mist','sage','apricot','lilac','night','slate','charcoal','dusk'];
const VIEWS = ['today','todos','tasks','schedule','memo'];

for (const viewport of [{width:1366,height:768},{width:390,height:844}]) {
  test(`independent Modern v2 preview is usable at ${viewport.width}px and retains draft on theme change`, async ({page}) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    const outgoing=[]; const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await page.route('**/*', route=>{
      const url=new URL(route.request().url());
      if(url.origin!=='http://127.0.0.1:4173'){ outgoing.push(url.href); return route.abort('blockedbyclient'); }
      return route.continue();
    });
    await page.goto('/modern/preview/index.html',{waitUntil:'domcontentloaded'});
    await expect(page.locator('html')).toHaveAttribute('data-palette','ink');
    await expect(page.locator('#main')).toContainText('優先');
    for(const view of VIEWS){
      const nav = viewport.width<=860 ? '#mobileNav' : '#railNav';
      await page.locator(`${nav} [data-page="${view}"]`).click();
      await expect(page.locator('body')).toHaveAttribute('data-view',view);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
      expect(overflow,`${view} at ${viewport.width}`).toBeLessThanOrEqual(1);
    }
    // No full page/data rerender when a palette changes.
    const nav=viewport.width<=860 ? '#mobileNav':'#railNav';
    await page.locator(`${nav} [data-page="today"]`).click();
    // Actually type a draft; changing twelve palettes must not re-render it away.
    const draft = page.locator('#main [data-form="quick-todo"] input[name="title"]');
    await draft.fill('配色を変えても未保存の入力を保持する');
    await page.locator('[data-action="settings"]').last().click();
    await expect(page.locator('#settings')).toBeVisible();
    for(const theme of PALETTES){
      await page.locator(`[data-palette-choice="${theme}"]`).click();
      await expect(page.locator('html')).toHaveAttribute('data-palette',theme);
    }
    await page.locator('#settings .modal-foot [data-close="settings"]').click();
    await expect(draft).toHaveValue('配色を変えても未保存の入力を保持する');
    expect(errors).toEqual([]);
    expect(outgoing).toEqual([]);
  });
}
