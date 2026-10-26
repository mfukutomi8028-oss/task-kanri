import { test, expect } from '@playwright/test';

// Isolated local room. No production Firebase reads or writes.
async function boot(page, room) {
  await page.addInitScript(roomName => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser','福冨');
    localStorage.setItem('systemTaskRoomId',roomName);
    localStorage.setItem('system-task-users:'+roomName,JSON.stringify(['福冨']));
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  },room);
  await page.route('https://www.gstatic.com/firebasejs/**',r=>r.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,r=>r.abort('blockedbyclient'));
  await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await expect(page.locator('link[data-workboard-style="ui-signal-light-v535.css"]')).toHaveAttribute('data-loaded','true');
}
for(const width of [1920,1366,390,320]){
  test('Ver.535 SIGNAL Light displays readable Today without page overflow at '+width,async ({page})=>{
    await page.setViewportSize({width,height:width>1000?1080:844});
    await boot(page,'v535-light-'+width);
    await expect(page.locator('#todayView')).toBeVisible();
    await expect(page.locator('#todayView > .signal-focus-v535')).toHaveCount(1);
    await expect(page.locator('#todayView .today-grid [data-today-panel-id]')).toHaveCount(5);
    const report=await page.evaluate(()=>{
      const root=document.documentElement;
      const el=document.querySelector('.sidebar');
      return {
        classPresent:root.classList.contains('wb-signal-light-v535'),
        primary:getComputedStyle(root).getPropertyValue('--signal-primary').trim(),
        overflow:root.scrollWidth-root.clientWidth,
        sidebars:document.querySelectorAll('.sidebar').length,
        bg:getComputedStyle(el).backgroundImage
      };
    });
    expect(report.classPresent).toBe(true);
    expect(report.primary).toBe('#5365cd');
    expect(report.overflow).toBeLessThanOrEqual(2);
    expect(report.sidebars).toBe(1);
    expect(report.bg).toContain('linear-gradient');
  });
}
test('Ver.535 priority is a display-only companion to saved Today panel order',async ({page})=>{
  await page.setViewportSize({width:1366,height:768});
  await boot(page,'v535-order');
  const panels=page.locator('#todayView .today-grid [data-today-panel-id]');
  await expect(panels).toHaveCount(5);
  await expect(panels.first()).toHaveAttribute('data-today-panel-id','schedule');
  await page.locator('#todayView [data-today-panel-id="schedule"] .today-panel-shift-v531').nth(1).click();
  await expect(panels.first()).toHaveAttribute('data-today-panel-id','overdue');
  await expect(page.locator('#todayView > .signal-focus-v535')).toHaveCount(1);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await expect(panels.first()).toHaveAttribute('data-today-panel-id','overdue');
  await expect(page.locator('#todayView > .signal-focus-v535')).toHaveCount(1);
});
test('Ver.535 keeps normal Today-to-ToDo navigation usable on a phone',async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await boot(page,'v535-phone-todo');
  await page.locator('#todayView [data-layout-jump="todos"]').first().click();
  await expect(page.locator('#todoView')).toBeVisible();
  const color=await page.locator('.hero').evaluate(el=>getComputedStyle(el).color);
  expect(color).toBe('rgb(35, 49, 77)');
});
