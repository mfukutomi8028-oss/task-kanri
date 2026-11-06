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
 await host.locator('.origin-todo-list .todo-check').first().check();
 await expect(host.locator('.origin-todo-list .todo-entry')).toHaveCount(1);
 await host.locator('.origin-todo-archive-toggle').click();
 await expect(host.locator('#originCompletedTodos .todo-entry')).toHaveCount(1);
 await host.locator('#originCompletedTodos .todo-check').first().uncheck();
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
