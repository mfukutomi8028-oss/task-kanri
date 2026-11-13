import {test,expect} from '@playwright/test';

async function openOrigin(page,width=1366){
 await page.setViewportSize({width,height:900});
 await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort());
 await page.addInitScript(()=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskUser','福冨');
  localStorage.setItem('systemTaskRoomId','origin-feature-parity');
 });
 await page.goto('/?room=origin-feature-parity');
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 return page.locator('#modernOriginRoot');
}
async function createPanel(root,kind){
 await root.locator('#createBtn').click();
 await root.locator(`#createMenu [data-kind="${kind}"]`).click();
 return root.locator('#editForm');
}
for(const width of [320,390,1366])test(`Origin batch previews, invalidates review and persists dates at ${width}px`,async({page})=>{
 const root=await openOrigin(page,width),form=await createPanel(root,'events');
 await form.locator('[name="title"]').fill('複数日登録');
 await form.locator('.origin-batch-options summary').click();
 await form.locator('[name="batchEnabled"]').check();
 await form.locator('[name="batchMethod"]').selectOption('dates');
 await form.locator('[name="batchDates"]').fill('2027-03-02\n2027-03-04');
 await root.locator('[form="editForm"]').click();
 await expect(form.locator('#originScheduleError')).toContainText('作成日を確認');
 await form.locator('[data-action="schedule-preview"]').click();
 await expect(form.locator('#originBatchReview')).toContainText('2件の作成日');
 await form.locator('[name="title"]').fill('確定した複数日登録');
 await expect(form.locator('#originBatchReview')).not.toContainText('2件の作成日');
 await form.locator('[data-action="schedule-preview"]').click();
 await expect(form.locator('#originBatchReview')).toContainText('2件の作成日');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await root.locator('[form="editForm"]').click();
 await expect(form).toHaveCount(0);
 const records=await page.evaluate(()=>window.WorkBoardSharedBridge.readSnapshot().schedules.filter(x=>x.title==='確定した複数日登録'));
 expect(records.map(x=>x.startAt.slice(0,10)).sort()).toEqual(['2027-03-02','2027-03-04']);
 await expect(page.locator('html')).toHaveAttribute('data-wb-display','modern');
});

test('Origin comments use canonical data, reject stale writes, and protect drafts',async({page})=>{
 const root=await openOrigin(page),form=await createPanel(root,'tasks');
 await form.locator('[name="title"]').fill('コメント対象');
 await root.locator('[form="editForm"]').click();
 await root.locator('#desktopNav [data-route="tasks"]').click();
 await root.locator('.item-name',{hasText:'コメント対象'}).click();
 const comment=root.locator('#originCommentForm');
 await comment.locator('[name="text"]').fill('申し送りを保持');
 page.once('dialog',d=>d.dismiss());
 await root.locator('#sheet .sheet-close').click();
 await expect(comment.locator('[name="text"]')).toHaveValue('申し送りを保持');
 await comment.locator('[name="commentType"]').selectOption('申し送り');
 await comment.locator('button').click();
 await expect(root.locator('.origin-comment-list')).toContainText('申し送りを保持');
 await expect(comment.locator('[name="text"]')).toHaveValue('');
 const stored=await page.evaluate(()=>{const b=window.WorkBoardSharedBridge,s=b.readSnapshot(),t=s.tasks.find(x=>x.title==='コメント対象');return b.readCommentTask(t.id).comments});
 expect(stored).toHaveLength(1);expect(stored[0].type).toBe('申し送り');
 await comment.locator('[name="text"]').fill('競合後の入力');
 await comment.evaluate(el=>el.dataset.revision='0');
 await comment.locator('button').click();
 await expect(comment.locator('[role="alert"]')).toBeVisible();
 await expect(comment.locator('[name="text"]')).toHaveValue('競合後の入力');
});

test('Origin duplicates a schedule with unsaved edits and saves memo tags',async({page})=>{
 const root=await openOrigin(page),form=await createPanel(root,'events');
 await form.locator('[name="title"]').fill('複製元');
 await root.locator('[form="editForm"]').click();
 await root.locator('#originSearchInput').fill('複製元');
 await root.locator('[data-action="search-open"]').click();
 await root.locator('[data-action="schedule-copy"]').click();
 await expect(root.locator('#editForm [name="title"]')).toHaveValue('複製元');
 await root.locator('#editForm [name="title"]').fill('複製先');
 page.on('dialog',d=>d.accept());
 await root.locator('[form="editForm"]').click();
 await expect(root.locator('#editForm')).toHaveCount(0);
 const titles=await page.evaluate(()=>window.WorkBoardSharedBridge.readSnapshot().schedules.map(x=>x.title));
 expect(titles).toContain('複製元');expect(titles).toContain('複製先');
 const memo=await createPanel(root,'memos');
 await memo.locator('[name="title"]').fill('タグ付きメモ');
 await memo.locator('[name="body"]').fill('メモ本文');
 await memo.locator('[name="tags"]').fill('運用, 引継ぎ');
 await root.locator('[form="editForm"]').click();
 await expect(root.locator('#editForm')).toHaveCount(0);
 const tags=await page.evaluate(()=>window.WorkBoardSharedMemoBridge.readSnapshot().find(x=>x.title==='タグ付きメモ').tags);
 expect(tags).toEqual(['運用','引継ぎ']);
});

test('Origin prerequisites, relations and reminders share Classic workflow data at 390px',async({page})=>{
 const root=await openOrigin(page,390);
 for(const title of ['先行作業','後続作業']){
  const form=await createPanel(root,'tasks');await form.locator('[name="title"]').fill(title);
  await root.locator('[form="editForm"]').click();await expect(form).toHaveCount(0);
 }
 const ids=await page.evaluate(()=>Object.fromEntries(window.WorkBoardSharedBridge.readSnapshot().tasks.map(t=>[t.title,t.id])));
 await root.locator('#mobileNav [data-route="tasks"]').click();
 await root.locator('.item-name',{hasText:'後続作業'}).click();
 await root.locator('#originWorkflow>summary').click();
 const deps=root.locator('[data-origin-workflow-kind="dependencies"]');
 await deps.locator('select').selectOption(ids['先行作業']);
 await deps.locator('[data-action="workflow-add"]').click();
 await expect(deps.locator('li')).toContainText('先行作業');
 await root.locator('#sheet [data-action="task-done"]').click();
 await expect(root.locator('#originToast')).toContainText('未完了の前提タスク');
 const relations=root.locator('[data-origin-workflow-kind="relations"]');
 await relations.locator('select').selectOption(ids['先行作業']);
 await relations.locator('[data-action="workflow-add"]').click();
 await expect(relations.locator('li')).toContainText('先行作業');
 const reminder=root.locator('[data-origin-workflow-kind="reminder"]');
 await reminder.locator('[name="reminderAt"]').fill('2027-06-02T09:00');
 await reminder.locator('[name="reminderNote"]').fill('回答を再確認');
 await reminder.locator('[data-action="workflow-reminder"]').click();
 await expect(reminder.locator('[data-action="workflow-reminder-clear"]')).toBeVisible();
 const shared=await page.evaluate(id=>{const w=window.WorkBoardWorkflowV152;return {deps:w.depIds(id),relations:w.relationIds(id),reminder:w.reminderFor(id)}},ids['後続作業']);
 expect(shared.deps).toEqual([ids['先行作業']]);expect(shared.relations).toEqual([ids['先行作業']]);expect(shared.reminder.note).toBe('回答を再確認');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await reminder.locator('[name="reminderNote"]').fill('未保存の設定');
 page.once('dialog',d=>d.dismiss());await root.locator('.sheet-close').click();
 await expect(reminder.locator('[name="reminderNote"]')).toHaveValue('未保存の設定');
});

test('Origin favorites and ToDo ordering use the existing canonical operations',async({page})=>{
 const root=await openOrigin(page),form=await createPanel(root,'tasks');
 await form.locator('[name="title"]').fill('お気に入り対象');await root.locator('[form="editForm"]').click();
 await root.locator('#desktopNav [data-route="tasks"]').click();
 await root.locator('.item-name',{hasText:'お気に入り対象'}).click();
 await root.locator('[data-action="task-star"]').click();
 await expect(root.locator('[data-action="task-star"]')).toHaveAttribute('aria-pressed','true');
 await root.locator('[data-action="task-copy"]').click();
 await expect(root.locator('#overlay')).toBeHidden();
 const copied=await page.evaluate(()=>window.WorkBoardSharedBridge.readSnapshot().tasks.find(t=>t.title==='コピー：お気に入り対象'));
 expect(copied).toBeTruthy();expect(copied.revision).toBe(1);expect(copied.completed).toBe(false);
 await root.locator('[data-action="task-filter"][data-value="starred"]').click();
 await expect(root.locator('.item-name')).toHaveCount(1);
 await root.locator('#desktopNav [data-route="todos"]').click();
 for(const title of ['ToDo A','ToDo B']){
  await root.locator('[data-form="quick-todo"] [name="title"]').fill(title);
  await root.locator('[data-form="quick-todo"] button').click();
  await expect(root.locator('#workspace')).toContainText(title);
 }
 await root.locator('.todo-text',{hasText:'ToDo B'}).click();
 await root.locator('[data-action="todo-move"][data-value="down"]').click();
 await expect(root.locator('[data-action="todo-move"][data-value="down"]')).toBeDisabled();
 const titles=await page.evaluate(()=>window.WorkBoardSharedBridge.readSnapshot().todos.filter(t=>!t.completed).map(t=>t.text));
 expect(titles.slice(-2)).toEqual(['ToDo A','ToDo B']);
});
