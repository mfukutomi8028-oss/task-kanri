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
});
