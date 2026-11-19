import {test,expect} from '@playwright/test';

// No remote services and no real records. A separate synthetic room per viewport.
async function openOrigin(page,width,slug){
 await page.setViewportSize({width,height:width<500?844:900});
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 const room='origin-view-actions-v608-'+slug+'-'+width;
 await page.addInitScript(id=>{
   Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
   localStorage.setItem('systemTaskRoomId',id);
   localStorage.setItem('systemTaskUser','福冨');
 },room);
 await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await expect(root).toBeVisible();
 return root;
}
const nav=(root,width,route)=>root.locator((width<=770?'#mobileNav':'#desktopNav')+' [data-route="'+route+'"]');
async function size(el){return el.evaluate(node=>({width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height}))}
async function noOverflow(page){return page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)}

for(const width of [320,390,1280]){
 test('Origin '+width+'px keeps each primary create command beside its page title',async({page})=>{
   test.setTimeout(100000);
   const root=await openOrigin(page,width,'header');
   for(const [route,kind,old] of [
     ['tasks','tasks','.origin-task-toolbar [data-action="new"][data-kind="tasks"]'],
     ['calendar','events','.origin-schedule-toolbar [data-action="new"][data-kind="events"]'],
     ['notes','memos','.memo-toolbar [data-action="new"][data-kind="memos"]']
   ]){
     await nav(root,width,route).click();
     const header=root.locator('.page-heading');
     await expect(header).toBeVisible();
     await expect(header.locator('.heading-meta>span')).toHaveCount(1);
     const create=header.locator('.origin-page-primary[data-action="new"][data-kind="'+kind+'"]');
     await expect(create).toHaveCount(1);
     await expect(create).toBeVisible();
     await expect(root.locator(old)).toHaveCount(0);
     const dimensions=await size(create);
     expect(dimensions.height).toBeGreaterThanOrEqual(44);
     expect(dimensions.width).toBeGreaterThanOrEqual(44);
     await create.click();
     await expect(root.locator('#editForm[data-kind="'+kind+'"]')).toBeVisible();
     await root.locator('#sheet .sheet-close').click();
     await expect(root.locator('#editForm')).toHaveCount(0);
   }
   expect(await noOverflow(page)).toBeLessThanOrEqual(3);
 });
}

for(const width of [320,390]){
 test('Origin '+width+'px keeps task and memo filter-reset controls usable by touch',async({page})=>{
   test.setTimeout(90000);
   const root=await openOrigin(page,width,'reset');
   await nav(root,width,'tasks').click();
   await root.locator('#originTaskQuery').fill('該当なしの絞り込み');
   const taskReset=root.locator('.origin-task-summary [data-action="task-reset"]');
   await expect(taskReset).toBeVisible();
   const taskTarget=await size(taskReset);
   expect(taskTarget.height).toBeGreaterThanOrEqual(44);
   expect(taskTarget.width).toBeGreaterThanOrEqual(44);
   await taskReset.click();
   await expect(root.locator('#originTaskQuery')).toHaveValue('');
   await nav(root,width,'notes').click();
   await root.locator('#originMemoQuery').fill('メモの条件なし');
   const memoReset=root.locator('.origin-memo-result-actions [data-action="memo-reset"]');
   await expect(memoReset).toBeVisible();
   const memoTarget=await size(memoReset);
   expect(memoTarget.height).toBeGreaterThanOrEqual(44);
   expect(memoTarget.width).toBeGreaterThanOrEqual(44);
   await memoReset.click();
   await expect(root.locator('#originMemoQuery')).toHaveValue('');
   expect(await noOverflow(page)).toBeLessThanOrEqual(3);
 });
}

for(const width of [320,390]){
 test('Origin '+width+'px Today task title has a 44px touch target and clear focus',async({page})=>{
   test.setTimeout(90000);
   const root=await openOrigin(page,width,'today');
   await page.evaluate(async ()=>{
     const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot(),d=new Date();
     const day=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
     const result=await bridge.dispatch({
       type:'task.create',revision:0,ownerRoom:s.roomId,ownerUser:s.currentUser,
       title:'本日の優先タスク',description:'手順確認',assignee:s.currentUser,
       status:s.statuses.includes('未着手')?'未着手':s.statuses[0],
       category:s.categories[0],priority:'高',tags:'',requester:'',checklist:'',
       checklistDone:[],dueDate:day,dueTime:'',pinned:false
     });
     if(!result?.ok)throw Error('Synthetic task create: '+result?.error);
   });
   await nav(root,width,'today').click();
   const task=root.locator('.focus-item .focus-name',{hasText:'本日の優先タスク'});
   await expect(task).toBeVisible();
   expect((await size(task)).height).toBeGreaterThanOrEqual(44);
   await task.focus();
   const outline=await task.evaluate(e=>getComputedStyle(e).outlineStyle);
   expect(outline).not.toBe('none');
   const quick=root.locator('.origin-today-shortcuts [data-action="new"]');
   await expect(quick).toHaveCount(3);
   for(let i=0;i<3;i++)expect((await size(quick.nth(i))).height).toBeGreaterThanOrEqual(44);
   expect(await noOverflow(page)).toBeLessThanOrEqual(3);
 });
}

test('Origin reduced motion turns off common header action transitions',async({page})=>{
 test.setTimeout(90000);
 await page.emulateMedia({reducedMotion:'reduce'});
 const root=await openOrigin(page,390,'motion');
 await nav(root,390,'calendar').click();
 const c=root.locator('.origin-page-primary');
 await expect(c).toBeVisible();
 expect(await c.evaluate(e=>getComputedStyle(e).transitionDuration.split(',').every(s=>parseFloat(s)===0))).toBe(true);
});
