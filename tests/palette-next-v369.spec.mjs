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
    localStorage.setItem('systemTaskUser','PaletteNextTester');
    localStorage.setItem('systemTaskRoomId',room);
  },{room});
  await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
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
  await expect(page.locator('.app-shell')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','modern');
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
  await expect(page.locator('.pn-memobody')).toContainText('連絡先と手順をまとめたメモです。');
});

test('Palette switching preserves saved design preference',async({page})=>{
  await boot(page);
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','palette');
  await page.locator('#pnMode').selectOption('modern');
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','modern');
  await expect(page.locator('.app-shell')).toBeVisible();
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
  await page.locator('.pn-scheduleopen').filter({hasText:'NEXT 予定追加テスト'}).click();
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
    ownerUser:'PaletteNextTester',title:'一括変更A',assignee:item.assignee,status:item.status,
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
