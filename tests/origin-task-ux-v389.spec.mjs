import {test,expect} from '@playwright/test';
async function boot(page,room,user,width=390){
 await page.setViewportSize({width,height:844});
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.continue():route.abort('blockedbyclient'));
 await page.addInitScript(({room,user})=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskUser',user);localStorage.setItem('systemTaskRoomId',room);
 },{room,user});
 await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await expect(root).toBeVisible();
 await root.locator(width<=770?'#mobileNav [data-route="tasks"]':'#desktopNav [data-route="tasks"]').click();
 return root;
}
test('Origin mobile task checklist supports create, remove, toggle and date time editing',async({page})=>{
 test.setTimeout(90000);
 const root=await boot(page,'origin-task-v389-smoke','OriginMobileV389');
 await root.locator('[data-action="new"][data-kind="tasks"]').first().click();
 const form=root.locator('#editForm[data-kind="tasks"]');
 await form.locator('[name="title"]').fill('モバイル操作検証タスク');
 await root.locator('[data-action="task-check-add"]').click();
 await root.locator('.origin-checkrow [name="checkText"]').fill('チェックの確認');
 await root.locator('[data-action="task-check-add"]').click();
 await root.locator('.origin-checkrow [data-action="task-check-remove"]').last().click();
 await expect(root.locator('.origin-checkrow')).toHaveCount(1);
 await root.locator('button[form="editForm"]').click();
 await expect(form).toHaveCount(0);
 await root.locator('#workspace .item-name',{hasText:'モバイル操作検証タスク'}).click();
 await expect(root.locator('.origin-task-check')).toHaveCount(1);
 await root.locator('.origin-task-check input').check();
 await expect(root.locator('.origin-progress-head')).toContainText('100%');
 await root.locator('.origin-task-check input').uncheck();
 await expect(root.locator('.origin-progress-head')).toContainText('0%');
 await root.locator('#sheet [data-action="edit"][data-kind="tasks"]').click();
 await expect(form.locator('[name="due"]')).not.toHaveAttribute('required');
 await form.locator('[name="due"]').fill('2027-01-12');
 await form.locator('[name="dueTime"]').fill('16:30');
 await root.locator('.origin-checkrow [name="checkDone"]').check();
 await root.locator('button[form="editForm"]').click();
 await expect(form).toHaveCount(0);
 await root.locator('#workspace .item-name',{hasText:'モバイル操作検証タスク'}).click();
 await expect(root.locator('.origin-progress-head')).toContainText('100%');
 await root.locator('#sheet [data-action="edit"][data-kind="tasks"]').click();
 await expect(form.locator('[name="dueTime"]')).toHaveValue('16:30');
 const scrollWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
 expect(scrollWidth).toBeLessThanOrEqual(393);
});
test('Origin task edit keeps the unsaved draft when revision changed',async({page})=>{
 test.setTimeout(90000);
 const root=await boot(page,'origin-task-v389-cas','OriginCASV389',1366);
 await root.locator('[data-action="new"][data-kind="tasks"]').first().click();
 const form=root.locator('#editForm[data-kind="tasks"]');
 await form.locator('[name="title"]').fill('競合検証タスク');
 await root.locator('button[form="editForm"]').click();
 await root.locator('#workspace .item-name',{hasText:'競合検証タスク'}).click();
 await root.locator('#sheet [data-action="edit"][data-kind="tasks"]').click();
 await form.locator('[name="title"]').fill('入力中の更新内容');
 const result=await page.evaluate(async()=>{
  const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot(),t=s.tasks.find(x=>x.title==='競合検証タスク');
  return bridge.dispatch({type:'task.update',id:t.id,revision:t.revision,ownerRoom:s.roomId,ownerUser:s.currentUser,
   title:'別端末相当の更新',status:t.status,priority:t.priority,category:t.category,assignee:t.assignee,
   dueDate:t.dueDate,dueTime:t.dueTime,description:t.description,requester:t.requester,
   tags:(t.tags||[]).join(','),checklist:(t.checklist||[]).map(x=>x.text).join('\n'),
   checklistDone:(t.checklist||[]).map(x=>Boolean(x.done)),pinned:t.pinned});
 });
 expect(result?.ok).toBe(true);
 await root.locator('button[form="editForm"]').click();
 await expect(form).toBeVisible();
 await expect(form.locator('[name="title"]')).toHaveValue('入力中の更新内容');
 await expect(root.locator('#originTaskError')).toContainText('他端末');
});
