import { test, expect } from '@playwright/test';

// Synthetic in-memory sticky service: test presentation, never patient/real data.
// The selected board name is a view partition only; no login or privacy guarantee is provided.
async function origin(page,width=1366) {
 await page.setViewportSize({width,height:900});
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.continue():route.abort());
 await page.addInitScript(()=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskUser','テスト利用者');
  localStorage.setItem('systemTaskRoomId','sticky-ui-test');
  const rows=[],callbacks=new Set();
  let collapsed=[];
  const send=()=>{const snapshot={status:'ready',ownerUid:'uid_test',ownerRoom:'sticky-ui-test',notes:structuredClone(rows)};
   callbacks.forEach(cb=>cb(snapshot));};
  let sequence=0;
  window.WorkBoardPersonalStickyStoreV659={
   subscribe(cb){callbacks.add(cb);cb({status:'ready',ownerUid:'uid_test',ownerRoom:'sticky-ui-test',notes:structuredClone(rows)});return()=>callbacks.delete(cb);},
   readSnapshot(){return {status:'ready',ownerUid:'uid_test',ownerRoom:'sticky-ui-test',notes:structuredClone(rows)};},
   readCollapsedNotes(){return [...collapsed];},
   saveCollapsedNotes(ids){collapsed=[...ids];return true;},
   async dispatch(cmd){
    if(cmd.type==='sticky.content' && window.__stickyHoldTextSave) {
      await new Promise(resolve=>{
        if(!window.__stickyWaitingSaves)window.__stickyWaitingSaves=[];
        window.__stickyWaitingSaves.push(resolve);
      });
    }
    if(cmd.ownerUid!=='uid_test'||cmd.ownerRoom!=='sticky-ui-test')return {ok:false,error:'unavailable'};
    if(cmd.type==='sticky.create'){
     const id='demo_'+(++sequence),now=Date.now();
     rows.push({schemaVersion:1,id,ownerUid:'uid_test',roomId:'sticky-ui-test',createdAt:now,updatedAt:now,
      content:{text:'',revision:1,updatedAt:now},appearance:{color:'lemon',revision:1,updatedAt:now},
      layout:{x:24+(sequence-1)*328,y:24,width:280,height:220,zIndex:sequence,page:cmd.page??1,revision:1,updatedAt:now},
      mobile:{order:sequence,revision:1,updatedAt:now}});
     send();return {ok:true,id};
    }
    const note=rows.find(n=>n.id===cmd.id);
    if(!note)return {ok:false,error:'record-not-found'};
    if(cmd.type==='sticky.mobileMove'){
     const sorted=rows.slice().sort((a,b)=>a.mobile.order-b.mobile.order||a.createdAt-b.createdAt);
     const i=sorted.findIndex(n=>n.id===cmd.id);
     const other=cmd.direction==='up'?sorted[i-1]:sorted[i+1];
     if(!other)return {ok:false,error:'reorder-unavailable'};
     const order=other.mobile.order+(cmd.direction==='up'?-1:1);
     if(order<0)return {ok:false,error:'reorder-unavailable'};
     note.mobile={...note.mobile,order,revision:note.mobile.revision+1,updatedAt:Date.now()};
     send();return {ok:true,id:note.id,note:structuredClone(note)};
    }
    if(cmd.type==='sticky.delete'){
     if(Object.keys(cmd.expectedRevisions||{}).some(key=>note[key].revision!==cmd.expectedRevisions[key]))return {ok:false,error:'conflict'};
     rows.splice(rows.indexOf(note),1);send();return {ok:true};
    }
    const field=cmd.type.slice('sticky.'.length);
    if(note[field]?.revision!==cmd.expectedRevision)return {ok:false,error:'conflict'};
    note[field]={...note[field],...cmd.values,revision:note[field].revision+1,updatedAt:Date.now()};
    send();return {ok:true,id:note.id,note:structuredClone(note)};
   }
  };
 });
 await page.goto('/?room=sticky-ui-test');
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await root.locator((width<=770?'#mobileNav':'#desktopNav')+' [data-route="notes"]').click();
 if(width<=770){await root.locator('[data-memo-header-mode="personal"]').click();}
 else{await root.locator('#desktopNav .origin-memo-nav').hover();await root.locator('#desktopNav [data-memo-nav-mode="personal"]').click();}
 await expect(root.locator('#originStickyMountV659')).toBeVisible();
 return root;
}
test('Origin sticky: create, Japanese text, paper color and business memo return',async({page})=>{
 const root=await origin(page);
 await root.locator('.sticky-add').click();
 const card=root.locator('.sticky-origin-card');
 await expect(card).toHaveCount(1);
 await card.locator('textarea').fill('会議の確認事項');
 await expect(card.locator('[data-sticky-status]')).toContainText('未保存');
 await expect.poll(async()=>page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes[0]?.content.text)).toBe('会議の確認事項');
 await card.locator('[data-sticky-color-toggle]').click();
 await card.locator('[data-sticky-color="mint"]').click();
 await expect(card.locator('[data-sticky-color="mint"]')).toHaveAttribute('aria-pressed','true');
 await root.locator('#desktopNav .origin-memo-nav').hover();
 await root.locator('#desktopNav [data-memo-nav-mode="business"]').click();
 await expect(root.locator('#originMemoQuery')).toBeVisible();
 await root.locator('#desktopNav .origin-memo-nav').hover();
 await root.locator('#desktopNav [data-memo-nav-mode="personal"]').click();
 await expect(root.locator('.sticky-origin-card textarea')).toHaveValue('会議の確認事項');
});
test('Origin sticky: layout drag persists only layout, search keeps note readable',async({page})=>{
 const root=await origin(page);
 await root.locator('.sticky-add').click();
 const card=root.locator('.sticky-origin-card');
 const grip=card.locator('[data-sticky-move]');
 const rect=await grip.boundingBox();
 await page.mouse.move(rect.x+40,rect.y+20);
 await page.mouse.down();
 await page.mouse.move(rect.x+120,rect.y+65,{steps:6});
 await page.mouse.up();
 await expect.poll(async()=>page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes[0]?.layout.x)).toBeGreaterThan(24);
 await root.locator('.sticky-origin-toolbar input').fill('該当しない');
 await expect(root.locator('.sticky-origin-card')).toHaveCount(0);
});
test('Origin sticky: mobile uses list instead of overwriting canvas coordinates',async({page})=>{
 const root=await origin(page,390);
 await root.locator('.sticky-add').click();
 await expect(root.locator('.sticky-origin-card')).toHaveCount(1);
 await expect(root.locator('.sticky-origin-resize')).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 const original=await page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes[0].layout.x);
 await root.locator('.sticky-origin-card textarea').fill('スマートフォンの付箋');
 await expect.poll(async()=>page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes[0]?.content.text)).toBe('スマートフォンの付箋');
 expect(await page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes[0].layout.x)).toBe(original);
});
test('Origin sticky is usable with no login and local-only fallback',async({page})=>{
 await page.setViewportSize({width:1366,height:900});
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.continue():route.abort());
 await page.addInitScript(()=>{
   Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
   localStorage.setItem('systemTaskRoomId','sticky-no-login');
   localStorage.setItem('systemTaskUser','福冨');
 });
 await page.goto('/?room=sticky-no-login');
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await root.locator('[data-route="notes"]').first().click();
  await root.locator('#desktopNav .origin-memo-nav').hover();
  await root.locator('#desktopNav [data-memo-nav-mode="personal"]').click();
 await expect(root.locator('.sticky-add')).toBeEnabled();
 await root.locator('.sticky-add').click();
 await root.locator('.sticky-origin-card textarea').fill('ログイン不要の個人付箋');
 await expect.poll(async()=>page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659?.readSnapshot().notes[0]?.content.text))
   .toBe('ログイン不要の個人付箋');
 await page.evaluate(()=>window.WorkBoardPaletteBridge.selectUser('森井'));
 await expect(root.locator('.sticky-origin-card')).toHaveCount(0);
 await page.evaluate(()=>window.WorkBoardPaletteBridge.selectUser('福冨'));
 await expect(root.locator('.sticky-origin-card textarea')).toHaveValue('ログイン不要の個人付箋');
 await page.reload();
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const reloaded=page.locator('#modernOriginRoot');
 await reloaded.locator('[data-route="notes"]').first().click();
 await reloaded.locator('#desktopNav .origin-memo-nav').hover();
 await reloaded.locator('#desktopNav [data-memo-nav-mode="personal"]').click();
 await expect(reloaded.locator('.sticky-origin-card textarea')).toHaveValue('ログイン不要の個人付箋');
});

test('Origin sticky blocks navigation while a note has an uncommitted draft',async({page})=>{
 const root=await origin(page);
 await root.locator('.sticky-add').click();
 await page.evaluate(()=>{window.__stickyHoldTextSave=true});
 await root.locator('.sticky-origin-card textarea').fill('保存待ちの個人付箋');
 await root.locator('#desktopNav [data-route="tasks"]').click();
 // Default Playwright behavior dismisses the native confirm prompt.
 await expect(root.locator('#originStickyMountV659')).toBeVisible();
 await page.evaluate(()=>{
   window.__stickyHoldTextSave=false;
   for(const release of window.__stickyWaitingSaves||[])release();
   window.__stickyWaitingSaves=[];
 });
 await expect.poll(async()=>page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes[0]?.content.text))
  .toBe('保存待ちの個人付箋');
 await root.locator('#desktopNav [data-route="tasks"]').click();
 await expect(root.locator('#originStickyMountV659')).toHaveCount(0);
});

test('Origin mobile order controls rearrange cards without touching desktop coordinates',async({page})=>{
 const root=await origin(page,390);
 await root.locator('.sticky-add').click();
 await root.locator('.sticky-add').click();
 const before=await page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes);
 expect(before).toHaveLength(2);
 const secondId=before[1].id;
 const oldCoords=before.map(n=>[n.layout.x,n.layout.y]);
 await root.locator('.sticky-origin-card').nth(1).locator('[data-sticky-order="up"]').click();
 await expect(root.locator('.sticky-origin-card').first()).toHaveAttribute('data-id',secondId);
 const after=await page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes);
 expect(after.map(n=>[n.layout.x,n.layout.y])).toEqual(oldCoords);
});

test('Origin sticky keeps the newest draft when two writes overlap',async({page})=>{
 const root=await origin(page);
 await root.locator('.sticky-add').click();
 await page.evaluate(()=>{window.__stickyHoldTextSave=true});
 const textarea=root.locator('.sticky-origin-card textarea');
 await textarea.fill('保存を待つ文章');
 await textarea.evaluate(element=>element.blur());
 await expect.poll(async()=>page.evaluate(()=>(window.__stickyWaitingSaves||[]).length)).toBe(1);
 await textarea.fill('保存を待つ文章と追記');
 await textarea.evaluate(element=>element.blur());
 await page.evaluate(()=>{
   window.__stickyHoldTextSave=false;
   for(const release of window.__stickyWaitingSaves||[])release();
   window.__stickyWaitingSaves=[];
 });
 await expect.poll(async()=>page.evaluate(()=>
   window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes[0]?.content.text))
   .toBe('保存を待つ文章と追記');
});

test('Origin sticky search keeps focus and input through a remote snapshot',async({page})=>{
 const root=await origin(page);
 const search=root.locator('.sticky-origin-toolbar input[type="search"]');
 await search.fill('日本語で検索中');
 await expect(search).toBeFocused();
 await page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659.dispatch({
   type:'sticky.create',ownerUid:'uid_test',ownerRoom:'sticky-ui-test'
 }));
 await expect(search).toBeFocused();
 await expect(search).toHaveValue('日本語で検索中');
});

test('Origin sticky filters by paper color and resets search without losing notes',async({page})=>{
  const root=await origin(page);
  await root.locator('.sticky-add').click();
  await root.locator('.sticky-origin-card').first().locator('[data-sticky-color-toggle]').click();
  await root.locator('.sticky-origin-card').first().locator('[data-sticky-color="mint"]').click();
  await root.locator('.sticky-add').click();
  await expect(root.locator('.sticky-origin-card')).toHaveCount(2);
  await root.locator('[data-sticky-color-filter]').selectOption('mint');
  await expect(root.locator('.sticky-origin-card')).toHaveCount(1);
  await expect(root.locator('.sticky-origin-card')).toHaveCSS('background-color','rgb(223, 240, 230)');
  await root.locator('[data-sticky-color-filter]').selectOption('all');
  await expect(root.locator('.sticky-origin-card')).toHaveCount(2);
});

test('Origin sticky brings a selected rear card in front without changing its text',async({page})=>{
  const root=await origin(page);
  await root.locator('.sticky-add').click();
  await root.locator('.sticky-add').click();
  const first=root.locator('.sticky-origin-card').first();
  const firstId=await first.getAttribute('data-id');
  await first.locator('[data-sticky-front]').click();
  await expect.poll(async()=>page.evaluate(id=>{
    const notes=window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes;
    const selected=notes.find(x=>x.id===id);
    return selected.layout.zIndex > Math.max(...notes.filter(x=>x.id!==id).map(x=>x.layout.zIndex));
  },firstId)).toBe(true);
  const notes=await page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes);
  expect(notes.every(note=>note.content.revision===1)).toBe(true);
});

test('Origin sticky all-view fits the complete canvas within the available stage',async({page})=>{
  const root=await origin(page,900);
  await root.locator('.sticky-add').click();
  await root.locator('[data-sticky-all-view]').click();
  const sizes=await root.locator('.sticky-origin-stage').evaluate(stage=>{
    const board=stage.querySelector('.sticky-origin-canvas');
    return {stage:stage.getBoundingClientRect().width,board:board.getBoundingClientRect().width};
  });
  expect(sizes.board).toBeLessThanOrEqual(sizes.stage+1);
  await root.locator('[data-sticky-all-view]').click();
  const reset=await root.locator('.sticky-origin-canvas').evaluate(node=>node.getBoundingClientRect().width);
  expect(reset).toBeLessThanOrEqual(sizes.stage+1);
});


test('Origin sticky navigator recovers a card hidden by filters and raises it above overlaps',async({page})=>{
 const root=await origin(page);
 await root.locator('.sticky-add').click();
 const first=root.locator('.sticky-origin-card').first();
 const firstId=await first.getAttribute('data-id');
 await first.locator('textarea').fill('会議の配布資料');
 await expect.poll(async()=>page.evaluate(id=>window.WorkBoardPersonalStickyStoreV659
  .readSnapshot().notes.find(note=>note.id===id)?.content.text,firstId)).toBe('会議の配布資料');

 await root.locator('.sticky-add').click();
 const second=root.locator('.sticky-origin-card').last();
 const secondId=await second.getAttribute('data-id');
 await second.locator('textarea').fill('明日の確認');
 await expect.poll(async()=>page.evaluate(id=>window.WorkBoardPersonalStickyStoreV659
  .readSnapshot().notes.find(note=>note.id===id)?.content.text,secondId)).toBe('明日の確認');

 await root.locator('[data-sticky-color-filter]').selectOption('mint');
 await expect(root.locator('.sticky-origin-card')).toHaveCount(0);
 await root.locator('[data-sticky-index-toggle]').click();
 const navigator=root.locator('[data-sticky-index]');
 await expect(navigator).toBeVisible();
 await expect(navigator.locator('[data-sticky-index-select]')).toHaveCount(2);
 await navigator.locator('[data-sticky-index-select="'+firstId+'"]').click();
 await expect(root.locator('[data-sticky-color-filter]')).toHaveValue('all');
 await expect(root.locator('.sticky-origin-card[data-id="'+firstId+'"] textarea')).toHaveValue('会議の配布資料');
 await expect.poll(async()=>page.evaluate(id=>{
   const notes=window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes;
   const chosen=notes.find(note=>note.id===id);
   return chosen.layout.zIndex>Math.max(...notes.filter(note=>note.id!==id).map(note=>note.layout.zIndex));
 },firstId)).toBe(true);
});

test('Origin sticky navigator is keyboard accessible and does not alter desktop placement on mobile',async({page})=>{
 const root=await origin(page,390);
 await root.locator('.sticky-add').click();
 await root.locator('.sticky-add').click();
 const before=await page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659
   .readSnapshot().notes.map(note=>({id:note.id,x:note.layout.x,y:note.layout.y})));
 await root.locator('[data-sticky-index-toggle]').click();
 const selection=root.locator('[data-sticky-index-select]').first();
 await selection.focus();
 await expect(selection).toBeFocused();
 await page.keyboard.press('Enter');
 const after=await page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659
   .readSnapshot().notes.map(note=>({id:note.id,x:note.layout.x,y:note.layout.y})));
 expect(after).toEqual(before);
 await expect(root.locator('.sticky-origin-card').first()).toBeVisible();
});

test('Origin user selector confirms before switching away from an unsaved personal sticky',async({page})=>{
 const root=await origin(page);
 await root.locator('.sticky-add').click();
 await page.evaluate(()=>{window.__stickyHoldTextSave=true});
 const text=root.locator('.sticky-origin-card textarea');
 await text.fill('まだ保存していない利用者ごとの付箋');
 const picker=root.locator('#originUserSelect');
 const prior=await picker.inputValue();
 const next=prior==='森井'?'福冨':'森井';
 await expect(root.locator('[data-sticky-status]')).toContainText(/未保存|保存中/);
 // The header picker is currently hidden in the personal memo layout.
 // Exercise its delegated change handler directly, without Playwright trying
 // to select an option on a nonvisible element.
 await picker.evaluate((element,value)=>{
   element.value=value;
   element.dispatchEvent(new Event('change',{bubbles:true,composed:true}));
 },next);
 await expect(picker).toHaveValue(prior);
 await expect(text).toHaveValue('まだ保存していない利用者ごとの付箋');
 await page.evaluate(()=>{
   window.__stickyHoldTextSave=false;
   for(const release of window.__stickyWaitingSaves||[])release();
   window.__stickyWaitingSaves=[];
 });
});

test('memo nav opens choices on hover and remembers the last opened memo',async({page})=>{
 const root=await origin(page);
 await root.locator('#desktopNav .origin-memo-nav').hover();
 await expect(root.locator('#desktopNav [data-memo-nav-mode="business"]')).toBeVisible();
 await root.locator('#desktopNav [data-memo-nav-mode="business"]').click();
 await expect(root.locator('#originMemoQuery')).toBeVisible();
 await root.locator('#desktopNav .origin-memo-nav').hover();
 await root.locator('#desktopNav [data-memo-nav-mode="personal"]').click();
 await root.locator('#desktopNav [data-route="tasks"]').click();
 await root.locator('#desktopNav [data-route="notes"]').click();
 await expect(root.locator('#originStickyMountV659')).toBeVisible();
 await expect(root.locator('[data-sticky-mode]')).toHaveCount(0);
});
test('compact paper palette and send-to-back change only the selected card',async({page})=>{
 const root=await origin(page);
 await root.locator('.sticky-add').click();
 await root.locator('.sticky-add').click();
 const second=root.locator('.sticky-origin-card').last();
 await expect(second.locator('.sticky-origin-palette')).toBeHidden();
 await second.locator('[data-sticky-color-toggle]').click();
 await expect(second.locator('.sticky-origin-palette')).toBeVisible();
 await second.locator('[data-sticky-color="sky"]').click();
 await second.locator('[data-sticky-back]').click();
 const notes=await page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes);
 expect(notes[1].layout.zIndex).toBeLessThan(notes[0].layout.zIndex);
 expect(notes[1].appearance.color).toBe('sky');
});
test('five pages keep new notes separate and allow moving an existing note',async({page})=>{
 const root=await origin(page);
 await root.locator('.sticky-add').click();
 await root.locator('[data-sticky-page="3"]').click();
 await expect(root.locator('[data-sticky-page="3"]')).toHaveAttribute('aria-pressed','true');
 await expect(root.locator('.sticky-origin-card')).toHaveCount(0);
 await root.locator('.sticky-add').click();
 await expect(root.locator('.sticky-origin-card')).toHaveCount(1);
 await root.locator('[data-sticky-page="1"]').click();
 await expect(root.locator('.sticky-origin-card')).toHaveCount(1);
 await root.locator('.sticky-origin-card [data-sticky-page-move]').selectOption('5');
 await expect(root.locator('.sticky-origin-card')).toHaveCount(0);
 await root.locator('[data-sticky-page="5"]').click();
 await expect(root.locator('.sticky-origin-card')).toHaveCount(1);
 const pageNumbers=await page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes.map(n=>n.layout.page).sort());
 expect(pageNumbers).toEqual([3,5]);
});
test('desktop canvas fits 1920 viewport without horizontal scrolling',async({page})=>{
 const root=await origin(page);
 await page.setViewportSize({width:1920,height:1080});
 const size=await root.locator('.sticky-origin-stage').evaluate(stage=>({
   client:stage.clientWidth,scroll:stage.scrollWidth,
   page:document.documentElement.scrollWidth,viewport:innerWidth
 }));
 expect(size.scroll).toBeLessThanOrEqual(size.client+1);
 expect(size.page).toBeLessThanOrEqual(size.viewport+1);
});


test('sticky paper-color control stays visible against every paper color',async({page})=>{
 const root=await origin(page);
 await root.locator('.sticky-add').click();
 const card=root.locator('.sticky-origin-card').first();
 const toggle=card.locator('[data-sticky-color-toggle]');
 for(const color of ['ivory','lemon','peach','mint','sky','lavender']){
   await toggle.click();
   await card.locator('[data-sticky-color="'+color+'"]').click();
   const visual=await toggle.evaluate(el=>{
     const surface=getComputedStyle(el),swatch=getComputedStyle(el.querySelector('.sticky-origin-color-preview'));
     return {background:surface.backgroundColor,border:surface.borderTopStyle,
       borderWidth:parseFloat(surface.borderTopWidth),swatchRenderedBorderWidth:parseFloat(swatch.borderTopWidth)};
   });
   expect(visual.background).toBe('rgb(255, 255, 255)');
   expect(visual.border).toBe('solid');
   expect(visual.borderWidth).toBeGreaterThanOrEqual(1);
   // The border must remain visible after viewport fitting; Protocol separately
   // guards the underlying two-pixel CSS definition.
   expect(visual.swatchRenderedBorderWidth).toBeGreaterThanOrEqual(1);
   const paper=await card.evaluate(el=>getComputedStyle(el).backgroundColor);
   const pastelPaper={
     ivory:'rgb(246, 242, 235)',lemon:'rgb(250, 243, 201)',
     peach:'rgb(250, 227, 219)',mint:'rgb(223, 240, 230)',
     sky:'rgb(225, 237, 248)',lavender:'rgb(238, 230, 248)'
   };
   expect(paper).toBe(pastelPaper[color]);
 }
});

test('long character counter never overlaps the bottom-right resize handle at minimum card size',async({page})=>{
 const root=await origin(page);
 await root.locator('.sticky-add').click();
 const card=root.locator('.sticky-origin-card').first();
 await card.locator('textarea').evaluate(el=>el.blur());
 await page.evaluate(async()=>{
   const service=window.WorkBoardPersonalStickyStoreV659;
   const note=service.readSnapshot().notes[0];
   const owner={ownerUid:note.ownerUid,ownerRoom:note.roomId,id:note.id};
   await service.dispatch({type:'sticky.content',...owner,expectedRevision:note.content.revision,values:{text:'あ'.repeat(2000)}});
   const updated=service.readSnapshot().notes[0];
   await service.dispatch({type:'sticky.layout',...owner,expectedRevision:updated.layout.revision,values:{width:220,height:160}});
 });
 // Use inline logical size; computed width is fractional under canvas zoom.
 await expect.poll(async()=>card.evaluate(el=>parseFloat(el.style.width))).toBe(220);
 const count=card.locator('.sticky-origin-char-count');
 await expect(count).toHaveText('2000/2000');
 const countBox=await count.boundingBox();
 const resizeBox=await card.locator('.sticky-origin-resize').boundingBox();
 expect(countBox).not.toBeNull();
 expect(resizeBox).not.toBeNull();
 expect(countBox.x+countBox.width+1).toBeLessThanOrEqual(resizeBox.x);
 // Every footer action must also remain separate at the minimum 220px card width.
 const footerOrder=['[data-sticky-color-toggle]','[data-sticky-delete]','[data-sticky-page-move]','.sticky-origin-char-count','.sticky-origin-resize'];
 const footerRects=await Promise.all(footerOrder.map(selector=>card.locator(selector).boundingBox()));
 for(let i=1;i<footerRects.length;i++){
   expect(footerRects[i-1].x+footerRects[i-1].width).toBeLessThanOrEqual(footerRects[i].x+.75);
 }
 await card.locator('textarea').fill('短文');
 await expect(count).toHaveText('2/2000');
});

test('sticky color and delete controls live together at lower left without a saved-status label',async({page})=>{
 const root=await origin(page);
 await root.locator('.sticky-add').click();
 const card=root.locator('.sticky-origin-card').first();
 const color=card.locator('.sticky-origin-foot [data-sticky-color-toggle]');
 const remove=card.locator('.sticky-origin-foot [data-sticky-delete]');
 await expect(color).toBeVisible();
 await expect(remove).toBeVisible();
 await expect(card.locator('.sticky-origin-card-head [data-sticky-color-toggle],.sticky-origin-card-head [data-sticky-delete]')).toHaveCount(0);
 await expect(card.getByText('保存済み',{exact:true})).toHaveCount(0);
 await expect(card.locator('[data-sticky-status]')).toBeHidden();
 const [frame,colorBox,removeBox]=await Promise.all([card.boundingBox(),color.boundingBox(),remove.boundingBox()]);
 expect(colorBox.x).toBeLessThan(removeBox.x);
 expect(colorBox.y).toBeGreaterThan(frame.y+frame.height*.65);
 await color.click();
 const palette=card.locator('.sticky-origin-palette');
 await expect(palette).toBeVisible();
 const menuBox=await palette.boundingBox();
 expect(menuBox.y+menuBox.height).toBeLessThanOrEqual(colorBox.y+4);
 await card.locator('[data-sticky-color="peach"]').click();
 await expect(card).toHaveCSS('background-color','rgb(250, 227, 219)');
 page.once('dialog',dialog=>dialog.accept());
 await remove.click();
 await expect(root.locator('.sticky-origin-card')).toHaveCount(0);
});
test('mobile note footer keeps color and delete accessible without a resize button',async({page})=>{
 const root=await origin(page,390);
 await root.locator('.sticky-add').click();
 const card=root.locator('.sticky-origin-card').first();
 await expect(card.locator('.sticky-origin-foot [data-sticky-color-toggle]')).toBeVisible();
 await expect(card.locator('.sticky-origin-foot [data-sticky-delete]')).toBeVisible();
 await expect(card.locator('.sticky-origin-resize')).toBeHidden();
 await card.locator('[data-sticky-color-toggle]').click();
 await expect(card.locator('.sticky-origin-palette')).toBeVisible();
 await expect(card.getByText('保存済み',{exact:true})).toHaveCount(0);
});

test('Origin sticky supports larger dimensions without changing the initial note size',async({page})=>{
 const root=await origin(page,1920);
 await root.locator('.sticky-add').click();
 const card=root.locator('.sticky-origin-card').first();
 const before=await page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes[0].layout);
 expect([before.width,before.height]).toEqual([280,220]);
 const handle=await card.locator('[data-sticky-resize]').boundingBox();
 await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);
 await page.mouse.down();
 await page.mouse.move(handle.x+handle.width/2+570,handle.y+handle.height/2+520,{steps:12});
 await page.mouse.up();
 await expect.poll(async()=>page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes[0].layout.width)).toBeGreaterThan(480);
 const after=await page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes[0].layout);
 expect(after.height).toBeGreaterThan(500);
 expect(after.width).toBeLessThanOrEqual(760);
 expect(after.height).toBeLessThanOrEqual(720);
 expect(after.x+after.width).toBeLessThanOrEqual(1400);
 expect(after.y+after.height).toBeLessThanOrEqual(900);
});
test('temporary expanded editor shares saved text but never changes persisted note dimensions',async({page})=>{
 const root=await origin(page);
 await root.locator('.sticky-add').click();
 const card=root.locator('.sticky-origin-card').first();
 const before=await page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes[0].layout);
 await card.locator('[data-sticky-expand]').click();
 const modal=root.locator('dialog.sticky-origin-editor');
 await expect(modal).toBeVisible();
 await modal.locator('textarea[data-sticky-text]').fill('拡大編集で入力した内容');
 await expect.poll(async()=>page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes[0]?.content.text)).toBe('拡大編集で入力した内容');
 await modal.locator('[data-sticky-expand-close]').click();
 await expect(modal).toHaveCount(0);
 await expect(root.locator('.sticky-origin-card textarea')).toHaveValue('拡大編集で入力した内容');
 const after=await page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes[0].layout);
 expect([after.x,after.y,after.width,after.height]).toEqual([before.x,before.y,before.width,before.height]);
});
test('folded note shows only title until toggled open, retaining original contents',async({page})=>{
 const root=await origin(page);
 await root.locator('.sticky-add').click();
 const card=root.locator('.sticky-origin-card').first();
 await card.locator('textarea').fill('折りたたみ対象の長いメモ');
 await expect.poll(async()=>page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes[0]?.content.text)).toBe('折りたたみ対象の長いメモ');
 await expect(card.locator('[data-sticky-status]')).toBeHidden();
 await card.locator('[data-sticky-collapse]').click();
 await expect(card).toHaveClass(/sticky-origin-card-collapsed/);
 await expect(card.locator('textarea')).toBeHidden();
 await expect(card.locator('[data-sticky-collapse]')).toHaveAttribute('aria-pressed','true');
 await card.locator('[data-sticky-collapse]').click();
 await expect(card).not.toHaveClass(/sticky-origin-card-collapsed/);
 await expect(card.locator('textarea')).toHaveValue('折りたたみ対象の長いメモ');
});
test('expanded note dialog is centered in the viewport rather than top-left',async({page})=>{
 const root=await origin(page,1536);
 await root.locator('.sticky-add').click();
 await root.locator('[data-sticky-expand]').first().click();
 const bounds=await root.locator('dialog.sticky-origin-editor').boundingBox();
 const view=page.viewportSize();
 expect(Math.abs(bounds.x+bounds.width/2-view.width/2)).toBeLessThan(5);
 expect(Math.abs(bounds.y+bounds.height/2-view.height/2)).toBeLessThan(5);
});
test('changing color and size preserves board and page scroll position',async({page})=>{
 const root=await origin(page,1366);
 await root.locator('.sticky-add').click();
 const card=root.locator('.sticky-origin-card').first();
 await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
 await root.locator('.sticky-origin-stage').evaluate(el=>{el.scrollTop=60;});
 const prior=await page.evaluate(()=>({window:window.scrollY}));
 const previous=await root.locator('.sticky-origin-stage').evaluate(el=>el.scrollTop);
 await card.locator('[data-sticky-color-toggle]').click();
 await card.locator('[data-sticky-color="sky"]').click();
 await expect.poll(async()=>root.locator('.sticky-origin-stage').evaluate(el=>el.scrollTop)).toBe(previous);
 expect(Math.abs((await page.evaluate(()=>window.scrollY))-prior.window)).toBeLessThan(3);
 const handle=await card.locator('[data-sticky-resize]').boundingBox();
 await page.mouse.move(handle.x+12,handle.y+12);
 await page.mouse.down();await page.mouse.move(handle.x+50,handle.y+50,{steps:6});await page.mouse.up();
 await expect.poll(async()=>root.locator('.sticky-origin-stage').evaluate(el=>el.scrollTop)).toBe(previous);
 expect(Math.abs((await page.evaluate(()=>window.scrollY))-prior.window)).toBeLessThan(3);
});
test('full-board mode has a centered fitted board with no unused side bay',async({page})=>{
 const root=await origin(page,1536);
 await root.locator('.sticky-fit').click();
 const b=await root.locator('.sticky-origin-stage').boundingBox();
 const c=await root.locator('.sticky-origin-canvas').boundingBox();
 expect(Math.abs((b.x+b.width/2)-(c.x+c.width/2))).toBeLessThan(4);
 expect(b.width-c.width).toBeLessThan(12);
});
test('arrange and redundant privacy note are absent; Shift snaps drag to 28px grid',async({page})=>{
 const root=await origin(page,1366);
 await expect(root.locator('[data-sticky-arrange]')).toHaveCount(0);
 await expect(root.locator('.sticky-origin-scope-note')).toHaveCount(0);
 await root.locator('.sticky-add').click();
 const grip=root.locator('.sticky-origin-grip').first();
 const p=await grip.boundingBox();
 await page.mouse.move(p.x+24,p.y+18);
 await page.keyboard.down('Shift');
 await page.mouse.down();await page.mouse.move(p.x+165,p.y+90,{steps:9});await page.mouse.up();
 await page.keyboard.up('Shift');
 const layout=await page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes[0].layout);
 expect(layout.x%28).toBe(0);expect(layout.y%28).toBe(0);
});
