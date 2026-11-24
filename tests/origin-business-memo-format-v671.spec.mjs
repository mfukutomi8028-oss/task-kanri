import {selectNoteText} from './helpers/origin-note-editing.mjs';
import {test,expect} from '@playwright/test';

async function launch(page,baseURL,room,width=1366){
 const origin=new URL(baseURL).origin;
 await page.setViewportSize({width,height:width<770?844:900});
 await page.route('**/*',route=>new URL(route.request().url()).origin===origin
   ?route.continue():route.abort('blockedbyclient'));
 await page.addInitScript(id=>{
   Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
   localStorage.setItem('systemTaskRoomId',id);
   localStorage.setItem('systemTaskUser','OriginBusinessMemoQA');
 },room);
 await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await root.locator((width<770?'#mobileNav':'#desktopNav')+' [data-route="notes"]').click();
 return root;
}
async function writeMemo(page,values){
 return page.evaluate(values=>{
   const s=window.WorkBoardPaletteBridge.readSnapshot();
   return window.WorkBoardPaletteMemoBridgeV369.dispatch({ownerRoom:s.roomId,ownerUser:s.currentUser,
     title:'書式付き手順',category:'手順',tags:[],paperColor:'ivory',pinned:false,...values});
 },values);
}
async function readMemo(page,id){
 return page.evaluate(id=>window.WorkBoardPaletteMemoBridgeV369.readSnapshot().find(m=>m.id===id),id);
}

test('business memo CAS preserves exact-text marks through trims and legacy metadata changes',async({page,baseURL})=>{
 const root=await launch(page,baseURL,'origin-memo-format-bridge');
 const body='対象😀\n確認 <img src=x onerror=window.memoInjected=1>';
 const raw=' \n'+body+'\n ';
 const created=await writeMemo(page,{type:'memo.create',body:raw,bodyFormat:{
   text:raw,runs:[{start:2,end:6,flags:1}]}});
 expect(created.ok).toBe(true);
 const saved=await readMemo(page,created.id);
 expect(saved.body).toBe(body);
 expect(saved.bodyFormat).toEqual({text:body,runs:[{start:0,end:4,flags:1}]});
 const card=root.locator('.memo-card').filter({hasText:'書式付き手順'});
 await expect(card.locator('strong')).toHaveText('対象😀');
 await expect(card.locator('img')).toHaveCount(0);
 await card.click();
 const reader=root.locator('.memo-document');
 await expect(reader.locator('strong')).toHaveText('対象😀');
 await expect(reader).toContainText('<img src=x onerror=window.memoInjected=1>');
 await expect(reader.locator('img')).toHaveCount(0);
 expect(await page.evaluate(()=>window.memoInjected)).toBeUndefined();

 let next=await writeMemo(page,{type:'memo.update',id:saved.id,revision:saved.revision,body,paperColor:'mint'});
 expect(next.ok).toBe(true);
 const recolored=await readMemo(page,saved.id);
 expect(recolored.bodyFormat).toEqual(saved.bodyFormat);
 expect(recolored.updatedAt).toBe(saved.updatedAt);
 next=await writeMemo(page,{type:'memo.update',id:saved.id,revision:saved.revision,body:'競合する古い本文'});
 expect(next.ok).toBe(false);
 expect((await readMemo(page,saved.id)).bodyFormat).toEqual(saved.bodyFormat);
 next=await writeMemo(page,{type:'memo.update',id:saved.id,revision:recolored.revision,body:'置き換えられた本文'});
 expect(next.ok).toBe(true);
 const plain=await readMemo(page,saved.id);
 expect(plain.body).toBe('置き換えられた本文');
 expect(plain.bodyFormat).toBeFalsy();
 next=await writeMemo(page,{type:'memo.update',id:saved.id,revision:plain.revision,body:'古い書式は適用されない',bodyFormat:saved.bodyFormat});
 expect(next.ok).toBe(true);
 expect((await readMemo(page,saved.id)).bodyFormat).toBeFalsy();
});

test('Origin business memo keeps formatting-only drafts and renders saved marks after reload',async({page,baseURL})=>{
 let root=await launch(page,baseURL,'origin-memo-format-editor',390);
 const created=await writeMemo(page,{type:'memo.create',body:'手順 手順\n次の対応'});
 expect(created.ok).toBe(true);
 const edit=()=>root.locator('[data-action="list-quick-edit"][data-kind="memos"]');
 await edit().click();
 let body=root.locator('#editForm [data-origin-note-editor]');
 await expect(body).toHaveText('手順 手順\n次の対応');
 await selectNoteText(body,3,5);
 const bold=root.getByRole('button',{name:'太字',exact:true});
 await expect(bold).toBeVisible({timeout:2500});
 await bold.click();
 await expect(body.locator('strong')).toHaveText('手順');
 await expect(root.locator('.origin-note-format-preview')).toHaveCount(0);
 await expect(body).toBeFocused();
 const draft=root.locator('#originDraftState');
 await expect(draft).toHaveAttribute('data-unsaved','true');
 const dialog=page.waitForEvent('dialog');
 const close=root.locator('#sheet .sheet-close').click();
 const confirm=await dialog;
 expect(confirm.message()).toContain('破棄');
 await confirm.dismiss();
 await close;
 await expect(body).toHaveText('手順 手順\n次の対応');

 await root.getByRole('button',{name:'変更を保存',exact:true}).click();
 const card=root.locator('.memo-card').filter({hasText:'書式付き手順'});
 await expect(card.locator('strong')).toHaveCount(1);
 expect((await readMemo(page,created.id)).bodyFormat).toEqual({
   text:'手順 手順\n次の対応',runs:[{start:3,end:5,flags:1}]
 });
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
 root=page.locator('#modernOriginRoot');
 await root.locator('#mobileNav [data-route="notes"]').click();
 await card.click();
 const reader=root.locator('.memo-document');
 await expect(reader.locator('strong')).toHaveText('手順');
 await expect(reader).toContainText('次の対応');
});

test('Escape at the IME candidate stage does not close the memo editor',async({page,baseURL})=>{
 const root=await launch(page,baseURL,'origin-memo-format-ime',320);
 expect((await writeMemo(page,{type:'memo.create',body:'編集中の本文'})).ok).toBe(true);
 await root.locator('[data-action="list-quick-edit"][data-kind="memos"]').click();
 const body=root.locator('#editForm [data-origin-note-editor]');
 const accepted=await body.evaluate(el=>{
   el.focus();
   el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,composed:true,data:'編'}));
   const event=new KeyboardEvent('keydown',{key:'Escape',isComposing:true,bubbles:true,cancelable:true,composed:true});
   return el.dispatchEvent(event);
 });
 expect(accepted).toBe(true);
 await expect(body).toBeVisible();
 await body.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,composed:true,data:''})));
 await body.press('Escape');
 await expect(body).toBeHidden();
});

test('Origin direct memo editor keeps native required validation and focuses the visible body',async({page,baseURL})=>{
 const root=await launch(page,baseURL,'origin-memo-direct-validation',320);
 expect((await writeMemo(page,{type:'memo.create',body:'入力済みの内容'})).ok).toBe(true);
 await root.locator('[data-action="list-quick-edit"][data-kind="memos"]').click();
 const body=root.locator('#editForm [data-origin-note-editor]');
 await body.fill('');
 await root.getByRole('button',{name:'変更を保存',exact:true}).click();
 await expect(body).toHaveAttribute('aria-invalid','true');
 await expect(body).toBeFocused();
 await body.fill('新しい内容');
 await expect(body).not.toHaveAttribute('aria-invalid','true');
 await root.getByRole('button',{name:'変更を保存',exact:true}).click();
 await expect(root.locator('.memo-card')).toContainText('新しい内容');
});

test('Origin Japanese italic is visually enabled in the live memo, card and saved reader',async({page,baseURL})=>{
 const root=await launch(page,baseURL,'origin-memo-italic-v673',1366);
 const created=await writeMemo(page,{type:'memo.create',body:'重要な手順 ABC'});
 expect(created.ok).toBe(true);
 await root.locator('[data-action="list-quick-edit"][data-kind="memos"]').click();
 const body=root.locator('#editForm [data-origin-note-editor]');
 await body.click();
 await body.press('Home');
 await body.press('Shift+ArrowRight');
 await body.press('Shift+ArrowRight');
 const italic=root.getByRole('button',{name:'斜体',exact:true});
 await italic.click();
 const mark=body.locator('em');
 await expect(mark).toHaveText('重要');
 await expect(mark).toHaveCSS('font-style','italic');
 // Origin's host disables synthetic glyphs. Japanese fonts often have no
 // actual italic face; the note-specific mark must opt into synthesis.
 await expect(mark).toHaveCSS('font-synthesis-style','auto');
 await expect(italic).toHaveAttribute('aria-pressed','true');
 await root.getByRole('button',{name:'変更を保存',exact:true}).click();
 expect((await readMemo(page,created.id)).bodyFormat).toEqual({text:'重要な手順 ABC',runs:[{start:0,end:2,flags:2}]});
 const card=root.locator('.memo-card').filter({hasText:'書式付き手順'});
 await expect(card.locator('em')).toHaveCSS('font-synthesis-style','auto');
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
 await root.locator('#desktopNav [data-route="notes"]').click();
 await card.click();
 await expect(root.locator('.memo-document em')).toHaveText('重要');
 await expect(root.locator('.memo-document em')).toHaveCSS('font-style','italic');
 await expect(root.locator('.memo-document em')).toHaveCSS('font-synthesis-style','auto');
});
