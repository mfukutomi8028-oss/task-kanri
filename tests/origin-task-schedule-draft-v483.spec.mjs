import {test, expect} from '@playwright/test';

test('Origin creates a linked schedule from a task and restores inspector after cancel and save',async({page})=>{
 test.setTimeout(90000);
 await page.setViewportSize({width:390,height:740});
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 await page.addInitScript(()=>{
   Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
   // Use an existing member of the isolated test room, as in the real UI.
    localStorage.setItem('systemTaskUser','福冨');
   localStorage.setItem('systemTaskRoomId','origin-task-schedule-draft-v483-room');
 });
 await page.goto('/?room=origin-task-schedule-draft-v483-room',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const host=page.locator('#modernOriginRoot'),sheet=host.locator('#sheet');
 const created=await page.evaluate(async()=>{
   const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
   const title='起点タスク：設備点検';
   const result=await bridge.dispatch({
     type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,
     assignee:s.currentUser,revision:0,status:s.statuses[0],
     category:s.categories[0],title,description:'予定を作成するための説明。'.repeat(80),
     requester:'',tags:'',checklist:'',checklistDone:[],priority:'中',
     dueDate:'',dueTime:'',pinned:false
   });
   if(!result?.ok)throw Error('task.create: '+result?.error);
   const task=bridge.readSnapshot().tasks.find(t=>t.title===title);
   if(!task)throw Error('missing task');
   return {id:task.id,title:task.title,revision:task.revision,user:s.currentUser};
 });
 await host.locator('#mobileNav [data-route="tasks"]').click();
 const original=host.locator('.origin-task-collection .item-name[data-kind="tasks"][data-id="'+created.id+'"]');
 await original.click();
 await expect(sheet.locator('#panelHeading')).toHaveText(created.title);
 const createButton=sheet.locator('[data-action="task-schedule-new"]');
 await expect(createButton).toBeVisible();
 await expect(sheet.locator('.origin-task-related-section')).toContainText('0件');
 await createButton.click();
 const form=host.locator('#editForm[data-kind="events"]');
 await expect(form).toBeVisible();
 await expect(form.locator('[name="title"]')).toHaveValue(created.title);
 await expect(form.locator('[name="relatedTaskId"]')).toHaveValue(created.id);
 await expect(form.locator('[name="assignee"]')).toHaveValue(created.user);
 await expect(sheet.locator('.origin-schedule-intro')).toContainText('日時は仮入力');
 await form.locator('[name="title"]').fill('保存前にキャンセル');
 page.once('dialog',dialog=>dialog.accept());
 await sheet.locator('[data-action="close"]').last().click();
 await expect(sheet.locator('#panelHeading')).toHaveText(created.title);
 await expect(sheet.locator('.origin-task-related-section')).toContainText('0件');
 await sheet.locator('[data-action="task-schedule-new"]').click();
 await expect(form.locator('[name="relatedTaskId"]')).toHaveValue(created.id);
 await form.locator('[name="title"]').fill('設備点検の打ち合わせ');
 const date=(await form.locator('[name="startAt"]').inputValue()).slice(0,10);
 await form.locator('[name="startAt"]').fill(date+'T10:00');
 await host.locator('[data-action="schedule-duration"][data-minutes="60"]').click();
 await expect(form.locator('[name="endAt"]')).toHaveValue(date+'T11:00');
 await host.locator('button[form="editForm"]').click();
 await expect(form).toHaveCount(0);
 await expect(sheet.locator('#panelHeading')).toHaveText(created.title);
 const linked=sheet.locator('.origin-task-related-section [data-action="related-open"][data-kind="events"]');
 await expect(linked).toHaveCount(1);
 await expect(linked).toContainText('設備点検の打ち合わせ');
 await expect(linked).toBeFocused();
 await linked.click();
 await expect(sheet.locator('#panelHeading')).toHaveText('設備点検の打ち合わせ');
 await expect(sheet.locator('[data-action="related-open"][data-kind="tasks"]')).toHaveCount(1);
 await sheet.locator('[data-action="related-back"]').click();
 await expect(sheet.locator('#panelHeading')).toHaveText(created.title);
 await sheet.locator('.sheet-close').click();
 await expect(original).toBeFocused();
 const state=await page.evaluate(({id})=>{
   const s=window.WorkBoardPaletteBridge.readSnapshot();
   return {taskRevision:s.tasks.find(t=>t.id===id)?.revision,
     events:s.schedules.filter(x=>x.relatedTaskId===id).map(x=>x.title)};
 },created);
 expect(state.taskRevision).toBe(created.revision);
 expect(state.events).toEqual(['設備点検の打ち合わせ']);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(393);
});
