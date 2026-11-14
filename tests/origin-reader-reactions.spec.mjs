import {test,expect} from '@playwright/test';
const ROOM='origin-reader-reactions',TASK='reader-task',PARENT='reader-comment';
async function boot(page,width=390,mode='local-only'){
 await page.setViewportSize({width,height:900});
 await page.addInitScript(({room,task,parent,mode})=>{
   const now=Date.now();
   const record={id:task,title:'Origin 詳細の読みやすさ',description:'手順を確認し、担当者と対応内容を共有します。\n'.repeat(30),requester:'依頼元',assignee:'福冨',status:'対応中',priority:'高',category:'PC',tags:['引継ぎ'],dueDate:'2027-01-20',dueTime:'16:00',recurrence:'weekly',recurrenceRule:{anchorDate:'2027-01-01',interval:2,weekdays:[1,3],endMode:'count',count:4},checklist:[{id:'check1',text:'実施内容を確認',done:false}],comments:[{id:parent,author:'森井',type:'作業メモ',text:'元の確認コメント',createdAt:now-2000},{id:'reader-reply',author:'福冨',type:'申し送り',text:'[[wb-reply:'+parent+']]返信の本文',createdAt:now-1000}],history:[],revision:1,createdAt:now-5000,updatedAt:now};
   localStorage.setItem('systemTaskUser','福冨');localStorage.setItem('systemTaskRoomId',room);localStorage.setItem('system-task-users:'+room,JSON.stringify(['福冨','森井']));localStorage.setItem('system-task-tasks:'+room,JSON.stringify([record]));
   window.__readerRemote=structuredClone(record);window.__readerConfig=null;window.__readerTransactions=0;window.__readerFail=false;
   Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return window.__readerConfig},set(){}});
   let wrapped;const listeners=[];window.__readerMode=mode;
   Object.defineProperty(window,'WorkBoardPaletteBridge',{configurable:true,get(){return wrapped},set(value){wrapped={...value,readSnapshot:()=>({...value.readSnapshot(),connectionMode:window.__readerMode}),subscribe(listener){listeners.push(listener);return value.subscribe(s=>listener({...s,connectionMode:window.__readerMode}));}};}});
   window.__readerSetMode=next=>{window.__readerMode=next;for(const fn of listeners)fn(wrapped.readSnapshot());};
 },{room:ROOM,task:TASK,parent:PARENT,mode});
 await page.route('**/*',async route=>{
   const url=route.request().url();
   if(new URL(url).origin==='http://127.0.0.1:4173')return route.continue();
   const headers={'access-control-allow-origin':'*','cache-control':'no-store'};
   if(/gstatic.*firebase-app\.js/.test(url))return route.fulfill({contentType:'application/javascript',headers,body:'const apps=[];export const getApps=()=>apps;export const getApp=()=>apps[0];export function initializeApp(config){const app={config};apps.push(app);return app;}'});
   if(/gstatic.*firebase-database\.js/.test(url))return route.fulfill({contentType:'application/javascript',headers,body:`export const getDatabase=()=>({});export const ref=(db,path)=>({db,path});export async function runTransaction(target,update){window.__readerTransactions++;if(window.__readerFail){window.__readerFail=false;throw Error('synthetic-write-failure')}const next=update(structuredClone(window.__readerRemote));if(next===undefined)return {committed:false,snapshot:{val:()=>structuredClone(window.__readerRemote)}};window.__readerRemote=structuredClone(next);return {committed:true,snapshot:{val:()=>structuredClone(next)}};}`});
   return route.abort();
 });
 await page.goto('/?room='+ROOM);await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await root.locator(width>770?'#desktopNav [data-route="tasks"]':'#mobileNav [data-route="tasks"]').click();
 await root.locator('.item-name',{hasText:'Origin 詳細の読みやすさ'}).click();
 return root;
}
for(const width of [320,390,1366])test('Origin reader separates content and reaches comments at '+width+'px',async({page})=>{
 const root=await boot(page,width),sheet=root.locator('#sheet');
 await expect(sheet).toHaveAttribute('data-reader-kind','tasks');await expect(root.locator('#originTaskOverview')).toContainText('2週ごと');
 await expect(root.locator('#originTaskOverview')).toContainText('月・水曜日');
 await root.locator('.origin-reader-nav [data-value="originTaskComments"]').click();
 await expect(root.locator('#originTaskComments h3')).toBeFocused();await expect(root.locator('#originTaskComments h3')).toBeInViewport();
 await expect(root.locator('.origin-comment-list')).not.toContainText('[[wb-reply:');await expect(root.locator('[data-comment-id="reader-reply"] blockquote')).toContainText('森井');
 const metrics=await sheet.evaluate(el=>({width:el.getBoundingClientRect().width,body:el.querySelector('.sheet-body').clientHeight,footer:el.querySelector('.sheet-foot').clientHeight,overflow:document.documentElement.scrollWidth-innerWidth,font:parseFloat(getComputedStyle(el.querySelector('.record-description')).fontSize)}));
 expect(metrics.overflow).toBeLessThanOrEqual(2);expect(metrics.font).toBeGreaterThanOrEqual(15);expect(metrics.body).toBeGreaterThan(400);expect(metrics.footer).toBeLessThan(180);if(width>770)expect(metrics.width).toBe(680);
 await root.locator('#originCommentForm textarea').fill('返信を書く途中');await root.locator('[data-action="comment-reply"][data-value="reader-comment"]').click();await expect(root.locator('#originReplyContext')).toContainText('森井に返信');await root.locator('[data-action="comment-reply-cancel"]').click();await expect(root.locator('#originReplyContext')).toBeHidden();await expect(root.locator('#originCommentForm textarea')).toHaveValue('返信を書く途中');
 await page.screenshot({path:'/tmp/origin-reader-comments-'+width+'.png'});
 await root.locator('.origin-reader-nav [data-value="originTaskOverview"]').click();
 await sheet.screenshot({path:'/tmp/origin-reader-overview-'+width+'.png'});
 if(width===320){
   await root.locator('#originCommentForm textarea').fill('');await root.locator('.sheet-close').click();
   await root.locator('#originSettingsToggle').click();
   await expect(root.locator('#originSettingsPanel')).toBeVisible();
   await root.locator('#themeBtn').click();await root.locator('.item-name',{hasText:'Origin 詳細の読みやすさ'}).click();
   await sheet.screenshot({path:'/tmp/origin-reader-dark-320.png'});
 }
});
test('Origin enables real reaction writes after remote reconnect and keeps the comment draft and focus',async({page})=>{
 const root=await boot(page,390,'remote-degraded'),field=root.locator('#originCommentForm textarea');
 const reaction=root.locator('[data-action="comment-reaction"][data-value="reader-comment"][data-emoji="👍"]');
 await expect(reaction).toBeDisabled();await field.fill('未送信の文章');
 await field.evaluate(el=>{window.__readerInput=el;el.setSelectionRange(2,5)});
 await page.evaluate(()=>{window.__readerConfig={apiKey:'test',databaseURL:'https://example.invalid',projectId:'test-reader'};document.getElementById('connectionPill').textContent='共同編集ON';window.__readerSetMode('remote-online');});
 await expect(reaction).toBeEnabled();expect(await field.evaluate(el=>el===window.__readerInput)).toBe(true);await expect(field).toHaveValue('未送信の文章');
 await reaction.click();await expect(reaction).toHaveAttribute('aria-pressed','true');await expect(reaction).toBeFocused();await expect(field).toHaveValue('未送信の文章');
 expect(await page.evaluate(()=>window.__readerRemote.comments[0].reactions['👍'])).toEqual(['福冨']);
 await reaction.click();await expect(reaction).toHaveAttribute('aria-pressed','false');expect(await page.evaluate(()=>window.__readerRemote.comments[0].reactions['👍'])).toBeUndefined();expect(await page.evaluate(()=>window.__readerTransactions)).toBe(2);
});
test('Origin reaction failure leaves the draft and count intact and permits a successful retry',async({page})=>{
 const root=await boot(page),field=root.locator('#originCommentForm textarea');await field.fill('失敗しても残す文章');
 await page.evaluate(()=>{window.__readerConfig={apiKey:'test',databaseURL:'https://example.invalid',projectId:'test-reader'};document.getElementById('connectionPill').textContent='共同編集ON';window.__readerSetMode('remote-online');window.__readerFail=true;});
 const reaction=root.locator('[data-action="comment-reaction"][data-value="reader-comment"][data-emoji="👍"]');await reaction.click();await expect(root.locator('#originToast')).toBeVisible();await expect(reaction).toHaveAttribute('aria-pressed','false');await expect(field).toHaveValue('失敗しても残す文章');expect(await page.evaluate(()=>window.__readerRemote.revision)).toBe(1);
 await reaction.click();await expect(reaction).toHaveAttribute('aria-pressed','true');expect(await page.evaluate(()=>window.__readerRemote.revision)).toBe(2);await expect(field).toHaveValue('失敗しても残す文章');
});
test('Origin local reactions explain availability and tool cards retain their native routes',async({page})=>{
 const root=await boot(page,320);await expect(root.locator('[data-action="comment-reaction"]').first()).toBeDisabled();await expect(root.locator('.origin-comment-connect')).toContainText('共同編集をON');
 await root.locator('.sheet-close').click();await root.locator('#mobileNav [data-route="tools"]').click();await expect(root.locator('.origin-tool-nav button')).toHaveCount(5);await expect(root.locator('#originInboxButton')).toBeAttached();
 await root.locator('[data-action="tool-tab"][data-value="settings"]').click();await expect(root.locator('.origin-management')).toHaveCount(3);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});

for(const width of [320,390,1366]){
 test('Origin task reader navigates directly to expanded workflow settings at '+width+'px',async({page})=>{
  const root=await boot(page,width),nav=root.locator('.origin-reader-nav');
  const related=nav.locator('[data-action="detail-jump"][data-value="originTaskLinks"]');
  const settings=nav.locator('[data-action="detail-jump"][data-value="originWorkflow"]');
  await expect(related).toContainText('関連予定');
  await expect(settings).toContainText('前提・設定');
  const workflow=root.locator('#originWorkflow'),summary=workflow.locator(':scope > summary');
  await expect(workflow).not.toHaveAttribute('open','');
  await settings.focus();await settings.press('Enter');
  await expect(workflow).toHaveAttribute('open','');
  await expect(summary).toBeFocused();
  const outline=await summary.evaluate(el=>({style:getComputedStyle(el).outlineStyle,width:getComputedStyle(el).outlineWidth}));
  expect(outline.style).not.toBe('none');
  expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
  await expect(summary).toBeInViewport();
  await expect(settings).toHaveAttribute('aria-current','location');
  const widths=await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth}));
  expect(widths.document-widths.viewport).toBeLessThanOrEqual(2);
  await related.click();
  await expect(root.locator('#originTaskLinks h3')).toBeFocused();
  await expect(related).toHaveAttribute('aria-current','location');
 });
}
