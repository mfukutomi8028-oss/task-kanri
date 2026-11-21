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
      layout:{x:24,y:24,width:280,height:220,zIndex:1,revision:1,updatedAt:now},
      mobile:{order:sequence,revision:1,updatedAt:now}});
     send();return {ok:true,id};
    }
    const note=rows.find(n=>n.id===cmd.id);
    if(!note)return {ok:false,error:'record-not-found'};
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
test('Origin sticky: no authenticated store shows locked mode without a write control',async({page})=>{
 await page.setViewportSize({width:1366,height:900});
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.continue():route.abort());
 await page.addInitScript(()=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskRoomId','sticky-no-auth');
  localStorage.setItem('systemTaskUser','テスト利用者');
 });
 await page.goto('/?room=sticky-no-auth');
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await root.locator('[data-route="notes"]').first().click();
 await root.locator('[data-sticky-mode="personal"]').click();
 await expect(root.locator('.sticky-add')).toBeDisabled();
 await expect(root.locator('.sticky-origin-error')).toContainText('本人確認');
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
