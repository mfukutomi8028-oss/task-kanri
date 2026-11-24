import {selectNoteText} from './helpers/origin-note-editing.mjs';
import {test,expect} from '@playwright/test';

test.use({locale:'ja-JP',serviceWorkers:'block'});
async function openStickyBoard(page,width){
 await page.setViewportSize({width,height:width===320?740:900});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await root.locator((width<=770?'#mobileNav':'#desktopNav')+' [data-route="notes"]').click();
 if(width<=770)await root.locator('[data-memo-header-mode="personal"]').click();
 else {
  await root.locator('#desktopNav .origin-memo-nav').hover();
  await root.locator('#desktopNav [data-memo-nav-mode="personal"]').click();
 }
 await expect(root.locator('.sticky-add')).toBeEnabled();
 return root;
}
const readContent=page=>page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes[0]?.content);

for(const width of [320,1366]){
 test('Origin sticky formatting survives expansion, board edits and reload at '+width+'px',async({page,baseURL})=>{
  const room='sticky-format-v671-'+width;
  await page.route('**/*',route=>new URL(route.request().url()).origin===baseURL?route.continue():route.abort());
  await page.addInitScript(room=>{
   Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
   localStorage.setItem('systemTaskUser','福冨');
   localStorage.setItem('systemTaskRoomId',room);
  },room);
  await page.goto('/?room='+room);
  const root=await openStickyBoard(page,width);
  await root.locator('.sticky-add').click();
  const card=root.locator('.sticky-origin-card'),boardText=card.getByRole('textbox',{name:'付箋本文',exact:true});
  await boardText.fill('重要事項\n当日の連絡');
  let text='重要事項\n当日の連絡';
  await expect.poll(()=>readContent(page)).toMatchObject({text});
  const initial=await readContent(page);
  expect(initial).not.toHaveProperty('format');
  await card.locator('[data-sticky-expand]').click();
  const dialog=root.getByRole('dialog',{name:'付箋の拡大編集'});
  const editor=dialog.getByRole('textbox',{name:'付箋本文を大きく編集'});
  const bold=dialog.getByRole('button',{name:/太字/});
  await selectNoteText(editor,0,4);
  await expect(bold).toBeVisible({timeout:3000});
  await bold.click();
  await expect.poll(()=>readContent(page)).toMatchObject({text,revision:initial.revision+1,format:{revision:initial.revision+1}});
  expect((await readContent(page)).format).not.toHaveProperty('text');
  await expect(dialog).toBeVisible();
  if(width===1366){
   // A sync while the toolbar has keyboard focus cannot tear down the editor.
   await bold.focus();
   await page.evaluate(async()=>{
    const store=window.WorkBoardPersonalStickyStoreV659;
    const {ownerUid,ownerRoom,notes:[note]}=store.readSnapshot();
    const result=await store.dispatch({type:'sticky.appearance',ownerUid,ownerRoom,id:note.id,
     expectedRevision:note.appearance.revision,values:{color:'mint'}});
    if(!result.ok)throw Error('synthetic sticky appearance update: '+result.error);
   });
   await expect(bold).toBeFocused();
   // Drive native event shape without depending on a Japanese OS input method.
   await selectNoteText(editor,text.length);
   await editor.evaluate(node=>{
    node.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
    node.append(document.createTextNode('（確認中）'));
    node.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,inputType:'insertCompositionText'}));
   });
   await page.waitForTimeout(800);
   expect(await readContent(page)).toMatchObject({text,revision:initial.revision+1});
   await editor.evaluate(node=>{
    node.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'（確認中）'}));
    node.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));
   });
   text+='（確認中）';
   await expect.poll(()=>readContent(page)).toMatchObject({text,revision:initial.revision+2,format:{revision:initial.revision+2}});
  }
  await dialog.getByRole('button',{name:'拡大編集を閉じる'}).click();
  await expect(dialog).toBeHidden();
  await expect(card.locator('[data-sticky-expand]')).toBeFocused();
  await expect(card.locator('[data-sticky-format-preview]')).toHaveCount(0);
  await expect(boardText).toHaveText(text);
  const formattedText=boardText.locator('strong');
  await expect(formattedText).toBeVisible();
  expect(await formattedText.evaluate(e=>parseInt(getComputedStyle(e).fontWeight,10))).toBeGreaterThanOrEqual(600);
  await selectNoteText(boardText,0);
  await page.keyboard.insertText('確認：');
  await expect(boardText.locator('strong')).toHaveText('重要事項');
  await expect(boardText).toBeFocused();
  text='確認：'+text;
  await expect.poll(()=>readContent(page)).toMatchObject({text,format:{runs:[{start:3,end:7,flags:1}]}});

  await page.reload();
  const reopened=await openStickyBoard(page,width);
  const reopenedCard=reopened.locator('.sticky-origin-card');
  await expect(reopenedCard.getByRole('textbox',{name:'付箋本文',exact:true})).toHaveText(text);
  const reopenedMark=reopenedCard.locator('[data-sticky-text] strong');
  await expect(reopenedMark).toBeVisible();
  expect(await reopenedMark.evaluate(e=>parseInt(getComputedStyle(e).fontWeight,10))).toBeGreaterThanOrEqual(600);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  const replacement=reopenedCard.getByRole('textbox',{name:'付箋本文',exact:true});
  await selectNoteText(replacement,3,7);
  await page.keyboard.insertText('更新済み');
  await expect.poll(()=>readContent(page)).toMatchObject({text:text.replace('重要事項','更新済み')});
  expect(await readContent(page)).not.toHaveProperty('format');
 });
}

test('Origin does not write a stale sticky editor over text changed during toolbar focus',async({page,baseURL})=>{
 const room='sticky-format-v671-conflict';
 await page.route('**/*',route=>new URL(route.request().url()).origin===baseURL?route.continue():route.abort());
 await page.addInitScript(room=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskUser','福冨');
  localStorage.setItem('systemTaskRoomId',room);
 },room);
 await page.goto('/?room='+room);
 const root=await openStickyBoard(page,1366);
 await root.locator('.sticky-add').click();
 const card=root.locator('.sticky-origin-card');
 await card.getByRole('textbox',{name:'付箋本文',exact:true}).fill('変更前の本文');
 await expect.poll(()=>readContent(page)).toMatchObject({text:'変更前の本文'});
 await card.locator('[data-sticky-expand]').click();
 const dialog=root.getByRole('dialog',{name:'付箋の拡大編集'});
 const editor=dialog.getByRole('textbox',{name:'付箋本文を大きく編集'});
 await selectNoteText(editor,0,3);
 const bold=dialog.getByRole('button',{name:'太字',exact:true});
 await bold.focus();
 await page.evaluate(async()=>{
  const store=window.WorkBoardPersonalStickyStoreV659;
  const {ownerUid,ownerRoom,notes:[note]}=store.readSnapshot();
  const result=await store.dispatch({type:'sticky.content',ownerUid,ownerRoom,id:note.id,
   expectedRevision:note.content.revision,values:{text:'別の端末で更新した本文'}});
  if(!result.ok)throw Error('synthetic competing sticky edit: '+result.error);
 });
 await expect(bold).toBeFocused();
 const remote=await readContent(page);
 await bold.click();
 await expect(dialog.locator('.sticky-origin-editor-footer [data-sticky-status]')).toContainText('競合',{timeout:2500});
 expect(await readContent(page)).toEqual(remote);
 await expect(editor).toHaveText('変更前の本文');
});

test('Origin displays old sticky text but suppresses marks carried through an older edit round trip',async({page,baseURL})=>{
 const room='sticky-format-v671-older';
 await page.route('**/*',route=>new URL(route.request().url()).origin===baseURL?route.continue():route.abort());
 await page.addInitScript(room=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskUser','福冨');
  localStorage.setItem('systemTaskRoomId',room);
 },room);
 await page.goto('/?room='+room);
 const root=await openStickyBoard(page,1366);
 await root.locator('.sticky-add').click();
 await expect(root.locator('.sticky-origin-card')).toBeVisible();
 await page.evaluate(()=>{
  const {ownerRoom,ownerUid,notes:[note]}=window.WorkBoardPersonalStickyStoreV659.readSnapshot();
  const text='以前の一意な本文';
  const format={text,revision:1,runs:[{start:0,end:2,flags:1}]}; // explicit legacy raw fixture
  const legacy=(content,next)=>({...content,text:next,revision:content.revision+1});
  note.content=legacy(legacy({...note.content,text,format},'途中の本文'),text);
  localStorage.setItem('system-task-sticky-v659:'+ownerRoom+':'+ownerUid,JSON.stringify({[note.id]:note}));
 });
 await page.reload();
 const reopened=await openStickyBoard(page,1366);
 const card=reopened.locator('.sticky-origin-card');
 await expect(card.getByRole('textbox',{name:'付箋本文',exact:true})).toHaveText('以前の一意な本文');
 await expect(card.locator('[data-sticky-text] strong')).toHaveCount(0);
 await expect(card.locator('[data-sticky-format-preview]')).toHaveCount(0);
});

test('Origin long formatted sticky cards scroll their visible text and still open direct editing',async({page,baseURL})=>{
 const room='sticky-format-v671-scroll';
 await page.route('**/*',route=>new URL(route.request().url()).origin===baseURL?route.continue():route.abort());
 await page.addInitScript(room=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskUser','福冨');
  localStorage.setItem('systemTaskRoomId',room);
 },room);
 await page.goto('/?room='+room);
 const root=await openStickyBoard(page,1366);
 await root.locator('.sticky-add').click();
 await expect(root.locator('.sticky-origin-card')).toBeVisible();
 await root.getByRole('searchbox',{name:'個人付箋を検索'}).focus();
 await page.evaluate(async()=>{
  const store=window.WorkBoardPersonalStickyStoreV659;
  const {ownerRoom,ownerUid,notes:[note]}=store.readSnapshot();
  const text=Array.from({length:25},(_,i)=>'確認項目 '+(i+1)).join('\n');
  const result=await store.dispatch({type:'sticky.content',ownerRoom,ownerUid,id:note.id,
   expectedRevision:note.content.revision,values:{text,format:{text,runs:[{start:0,end:text.length,flags:1}]}}});
  if(!result.ok)throw Error('synthetic long sticky: '+result.error);
 });
 const card=root.locator('.sticky-origin-card');
 const editor=card.getByRole('textbox',{name:'付箋本文',exact:true});
 await expect(editor.locator('strong')).toBeVisible();
 const box=await editor.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.wheel(0,250);
 await expect.poll(()=>editor.evaluate(node=>node.scrollTop),{timeout:2500}).toBeGreaterThan(0);
 await editor.click();
 await expect(editor).toBeFocused();
 await expect(editor.locator('strong')).toBeVisible();
});

test('Origin sticky transfers the card selection to the complete live formatting toolbar',async({page,baseURL})=>{
 const room='sticky-format-v672-colors';
 await page.route('**/*',route=>new URL(route.request().url()).origin===baseURL?route.continue():route.abort());
 await page.addInitScript(room=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskUser','OriginStickyQA');
  localStorage.setItem('systemTaskRoomId',room);
 },room);
 await page.goto('/?room='+room);
 const root=await openStickyBoard(page,390);
 await root.locator('.sticky-add').click();
 const card=root.locator('.sticky-origin-card'),body=card.getByRole('textbox',{name:'付箋本文',exact:true});
 await body.fill('重要な手順');
 await expect.poll(()=>readContent(page)).toMatchObject({text:'重要な手順'});
 await selectNoteText(body,0,2);
 await card.locator('[data-sticky-expand]').click();
 const dialog=root.getByRole('dialog',{name:'付箋の拡大編集'});
 const editor=dialog.getByRole('textbox',{name:'付箋本文を大きく編集'});
 await dialog.getByRole('button',{name:'太字',exact:true}).click();
 await dialog.getByRole('button',{name:'斜体',exact:true}).click();
 await dialog.getByRole('button',{name:'下線',exact:true}).click();
 await dialog.getByRole('button',{name:'取り消し線',exact:true}).click();
 await dialog.getByRole('combobox',{name:'文字色'}).selectOption('red');
 await dialog.getByRole('combobox',{name:'文字サイズ'}).selectOption('large');
 await expect(editor.locator('[data-note-format-color=red][data-note-format-size=large] s u em strong')).toHaveText('重要');
 await expect(dialog.locator('.origin-note-format-preview')).toHaveCount(0);
 await expect.poll(()=>readContent(page)).toMatchObject({format:{runs:[{start:0,end:2,flags:15,color:'red',size:'large'}]}});
 await dialog.getByRole('button',{name:'拡大編集を閉じる'}).click();
 await expect(body.locator('[data-note-format-color=red][data-note-format-size=large]')).toHaveText('重要');
 await body.focus();
 await expect(body.locator('strong')).toHaveText('重要');
});
