import { test, expect } from '@playwright/test';

// Synthetic in-memory sticky service: test presentation, never patient/real data.
// Security belongs to the separate Auth + Firebase Emulator tests.
async function origin(page,width=1366) {
 await page.setViewportSize({width,height:900});
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.continue():route.abort());
 await page.addInitScript(()=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskUser','テスト利用者');
  localStorage.setItem('systemTaskRoomId','sticky-ui-test');
  const rows=[],callbacks=new Set();
  const send=()=>{const snapshot={status:'ready',ownerUid:'uid_test',ownerRoom:'sticky-ui-test',notes:structuredClone(rows)};
   callbacks.forEach(cb=>cb(snapshot));};
  let sequence=0;
  window.WorkBoardPersonalStickyStoreV659={
   subscribe(cb){callbacks.add(cb);cb({status:'ready',ownerUid:'uid_test',ownerRoom:'sticky-ui-test',notes:structuredClone(rows)});return()=>callbacks.delete(cb);},
   readSnapshot(){return {status:'ready',ownerUid:'uid_test',ownerRoom:'sticky-ui-test',notes:structuredClone(rows)};},
   async dispatch(cmd){
    if(cmd.type==='sticky.content' && window.__stickyHoldTextSave) {
      await new Promise(resolve=>{
        if(!window.__stickyWaitingSaves)window.__stickyWaitingSaves=[];
        window.__stickyWaitingSaves.push(resolve);
      });
    }
    if(cmd.ownerUid!=='uid_test'||cmd.ownerRoom!=='sticky-ui-test')return {ok:false,error:'auth-required'};
    if(cmd.type==='sticky.create'){
     const id='demo_'+(++sequence),now=Date.now();
     rows.push({schemaVersion:1,id,ownerUid:'uid_test',roomId:'sticky-ui-test',createdAt:now,updatedAt:now,
      content:{text:'',revision:1,updatedAt:now},appearance:{color:'lemon',revision:1,updatedAt:now},
      layout:{x:24+(sequence-1)*328,y:24,width:280,height:220,zIndex:sequence,revision:1,updatedAt:now},
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
 await root.locator('[data-sticky-mode="personal"]').click();
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
 await card.locator('[data-sticky-color="mint"]').click();
 await expect(card.locator('[data-sticky-color="mint"]')).toHaveAttribute('aria-pressed','true');
 await root.locator('[data-sticky-mode="business"]').click();
 await expect(root.locator('#originMemoQuery')).toBeVisible();
 await root.locator('[data-sticky-mode="personal"]').click();
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
 await root.locator('[data-sticky-mode="personal"]').click();
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
 await reloaded.locator('[data-sticky-mode="personal"]').click();
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
  await root.locator('.sticky-origin-card').first().locator('[data-sticky-color="mint"]').click();
  await root.locator('.sticky-add').click();
  await expect(root.locator('.sticky-origin-card')).toHaveCount(2);
  await root.locator('[data-sticky-color-filter]').selectOption('mint');
  await expect(root.locator('.sticky-origin-card')).toHaveCount(1);
  await expect(root.locator('.sticky-origin-card [data-sticky-color="mint"]')).toHaveAttribute('aria-pressed','true');
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
  expect(reset).toBeGreaterThan(1200);
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
 const text=root.locator('.sticky-origin-card textarea');
 await text.fill('まだ保存していない利用者ごとの付箋');
 const picker=root.locator('#originUserSelect');
 const prior=await picker.inputValue();
 const next=prior==='森井'?'福冨':'森井';
 await expect(root.locator('[data-sticky-status]')).toContainText('未保存');
 // The default Playwright dialog handler dismisses the native confirmation.
 await picker.selectOption(next);
 await expect(picker).toHaveValue(prior);
 await expect(text).toHaveValue('まだ保存していない利用者ごとの付箋');
});
