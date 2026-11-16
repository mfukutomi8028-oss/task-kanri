import { test, expect } from '@playwright/test';

// Isolated local room: real Origin UI and shared workflow, no remote Firebase writes.
async function launch(page,width,slug){
  await page.setViewportSize({width,height:width<800?844:900});
  await page.route('**/*',route =>
    new URL(route.request().url()).origin==='http://127.0.0.1:4173'
      ? route.continue() : route.abort('blockedbyclient'));
  const room='origin-view-restore-v623-'+slug+'-'+width;
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
  await root.locator((width<768?'#mobileNav':'#desktopNav')+' [data-route="tasks"]').click();
  return root;
}

async function chooseUser(root,name){
  await root.locator('#originSettingsToggle').click();
  await root.locator('#originUserSelect').selectOption(name);
  await expect(root.locator('#originUserSelect')).toHaveValue(name);
}

for(const width of [390,1366]){
  test('Origin '+width+'px restores each user saved task view without inheriting another user sort or grouping',async({page})=>{
    test.setTimeout(90000);
    const root=await launch(page,width,'users');
    await root.locator('[data-action="task-layout"][data-value="board"]').click();
    if(width<768)await root.locator('[data-action="task-advanced-toggle"]').click();
    await root.locator('#originTaskSort').selectOption('priority');
    await root.locator('#groupSelect').selectOption('assignee');
    await root.locator('[data-action="task-view-save"]').click();
    await expect.poll(()=>page.evaluate(()=>
      window.WorkBoardWorkflowV152.workflow.savedViews['origin-'+window.WorkBoardWorkflowV152.userKey()]?.taskLayout
    )).toBe('board');
    await expect.poll(()=>page.evaluate(()=>
      window.WorkBoardWorkflowV152.workflow.savedViews['origin-'+window.WorkBoardWorkflowV152.userKey()]?.columnSort?.key
    )).toBe('priority');

    // The other user has no saved preferences. Default state must be independent.
    await chooseUser(root,'森井');
    await expect(root.locator('[data-action="task-layout"][data-value="list"]')).toHaveAttribute('aria-pressed','true');
    await expect(root.locator('#originTaskSort')).toHaveValue('due');
    await expect(root.locator('#groupSelect')).toHaveValue('deadline');
    await expect(root.locator('#originTaskQuery')).toHaveValue('');

    // Returning to the saved user's view restores layout and sort; grouping follows layout defaults.
    await chooseUser(root,'福冨');
    await expect(root.locator('[data-action="task-layout"][data-value="board"]')).toHaveAttribute('aria-pressed','true');
    await expect(root.locator('#originTaskSort')).toHaveValue('priority');
    await expect(root.locator('#groupSelect')).toHaveValue('status');
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
    await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
    await root.locator((width<768?'#mobileNav':'#desktopNav')+' [data-route="tasks"]').click();
    await expect(root.locator('[data-action="task-layout"][data-value="board"]')).toHaveAttribute('aria-pressed','true');
    await expect(root.locator('#originTaskSort')).toHaveValue('priority');
    await expect(root.locator('#groupSelect')).toHaveValue('status');
  });
}

test('Origin task filtering survives layout, sort and navigation changes without changing tasks',async({page})=>{
  test.setTimeout(90000);
  const root=await launch(page,390,'filters');
  const original=await page.evaluate(async()=>{
    const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
    for(const title of ['巡回点検の資料','巡回点検の報告']){
      const result=await bridge.dispatch({type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,
        revision:0,title,description:'検索対象',status:'未着手',priority:'中',
        assignee:s.currentUser,category:s.categories[0],requester:'',tags:'',checklist:'',dueDate:'',dueTime:'',pinned:false});
      if(!result?.ok)throw Error('seed task failed '+JSON.stringify(result));
    }
    return bridge.readSnapshot().tasks.map(t=>({id:t.id,revision:t.revision,completed:t.completed}));
  });
  const query=root.locator('#originTaskQuery');
  await query.fill('巡回点検');
  await root.locator('[data-action="task-advanced-toggle"]').click();
  await root.locator('#originTaskSort').selectOption('updated');
  await root.locator('.status-marker[data-status="未着手"]').click();
  const active=()=>root.locator('.origin-task-collection .item-row');
  await expect(active()).toHaveCount(2);
  for(const mode of ['board','timeline','list']){
    await root.locator('[data-action="task-layout"][data-value="'+mode+'"]').click();
    await expect(query).toHaveValue('巡回点検');
    await expect(root.locator('#originTaskSort')).toHaveValue('updated');
    await expect(root.locator('.origin-task-summary')).toContainText('状態：未着手');
    await expect(active()).toHaveCount(2);
  }
  await root.locator('#mobileNav [data-route="today"]').click();
  await root.locator('#mobileNav [data-route="tasks"]').click();
  await expect(query).toHaveValue('巡回点検');
  await expect(root.locator('#originTaskSort')).toHaveValue('updated');
  await expect(active()).toHaveCount(2);
  const after=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks
    .map(t=>({id:t.id,revision:t.revision,completed:t.completed})));
  expect(after).toEqual(original);
});
