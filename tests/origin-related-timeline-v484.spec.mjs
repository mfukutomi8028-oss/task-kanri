import {test, expect} from '@playwright/test';

test('Origin orders upcoming and past linked schedules and restores expanded history', async ({page}) => {
 test.setTimeout(90000);
 await page.setViewportSize({width:390,height:844});
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 await page.addInitScript(()=>{
   Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
   localStorage.setItem('systemTaskUser','OriginTimelineTester');
   localStorage.setItem('systemTaskRoomId','origin-timeline-v484-room');
 });
 await page.goto('/?room=origin-timeline-v484-room',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const host=page.locator('#modernOriginRoot'),sheet=host.locator('#sheet');
 const created=await page.evaluate(async()=>{
   const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
   const task=await bridge.dispatch({
     type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,assignee:s.currentUser,revision:0,
     status:s.statuses[0],category:s.categories[0],title:'関連予定を並べるタスク',description:'',
     requester:'',tags:'',checklist:'',checklistDone:[],priority:'中',dueDate:'',dueTime:'',pinned:false
   });
   if(!task?.ok)throw Error('task.create '+task?.error);
   const id=bridge.readSnapshot().tasks.find(t=>t.title==='関連予定を並べるタスク')?.id;
   if(!id)throw Error('task missing');
   const examples=[['今後・遅い予定',3],['過去・古い予定',-5],['今後・近い予定',1],['過去・新しい予定',-2]];
   for(const [title,offset] of examples){
     const start=new Date(Date.now()+offset*86400000);start.setHours(10,0,0,0);
     const end=new Date(start.getTime()+3600000);
     const result=await bridge.dispatch({
       type:'schedule.create',revision:0,ownerRoom:s.roomId,ownerUser:s.currentUser,
       values:{title,startAt:start.toISOString(),endAt:end.toISOString(),assignee:s.currentUser,
         category:s.categories[0],relatedTaskId:id,location:'',memo:''}
     });
     if(!result?.ok)throw Error('schedule.create '+title+': '+result?.error);
   }
   return {id,revision:bridge.readSnapshot().tasks.find(t=>t.id===id)?.revision};
 });
 await host.locator('#mobileNav [data-route="tasks"]').click();
 await host.locator('.origin-task-collection .item-name[data-kind="tasks"][data-id="'+created.id+'"]').click();
 await expect(sheet.locator('.origin-task-related-section')).toContainText('4件');
 const futures=sheet.locator('.origin-related-future-group [data-action="related-open"]');
 await expect(futures).toHaveCount(2);
 expect(await futures.allTextContents()).toEqual([
   expect.stringContaining('今後・近い予定'),expect.stringContaining('今後・遅い予定')
 ]);
 const past=sheet.locator('.origin-related-past');
 await expect(past).toHaveCount(1);
 await expect(past).not.toHaveAttribute('open');
 await past.locator('summary').click();
 await expect(past).toHaveAttribute('open');
 const history=sheet.locator('.origin-related-history-group [data-action="related-open"]');
 await expect(history).toHaveCount(2);
 expect(await history.allTextContents()).toEqual([
   expect.stringContaining('過去・新しい予定'),expect.stringContaining('過去・古い予定')
 ]);
 await history.first().click();
 await expect(sheet.locator('#panelHeading')).toHaveText('過去・新しい予定');
 await sheet.locator('[data-action="related-back"]').click();
 await expect(sheet.locator('#panelHeading')).toHaveText('関連予定を並べるタスク');
 await expect(sheet.locator('.origin-related-past')).toHaveAttribute('open');
 await sheet.locator('.sheet-close').click();
 expect(await page.evaluate(id=>{
   const s=window.WorkBoardPaletteBridge.readSnapshot();
   return {revision:s.tasks.find(t=>t.id===id)?.revision,
     eventCount:s.schedules.filter(t=>t.relatedTaskId===id).length};
 },created.id)).toEqual({revision:created.revision,eventCount:4});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(393);
});
