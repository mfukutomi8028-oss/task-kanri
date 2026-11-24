import {test,expect} from '@playwright/test';

test.use({locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'});

async function openSyntheticMemos(page,baseURL,width,theme){
 const room='origin-memo-density-'+width+'-'+theme;
 await page.setViewportSize({width,height:width===320?760:width===390?844:900});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.clock.setFixedTime(new Date('2026-11-24T08:00:00+09:00'));
 await page.route('**/*',route=>new URL(route.request().url()).origin===baseURL
  ?route.continue():route.abort('blockedbyclient'));
 await page.addInitScript(id=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskRoomId',id);
  localStorage.setItem('systemTaskUser','テスト担当');
 },room);
 await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await expect(root).toBeVisible();
 if(await root.getAttribute('data-theme')!==theme){
  await root.locator('#originSettingsToggle').click();
  await root.locator('#themeBtn').click();
  await root.locator('#originSettingsPanel [data-action="settings-close"]').click();
 }
 await expect(root).toHaveAttribute('data-theme',theme);
 const saved=await page.evaluate(async()=>{
  const {roomId,currentUser}=window.WorkBoardPaletteBridge.readSnapshot();
  const {dispatch,readSnapshot}=window.WorkBoardPaletteMemoBridgeV369;
  for(const [title,category,paperColor] of [
   ['北棟の点検記録','手順','mint'],['中央の点検記録','手順','mint'],['運用手順の確認','手順','ivory']
  ]){
   const result=await dispatch({type:'memo.create',ownerRoom:roomId,ownerUser:currentUser,
    title,category,paperColor,pinned:false,body:'次回作業の確認手順を記録します。',tags:['施設点検']});
   if(!result?.ok)throw Error('memo fixture: '+JSON.stringify(result));
  }
  return readSnapshot();
 });
 await root.locator((width<=770?'#mobileNav':'#desktopNav')+' [data-route="notes"]').click();
 await expect(root.locator('.memo-card')).toHaveCount(3);
 return {root,saved};
}

async function memoGeometry(root){
 return root.evaluate(el=>{
  const shadow=el.shadowRoot;
  const box=selector=>{
   const rect=shadow.querySelector(selector).getBoundingClientRect();
   return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom};
  };
  return {
   search:box('#originMemoQuery'),
   jump:box('[data-action="jump-result"][data-kind="memos"]'),
   advanced:box('[data-action="memo-advanced-toggle"]'),
   sort:box('#originMemoSort'),
   categories:box('.memo-toolbar .tab-pills'),
   result:box('.origin-memo-result>span'),
   layout:box('.origin-memo-layout'),
   gallery:box('.memo-card'),
   overflow:document.documentElement.scrollWidth-innerWidth,
  };
 });
}

for(const [width,theme] of [[320,'light'],[390,'light'],[390,'dark']]){
 test('Origin mobile business memos share one compact search row at '+width+'px ('+theme+')',async({page,baseURL},testInfo)=>{
  const {root,saved}=await openSyntheticMemos(page,baseURL,width,theme);
  const search=root.getByRole('searchbox',{name:'メモを検索',exact:true});
  const jump=root.getByRole('button',{name:'表示中のメモの先頭へ移動'});
  const advanced=root.locator('[data-action="memo-advanced-toggle"]');
  const sort=root.getByRole('combobox',{name:'メモの並び順',exact:true});
  const filters=root.getByRole('group',{name:'メモの色で絞り込む'});
  await expect(advanced).toHaveAttribute('aria-expanded','false');
  await expect(search).toHaveAccessibleDescription('タイトル・本文・タグを検索');
  await expect(sort).toBeHidden();
  await expect(filters).toBeHidden();
  const initial=await memoGeometry(root);
  await testInfo.attach('memo-layout', {body:JSON.stringify(initial,null,2),contentType:'application/json'});
  await testInfo.attach('memo-screen', {body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});
  const sameRow=metrics=>{
   expect(metrics.overflow).toBe(0);
   for(const button of [metrics.jump,metrics.advanced]){
    expect(button.width).toBeGreaterThanOrEqual(44);
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(Math.abs(button.y-metrics.search.y)).toBeLessThanOrEqual(1);
   }
   expect(metrics.search.height).toBeGreaterThanOrEqual(44);
   expect(metrics.search.right).toBeLessThan(metrics.jump.x);
   expect(metrics.jump.right).toBeLessThan(metrics.advanced.x);
   expect(metrics.advanced.right).toBeLessThanOrEqual(metrics.categories.right);
  };
  sameRow(initial);
  expect(initial.result.right).toBeLessThan(initial.layout.x);
  expect(initial.result.y).toBeLessThan(initial.layout.bottom);
  expect(initial.result.bottom).toBeGreaterThan(initial.layout.y);
  expect(initial.gallery.y).toBeLessThan(initial.search.y+192);
  await search.focus();
  await page.keyboard.press('Tab');
  await expect(jump).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(advanced).toBeFocused();
  expect(await advanced.evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(advanced).toBeFocused();
  await expect(advanced).toHaveAttribute('aria-expanded','true');
  await expect(sort).toBeVisible();
  await expect(filters).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(sort).toBeFocused();
  await sort.selectOption('title');
  await expect(sort).toHaveValue('title');
  await search.fill('点検');
  await filters.locator('[data-value="mint"]').click();
  await root.locator('[data-action="memo-filter"][data-value="手順"]').click();
  await expect(advanced).toHaveAccessibleName(/詳細条件\s+適用中\s*3/);
  await advanced.click();
  await expect(advanced).toHaveAttribute('aria-expanded','false');
  sameRow(await memoGeometry(root));
  await expect(root.locator('.memo-card')).toHaveCount(2);
  await expect(root.locator('.origin-memo-result')).toContainText('色：ミント');
  await root.locator('[data-action="memo-layout"][data-value="list"]').click();
  await expect(root.locator('.memo-grid')).toHaveClass(/origin-memo-list/);
  await jump.click();
  await expect(root.locator('.memo-card').first()).toBeFocused();
  expect(await page.evaluate(()=>window.WorkBoardPaletteMemoBridgeV369.readSnapshot())).toEqual(saved);
 });
}

test('Origin desktop business memo sorting and color filters stay in place',async({page,baseURL},testInfo)=>{
 const {root}=await openSyntheticMemos(page,baseURL,1366,'light');
 await expect(root.locator('[data-action="memo-advanced-toggle"]')).toBeHidden();
 await expect(root.getByRole('combobox',{name:'メモの並び順'})).toBeVisible();
 await expect(root.getByRole('group',{name:'メモの色で絞り込む'})).toBeVisible();
 const position=await memoGeometry(root);
 await testInfo.attach('memo-layout', {body:JSON.stringify(position,null,2),contentType:'application/json'});
 await testInfo.attach('memo-screen', {body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});
 expect(position.overflow).toBe(0);
 expect(Math.abs(position.search.y-position.sort.y)).toBeLessThanOrEqual(1);
 expect(position.jump.right).toBeLessThan(position.sort.x);
 expect(position.categories.y).toBeGreaterThan(position.sort.bottom);
 expect(position.gallery.y).toBeGreaterThan(position.categories.bottom);
});
