import {test,expect} from '@playwright/test';

async function origin(page,width,slug){
 await page.setViewportSize({width,height:width<800?844:900});
 await page.route('**/*',route=>
  new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 const room='origin-editor-20261119-'+slug+'-'+width;
 await page.addInitScript(id=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskRoomId',id);
  localStorage.setItem('systemTaskUser','OriginEditorQA');
 },room);
 await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await expect(root).toBeVisible();
 await root.locator((width<768?'#mobileNav':'#desktopNav')+' [data-route="tasks"]').click();
 return root;
}
async function openTaskEditor(root){
 await root.locator('[data-action="new"][data-kind="tasks"]').first().click();
 const form=root.locator('#editForm[data-kind="tasks"]');
 await expect(form).toBeVisible();
 return form;
}
for(const width of [320,390,1366]){
 test('Origin '+width+'px editor close glyph centered and task fields arranged by workflow',async({page})=>{
  test.setTimeout(60000);
  const root=await origin(page,width,'design');
  const form=await openTaskEditor(root);
  const positions=await root.locator('#sheet .sheet-close').evaluate(button=>{
   const rect=button.getBoundingClientRect(),svg=button.querySelector('svg')?.getBoundingClientRect();
   return {dx:svg?(svg.left+svg.width/2)-(rect.left+rect.width/2):999,
    dy:svg?(svg.top+svg.height/2)-(rect.top+rect.height/2):999};
  });
  expect(Math.abs(positions.dx)).toBeLessThanOrEqual(2);
  expect(Math.abs(positions.dy)).toBeLessThanOrEqual(2);
  await expect(form.locator('.origin-editor-block')).toHaveCount(3);
  await expect(form.locator('.origin-editor-block').first().locator('[name="title"]')).toBeVisible();
  await expect(form.locator('.origin-editor-block').first().locator('[name="desc"]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
 });
}
test('Origin 390px task and schedule editors accept exactly four year digits with calendar access',async({page})=>{
 test.setTimeout(60000);
 const root=await origin(page,390,'date');
 const form=await openTaskEditor(root);
 const due=form.locator('[name="due"]');
 await expect(due).toHaveAttribute('type','text');
 await expect(due).toHaveAttribute('maxlength','10');
 await due.fill('2026-11-19');
 await expect(due).toHaveValue('2026-11-19');
 await expect(form.locator('[data-action="origin-date-picker"][data-for="due"]')).toBeVisible();
 await root.locator('#sheet .sheet-close').click();
 await root.locator('#mobileNav [data-route="calendar"]').click();
 await root.locator('[data-action="new"][data-kind="events"]').first().click();
 const eventForm=root.locator('#editForm[data-kind="events"]');
 await expect(eventForm).toBeVisible();
 const start=eventForm.locator('[name="startAt"]');
 await expect(start).toHaveAttribute('type','text');
 await expect(start).toHaveAttribute('maxlength','16');
 await start.fill('2026-11-19T10:00');
 await expect(start).toHaveValue('2026-11-19T10:00');
 await expect(eventForm.locator('[data-action="origin-date-picker"][data-for="startAt"]')).toBeVisible();
});
test('Origin task comment jump focuses the composer before history',async({page})=>{
 test.setTimeout(60000);
 const root=await origin(page,390,'comments');
 const data=await page.evaluate(async()=>{
  const b=window.WorkBoardPaletteBridge,s=b.readSnapshot();
  const result=await b.dispatch({type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,
   title:'コメント導線を確認',description:'コメント入力の操作確認',status:s.statuses[0],
   priority:'中',assignee:s.users[0],category:s.categories[0],requester:'',
   tags:'',checklist:'',checklistDone:[],dueDate:'',dueTime:'',pinned:false});
  if(!result?.ok)throw Error(JSON.stringify(result));
  return result.id;
 });
 await root.locator('#originTaskQuery').fill('コメント導線を確認');
 await root.locator('.origin-task-collection [data-action="open"][data-id="'+data+'"]').first().click();
 const comments=root.locator('#originTaskComments');
 await expect(comments).toBeVisible();
 const ordering=await comments.evaluate(section=>[...section.children].map(el=>el.id||el.className));
 const composer=ordering.indexOf('originCommentForm');
 const history=ordering.indexOf('origin-comment-history');
 expect(composer).toBeGreaterThanOrEqual(0);
 expect(history).toBeGreaterThanOrEqual(0);
 expect(composer).toBeLessThan(history);
 await root.locator('[data-action="detail-jump"][data-value="originTaskComments"]').click();
 await expect(comments.locator('textarea[name="text"]')).toBeFocused();
});
test('Origin last task display preference is stored without a manual save button',async({page})=>{
 test.setTimeout(60000);
 const root=await origin(page,390,'view');
 await expect(root.locator('[data-action="task-view-save"]')).toHaveCount(0);
 await root.locator('[data-action="task-layout"][data-value="board"]').click();
 await expect(root.locator('[data-action="task-layout"][data-value="board"]')).toHaveAttribute('aria-pressed','true');
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 await root.locator('#mobileNav [data-route="tasks"]').click();
 await expect(root.locator('[data-action="task-layout"][data-value="board"]')).toHaveAttribute('aria-pressed','true');
});
