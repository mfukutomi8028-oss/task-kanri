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
  if(await root.locator('#originSettingsPanel').evaluate(el=>el.hidden))
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
    await expect.poll(()=>page.evaluate(()=>
      window.WorkBoardWorkflowV152.workflow.savedViews['origin-'+window.WorkBoardWorkflowV152.userKey()]?.taskGrouping
    )).toBe('assignee');

    // The other user has no saved preferences. Default state must be independent.
    await chooseUser(root,'森井');
    await expect(root.locator('[data-action="task-layout"][data-value="list"]')).toHaveAttribute('aria-pressed','true');
    await expect(root.locator('#originTaskSort')).toHaveValue('due');
    await expect(root.locator('#groupSelect')).toHaveValue('deadline');
    await expect(root.locator('#originTaskQuery')).toHaveValue('');

    // Returning to the saved user restores all three explicitly saved settings.
    await chooseUser(root,'福冨');
    await expect(root.locator('[data-action="task-layout"][data-value="board"]')).toHaveAttribute('aria-pressed','true');
    await expect(root.locator('#originTaskSort')).toHaveValue('priority');
    await expect(root.locator('#groupSelect')).toHaveValue('assignee');
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
    await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
    await root.locator((width<768?'#mobileNav':'#desktopNav')+' [data-route="tasks"]').click();
    await expect(root.locator('[data-action="task-layout"][data-value="board"]')).toHaveAttribute('aria-pressed','true');
    await expect(root.locator('#originTaskSort')).toHaveValue('priority');
    await expect(root.locator('#groupSelect')).toHaveValue('assignee');
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

test('Origin restores legacy saved view without grouping using layout default',async({page})=>{
  test.setTimeout(90000);
  const root=await launch(page,390,'legacy-grouping');
  const result=await page.evaluate(async()=>{
    const w=window.WorkBoardWorkflowV152, id='origin-'+w.userKey();
    return w.writeSavedView(id,{
      taskLayout:'board',columnSort:{key:'updated',direction:'asc'},updatedAt:Date.now()
    },w.workflow.savedViews?.[id]||null);
  });
  expect(result.ok).toBe(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  await root.locator('#mobileNav [data-route="tasks"]').click();
  await expect(root.locator('[data-action="task-layout"][data-value="board"]')).toHaveAttribute('aria-pressed','true');
  await expect(root.locator('#originTaskSort')).toHaveValue('updated');
  await expect(root.locator('#groupSelect')).toHaveValue('status');
});

for(const width of [320,390,1366]){
  test('Origin '+width+'px distinguishes unsaved, saved and changed view preferences',async({page})=>{
    test.setTimeout(90000);
    const root=await launch(page,width,'save-state');
    const state=root.locator('#originTaskViewState');
    await expect(state).toHaveAttribute('role','status');
    await expect(state).toHaveAttribute('data-state','unsaved');
    await expect(state).toContainText('未保存');
    await root.locator('[data-action="task-layout"][data-value="board"]').click();
    if(width<768)await root.locator('[data-action="task-advanced-toggle"]').click();
    await root.locator('#originTaskSort').selectOption('priority');
    await root.locator('#groupSelect').selectOption('assignee');
    await root.locator('[data-action="task-view-save"]').click();
    await expect(state).toHaveAttribute('data-state','saved');
    await expect(state).toContainText('保存済み');
    await root.locator('#originTaskSort').selectOption('updated');
    await expect(state).toHaveAttribute('data-state','changed');
    await expect(state).toContainText('未保存の変更');
    await root.locator('#originTaskSort').selectOption('priority');
    await expect(state).toHaveAttribute('data-state','saved');
    await root.locator('#groupSelect').selectOption('status');
    await expect(state).toHaveAttribute('data-state','changed');
    await root.locator('#groupSelect').selectOption('assignee');
    await expect(state).toHaveAttribute('data-state','saved');
    await root.locator('#originTaskQuery').fill('作業だけの検索');
    await expect(state).toHaveAttribute('data-state','saved');
    await root.locator('#originTaskQuery').fill('');
    await chooseUser(root,'森井');
    await expect(state).toHaveAttribute('data-state','unsaved');
    await chooseUser(root,'福冨');
    await expect(state).toHaveAttribute('data-state','saved');
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
    await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
    await root.locator((width<768?'#mobileNav':'#desktopNav')+' [data-route="tasks"]').click();
    await expect(state).toHaveAttribute('data-state','saved');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    expect(overflow).toBeLessThanOrEqual(3);
  });
}

test('Origin reflects another saved-view update without rewriting an unsaved screen choice',async({page})=>{
  test.setTimeout(90000);
  const root=await launch(page,390,'external-preference');
  const state=root.locator('#originTaskViewState');
  await expect(state).toHaveAttribute('data-state','unsaved');
  const result=await page.evaluate(async()=>{
    const w=window.WorkBoardWorkflowV152, id='origin-'+w.userKey();
    return w.writeSavedView(id,{
      taskLayout:'list',taskGrouping:'status',
      columnSort:{key:'priority',direction:'asc'},updatedAt:Date.now()
    },w.workflow.savedViews?.[id]||null);
  });
  expect(result.ok).toBe(true);
  await expect(root.locator('[data-action="task-layout"][data-value="list"]')).toHaveAttribute('aria-pressed','true');
  await expect(state).toHaveAttribute('data-state','changed');
  await root.locator('[data-action="task-advanced-toggle"]').click();
  await root.locator('#originTaskSort').selectOption('priority');
  await root.locator('#groupSelect').selectOption('status');
  await expect(state).toHaveAttribute('data-state','saved');
});
