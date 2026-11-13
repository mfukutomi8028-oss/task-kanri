import { test, expect } from '@playwright/test';

for (const width of [320,390,1366]) {
  test('Retired Palette preference boots Classic and exposes only three live modes at '+width+'px',async ({page})=>{
    test.setTimeout(90000);
    const room='retired-palette-v575-'+width;
    await page.setViewportSize({width,height:width<=390?760:900});
    await page.route('**/*',route=>
      new URL(route.request().url()).origin==='http://127.0.0.1:4173'
        ?route.continue():route.abort('blockedbyclient'));
    await page.addInitScript(({room})=>{
      Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
      localStorage.setItem('systemTaskRoomId',room);
      localStorage.setItem('systemTaskUser','福冨');
      localStorage.setItem('workBoardDisplayV356:'+encodeURIComponent(room)+':'+encodeURIComponent('福冨'),'palette');
    },{room});
    await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true&&window.WORK_BOARD_CORE_READY===true,
      undefined,{timeout:30000});
    await expect(page.locator('html')).toHaveAttribute('data-wb-display','classic');
    const choices=page.locator('#wbDisplayChoiceV356 [data-wb-display-choice]');
    await expect(choices).toHaveCount(3);
    await expect(page.locator('#wbDisplayChoiceV356 [data-wb-display-choice="palette"]')).toHaveCount(0);
    await expect(page.locator('#paletteNextRoot,#wbPaletteMobileDockV358')).toHaveCount(0);
    const state=await page.evaluate(({room})=>({
      saved:localStorage.getItem('workBoardDisplayV356:'+encodeURIComponent(room)+':'+encodeURIComponent('福冨')),
      shared:Boolean(window.WorkBoardSharedBridge?.readSnapshot),
      memo:Boolean(window.WorkBoardSharedMemoBridge?.readSnapshot),
      snapshot:window.WorkBoardSharedBridge?.readSnapshot()?.roomId
    }),{room});
    expect(state.saved).toBeNull();
    expect(state.shared).toBe(true);
    expect(state.memo).toBe(true);
    expect(state.snapshot).toBe(room);
    await page.evaluate(()=>window.WorkBoardDisplayController.selectMode('palette'));
    await expect(page.locator('html')).toHaveAttribute('data-wb-display','classic');
    await choices.filter({hasText:'Origin'}).evaluate(el=>el.click());
    await expect(page.locator('html')).toHaveAttribute('data-wb-display','modern');
    await expect(page.locator('#modernOriginRoot')).toBeVisible({timeout:15000});
    await page.evaluate(()=>window.WorkBoardDisplayController.selectMode('classic'));
    await expect(page.locator('html')).toHaveAttribute('data-wb-display','classic');
    await page.evaluate(()=>window.WorkBoardDisplayController.selectMode('journal'));
    await expect(page.locator('html')).toHaveAttribute('data-wb-display','journal');
    await expect(page.locator('#wbJournalHeaderV367')).toBeVisible({timeout:15000});
    const x=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    expect(x.scroll).toBeLessThanOrEqual(x.client+3);
  });
}

test('Neutral shared bridge still saves canonical ToDo across Classic/Origin navigation',async ({page})=>{
  test.setTimeout(90000);
  await page.route('**/*',route=>
    new URL(route.request().url()).origin==='http://127.0.0.1:4173'
      ?route.continue():route.abort('blockedbyclient'));
  await page.addInitScript(()=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskRoomId','retired-palette-bridge-check');
    localStorage.setItem('systemTaskUser','福冨');
  });
  await page.goto('/?room=retired-palette-bridge-check',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true&&window.WorkBoardSharedBridge?.dispatch);
  const title='共有API継続確認 v575';
  const result=await page.evaluate(text=>window.WorkBoardSharedBridge.dispatch({type:'todo.create',text,memo:'共通データを保持'}),title);
  expect(result.ok).toBe(true);
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  await expect(page.locator('#modernOriginRoot')).toBeVisible({timeout:15000});
  const saved=await page.evaluate(text=>window.WorkBoardSharedBridge.readSnapshot().todos.find(item=>item.text===text),title);
  expect(saved?.memo).toBe('共通データを保持');
  await page.evaluate(()=>window.WorkBoardDisplayController.selectMode('classic'));
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','classic');
});
