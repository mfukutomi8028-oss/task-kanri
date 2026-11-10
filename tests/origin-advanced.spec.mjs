import {test,expect} from '@playwright/test';
async function launch(page,width=390){
 await page.setViewportSize({width,height:900});
 await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort());
 await page.addInitScript(()=>{Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});localStorage.setItem('systemTaskUser','福冨');localStorage.setItem('systemTaskRoomId','origin-advanced');});
 await page.goto('/?room=origin-advanced');await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 return page.locator('#modernOriginRoot');
}
async function newTask(root,title){await root.locator('#createBtn').click();await root.locator('#createMenu [data-kind="tasks"]').click();const f=root.locator('#editForm');await f.locator('[name="title"]').fill(title);return f;}
async function tasks(root){await root.locator('#mobileNav [data-route="tasks"]').click();}
test('Origin recurring completion and termination edits preserve the canonical series counter',async({page})=>{
 const root=await launch(page),form=await newTask(root,'定期点検');
 await form.locator('.origin-recurrence summary').click();await form.locator('[name="recurrence"]').selectOption('daily');
 await form.locator('[name="repeatAnchor"]').fill('2027-02-01');await form.locator('[name="repeatCount"]').fill('2');
 await form.locator('[data-action="task-recurrence-preview"]').click();await expect(form.locator('#originRecurrenceReview')).toContainText('2027-02-01');
 await root.locator('[form="editForm"]').click();await expect(form).toHaveCount(0);await tasks(root);
 await root.locator('.item-name',{hasText:'定期点検'}).click();page.once('dialog',d=>d.accept('完了記録'));
 await root.locator('#sheet [data-action="task-done"]').click();
 const before=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks.find(x=>x.title==='定期点検'&&!x.completed));
 expect(before.recurrenceRule.generatedCount).toBe(1);
 await root.locator('.sheet-close').click();await root.locator('.item-name',{hasText:'定期点検'}).click();await root.locator('#sheet [data-action="edit"]').click();
 await root.locator('[name="repeatCount"]').fill('3');await root.locator('[form="editForm"]').click();await expect(root.locator('#editForm')).toHaveCount(0);
 const after=await page.evaluate(id=>window.WorkBoardPaletteBridge.readSnapshot().tasks.find(x=>x.id===id),before.id);
 expect(after.recurrenceRule.generatedCount).toBe(1);expect(after.recurrenceRule.seriesId).toBe(before.recurrenceRule.seriesId);expect(after.recurrenceRule.count).toBe(3);
});
test('Origin reservations validate dates and appear in the reserved list with canonical start metadata',async({page})=>{
 const root=await launch(page,320),form=await newTask(root,'予約作業');
 await form.locator('[name="startDate"]').fill('2027-05-02');await form.locator('[name="due"]').fill('2027-05-01');await root.locator('[form="editForm"]').click();
 await expect(form.locator('#originFieldError')).toContainText('開始日');
 await form.locator('[name="due"]').fill('2027-05-03');await root.locator('[form="editForm"]').click();await expect(form).toHaveCount(0);
 await tasks(root);await expect(root.locator('.item-name',{hasText:'予約作業'})).toHaveCount(0);
 await root.locator('[data-action="task-filter"][data-value="reserved"]').click();await expect(root.locator('.item-name',{hasText:'予約作業'})).toHaveCount(1);
 const start=await page.evaluate(()=>{const t=window.WorkBoardPaletteBridge.readSnapshot().tasks.find(x=>x.title==='予約作業');return window.WorkBoardOriginStartBridge.readSnapshot()[t.id]});
 expect(start.date).toBe('2027-05-02');expect(start.revision).toBe(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
test('Origin templates can be created, applied, edited and deleted without Classic forms',async({page})=>{
 const root=await launch(page);await root.locator('#mobileNav [data-route="tools"]').click();await root.locator('[data-action="template-new"]').click();
 const f=root.locator('#editForm');await f.locator('[name="name"]').fill('定型作業');await f.locator('[name="title"]').fill('定型の件名');await f.locator('[name="description"]').fill('定型の説明');await f.locator('[name="checklist"]').fill('事前確認\n事後確認');
 await root.locator('[form="editForm"]').click();await expect(f).toHaveCount(0);await expect(root.locator('.origin-tool-row',{hasText:'定型作業'})).toBeVisible();
 const templateId=await root.locator('.origin-tool-row',{hasText:'定型作業'}).getAttribute('data-id');
 const task=await newTask(root,'');await task.locator('#originTemplateSelect').selectOption(templateId);await task.locator('[data-action="template-apply"]').click();await expect(task.locator('[name="title"]')).toHaveValue('定型の件名');await expect(task.locator('.origin-checkrow')).toHaveCount(2);
 await root.locator('[form="editForm"]').click();await expect(task).toHaveCount(0);
 await root.locator('#mobileNav [data-route="tasks"]').click();await root.locator('#mobileNav [data-route="tools"]').click();await root.locator('.origin-tool-row',{hasText:'定型作業'}).click();
 await f.locator('[name="name"]').fill('修正した定型');await root.locator('[form="editForm"]').click();await expect(f).toHaveCount(0);await root.locator('.origin-tool-row',{hasText:'修正した定型'}).click();page.once('dialog',d=>d.accept());await root.locator('[data-action="delete"]').click();await expect(f).toHaveCount(0);await expect(root.locator('.origin-tool-row',{hasText:'修正した定型'})).toHaveCount(0);
});

test('Origin replies retain their parent and mentions are inserted into the comment draft',async({page})=>{
 const root=await launch(page),task=await newTask(root,'会話の対象');await root.locator('[form="editForm"]').click();await expect(task).toHaveCount(0);await tasks(root);await root.locator('.item-name').click();
 const form=root.locator('#originCommentForm');await form.locator('[name="text"]').fill('元のコメント');await form.locator('button[type="submit"]').click();await expect(root.locator('.origin-comment-list')).toContainText('元のコメント');
 await root.locator('[data-action="comment-reply"]').click();await form.locator('[name="text"]').fill('返信の本文');await form.locator('button[type="submit"]').click();await expect(root.locator('.origin-comment-list blockquote')).toContainText('への返信');
 const records=await page.evaluate(()=>{const b=window.WorkBoardPaletteBridge,t=b.readSnapshot().tasks[0];return b.readCommentTask(t.id).comments});expect(records).toHaveLength(2);expect(records[1].replyTo).toBe(records[0].id);
 const option=await form.locator('[name="mention"] option').nth(1).getAttribute('value')||await form.locator('[name="mention"] option').nth(1).textContent();await form.locator('[name="mention"]').selectOption(option);await expect(form.locator('[name="text"]')).toHaveValue('@'+option+' ');
 await expect(root.locator('[data-action="comment-reaction"]').first()).toBeDisabled();
});

test('Origin series deletion previews scopes and rejects a changed member before deleting',async({page})=>{
 const root=await launch(page);await root.locator('#createBtn').click();await root.locator('#createMenu [data-kind="events"]').click();const f=root.locator('#editForm');await f.locator('[name="title"]').fill('系列削除');await f.locator('.origin-batch-options summary').click();await f.locator('[name="batchEnabled"]').check();await f.locator('[name="batchMethod"]').selectOption('dates');await f.locator('[name="batchDates"]').fill('2027-07-01,2027-07-03,2027-07-05');await f.locator('[data-action="schedule-preview"]').click();await expect(f.locator('#originBatchReview')).toContainText('3件');await root.locator('[form="editForm"]').click();await expect(f).toHaveCount(0);
 await root.locator('#originSearchInput').fill('系列削除');await root.locator('[data-action="search-open"]').first().click();await root.locator('#sheet [data-action="edit"]').click();await root.locator('#sheet [data-action="delete"]').click();await expect(f.locator('.origin-series-delete')).toContainText('系列全体（3件）');await f.locator('[name="deleteScope"][value="all"]').check();
 await page.evaluate(async selectedId=>{const b=window.WorkBoardPaletteBridge,s=b.readSnapshot(),e=s.schedules.find(x=>x.id!==selectedId);const r=await b.dispatch({type:'schedule.update',id:e.id,revision:e.revision,ownerRoom:s.roomId,ownerUser:s.currentUser,values:{...e,memo:'他端末の更新'}});if(!r.ok)throw Error(r.error)},await f.getAttribute('data-id'));
 await f.locator('[data-action="series-delete-confirm"]').click();await expect(f).toBeVisible();expect(await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().schedules.length)).toBe(3);
 await root.locator('#sheet [data-action="delete"]').click();await f.locator('[name="deleteScope"][value="all"]').check();await f.locator('[data-action="series-delete-confirm"]').click();await expect(f).toHaveCount(0);expect(await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().schedules.length)).toBe(0);
});

test('Origin knowledge, archive and inbox use the canonical linked records and sidecar state',async({page})=>{
 const root=await launch(page),task=await newTask(root,'業務記録');await task.locator('[name="desc"]').fill('障害の背景');await root.locator('[form="editForm"]').click();await expect(task).toHaveCount(0);await tasks(root);await root.locator('.item-name').click();await root.locator('[data-action="task-knowledge"]').click();const form=root.locator('#editForm');await form.locator('[name="action"]').fill('対応と復旧手順');await root.locator('[form="editForm"]').click();await expect(form).toHaveCount(0);
 const saved=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot());expect(saved.knowledge).toHaveLength(1);expect(saved.tasks[0].knowledgeId).toBe(saved.knowledge[0].id);
 await root.locator('#mobileNav [data-route="tools"]').click();await root.locator('[data-action="tool-tab"][data-value="knowledge"]').click();await root.locator('.origin-tool-row').click();await expect(root.locator('#sheet')).toContainText('対応と復旧手順');await root.locator('.sheet-close').click();await tasks(root);await root.locator('.item-name').click();page.once('dialog',d=>d.accept());await root.locator('#sheet [data-action="task-done"]').click();await root.locator('[data-action="task-archive"]').click();await expect(root.locator('#overlay')).toBeHidden();
 await root.locator('#mobileNav [data-route="tools"]').click();await root.locator('[data-action="tool-tab"][data-value="archive"]').click();await expect(root.locator('.origin-tool-row')).toContainText('業務記録');await root.locator('[data-action="archive-restore"]').click();await expect(root.locator('[data-action="archive-restore"]')).toHaveCount(0);
 await page.evaluate(async()=>window.WorkBoardWorkflowV152.writeInboxEvent('福冨','synthetic-notice',{taskId:window.WorkBoardPaletteBridge.readSnapshot().tasks[0].id,type:'mention',title:'確認依頼',body:'検証用のお知らせ',actor:'他利用者',createdAt:Date.now(),readAt:0}));await root.locator('#originInboxButton').click();const inbox=root.locator('#originInboxDialog');await expect(inbox).toBeVisible();await expect(inbox.locator('#originInboxList')).toContainText('検証用のお知らせ');await inbox.locator('[data-action="origin-inbox-read"][data-id="synthetic-notice"]').click();await expect.poll(()=>page.evaluate(()=>Number(window.WorkBoardWorkflowV152.inboxFor()['synthetic-notice']?.readAt||0))).toBeGreaterThan(0);
});

test('Origin board and timeline preserve actions and save the user display preference',async({page})=>{
 const root=await launch(page,320),form=await newTask(root,'表示方法の対象');await root.locator('[form="editForm"]').click();await expect(form).toHaveCount(0);await tasks(root);await root.locator('[data-action="task-layout"][data-value="board"]').click();await expect(root.locator('.origin-task-layout-board .item-name')).toContainText('表示方法の対象');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
 await root.locator('[data-action="task-layout"][data-value="timeline"]').click();await expect(root.locator('.origin-task-layout-timeline .item-name')).toContainText('表示方法の対象');await root.locator('[data-action="task-view-save"]').click();await expect(root.locator('#originToast')).toContainText('保存しました');await page.reload();await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);await tasks(root);await expect(root.locator('.origin-task-layout-timeline')).toBeVisible();
});

test('Origin management uses canonical category rename and keeps protected statuses',async({page})=>{
 const root=await launch(page);await root.locator('#mobileNav [data-route="tools"]').click();await root.locator('[data-action="tool-tab"][data-value="settings"]').click();const categories=root.locator('.origin-management[data-group="categories"]');await categories.locator('[data-management-draft="categories:new"]').fill('独自分類');await categories.locator('[data-operation="add"]').click();await expect(categories.locator('[data-management-name="独自分類"]')).toBeVisible();
 const form=await newTask(root,'分類変更の対象');await form.locator('[name="category"]').selectOption('独自分類');await root.locator('[form="editForm"]').click();await expect(form).toHaveCount(0);await tasks(root);await root.locator('#mobileNav [data-route="tools"]').click();const row=categories.locator('[data-management-name="独自分類"]');await row.locator('input').fill('改称分類');await row.locator('[data-operation="rename"]').click();await expect(categories.locator('[data-management-name="改称分類"]')).toBeVisible();const record=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks.find(x=>x.title==='分類変更の対象'));expect(record.category).toBe('改称分類');
 await expect(root.locator('.origin-management[data-group="statuses"] [data-management-name="完了"] [data-operation="delete"]')).toBeDisabled();
});

test('Origin retries a failed start-date write against the saved task without creating a duplicate',async({page})=>{
 const root=await launch(page),form=await newTask(root,'開始日の再保存');
 await form.locator('[name="startDate"]').fill('2027-05-02');
 await page.evaluate(()=>{
   const original=window.WorkBoardOriginStartBridge;
   let fail=true;
   window.WorkBoardOriginStartBridge={...original,save:command=>{
     if(fail){fail=false;return Promise.resolve({ok:false,error:'offline'})}
     return original.save(command);
   }};
 });
 await root.locator('[form="editForm"]').click();
 await expect(form.locator('#originTaskError')).toContainText('タスク本体は保存しました');
 await expect(form).toHaveAttribute('data-id',/task-/);
 await root.locator('[form="editForm"]').click();await expect(form).toHaveCount(0);
 const result=await page.evaluate(()=>{
   const rows=window.WorkBoardPaletteBridge.readSnapshot().tasks.filter(x=>x.title==='開始日の再保存');
   return {count:rows.length,start:window.WorkBoardOriginStartBridge.readSnapshot()[rows[0]?.id]?.date};
 });
 expect(result).toEqual({count:1,start:'2027-05-02'});
});

test('Origin rejects stale template and management changes and mismatched owners',async({page})=>{
 await launch(page);
 const result=await page.evaluate(async()=>{
   const b=window.WorkBoardPaletteBridge,s=b.readSnapshot(),owner={ownerRoom:s.roomId,ownerUser:s.currentUser};
   const before=JSON.stringify(s.management.categories);
   const stale=await b.dispatch({type:'management.write',group:'categories',action:'add',name:'競合からの分類',base:'[]',...owner});
   const wrongOwner=await b.dispatch({type:'template.save',revision:s.templateRevision,values:{name:'他利用者',title:'登録不可'},...owner,ownerUser:'別の利用者'});
   const staleTemplate=await b.dispatch({type:'template.save',revision:s.templateRevision+1,values:{name:'古い編集',title:'登録不可'},...owner});
   return {stale,wrongOwner,staleTemplate,unchanged:before===JSON.stringify(b.readSnapshot().management.categories)};
 });
 expect(result.stale.error).toBe('revision-or-relation-mismatch');
 expect(result.wrongOwner.error).toBe('owner-mismatch');
 expect(result.staleTemplate.error).toBe('revision-or-relation-mismatch');expect(result.unchanged).toBe(true);
});
