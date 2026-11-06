import { test, expect } from '@playwright/test';
test('Modern origin renders real app data and can switch back to Classic', async ({page}) => {
  test.setTimeout(90000);
  await page.setViewportSize({width:1366,height:900});
  await page.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4173'
    ? route.continue() : route.abort('blockedbyclient'));
  await page.addInitScript(() => {
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskUser','OriginTester');
    localStorage.setItem('systemTaskRoomId','origin-v372-browser-room');
  });
  await page.goto('/?room=origin-v372-browser-room',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true,undefined,{timeout:30000});
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','modern');
  await expect(page.locator('html')).toHaveAttribute('data-modern-origin-ready','true');
  await expect(page.locator('#modernOriginRoot')).toBeVisible();
  await expect(page.locator('.app-shell')).toHaveCSS('display','none');
  const rootVersion=await page.locator('#modernOriginRoot').getAttribute('data-release-version');
  const manifestVersion=await page.evaluate(()=>String(window.WORK_BOARD_RELEASE_VERSION));
  expect(rootVersion).toBe(manifestVersion);
  await expect(page.locator('#modernOriginRoot').locator('.brand-small')).toContainText('Ver.'+manifestVersion);
  const root=page.locator('#modernOriginRoot');
  await expect(root.locator('#workspace')).toBeVisible();
  await root.locator('#desktopNav [data-route="tasks"]').click();
  await expect(root.locator('#workspace')).toContainText('タスク');
  await root.locator('#desktopNav [data-route="todos"]').click();
  await expect(root.locator('#workspace')).toContainText('ToDo');
  await root.locator('#originDisplaySelect').selectOption('classic');
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','classic');
  await expect(root).toBeHidden();
  await expect(page.locator('.app-shell')).toBeVisible();
});

test('Origin ToDo changes appear in Classic with the same data source', async ({page}) => {
  test.setTimeout(90000);
  await page.setViewportSize({width:1366,height:900});
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'
    ?route.continue():route.abort('blockedbyclient'));
  await page.addInitScript(()=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskUser','OriginTester');
    localStorage.setItem('systemTaskRoomId','origin-v374-to-do-room');
  });
  await page.goto('/?room=origin-v374-to-do-room',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  const host=page.locator('#modernOriginRoot');
  await expect(host).toBeVisible();
  await host.locator('#desktopNav [data-route="todos"]').click();
  await host.locator('[data-form="quick-todo"] input[name="title"]').fill('共通データ接続の確認');
  await host.locator('[data-form="quick-todo"] button[type="submit"]').click();
  await expect(host.locator('#workspace')).toContainText('共通データ接続の確認');
  await host.locator('#originDisplaySelect').selectOption('classic');
  await page.locator('.nav-item[data-layout="todos"]').evaluate(el=>el.click());
  await expect(page.locator('#todoView')).toContainText('共通データ接続の確認');
});
test('Origin schedule creates and edits in the Modern drawer, using the canonical snapshot',async ({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize({width:1366,height:900});
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'
    ?route.continue():route.abort('blockedbyclient'));
  await page.addInitScript(()=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskUser','福冨');
    localStorage.setItem('systemTaskRoomId','origin-schedule-v383-bridge-room');
  });
  await page.goto('/?room=origin-schedule-v383-bridge-room',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  const root=page.locator('#modernOriginRoot');
  await expect(root).toBeVisible();
  await root.locator('#desktopNav [data-route="calendar"]').click();
  await root.locator('.weekday-add').first().click();
  const form=root.locator('#editForm[data-kind="events"]');
  await expect(form).toBeVisible();
  await expect(page.locator('#scheduleDialog')).toBeHidden();
  const day=(await form.locator('[name="startAt"]').inputValue()).slice(0,10);
  await form.locator('[name="title"]').fill('Modern予定の操作確認');
  await form.locator('[name="startAt"]').fill(day+'T10:00');
  await root.locator('[data-action="schedule-duration"][data-minutes="60"]').click();
  await expect(form.locator('[name="endAt"]')).toHaveValue(day+'T11:00');
  await root.locator('button[form="editForm"]').click();
  await expect(form).toHaveCount(0);
  await expect(root.locator('.schedule-event',{hasText:'Modern予定の操作確認'})).toHaveCount(1);
  await root.locator('.schedule-event',{hasText:'Modern予定の操作確認'}).click();
  await expect(root.locator('#sheet')).toContainText('Modern予定の操作確認');
  await root.locator('#sheet [data-action="edit"]').click();
  await root.locator('#editForm [name="title"]').fill('Modern予定を更新しました');
  await root.locator('button[form="editForm"]').click();
  await expect(root.locator('#workspace')).toContainText('Modern予定を更新しました');
  await expect.poll(async()=>page.evaluate(()=>
    window.WorkBoardPaletteBridge.readSnapshot().schedules.some(item=>item.title==='Modern予定を更新しました')
  )).toBe(true);
  await expect(page.locator('#scheduleDialog')).toBeHidden();
  await root.locator('#originDisplaySelect').selectOption('classic');
  await expect(page.locator('.app-shell')).toBeVisible();
});

test('Origin mobile schedule shows validation and retains a rejected draft',async ({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize({width:390,height:844});
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'
    ?route.continue():route.abort('blockedbyclient'));
  await page.addInitScript(()=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskUser','福冨');
    localStorage.setItem('systemTaskRoomId','origin-schedule-v383-mobile-room');
  });
  await page.goto('/?room=origin-schedule-v383-mobile-room',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  const root=page.locator('#modernOriginRoot');
  await root.locator('#mobileNav [data-route="calendar"]').click();
  await root.locator('.agenda-day-head button[data-kind="events"]').first().click();
  const form=root.locator('#editForm[data-kind="events"]');
  const day=(await form.locator('[name="startAt"]').inputValue()).slice(0,10);
  await form.locator('[name="title"]').fill('終了時刻検証');
  await form.locator('[name="startAt"]').fill(day+'T16:00');
  await form.locator('[name="endAt"]').fill(day+'T15:00');
  await root.locator('button[form="editForm"]').click();
  await expect(form).toBeVisible();
  await expect(root.locator('#originScheduleError')).toContainText('終了日時は開始日時より後');
  await expect(form.locator('[name="title"]')).toHaveValue('終了時刻検証');
  await expect(page.locator('#scheduleDialog')).toBeHidden();
  const w=await page.evaluate(()=>document.documentElement.scrollWidth);
  expect(w).toBeLessThanOrEqual(393);
});

test('Origin desktop task statuses fit on one line at standard work width',async({page})=>{
 test.setTimeout(60000);
 await page.setViewportSize({width:1366,height:900});
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 await page.addInitScript(()=>{
   Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
   localStorage.setItem('systemTaskUser','福冨');
   localStorage.setItem('systemTaskRoomId','origin-status-v391-test-room');
 });
 await page.goto('/?room=origin-status-v391-test-room',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const host=page.locator('#modernOriginRoot');
 await expect(host).toBeVisible();
 await host.locator('#desktopNav [data-route="tasks"]').click();
 const markers=host.locator('.status-rail .status-marker');
 const statuses=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().statuses);
 await expect(markers).toHaveCount(statuses.length);
 const positions=await markers.evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().top));
 if(positions.length===5)expect(Math.max(...positions)-Math.min(...positions)).toBeLessThan(2);
});

test('Origin shows a canonical schedule validation error inside the drawer without losing a draft',async({page})=>{
 test.setTimeout(90000);
 await page.setViewportSize({width:390,height:844});
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 await page.addInitScript(()=>{
   Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
   localStorage.setItem('systemTaskUser','福冨');
   localStorage.setItem('systemTaskRoomId','origin-schedule-inline-error-room');
 });
 await page.goto('/?room=origin-schedule-inline-error-room',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const host=page.locator('#modernOriginRoot');
 await host.locator('#mobileNav [data-route="calendar"]').click();
 await host.locator('.agenda-day-head button[data-kind="events"]').first().click();
 const form=host.locator('#editForm[data-kind="events"]');
 await expect(form).toBeVisible();
 await form.locator('[name="title"]').fill('入力を残す予定');
 await form.locator('[name="relatedTaskId"]').evaluate(el=>{
   const option=new Option('無効な関連先','missing-task-inline-error');
   el.add(option);el.value=option.value;
 });
 await host.locator('button[form="editForm"]').click();
 await expect(form).toBeVisible();
 await expect(form.locator('[name="title"]')).toHaveValue('入力を残す予定');
 await expect(form.locator('[name="relatedTaskId"]')).toHaveValue('missing-task-inline-error');
 await expect(host.locator('#originScheduleError')).toContainText('関連タスク');
 await expect(page.locator('#scheduleDialog')).toBeHidden();
});

async function launchOriginV415(page,room,width=1366){
 await page.setViewportSize({width,height:width===320?760:900});
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 await page.addInitScript(roomName=>{
   Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
   localStorage.setItem('systemTaskUser','福冨');
   localStorage.setItem('systemTaskRoomId',roomName);
 },room);
 await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 return page.locator('#modernOriginRoot');
}

test('Origin color-only memo updates preserve gallery order and content-modified time',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-v415-memo-color-room');
 const original=await page.evaluate(async()=>{
   const bridge=window.WorkBoardPaletteMemoBridgeV369;
   const {roomId,currentUser}=window.WorkBoardPaletteBridge.readSnapshot();
   for(const title of ['色変更対象','別の業務メモ']){
     const out=await bridge.dispatch({type:'memo.create',ownerRoom:roomId,ownerUser:currentUser,
       title,body:'メモの本文',category:'手順',tags:['院内'],pinned:false,paperColor:'ivory'});
     if(!out?.ok)throw new Error('memo.create: '+out?.error);
   }
   return bridge.readSnapshot().find(m=>m.title==='色変更対象');
 });
 await host.locator('#desktopNav [data-route="notes"]').click();
 const titles=host.locator('.origin-memo-shell .memo-card h3');
 await expect(titles).toHaveCount(2);
 const beforeOrder=await titles.allTextContents();
 const tile=host.locator('.origin-memo-shell',{hasText:'色変更対象'});
 await tile.locator('[data-action="memo-color"][data-value="mint"]').click();
 await expect(tile).toHaveAttribute('data-paper-color','mint');
 expect(await titles.allTextContents()).toEqual(beforeOrder);
 const after=await page.evaluate(()=>window.WorkBoardPaletteMemoBridgeV369.readSnapshot().find(m=>m.title==='色変更対象'));
 expect(after.updatedAt).toBe(original.updatedAt);
 expect(after.updatedBy).toBe(original.updatedBy);
 expect(after.revision).toBeGreaterThan(original.revision);
 const edited=await page.evaluate(async()=>{
   const bridge=window.WorkBoardPaletteMemoBridgeV369;
   const memo=bridge.readSnapshot().find(m=>m.title==='色変更対象');
   const {roomId,currentUser}=window.WorkBoardPaletteBridge.readSnapshot();
   const out=await bridge.dispatch({type:'memo.update',id:memo.id,revision:memo.revision,ownerRoom:roomId,
     ownerUser:currentUser,title:memo.title,body:memo.body+' 追記',category:memo.category,
     tags:memo.tags,pinned:memo.pinned,paperColor:memo.paperColor});
   if(!out?.ok)throw new Error('memo.update: '+out?.error);
   return bridge.readSnapshot().find(m=>m.id===memo.id);
 });
 expect(edited.body).toContain('追記');
 expect(edited.updatedAt).toBeGreaterThanOrEqual(after.updatedAt);
});

test('Origin retains unsaved ToDo text on updates and confirms a user change',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-v415-user-draft-room');
 await host.locator('#desktopNav [data-route="todos"]').click();
 const input=host.locator('[data-form="quick-todo"] [name="title"]');
 await input.fill('作業途中のメモ');
 const result=await page.evaluate(()=>window.WorkBoardPaletteBridge.dispatch({type:'todo.create',text:'他の更新'}));
 expect(result?.ok).toBe(true);
 await expect(input).toHaveValue('作業途中のメモ');
 const picker=host.locator('#originUserSelect');
 await expect(picker).toHaveValue('福冨');
 page.once('dialog',dialog=>dialog.dismiss());
 await picker.selectOption('森井');
 await expect(picker).toHaveValue('福冨');
 await expect(input).toHaveValue('作業途中のメモ');
 page.once('dialog',dialog=>dialog.accept());
 await picker.selectOption('森井');
 await expect(picker).toHaveValue('森井');
 await expect(input).toHaveValue('');
 expect(await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().currentUser)).toBe('森井');
});

test('Origin mobile header and schedule search fit at 320px',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-v415-mobile-room',320);
 await host.locator('#mobileNav [data-route="calendar"]').click();
 await expect(host.locator('#originScheduleSearch')).toBeVisible();
 await host.locator('#originScheduleSearch').fill('予定なし');
 const metrics=await host.locator('.header-tools').evaluate(el=>{
   const rect=el.getBoundingClientRect();
   return {left:rect.left,right:rect.right};
 });
 expect(metrics.left).toBeGreaterThanOrEqual(-1);
 expect(metrics.right).toBeLessThanOrEqual(321);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(323);
 await host.locator('#mobileNav [data-route="notes"]').click();
 await expect(host.locator('#originMemoQuery')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(323);
});

test('Origin desktop header keeps notes navigation clickable at 1366px',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-v420-desktop-header-room',1366);
 const nav=host.locator('#desktopNav [data-route="notes"]');
 await expect(nav).toBeVisible();
 await nav.click({timeout:10000});
 await expect(host.locator('#workspace')).toContainText('業務メモ');
 const boxes=await Promise.all([host.locator('#desktopNav').boundingBox(),host.locator('.header-tools').boundingBox()]);
 expect(boxes[0]).not.toBeNull();
 expect(boxes[1]).not.toBeNull();
 // Controls and tabs occupy separate rows, so the controls cannot cover navigation.
 expect(boxes[0].y).toBeGreaterThanOrEqual(boxes[1].y+boxes[1].height-2);
});

test('Origin memo library searches and sorts without altering the canonical records',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-v420-memo-library-room',1366);
 const originalIds=await page.evaluate(async()=>{
   const bridge=window.WorkBoardPaletteMemoBridgeV369;
   const {roomId,currentUser}=window.WorkBoardPaletteBridge.readSnapshot();
   for(const title of ['アルファ連絡先','ブラボー手順書','ゼータ連絡先']){
     const result=await bridge.dispatch({type:'memo.create',ownerRoom:roomId,ownerUser:currentUser,
       title,body:'業務用',category:'手順',pinned:false,tags:['試験'],paperColor:'ivory'});
     if(!result?.ok)throw new Error('memo.create: '+result?.error);
   }
   return bridge.readSnapshot().map(m=>({id:m.id,revision:m.revision,updatedAt:m.updatedAt}));
 });
 await host.locator('#desktopNav [data-route="notes"]').click();
 await expect(host.locator('.origin-memo-shell')).toHaveCount(3);
 await host.locator('#originMemoQuery').fill('連絡先');
 await expect(host.locator('.origin-memo-shell')).toHaveCount(2);
 await host.locator('#originMemoSort').selectOption('title');
 const titles=await host.locator('.origin-memo-shell .memo-card h3').allTextContents();
 expect(titles).toEqual(['アルファ連絡先','ゼータ連絡先']);
 await host.locator('[data-action="memo-reset"]').click();
 await expect(host.locator('#originMemoQuery')).toHaveValue('');
 await expect(host.locator('.origin-memo-shell')).toHaveCount(3);
 await expect(host.locator('#originMemoSort')).toHaveValue('title');
 const after=await page.evaluate(()=>window.WorkBoardPaletteMemoBridgeV369.readSnapshot().map(m=>({id:m.id,revision:m.revision,updatedAt:m.updatedAt})));
 expect(after).toEqual(originalIds);
});

test('Origin detail browsing follows the filtered memo card order and restores focus',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-v423-memo-pager-room',1366);
 await page.evaluate(async()=>{
   const bridge=window.WorkBoardPaletteMemoBridgeV369;
   const {roomId,currentUser}=window.WorkBoardPaletteBridge.readSnapshot();
   for(const title of ['閲覧確認A','閲覧確認B','その他のメモ']){
     const result=await bridge.dispatch({type:'memo.create',ownerRoom:roomId,ownerUser:currentUser,
       title,body:'詳細ページの移動確認',category:'手順',tags:['確認'],pinned:false,paperColor:'ivory'});
     if(!result?.ok)throw new Error('memo.create: '+result?.error);
   }
 });
 await host.locator('#desktopNav [data-route="notes"]').click();
 await host.locator('#originMemoQuery').fill('閲覧確認');
 await host.locator('#originMemoSort').selectOption('title');
 const cards=host.locator('.origin-memo-shell .memo-card');
 await expect(cards).toHaveCount(2);
 await cards.first().click();
 const sheet=host.locator('#sheet');
 await expect(sheet.locator('#panelHeading')).toHaveText('閲覧確認A');
 await expect(sheet.locator('.origin-detail-position')).toHaveText('1 / 2件');
 await expect(sheet.locator('[data-action="detail-prev"]')).toBeDisabled();
 await sheet.locator('[data-action="detail-next"]').click();
 await expect(sheet.locator('#panelHeading')).toHaveText('閲覧確認B');
 await expect(sheet.locator('.origin-detail-position')).toHaveText('2 / 2件');
 await expect(sheet.locator('[data-action="detail-next"]')).toBeDisabled();
 await sheet.locator('.sheet-close').click();
 await expect(host.locator('#overlay')).toBeHidden();
 const focusRestored=await cards.nth(1).evaluate(el=>el.getRootNode().activeElement===el);
 expect(focusRestored).toBe(true);
 await expect(host.locator('#originMemoQuery')).toHaveValue('閲覧確認');
 await expect(host.locator('#originMemoSort')).toHaveValue('title');
});

test('Origin ToDo detail browsing uses visible items and never changes their data',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-v423-todo-pager-room',390);
 const original=await page.evaluate(async()=>{
   for(const title of ['閲覧ToDo一件目','閲覧ToDo二件目']){
     const result=await window.WorkBoardPaletteBridge.dispatch({type:'todo.create',text:title});
     if(!result?.ok)throw new Error('todo.create: '+result?.error);
   }
   return window.WorkBoardPaletteBridge.readSnapshot().todos.map(x=>({id:x.id,revision:x.revision,completed:x.completed}));
 });
 await host.locator('#mobileNav [data-route="todos"]').click();
 await expect(host.locator('.todo-entry .todo-text')).toHaveCount(2);
 const visibleOrder=await host.locator('.todo-entry .todo-text').allTextContents();
 await host.locator('.todo-entry .todo-text').first().click();
 await expect(host.locator('#sheet .origin-detail-position')).toContainText('1 / 2件');
 await host.locator('#sheet [data-action="detail-next"]').click();
 await expect(host.locator('#sheet #panelHeading')).toHaveText(visibleOrder[1]);
 await host.locator('#sheet .sheet-close').click();
 expect(await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().todos.map(x=>({id:x.id,revision:x.revision,completed:x.completed})))).toEqual(original);
});


test('Origin compact ToDo workflow does not invent due dates and can reopen finished items',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-v425-todo-compact-room',1366);
 await page.evaluate(async()=>{
   for(const title of ['未完了の確認A','未完了の確認B']){
     const out=await window.WorkBoardPaletteBridge.dispatch({type:'todo.create',text:title,memo:'編集可能な補足'});
     if(!out?.ok)throw new Error('todo.create: '+out?.error);
   }
 });
 await host.locator('#desktopNav [data-route="todos"]').click();
 await expect(host.locator('.origin-todo-list .todo-entry')).toHaveCount(2);
 await expect(host.locator('#workspace')).not.toContainText('今日・期限超過');
 await expect(host.locator('.origin-todo-archive-toggle')).toHaveAttribute('aria-expanded','false');
 // Checkbox disappears after completion; assert its destination rather than
 // waiting for the detached checkbox to remain checked.
 await host.locator('.origin-todo-list .todo-check').first().click();
 await expect(host.locator('.origin-todo-list .todo-entry')).toHaveCount(1);
 await host.locator('.origin-todo-archive-toggle').click();
 await expect(host.locator('#originCompletedTodos .todo-entry')).toHaveCount(1);
 await host.locator('#originCompletedTodos .todo-check').first().click();
 await expect(host.locator('.origin-todo-list .todo-entry')).toHaveCount(2);
 await expect(host.locator('#originCompletedTodos .todo-entry')).toHaveCount(0);
 const state=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().todos);
 expect(state.filter(item=>item.completed)).toHaveLength(0);
 await host.locator('.origin-todo-list .todo-text').first().click();
 await expect(host.locator('#sheet')).toContainText('編集可能な補足');
 await host.locator('#sheet [data-action="edit"]').click();
 const form=host.locator('#editForm[data-kind="todos"]');
 await form.locator('[name="memo"]').fill('新しい補足メモ');
 await host.locator('button[form="editForm"]').click();
 await expect(form).toHaveCount(0);
 const after=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().todos);
 expect(after.some(item=>item.memo==='新しい補足メモ')).toBe(true);
});

test('Origin 390px task list shows due time and filters without writing source data',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-v425-task-density-room',390);
 const original=await page.evaluate(async()=>{
   const bridge=window.WorkBoardPaletteBridge,snapshot=bridge.readSnapshot();
   const now=new Date(),iso=(days)=>{
     const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+days);
     return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
   };
   for(const entry of [{title:'高優先の仕事',priority:'高',dueDate:iso(5)},
                        {title:'低優先の仕事',priority:'低',dueDate:iso(2)}]){
     const response=await bridge.dispatch({
       type:'task.create',ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser,
       revision:0,assignee:snapshot.currentUser,status:snapshot.statuses.includes('未着手')?'未着手':snapshot.statuses[0],
       category:snapshot.categories[0],title:entry.title,description:'業務一覧の確認',
       requester:'',tags:'',checklist:'',checklistDone:[],priority:entry.priority,
       dueDate:entry.dueDate,dueTime:'15:30',pinned:false
     });
     if(!response?.ok)throw new Error('task.create: '+response?.error);
   }
   return bridge.readSnapshot().tasks.map(t=>({id:t.id,revision:t.revision,dueDate:t.dueDate}));
 });
 await host.locator('#mobileNav [data-route="tasks"]').click();
 const rows=host.locator('.origin-task-collection .item-row');
 await expect(rows).toHaveCount(2);
 await expect(rows.first().locator('.origin-task-mobile-due')).toBeVisible();
 await expect(rows.first().locator('.origin-task-mobile-due')).toContainText('15:30');
 await expect(rows.first().locator('.item-name')).toHaveText('低優先の仕事');
 await expect(host.locator('[data-action="task-advanced-toggle"]')).toHaveAttribute('aria-expanded','false');
 await host.locator('[data-action="task-advanced-toggle"]').click();
 await host.locator('#originTaskSort').selectOption('priority');
 await expect(rows.first().locator('.item-name')).toHaveText('高優先の仕事');
 await host.locator('#originTaskQuery').fill('高優先');
 await expect(rows).toHaveCount(1);
 await host.locator('#originTaskQuery').fill('');
 await expect(rows).toHaveCount(2);
 await host.locator('[data-action="task-density"]').click();
 await expect(host.locator('.origin-task-collection')).not.toHaveClass(/origin-tasks-compact/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(393);
 const after=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks.map(t=>({id:t.id,revision:t.revision,dueDate:t.dueDate})));
 expect(after).toEqual(original);
});

test('Origin day schedule focuses selected date and preserves canonical event',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-v425-schedule-day-room',390);
 await host.locator('#mobileNav [data-route="calendar"]').click();
 await host.locator('.agenda-day-head button[data-kind="events"]').first().click();
 const form=host.locator('#editForm[data-kind="events"]');
 const day=(await form.locator('[name="startAt"]').inputValue()).slice(0,10);
 await form.locator('[name="title"]').fill('日別で確認する予定');
 await form.locator('[name="startAt"]').fill(day+'T09:30');
 await form.locator('[name="endAt"]').fill(day+'T10:00');
 await host.locator('button[form="editForm"]').click();
 await expect(form).toHaveCount(0);
 const before=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().schedules.map(item=>({id:item.id,revision:item.revision})));
 await host.locator('[data-action="calendar-view"][data-value="day"]').click();
 await host.locator('#originDateJump').fill(day);
 await expect(host.locator('.origin-day-entry',{hasText:'日別で確認する予定'})).toHaveCount(1);
 await expect(host.locator('.origin-day-entry')).toContainText('09:30–10:00');
 await host.locator('[data-action="day-next"]').click();
 await expect(host.locator('.origin-day-entry')).toHaveCount(0);
 await host.locator('[data-action="day-prev"]').click();
 await expect(host.locator('.origin-day-entry',{hasText:'日別で確認する予定'})).toHaveCount(1);
 await host.locator('.origin-day-entry').click();
 await expect(host.locator('#sheet')).toContainText('日別で確認する予定');
 await host.locator('#sheet .sheet-close').click();
 expect(await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().schedules.map(item=>({id:item.id,revision:item.revision})))).toEqual(before);
});

test('Origin preserves search focus during shared data refresh',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-v427-focus-refresh-room',1366);
 await host.locator('#desktopNav [data-route="tasks"]').click();
 const input=host.locator('#originTaskQuery');
 await input.fill('入力途中の検索');
 await expect(input).toHaveValue('入力途中の検索');
 const done=await page.evaluate(async()=>window.WorkBoardPaletteBridge.dispatch({
   type:'todo.create',text:'タスク検索中に届いた別データ'
 }));
 expect(done?.ok).toBe(true);
 await expect(input).toHaveValue('入力途中の検索');
 await expect.poll(()=>input.evaluate(el=>el.getRootNode().activeElement===el)).toBe(true);
 await host.locator('#desktopNav [data-route="notes"]').click();
 const memo=host.locator('#originMemoQuery');
 await memo.fill('日本語の検索語');
 const next=await page.evaluate(async()=>window.WorkBoardPaletteBridge.dispatch({
   type:'todo.create',text:'メモ検索中に届いた別データ'
 }));
 expect(next?.ok).toBe(true);
 await expect(memo).toHaveValue('日本語の検索語');
 await expect.poll(()=>memo.evaluate(el=>el.getRootNode().activeElement===el)).toBe(true);
});

test('Origin remembers each tab scroll position but resets it on account change',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-v427-tab-scroll-room',1366);
 // Height is synthetic so this checks navigation without adding demo records to shared data.
 await host.evaluate(el=>{
   const style=document.createElement('style');
   style.textContent='.origin-todo-list{min-height:1900px}.origin-task-collection{min-height:1900px}';
   el.shadowRoot.append(style);
 });
 await host.locator('#desktopNav [data-route="todos"]').click();
 const y1=await page.evaluate(()=>{window.scrollTo(0,600);return window.scrollY});
 expect(y1).toBeGreaterThan(450);
 // The Origin host must not become an unintended scroll container: sticky header stays visible.
 expect(await host.evaluate(el=>getComputedStyle(el).overflowX)).toBe('clip');
 expect(await page.evaluate(()=>getComputedStyle(document.body).overflowX)).toBe('clip');
 const headerTop=await host.locator('.header').evaluate(el=>el.getBoundingClientRect().top);
 expect(Math.abs(headerTop)).toBeLessThan(3);
 await host.locator('#desktopNav [data-route="tasks"]').click();
 expect(await page.evaluate(()=>window.scrollY)).toBe(0);
 const y2=await page.evaluate(()=>{window.scrollTo(0,235);return window.scrollY});
 expect(y2).toBeGreaterThan(150);
 await host.locator('#desktopNav [data-route="todos"]').click();
 expect(await page.evaluate(()=>window.scrollY)).toBeGreaterThan(450);
 await host.locator('#desktopNav [data-route="tasks"]').click();
 expect(await page.evaluate(()=>window.scrollY)).toBeGreaterThan(150);
 const picker=host.locator('#originUserSelect');
 await picker.selectOption('森井');
 await expect(picker).toHaveValue('森井');
 expect(await page.evaluate(()=>window.scrollY)).toBe(0);
 await host.locator('#desktopNav [data-route="todos"]').click();
 expect(await page.evaluate(()=>window.scrollY)).toBe(0);
});

test('Origin Today quick ToDo is above preview and opens details without changing completion',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-v431-today-quick-todo-room',1366);
 const result=await page.evaluate(()=>window.WorkBoardPaletteBridge.dispatch({
   type:'todo.create',text:'今日のプレビューから確認',memo:'詳細から読める補足'
 }));
 expect(result?.ok).toBe(true);
 await host.locator('#desktopNav [data-route="today"]').click();
 const add=host.locator('.origin-today-todo-add');
 const title=host.locator('.mini-todo button.todo-title',{hasText:'今日のプレビューから確認'});
 await expect(add).toBeVisible();
 await expect(title).toBeVisible();
 const addRect=await add.boundingBox(),titleRect=await title.boundingBox();
 expect(addRect.y).toBeLessThan(titleRect.y);
 const before=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().todos.map(x=>({id:x.id,completed:x.completed,revision:x.revision})));
 await title.click();
 await expect(host.locator('#sheet')).toContainText('今日のプレビューから確認');
 await expect(host.locator('#sheet')).toContainText('詳細から読める補足');
 await host.locator('#sheet .sheet-close').click();
 const after=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().todos.map(x=>({id:x.id,completed:x.completed,revision:x.revision})));
 expect(after).toEqual(before);
 await expect(host.locator('.origin-today-shortcuts button[data-kind="tasks"]')).toBeVisible();
 await expect(host.locator('.origin-today-shortcuts button[data-kind="todos"]')).toBeVisible();
 await expect(host.locator('.origin-today-shortcuts button[data-kind="events"]')).toBeVisible();
});

test('Origin Today changes the schedule label with selected day at 320px',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-v431-today-selected-day-room',320);
 await host.locator('#mobileNav [data-route="today"]').click();
 await expect(host.locator('.right-stack .section-head h2').first()).toContainText('今日の予定');
 const day=host.locator('.strip .day-chip:not(.active)').first();
 const date=await day.getAttribute('data-date');
 await day.click();
 await expect(host.locator('.right-stack .section-head h2').first()).toContainText('選択日の予定');
 await expect(host.locator('.origin-today-shortcuts [data-kind="events"]')).toHaveAttribute('data-date',date);
 await expect(host.locator('.origin-today-todo-add')).toBeVisible();
 const width=await page.evaluate(()=>document.documentElement.scrollWidth);
 expect(width).toBeLessThanOrEqual(323);
});


test('Origin inspector keeps actions distinct on a 320px screen',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-v434-inspector-actions-room',320);
 const response=await page.evaluate(()=>window.WorkBoardPaletteBridge.dispatch({
   type:'todo.create',text:'詳細パネルの操作確認',memo:'変更前のメモ'
 }));
 expect(response?.ok).toBe(true);
 await host.locator('#mobileNav [data-route="todos"]').click();
 await host.locator('.origin-todo-list .todo-text',{hasText:'詳細パネルの操作確認'}).click();
 const sheet=host.locator('#sheet');
 await expect(sheet.locator('.origin-sheet-primary button')).toHaveCount(2);
 await expect(sheet.locator('.origin-sheet-primary [data-action="edit"]')).toBeVisible();
 await expect(sheet.locator('.origin-sheet-secondary [data-action="todo-toggle"]')).toBeVisible();
 await expect(sheet.locator('.origin-sheet-danger')).toHaveCount(0);
 const actions=await sheet.locator('.origin-sheet-primary button').evaluateAll(buttons=>
   buttons.map(el=>({x:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,
     top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,
     height:el.getBoundingClientRect().height})));
 expect(actions.every(a=>a.x>=-1&&a.right<=321&&a.height>=44)).toBe(true);
 expect(actions[0].right).toBeLessThanOrEqual(actions[1].x);
 await sheet.locator('[data-action="edit"]').click();
 await expect(sheet.locator('#editForm[data-kind="todos"]')).toBeVisible();
 await expect(sheet.locator('.origin-sheet-primary button[form="editForm"]')).toBeVisible();
 await expect(sheet.locator('.origin-sheet-danger [data-action="delete"]')).toHaveCount(1);
 const deleteRect=await sheet.locator('.origin-sheet-danger').boundingBox();
 const saveRect=await sheet.locator('.origin-sheet-primary').boundingBox();
 expect(deleteRect.y).toBeGreaterThan(saveRect.y+saveRect.height);
 await sheet.locator('.origin-sheet-primary [data-action="close"]').click();
 await expect(host.locator('#overlay')).toBeHidden();
 const data=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().todos.find(t=>t.text==='詳細パネルの操作確認'));
 expect(data?.memo).toBe('変更前のメモ');
});

test('Origin memo inspector keeps paper color and exposes all swatches',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-v434-memo-inspector-room',390);
 await page.evaluate(async()=>{
   const memo=window.WorkBoardPaletteMemoBridgeV369;
   const {roomId,currentUser}=window.WorkBoardPaletteBridge.readSnapshot();
   const result=await memo.dispatch({
     type:'memo.create',ownerRoom:roomId,ownerUser:currentUser,title:'色を引き継ぐメモ',
     body:'詳細でもピーチ色を維持する',category:'手順',tags:[],pinned:false,paperColor:'peach'
   });
   if(!result?.ok)throw new Error('memo create failed');
 });
 await host.locator('#mobileNav [data-route="notes"]').click();
 await host.locator('.origin-memo-shell .memo-card',{hasText:'色を引き継ぐメモ'}).click();
 const sheet=host.locator('#sheet');
 await expect(sheet.locator('.origin-memo-paper')).toHaveAttribute('data-paper-color','peach');
 await expect(sheet.locator('.origin-memo-paper')).toContainText('詳細でもピーチ色を維持する');
 await sheet.locator('.origin-sheet-primary [data-action="edit"]').click();
 const palette=sheet.locator('.origin-memo-palette');
 await expect(palette.locator('input[name="paperColor"]')).toHaveCount(6);
 await expect(palette.locator('input[value="peach"]')).toBeChecked();
 const choiceHeight=await palette.locator('label[data-paper-color="peach"]').evaluate(el=>el.getBoundingClientRect().height);
 expect(choiceHeight).toBeGreaterThanOrEqual(44);
 await sheet.locator('.origin-sheet-primary [data-action="close"]').click();
 await expect(host.locator('#overlay')).toBeHidden();
});


test('Origin keyboard inspector keeps focus inside the drawer and protects unsaved drafts',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-v438-keyboard-inspector-room',1366);
 await page.evaluate(async()=>{
   for(const text of ['鍵盤操作の確認A','鍵盤操作の確認B']){
     const result=await window.WorkBoardPaletteBridge.dispatch({type:'todo.create',text,memo:'元の補足'});
     if(!result?.ok)throw Error('todo.create: '+result?.error);
   }
 });
 await host.locator('#desktopNav [data-route="todos"]').click();
 const rows=host.locator('.origin-todo-list .todo-text');
 await expect(rows).toHaveCount(2);
 const titles=await rows.allTextContents();
 await rows.first().click();
 const sheet=host.locator('#sheet');
 await expect(sheet.locator('#panelHeading')).toHaveText(titles[0]);
 await page.keyboard.press('ArrowRight');
 await expect(sheet.locator('#panelHeading')).toHaveText(titles[1]);
 await page.keyboard.press('ArrowLeft');
 await expect(sheet.locator('#panelHeading')).toHaveText(titles[0]);
 const last=sheet.locator('.origin-sheet-secondary [data-action="todo-toggle"]');
 await last.focus();
 await page.keyboard.press('Tab');
 await expect(sheet.locator('.sheet-close')).toBeFocused();
 await page.keyboard.press('Shift+Tab');
 await expect(last).toBeFocused();
 await page.keyboard.press('Control+k');
 await expect(last).toBeFocused();
 await sheet.locator('.origin-sheet-primary [data-action="edit"]').click();
 const form=sheet.locator('#editForm[data-kind="todos"]');
 await form.locator('[name="memo"]').fill('保存前の補足');
 page.once('dialog',dialog=>dialog.dismiss());
 await page.keyboard.press('Escape');
 await expect(form).toBeVisible();
 await expect(form.locator('[name="memo"]')).toHaveValue('保存前の補足');
 page.once('dialog',dialog=>dialog.accept());
 await page.keyboard.press('Escape');
 await expect(host.locator('#overlay')).toBeHidden();
 const saved=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().todos);
 expect(saved.every(x=>x.memo==='元の補足')).toBe(true);
});


test('Origin status changes update open ToDo details without having to reopen them',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-inspector-status-refresh-room',390);
 const result=await page.evaluate(()=>window.WorkBoardPaletteBridge.dispatch({
   type:'todo.create',text:'状態更新の表示確認',memo:'操作前からある補足'
 }));
 expect(result?.ok).toBe(true);
 await host.locator('#mobileNav [data-route="todos"]').click();
 await host.locator('.origin-todo-list .todo-text',{hasText:'状態更新の表示確認'}).click();
 const sheet=host.locator('#sheet');
 const toggle=sheet.locator('.origin-sheet-secondary [data-action="todo-toggle"]');
 await expect(toggle).toHaveText('完了にする');
 await toggle.click();
 await expect(toggle).toHaveText('未完了に戻す');
 await expect(sheet.locator('.record-meta')).toContainText('完了');
 await expect(toggle).toBeFocused();
 await expect(sheet).toContainText('操作前からある補足');
 await toggle.click();
 await expect(toggle).toHaveText('完了にする');
 await expect(toggle).toBeFocused();
 const canonical=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().todos.find(t=>t.text==='状態更新の表示確認'));
 expect(canonical?.completed).toBe(false);
 await sheet.locator('.sheet-close').click();
 await expect(host.locator('.origin-todo-list .todo-text',{hasText:'状態更新の表示確認'})).toBeVisible();
});

test('Origin mobile swipe navigates detail without hijacking vertical scroll or editing',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-mobile-swipe-v442-room',390);
 await page.evaluate(async()=>{
   for(const text of ['スワイプ項目A','スワイプ項目B']){
     const result=await window.WorkBoardPaletteBridge.dispatch({type:'todo.create',text,memo:'編集しても保持'});
     if(!result?.ok)throw Error('Failed to create test ToDo: '+result?.error);
   }
 });
 await host.locator('#mobileNav [data-route="todos"]').click();
 const rows=host.locator('.origin-todo-list .todo-text');
 await expect(rows).toHaveCount(2);
 const titles=await rows.allTextContents();
 await rows.first().click();
 const sheet=host.locator('#sheet');
 await expect(sheet.locator('#panelHeading')).toHaveText(titles[0]);
 const simulateSwipe=(dx,dy)=>page.evaluate(([dx,dy])=>{
   const root=document.querySelector('#modernOriginRoot').shadowRoot;
   const body=root.querySelector('#sheet .sheet-body');
   const target=body.querySelector('.record-meta')||body;
   const first={identifier:7,clientX:205,clientY:280};
   const begin=new Event('touchstart',{bubbles:true});
   Object.defineProperty(begin,'touches',{value:[first]});
   target.dispatchEvent(begin);
   const finish=new Event('touchend',{bubbles:true});
   Object.defineProperty(finish,'changedTouches',{value:[{
     identifier:7,clientX:205+dx,clientY:280+dy
   }]});
   target.dispatchEvent(finish);
 },[dx,dy]);
 await simulateSwipe(-125,8);
 await expect(sheet.locator('#panelHeading')).toHaveText(titles[1]);
 await simulateSwipe(9,-135);
 await expect(sheet.locator('#panelHeading')).toHaveText(titles[1]);
 await simulateSwipe(126,-4);
 await expect(sheet.locator('#panelHeading')).toHaveText(titles[0]);
 const pager=await sheet.locator('.origin-detail-pager').evaluate(el=>{
   const css=getComputedStyle(el);
   return {position:css.position,minHeight:Math.min(...Array.from(
     el.querySelectorAll('button')).map(btn=>btn.getBoundingClientRect().height))};
 });
 expect(pager.position).toBe('sticky');
 expect(pager.minHeight).toBeGreaterThanOrEqual(44);
 await sheet.locator('[data-action="edit"]').click();
 await expect(sheet.locator('#editForm')).toBeVisible();
 await sheet.locator('#editForm [name="memo"]').fill('下書きの内容');
 await simulateSwipe(-128,0);
 await expect(sheet.locator('#editForm [name="memo"]')).toHaveValue('下書きの内容');
 page.once('dialog',dialog=>dialog.accept());
 await sheet.locator('.sheet-close').click();
 const saved=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().todos);
 expect(saved.every(x=>x.memo==='編集しても保持')).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(393);
});


test('Origin global search ranks results, filters types and supports keyboard and mobile',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-global-search-v443-room',1366);
 const fixture=await page.evaluate(async()=>{
   const bridge=window.WorkBoardPaletteBridge;
   for(const text of ['統合検索検証 A','設備の統合検索検証 B']){
     const result=await bridge.dispatch({type:'todo.create',text,memo:'入力確認'});
     if(!result?.ok)throw Error('Unable to create search fixture: '+result?.error);
   }
   const memo=window.WorkBoardPaletteMemoBridgeV369;
   const {roomId,currentUser}=bridge.readSnapshot();
   const saved=await memo.dispatch({type:'memo.create',ownerRoom:roomId,ownerUser:currentUser,
     title:'統合検索検証メモ',body:'検索対象の内容',category:'手順',tags:[],pinned:false,paperColor:'ivory'});
   if(!saved?.ok)throw Error('Unable to create memo fixture: '+saved?.error);
   return {todoCount:bridge.readSnapshot().todos.length,memoCount:memo.readSnapshot().length};
 });
 const input=host.locator('#originSearchInput'),results=host.locator('#searchResults');
 await input.fill('統合検索検証');
 await expect(results).toBeVisible();
 await expect(results.locator('.origin-search-filters button')).toHaveCount(5);
 await expect(results.locator('.search-hit')).toHaveCount(3);
 await expect(results.locator('.origin-search-summary')).toContainText('3件');
 await results.locator('[data-action="search-kind"][data-value="memos"]').click();
 await expect(results.locator('.search-hit')).toHaveCount(1);
 await expect(results.locator('.search-hit')).toContainText('統合検索検証メモ');
 await expect(results.locator('[data-value="memos"]')).toHaveAttribute('aria-pressed','true');
 await results.locator('[data-action="search-kind"][data-value="todos"]').click();
 await expect(results.locator('.search-hit')).toHaveCount(2);
 await input.focus();
 await page.keyboard.press('ArrowDown');
 await expect(results.locator('.search-hit').first()).toBeFocused();
 await page.keyboard.press('ArrowDown');
 await expect(results.locator('.search-hit').nth(1)).toBeFocused();
 await page.keyboard.press('ArrowUp');
 await expect(results.locator('.search-hit').first()).toBeFocused();
 await page.keyboard.press('ArrowUp');
 await expect(input).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(host.locator('#overlay')).toBeVisible();
 await expect(host.locator('#sheet #panelHeading')).toContainText('統合検索検証');
 await host.locator('#sheet .sheet-close').click();
 await input.focus();
 await expect(results).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(results).toBeHidden();
 await expect(input).toHaveValue('');
 await expect(input).toHaveAttribute('aria-expanded','false');
 await page.setViewportSize({width:320,height:760});
 await input.fill('統合検索検証');
 await expect(results).toBeVisible();
 const popup=await results.evaluate(el=>{
   const r=el.getBoundingClientRect();
   return {left:r.left,right:r.right,width:r.width};
 });
 expect(popup.left).toBeGreaterThanOrEqual(-1);
 expect(popup.right).toBeLessThanOrEqual(321);
 expect(popup.width).toBeGreaterThan(250);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(323);
 const after=await page.evaluate(()=>({
   todoCount:window.WorkBoardPaletteBridge.readSnapshot().todos.length,
   memoCount:window.WorkBoardPaletteMemoBridgeV369.readSnapshot().length
 }));
 expect(after).toEqual(fixture);
});


test('Origin task groups collapse without changing data or resetting mobile status rail',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-v445-task-groups-room',390);
 const original=await page.evaluate(async()=>{
   const bridge=window.WorkBoardPaletteBridge,snapshot=bridge.readSnapshot();
   for(const title of ['定期点検A','定期点検B']){
     const saved=await bridge.dispatch({
       type:'task.create',ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser,
       revision:0,assignee:snapshot.currentUser,
       status:snapshot.statuses.includes('未着手')?'未着手':snapshot.statuses[0],
       category:snapshot.categories[0],title,description:'一覧を折りたたむ',
       requester:'',tags:'',checklist:'',checklistDone:[],priority:'中',
       dueDate:'',dueTime:'',pinned:false
     });
     if(!saved?.ok)throw Error('task fixture failed: '+saved?.error);
   }
   return bridge.readSnapshot().tasks.map(t=>({id:t.id,revision:t.revision,dueDate:t.dueDate}));
 });
 await host.locator('#mobileNav [data-route="tasks"]').click();
 const group=host.locator('.origin-task-group-toggle').first();
 const rows=host.locator('.origin-task-collection .item-row');
 await expect(rows).toHaveCount(2);
 await expect(group).toHaveAttribute('aria-expanded','true');
 const advanced=host.locator('[data-action="task-advanced-toggle"]');
 await advanced.click();
 const rail=host.locator('.status-rail');
 const scroll=await rail.evaluate(el=>{el.scrollLeft=120;return el.scrollLeft});
 expect(scroll).toBeGreaterThan(20);
 await rows.first().locator('[data-action="bulk-toggle"]').check();
 await expect(host.locator('.bulkbar')).toContainText('1件選択中');
 await group.click();
 await expect(host.locator('.bulkbar')).toHaveCount(0);
 await expect(group).toHaveAttribute('aria-expanded','false');
 await expect(rows.first()).toBeHidden();
 expect(await rail.evaluate(el=>el.scrollLeft)).toBeGreaterThanOrEqual(scroll-2);
 await expect(group).toBeFocused();
 await group.click();
 await expect(rows).toHaveCount(2);
 await expect(rows.first()).toBeVisible();
 await rows.first().locator('.item-name').click();
 const sheet=host.locator('#sheet');
 await expect(sheet).toContainText('定期点検');
 await sheet.locator('.sheet-close').click();
 await expect(rows.first().locator('.item-name')).toBeFocused();
 await host.locator('#originTaskQuery').fill('定期点検A');
 await expect(rows).toHaveCount(1);
 await expect(host.locator('.origin-filter-current')).toContainText('定期点検A');
 await host.locator('[data-action="task-reset"]').click();
 await expect(rows).toHaveCount(2);
 const after=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks
   .map(t=>({id:t.id,revision:t.revision,dueDate:t.dueDate})));
 expect(after).toEqual(original);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(393);
});

test('Origin memo compact list preserves card workflow and filtered position at 320px',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-v445-memo-list-room',1366);
 const original=await page.evaluate(async()=>{
   const memo=window.WorkBoardPaletteMemoBridgeV369;
   const {roomId,currentUser}=window.WorkBoardPaletteBridge.readSnapshot();
   for(const title of ['手順書A','手順書B','別のメモ']){
     const saved=await memo.dispatch({
       type:'memo.create',ownerRoom:roomId,ownerUser:currentUser,
       title,body:'同じページで操作しやすい一覧表示の説明です。'.repeat(4),
       category:'手順',tags:[],pinned:false,paperColor:'mint'
     });
     if(!saved?.ok)throw Error('memo fixture failed: '+saved?.error);
   }
   return memo.readSnapshot().map(x=>({id:x.id,revision:x.revision,updatedAt:x.updatedAt}));
 });
 await host.locator('#desktopNav [data-route="notes"]').click();
 const cards=host.locator('.origin-memo-shell .memo-card'),grid=host.locator('.memo-grid');
 await expect(cards).toHaveCount(3);
 const cardHeight=await cards.first().evaluate(el=>el.getBoundingClientRect().height);
 await host.locator('[data-action="memo-layout"][data-value="list"]').click();
 await expect(grid).toHaveClass(/origin-memo-list/);
 const listHeight=await cards.first().evaluate(el=>el.getBoundingClientRect().height);
 expect(listHeight).toBeLessThan(cardHeight-20);
 const title=await cards.first().locator('h3').textContent();
 await cards.first().click();
 await expect(host.locator('#sheet #panelHeading')).toHaveText(title.trim());
 await host.locator('#sheet .sheet-close').click();
 await expect(cards.first()).toBeFocused();
 await host.locator('#originMemoQuery').fill('手順書');
 await expect(cards).toHaveCount(2);
 await expect(host.locator('.origin-filter-current')).toContainText('手順書');
 await page.setViewportSize({width:320,height:760});
 // Every swatch remains touch-sized, in one horizontally scrollable strip.
 const swatches=host.locator('.origin-memo-list .origin-memo-shell').first().locator('.origin-color-dot');
 await expect(swatches).toHaveCount(6);
 const targets=await swatches.evaluateAll(nodes=>nodes.map(el=>{
   const r=el.getBoundingClientRect();return {top:r.top,height:r.height};
 }));
 expect(Math.max(...targets.map(t=>t.top))-Math.min(...targets.map(t=>t.top))).toBeLessThan(2);
 expect(targets.every(t=>t.height>=44)).toBe(true);
 await expect(host.locator('[data-action="memo-advanced-toggle"]')).toHaveAttribute('aria-expanded','false');
 await host.locator('[data-action="memo-advanced-toggle"]').click();
 const colors=host.locator('.origin-memo-filters');
 const left=await colors.evaluate(el=>{el.scrollLeft=90;return el.scrollLeft});
 expect(left).toBeGreaterThan(15);
 await host.locator('#originMemoSort').selectOption('title');
 expect(await colors.evaluate(el=>el.scrollLeft)).toBeGreaterThanOrEqual(left-2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(323);
 await host.locator('[data-action="memo-layout"][data-value="cards"]').click();
 await expect(grid).not.toHaveClass(/origin-memo-list/);
 await expect(cards).toHaveCount(2);
 await host.locator('[data-action="memo-reset"]').click();
 await expect(cards).toHaveCount(3);
 const after=await page.evaluate(()=>window.WorkBoardPaletteMemoBridgeV369.readSnapshot()
   .map(x=>({id:x.id,revision:x.revision,updatedAt:x.updatedAt})));
 expect(after).toEqual(original);
});


test('Origin memo consecutive saves restore the updated card focus and the list position',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-memo-focus-return-v446-room',1366);
 const original=await page.evaluate(async()=>{
   const bridge=window.WorkBoardPaletteMemoBridgeV369;
   const {roomId,currentUser}=window.WorkBoardPaletteBridge.readSnapshot();
   for(const title of ['連続編集A','連続編集B']){
     const response=await bridge.dispatch({
       type:'memo.create',ownerRoom:roomId,ownerUser:currentUser,title,
       body:'最初の内容',category:'手順',tags:[],pinned:false,paperColor:'mint'
     });
     if(!response?.ok)throw Error('memo fixture failed: '+response?.error);
   }
   const item=bridge.readSnapshot().find(x=>x.title==='連続編集A');
   return {id:item.id,revision:item.revision};
 });
 await host.locator('#desktopNav [data-route="notes"]').click();
 await host.evaluate(el=>{
   const style=document.createElement('style');
   style.textContent='#workspace{min-height:2100px}';
   el.shadowRoot.appendChild(style);
 });
 const card=host.locator('.origin-memo-shell .memo-card[data-id="'+original.id+'"]');
 const initialScroll=await page.evaluate(()=>{window.scrollTo(0,360);return window.scrollY});
 expect(initialScroll).toBeGreaterThan(250);
 // DOM click intentionally avoids Playwright scrolling the card into view.
 await card.evaluate(el=>el.click());
 const sheet=host.locator('#sheet');
 await expect(sheet.locator('#panelHeading')).toHaveText('連続編集A');
 await sheet.locator('[data-action="edit"]').click();
 await sheet.locator('#editForm [name="title"]').fill('連続編集A・更新済み');
 await sheet.locator('button[form="editForm"]').click();
 await expect(host.locator('#overlay')).toBeHidden();
 await expect(card).toBeFocused();
 await expect(card.locator('h3')).toHaveText('連続編集A・更新済み');
 expect(await page.evaluate(()=>window.scrollY)).toBeGreaterThanOrEqual(initialScroll-2);
 // Open the same canonical memo again without revisiting the navigation.
 await card.evaluate(el=>el.click());
 await sheet.locator('[data-action="edit"]').click();
 await sheet.locator('#editForm [name="body"]').fill('連続編集の2回目の内容');
 await sheet.locator('button[form="editForm"]').click();
 await expect(host.locator('#overlay')).toBeHidden();
 await expect(card).toBeFocused();
 await expect(card.locator('p')).toContainText('連続編集の2回目の内容');
 expect(await page.evaluate(()=>window.scrollY)).toBeGreaterThanOrEqual(initialScroll-2);
 const saved=await page.evaluate(id=>window.WorkBoardPaletteMemoBridgeV369
   .readSnapshot().find(item=>item.id===id),original.id);
 expect(saved.title).toBe('連続編集A・更新済み');
 expect(saved.body).toBe('連続編集の2回目の内容');
 expect(saved.revision).toBeGreaterThanOrEqual(original.revision+2);
});

test('Origin search result detail returns to the same query and type filter',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-search-return-v446-room',1366);
 await page.evaluate(async()=>{
   const bridge=window.WorkBoardPaletteMemoBridgeV369;
   const {roomId,currentUser}=window.WorkBoardPaletteBridge.readSnapshot();
   const created=await bridge.dispatch({
     type:'memo.create',ownerRoom:roomId,ownerUser:currentUser,
     title:'戻り先検索テスト',body:'検索の続き',category:'手順',
     tags:[],pinned:false,paperColor:'ivory'
   });
   if(!created?.ok)throw Error('memo fixture failed: '+created?.error);
 });
 const search=host.locator('#originSearchInput'),results=host.locator('#searchResults');
 await search.fill('戻り先検索');
 await results.locator('[data-action="search-kind"][data-value="memos"]').click();
 await expect(results.locator('[data-action="search-kind"][data-value="memos"]')).toHaveAttribute('aria-pressed','true');
 await results.locator('.search-hit').first().click();
 await expect(host.locator('#sheet #panelHeading')).toHaveText('戻り先検索テスト');
 await host.locator('#sheet .sheet-close').click();
 await expect(host.locator('#overlay')).toBeHidden();
 await expect(results.locator('.search-hit').first()).toBeFocused();
 await expect(search).toHaveValue('戻り先検索');
 await expect(results).toBeVisible();
 await expect(results.locator('[data-action="search-kind"][data-value="memos"]')).toHaveAttribute('aria-pressed','true');
 await expect(results.locator('.search-hit')).toHaveCount(1);
});


test('Origin filtered memo recolor keeps keyboard focus on a visible item or color filter',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-color-filter-focus-room',390);
 const fixtures=await page.evaluate(async()=>{
   const bridge=window.WorkBoardPaletteMemoBridgeV369;
   const {roomId,currentUser}=window.WorkBoardPaletteBridge.readSnapshot();
   for(const title of ['移動するメモ','残るメモ']){
     const saved=await bridge.dispatch({
       type:'memo.create',ownerRoom:roomId,ownerUser:currentUser,title,
       body:'色別に整理する',category:'手順',tags:[],pinned:false,paperColor:'mint'
     });
     if(!saved?.ok)throw Error('memo fixture failed: '+saved?.error);
   }
   return bridge.readSnapshot().map(({id,updatedAt})=>({id,updatedAt}));
 });
 await host.locator('#mobileNav [data-route="notes"]').click();
 await host.locator('[data-action="memo-advanced-toggle"]').click();
 const mintFilter=host.locator('[data-action="memo-color-filter"][data-value="mint"]');
 await mintFilter.click();
 const cards=host.locator('.origin-memo-shell .memo-card');
 await expect(cards).toHaveCount(2);
 const disappearing=host.locator('.origin-memo-shell',{hasText:'移動するメモ'});
 await disappearing.locator('[data-action="memo-color"][data-value="peach"]').click();
 await expect(cards).toHaveCount(1);
 await expect(cards).toContainText('残るメモ');
 await expect(cards.first()).toBeFocused();
 await expect(mintFilter).toHaveAttribute('aria-pressed','true');
 await host.locator('.origin-memo-shell [data-action="memo-color"][data-value="peach"]').click();
 await expect(cards).toHaveCount(0);
 await expect(mintFilter).toBeFocused();
 await expect(host.locator('.origin-memo-result')).toContainText('表示 0件');
 const after=await page.evaluate(()=>window.WorkBoardPaletteMemoBridgeV369.readSnapshot()
   .map(({id,updatedAt})=>({id,updatedAt})));
 expect(after).toEqual(fixtures);
});

test('Origin removes remotely completed tasks from bulk selection before acting',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-bulk-filter-sync-room',390);
 const ids=await page.evaluate(async()=>{
   const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
   for(const title of ['端末確認A','端末確認B']){
     const added=await bridge.dispatch({
       type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,
       assignee:s.currentUser,status:s.statuses.includes('未着手')?'未着手':s.statuses[0],
       category:s.categories[0],title,description:'選択の同期確認',
       requester:'',tags:'',checklist:'',checklistDone:[],priority:'中',
       dueDate:'',dueTime:'',pinned:false,revision:0
     });
     if(!added?.ok)throw Error('task fixture failed: '+added?.error);
   }
   return bridge.readSnapshot().tasks.map(({id})=>id);
 });
 await host.locator('#mobileNav [data-route="tasks"]').click();
 const rows=host.locator('.origin-task-collection .item-row');
 await expect(rows).toHaveCount(2);
 const selected=rows.first().locator('[data-action="bulk-toggle"]');
 const targetId=await selected.getAttribute('data-id');
 expect(ids).toContain(targetId);
 await selected.check();
 await expect(host.locator('.bulkbar')).toContainText('1件選択中');
 // The completion action normally requests a completion memo. Simulate a remote
 // state transition through the existing non-interactive canonical writer.
 const result=await page.evaluate(id=>{
   const bridge=window.WorkBoardPaletteBridge;
   const status=bridge.readSnapshot().statuses.find(value=>value==='完了');
   if(!status)throw Error('Canonical completed status is unavailable');
   return bridge.dispatch({type:'task.status',id,status});
 },targetId);
 expect(result?.ok).toBe(true);
 await expect(rows).toHaveCount(1);
 await expect(host.locator('.bulkbar')).toHaveCount(0);
 await expect(rows.first().locator('[data-action="bulk-toggle"]')).toBeFocused();
 const saved=await page.evaluate(id=>window.WorkBoardPaletteBridge.readSnapshot()
   .tasks.find(t=>t.id===id),targetId);
 expect(saved?.completed).toBe(true);
});


test('Origin task and memo lists keep readable typography with compact touch targets',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-list-legibility-v447-room',1366);
 await page.evaluate(async()=>{
   const work=window.WorkBoardPaletteBridge, user=work.readSnapshot();
   const task=await work.dispatch({
     type:'task.create',ownerRoom:user.roomId,ownerUser:user.currentUser,
     assignee:user.currentUser,status:user.statuses.includes('未着手')?'未着手':user.statuses[0],
     category:user.categories[0],title:'一覧文字サイズの確認',description:'補足の表示',
     requester:'',tags:'',checklist:'',checklistDone:[],priority:'中',
     dueDate:'',dueTime:'',pinned:false,revision:0
   });
   if(!task?.ok)throw Error('test task not created: '+task?.error);
   const memos=window.WorkBoardPaletteMemoBridgeV369;
   const memo=await memos.dispatch({
     type:'memo.create',ownerRoom:user.roomId,ownerUser:user.currentUser,
     title:'カード情報密度の確認',body:'重要な文章が読みやすいことを確認する。',
     category:'手順',tags:[],pinned:false,paperColor:'mint'
   });
   if(!memo?.ok)throw Error('test memo not created: '+memo?.error);
 });
 await host.locator('#desktopNav [data-route="tasks"]').click();
 const taskTitle=host.locator('.origin-task-collection .item-name');
 await expect(taskTitle).toHaveCount(1);
 const desktopFont=await taskTitle.evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
 expect(desktopFont).toBeGreaterThanOrEqual(14);
 const groups=host.locator('.origin-task-group-toggle');
 expect(await groups.first().evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 await host.locator('#desktopNav [data-route="notes"]').click();
 const card=host.locator('.origin-memo-shell .memo-card');
 await expect(card).toHaveCount(1);
 const cardVisual=await card.evaluate(el=>{
   const h=el.getBoundingClientRect().height;
   return {height:h,titleSize:parseFloat(getComputedStyle(el.querySelector('h3')).fontSize),
     bodySize:parseFloat(getComputedStyle(el.querySelector('p')).fontSize)};
 });
 expect(cardVisual.height).toBeLessThanOrEqual(205);
 expect(cardVisual.titleSize).toBeGreaterThanOrEqual(15);
 expect(cardVisual.bodySize).toBeGreaterThanOrEqual(13);
 const dots=host.locator('.origin-memo-shell .origin-color-dot');
 await expect(dots).toHaveCount(6);
 expect(await dots.evaluateAll(els=>els.every(el=>el.getBoundingClientRect().height>=44))).toBe(true);
 await host.locator('[data-action="memo-layout"][data-value="list"]').click();
 await expect(host.locator('.memo-grid')).toHaveClass(/origin-memo-list/);
 await page.setViewportSize({width:390,height:800});
 const mobileSize=await card.locator('h3').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
 expect(mobileSize).toBeGreaterThanOrEqual(15);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(393);
});


test('Origin long titles and theme contrast fit at 320, 390 and desktop widths',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-responsive-long-content-v450-room',320);
 await page.evaluate(async()=>{
   const bridge=window.WorkBoardPaletteBridge,snapshot=bridge.readSnapshot();
   const long='設備点検の依頼と詳細確認'.repeat(5);
   const task=await bridge.dispatch({
     type:'task.create',ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser,
     assignee:snapshot.currentUser,status:snapshot.statuses.includes('未着手')?'未着手':snapshot.statuses[0],
     category:snapshot.categories[0],title:long,description:long,
     requester:'',tags:'',checklist:'',checklistDone:[],priority:'中',
     dueDate:'',dueTime:'',pinned:false,revision:0
   });
   if(!task?.ok)throw Error('task fixture failed: '+task?.error);
   const todo=await bridge.dispatch({type:'todo.create',text:long,memo:''});
   if(!todo?.ok)throw Error('todo fixture failed: '+todo?.error);
   const memo=await window.WorkBoardPaletteMemoBridgeV369.dispatch({
     type:'memo.create',ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser,
     title:long,body:long.repeat(2),category:'手順',tags:[],pinned:false,paperColor:'mint'
   });
   if(!memo?.ok)throw Error('memo fixture failed: '+memo?.error);
 });
 const routes=['tasks','todos','calendar','notes'];
 for(const width of [320,390,1366]){
   await page.setViewportSize({width,height:820});
   for(const theme of ['light','dark']){
     if(await host.getAttribute('data-theme')!==theme)await host.locator('#themeBtn').click();
     await expect(host).toHaveAttribute('data-theme',theme);
     const contrast=await host.locator('#createBtn').evaluate(el=>{
       const css=getComputedStyle(el);
       const channels=value=>value.match(/[\d.]+/g)?.slice(0,3).map(Number)||[];
       const luminance=channel=>{
         const c=channel/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
       };
       const toLight=value=>{
         const [r,g,b]=channels(value);
         return .2126*luminance(r)+.7152*luminance(g)+.0722*luminance(b);
       };
       const a=toLight(css.color),b=toLight(css.backgroundColor);
       return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
     });
     expect(contrast).toBeGreaterThanOrEqual(4.5);
     for(const route of routes){
       const nav=width<=770?'#mobileNav':'#desktopNav';
       await host.locator(nav+' [data-route="'+route+'"]').click();
       const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
       expect(overflow,route+' at '+width+'px '+theme).toBeLessThanOrEqual(3);
       const selector=route==='tasks'?'.origin-task-collection .item-name'
         :route==='todos'?'.origin-todo-main .todo-entry .todo-text'
         :route==='notes'?'.origin-memo-shell .memo-card h3':null;
       if(selector){
         const title=host.locator(selector).first();
         await expect(title).toBeVisible();
         const appearance=await title.evaluate(el=>{
           const css=getComputedStyle(el),height=el.getBoundingClientRect().height;
           return {clamp:css.webkitLineClamp,height,line:parseFloat(css.lineHeight),
             inset:parseFloat(css.paddingTop)+parseFloat(css.paddingBottom)
               +parseFloat(css.borderTopWidth)+parseFloat(css.borderBottomWidth),
             width:el.getBoundingClientRect().width};
         });
         expect(appearance.clamp).toBe('2');
         expect(appearance.height-appearance.inset).toBeLessThanOrEqual(appearance.line*2+3);
         expect(appearance.width).toBeGreaterThan(20);
         // Visually clamped titles remain available in full without opening
         // the record; desktop users can hover, touch users still open details.
         const openTarget=route==='notes'?title.locator('..'):title;
         expect(await openTarget.getAttribute('title')).toBe((await title.textContent()).trim());
       }else{
         await expect(host.locator('.origin-schedule-view')).toBeVisible();
       }
     }
   }
 }
});


test('Origin 320px search keeps arrow-key results visible and remembers category rail scroll',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-mobile-search-rail-v456-room',320);
 await page.evaluate(async()=>{
   const bridge=window.WorkBoardPaletteBridge;
   for(let index=0;index<12;index++){
     const result=await bridge.dispatch({
       type:'todo.create',text:'検索移動検査 '+String(index+1).padStart(2,'0'),memo:''
     });
     if(!result?.ok)throw Error('Search fixture creation failed: '+result?.error);
   }
 });
 const input=host.locator('#originSearchInput'),results=host.locator('#searchResults');
 await input.fill('検索移動検査');
 await expect(results).toBeVisible();
 await expect(results.locator('.search-hit')).toHaveCount(10);
 await expect(results.locator('.origin-search-summary')).toContainText('12件');
 await input.press('ArrowDown');
 for(let index=0;index<9;index++)await page.keyboard.press('ArrowDown');
 const last=results.locator('.search-hit').nth(9);
 await expect(last).toBeFocused();
 const measured=await results.evaluate(panel=>{
   const target=panel.querySelectorAll('.search-hit')[9];
   const frame=panel.getBoundingClientRect(),selection=target.getBoundingClientRect();
   return {scroll:panel.scrollTop,top:selection.top,bottom:selection.bottom,
     visibleTop:frame.top,visibleBottom:frame.bottom};
 });
 expect(measured.scroll).toBeGreaterThan(0);
 expect(measured.top).toBeGreaterThanOrEqual(measured.visibleTop-2);
 expect(measured.bottom).toBeLessThanOrEqual(measured.visibleBottom-2);
 const rail=results.locator('.origin-search-filters');
 const priorRail=await rail.evaluate(el=>{
   el.scrollLeft=el.scrollWidth-el.clientWidth;
   return el.scrollLeft;
 });
 expect(priorRail).toBeGreaterThan(0);
 // Change facets without Playwright moving the rail itself.
 await results.locator('[data-action="search-kind"][data-value="memos"]').evaluate(el=>el.click());
 await expect(results.locator('.search-hit')).toHaveCount(0);
 await expect(results.locator('[data-value="memos"]')).toHaveAttribute('aria-pressed','true');
 const afterRail=await rail.evaluate(el=>el.scrollLeft);
 expect(afterRail).toBeGreaterThanOrEqual(priorRail-2);
 await expect(results).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(323);
 await input.focus();
 await page.keyboard.press('Escape');
 await expect(results).toBeHidden();
 await expect(input).toHaveValue('');
});


test('Origin mobile returns to the inspected search hit and continues with the next result',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-search-continue-mobile-room',320);
 await page.evaluate(async()=>{
   const bridge=window.WorkBoardPaletteMemoBridgeV369;
   const {roomId,currentUser}=window.WorkBoardPaletteBridge.readSnapshot();
   for(const title of ['連続確認メモA','連続確認メモB']){
     const result=await bridge.dispatch({
       type:'memo.create',ownerRoom:roomId,ownerUser:currentUser,
       title,body:'検索結果から続けて確認するメモ',
       category:'手順',tags:[],pinned:false,paperColor:'mint'
     });
     if(!result?.ok)throw Error('Memo fixture creation failed: '+result?.error);
   }
 });
 const search=host.locator('#originSearchInput'),results=host.locator('#searchResults');
 await search.fill('連続確認メモ');
 await results.locator('[data-action="search-kind"][data-value="memos"]').click();
 const hits=results.locator('.search-hit');
 await expect(hits).toHaveCount(2);
 await hits.first().click();
 await expect(host.locator('#sheet #panelHeading')).toHaveText('連続確認メモA');
 await host.locator('#sheet .sheet-close').click();
 await expect(results).toBeVisible();
 await expect(hits.first()).toBeFocused();
 await expect(search).toHaveValue('連続確認メモ');
 await expect(search).not.toBeFocused();
 await page.keyboard.press('ArrowDown');
 await expect(hits.nth(1)).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(host.locator('#sheet #panelHeading')).toHaveText('連続確認メモB');
 await host.locator('#sheet [data-action="edit"]').click();
 await host.locator('#editForm [name="title"]').fill('検索条件から外れたメモ');
 await host.locator('button[form="editForm"]').click();
 await expect(host.locator('#overlay')).toBeHidden();
 await expect(hits).toHaveCount(1);
 await expect(hits.first()).toBeFocused();
 await expect(results.locator('[data-action="search-kind"][data-value="memos"]'))
   .toHaveAttribute('aria-pressed','true');
 await expect(search).toHaveValue('連続確認メモ');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(323);
 await page.keyboard.press('Escape');
 await expect(results).toBeHidden();
 await expect(search).toHaveValue('');
});


test('Origin 320px and 390px inspectors keep long headings scrollable and footer actions accessible',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-small-inspector-v459-room',320);
 const titles=await page.evaluate(async()=>{
   const bridge=window.WorkBoardPaletteBridge,snapshot=bridge.readSnapshot();
   const longTask='システム担当の点検手順'.repeat(6);
   // Keep the heading long enough for layout checks, but within the canonical 100-character ToDo limit.
   const longTodo='電子カルテ端末の点検予定と未完了項目'.repeat(5);
   const longMemo='業務引継ぎと院内システム運用の注意事項'.repeat(7);
   const task=await bridge.dispatch({
     type:'task.create',ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser,
     assignee:snapshot.currentUser,
     status:snapshot.statuses.includes('未着手')?'未着手':snapshot.statuses[0],
     category:snapshot.categories[0],title:longTask,description:'詳細は一覧から確認',
     requester:'',tags:'',checklist:'',checklistDone:[],priority:'中',
     dueDate:'',dueTime:'',pinned:false,revision:0
   });
   if(!task?.ok)throw Error('task.create failed: '+task?.error);
   const todo=await bridge.dispatch({type:'todo.create',text:longTodo,memo:'補足'});
   if(!todo?.ok)throw Error('todo.create failed: '+todo?.error);
   const memos=window.WorkBoardPaletteMemoBridgeV369;
   const memo=await memos.dispatch({
     type:'memo.create',ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser,
     title:longMemo,body:'必要事項をここに記録します。',
     category:'手順',tags:[],pinned:false,paperColor:'sky'
   });
   if(!memo?.ok)throw Error('memo.create failed: '+memo?.error);
   return {tasks:longTask,todos:longTodo,notes:longMemo};
 });
 const sheet=host.locator('#sheet'),heading=sheet.locator('#panelHeading');
 for(const width of [320,390]){
   await page.setViewportSize({width,height:568});
   for(const entry of [
     {route:'tasks',selector:'.origin-task-collection .item-name',kind:'tasks'},
     {route:'todos',selector:'.origin-todo-main .todo-entry .todo-text',kind:'todos'},
     {route:'notes',selector:'.origin-memo-shell .memo-card',kind:'notes'}
   ]){
     await host.locator('#mobileNav [data-route="'+entry.route+'"]').click();
     await host.locator(entry.selector).first().click();
     await expect(host.locator('#overlay')).toBeVisible();
     await expect(heading).toHaveText(titles[entry.kind]);
     const measured=await sheet.evaluate(el=>{
       const head=el.querySelector('.sheet-head h2'),
         body=el.querySelector('.sheet-body'),
         foot=el.querySelector('.sheet-foot'),
         save=el.querySelector('.origin-sheet-primary button');
       return {h2Height:head.getBoundingClientRect().height,
         h2ScrollHeight:head.scrollHeight,
         bodyHeight:body.getBoundingClientRect().height,
         footerHeight:foot.getBoundingClientRect().height,
         footerScrollHeight:foot.scrollHeight,
         actionHeight:save.getBoundingClientRect().height,
         titleAttr:head.getAttribute('title'),
         viewport:window.innerHeight,
         overflow:document.documentElement.scrollWidth-window.innerWidth};
     });
     expect(measured.h2Height).toBeLessThanOrEqual(Math.min(568*.26,144)+2);
     expect(measured.h2ScrollHeight).toBeGreaterThanOrEqual(measured.h2Height);
     expect(measured.titleAttr).toBe(titles[entry.kind]);
     expect(measured.bodyHeight).toBeGreaterThan(80);
     expect(measured.footerHeight).toBeLessThanOrEqual(Math.min(568*.38,300)+2);
     expect(measured.actionHeight).toBeGreaterThanOrEqual(44);
     expect(measured.overflow).toBeLessThanOrEqual(3);
     await sheet.locator('[data-action="edit"]').click();
     await expect(sheet.locator('#editForm')).toBeVisible();
     const editMetrics=await sheet.evaluate(el=>({
       body:el.querySelector('.sheet-body').getBoundingClientRect().height,
       foot:el.querySelector('.sheet-foot').getBoundingClientRect().height,
       save:el.querySelector('[form="editForm"]').getBoundingClientRect().height
     }));
     expect(editMetrics.body).toBeGreaterThan(70);
     expect(editMetrics.foot).toBeLessThanOrEqual(Math.min(568*.38,300)+2);
     expect(editMetrics.save).toBeGreaterThanOrEqual(44);
     await sheet.locator('.origin-sheet-primary [data-action="close"]').click();
     await expect(host.locator('#overlay')).toBeHidden();
   }
   await host.locator('#mobileNav [data-route="calendar"]').click();
   await host.locator('.agenda-day-head button[data-kind="events"]').first().click();
   await expect(sheet.locator('#editForm[data-kind="events"]')).toBeVisible();
   expect(await sheet.locator('.sheet-body').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThan(70);
   expect(await sheet.locator('.sheet-foot').evaluate(el=>el.getBoundingClientRect().height))
     .toBeLessThanOrEqual(Math.min(568*.38,300)+2);
   await sheet.locator('.origin-sheet-primary [data-action="close"]').click();
   await expect(host.locator('#overlay')).toBeHidden();
 }
});


test('Origin mobile edit survives keyboard-sized viewport changes and protects an unsaved draft',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-mobile-editor-viewport-v586-room',320);
 const created=await page.evaluate(()=>window.WorkBoardPaletteBridge.dispatch({
  type:'todo.create',text:'スマホ入力と未保存表示の確認',memo:'以前の内容'
 }));
 expect(created?.ok).toBe(true);
 await page.setViewportSize({width:320,height:568});
 await host.locator('#mobileNav [data-route="todos"]').click();
 await host.locator('.origin-todo-list .todo-text',{hasText:'スマホ入力と未保存表示の確認'}).click();
 const sheet=host.locator('#sheet');
 await sheet.locator('[data-action="edit"]').click();
 const memo=sheet.locator('#editForm [name="memo"]');
 await memo.fill('編集中のテキストを保護する');
 await expect(sheet.locator('#originDraftState')).toHaveAttribute('data-unsaved','true');
 await page.setViewportSize({width:320,height:300});
 await expect(sheet).toHaveAttribute('data-origin-keyboard','true');
 const metrics=await sheet.evaluate(el=>{
  const body=el.querySelector('.sheet-body').getBoundingClientRect();
  const field=el.querySelector('#editForm [name="memo"]').getBoundingClientRect();
  const foot=el.querySelector('.sheet-foot').getBoundingClientRect();
  return {sheetHeight:el.getBoundingClientRect().height,bodyHeight:body.height,
   fieldVisible:Math.min(field.bottom,body.bottom)-Math.max(field.top,body.top),
   footerHeight:foot.height,viewHeight:window.visualViewport?.height||window.innerHeight};
 });
 expect(metrics.sheetHeight).toBeLessThanOrEqual(metrics.viewHeight+3);
 expect(metrics.bodyHeight).toBeGreaterThan(30);
 expect(metrics.fieldVisible).toBeGreaterThan(20);
 expect(metrics.footerHeight).toBeGreaterThanOrEqual(44);
 await page.setViewportSize({width:320,height:568});
 await expect(sheet).toHaveAttribute('data-origin-keyboard','false');
 page.once('dialog',dialog=>dialog.dismiss());
 await sheet.locator('.sheet-close').click();
 await expect(host.locator('#overlay')).toBeVisible();
 await expect(memo).toHaveValue('編集中のテキストを保護する');
 page.once('dialog',dialog=>dialog.accept());
 await sheet.locator('.sheet-close').click();
 await expect(host.locator('#overlay')).toBeHidden();
 const original=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().todos
  .find(t=>t.text==='スマホ入力と未保存表示の確認')?.memo);
 expect(original).toBe('以前の内容');
});

test('Origin rejects closing while a save is in flight',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-mobile-save-lock-v586-room',390);
 const created=await page.evaluate(()=>window.WorkBoardPaletteBridge.dispatch({
  type:'todo.create',text:'保存中の操作制限',memo:'最初の内容'
 }));
 expect(created?.ok).toBe(true);
 await host.locator('#mobileNav [data-route="todos"]').click();
 await host.locator('.origin-todo-list .todo-text',{hasText:'保存中の操作制限'}).click();
 const sheet=host.locator('#sheet');
 await sheet.locator('[data-action="edit"]').click();
 await sheet.locator('#editForm [name="memo"]').fill('保存後の内容');
 // Inspect the synchronous submit/close boundary before the bridge promise settles.
 const during=await page.evaluate(()=>{
  const root=document.getElementById('modernOriginRoot').shadowRoot;
  root.querySelector('button[form="editForm"]').click();
  const form=root.querySelector('#editForm');
  const saving=form?.getAttribute('aria-busy')==='true';
  const locked=form?.inert===true;
  root.querySelector('.sheet-close').click();
  return {saving,locked,stillOpen:!root.querySelector('#overlay').hidden,
   message:root.querySelector('#originToast').textContent};
 });
 expect(during.saving).toBe(true);
 expect(during.locked).toBe(true);
 expect(during.stillOpen).toBe(true);
 expect(during.message).toContain('保存処理中');
 await expect(host.locator('#overlay')).toBeHidden();
 const saved=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().todos
  .find(t=>t.text==='保存中の操作制限')?.memo);
 expect(saved).toBe('保存後の内容');
});


test('Origin Today routes status counts into matching tasks and opens the selected day',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-v587-status-calendar-room',390);
 await page.evaluate(async()=>{
  const bridge=window.WorkBoardPaletteBridge,snapshot=bridge.readSnapshot();
  if(!snapshot.statuses.includes('確認待ち'))throw Error('Expected status unavailable');
  const past=new Date();past.setDate(past.getDate()-3);
  const dueDate=[past.getFullYear(),String(past.getMonth()+1).padStart(2,'0'),String(past.getDate()).padStart(2,'0')].join('-');
  for(const task of [
   {title:'期限超過の点検確認',status:'未着手',dueDate},
   {title:'確認待ちの依頼事項',status:'確認待ち',dueDate:''}
  ]){
   const out=await bridge.dispatch({type:'task.create',ownerRoom:snapshot.roomId,
    ownerUser:snapshot.currentUser,revision:0,assignee:snapshot.currentUser,
    status:task.status,category:snapshot.categories[0],title:task.title,
    description:'Origin導線テスト',requester:'',tags:'',checklist:'',checklistDone:[],
    priority:'中',dueDate:task.dueDate,dueTime:'',pinned:false});
   if(!out?.ok)throw Error('Unable to create fixture: '+out?.error);
  }
 });
 const metric=host.locator('.status-summary');
 await expect(metric.locator('[data-value="late"]')).toBeVisible();
 await metric.locator('[data-value="late"]').click();
 await expect(host.locator('.origin-task-collection')).toContainText('期限超過の点検確認');
 await expect(host.locator('.origin-task-collection')).not.toContainText('確認待ちの依頼事項');
 await expect(host.locator('.origin-task-summary')).toContainText('期限超過');
 await host.locator('#mobileNav [data-route="today"]').click();
 await metric.locator('[data-value="waiting"]').click();
 await expect(host.locator('.origin-task-collection')).toContainText('確認待ちの依頼事項');
 await expect(host.locator('.origin-task-collection')).not.toContainText('期限超過の点検確認');
 await expect(host.locator('.origin-task-summary')).toContainText('状態：確認待ち');
 await host.locator('#mobileNav [data-route="today"]').click();
 await host.locator('[data-action="today-calendar-day"]').click();
 await expect(host.locator('.origin-day-focus')).toBeVisible();
 await host.locator('[data-action="calendar-view"][data-value="agenda"]').click();
 await expect(host.locator('.origin-agenda-group')).toHaveCount(0);
 await expect(host.locator('.origin-schedule-empty')).toContainText('この週に該当する予定はありません');
 // The empty state disappears after adding an appointment to the selected day.
 await host.locator('[data-action="calendar-view"][data-value="day"]').click();
 await host.locator('.origin-day-add').click();
 const form=host.locator('#editForm[data-kind="events"]');
 const start=(await form.locator('[name="startAt"]').inputValue()).slice(0,10);
 await form.locator('[name="title"]').fill('日別ジャンプの予定');
 await form.locator('[name="startAt"]').fill(start+'T09:00');
 await form.locator('[name="endAt"]').fill(start+'T10:00');
 await host.locator('button[form="editForm"]').click();
 await expect(host.locator('#overlay')).toBeHidden();
 await host.locator('[data-action="calendar-view"][data-value="agenda"]').click();
 await expect(host.locator('.origin-agenda-group')).toHaveCount(1);
 await expect(host.locator('.origin-agenda-group')).toContainText('日別ジャンプの予定');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(393);
});


test('Origin mobile ToDo search opens on demand and finds pending title or memo',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-search-first-todo-v588',320);
 await page.evaluate(async()=>{
  const bridge=window.WorkBoardPaletteBridge;
  for(const [text,memo] of [
   ['ネットワーク確認','作業手順をまとめる'],
   ['端末メンテナンス','ネットワーク機器も確認'],
   ['消耗品の手配','在庫を確認']
  ]){
   const result=await bridge.dispatch({type:'todo.create',text,memo});
   if(!result?.ok)throw Error('todo fixture '+result?.error);
  }
 });
 await host.locator('#mobileNav [data-route="todos"]').click();
 const searchButton=host.locator('[data-action="todo-search-toggle"]');
 const searchPanel=host.locator('#originTodoSearchPanel');
 await expect(searchButton).toHaveAttribute('aria-expanded','false');
 await expect(searchPanel).toBeHidden();
 await expect(host.locator('.origin-todo-list .todo-entry')).toHaveCount(3);
 await searchButton.click();
 await expect(searchButton).toHaveAttribute('aria-expanded','true');
 await expect(searchPanel).toBeVisible();
 const query=host.locator('#originTodoQuery');
 await query.fill('ネットワーク');
 await expect(host.locator('.origin-todo-list .todo-entry')).toHaveCount(2);
 await expect(host.locator('.origin-todo-search-result')).toContainText('表示 2件');
 await query.press('Enter');
 const selected=await host.locator('.origin-todo-list .todo-text').first().evaluate(
  el=>el.getRootNode().activeElement===el
 );
 expect(selected).toBe(true);
 await host.locator('[data-action="todo-search-toggle"]').click();
 await expect(searchPanel).toBeHidden();
 await expect(host.locator('.origin-todo-list .todo-entry')).toHaveCount(3);
 const before=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().todos.map(
  t=>({text:t.text,memo:t.memo,completed:t.completed})
 ));
 expect(before).toHaveLength(3);
 expect(before.every(t=>!t.completed)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(323);
});

test('Origin mobile task and memo search remain first and jump to visible records',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-search-first-task-memo-v588',390);
 await page.evaluate(async()=>{
  const bridge=window.WorkBoardPaletteBridge,snapshot=bridge.readSnapshot();
  const saved=await bridge.dispatch({
   type:'task.create',ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser,
   assignee:snapshot.currentUser,
   status:snapshot.statuses.includes('未着手')?'未着手':snapshot.statuses[0],
   category:snapshot.categories[0],title:'端末のIPアドレス確認',
   description:'通信設定の記録',requester:'',tags:'',checklist:'',checklistDone:[],
   priority:'中',dueDate:'',dueTime:'',pinned:false,revision:0
  });
  if(!saved?.ok)throw Error('task fixture '+saved?.error);
  const memo=await window.WorkBoardPaletteMemoBridgeV369.dispatch({
   type:'memo.create',ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser,
   title:'ネットワーク手順書',body:'通信設定の確認',
   category:'手順',tags:[],pinned:false,paperColor:'mint'
  });
  if(!memo?.ok)throw Error('memo fixture '+memo?.error);
 });
 await host.locator('#mobileNav [data-route="tasks"]').click();
 await expect(host.locator('.status-rail')).toBeHidden();
 await host.locator('[data-action="task-advanced-toggle"]').click();
 const order=await host.evaluate(el=>{
  const s=el.shadowRoot,search=s.querySelector('#originTaskQuery'),filters=s.querySelector('.status-rail');
  return {search:search.getBoundingClientRect().top,filters:filters.getBoundingClientRect().top};
 });
 expect(order.search).toBeLessThan(order.filters);
 await host.locator('#originTaskQuery').fill('IPアドレス');
 await expect(host.locator('.origin-task-collection .item-row')).toHaveCount(1);
 await host.locator('[data-action="jump-result"][data-kind="tasks"]').click();
 await expect(host.locator('.origin-task-collection .item-name')).toBeFocused();
 await host.locator('#mobileNav [data-route="notes"]').click();
 const memoOrder=await host.evaluate(el=>{
  const s=el.shadowRoot;
  return {search:s.querySelector('#originMemoQuery').getBoundingClientRect().top,
   filters:s.querySelector('.memo-toolbar').getBoundingClientRect().top};
 });
 expect(memoOrder.search).toBeLessThan(memoOrder.filters);
 const grid=host.locator('.memo-grid');
 await expect(grid).toHaveClass(/origin-memo-list/);
 await host.locator('#originMemoQuery').fill('ネットワーク');
 await expect(host.locator('.memo-grid .memo-card')).toHaveCount(1);
 await host.locator('[data-action="jump-result"][data-kind="memos"]').click();
 await expect(host.locator('.memo-grid .memo-card')).toBeFocused();
 await host.locator('[data-action="memo-layout"][data-value="cards"]').click();
 await expect(grid).not.toHaveClass(/origin-memo-list/);
 await host.locator('#mobileNav [data-route="calendar"]').click();
 await expect(host.locator('[data-action="jump-result"][data-kind="events"]')).toBeDisabled();
 await host.locator('#mobileNav [data-route="notes"]').click();
 await expect(grid).not.toHaveClass(/origin-memo-list/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(393);
});


test('Origin 320px advanced filter drawers reduce unused controls without changing data',async({page})=>{
 test.setTimeout(90000);
 const host=await launchOriginV415(page,'origin-v589-compact-filters',320);
 await page.evaluate(async()=>{
  const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
  const task=await bridge.dispatch({
    type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,
    revision:0,assignee:s.currentUser,status:s.statuses.includes('未着手')?'未着手':s.statuses[0],
    category:s.categories[0],title:'条件表示の点検',description:'画面の省スペース確認',
    requester:'',tags:'',checklist:'',checklistDone:[],priority:'中',dueDate:'',dueTime:'',pinned:false
  });
  if(!task?.ok)throw Error('task.create: '+task?.error);
  const m=await window.WorkBoardPaletteMemoBridgeV369.dispatch({
    type:'memo.create',ownerRoom:s.roomId,ownerUser:s.currentUser,
    title:'メモの色分け',body:'モバイルの検索欄',category:'手順',tags:[],pinned:false,paperColor:'mint'
  });
  if(!m?.ok)throw Error('memo.create: '+m?.error);
 });
 const saved=await page.evaluate(()=>{
  const s=window.WorkBoardPaletteBridge.readSnapshot();
  return {tasks:s.tasks.map(x=>x.id),memos:window.WorkBoardPaletteMemoBridgeV369.readSnapshot().map(x=>x.id)};
 });
 await host.locator('#mobileNav [data-route="tasks"]').click();
 const toggler=host.locator('[data-action="task-advanced-toggle"]');
 await expect(toggler).toHaveAttribute('aria-expanded','false');
 await expect(host.locator('.status-rail')).toBeHidden();
 await expect(host.locator('#originTaskSort')).toBeHidden();
 await expect(host.locator('.tab-pills [data-action="task-filter"]').first()).toBeVisible();
 await expect(host.locator('[data-action="new"][data-kind="tasks"]').first()).toBeVisible();
 await toggler.click();
 await expect(toggler).toHaveAttribute('aria-expanded','true');
 await expect(host.locator('.status-rail')).toBeVisible();
 await expect(host.locator('#originTaskSort')).toBeVisible();
 const statuses=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().statuses);
 const chosen=statuses.includes('未着手')?'未着手':statuses[0];
 await host.locator('.status-marker[data-status="'+chosen+'"]').click();
 await expect(toggler).toContainText('適用中');
 await toggler.click();
 await expect(host.locator('.status-rail')).toBeHidden();
 await expect(toggler).toHaveAttribute('aria-expanded','false');
 await expect(host.locator('.origin-task-summary')).toContainText('状態：'+chosen);
 await host.locator('[data-action="task-reset"]').click();
 await expect(toggler).not.toContainText('適用中');
 await host.locator('#mobileNav [data-route="notes"]').click();
 const memoToggle=host.locator('[data-action="memo-advanced-toggle"]');
 await expect(memoToggle).toHaveAttribute('aria-expanded','false');
 await expect(host.locator('.origin-memo-filters')).toBeHidden();
 await expect(host.locator('#originMemoSort')).toBeHidden();
 await expect(host.locator('[data-action="new"][data-kind="memos"]').first()).toBeVisible();
 await memoToggle.click();
 await expect(host.locator('.origin-memo-filters')).toBeVisible();
 await host.locator('[data-action="memo-color-filter"][data-value="mint"]').click();
 await expect(memoToggle).toContainText('適用中');
 await memoToggle.click();
 await expect(host.locator('.origin-memo-filters')).toBeHidden();
 await expect(host.locator('.origin-memo-result')).toContainText('色：ミント');
 await expect(host.locator('.memo-grid .memo-card')).toHaveCount(1);
 const after=await page.evaluate(()=>{
  const s=window.WorkBoardPaletteBridge.readSnapshot();
  return {tasks:s.tasks.map(x=>x.id),memos:window.WorkBoardPaletteMemoBridgeV369.readSnapshot().map(x=>x.id)};
 });
 expect(after).toEqual(saved);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(323);
});

test('Origin progressively displays large task groups and never changes canonical records',async({page})=>{
 test.setTimeout(120000);
 const host=await launchOriginV415(page,'origin-progressive-tasks-v590-room',390);
 const before=await page.evaluate(async()=>{
  const bridge=window.WorkBoardPaletteBridge,snapshot=bridge.readSnapshot();
  for(let i=1;i<=55;i++){
   const result=await bridge.dispatch({
    type:'task.create',ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser,
    revision:0,assignee:snapshot.currentUser,
    status:snapshot.statuses.includes('未着手')?'未着手':snapshot.statuses[0],
    category:snapshot.categories[0],
    title:'対象点検 '+String(i).padStart(3,'0'),
    description:'Originの段階表示による一覧確認',
    requester:'',tags:'',checklist:'',checklistDone:[],
    priority:'中',dueDate:'',dueTime:'',pinned:false
   });
   if(!result?.ok)throw Error('task.create: '+result?.error);
  }
  return bridge.readSnapshot().tasks.map(t=>({id:t.id,revision:t.revision,completed:t.completed}));
 });
 await host.locator('#mobileNav [data-route="tasks"]').click();
 const rows=host.locator('.origin-task-group-rows .item-row');
 const summary=host.locator('.origin-task-summary');
 await expect(rows).toHaveCount(24);
 await expect(summary).toContainText('表示 55件');
 await expect(summary).toContainText('画面に24件');
 await expect(host.locator('.origin-task-group-toggle').first()).toContainText('55件');
 await expect(host.locator('.origin-task-mobile-assignee').first()).toBeVisible();
 const group=host.locator('.origin-task-group-rows').first();
 await expect(group.locator('.origin-task-more')).toContainText('24 / 55件');
 await group.locator('[data-action="task-load-more"]').click();
 await expect(rows).toHaveCount(48);
 await expect(summary).toContainText('画面に48件');
 const newlyFocused=await rows.nth(24).locator('.item-name')
  .evaluate(el=>el.getRootNode().activeElement===el);
 expect(newlyFocused).toBe(true);
 await group.locator('[data-action="task-show-all"]').click();
 await expect(rows).toHaveCount(55);
 await expect(group.locator('.origin-task-more')).toHaveCount(0);
 await rows.first().locator('[data-action="bulk-toggle"]').check();
 await expect(host.locator('.bulkbar')).toContainText('1件選択中');
 const toggle=host.locator('.origin-task-group-toggle').first();
 await toggle.click();
 await expect(host.locator('.bulkbar')).toHaveCount(0);
 await expect(rows.first()).toBeHidden();
 await toggle.click();
 await expect(rows).toHaveCount(55);
 await host.locator('[data-action="task-advanced-toggle"]').click();
 await host.locator('#groupSelect').selectOption('status');
 await expect(rows).toHaveCount(24);
 await expect(group.locator('.origin-task-more')).toBeVisible();
 await host.locator('#originTaskQuery').fill('対象点検 055');
 await expect(rows).toHaveCount(1);
 await expect(group.locator('.origin-task-more')).toHaveCount(0);
 await host.locator('#originTaskQuery').fill('');
 await expect(rows).toHaveCount(24);
 const after=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks
  .map(t=>({id:t.id,revision:t.revision,completed:t.completed})));
 expect(after).toEqual(before);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(393);
});

test('Origin ToDo input and bridge use the same canonical title and memo lengths',async({page})=>{
  test.setTimeout(90000);
  const host=await launchOriginV415(page,'origin-todo-length-boundary-room');
  const limits=await page.evaluate(()=>{
    const snapshot=window.WorkBoardPaletteBridge.readSnapshot();
    return {title:snapshot.todoTitleMaxLength,memo:snapshot.todoMemoMaxLength};
  });
  expect(limits).toEqual({title:100,memo:1000});
  await host.locator('#desktopNav [data-route="todos"]').click();
  await expect(host.locator('.origin-todo-add [name="title"]'))
    .toHaveAttribute('maxlength',String(limits.title));
  // A direct call cannot bypass the canonical length guard or mutate the ToDo list.
  const rejected=await page.evaluate(async limit=>{
    const bridge=window.WorkBoardPaletteBridge;
    const before=bridge.readSnapshot().todos.length;
    const result=await bridge.dispatch({type:'todo.create',text:'超'.repeat(limit+1)});
    const after=bridge.readSnapshot().todos.length;
    return {result,before,after};
  },limits.title);
  expect(rejected.result).toMatchObject({
    ok:false,error:'invalid-input',field:'text',reason:'too-long',maxLength:limits.title
  });
  expect(rejected.after).toBe(rejected.before);
  const exact='点検作業'.repeat(20); // 80 Japanese characters, enough for a wrap test.
  const result=await page.evaluate(async title=>
    window.WorkBoardPaletteBridge.dispatch({type:'todo.create',text:title}),exact);
  expect(result?.ok).toBe(true);
  const row=host.locator('.origin-todo-main .todo-entry .todo-text').filter({hasText:exact});
  await expect(row).toBeVisible();
  await row.click();
  await host.locator('#sheet [data-action="edit"]').click();
  await expect(host.locator('#editForm [name="title"]'))
    .toHaveAttribute('maxlength',String(limits.title));
  await expect(host.locator('#editForm [name="memo"]'))
    .toHaveAttribute('maxlength',String(limits.memo));
});


test('Origin 390px memo library progressively shows 29 notes without modifying their stored records',async({page})=>{
 test.setTimeout(120000);
 const host=await launchOriginV415(page,'origin-progressive-memos-v591-room',390);
 const before=await page.evaluate(async()=>{
  const memo=window.WorkBoardPaletteMemoBridgeV369;
  const {roomId,currentUser}=window.WorkBoardPaletteBridge.readSnapshot();
  for(let i=1;i<=29;i++){
   const result=await memo.dispatch({
    type:'memo.create',ownerRoom:roomId,ownerUser:currentUser,
    title:'メモ段階表示 '+String(i).padStart(3,'0'),
    body:'更新手順をまとめて確認するための本文 '+i,
    category:'手順',tags:[],pinned:i===1,paperColor:i<=15?'mint':'peach'
   });
   if(!result?.ok)throw Error('memo fixture '+i+': '+result?.error);
  }
  return memo.readSnapshot().map(({id,revision,updatedAt,paperColor})=>({id,revision,updatedAt,paperColor}));
 });
 await host.locator('#mobileNav [data-route="notes"]').click();
 const cards=host.locator('.memo-grid .memo-card');
 const grid=host.locator('.memo-grid');
 const summary=host.locator('.origin-memo-result');
 await expect(grid).toHaveClass(/origin-memo-list/);
 await expect(cards).toHaveCount(24);
 await expect(summary).toContainText('表示 29件');
 await expect(summary).toContainText('画面に24件');
 await expect(host.locator('.origin-memo-more')).toContainText('24 / 29件');
 await expect(host.locator('.origin-memo-pinned')).toContainText('固定');
 await expect(host.locator('.origin-memo-metadata')).toHaveCount(24);
 await host.locator('[data-action="memo-load-more"]').click();
 await expect(cards).toHaveCount(29);
 expect(await cards.nth(24).evaluate(el=>el.getRootNode().activeElement===el)).toBe(true);
 await expect(host.locator('.origin-memo-more')).toHaveCount(0);
 await host.locator('[data-action="memo-layout"][data-value="cards"]').click();
 await expect(grid).not.toHaveClass(/origin-memo-list/);
 await expect(cards).toHaveCount(29);
 await host.locator('#originMemoQuery').fill('メモ段階表示 029');
 await expect(cards).toHaveCount(1);
 await expect(host.locator('.origin-memo-more')).toHaveCount(0);
 await host.locator('#originMemoQuery').fill('');
 await expect(cards).toHaveCount(24);
 await host.locator('[data-action="memo-show-all"]').click();
 await expect(cards).toHaveCount(29);
 await host.locator('[data-action="memo-advanced-toggle"]').click();
 await host.locator('#originMemoSort').selectOption('title');
 await expect(cards).toHaveCount(24);
 await host.locator('[data-action="memo-color-filter"][data-value="mint"]').click();
 await expect(cards).toHaveCount(15);
 await expect(host.locator('.origin-memo-more')).toHaveCount(0);
 await expect(summary).toContainText('色：ミント');
 await expect(cards.first().locator('.memo-bottom')).toContainText('手順');
 await expect(host.locator('.origin-memo-colors').first().locator('[data-action="memo-color"]')).toHaveCount(6);
 const after=await page.evaluate(()=>window.WorkBoardPaletteMemoBridgeV369.readSnapshot()
  .map(({id,revision,updatedAt,paperColor})=>({id,revision,updatedAt,paperColor})));
 expect(after).toEqual(before);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(393);
});


test('Origin returns to the edited memo after it moves beyond the initial 24 cards',async({page})=>{
 test.setTimeout(120000);
 const host=await launchOriginV415(page,'origin-detail-anchor-v592-room',390);
 const selected=await page.evaluate(async()=>{
  const bridge=window.WorkBoardPaletteMemoBridgeV369;
  const {roomId,currentUser}=window.WorkBoardPaletteBridge.readSnapshot();
  for(let i=1;i<=29;i++){
   const title='復帰位置テスト '+String(i).padStart(3,'0');
   const result=await bridge.dispatch({
    type:'memo.create',ownerRoom:roomId,ownerUser:currentUser,
    title,body:'詳細編集後に同じ場所へ戻る確認',category:'手順',
    pinned:false,tags:[],paperColor:'mint'
   });
   if(!result?.ok)throw Error('memo fixture: '+result?.error);
  }
  return bridge.readSnapshot().find(m=>m.title==='復帰位置テスト 005').id;
 });
 await host.locator('#mobileNav [data-route="notes"]').click();
 await host.locator('[data-action="memo-advanced-toggle"]').click();
 await host.locator('#originMemoSort').selectOption('title');
 const cards=host.locator('.memo-grid .memo-card');
 await expect(cards).toHaveCount(24);
 const opened=host.locator('.memo-grid .memo-card[data-id="'+selected+'"]');
 const beforeTop=await opened.evaluate(el=>{
  el.scrollIntoView({block:'center',behavior:'instant'});
  return el.closest('.origin-memo-shell').getBoundingClientRect().top;
 });
 await opened.click();
 const sheet=host.locator('#sheet');
 await expect(sheet.locator('#panelHeading')).toHaveText('復帰位置テスト 005');
 await sheet.locator('[data-action="edit"]').click();
 await sheet.locator('#editForm [name="title"]').fill('復帰位置テスト 999');
 await sheet.locator('button[form="editForm"]').click();
 await expect(host.locator('#overlay')).toBeHidden();
 // Title sorting moves the saved record to the end. The list must expand
 // and restore keyboard focus, rather than dropping back to the first page.
 await expect(cards).toHaveCount(29);
 const returned=host.locator('.memo-grid .memo-card[data-id="'+selected+'"]');
 await expect(returned).toBeFocused();
 await expect(returned.locator('h3')).toHaveText('復帰位置テスト 999');
 const visible=await returned.evaluate(el=>{
  const r=el.getBoundingClientRect();
  return {top:r.top,bottom:r.bottom,innerHeight:window.innerHeight};
 });
 expect(visible.bottom).toBeGreaterThan(0);
 expect(visible.top).toBeLessThan(visible.innerHeight);
 expect(visible.top).toBeGreaterThanOrEqual(beforeTop-220);
 await returned.click();
 await expect(sheet.locator('#panelHeading')).toHaveText('復帰位置テスト 999');
 await sheet.locator('.sheet-close').click();
 await expect(returned).toBeFocused();
 await expect(cards).toHaveCount(29);
 const data=await page.evaluate(id=>window.WorkBoardPaletteMemoBridgeV369
  .readSnapshot().find(m=>m.id===id),selected);
 expect(data.title).toBe('復帰位置テスト 999');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(393);
});


test('Origin detail next/previous crosses the first 24 tasks and memos without mounting them first',async({page})=>{
 test.setTimeout(150000);
 const host=await launchOriginV415(page,'origin-paged-detail-v593-room',390);
 const ids=await page.evaluate(async()=>{
  const bridge=window.WorkBoardPaletteBridge;
  const memo=window.WorkBoardPaletteMemoBridgeV369;
  const {roomId,currentUser,statuses,categories}=bridge.readSnapshot();
  for(let i=1;i<=26;i++){
   const task=await bridge.dispatch({
    type:'task.create',ownerRoom:roomId,ownerUser:currentUser,
    assignee:currentUser,revision:0,
    status:statuses.includes('未着手')?'未着手':statuses[0],
    category:categories[0],title:'ページ送りタスク '+String(i).padStart(3,'0'),
    description:'一覧の後ろまで詳細閲覧',requester:'',tags:'',
    checklist:'',checklistDone:[],priority:'中',dueDate:'',dueTime:'',pinned:false
   });
   if(!task?.ok)throw Error('task '+i+': '+task?.error);
   const note=await memo.dispatch({
    type:'memo.create',ownerRoom:roomId,ownerUser:currentUser,
    title:'ページ送りメモ '+String(i).padStart(3,'0'),
    category:'手順',body:'詳細画面からの前後閲覧を確認',tags:[],pinned:false,paperColor:'mint'
   });
   if(!note?.ok)throw Error('memo '+i+': '+note?.error);
  }
  return {tasks:bridge.readSnapshot().tasks.length,memos:memo.readSnapshot().length};
 });
 expect(ids.tasks).toBe(26);
 expect(ids.memos).toBe(26);
 await host.locator('#mobileNav [data-route="tasks"]').click();
 const taskRows=host.locator('.origin-task-group-rows .item-row');
 await expect(taskRows).toHaveCount(24);
 await taskRows.nth(23).locator('.item-name').click();
 const sheet=host.locator('#sheet');
 await expect(sheet.locator('.origin-detail-position')).toHaveText('24 / 26件');
 await expect(sheet.locator('[data-action="detail-next"]')).toBeEnabled();
 await sheet.locator('[data-action="detail-next"]').click();
 await expect(sheet.locator('.origin-detail-position')).toHaveText('25 / 26件');
 const targetTask=await sheet.locator('#panelHeading').textContent();
 await expect(taskRows).toHaveCount(24);
 await sheet.locator('[data-action="detail-prev"]').click();
 await expect(sheet.locator('.origin-detail-position')).toHaveText('24 / 26件');
 await sheet.locator('[data-action="detail-next"]').click();
 await sheet.locator('.sheet-close').click();
 await expect(host.locator('#overlay')).toBeHidden();
 await expect(taskRows).toHaveCount(26);
 await expect(host.locator('.origin-task-collection .item-name',{hasText:targetTask})).toBeFocused();

 await host.locator('#mobileNav [data-route="notes"]').click();
 const cards=host.locator('.memo-grid .memo-card');
 await expect(cards).toHaveCount(24);
 await cards.nth(23).click();
 await expect(sheet.locator('.origin-detail-position')).toHaveText('24 / 26件');
 await sheet.locator('[data-action="detail-next"]').click();
 await expect(sheet.locator('.origin-detail-position')).toHaveText('25 / 26件');
 const targetMemo=await sheet.locator('#panelHeading').textContent();
 await expect(cards).toHaveCount(24);
 await sheet.locator('.sheet-close').click();
 await expect(host.locator('#overlay')).toBeHidden();
 await expect(cards).toHaveCount(26);
 await expect(cards.filter({hasText:targetMemo})).toBeFocused();
 // The records themselves must not have been modified by opening details.
 const after=await page.evaluate(()=>({
  tasks:window.WorkBoardPaletteBridge.readSnapshot().tasks.length,
  memos:window.WorkBoardPaletteMemoBridgeV369.readSnapshot().length
 }));
 expect(after).toEqual(ids);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(393);
});
