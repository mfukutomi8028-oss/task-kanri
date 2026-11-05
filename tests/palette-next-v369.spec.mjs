import { test, expect } from '@playwright/test';

const room='test-palette-next-v369';

async function boot(page,width=1366,activate=true) {
  await page.setViewportSize({width,height:Math.max(700,width===320?700:820)});
  await page.route('**/*',route=>{
    const origin=new URL(route.request().url()).origin;
    return origin==='http://127.0.0.1:4173' ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(({room})=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    // Use a registered user: schedule/task writers correctly reject unknown assignees.
    localStorage.setItem('systemTaskUser','福冨');
    localStorage.setItem('systemTaskRoomId',room);
  },{room});
  await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  // Guard against silently testing with an unregistered application user.
  await expect.poll(()=>page.evaluate(()=>{
    const s=window.WorkBoardPaletteBridge.readSnapshot();
    return s.users.includes(s.currentUser);
  })).toBe(true);
  await expect(page.locator('#wbPaletteNextPreviewV369')).toHaveCount(0);
  if(activate) {
    await page.locator('[data-wb-display-choice="palette"]').evaluate(el=>el.click());
    await expect(page.locator('#paletteNextRoot .wb-pn')).toBeVisible({timeout:15000});
    await expect(page.locator('html')).toHaveAttribute('data-wb-display','palette');
  }
}

test('Palette directly opens NEXT; Classic, Modern and Journal remain selectable',async({page})=>{
  await boot(page,1366,false);
  await expect(page.locator('#paletteNextRoot')).toHaveCount(0);
  await page.locator('[data-wb-display-choice="palette"]').evaluate(el=>el.click());
  await expect(page.locator('#paletteNextRoot .wb-pn')).toBeVisible({timeout:15000});
  await expect(page.locator('.app-shell')).toBeHidden();
  await page.locator('#pnMode').selectOption('modern');
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','modern');
  // Modern is independent; Classic shell must remain hidden.
  await expect(page.locator('.app-shell')).toBeHidden();
  await expect(page.locator('#modernOriginRoot')).toBeVisible();
  await page.locator('[data-wb-display-choice="palette"]').evaluate(el=>el.click());
  await expect(page.locator('#paletteNextRoot .wb-pn')).toBeVisible();
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#paletteNextRoot .wb-pn')).toBeVisible({timeout:15000});
});
test('Palette NEXT owns independent DOM and shares canonical state without Classic DOM scanning',async({page})=>{
  await boot(page);
  await expect(page.locator('.app-shell')).toBeHidden();
  await expect(page.locator('#paletteNextRoot .pn-rail')).toBeVisible();
  await expect(page.locator('#paletteNextRoot .pn-hero')).toBeVisible();
  const info=await page.evaluate(()=>{
    const snapshot=window.WorkBoardPaletteBridge.readSnapshot();
    return {
      keys:Object.keys(snapshot),
      routes:document.querySelectorAll('#paletteNextRoot .pn-rail-nav [data-pn-route],#paletteNextRoot .pn-mobile-nav [data-pn-route]').length,
      nestedClassic:document.querySelectorAll('#paletteNextRoot .today-grid,#paletteNextRoot .nav-item,#paletteNextRoot .sidebar').length,
      sync:snapshot.connectionMode,room:snapshot.roomId
    };
  });
  for(const key of ['tasks','todos','schedules','notices','currentUser','focusTaskIds'])
    expect(info.keys).toContain(key);
  expect(info.nestedClassic).toBe(0);
  expect(info.routes).toBe(10);
  expect(info.sync).toBe('local-only');
  expect(info.room).toBe(room);
});

test('Palette NEXT ToDo create, edit, toggle and persistence use canonical commands',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  await page.locator('.pn-mobile-nav [data-pn-route="todos"]').click();
  await expect(page.locator('#pnTodoInput')).toBeVisible();
  await page.locator('#pnTodoInput').fill('Palette NEXT 実データテスト');
  await page.locator('[data-pn-form="todo"] button[type="submit"]').click();
  const row=page.locator('#paletteNextRoot .pn-todolist li').filter({hasText:'Palette NEXT 実データテスト'}).first();
  await expect(row).toBeVisible();
  await row.locator('[data-pn-cmd="todo.toggle"]').click();
  await expect(page.locator('#paletteNextRoot .pn-todotext.done')).toContainText('Palette NEXT 実データテスト');
  await row.locator('[data-pn-detail="todo"]').click();
  await expect(page.locator('#pnDetail')).toHaveAttribute('data-inspector','todo');
  await expect(page.locator('#pnDetail .pn-inspect-hero')).toContainText('TODO DETAIL');
  await expect(page.locator('#pnTodoEdit')).toBeVisible();
  await page.locator('#pnTodoEdit [name="memo"]').fill('更新した補足');
  await page.locator('#pnTodoEdit [type="submit"]').click();
  await expect.poll(()=>page.evaluate(()=>{
    const todo=window.WorkBoardPaletteBridge.readSnapshot().todos.find(t=>t.text==='Palette NEXT 実データテスト');
    return todo?.memo;
  })).toBe('更新した補足');
  await page.locator('#pnDetail [data-pn-close]').click();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await expect(page.locator('#paletteNextRoot .wb-pn')).toBeVisible({timeout:15000});
  const saved=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().todos.find(t=>
    t.text==='Palette NEXT 実データテスト'));
  expect(saved.completed).toBe(true);
  expect(saved.memo).toBe('更新した補足');
});

test('Palette NEXT uses actual existing business memos for the independent memo wall',async({page})=>{
  await page.addInitScript(({room})=>{
    localStorage.setItem('system-business-memos:'+room,JSON.stringify({
      'memo-one':{id:'memo-one',title:'総務への定型連絡',body:'連絡先と手順をまとめたメモです。',category:'手順',
        tags:['院内'],pinned:true,revision:1,updatedAt:Date.now(),updatedBy:'PaletteNextTester'}
    }));
  },{room});
  await boot(page,390);
  await expect.poll(()=>page.evaluate(()=>window.WorkBoardPaletteMemoBridgeV369?.readSnapshot?.().length)).toBe(1);
  await page.locator('.pn-mobile-nav [data-pn-route="memos"]').click();
  await expect(page.locator('.pn-memotile')).toHaveCount(1);
  await expect(page.locator('.pn-memotile')).toContainText('総務への定型連絡');
  await page.locator('.pn-memotile').click();
  await expect(page.locator('#pnDetail')).toHaveAttribute('data-inspector','memo');
  await expect(page.locator('#pnDetail .pn-inspect-hero')).toHaveAttribute('data-paper-color','ivory');
  await expect(page.locator('.pn-memobody')).toContainText('連絡先と手順をまとめたメモです。');
});

test('Palette switching preserves saved design preference',async({page})=>{
  await boot(page);
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','palette');
  await page.locator('#pnMode').selectOption('modern');
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','modern');
  await expect(page.locator('.app-shell')).toBeHidden();
  await expect(page.locator('#modernOriginRoot')).toBeVisible();
  await page.locator('[data-wb-display-choice="palette"]').evaluate(el=>el.click());
  await expect(page.locator('#paletteNextRoot .pn-hero')).toBeVisible({timeout:15000});
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','palette');
});

for(const width of [1366,390,320]){
  test('Palette NEXT responsive independent navigation at '+width+'px',async({page})=>{
    await boot(page,width);
    const info=await page.evaluate(()=>{
      const rail=document.querySelector('.pn-rail');
      const mobile=document.querySelector('.pn-mobile-nav');
      return {clientWidth:document.documentElement.clientWidth,
        scrollWidth:document.documentElement.scrollWidth,
        rail:getComputedStyle(rail).display,mobile:getComputedStyle(mobile).display};
    });
    expect(info.scrollWidth).toBeLessThanOrEqual(info.clientWidth+2);
    expect(info.mobile==='grid').toBe(width<=780);
    if(width>780)expect(info.rail).not.toBe('none');
    const nav=width<=780?'.pn-mobile-nav':'.pn-rail-nav';
    await page.locator('#paletteNextRoot '+nav+' [data-pn-route="tasks"]').click();
    await expect(page.locator('#paletteNextRoot .pn-flowtabs')).toBeVisible();
    await page.locator('#paletteNextRoot '+nav+' [data-pn-route="schedule"]').click();
    await expect(page.locator('#paletteNextRoot .pn-weekstrip button')).toHaveCount(7);
    await page.locator('#paletteNextRoot '+nav+' [data-pn-route="memos"]').click();
    await expect(page.locator('#paletteNextRoot .pn-memogrid')).toBeVisible();
    await page.locator('#paletteNextRoot [data-pn-theme]').click();
    await expect(page.locator('#pnApp')).toHaveAttribute('data-theme','dark');
    await page.locator('#pnMode').selectOption('classic');
    await expect(page.locator('.app-shell')).toBeVisible();
  });
}


test('Palette NEXT creates and edits a task through canonical revision-safe writers',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  await page.locator('.pn-mobile-nav [data-pn-route="tasks"]').click();
  await page.locator('#paletteNextRoot [data-pn-edit="task"]').first().click();
  const form=page.locator('#pnDetail [data-pn-form="task-editor"]');
  await expect(form).toBeVisible();
  await form.locator('[name="title"]').fill('Palette NEXT 新規タスク検証');
  await form.locator('[name="description"]').fill('現地の端末を確認します');
  await form.locator('[name="tags"]').fill('院内, テスト');
  await form.locator('[type="submit"]').click();
  await expect(form).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>
    window.WorkBoardPaletteBridge.readSnapshot().tasks.find(x=>x.title==='Palette NEXT 新規タスク検証')?.description
  )).toBe('現地の端末を確認します');
  const row=page.locator('#paletteNextRoot .pn-flowrow').filter({hasText:'Palette NEXT 新規タスク検証'});
  await row.locator('[data-pn-detail="task"]').click();
  await page.locator('#pnDetail [data-pn-edit="task"]').click();
  const edit=page.locator('#pnDetail [data-pn-form="task-editor"]');
  await expect(edit).toBeVisible();
  await edit.locator('[name="description"]').fill('編集済み・端末の確認を完了');
  await edit.locator('[type="submit"]').click();
  await expect(edit).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>
    window.WorkBoardPaletteBridge.readSnapshot().tasks.find(x=>x.title==='Palette NEXT 新規タスク検証')?.description
  )).toBe('編集済み・端末の確認を完了');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await expect(page.locator('#paletteNextRoot')).toBeVisible();
  const saved=await page.evaluate(()=>
    window.WorkBoardPaletteBridge.readSnapshot().tasks.find(x=>x.title==='Palette NEXT 新規タスク検証'));
  expect(saved.description).toBe('編集済み・端末の確認を完了');
  expect(saved.revision).toBeGreaterThanOrEqual(2);
});

test('Palette NEXT business memos can be created, edited, pinned and deleted using canonical CAS',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  await page.locator('.pn-mobile-nav [data-pn-route="memos"]').click();
  await page.locator('#paletteNextRoot [data-pn-edit="memo"]').first().click();
  const form=page.locator('#pnDetail [data-pn-form="memo-editor"]');
  await form.locator('[name="title"]').fill('Palette NEXT 登録メモ');
  await form.locator('[name="body"]').fill('作業手順を保存します');
  await form.locator('[type="submit"]').click();
  await expect(form).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>
    window.WorkBoardPaletteMemoBridgeV369.readSnapshot().find(x=>x.title==='Palette NEXT 登録メモ')?.body
  )).toBe('作業手順を保存します');
  const tile=page.locator('.pn-memotile').filter({hasText:'Palette NEXT 登録メモ'});
  await tile.click();
  await page.locator('#pnDetail [data-pn-edit="memo"]').click();
  const edit=page.locator('#pnDetail [data-pn-form="memo-editor"]');
  await edit.locator('[name="body"]').fill('編集した作業手順です');
  await edit.locator('[type="submit"]').click();
  await expect(edit).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>
    window.WorkBoardPaletteMemoBridgeV369.readSnapshot().find(x=>x.title==='Palette NEXT 登録メモ')?.body
  )).toBe('編集した作業手順です');
  await tile.click();
  await page.locator('#pnDetail [data-pn-cmd="memo.pin"]').click();
  await expect.poll(()=>page.evaluate(()=>
    window.WorkBoardPaletteMemoBridgeV369.readSnapshot().find(x=>x.title==='Palette NEXT 登録メモ')?.pinned
  )).toBe(true);
  page.on('dialog',dialog=>dialog.accept());
  await page.locator('#pnDetail [data-pn-cmd="memo.delete"]').click();
  await expect.poll(()=>page.evaluate(()=>
    window.WorkBoardPaletteMemoBridgeV369.readSnapshot().some(x=>x.title==='Palette NEXT 登録メモ')
  )).toBe(false);
});

test('Palette NEXT retains unsaved memo fields when another client updates the revision',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  await page.locator('.pn-mobile-nav [data-pn-route="memos"]').click();
  await page.locator('#paletteNextRoot [data-pn-edit="memo"]').first().click();
  const form=page.locator('#pnDetail [data-pn-form="memo-editor"]');
  await form.locator('[name="title"]').fill('Palette NEXT 競合テスト');
  await form.locator('[name="body"]').fill('初版');
  await form.locator('[type="submit"]').click();
  await expect(form).toBeHidden();
  await page.locator('.pn-memotile').filter({hasText:'Palette NEXT 競合テスト'}).click();
  await page.locator('#pnDetail [data-pn-edit="memo"]').click();
  const edit=page.locator('#pnDetail [data-pn-form="memo-editor"]');
  await edit.locator('[name="body"]').fill('保存前の編集中テキスト');
  const external=await page.evaluate(async()=>{
    const bridge=window.WorkBoardPaletteMemoBridgeV369;
    const row=bridge.readSnapshot().find(x=>x.title==='Palette NEXT 競合テスト');
    const snap=window.WorkBoardPaletteBridge.readSnapshot();
    return bridge.dispatch({
      type:'memo.update',id:row.id,revision:row.revision,
      title:row.title,body:'別端末で更新された内容',category:row.category,
      tags:row.tags,pinned:row.pinned,ownerRoom:snap.roomId,ownerUser:snap.currentUser
    });
  });
  expect(external.ok).toBe(true);
  await edit.locator('[type="submit"]').click();
  await expect(edit).toBeVisible();
  await expect(edit.locator('[name="body"]')).toHaveValue('保存前の編集中テキスト');
  await expect(page.locator('#pnToast')).toContainText('他の端末で内容が更新');
});


test('Palette NEXT schedule editor creates, edits, and persists a real schedule',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  const day=await page.evaluate(()=>new Date().toLocaleDateString('sv-SE'));
  await page.locator('.pn-mobile-nav [data-pn-route="schedule"]').click();
  await page.locator('.pn-calendar-toolbar [data-pn-edit="schedule"]').click();
  const form=page.locator('#pnDetail [data-pn-form="schedule-editor"]');
  await expect(form).toBeVisible();
  await form.locator('[name="title"]').fill('NEXT 予定追加テスト');
  await form.locator('[name="startAt"]').fill(day+'T09:00');
  await form.locator('[name="endAt"]').fill(day+'T10:00');
  await form.locator('[name="location"]').fill('テスト会議室');
  await form.locator('[name="memo"]').fill('持参資料を確認');
  await form.locator('[type="submit"]').click();
  await expect(form).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().schedules.find(
    item=>item.title==='NEXT 予定追加テスト')?.location)).toBe('テスト会議室');
  const busyDay=page.locator('#paletteNextRoot .pn-weekday[data-pn-day="'+day+'"]');
  await expect(busyDay).toHaveAttribute('data-has-events','true');
  await expect(busyDay.locator('.pn-day-event-dot')).toHaveCount(1);
  await page.locator('.pn-scheduleopen').filter({hasText:'NEXT 予定追加テスト'}).click();
  await expect(page.locator('#pnDetail')).toHaveAttribute('data-inspector','schedule');
  await expect(page.locator('#pnDetail .pn-inspect-timeband')).toContainText('09:00');
  await expect(page.locator('#pnDetail .pn-inspect-timeband')).toContainText('10:00');
  await expect(page.locator('#pnDetail')).toContainText('持参資料を確認');
  await page.locator('#pnDetail [data-pn-edit="schedule"]').click();
  const edit=page.locator('#pnDetail [data-pn-form="schedule-editor"]');
  await edit.locator('[name="memo"]').fill('編集後の持参資料');
  await edit.locator('[type="submit"]').click();
  await expect(edit).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().schedules.find(
    item=>item.title==='NEXT 予定追加テスト')?.memo)).toBe('編集後の持参資料');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  const saved=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().schedules.find(
    item=>item.title==='NEXT 予定追加テスト'));
  expect(saved.memo).toBe('編集後の持参資料');
  expect(saved.revision).toBeGreaterThanOrEqual(2);
});

test('Palette NEXT recurring batch creation previews dates and writes one grouped schedule series',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  const day=await page.evaluate(()=>new Date().toLocaleDateString('sv-SE'));
  await page.locator('.pn-mobile-nav [data-pn-route="schedule"]').click();
  await page.locator('.pn-calendar-toolbar [data-pn-edit="schedule"]').click();
  const form=page.locator('#pnDetail [data-pn-form="schedule-editor"]');
  await form.locator('[name="title"]').fill('NEXT 週次バッチテスト');
  await form.locator('[name="startAt"]').fill(day+'T09:00');
  await form.locator('[name="endAt"]').fill(day+'T10:00');
  await page.locator('#pnDetail [data-pn-batch-new]').click();
  const copy=page.locator('#pnDetail [data-pn-form="schedule-copy"]');
  await expect(copy).toBeVisible();
  await copy.locator('[name="method"]').selectOption('weekly');
  await copy.locator('[name="count"]').fill('3');
  await copy.locator('[data-pn-copy-preview]').click();
  await expect(copy.locator('#pnCopyReview')).toContainText('3件の作成日を確認しました');
  await expect(copy.locator('[data-pn-copy-submit]')).toBeEnabled();
  await copy.locator('[data-pn-copy-submit]').click();
  await expect(copy).toBeHidden();
  const saved=await expect.poll(()=>page.evaluate(()=>{
    const schedules=window.WorkBoardPaletteBridge.readSnapshot().schedules.filter(x=>
      x.title==='NEXT 週次バッチテスト');
    return schedules.length;
  })).toBe(3);
  const series=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().schedules.filter(x=>
    x.title==='NEXT 週次バッチテスト').map(x=>({
      date:new Date(x.startAt).toLocaleDateString('sv-SE'),
      series:x.recurrenceSeriesId,
      revision:x.revision
    })));
  expect(new Set(series.map(x=>x.date)).size).toBe(3);
  expect(new Set(series.map(x=>x.series)).size).toBe(1);
  expect(series[0].series).toBeTruthy();
  expect(series.every(x=>x.revision===1)).toBe(true);
});

test('Palette NEXT copy previews canonical overlap before allowing repeated writes',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  const day=await page.evaluate(()=>new Date().toLocaleDateString('sv-SE'));
  const result=await page.evaluate(async day=>{
    const bridge=window.WorkBoardPaletteBridge;
    const state=bridge.readSnapshot();
    return bridge.dispatch({
      type:'schedule.create',revision:0,ownerRoom:state.roomId,ownerUser:state.currentUser,
      values:{
        title:'NEXT コピー元',startAt:day+'T09:00',endAt:day+'T10:00',
        assignee:state.currentUser,category:state.categories[0]||'その他',
        location:'検証室',memo:'',relatedTaskId:''
      }
    });
  },day);
  expect(result.ok).toBe(true);
  await page.locator('.pn-mobile-nav [data-pn-route="schedule"]').click();
  await page.locator('.pn-scheduleopen').filter({hasText:'NEXT コピー元'}).click();
  await page.locator('#pnDetail [data-pn-copy="schedule"]').click();
  const copy=page.locator('#pnDetail [data-pn-form="schedule-copy"]');
  await expect(copy).toBeVisible();
  await copy.locator('[name="startDate"]').fill(day);
  await copy.locator('[data-pn-copy-preview]').click();
  await expect(copy.locator('#pnCopyReview')).toContainText('重複');
  page.once('dialog',dialog=>dialog.dismiss());
  await copy.locator('[data-pn-copy-submit]').click();
  await expect.poll(()=>page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().schedules.filter(x=>
    x.title==='NEXT コピー元').length)).toBe(1);
  await expect(copy).toBeVisible();
});


test('Palette NEXT bulk updates selected task status and rejects a stale revision',async({page})=>{
  test.setTimeout(90000);
  await boot(page);
  await page.locator('.pn-rail-nav [data-pn-route="tasks"]').click();
  const create=page.locator('[data-pn-edit="task"]').first();
  for(const name of ['一括変更A','一括変更B']){
    await create.click();
    const form=page.locator('[data-pn-form="task-editor"]');
    await form.locator('[name="title"]').fill(name);
    await form.locator('[type="submit"]').click();
    await expect.poll(()=>page.evaluate(title=>window.WorkBoardPaletteBridge.readSnapshot().tasks.some(t=>t.title===title),name)).toBe(true);
  }
  const rows=page.locator('#paletteNextRoot .pn-flowrow');
  for(const name of ['一括変更A','一括変更B']){
    await rows.filter({hasText:name}).locator('[data-pn-bulk-id]').check();
  }
  await expect(page.locator('.pn-bulk-heading')).toContainText('2件選択中');
  await page.locator('[data-pn-bulk-action]').selectOption('category');
  const chosen=await page.locator('[data-pn-bulk-target] option').last().getAttribute('value');
  await page.locator('[data-pn-bulk-target]').selectOption(chosen);
  await page.locator('[data-pn-bulk-apply]').click();
  await expect.poll(()=>page.evaluate(([a,b,category])=>{
    const tasks=window.WorkBoardPaletteBridge.readSnapshot().tasks;
    return [a,b].every(name=>tasks.some(t=>t.title===name&&t.category===category));
  },['一括変更A','一括変更B',chosen])).toBe(true);
  await expect(page.locator('.pn-bulk-heading')).toContainText('0件選択中');

  await rows.filter({hasText:'一括変更A'}).locator('[data-pn-bulk-id]').check();
  const item=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks.find(t=>t.title==='一括変更A'));
  const changed=await page.evaluate(async item=>window.WorkBoardPaletteBridge.dispatch({
    type:'task.update',id:item.id,revision:item.revision,ownerRoom:'test-palette-next-v369',
    ownerUser:window.WorkBoardPaletteBridge.readSnapshot().currentUser,
    title:'一括変更A',assignee:item.assignee,status:item.status,
    priority:item.priority,category:item.category,description:'別端末の変更',
    dueDate:item.dueDate||'',dueTime:item.dueTime||'',requester:item.requester||'',tags:'',checklist:''
  }),item);
  expect(changed.ok).toBe(true);
  await page.locator('[data-pn-bulk-apply]').click();
  await expect(page.locator('.pn-bulk-heading')).toContainText('0件選択中');
});


test('Palette visual system stays distinctive, legible and responsive without altering business controls',async({page})=>{
  await boot(page,1366);
  await expect(page.locator('#paletteNextRoot .pn-top-logo i')).toHaveCount(4);
  await expect(page.locator('#paletteNextRoot .pn-rail-nav svg')).toHaveCount(5);
  await expect(page.locator('#paletteNextRoot .pn-hero-art .pn-art')).toHaveCount(4);
  await expect(page.locator('#paletteNextRoot .pn-home-grid .pn-sheet')).toHaveCount(4);
  const desktop=await page.evaluate(()=>{
    const hero=document.querySelector('#paletteNextRoot .pn-hero');
    const shell=document.querySelector('#paletteNextRoot .pn-sheet');
    return {
      heroRadius:parseFloat(getComputedStyle(hero).borderTopLeftRadius),
      sheetRadius:parseFloat(getComputedStyle(shell).borderTopLeftRadius),
      columnWidth:document.querySelector('#paletteNextRoot .pn-rail').getBoundingClientRect().width,
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
    };
  });
  expect(desktop.heroRadius).toBeGreaterThanOrEqual(20);
  expect(desktop.sheetRadius).toBeGreaterThanOrEqual(15);
  expect(desktop.columnWidth).toBeGreaterThanOrEqual(86);
  expect(desktop.overflow).toBeLessThanOrEqual(2);

  await page.locator('#paletteNextRoot .pn-rail-nav [data-pn-route="tasks"]').click();
  await expect(page.locator('#paletteNextRoot .pn-bulkbar')).toHaveAttribute('data-empty','true');
  await expect(page.locator('#paletteNextRoot .pn-bulk-actions')).toBeHidden();
  await page.locator('[data-pn-edit="task"]').first().click();
  await expect(page.locator('#pnDetail [data-pn-form="task-editor"]')).toBeVisible();
  const desktopPanelRadius=await page.locator('#pnDetail').evaluate(el=>parseFloat(getComputedStyle(el).borderTopLeftRadius));
  expect(desktopPanelRadius).toBeGreaterThanOrEqual(20);
  await page.locator('#pnDetail [data-pn-close]').click();

  await page.locator('#paletteNextRoot [data-pn-theme]').click();
  await expect(page.locator('#pnApp')).toHaveAttribute('data-theme','dark');
  const dark=await page.locator('#paletteNextRoot .pn-sheet').first().evaluate(el=>{
    const v=getComputedStyle(el).backgroundColor.match(/\d+/g).slice(0,3).map(Number);
    return Math.max(...v);
  });
  expect(dark).toBeLessThan(170);

  await page.setViewportSize({width:390,height:820});
  await expect(page.locator('#paletteNextRoot .pn-mobile-nav svg')).toHaveCount(5);
  await expect(page.locator('#paletteNextRoot .pn-mobile-nav')).toBeVisible();
  const mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(mobileOverflow).toBeLessThanOrEqual(2);
  await page.locator('#paletteNextRoot .pn-mobile-nav [data-pn-route="memos"]').click();
  await expect(page.locator('#paletteNextRoot .pn-memogrid')).toBeVisible();
});


test('Palette quick creation opens four native editors from the same topbar menu',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  const menu=page.locator('#pnQuickCreateMenu');
  const trigger=page.locator('#paletteNextRoot [data-pn-create]');
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(menu).toBeVisible();
  await expect(menu.locator('[role="menuitem"]')).toHaveCount(4);
  await expect(trigger).toHaveAttribute('aria-expanded','true');

  await menu.locator('[data-pn-quick-create="task"]').click();
  await expect(page.locator('#pnDetail [data-pn-form="task-editor"]')).toBeVisible();
  await page.locator('#pnDetail [data-pn-close]').click();

  await trigger.click();
  await menu.locator('[data-pn-quick-create="schedule"]').click();
  await expect(page.locator('#pnDetail [data-pn-form="schedule-editor"]')).toBeVisible();
  await page.locator('#pnDetail [data-pn-close]').click();

  await trigger.click();
  await menu.locator('[data-pn-quick-create="memo"]').click();
  await expect(page.locator('#pnDetail [data-pn-form="memo-editor"]')).toBeVisible();
  await expect(page.locator('#pnDetail [name="paperColor"]')).toHaveCount(6);
  await page.locator('#pnDetail [data-pn-close]').click();

  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded','false');

  await trigger.click();
  await menu.locator('[data-pn-quick-create="todo"]').click();
  await expect(page.locator('#pnTodoInput')).toBeVisible();
  await expect(page.locator('#pnTodoInput')).toBeFocused();
  await expect(menu).toBeHidden();
  await page.setViewportSize({width:320,height:740});
  await expect(trigger).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

test('Palette memo paper color persists through canonical save, filter, edit and reload',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  await page.locator('.pn-mobile-nav [data-pn-route="memos"]').click();
  await expect(page.locator('#paletteNextRoot .pn-memo-filter')).toHaveCount(7);
  await page.locator('#paletteNextRoot [data-pn-edit="memo"]').first().click();
  const form=page.locator('#pnDetail [data-pn-form="memo-editor"]');
  await form.locator('[name="title"]').fill('Palette色分け保存テスト');
  await form.locator('[name="body"]').fill('カラーで分類する業務メモ');
  await form.locator('[name="paperColor"][value="mint"]').check();
  await form.locator('[type="submit"]').click();
  await expect(form).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>
    window.WorkBoardPaletteMemoBridgeV369.readSnapshot()
      .find(m=>m.title==='Palette色分け保存テスト')?.paperColor
  )).toBe('mint');
  const tile=page.locator('#paletteNextRoot .pn-memotile').filter({hasText:'Palette色分け保存テスト'});
  await expect(tile).toHaveAttribute('data-paper-color','mint');

  await page.locator('[data-pn-memo-filter="peach"]').click();
  await expect(tile).toHaveCount(0);
  await page.locator('[data-pn-memo-filter="mint"]').click();
  await expect(tile).toHaveCount(1);
  await tile.click();
  await page.locator('#pnDetail [data-pn-edit="memo"]').click();
  const edit=page.locator('#pnDetail [data-pn-form="memo-editor"]');
  await expect(edit.locator('[name="paperColor"][value="mint"]')).toBeChecked();
  await edit.locator('[name="paperColor"][value="peach"]').check();
  await edit.locator('[type="submit"]').click();
  await expect.poll(()=>page.evaluate(()=>
    window.WorkBoardPaletteMemoBridgeV369.readSnapshot()
      .find(m=>m.title==='Palette色分け保存テスト')?.paperColor
  )).toBe('peach');

  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#paletteNextRoot .wb-pn')).toBeVisible({timeout:15000});
  await page.locator('.pn-mobile-nav [data-pn-route="memos"]').click();
  await expect(page.locator('.pn-memotile').filter({hasText:'Palette色分け保存テスト'})).toHaveAttribute('data-paper-color','peach');
  await page.locator('[data-pn-memo-filter="peach"]').click();
  await expect(page.locator('.pn-memotile').filter({hasText:'Palette色分け保存テスト'})).toBeVisible();
  await expect(page.locator('#paletteNextRoot .pn-pagehead p')).toHaveCount(0);
  await page.locator('.pn-mobile-nav [data-pn-route="today"]').click();
  await expect(page.locator('.pn-hero p')).toHaveCount(0);
});

test('Palette schedule date navigation and duration shortcuts are available without Classic dialogs',async({page})=>{
 test.setTimeout(90000);
 await boot(page,1366);
 await page.locator('.pn-rail-nav [data-pn-route="schedule"]').click();
 const before=await page.locator('.pn-weekday[aria-pressed="true"]').getAttribute('data-pn-day');
 await page.locator('[data-pn-day-step="1"]').click();
 const after=await page.locator('.pn-weekday[aria-pressed="true"]').getAttribute('data-pn-day');
 expect(after).not.toBe(before);
 await page.locator('.pn-day-actions [data-pn-edit="schedule"]').click();
 const editor=page.locator('#pnDetail [data-pn-form="schedule-editor"]');
 await expect(editor).toBeVisible();
 await editor.locator('[name="startAt"]').fill('2027-02-08T23:30');
 await editor.locator('[data-pn-duration="90"]').click();
 await expect(editor.locator('[name="endAt"]')).toHaveValue('2027-02-09T01:00');
 await expect(editor.locator('#pnScheduleOverlap')).toBeHidden();
 await expect(page.locator('#scheduleDialog')).toBeHidden();
 await page.locator('#pnDetail [data-pn-close]').click();
 await expect(editor).toHaveCount(0);
});
test('Palette memo color can be changed directly in its detail view and is persisted',async({page})=>{
 test.setTimeout(90000);
 await page.addInitScript(({room})=>{
   localStorage.setItem('system-business-memos:'+room,JSON.stringify({
     'palette-v392-color':{id:'palette-v392-color',title:'色変更の確認',body:'メモの本文です。',
       category:'手順',tags:['確認'],pinned:false,paperColor:'peach',
       revision:1,updatedAt:Date.now(),updatedBy:'PaletteNextTester'}
   }));
 },{room});
 await boot(page,390);
 await expect.poll(()=>page.evaluate(()=>window.WorkBoardPaletteMemoBridgeV369?.readSnapshot?.()
  .find(x=>x.id==='palette-v392-color')?.paperColor)).toBe('peach');
 await page.locator('.pn-mobile-nav [data-pn-route="memos"]').click();
 await page.locator('.pn-memotile[data-paper-color="peach"]').first().click();
 await page.locator('#pnDetail [data-pn-memo-color="mint"]').click();
 await expect.poll(()=>page.evaluate(()=>window.WorkBoardPaletteMemoBridgeV369?.readSnapshot?.()
  .find(x=>x.id==='palette-v392-color')?.paperColor)).toBe('mint');
 await expect(page.locator('#pnDetail [data-pn-memo-color="mint"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#pnDetail')).toBeVisible();
});


for (const width of [390,1366]) {
 test('Palette task-to-schedule navigation and search at '+width+'px',async({page})=>{
  test.setTimeout(90000);
  await boot(page,width);
  const ids=await page.evaluate(async()=>{
   const bridge=window.WorkBoardPaletteBridge,snap=bridge.readSnapshot();
   const assignee=snap.assignees.includes(snap.currentUser)?snap.currentUser:snap.assignees[0];
   const task=await bridge.dispatch({
     type:'task.create',revision:0,ownerRoom:snap.roomId,ownerUser:snap.currentUser,
     title:'連携する確認タスク',assignee,status:snap.statuses.find(x=>x!=='完了')||'未着手',
     priority:'中',category:snap.categories[0]||'その他',
     requester:'',description:'関連確認の本文',tags:'',checklist:'',pinned:false
   });
   if(!task?.ok)return {error:'task: '+(task?.error||'unknown')};
   const day=new Date().toLocaleDateString('sv-SE');
   const plan=await bridge.dispatch({
     type:'schedule.create',revision:0,ownerRoom:snap.roomId,ownerUser:snap.currentUser,
     values:{title:'関連タスク付き予定',startAt:day+'T09:00',endAt:day+'T10:30',
       assignee,category:snap.categories[0]||'その他',location:'会議室A',
       memo:'事前の確認',relatedTaskId:task.id}
   });
   return plan?.ok?{taskId:task.id,scheduleId:plan.id}:{error:'schedule: '+(plan?.error||'unknown')};
  });
  expect(ids.error||'').toBe('');
  await page.locator(width<=780?'.pn-mobile-nav [data-pn-route="schedule"]':
    '.pn-rail-nav [data-pn-route="schedule"]').click();
  const row=page.locator('#paletteNextRoot .pn-scheduleitem').filter({hasText:'関連タスク付き予定'}).first();
  await expect(row).toBeVisible();
  await expect(row.locator('.pn-schedule-time')).toContainText('09:00');
  await expect(row.locator('.pn-schedule-time')).toContainText('10:30');
  await expect(row.locator('.pn-schedule-related')).toContainText('連携する確認タスク');
  await row.locator('[data-pn-linked-task]').click();
  await expect(page.locator('#pnDetail')).toContainText('TASK DETAIL');
  await expect(page.locator('#pnDetail [data-pn-related-back]')).toBeVisible();
  await page.locator('#pnDetail [data-pn-related-back]').click();
  await expect(page.locator('#pnDetail')).toContainText('SCHEDULE DETAIL');
  await page.locator('#pnDetail [data-pn-linked-task]').click();
  await expect(page.locator('#pnDetail')).toContainText('TASK DETAIL');
  await page.locator('#pnDetail [data-pn-plan-task]').click();
  const editor=page.locator('#pnDetail [data-pn-form="schedule-editor"]');
  await expect(editor).toBeVisible();
  await expect(editor.locator('[name="title"]')).toHaveValue('連携する確認タスク');
  await expect(editor.locator('[name="relatedTaskId"]')).toHaveValue(ids.taskId);
  await editor.locator('[data-pn-task-search]').fill('存在しない検索語ZZZ');
  await expect(editor.locator('[name="relatedTaskId"]')).toHaveValue(ids.taskId);
  await expect(editor.locator('[name="relatedTaskId"] option')).toHaveCount(2);
  await editor.locator('[data-pn-task-search]').fill('連携する確認タスク');
  await expect(editor.locator('[name="relatedTaskId"]')).toHaveValue(ids.taskId);
  await page.locator('#pnDetail [data-pn-cancel]').click();
  await expect(editor).toHaveCount(0);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  await row.locator('[data-pn-edit="schedule"]').click();
  await expect(page.locator('#pnDetail [data-pn-form="schedule-editor"]')).toBeVisible();
  await expect(page.locator('#pnDetail [name="title"]')).toHaveValue('関連タスク付き予定');
 });
}


for(const width of [320,390,1366]){
 test('Palette account switch syncs with Classic at '+width+'px',async({page})=>{
  test.setTimeout(90000);
  await boot(page,width);
  const initial=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot());
  expect(initial.users.length).toBeGreaterThanOrEqual(2);
  const candidate=initial.users.find(name=>name!==initial.currentUser);
  expect(candidate).toBeTruthy();
  const refused=await page.evaluate(()=>window.WorkBoardPaletteBridge.selectUser('no-such-board-user-987'));
  expect(refused.ok).toBe(false);
  await page.locator('#pnAccountTrigger').click();
  const menu=page.locator('#pnAccountMenu');
  await expect(menu).toBeVisible();
  const bounds=await menu.evaluate(el=>{
    const b=el.getBoundingClientRect();
    return {left:b.left,right:b.right,width:document.documentElement.clientWidth};
  });
  expect(bounds.left).toBeGreaterThanOrEqual(-2);
  expect(bounds.right).toBeLessThanOrEqual(bounds.width+2);
  const choice=menu.locator('[data-pn-select-user]').nth(initial.users.indexOf(candidate));
  await expect(choice).toBeVisible();
  await choice.click();
  await expect.poll(()=>page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().currentUser)).toBe(candidate);
  await expect(page.locator('#pnAccountName')).toHaveText(candidate);
  await expect(page.locator('#currentUserSelect')).toHaveValue(candidate);
  await expect(menu).toBeHidden();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  await page.locator('#pnMode').selectOption('classic');
  await expect(page.locator('#currentUserSelect')).toHaveValue(candidate);
  await page.locator('[data-wb-display-choice="palette"]').evaluate(el=>el.click());
  await expect(page.locator('#paletteNextRoot .wb-pn')).toBeVisible();
  await expect(page.locator('#pnAccountName')).toHaveText(candidate);
 });
}
test('Palette prevents accidental account switch during a task edit',async({page})=>{
 test.setTimeout(90000);
 await boot(page,390);
 const initial=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot());
 const candidate=initial.users.find(name=>name!==initial.currentUser);
 expect(candidate).toBeTruthy();
 await page.locator('.pn-mobile-nav [data-pn-route="tasks"]').click();
 await page.locator('#paletteNextRoot [data-pn-edit="task"]').first().click();
 const editor=page.locator('#pnDetail [data-pn-form="task-editor"]');
 await expect(editor).toBeVisible();
 await editor.locator('[name="title"]').fill('切替前に入力していたタスク');
 // Backdrop blocks real interaction; exercise the defensive draft guard
 // using the same delegated click event without lifting modal layering.
 await page.locator('#pnAccountTrigger').evaluate(el=>el.click());
 const option=page.locator('#pnAccountMenu [data-pn-select-user]').nth(initial.users.indexOf(candidate));
 page.once('dialog',dialog=>{
  expect(dialog.message()).toContain('入力中の変更');
  return dialog.dismiss();
 });
 await option.evaluate(el=>el.click());
 await expect(editor).toBeVisible();
 await expect(editor.locator('[name="title"]')).toHaveValue('切替前に入力していたタスク');
 await expect.poll(()=>page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().currentUser))
  .toBe(initial.currentUser);
 page.once('dialog',dialog=>dialog.accept());
 await option.evaluate(el=>el.click());
 await expect(editor).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().currentUser)).toBe(candidate);
 await expect(page.locator('#pnAccountTrigger')).toHaveAttribute('aria-expanded','false');
});


for(const width of [320,900,1366]){
 test('Palette account menu searches registered users without losing data at '+width+'px',async({page})=>{
  test.setTimeout(90000);
  await boot(page,width);
  const initial=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot());
  const candidate=initial.users.find(name=>name!==initial.currentUser);
  expect(candidate).toBeTruthy();
  if(width>780){
    await page.locator('#pnSearch').fill('前の利用者の検索条件');
    await expect(page.locator('#pnSearch')).toHaveValue('前の利用者の検索条件');
  }
  const trigger=page.locator('#pnAccountTrigger');
  await trigger.click();
  const menu=page.locator('#pnAccountMenu');
  const search=menu.locator('#pnAccountSearch');
  await expect(search).toBeVisible();
  await expect(menu.locator('[data-pn-select-user]')).toHaveCount(initial.users.length);
  await expect(menu.locator('#pnAccountMatches')).toContainText(initial.users.length+' / '+initial.users.length+'人');
  await search.fill('一致しない利用者ZZZ123');
  await expect(menu.locator('#pnAccountNoMatches')).toBeVisible();
  await expect(menu.locator('#pnAccountMatches')).toContainText('0 / '+initial.users.length+'人');
  await expect(menu.locator('[data-pn-select-user]:visible')).toHaveCount(0);
  await search.fill(candidate);
  const matching=menu.locator('[data-pn-select-user]').filter({hasText:candidate}).first();
  await expect(matching).toBeVisible();
  await matching.click();
  await expect(menu).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().currentUser))
    .toBe(candidate);
  await expect(page.locator('#currentUserSelect')).toHaveValue(candidate);
  if(width>780){
    await expect(page.locator('#pnSearch')).toHaveValue('');
  }
  await trigger.click();
  await expect(search).toHaveValue('');
  await expect(menu.locator('#pnAccountMatches')).toContainText(initial.users.length+' / '+initial.users.length+'人');
  await expect(menu.locator('[aria-checked="true"]')).toHaveAttribute('data-pn-select-user',candidate);
  await search.fill('不存在データ123ABC');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded','false');
  await trigger.click();
  await expect(search).toHaveValue('');
  const box=await menu.evaluate(el=>{
    const b=el.getBoundingClientRect();
    return {left:b.left,right:b.right,width:document.documentElement.clientWidth,
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
  });
  expect(box.left).toBeGreaterThanOrEqual(-2);
  expect(box.right).toBeLessThanOrEqual(box.width+2);
  expect(box.overflow).toBeLessThanOrEqual(2);
 });
}


test('Palette task inspector presents checklist progress, timeline and tags without mutating data',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  await page.locator('.pn-mobile-nav [data-pn-route="tasks"]').click();
  await page.locator('[data-pn-edit="task"]').first().click();
  const form=page.locator('#pnDetail [data-pn-form="task-editor"]');
  await form.locator('[name="title"]').fill('Palette 詳細UIテスト');
  await form.locator('[name="description"]').fill('画面の確認\n詳細メモを表示');
  await form.locator('[name="tags"]').fill('デザイン, 運用');
  await form.locator('[name="checklist"]').fill('カードの配置\n更新履歴');
  await form.locator('[type="submit"]').click();
  await expect(form).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>
    window.WorkBoardPaletteBridge.readSnapshot().tasks.find(t=>t.title==='Palette 詳細UIテスト')?.checklist.length
  )).toBe(2);
  const row=page.locator('#paletteNextRoot .pn-flowrow').filter({hasText:'Palette 詳細UIテスト'});
  await expect(row).toBeVisible();
  await row.locator('[data-pn-detail="task"]').click();
  const detail=page.locator('#pnDetail');
  await expect(detail).toHaveAttribute('data-inspector','task');
  await expect(detail.locator('.pn-inspect-hero')).toContainText('TASK DETAIL');
  await expect(detail.locator('.pn-inspect-icon svg path')).toHaveCount(1);
  await expect(detail.locator('.pn-inspect-facts .pn-inspect-fact')).toHaveCount(4);
  await expect(detail.locator('.pn-inspect-checklist li')).toHaveCount(2);
  await expect(detail.locator('.pn-inspect-progress [role="progressbar"]')).toHaveAttribute('aria-valuenow','0');
  await expect(detail.locator('.pn-inspect-tags')).toContainText('デザイン');
  await expect(detail.locator('.pn-inspect-prose')).toContainText('詳細メモを表示');
  await expect(detail.locator('.pn-inspect-history li').first()).toBeVisible();
  await expect(detail.locator('[data-pn-edit="task"]')).toBeVisible();
  const inspectorWidth=await detail.locator('.pn-inspect-hero').evaluate(el=>el.getBoundingClientRect().width);
  expect(inspectorWidth).toBeGreaterThan(230);
  await detail.locator('[data-pn-edit="task"]').click();
  await expect(detail).toHaveAttribute('data-inspector','');
  await expect(detail.locator('[data-pn-form="task-editor"]')).toBeVisible();
  await expect(detail.locator('[name="title"]')).toHaveValue('Palette 詳細UIテスト');
  await detail.locator('[data-pn-cancel]').click();
  await expect(detail).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
    .toBeLessThanOrEqual(2);
});

for(const width of [320,390,1366]) {
  test('Palette has explicit account switch affordance at '+width+'px',async({page})=>{
    test.setTimeout(90000);
    await boot(page,width);
    const snapshot=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot());
    const current=snapshot.currentUser;
    const candidate=snapshot.users.find(name=>name!==current);
    expect(candidate).toBeTruthy();
    const strip=page.locator('#paletteNextRoot .pn-account-strip');
    const shortcut=page.locator('#paletteNextRoot [data-pn-account-shortcut]');
    const trigger=page.locator('#pnAccountTrigger');
    if(width<=780){
      await expect(strip).toBeVisible();
      await expect(strip.locator('#pnAccountStripName')).toHaveText(current);
      await expect(shortcut).toBeVisible();
      await shortcut.click();
      await expect(trigger).toHaveAttribute('aria-expanded','true');
    }else{
      await expect(strip).toBeHidden();
      await expect(page.locator('#paletteNextRoot .pn-account-meta small')).toContainText('利用者切替');
      await expect(page.locator('#pnAccountName')).toHaveText(current);
      await trigger.click();
    }
    const menu=page.locator('#pnAccountMenu');
    await expect(menu).toBeVisible();
    const choice=menu.locator('[data-pn-select-user]').nth(snapshot.users.indexOf(candidate));
    await choice.click();
    await expect(menu).toBeHidden();
    await expect.poll(()=>page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().currentUser))
      .toBe(candidate);
    await expect(page.locator('#pnAccountName')).toHaveText(candidate);
    await expect(strip.locator('#pnAccountStripName')).toHaveText(candidate);
    await expect(page.locator('#currentUserSelect')).toHaveValue(candidate);
    if(width<=780){
      await shortcut.click();
      await expect(menu).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await expect(shortcut).toBeFocused();
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
      .toBeLessThanOrEqual(2);
  });
}


test('Palette task portfolio shows genuine urgency, checklist progress and compact mobile metadata',async({page})=>{
  test.setTimeout(90000);
  await boot(page,1366);
  await page.locator('.pn-rail-nav [data-pn-route="tasks"]').click();
  const metric=page.locator('#paletteNextRoot .pn-task-metric');
  await expect(metric).toHaveCount(3);
  const dayBefore=await page.evaluate(()=>{
    const date=new Date();
    date.setDate(date.getDate()-1);
    return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),
      String(date.getDate()).padStart(2,'0')].join('-');
  });
  await page.locator('#paletteNextRoot [data-pn-edit="task"]').first().click();
  const form=page.locator('#pnDetail [data-pn-form="task-editor"]');
  await form.locator('[name="title"]').fill('Palette 視覚的なタスク一覧');
  await form.locator('[name="description"]').fill('期限と進捗の情報を持つタスクです。');
  await form.locator('[name="priority"]').selectOption('緊急');
  await form.locator('[name="dueDate"]').fill(dayBefore);
  await form.locator('[name="checklist"]').fill('企画内容を整理\n資料を作成');
  await form.locator('[type="submit"]').click();
  await expect(form).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot()
    .tasks.some(t=>t.title==='Palette 視覚的なタスク一覧'))).toBe(true);
  const row=page.locator('#paletteNextRoot .pn-flowrow').filter({hasText:'Palette 視覚的なタスク一覧'});
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute('data-task-tone','overdue');
  await expect(row.locator('.pn-task-priority')).toHaveText('緊急');
  await expect(row.locator('.pn-task-mini-progress')).toHaveAttribute('aria-valuenow','0');
  await expect(row.locator('.pn-task-mini-count')).toHaveText('0/2');
  await expect(row.locator('.pn-flowdate')).toContainText('期限超過');
  await expect(metric.nth(1).locator('.pn-task-metric-data strong')).not.toHaveText('0');
  await row.locator('[data-pn-bulk-id]').check();
  await expect(page.locator('#paletteNextRoot .pn-bulk-heading')).toContainText('1件選択中');
  await row.locator('[data-pn-bulk-id]').uncheck();
  await row.locator('[data-pn-detail="task"]').click();
  await expect(page.locator('#pnDetail .pn-inspect-checklist li')).toHaveCount(2);
  await page.locator('#pnDetail [data-pn-close]').click();

  await page.setViewportSize({width:320,height:740});
  const rowMobile=page.locator('#paletteNextRoot .pn-flowrow').filter({hasText:'Palette 視覚的なタスク一覧'});
  await expect(rowMobile.locator('.pn-flowdate')).toBeHidden();
  await expect(rowMobile.locator('.pn-task-mobile-due')).toBeVisible();
  await expect(rowMobile.locator('.pn-task-mobile-due')).toContainText('期限超過');
  await expect(metric).toHaveCount(3);
  const layout=await page.evaluate(()=>{
    const stat=document.querySelector('#paletteNextRoot .pn-task-overview');
    return {
      statColumns:getComputedStyle(stat).gridTemplateColumns.split(' ').length,
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
    };
  });
  expect(layout.statColumns).toBe(3);
  expect(layout.overflow).toBeLessThanOrEqual(2);
});


for(const width of [320,390,1366]){
  test('Palette ToDo composer follows title, note, then right-aligned save at '+width+'px',async({page})=>{
    test.setTimeout(90000);
    await boot(page,width);
    const nav=width<=780?'.pn-mobile-nav':'.pn-rail-nav';
    await page.locator('#paletteNextRoot '+nav+' [data-pn-route="todos"]').click();
    const form=page.locator('#paletteNextRoot [data-pn-form="todo"]');
    const title=form.locator('#pnTodoInput');
    const memo=form.locator('#pnTodoMemo');
    const footer=form.locator('.pn-compose-footer');
    const submit=footer.locator('button[type="submit"]');
    await expect(title).toBeVisible();
    await expect(memo).toBeVisible();
    await expect(submit).toBeVisible();
    const metrics=await form.evaluate(el=>{
      const box=x=>{const b=x.getBoundingClientRect();return {top:b.top,bottom:b.bottom,right:b.right,width:b.width}};
      const title=box(el.querySelector('#pnTodoInput'));
      const memo=box(el.querySelector('#pnTodoMemo'));
      const button=box(el.querySelector('[type="submit"]'));
      const footer=box(el.querySelector('.pn-compose-footer'));
      return {title,memo,button,footer};
    });
    expect(metrics.title.bottom).toBeLessThan(metrics.memo.top);
    expect(metrics.memo.bottom).toBeLessThan(metrics.button.top);
    expect(Math.abs(metrics.footer.right-metrics.button.right)).toBeLessThanOrEqual(2);
    await title.fill('Paletteフォーム順序テスト '+width);
    await memo.fill('補足内容が保存されるかを確認');
    await submit.click();
    await expect.poll(()=>page.evaluate(w=>{
      const item=window.WorkBoardPaletteBridge.readSnapshot().todos.find(t=>t.text==='Paletteフォーム順序テスト '+w);
      return item?.memo;
    },width)).toBe('補足内容が保存されるかを確認');
    await expect(page.locator('#paletteNextRoot .pn-todo-overview [role="progressbar"]')).toHaveAttribute('aria-valuenow',/^\d+$/);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });
}

test('Palette daily surface remains compact and semantically themed in light and dark',async({page})=>{
  await boot(page,390);
  const focus=page.locator('#paletteNextRoot .pn-surface-focus');
  const todo=page.locator('#paletteNextRoot .pn-surface-todo');
  const schedule=page.locator('#paletteNextRoot .pn-surface-schedule');
  const notice=page.locator('#paletteNextRoot .pn-surface-notice');
  for(const surface of [focus,todo,schedule,notice])await expect(surface).toBeVisible();
  const hero=page.locator('#paletteNextRoot .pn-hero');
  const mobileHero=await hero.evaluate(el=>getComputedStyle(el).minHeight);
  expect(parseFloat(mobileHero)).toBeLessThanOrEqual(190);
  await page.locator('#paletteNextRoot [data-pn-theme]').click();
  await expect(page.locator('#pnApp')).toHaveAttribute('data-theme','dark');
  for(const surface of [focus,todo,schedule,notice]) {
    const isOpaque=await surface.evaluate(el=>{
      const computed=getComputedStyle(el).backgroundColor;
      return computed!=='rgba(0, 0, 0, 0)'&&computed!=='transparent';
    });
    expect(isOpaque).toBe(true);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
    .toBeLessThanOrEqual(2);
});

for(const width of [390,1366]){
 test('Palette weekly agenda shows the whole week and creates on the chosen date at '+width+'px',async({page})=>{
   test.setTimeout(90000);
   await boot(page,width);
   await page.locator(width<=780?'.pn-mobile-nav [data-pn-route="schedule"]':
     '.pn-rail-nav [data-pn-route="schedule"]').click();
   await page.locator('#paletteNextRoot [data-pn-week-shift="7"]').click();
   await page.locator('#paletteNextRoot [data-pn-schedule-view="week"]').click();
   await expect(page.locator('#paletteNextRoot [data-pn-schedule-view="week"]'))
     .toHaveAttribute('aria-pressed','true');
   const groups=page.locator('#paletteNextRoot .pn-week-agenda-day');
   await expect(groups).toHaveCount(7);
   const monday=await groups.first().getAttribute('data-pn-agenda-day');
   expect(monday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
   const result=await page.evaluate(async({date})=>{
     const bridge=window.WorkBoardPaletteBridge;
     const snap=bridge.readSnapshot();
     return bridge.dispatch({
       type:'schedule.create',revision:0,ownerRoom:snap.roomId,ownerUser:snap.currentUser,
       values:{title:'週間一覧の確認',startAt:date+'T14:00',endAt:date+'T15:00',
         assignee:snap.currentUser,category:snap.categories[0]||'その他',
         location:'',memo:'',relatedTaskId:''}
     });
   },{date:monday});
   expect(result?.ok).toBe(true);
   await expect(groups.first().locator('.pn-scheduleopen')).toContainText('週間一覧の確認');
   await expect(groups.first().locator('.pn-schedule-time')).toContainText('14:00');
   await groups.nth(2).locator('[data-pn-agenda-add]').click();
   const editor=page.locator('#pnDetail [data-pn-form="schedule-editor"]');
   await expect(editor).toBeVisible();
   const wednesday=await groups.nth(2).getAttribute('data-pn-agenda-day');
   await expect(editor.locator('[name="startAt"]')).toHaveValue(wednesday+'T09:00');
   await expect(editor.locator('[name="endAt"]')).toHaveValue(wednesday+'T10:00');
   await page.locator('#pnDetail [data-pn-cancel]').click();
   await expect(editor).toHaveCount(0);
   await groups.first().locator('[data-pn-open-day]').click();
   await expect(page.locator('#paletteNextRoot .pn-schedule-sheet')).toBeVisible();
   await expect(page.locator('#paletteNextRoot [data-pn-schedule-view="day"]'))
     .toHaveAttribute('aria-pressed','true');
   await expect(page.locator('#paletteNextRoot .pn-schedule-sheet .pn-scheduleopen'))
     .toContainText('週間一覧の確認');
   expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
     .toBeLessThanOrEqual(2);
 });
}

for(const width of [320,390]){
  test('Palette search works on '+width+'px phones and filters the Today workspace',async({page})=>{
    test.setTimeout(90000);
    await boot(page,width);
    const nav=page.locator('#paletteNextRoot .pn-mobile-nav');
    await nav.locator('[data-pn-route="todos"]').click();
    await page.locator('#pnTodoInput').fill('Paletteモバイル検索対象');
    await page.locator('[data-pn-form="todo"] [type="submit"]').click();
    await expect.poll(()=>page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().todos
      .some(t=>t.text==='Paletteモバイル検索対象'))).toBe(true);
    await nav.locator('[data-pn-route="today"]').click();
    const search=page.locator('#pnSearch');
    await expect(search).toBeVisible();
    await search.fill('Paletteモバイル検索対象');
    const todayTodos=page.locator('#paletteNextRoot .pn-surface-todo .pn-todolist');
    await expect(todayTodos.locator('li')).toHaveCount(1);
    await expect(todayTodos).toContainText('Paletteモバイル検索対象');
    await expect(page.locator('#paletteNextRoot .pn-surface-focus .pn-empty'))
      .toContainText('検索に一致する優先タスクはありません');
    await nav.locator('[data-pn-route="todos"]').click();
    await expect(search).toHaveValue('Paletteモバイル検索対象');
    await expect(page.locator('#paletteNextRoot .pn-todo-columns')).toContainText('Paletteモバイル検索対象');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    await page.locator('#paletteNextRoot [data-pn-theme]').click();
    await expect(page.locator('#pnApp')).toHaveAttribute('data-theme','dark');
    await expect(search).toBeVisible();
  });
}

test('Palette completed ToDos start compact, expand on demand and remain fully searchable',async({page})=>{
  test.setTimeout(120000);
  await boot(page,390);
  await page.locator('.pn-mobile-nav [data-pn-route="todos"]').click();
  const originalDone=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().todos
    .filter(item=>item.completed).length);
  for(let i=0;i<8;i++){
    const name='Palette完了履歴'+i;
    await page.locator('#pnTodoInput').fill(name);
    await page.locator('[data-pn-form="todo"] [type="submit"]').click();
    const row=page.locator('#paletteNextRoot .pn-todo-columns .pn-sheet').first()
      .locator('.pn-todolist li').filter({hasText:name});
    await expect(row).toBeVisible();
    const check=row.locator('[data-pn-cmd="todo.toggle"]');
    if(i===0){
      const target=await check.evaluate(el=>{
        const box=el.getBoundingClientRect();
        const artwork=getComputedStyle(el,'::before');
        return {width:box.width,height:box.height,artWidth:artwork.width};
      });
      expect(target.width).toBeGreaterThanOrEqual(40);
      expect(target.height).toBeGreaterThanOrEqual(40);
      expect(parseFloat(target.artWidth)).toBeLessThanOrEqual(24);
    }
    await check.click();
    await expect.poll(()=>page.evaluate(value=>{
      return window.WorkBoardPaletteBridge.readSnapshot().todos.find(t=>t.text===value)?.completed;
    },name)).toBe(true);
  }
  const done=page.locator('#pnDoneItems');
  const toggle=page.locator('[data-pn-done-toggle]');
  await expect(done.locator('li')).toHaveCount(6);
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(toggle).toContainText('残り'+(originalDone+2)+'件を表示');
  await toggle.click();
  await expect(done.locator('li')).toHaveCount(originalDone+8);
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  await page.locator('#pnSearch').fill('Palette完了履歴7');
  await expect(done.locator('li')).toHaveCount(1);
  await expect(done).toContainText('Palette完了履歴7');
  await expect(toggle).toHaveCount(0);
  await page.locator('#pnSearch').fill('');
  await expect(done.locator('li')).toHaveCount(originalDone+8);
  await page.locator('[data-pn-done-toggle]').click();
  await expect(done.locator('li')).toHaveCount(6);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
    .toBeLessThanOrEqual(2);
});


for(const width of [390,1366]){
 test('Palette keeps an unsaved ToDo during a live update and clears it after save at '+width+'px',async({page})=>{
  test.setTimeout(90000);
  await boot(page,width);
  await page.locator(width<=780?'.pn-mobile-nav [data-pn-route="todos"]':
    '.pn-rail-nav [data-pn-route="todos"]').click();
  const input=page.locator('#pnTodoInput'),memo=page.locator('#pnTodoMemo');
  await input.fill('複数端末の更新でも残す入力');
  await memo.fill('未保存の補足内容');
  await input.focus();
  await input.evaluate(el=>el.setSelectionRange(5,5));
  const result=await page.evaluate(()=>window.WorkBoardPaletteBridge.dispatch({
    type:'todo.create',text:'別の更新で再描画',memo:''
  }));
  expect(result?.ok).toBe(true);
  await expect(page.locator('#paletteNextRoot .pn-todolist')).toContainText('別の更新で再描画');
  await expect(input).toHaveValue('複数端末の更新でも残す入力');
  await expect(memo).toHaveValue('未保存の補足内容');
  await expect(input).toBeFocused();
  const selection=await input.evaluate(el=>({start:el.selectionStart,end:el.selectionEnd}));
  expect(selection).toEqual({start:5,end:5});
  await input.press('Enter');
  await expect.poll(()=>page.evaluate(()=>
    window.WorkBoardPaletteBridge.readSnapshot().todos.filter(t=>t.text==='複数端末の更新でも残す入力').length
  )).toBe(1);
  await expect(input).toHaveValue('');
  await expect(memo).toHaveValue('');
  await expect(input).toBeFocused();
  await expect(page.locator('#paletteNextRoot .pn-compose [type="submit"]')).toBeEnabled();
 });
 test('Palette task list remains dense and task selection has a 42px target at '+width+'px',async({page})=>{
  test.setTimeout(90000);
  await boot(page,width);
  const result=await page.evaluate(()=>{
    const bridge=window.WorkBoardPaletteBridge,snap=bridge.readSnapshot();
    return bridge.dispatch({
      type:'task.create',revision:0,ownerRoom:snap.roomId,ownerUser:snap.currentUser,
      title:'情報密度確認用のタスク',assignee:snap.currentUser,
      status:snap.statuses.find(s=>s!=='完了')||'未着手',
      priority:'中',category:snap.categories[0]||'その他',requester:'',
      description:'',tags:'',checklist:'',pinned:false
    });
  });
  expect(result?.ok).toBe(true);
  await page.locator(width<=780?'.pn-mobile-nav [data-pn-route="tasks"]':
    '.pn-rail-nav [data-pn-route="tasks"]').click();
  const metrics=page.locator('#paletteNextRoot .pn-task-overview .pn-task-metric');
  await expect(metrics).toHaveCount(3);
  const metricBounds=await metrics.evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect()));
  expect(Math.max(...metricBounds.map(x=>x.top))-Math.min(...metricBounds.map(x=>x.top))).toBeLessThan(2);
  expect(Math.max(...metricBounds.map(x=>x.height))).toBeLessThan(115);
  const row=page.locator('#paletteNextRoot .pn-flowrow').filter({hasText:'情報密度確認用のタスク'});
  await expect(row).toBeVisible();
  const bounds=await row.locator('.pn-bulkcheck').evaluate(el=>el.getBoundingClientRect().toJSON());
  expect(bounds.width).toBeGreaterThanOrEqual(42);
  expect(bounds.height).toBeGreaterThanOrEqual(42);
  await row.locator('[data-pn-bulk-id]').check();
  await expect(row.locator('[data-pn-bulk-id]')).toBeChecked();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
    .toBeLessThanOrEqual(2);
 });
}
test('Palette asks before discarding an unsaved ToDo during user switching',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  const snap=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot());
  const next=snap.users.find(name=>name!==snap.currentUser);
  expect(next).toBeTruthy();
  await page.locator('.pn-mobile-nav [data-pn-route="todos"]').click();
  await page.locator('#pnTodoInput').fill('利用者切替前の未保存ToDo');
  await page.locator('#pnAccountTrigger').click();
  const button=page.locator('#pnAccountMenu [data-pn-select-user]').nth(snap.users.indexOf(next));
  page.once('dialog',dialog=>dialog.dismiss());
  await button.click();
  await expect(page.locator('#pnTodoInput')).toHaveValue('利用者切替前の未保存ToDo');
  await expect.poll(()=>page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().currentUser))
    .toBe(snap.currentUser);
  page.once('dialog',dialog=>dialog.accept());
  await button.click();
  await expect.poll(()=>page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().currentUser))
    .toBe(next);
  await expect(page.locator('#pnTodoInput')).toHaveValue('');
});

for(const width of [320,390,1366]){
  test('Palette date jump and responsive duration selection at '+width+'px',async({page})=>{
    await boot(page,width);
    const nav=width<=780?'.pn-mobile-nav':'.pn-rail-nav';
    await page.locator(nav+' [data-pn-route="schedule"]').click();
    const date=page.locator('#paletteNextRoot [data-pn-date-jump]');
    await expect(date).toBeVisible();
    await date.fill('2027-02-17');
    await expect(date).toHaveValue('2027-02-17');
    await expect(page.locator('#paletteNextRoot .pn-schedule-sheet h2')).toContainText('2/17');
    await page.locator('[data-pn-schedule-view="week"]').click();
    const days=page.locator('.pn-week-agenda-day');
    await expect(days).toHaveCount(7);
    await expect(page.locator('.pn-week-agenda-heading')).toContainText('2027-02-15 〜 2027-02-21');
    await days.nth(2).locator('[data-pn-agenda-add]').click();
    const editor=page.locator('#pnDetail [data-pn-form="schedule-editor"]');
    await expect(editor.locator('[name="startAt"]')).toHaveValue('2027-02-17T09:00');
    await expect(editor.locator('[data-pn-duration="60"]')).toHaveAttribute('aria-pressed','true');
    await editor.locator('[data-pn-duration="90"]').click();
    await expect(editor.locator('[name="endAt"]')).toHaveValue('2027-02-17T10:30');
    await expect(editor.locator('[data-pn-duration="90"]')).toHaveAttribute('aria-pressed','true');
    await editor.locator('[name="endAt"]').fill('2027-02-17T10:45');
    await expect(editor.locator('[data-pn-duration="90"]')).toHaveAttribute('aria-pressed','false');
    await page.locator('#pnDetail [data-pn-cancel]').click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
      .toBeLessThanOrEqual(2);
  });
}


for(const width of [390,1366]){
 test('Palette ToDo title opens detail and completing preserves useful keyboard focus at '+width+'px',async({page})=>{
  test.setTimeout(90000);
  await boot(page,width);
  const name='表題から詳細を開く確認 '+width;
  const created=await page.evaluate(async title=>
    window.WorkBoardPaletteBridge.dispatch({type:'todo.create',text:title,memo:'補足'})
  ,name);
  expect(created?.ok).toBe(true);
  const nav=width<=780?'.pn-mobile-nav':'.pn-rail-nav';
  await page.locator(nav+' [data-pn-route="todos"]').click();
  const row=page.locator('#paletteNextRoot .pn-todolist li').filter({hasText:name});
  await expect(row).toBeVisible();
  await expect(row.locator('[data-pn-detail="todo"]')).toHaveCount(1);
  await row.locator('.pn-todoopen').click();
  await expect(page.locator('#pnDetail')).toHaveAttribute('data-inspector','todo');
  await expect(page.locator('#pnDetail .pn-inspect-hero')).toContainText(name);
  await page.locator('#pnDetail [data-pn-close]').click();
  const button=row.locator('[data-pn-cmd="todo.toggle"]');
  await button.focus();
  await button.click();
  await expect.poll(()=>page.evaluate(title=>
    window.WorkBoardPaletteBridge.readSnapshot().todos.find(todo=>todo.text===title)?.completed
  ,name)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>
    document.activeElement?.getAttribute('data-pn-cmd')==='todo.toggle'
  )).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
    .toBeLessThanOrEqual(2);
 });
 test('Palette task multi-select and filter keep keyboard focus at '+width+'px',async({page})=>{
  test.setTimeout(90000);
  await boot(page,width);
  const created=await page.evaluate(async()=>{
    const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
    return bridge.dispatch({type:'task.create',revision:0,ownerRoom:s.roomId,ownerUser:s.currentUser,
      title:'キーボード一括選択',assignee:s.currentUser,
      status:s.statuses.find(x=>x!=='完了')||'未着手',
      priority:'中',category:s.categories[0]||'その他',
      requester:'',description:'',tags:'',checklist:'',pinned:false});
  });
  expect(created?.ok).toBe(true);
  const nav=width<=780?'.pn-mobile-nav':'.pn-rail-nav';
  await page.locator(nav+' [data-pn-route="tasks"]').click();
  const row=page.locator('#paletteNextRoot .pn-flowrow').filter({hasText:'キーボード一括選択'});
  const check=row.locator('[data-pn-bulk-id]');
  await check.focus();
  await check.check();
  await expect(check).toBeChecked();
  await expect(check).toBeFocused();
  await page.keyboard.press('Space');
  await expect(check).not.toBeChecked();
  await expect(check).toBeFocused();
  await check.check();
  const action=page.locator('#paletteNextRoot [data-pn-bulk-action]');
  await action.focus();
  await action.selectOption('category');
  await expect(action).toBeFocused();
  await page.locator('#paletteNextRoot [data-pn-bulk-clear]').click();
  await expect(page.locator('#paletteNextRoot [data-pn-bulk-all]')).toBeFocused();
  await page.locator('#paletteNextRoot [data-pn-filter="mine"]').click();
  await expect(page.locator('#paletteNextRoot [data-pn-filter="mine"]')).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
    .toBeLessThanOrEqual(2);
 });
}
