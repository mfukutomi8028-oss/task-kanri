import {test,expect} from '@playwright/test';

// Offline synthetic room: no real Firebase requests or user data.
async function launch(page,room,width=1366){
  await page.setViewportSize({width,height:width<600?800:900});
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'
    ?route.continue():route.abort('blockedbyclient'));
  await page.addInitScript(id=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskRoomId',id);
    localStorage.setItem('systemTaskUser','OriginMemoReview');
  },room);
  await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  const root=page.locator('#modernOriginRoot');
  await expect(root).toBeVisible();
  return root;
}

async function createMemos(page){
  return page.evaluate(async()=>{
    const bridge=window.WorkBoardPaletteMemoBridgeV369;
    const {roomId,currentUser}=window.WorkBoardPaletteBridge.readSnapshot();
    const entries=[
      {title:'手順書A',category:'手順',paperColor:'mint',pinned:true},
      {title:'手順書B',category:'手順',paperColor:'ivory',pinned:false},
      {title:'連絡先C',category:'連絡先',paperColor:'peach',pinned:false},
      {title:'報告D',category:'報告',paperColor:'mint',pinned:true}
    ];
    for(const item of entries){
      const out=await bridge.dispatch({type:'memo.create',ownerRoom:roomId,ownerUser:currentUser,
        ...item,body:'内容を一覧で確認できます。',tags:[]});
      if(!out?.ok)throw Error('fixture memo.create: '+JSON.stringify(out));
    }
    return bridge.readSnapshot().map(m=>({id:m.id,revision:m.revision,updatedAt:m.updatedAt}));
  });
}

test('Origin memo filters communicate context-aware counts and zero-result recovery',async({page})=>{
  test.setTimeout(90000);
  const root=await launch(page,'origin-memo-findability-counts');
  const original=await createMemos(page);
  await root.locator('#desktopNav [data-route="notes"]').click();
  const category=value=>root.locator('[data-action="memo-filter"][data-value="'+value+'"]');
  const color=value=>root.locator('[data-action="memo-color-filter"][data-value="'+value+'"]');
  const count=loc=>loc.locator('.origin-memo-count');
  await expect(count(category('all'))).toHaveText('4');
  await expect(count(category('pinned'))).toHaveText('2');
  await expect(count(category('手順'))).toHaveText('2');
  await expect(count(color('mint'))).toHaveText('2');
  await root.locator('#originMemoQuery').fill('手順');
  await expect(count(category('all'))).toHaveText('2');
  await expect(count(category('連絡先'))).toHaveText('0');
  await expect(count(color('mint'))).toHaveText('1');
  await color('mint').click();
  await expect(count(category('手順'))).toHaveText('1');
  await category('連絡先').click();
  await expect(root.locator('.origin-memo-shell')).toHaveCount(0);
  const zero=root.locator('.origin-memo-empty');
  await expect(zero).toContainText('該当するメモがありません');
  await expect(zero.locator('[data-action="memo-reset"]')).toBeVisible();
  await zero.locator('[data-action="memo-reset"]').click();
  await expect(root.locator('#originMemoQuery')).toHaveValue('');
  await expect(root.locator('#originMemoQuery')).toBeFocused();
  await expect(root.locator('.origin-memo-shell')).toHaveCount(4);
  const after=await page.evaluate(()=>window.WorkBoardPaletteMemoBridgeV369.readSnapshot()
    .map(m=>({id:m.id,revision:m.revision,updatedAt:m.updatedAt})));
  expect(after).toEqual(original);
});

test('Origin empty memo library offers a clear first action without changing data',async({page})=>{
  const root=await launch(page,'origin-memo-findability-empty');
  await root.locator('#desktopNav [data-route="notes"]').click();
  const empty=root.locator('.origin-memo-empty');
  await expect(empty).toContainText('メモはまだありません');
  await expect(empty.locator('[data-action="memo-reset"]')).toHaveCount(0);
  await empty.locator('[data-action="new"][data-kind="memos"]').click();
  await expect(root.locator('#editForm[data-kind="memos"]')).toBeVisible();
  await root.locator('.sheet-close').click();
  const saved=await page.evaluate(()=>window.WorkBoardPaletteMemoBridgeV369.readSnapshot());
  expect(saved).toHaveLength(0);
});

test('Origin memo swatches and filters convey selection, hover and keyboard focus',async({page})=>{
  const root=await launch(page,'origin-memo-findability-feedback');
  await createMemos(page);
  await root.locator('#desktopNav [data-route="notes"]').click();
  const chip=root.locator('[data-action="memo-color-filter"][data-value="peach"]');
  const before=await chip.evaluate(el=>getComputedStyle(el).backgroundColor);
  await chip.hover();
  await page.waitForTimeout(190);
  const hovered=await chip.evaluate(el=>getComputedStyle(el).backgroundColor);
  expect(hovered).not.toBe(before);
  await chip.click();
  const selected=await chip.evaluate(el=>getComputedStyle(el).boxShadow);
  expect(selected).not.toBe('none');
  await root.locator('[data-action="memo-color-filter"][data-value="all"]').click();
  const swatch=root.locator('.origin-memo-shell[data-paper-color="mint"] .origin-color-dot[aria-pressed="true"]').first();
  await expect(swatch).toBeVisible();
  const check=await swatch.evaluate(el=>getComputedStyle(el,'::after').content);
  expect(check).toContain('✓');
  await root.locator('#originMemoQuery').focus();
  const focus=await root.locator('#originMemoQuery').evaluate(el=>getComputedStyle(el).outlineStyle);
  expect(focus).not.toBe('none');
});

for(const width of [320,390]){
  test('Origin memo controls remain usable at '+width+'px with no page overflow',async({page})=>{
    const root=await launch(page,'origin-memo-findability-mobile-'+width,width);
    await createMemos(page);
    await root.locator('#mobileNav [data-route="notes"]').click();
    const chips=root.locator('[data-action="memo-filter"]');
    await expect(chips.first().locator('.origin-memo-count')).toBeVisible();
    const chipHeight=await chips.first().evaluate(el=>el.getBoundingClientRect().height);
    expect(chipHeight).toBeGreaterThanOrEqual(44);
    await root.locator('[data-action="memo-advanced-toggle"]').click();
    await expect(root.locator('[data-action="memo-color-filter"][data-value="mint"]')).toBeVisible();
    const fieldHeight=await root.locator('#originMemoQuery').evaluate(el=>el.getBoundingClientRect().height);
    expect(fieldHeight).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(3);
  });
}
