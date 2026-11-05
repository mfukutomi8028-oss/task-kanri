import { test, expect } from '@playwright/test';

async function boot(page, width=1366) {
  const room='test-palette-next-v368';
  await page.setViewportSize({width,height:Math.max(700,width===320?700:820)});
  await page.route('**/*',route=>{
    const origin=new URL(route.request().url()).origin;
    return origin==='http://127.0.0.1:4173'
      ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(({room})=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskUser','PaletteNextTester');
    localStorage.setItem('systemTaskRoomId',room);
  },{room});
  await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await expect(page.locator('#wbDisplayChoiceV356 [data-wb-display-choice="palette"]')).toHaveCount(1);
}
async function choose(page,mode='palette'){
  await page.locator('[data-wb-display-choice="'+mode+'"]').evaluate(el=>el.click());
  await expect(page.locator('html')).toHaveAttribute('data-wb-display',mode);
}

test('Palette NEXT uses its own root and canonical state adapter, not Classic DOM',async({page})=>{
  await boot(page);
  await choose(page);
  await expect(page.locator('#paletteNextRoot .wb-pn')).toBeVisible();
  await expect(page.locator('.app-shell')).toBeHidden();
  await expect(page.locator('#wbPaletteMobileDockV358')).toHaveCount(0);
  await expect(page.locator('#paletteNextRoot .pn-rail')).toBeVisible();
  await expect(page.locator('#paletteNextRoot .pn-hero')).toBeVisible();
  const info=await page.evaluate(()=>{
    const adapter=window.WorkBoardPaletteBridge;
    const snapshot=adapter.readSnapshot();
    return {keys:Object.keys(snapshot),routes:document.querySelectorAll('#paletteNextRoot [data-pn-route]').length,
      nestedClassic:document.querySelectorAll('#paletteNextRoot .today-grid,#paletteNextRoot .nav-item,#paletteNextRoot .sidebar').length,
      sync:snapshot.connectionMode,room:snapshot.roomId};
  });
  for (const key of ['tasks','todos','schedules','notices','currentUser','focusTaskIds']) {
    expect(info.keys).toContain(key);
  }
  expect(info.nestedClassic).toBe(0);
  expect(info.routes).toBe(10);
  expect(info.sync).toBe('local-only');
  expect(info.room).toBe('test-palette-next-v368');
});

test('Palette NEXT personal ToDo uses canonical create, edit, toggle and persistence',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  await choose(page);
  await page.locator('#paletteNextRoot [data-pn-route="todos"]').last().click();
  await expect(page.locator('#pnTodoInput')).toBeVisible();
  await page.locator('#pnTodoInput').fill('Palette NEXT 実データテスト');
  await page.locator('[data-pn-form="todo"] button[type="submit"]').click();
  const row=page.locator('#paletteNextRoot .pn-todolist li').filter({hasText:'Palette NEXT 実データテスト'}).first();
  await expect(row).toBeVisible();
  await row.locator('[data-pn-cmd="todo.toggle"]').click();
  await expect(page.locator('#paletteNextRoot .pn-todotext.done')).toContainText('Palette NEXT 実データテスト');
  await row.locator('[data-pn-detail="todo"]').click();
  await expect(page.locator('#pnTodoEdit')).toBeVisible();
  await page.locator('#pnTodoEdit [name="memo"]').fill('編集後のメモ');
  await page.locator('#pnTodoEdit [type="submit"]').click();
  await expect.poll(()=>page.evaluate(()=>{
    const item=window.WorkBoardPaletteBridge.readSnapshot().todos.find(t=>t.text==='Palette NEXT 実データテスト');
    return item?.memo;
  })).toBe('編集後のメモ');
  await page.locator('#paletteNextRoot [data-pn-close]').last().click();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','palette');
  const saved=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().todos.find(t=>
    t.text==='Palette NEXT 実データテスト'));
  expect(saved.completed).toBe(true);
  expect(saved.memo).toBe('編集後のメモ');
});

test('Palette NEXT mode switch returns to intact Classic and Modern shells',async({page})=>{
  await boot(page);
  await choose(page);
  await page.locator('#pnMode').selectOption('classic');
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','classic');
  await expect(page.locator('#paletteNextRoot .wb-pn')).toBeHidden();
  await expect(page.locator('.app-shell')).toBeVisible();
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','modern');
  await page.locator('[data-wb-display-choice="palette"]').evaluate(el=>el.click());
  await expect(page.locator('#paletteNextRoot .wb-pn')).toBeVisible();
  await expect(page.locator('#paletteNextRoot .pn-hero')).toBeVisible();
});

for(const width of [1366,390,320]){
  test('Palette NEXT independent mobile/desktop navigation at '+width+'px',async({page})=>{
    await boot(page,width);
    await choose(page);
    const info=await page.evaluate(()=>{
      const rail=document.querySelector('.pn-rail'),mobile=document.querySelector('.pn-mobile-nav');
      return {clientWidth:document.documentElement.clientWidth,
        scrollWidth:document.documentElement.scrollWidth,
        rail:getComputedStyle(rail).display,
        mobile:getComputedStyle(mobile).display};
    });
    expect(info.scrollWidth).toBeLessThanOrEqual(info.clientWidth+2);
    expect(info.mobile==='grid').toBe(width<=780);
    if(width>780) expect(info.rail).not.toBe('none');
    await page.locator('#paletteNextRoot [data-pn-route="tasks"]').last().click();
    await expect(page.locator('#paletteNextRoot .pn-flowtabs')).toBeVisible();
    await page.locator('#paletteNextRoot [data-pn-route="schedule"]').last().click();
    await expect(page.locator('#paletteNextRoot .pn-weekstrip button')).toHaveCount(7);
    await page.locator('#paletteNextRoot [data-pn-route="memos"]').last().click();
    await expect(page.locator('#paletteNextRoot .pn-muted-note')).toContainText('接続作業中');
    await page.locator('#paletteNextRoot [data-pn-theme]').click();
    await expect(page.locator('#pnApp')).toHaveAttribute('data-theme','dark');
  });
}
