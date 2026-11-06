import { test, expect } from '@playwright/test';

test('Origin related task search keeps selection, and unlink changes only the schedule', async ({page}) => {
  test.setTimeout(90000);
  await page.setViewportSize({width:390,height:844});
  await page.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4173'
    ? route.continue() : route.abort('blockedbyclient'));
  await page.addInitScript(() => {
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskUser','福冨');
    localStorage.setItem('systemTaskRoomId','origin-related-search-room');
  });
  await page.goto('/?room=origin-related-search-room',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true,undefined,{timeout:30000});
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el => el.click());
  const host=page.locator('#modernOriginRoot');
  const ids=await page.evaluate(async () => {
    const bridge=window.WorkBoardPaletteBridge;
    const s=bridge.readSnapshot();
    for(const title of ['検索対象：月次点検','無関係：テスト会議']) {
      const res=await bridge.dispatch({type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,
        assignee:s.currentUser,revision:0,status:s.statuses[0],category:s.categories[0],
        title,description:'',requester:'',tags:'',checklist:'',checklistDone:[],
        priority:'中',dueDate:'',dueTime:'',pinned:false});
      if(!res?.ok)throw Error('task.create '+res?.error);
    }
    const tasks=bridge.readSnapshot().tasks;
    return {wanted:tasks.find(t=>t.title==='検索対象：月次点検').id,
      unrelated:tasks.find(t=>t.title==='無関係：テスト会議').id};
  });
  await host.locator('#mobileNav [data-route="calendar"]').click();
  await host.locator('.agenda-day-head button[data-kind="events"]').first().click();
  const form=host.locator('#editForm[data-kind="events"]');
  await expect(form).toBeVisible();
  await form.locator('[name="title"]').fill('関連する予定のテスト');
  const search=form.locator('#originRelatedTaskSearch');
  const picker=form.locator('[name="relatedTaskId"]');
  await search.fill('月次点検');
  await expect(picker.locator('option')).toHaveCount(2);
  await picker.selectOption(ids.wanted);
  await search.fill('該当なしの検索語');
  await expect(picker).toHaveValue(ids.wanted);
  await expect(picker.locator('option')).toHaveCount(2);
  await search.fill('');
  await expect(picker).toHaveValue(ids.wanted);
  await host.locator('button[form="editForm"]').click();
  await expect(form).toHaveCount(0);
  const saved=await page.evaluate(() => {
    const s=window.WorkBoardPaletteBridge.readSnapshot();
    return s.schedules.find(x=>x.title==='関連する予定のテスト')?.id;
  });
  expect(saved).toBeTruthy();
  await host.locator('[data-action="open"][data-kind="events"][data-id="'+saved+'"]').first().click();
  await expect(host.locator('#sheet [data-action="related-open"][data-kind="tasks"]')).toHaveCount(1);
  await host.locator('#sheet [data-action="edit"][data-kind="events"]').click();
  await host.locator('#editForm [data-action="related-task-clear"]').click();
  await expect(host.locator('#editForm [name="relatedTaskId"]')).toHaveValue('');
  await host.locator('button[form="editForm"]').click();
  const result=await page.evaluate(({wanted,unrelated,saved})=>{
    const s=window.WorkBoardPaletteBridge.readSnapshot();
    return {related:s.schedules.find(x=>x.id===saved)?.relatedTaskId,
      exists:s.tasks.some(t=>t.id===wanted),other:s.tasks.some(t=>t.id===unrelated)};
  },{...ids,saved});
  expect(result).toEqual({related:'',exists:true,other:true});
});
