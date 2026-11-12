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

// Playwright can reposition a row between scrollIntoViewIfNeeded() and click.
// The actual click position is the one Palette records for later restoration.
async function clickSeriesRowAndCaptureOffset(drawer,row) {
  await drawer.evaluate(el=>{
    el.addEventListener('click',event=>{
      const source=event.target.closest('[data-pn-series-index-open],[data-pn-series-index-edit]');
      if(!source||!el.contains(source))return;
      el.dataset.pnTestClickedSeriesRowOffset=String(
        source.getBoundingClientRect().top-el.getBoundingClientRect().top);
    },{capture:true,once:true});
  });
  await row.click();
  const offset=await drawer.evaluate(el=>{
    const value=el.dataset.pnTestClickedSeriesRowOffset;
    delete el.dataset.pnTestClickedSeriesRowOffset;
    return value==null?null:Number(value);
  });
  expect(offset).not.toBeNull();
  expect(Number.isFinite(offset)).toBe(true);
  return offset;
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

// Focus Canvas is not a renamed dashboard: its primary task is actionable,
// appears exactly once, and can open a real related schedule from the same view.
for(const width of [320,390,1366]){
  test('Palette Studio Focus Canvas opens a real focus task and its linked plan at '+width+'px',async({page})=>{
    test.setTimeout(90000);
    await boot(page,width);
    const seeded=await page.evaluate(async()=>{
      const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
      const today=new Date().toLocaleDateString('sv-SE');
      const nextDate=new Date();nextDate.setDate(nextDate.getDate()+1);
      const tomorrow=nextDate.toLocaleDateString('sv-SE');
      const base={revision:0,ownerRoom:s.roomId,ownerUser:s.currentUser,
        assignee:s.currentUser,status:s.statuses.find(v=>v!=='完了')||'未着手',
        category:s.categories[0]||'その他',requester:'',description:'',
        tags:'',checklist:'',pinned:false};
      const first=await bridge.dispatch({type:'task.create',...base,
        title:'Focus Canvas 優先タスク',priority:'緊急',dueDate:today});
      const second=await bridge.dispatch({type:'task.create',...base,
        title:'Focus Canvas 次のタスク',priority:'中',dueDate:tomorrow});
      if(!first?.ok||!second?.ok)return {error:'task'};
      const plan=await bridge.dispatch({type:'schedule.create',revision:0,
        ownerRoom:s.roomId,ownerUser:s.currentUser,
        values:{title:'Focus Canvas 関連予定',startAt:tomorrow+'T09:00',
          endAt:tomorrow+'T10:00',assignee:s.currentUser,
          category:s.categories[0]||'その他',location:'',memo:'',relatedTaskId:first.id}});
      return plan?.ok?{first:first.id,second:second.id,plan:plan.id}:{error:'schedule'};
    });
    expect(seeded.error||'').toBe('');
    const canvas=page.locator('#paletteNextRoot .pn-studio-today');
    await expect(canvas.locator('.pn-studio-focus-stage [data-pn-detail="task"]'))
      .toHaveAttribute('data-id',seeded.first);
    await expect(canvas.locator('.pn-hero-feature')).toContainText('Focus Canvas 優先タスク');
    await expect(canvas.locator('.pn-surface-focus [data-pn-detail="task"]'))
      .toHaveCount(1);
    await expect(canvas.locator('.pn-surface-focus [data-pn-detail="task"]'))
      .toHaveAttribute('data-id',seeded.second);
    const related=canvas.locator('.pn-studio-related');
    await expect(related).toContainText('Focus Canvas 関連予定');
    await expect(related).toHaveAttribute('data-id',seeded.plan);
    const layout=await page.evaluate(()=>{
      const stage=document.querySelector('#paletteNextRoot .pn-studio-focus-stage');
      const rail=document.querySelector('#paletteNextRoot .pn-studio-time-rail');
      const cta=document.querySelector('#paletteNextRoot .pn-studio-cta');
      return {overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        stage:stage.getBoundingClientRect().toJSON(),rail:rail.getBoundingClientRect().toJSON(),
        ctaHeight:cta.getBoundingClientRect().height};
    });
    expect(layout.overflow).toBeLessThanOrEqual(2);
    expect(layout.ctaHeight).toBeGreaterThanOrEqual(43);
    if(width>780){
      expect(layout.stage.right).toBeLessThanOrEqual(layout.rail.left+1);
    }else{
      expect(layout.stage.bottom).toBeLessThanOrEqual(layout.rail.top+1);
    }
    await related.click();
    await expect(page.locator('#pnDetail')).toContainText('SCHEDULE DETAIL');
    await page.locator('#pnDetail [data-pn-close]').click();
    await canvas.locator('.pn-studio-cta').click();
    await expect(page.locator('#pnDetail')).toContainText('TASK DETAIL');
  });
}

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
  // The visual board is the default; test this existing dense-list contract.
  await page.locator('#paletteNextRoot [data-pn-task-view="list"]').click();
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
  const createdAction=page.locator('#pnToast [data-pn-saved-schedule]');
  await expect(createdAction).toBeVisible();
  await createdAction.click();
  await expect(page.locator('#pnDetail')).toHaveAttribute('data-inspector','schedule');
  await expect(page.locator('#pnDetail .pn-inspect-hero h2')).toContainText('NEXT 予定追加テスト');
  await page.locator('#pnDetail [data-pn-close]').click();
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
  const glance=page.locator('#pnDetail .pn-inspect-agenda');
  await expect(glance).toContainText('テスト会議室');
  await expect(glance).toContainText('関連タスクなし');
  await expect(page.locator('#pnDetail .pn-inspect-facts-schedule dt'))
    .toHaveText(['担当者','分類','繰り返し']);
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
  await expect(copy.locator('.pn-copy-review-meta')).toContainText('毎週');
  await expect(copy.locator('.pn-copy-review-note')).toContainText('再プレビュー');
  await expect(copy.locator('[data-pn-copy-submit]')).toBeEnabled();
  await copy.locator('[data-pn-copy-submit]').click();
  await expect(copy).toBeHidden();
  const batchAction=page.locator('#pnToast [data-pn-saved-schedule]');
  await expect(batchAction).toBeVisible();
  await expect(batchAction).toContainText('作成した予定を確認');
  await batchAction.click();
  await expect(page.locator('#pnDetail')).toHaveAttribute('data-inspector','schedule');
  await expect(page.locator('#pnDetail .pn-inspect-hero h2')).toContainText('NEXT 週次バッチテスト');
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
  const detail=page.locator('#pnDetail');
  const seriesPanel=detail.locator('.pn-series-panel');
  await expect(seriesPanel).toContainText('3件登録済み · 1件目');
  await expect(seriesPanel.locator('[data-pn-series-open]')).toHaveCount(1);
  const compare=seriesPanel.locator('[data-pn-series-index]');
  await expect(compare).not.toHaveAttribute('open','');
  await compare.locator('[data-pn-series-index-summary]').click();
  await expect(compare).toHaveAttribute('open','');
  await expect(compare.locator('[data-pn-series-index-open]')).toHaveCount(3);
  await expect(compare.locator('.pn-series-index-progress')).toContainText('未確認');
  await expect(compare.locator('[data-pn-series-index-next-unchecked]')).toBeVisible();
  await compare.locator('[data-pn-series-index-status]').selectOption('unchecked');
  // The inspected first occurrence is reviewed even when opened from Day view.
  await expect(compare.locator('[data-pn-series-index-open]')).toHaveCount(2);
  // After reviewing another occurrence, keep the unchecked filter and explain
  // where the row went instead of silently changing the user's search.
  const lastUnchecked=await compare.locator('[data-pn-series-index-open]').last()
    .getAttribute('data-pn-series-index-open');
  const reviewViewport=page.viewportSize();
  await page.setViewportSize({width:320,height:800});
  await compare.locator('[data-pn-series-index-open="'+lastUnchecked+'"]').click();
  await expect(detail.locator('[data-pn-series-browse-back]')).toBeFocused();
  await detail.locator('[data-pn-series-browse-back]').click();
  const reviewedNotice=compare.locator('.pn-series-index-reviewed');
  const revealReviewed=reviewedNotice.locator('[data-pn-series-index-reviewed-reveal]');
  await expect(reviewedNotice).toContainText('未確認のみ');
  await expect(compare.locator('[data-pn-series-index-status]')).toHaveValue('unchecked');
  await expect(compare.locator('[data-pn-series-index-open]')).toHaveCount(1);
  await expect(revealReviewed).toBeFocused();
  for(const width of [320,390]){
    await page.setViewportSize({width,height:800});
    await expect(revealReviewed).toBeVisible();
    expect(await reviewedNotice.evaluate(el=>el.scrollWidth-el.clientWidth))
      .toBeLessThanOrEqual(2);
  }
  await revealReviewed.click();
  await expect(compare.locator('[data-pn-series-index-status]')).toHaveValue('all');
  await expect(compare.locator('[data-pn-series-index-open="'+lastUnchecked+'"]'))
    .toBeFocused();
  await expect(reviewedNotice).toHaveCount(0);
  await page.setViewportSize(reviewViewport);
  await compare.locator('[data-pn-series-index-status]').selectOption('unedited');
  await expect(compare.locator('[data-pn-series-index-open]')).toHaveCount(3);
  await compare.locator('[data-pn-series-index-status]').selectOption('all');
  await expect(compare.locator('[data-pn-series-index-open]')).toHaveCount(3);
  const firstInSeries=await compare.locator('[data-pn-series-index-open]').first()
    .getAttribute('data-pn-series-index-open');
  const thirdInSeries=await compare.locator('[data-pn-series-index-open]').last()
    .getAttribute('data-pn-series-index-open');
  const compareSearch=compare.locator('[data-pn-series-index-search]');
  await compareSearch.fill('検索対象なし');
  await expect(compare.locator('[data-pn-series-index-open]')).toHaveCount(0);
  await expect(compare.locator('.pn-series-index-empty')).toBeVisible();
  // A compact reset stays reachable on both phone widths with no horizontal clipping.
  const originalViewport=page.viewportSize();
  for(const width of [320,390]){
    await page.setViewportSize({width,height:800});
    const reset=compare.locator('[data-pn-series-index-reset]');
    await expect(reset).toBeVisible();
    await expect(reset).toHaveCSS('min-height','44px');
    expect(await compare.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(2);
    await reset.click();
    await expect(compareSearch).toHaveValue('');
    await expect(compareSearch).toBeFocused();
    await expect(compare.locator('[data-pn-series-index-status]')).toHaveValue('all');
    await expect(compare.locator('[data-pn-series-index-open]')).toHaveCount(3);
    await compareSearch.fill('検索対象なし');
  }
  await page.setViewportSize(originalViewport);
  await compare.locator('[data-pn-series-index-reset]').click();
  await compareSearch.fill('NEXT 週次バッチテスト');
  // A canonical update outside Palette triggers the same snapshot subscriber
  // used by remote Firebase changes. Preserve search focus and caret.
  await compareSearch.focus();
  await compareSearch.evaluate(el=>el.setSelectionRange(2,5));
  const canonicalSync=await page.evaluate(async occurrenceId=>{
    const bridge=window.WorkBoardPaletteBridge,snapshot=bridge.readSnapshot();
    const row=snapshot.schedules.find(x=>x.id===occurrenceId);
    if(!row)return {ok:false,error:'missing test recurrence'};
    return bridge.dispatch({
      type:'schedule.update',id:row.id,revision:row.revision,
      ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser,
      values:{title:row.title,startAt:row.startAt,endAt:row.endAt,
        assignee:row.assignee||snapshot.currentUser,
        category:row.category||snapshot.categories[0]||'その他',
        location:row.location||'',memo:(row.memo||'')+' / series focus sync',
        relatedTaskId:row.relatedTaskId||''}
    });
  },thirdInSeries);
  expect(canonicalSync.ok).toBe(true);
  await expect(compareSearch).toHaveValue('NEXT 週次バッチテスト');
  await expect(compareSearch).toBeFocused();
  expect(await compareSearch.evaluate(el=>[el.selectionStart,el.selectionEnd]))
    .toEqual([2,5]);
  await expect(compare.locator('[data-pn-series-index-open]')).toHaveCount(3);
  await expect(compare.locator('[data-pn-series-index-edit]')).toHaveCount(3);
  // The canonical update changed a previously reviewed occurrence's revision.
  // Keep it eligible for re-review until the user acknowledges the new content;
  // otherwise the later "last unchecked" assertion would use stale state.
  await expect(compare.locator('.pn-series-index-rereview')).toContainText('1');
  await compare.locator('[data-pn-series-index-open="'+thirdInSeries+'"]').click();
  const reviewUpdated=detail.locator('[data-pn-series-review-updated="'+thirdInSeries+'"]');
  await expect(reviewUpdated).toBeVisible();
  await reviewUpdated.click();
  await expect(detail.locator('.pn-series-reconfirm')).toHaveCount(0);
  await detail.locator('[data-pn-series-browse-back]').click();
  await expect(compare.locator('.pn-series-index-rereview')).toHaveCount(0);
  await expect(compareSearch).toHaveValue('NEXT 週次バッチテスト');
  // Review the chronological next occurrence and return to the exact series controls.
  await compare.locator('[data-pn-series-index-next-unchecked]').click();
  const backToSeries=detail.locator('[data-pn-series-browse-back]');
  await expect(backToSeries).toBeVisible();
  await expect(backToSeries).toBeFocused();
  await expect(backToSeries).toBeInViewport();
  await expect(seriesPanel).toContainText('3件登録済み · 2件目');
  await backToSeries.click();
  await expect(compare).toHaveAttribute('open','');
  // The just-reviewed occurrence was the final unchecked one. Its quick
  // navigation button no longer exists, so return focus to the visible query.
  await expect(compare.locator('[data-pn-series-index-next-unchecked]')).toHaveCount(0);
  await expect(compare.locator('[data-pn-series-index-search]')).toBeFocused();
  await expect(backToSeries).toHaveCount(0);
  // Opening a named row has the same reversible return without resetting search.
  const chosenViewRow=compare.locator('[data-pn-series-index-open="'+thirdInSeries+'"]');
  await chosenViewRow.scrollIntoViewIfNeeded();
  const viewRowOffset=await clickSeriesRowAndCaptureOffset(detail,chosenViewRow);
  await expect(seriesPanel).toContainText('3件登録済み · 3件目');
  await expect(backToSeries).toBeFocused();
  await backToSeries.click();
  await expect(chosenViewRow).toBeFocused();
  const restoredViewOffset=await chosenViewRow.evaluate(el=>
    el.getBoundingClientRect().top-el.closest('#pnDetail').getBoundingClientRect().top);
  expect(Math.abs(restoredViewOffset-viewRowOffset)).toBeLessThanOrEqual(40);
  await expect(compareSearch).toHaveValue('NEXT 週次バッチテスト');
  // After the final occurrence is reviewed, show completion rather than
  // a misleading "no matches" message, and keep the existing search text.
  await compare.locator('[data-pn-series-index-status]').selectOption('unchecked');
  const completed=compare.locator('.pn-series-index-empty.is-complete');
  await expect(completed).toContainText('すべて確認済み');
  await expect(compare.locator('[data-pn-series-index-next-unchecked]')).toHaveCount(0);
  await completed.locator('[data-pn-series-index-complete-show-all]').click();
  await expect(compare.locator('[data-pn-series-index-status]')).toHaveValue('all');
  await expect(compareSearch).toHaveValue('NEXT 週次バッチテスト');
  await expect(compare.locator('[data-pn-series-index-open]')).toHaveCount(3);
  // Editing from the comparison row keeps its original screen position on return.
  const sourceRow=compare.locator('[data-pn-series-index-edit="'+thirdInSeries+'"]');
  await sourceRow.scrollIntoViewIfNeeded();
  const beforeOffset=await clickSeriesRowAndCaptureOffset(detail,sourceRow);
  const directSeriesEdit=detail.locator('[data-pn-form="schedule-editor"]');
  await expect(directSeriesEdit).toBeVisible();
  await expect(directSeriesEdit.locator('.pn-series-edit-scope'))
    .toContainText('系列内 3 / 3');
  await expect(directSeriesEdit.locator('.pn-series-edit-scope'))
    .toContainText('編集する件名：NEXT 週次バッチテスト');
  await directSeriesEdit.locator('[data-pn-cancel]').click();
  await expect(compare).toHaveAttribute('open','');
  await expect(compareSearch).toHaveValue('NEXT 週次バッチテスト');
  await expect(sourceRow).toBeFocused();
  await expect(sourceRow).toBeInViewport();
  const cancelledOffset=await sourceRow.evaluate(el=>
    el.getBoundingClientRect().top-el.closest('#pnDetail').getBoundingClientRect().top);
  expect(Math.abs(cancelledOffset-beforeOffset)).toBeLessThanOrEqual(40);
  const savedClickOffset=await clickSeriesRowAndCaptureOffset(detail,sourceRow);
  await directSeriesEdit.locator('[name="memo"]').fill('一覧から直接編集した予定');
  await directSeriesEdit.locator('[type="submit"]').click();
  await expect(detail.locator('.pn-series-save-review'))
    .toContainText('この回の変更を保存しました');
  await expect(detail.locator('[data-pn-series-review-index]')).toBeVisible();
  await expect(detail.locator('[data-pn-series-save-edit-next]')).toBeVisible();
  await detail.locator('[data-pn-series-review-index]').click();
  await expect(compare).toHaveAttribute('open','');
  await expect(compareSearch).toHaveValue('NEXT 週次バッチテスト');
  await expect(sourceRow).toBeFocused();
  await expect(sourceRow).toBeInViewport();
  const savedOffset=await sourceRow.evaluate(el=>
    el.getBoundingClientRect().top-el.closest('#pnDetail').getBoundingClientRect().top);
  expect(Math.abs(savedOffset-savedClickOffset)).toBeLessThanOrEqual(40);
  await compare.locator('[data-pn-series-index-status]').selectOption('unedited');
  await expect(compare.locator('[data-pn-series-index-open]')).toHaveCount(2);
  await compare.locator('[data-pn-series-index-status]').selectOption('all');
  await compare.locator('[data-pn-series-index-open="'+thirdInSeries+'"]').click();
  await expect(seriesPanel).toContainText('3件登録済み · 3件目');
  await expect(compare).toHaveAttribute('open','');
  await expect(compare.locator('[data-pn-series-index-open="'+thirdInSeries+'"]'))
    .toHaveAttribute('aria-current','true');
  await compare.locator('[data-pn-series-index-open="'+firstInSeries+'"]').click();
  await expect(seriesPanel).toContainText('3件登録済み · 1件目');
  await expect(detail.locator('[data-pn-cmd="schedule.delete"]')).toHaveCount(0);
  await expect(detail.locator('[data-pn-series-classic]')).toBeVisible();
  await seriesPanel.locator('[data-pn-series-open]').click();
  await expect(seriesPanel).toContainText('3件登録済み · 2件目');
  await expect(seriesPanel.locator('[data-pn-series-open]')).toHaveCount(2);
  await detail.locator('[data-pn-close]').click();
  await page.locator('[data-pn-schedule-view="week"]').click();
  await expect(page.locator('.pn-week-agenda-list .pn-schedule-series-badge').first())
    .toContainText('繰り返し · 3件');
  await page.locator('[data-pn-schedule-view="series"]').click();
  await expect(page.locator('[data-pn-schedule-view="series"]')).toHaveAttribute('aria-pressed','true');
  const seriesGroup=page.locator('.pn-series-week-card').filter({hasText:'NEXT 週次バッチテスト'});
  await expect(seriesGroup).toHaveCount(1);
  await expect(seriesGroup).toContainText('系列全体 3件');
  await expect(seriesGroup.locator('.pn-series-week-facts')).toContainText('登録期間');
  await expect(seriesGroup.locator('.pn-series-week-facts')).toContainText('表示週以降 3件');
  await expect(seriesGroup.locator('.pn-series-week-next')).toContainText('次週以降の予定');
  await expect(seriesGroup.locator('.pn-series-week-upcoming')).toContainText('直近の予定');
  const seriesSort=page.locator('[data-pn-series-sort]');
  await expect(seriesSort).toHaveValue('upcoming');
  await seriesSort.selectOption('title');
  await expect(seriesSort).toHaveValue('title');
  const weekBeforeUpcoming=await page.locator('.pn-weekday').first().getAttribute('data-pn-day');
  const upcomingButton=seriesGroup.locator('[data-pn-series-next-open]');
  await expect(upcomingButton).toBeVisible();
  const upcomingId=await upcomingButton.getAttribute('data-pn-series-next-open');
  // "Upcoming" may be the second occurrence when the first is already in the
  // past. Verify the actual target, then begin the edit sequence at occurrence 1.
  const occurrenceOrder=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot()
    .schedules.filter(row=>row.title==='NEXT 週次バッチテスト')
    .sort((a,b)=>String(a.startAt).localeCompare(String(b.startAt)))
    .map(row=>row.id));
  const upcomingPosition=occurrenceOrder.indexOf(upcomingId)+1;
  expect(upcomingPosition).toBeGreaterThan(0);
  await upcomingButton.click();
  await expect(detail).toHaveAttribute('data-inspector','schedule');
  await expect(detail.locator('.pn-inspect-hero h2')).toContainText('NEXT 週次バッチテスト');
  await expect(detail.locator('[data-pn-series-return]')).toBeVisible();
  await expect(detail.locator('.pn-inspect-sequence-position')).toHaveText('系列内 '+upcomingPosition+' / 3');
  for(let position=upcomingPosition;position>1;position--)
    await detail.locator('[data-pn-inspect-step="-1"]').click();
  await expect(detail.locator('.pn-inspect-sequence-position')).toHaveText('系列内 1 / 3');
  // The next occurrence is outside the selected week but remains in this series.
  await detail.locator('[data-pn-inspect-step="1"]').click();
  await expect(detail.locator('.pn-inspect-sequence-position')).toHaveText('系列内 2 / 3');
  await expect(detail.locator('[data-pn-series-return]')).toBeVisible();
  // Editing a browsed occurrence must return to that same detail on cancel.
  await detail.locator('[data-pn-inspect-edit-shortcut]').click();
  await expect(detail.locator('[data-pn-form="schedule-editor"]')).toBeVisible();
  await detail.locator('[data-pn-cancel]').click();
  await expect(detail.locator('.pn-inspect-sequence-position')).toHaveText('系列内 2 / 3');
  await expect(detail.locator('.pn-series-save-review')).toHaveCount(0);
  await detail.locator('[data-pn-inspect-edit-shortcut]').click();
  const consecutiveEdit=detail.locator('[data-pn-form="schedule-editor"]');
  await expect(consecutiveEdit.locator('.pn-series-edit-scope')).toContainText('系列内 2 / 3');
  await expect(consecutiveEdit.locator('.pn-series-edit-scope')).toContainText('この1件だけを編集');
  await consecutiveEdit.locator('[name="memo"]').fill('系列の次回確認テスト');
  await consecutiveEdit.locator('[type="submit"]').click();
  await expect(detail.locator('.pn-series-save-review')).toContainText('この回の変更を保存しました');
  await expect(detail.locator('.pn-series-save-review')).toContainText('系列内 2 / 3');
  await expect(detail.locator('[data-pn-series-save-next]')).toBeVisible();
  await detail.locator('[data-pn-series-save-next]').click();
  await expect(detail.locator('.pn-inspect-sequence-position')).toHaveText('系列内 3 / 3');
  await expect(detail.locator('[data-pn-series-save-next]')).toHaveCount(0);
  await expect(detail.locator('[data-pn-inspect-edit-shortcut]')).toBeFocused();
  await detail.locator('[data-pn-inspect-step="-1"]').click();
  await detail.locator('[data-pn-series-open="'+firstInSeries+'"]').click();
  await expect(detail.locator('.pn-inspect-sequence-position')).toHaveText('系列内 1 / 3');
  await detail.locator('[data-pn-inspect-step="1"]').click();
  await detail.locator('[data-pn-series-return]').click();
  await expect(detail).toBeHidden();
  await expect(page.locator('.pn-weekday').first()).toHaveAttribute('data-pn-day',weekBeforeUpcoming);
  await expect(seriesSort).toHaveValue('title');
  await expect(seriesGroup.locator('[data-pn-series-next-open="'+upcomingId+'"]')).toBeFocused();
  await expect(seriesGroup.locator('.pn-series-week-items')).toBeHidden();
  await seriesGroup.locator('[data-pn-series-group-toggle]').click();
  await expect(seriesGroup.locator('[data-pn-series-group-toggle]')).toHaveAttribute('aria-expanded','true');
  await expect(seriesGroup.locator('.pn-series-week-items [data-pn-detail="schedule"]')).toHaveCount(1);
  // A row inside the expanded series also returns to the row after paging.
  const firstSeriesRow=seriesGroup.locator('.pn-series-week-items [data-pn-detail="schedule"]').first();
  await firstSeriesRow.click();
  await expect(detail.locator('[data-pn-series-return]')).toBeVisible();
  await detail.locator('[data-pn-inspect-step="1"]').click();
  await expect(detail.locator('.pn-inspect-sequence-position')).toHaveText('系列内 2 / 3');
  await detail.locator('[data-pn-series-return]').click();
  await expect(firstSeriesRow).toBeFocused();
  await expect(seriesGroup.locator('.pn-series-week-edit')).toBeVisible();
  await expect(page.locator('[data-pn-series-week-jump="-1"]')).toBeDisabled();
  const firstWeek=await page.locator('.pn-weekday').first().getAttribute('data-pn-day');
  await page.locator('[data-pn-series-week-jump="1"]').click();
  await expect(page.locator('.pn-weekday').first()).not.toHaveAttribute('data-pn-day',firstWeek);
  await expect(seriesSort).toHaveValue('title');
  await expect(seriesGroup).toHaveCount(1);
  await expect(seriesGroup.locator('.pn-series-week-edit')).toBeVisible();
  await seriesGroup.locator('.pn-series-week-edit').click();
  const seriesEditor=page.locator('#pnDetail [data-pn-form="schedule-editor"]');
  await expect(seriesEditor).toBeVisible();
  await expect(seriesEditor.locator('[name="title"]')).toHaveValue('NEXT 週次バッチテスト');
  await seriesEditor.locator('[data-pn-cancel]').click();
  await expect(seriesEditor).toBeHidden();
  await page.locator('[data-pn-series-week-jump="-1"]').click();
  await expect(page.locator('.pn-weekday').first()).toHaveAttribute('data-pn-day',firstWeek);
  await seriesSort.selectOption('week');
  await expect(seriesSort).toHaveValue('week');
  await page.locator('#pnSearch').fill('NEXT 週次バッチテスト');
  await expect(seriesGroup.locator('.pn-series-week-search-note')).toBeVisible();
  await expect(page.locator('#pnSearch')).toHaveAttribute('placeholder','繰り返し系列・単発予定を検索');
  await expect(seriesGroup.locator('.pn-series-week-items [data-pn-detail="schedule"]')).toHaveCount(1);
  await page.locator('#pnSearch').fill('');
  // Renaming a recurrence must not silently remove it from the comparison.
  await seriesGroup.locator('.pn-series-week-items [data-pn-detail="schedule"]').first().click();
  const laterCompare=detail.locator('[data-pn-series-index]');
  await laterCompare.locator('[data-pn-series-index-summary]').click();
  const laterSearch=laterCompare.locator('[data-pn-series-index-search]');
  await laterSearch.fill('NEXT 週次バッチテスト');
  await laterCompare.locator('[data-pn-series-index-edit="'+firstInSeries+'"]').click();
  const renamedEditor=detail.locator('[data-pn-form="schedule-editor"]');
  await renamedEditor.locator('[name="title"]').fill('Palette 改題後の予定');
  await renamedEditor.locator('[type="submit"]').click();
  await expect(detail.locator('.pn-series-save-review'))
    .toContainText('この回の変更を保存しました');
  await detail.locator('[data-pn-series-review-index]').click();
  await expect(laterCompare).toHaveAttribute('open','');
  await expect(laterSearch).toHaveValue('NEXT 週次バッチテスト');
  await expect(laterCompare.locator('.pn-series-index-saved'))
    .toContainText('変更項目：件名');
  await expect(laterCompare.locator('.pn-series-index-saved'))
    .toContainText('検索条件から外れています');
  const editComparison=laterCompare.locator('[data-pn-series-index-diff]');
  await expect(editComparison).not.toHaveAttribute('open','');
  await editComparison.locator('[data-pn-series-index-diff-summary]').click();
  await expect(editComparison).toHaveAttribute('open','');
  await expect(editComparison.locator('.pn-series-index-diff-row')).toHaveCount(1);
  await expect(editComparison.locator('.pn-series-index-diff-row'))
    .toContainText('変更前');
  await expect(editComparison.locator('.pn-series-index-diff-row'))
    .toContainText('変更後');
  await expect(editComparison.locator('.pn-series-index-diff-row'))
    .toContainText('NEXT 週次バッチテスト');
  await expect(editComparison.locator('.pn-series-index-diff-row'))
    .toContainText('Palette 改題後の予定');
  await expect(laterCompare.locator('[data-pn-series-index-open="'+firstInSeries+'"]'))
    .toHaveCount(0);
  await laterCompare.locator('[data-pn-series-index-reveal]').click();
  await expect(editComparison).toHaveAttribute('open','');
  await expect(laterSearch).toHaveValue('');
  await expect(laterCompare.locator('[data-pn-series-index-open="'+firstInSeries+'"]'))
    .toHaveClass(/was-saved/);
  await expect(laterCompare.locator('[data-pn-series-index-open="'+firstInSeries+'"]'))
    .toBeFocused();
  // After saving another recurrence, jump straight into its next unedited sibling.
  await detail.locator('[data-pn-series-save-edit-next]').click();
  const nextSeriesEditor=detail.locator('[data-pn-form="schedule-editor"]');
  await expect(nextSeriesEditor.locator('.pn-series-edit-scope'))
    .toContainText('系列内 2 / 3');
  await nextSeriesEditor.locator('[data-pn-cancel]').click();
  await expect(detail).toHaveAttribute('data-inspector','schedule');
  await detail.locator('[data-pn-close]').click();
  await page.locator('[data-pn-schedule-view="week"]').click();
  await page.locator('.pn-week-agenda-list [data-pn-detail="schedule"]').first().click();
  await expect(detail.locator('[data-pn-series-classic]')).toBeVisible();
  await detail.locator('[data-pn-series-classic]').click();
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','classic');
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
  // The visual board is the default; test this existing dense-list contract.
  await page.locator('#paletteNextRoot [data-pn-task-view="list"]').click();
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
  await expect(page.locator('#paletteNextRoot .pn-studio-stage-lines i')).toHaveCount(3);
  await expect(page.locator('#paletteNextRoot .pn-home-grid .pn-sheet')).toHaveCount(3);
  await expect(page.locator('#paletteNextRoot .pn-studio-top-grid .pn-studio-time-rail')).toBeVisible();
  const desktop=await page.evaluate(()=>{
    const hero=document.querySelector('#paletteNextRoot .pn-hero');
    // Time Rail deliberately uses an asymmetric leading corner; validate
    // the secondary work panels using their own surface contract.
    const shell=document.querySelector('#paletteNextRoot .pn-studio-bottom-grid .pn-sheet');
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
 page.once('dialog',dialog=>{
   expect(dialog.message()).toContain('未保存の変更');
   return dialog.accept();
 });
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
 const inspector=page.locator('#pnDetail');
 await expect(inspector.locator('.pn-memo-quick-swatch')).toHaveCount(6);
 const layout=await inspector.evaluate(el=>{
   const palette=el.querySelector('.pn-memo-quick-swatches').getBoundingClientRect();
   const actions=el.querySelector('.pn-inspect-actions').getBoundingClientRect();
   return {paletteBottom:palette.bottom,actionTop:actions.top,
     actionPosition:getComputedStyle(el.querySelector('.pn-inspect-actions')).position};
 });
 expect(layout.actionTop).toBeGreaterThanOrEqual(layout.paletteBottom);
 expect(layout.actionPosition).toBe('static');
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
  if(width<=780){
    const type=await page.locator('#pnDetail .pn-inspect-facts-schedule .pn-inspect-fact').first()
      .evaluate(el=>({label:parseFloat(getComputedStyle(el.querySelector('dt')).fontSize),
        value:parseFloat(getComputedStyle(el.querySelector('dd')).fontSize)}));
    expect(type.label).toBeGreaterThanOrEqual(12);
    expect(type.value).toBeGreaterThanOrEqual(13);
  }
  await expect(page.locator('#pnDetail .pn-inspect-agenda [data-pn-linked-task]')).toHaveCount(1);
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
  // The visual board is the default; test this existing dense-list contract.
  await page.locator('#paletteNextRoot [data-pn-task-view="list"]').click();
  const row=page.locator('#paletteNextRoot .pn-flowrow').filter({hasText:'Palette 詳細UIテスト'});
  await expect(row).toBeVisible();
  await row.locator('[data-pn-detail="task"]').click();
  const detail=page.locator('#pnDetail');
  await expect(detail).toHaveAttribute('data-inspector','task');
  await expect(detail.locator('.pn-inspect-hero')).toContainText('TASK DETAIL');
  await expect(detail.locator('.pn-inspect-icon svg path')).toHaveCount(1);
  await expect(detail.locator('.pn-inspect-facts .pn-inspect-fact')).toHaveCount(4);
  await expect(detail.locator('.pn-inspect-facts-task dt')).toHaveText(['担当者','期限','進捗','分類']);
  await expect(detail.locator('.pn-inspect-facts-task .pn-inspect-fact').nth(2)).toContainText('0 / 2 · 0%');
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
  // The visual board is the default; test this existing dense-list contract.
  await page.locator('#paletteNextRoot [data-pn-task-view="list"]').click();
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
  test('Palette ToDo form fits above its list with an optional memo at '+width+'px',async({page})=>{
    test.setTimeout(90000);
    await boot(page,width);
    const nav=width<=780?'.pn-mobile-nav':'.pn-rail-nav';
    await page.locator('#paletteNextRoot '+nav+' [data-pn-route="todos"]').click();
    const form=page.locator('#paletteNextRoot [data-pn-form="todo"]');
    const title=form.locator('#pnTodoInput');
    const memo=form.locator('#pnTodoMemo');
    const toggle=form.locator('[data-pn-todo-memo-toggle]');
    const submit=form.locator('.pn-compose-footer button[type="submit"]');
    await expect(title).toBeVisible();
    await expect(submit).toBeVisible();
    await expect(memo).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded','false');
    const metrics=await form.evaluate(el=>{
      const box=x=>x.getBoundingClientRect();
      const input=box(el.querySelector('#pnTodoInput'));
      const button=box(el.querySelector('[type="submit"]'));
      return {
        height:box(el).height,
        inputRight:input.right,buttonLeft:button.left,
        inputHeight:input.height,buttonHeight:button.height,
        listTop:box(document.querySelector('#paletteNextRoot .pn-todo-columns')).top,
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
      };
    });
    expect(metrics.height).toBeLessThan(width<=780?190:150);
    expect(metrics.inputRight).toBeLessThan(metrics.buttonLeft);
    expect(metrics.buttonHeight).toBeGreaterThanOrEqual(42);
    expect(metrics.inputHeight).toBeGreaterThanOrEqual(42);
    expect(metrics.listTop).toBeLessThan(650);
    expect(metrics.overflow).toBeLessThanOrEqual(2);
    await title.fill('Paletteコンパクト登録 '+width);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded','true');
    await expect(memo).toBeVisible();
    await memo.fill('補足内容が保存されるかを確認');
    await toggle.click();
    await expect(memo).toBeHidden();
    await expect(toggle).toContainText('入力あり');
    await submit.click();
    await expect.poll(()=>page.evaluate(w=>{
      const item=window.WorkBoardPaletteBridge.readSnapshot().todos.find(t=>t.text==='Paletteコンパクト登録 '+w);
      return item?.memo;
    },width)).toBe('補足内容が保存されるかを確認');
    await expect(memo).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded','false');
    await expect(title).toHaveValue('');
    await expect(page.locator('#paletteNextRoot .pn-todo-overview [role="progressbar"]'))
      .toHaveAttribute('aria-valuenow',/^\d+$/);
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
      const style=getComputedStyle(el);
      // Some Palette surfaces are intentionally painted with an opaque gradient.
      return (style.backgroundColor!=='rgba(0, 0, 0, 0)'&&style.backgroundColor!=='transparent')
        ||style.backgroundImage!=='none';
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
    // Ver.434: searching Today does not silently filter other screens.
    await expect(search).toHaveValue('');
    await expect(search).toHaveAttribute('placeholder','ToDoを検索');
    await expect(page.locator('#paletteNextRoot .pn-todo-columns')).toContainText('Paletteモバイル検索対象');
    await search.fill('Paletteモバイル検索対象');
    await nav.locator('[data-pn-route="today"]').click();
    await expect(search).toHaveValue('Paletteモバイル検索対象');
    await expect(search).toHaveAttribute('placeholder','今日の項目を検索');
    await nav.locator('[data-pn-route="todos"]').click();
    await expect(search).toHaveValue('Paletteモバイル検索対象');
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
  await page.locator('[data-pn-todo-memo-toggle]').click();
  await expect(memo).toBeVisible();
  await memo.fill('未保存の補足内容');
  await input.focus();
  await input.evaluate(el=>el.setSelectionRange(5,5));
  const result=await page.evaluate(()=>window.WorkBoardPaletteBridge.dispatch({
    type:'todo.create',text:'別の更新で再描画',memo:''
  }));
  expect(result?.ok).toBe(true);
  await expect(page.locator('#paletteNextRoot .pn-todolist').first()).toContainText('別の更新で再描画');
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
  // The visual board is the default; test this existing dense-list contract.
  await page.locator('#paletteNextRoot [data-pn-task-view="list"]').click();
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
    page.once('dialog',dialog=>dialog.accept());
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
  // The visual board is the default; test this existing dense-list contract.
  await page.locator('#paletteNextRoot [data-pn-task-view="list"]').click();
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

for(const width of [320,390,1366]){
 test('Palette grouped busy schedules remain searchable at '+width+'px',async({page})=>{
  test.setTimeout(90000);
  await boot(page,width);
  await page.locator((width<=780?'.pn-mobile-nav':'.pn-rail-nav')+' [data-pn-route="schedule"]').click();
  const day='2027-03-16';
  await page.locator('[data-pn-date-jump]').fill(day);
  const created=await page.evaluate(async day=>{
    const bridge=window.WorkBoardPaletteBridge,snap=bridge.readSnapshot();
    const starts=['09:00','10:00','11:00','13:00','18:00','19:00'];
    const titles=['午前1','午前2','午前3','午後4','夜間5','夜間6'];
    const outcomes=[];
    for(let i=0;i<starts.length;i++){
      const [h,m]=starts[i].split(':').map(Number);
      const end=String(h+1).padStart(2,'0')+':'+String(m).padStart(2,'0');
      outcomes.push((await bridge.dispatch({
        type:'schedule.create',revision:0,ownerRoom:snap.roomId,ownerUser:snap.currentUser,
        values:{title:'Palette密度-'+titles[i],startAt:day+'T'+starts[i],endAt:day+'T'+end,
          assignee:snap.currentUser,category:snap.categories[0]||'その他',
          location:'',memo:'',relatedTaskId:''}
      }))?.ok===true);
    }
    return outcomes;
  },day);
  expect(created).toEqual([true,true,true,true,true,true]);
  const groups=page.locator('.pn-schedule-sheet .pn-time-block');
  await expect(groups).toHaveCount(3);
  for(const [index,period,count] of [[0,'morning',3],[1,'afternoon',1],[2,'evening',2]]){
    await expect(groups.nth(index)).toHaveAttribute('data-period',period);
    await expect(groups.nth(index).locator('.pn-scheduleitem')).toHaveCount(count);
  }
  const rhythm=page.locator('.pn-schedule-sheet .pn-day-rhythm');
  await expect(rhythm).toBeVisible();
  await expect(rhythm.locator('[data-pn-period-jump]')).toHaveCount(3);
  await expect(rhythm).toContainText('登録済みの予定 6件');
  // Ensure all timeline shortcuts remain usable without side scrolling.
  const rhythmLayout=await rhythm.evaluate(el=>({
    viewport:document.documentElement.clientWidth,
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    buttons:[...el.querySelectorAll('[data-pn-period-jump]')].map(node=>{
      const b=node.getBoundingClientRect();
      return {left:b.left,right:b.right,height:b.height};
    })
  }));
  expect(rhythmLayout.overflow).toBeLessThanOrEqual(2);
  expect(rhythmLayout.buttons).toHaveLength(3);
  for(const button of rhythmLayout.buttons){
    expect(button.left).toBeGreaterThanOrEqual(-1);
    expect(button.right).toBeLessThanOrEqual(rhythmLayout.viewport+1);
    expect(button.height).toBeGreaterThanOrEqual(44);
  }
  await rhythm.locator('[data-pn-period-jump="afternoon"]').click();
  await expect(groups.nth(1).locator('.pn-timehead h3')).toBeFocused();
  await expect(groups.nth(1).locator('.pn-scheduleopen')).toContainText('Palette密度-午後4');
  await page.locator('[data-pn-schedule-view="week"]').click();
  const card=page.locator('.pn-week-agenda-day[data-pn-agenda-day="'+day+'"]');
  const rows=card.locator('.pn-week-agenda-list .pn-scheduleitem');
  const toggle=card.locator('[data-pn-agenda-toggle]');
  await expect(card.locator('.pn-agenda-periods')).toContainText('午前 3');
  await expect(card.locator('.pn-agenda-periods')).toContainText('夕方以降 2');
  await expect(rows).toHaveCount(4);
  await expect(toggle).toContainText('残り 2件を表示');
  await toggle.click();
  await expect(rows).toHaveCount(6);
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  await toggle.click();
  await expect(rows).toHaveCount(4);
  await page.locator('#pnSearch').fill('Palette密度-夜間');
  await expect(rows).toHaveCount(2);
  await expect(toggle).toHaveCount(0);
  const count=await page.evaluate(day=>window.WorkBoardPaletteBridge.readSnapshot().schedules
    .filter(x=>x.startAt.startsWith(day)&&x.title.startsWith('Palette密度-')).length,day);
  expect(count).toBe(6);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
    .toBeLessThanOrEqual(2);
 });
}

for(const width of [320,390,1366]){
 test('Palette task and memo editors keep actions visible without hiding fields at '+width+'px',async({page})=>{
  test.setTimeout(90000);
  await boot(page,width);
  const nav=width<=780?'.pn-mobile-nav':'.pn-rail-nav';
  await page.locator(nav+' [data-pn-route="tasks"]').click();
  await page.locator('#paletteNextRoot [data-pn-edit="task"]').first().click();
  const drawer=page.locator('#pnDetail');
  const form=drawer.locator('[data-pn-form="task-editor"]');
  await expect(drawer).toHaveAttribute('data-editor','task');
  await expect(form.locator('.pn-edit-section')).toHaveCount(4);
  await expect(form.locator('.pn-editor-actions [type="submit"]')).toBeVisible();
  await form.locator('[name="title"]').fill('編集レイアウトの確認');
  await form.locator('[name="description"]').fill('説明文');
  await form.locator('[name="checklist"]').fill('作業A\n作業B');
  await form.locator('[name="tags"]').fill('レイアウト,確認');
  const position=await drawer.evaluate(el=>{
    const h=el.querySelector('.pn-edit-header').getBoundingClientRect();
    const sc=el.querySelector('.pn-editor-scroll').getBoundingClientRect();
    const ft=el.querySelector('.pn-editor-actions').getBoundingClientRect();
    const outer=el.getBoundingClientRect();
    return {headerBottom:h.bottom,scrollTop:sc.top,scrollBottom:sc.bottom,
      footerTop:ft.top,footerBottom:ft.bottom,outerBottom:outer.bottom,width:outer.width,
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
  });
  expect(position.scrollTop).toBeGreaterThanOrEqual(position.headerBottom-2);
  expect(position.scrollBottom).toBeLessThanOrEqual(position.footerTop+2);
  expect(position.footerBottom).toBeLessThanOrEqual(position.outerBottom+2);
  expect(position.width).toBeLessThanOrEqual(width+2);
  expect(position.overflow).toBeLessThanOrEqual(2);
  page.once('dialog',dialog=>dialog.accept());
  await form.locator('[data-pn-cancel]').click();
  await page.locator(nav+' [data-pn-route="memos"]').click();
  await page.locator('#paletteNextRoot [data-pn-edit="memo"]').first().click();
  const memo=page.locator('#pnDetail [data-pn-form="memo-editor"]');
  await expect(memo).toBeVisible();
  await expect(memo.locator('[name="paperColor"]')).toHaveCount(6);
  await memo.locator('[name="paperColor"][value="lavender"]').check();
  await expect(memo.locator('[name="paperColor"][value="lavender"]')).toBeChecked();
  await memo.locator('[name="title"]').fill('編集確認');
  await memo.locator('[name="body"]').fill('編集内容');
  const heights=await memo.evaluate(el=>{
    const scroll=el.querySelector('.pn-editor-scroll').getBoundingClientRect();
    const actions=el.querySelector('.pn-editor-actions').getBoundingClientRect();
    return {scrollBottom:scroll.bottom,footerTop:actions.top};
  });
  expect(heights.scrollBottom).toBeLessThanOrEqual(heights.footerTop+2);
  page.once('dialog',dialog=>dialog.accept());
  await memo.locator('[data-pn-cancel]').click();
 });
}

for(const width of [320,390,1366]){
 test('Palette task inspector moves through the filtered list in display order at '+width+'px',async({page})=>{
  test.setTimeout(90000);
  await boot(page,width);
  const nav=width<=780?'.pn-mobile-nav':'.pn-rail-nav';
  await page.locator(nav+' [data-pn-route="tasks"]').click();
  const created=await page.evaluate(async()=>{
    const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
    const priorities=[['A','中','2027-01-04'],['B','高','2027-01-03'],['C','緊急','2027-01-02']];
    const ids=[];
    for(const [suffix,priority,dueDate] of priorities){
      const result=await bridge.dispatch({
        type:'task.create',revision:0,ownerRoom:s.roomId,ownerUser:s.currentUser,
        title:'一覧移動 '+suffix,assignee:s.currentUser,
        status:s.statuses.find(x=>x!=='完了')||'未着手',
        priority,dueDate,dueTime:'',category:s.categories[0]||'その他',
        requester:'',description:'',tags:'',checklist:'',pinned:false
      });
      if(!result?.ok)return false;
      ids.push(result.id);
    }
    return ids.length===3;
  });
  expect(created).toBe(true);
  await page.locator('#pnSearch').fill('一覧移動');
  // The visual board is the default; test this existing dense-list contract.
  await page.locator('#paletteNextRoot [data-pn-task-view="list"]').click();
  const rows=page.locator('#paletteNextRoot .pn-flowrow');
  await expect(rows).toHaveCount(3);
  await page.locator('#paletteNextRoot [data-pn-task-sort]').selectOption('priority');
  await expect(rows.first()).toContainText('一覧移動 C');
  await expect(rows.nth(1)).toContainText('一覧移動 B');
  await expect(rows.nth(2)).toContainText('一覧移動 A');
  const original=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks
    .filter(row=>row.title.startsWith('一覧移動 '))
    .map(row=>[row.id,row.revision]));
  await rows.first().locator('[data-pn-detail="task"]').click();
  const detail=page.locator('#pnDetail');
  await expect(detail.locator('.pn-inspect-sequence-position')).toHaveText('1 / 3');
  if(width<=780){
    const type=await detail.locator('.pn-inspect-facts-task .pn-inspect-fact').first().evaluate(el=>({
      label:parseFloat(getComputedStyle(el.querySelector('dt')).fontSize),
      value:parseFloat(getComputedStyle(el.querySelector('dd')).fontSize)
    }));
    expect(type.label).toBeGreaterThanOrEqual(12);
    expect(type.value).toBeGreaterThanOrEqual(13);
  }
  await expect(detail.locator('[data-pn-inspect-step="-1"]')).toBeDisabled();
  await detail.locator('[data-pn-inspect-step="1"]').click();
  await expect(detail.locator('.pn-inspect-hero h2')).toHaveText('一覧移動 B');
  await expect(detail.locator('.pn-inspect-sequence-position')).toHaveText('2 / 3');
  await detail.locator('[data-pn-inspect-step="1"]').click();
  await expect(detail.locator('.pn-inspect-hero h2')).toHaveText('一覧移動 A');
  await expect(detail.locator('[data-pn-inspect-step="1"]')).toBeDisabled();
  await detail.locator('[data-pn-inspect-step="-1"]').click();
  await expect(detail.locator('.pn-inspect-hero h2')).toHaveText('一覧移動 B');
  await detail.locator('[data-pn-close]').click();
  await expect(detail).toBeHidden();
  await expect(rows.nth(1).locator('[data-pn-detail="task"]')).toBeFocused();
  await expect(page.locator('#pnSearch')).toHaveValue('一覧移動');
  await expect(page.locator('#paletteNextRoot [data-pn-task-sort]')).toHaveValue('priority');
  const after=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks
    .filter(row=>row.title.startsWith('一覧移動 '))
    .map(row=>[row.id,row.revision]));
  expect(after).toEqual(original);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
    .toBeLessThanOrEqual(2);
 });
}

for(const width of [320,390,1366]){
 test('Palette memo gallery keeps arrangement on recolor and offers alternate sorts at '+width+'px',async({page})=>{
  test.setTimeout(90000);
  await page.addInitScript(({room})=>{
    const key='system-business-memos:'+room;
    if(localStorage.getItem(key))return;
    const now=Date.now();
    const entries=[
      ['palette-sort-pinned','固定メモ','その他','peach',true,1000],
      ['palette-sort-c','ウ：手順','手順','sky',false,2000],
      ['palette-sort-a','ア：定型','定型情報','mint',false,3000],
      ['palette-sort-b','イ：連絡','宛先・連絡先','lemon',false,4000]
    ];
    const memos=Object.fromEntries(entries.map(([id,title,category,paperColor,pinned,offset])=>
      [id,{id,title,body:'色と並び順の確認',category,tags:['Palette'],
        paperColor,pinned,createdAt:now-50000,updatedAt:now-10000+offset,
        updatedBy:'福冨',createdBy:'福冨',revision:1}]));
    localStorage.setItem(key,JSON.stringify(memos));
    localStorage.setItem('workBoardMemoOrderV531:'+room+':福冨',
      JSON.stringify(['palette-sort-pinned','palette-sort-c','palette-sort-a','palette-sort-b']));
  },{room});
  await boot(page,width);
  const nav=width<=780?'.pn-mobile-nav':'.pn-rail-nav';
  await page.locator(nav+' [data-pn-route="memos"]').click();
  const tiles=page.locator('#paletteNextRoot .pn-memotile');
  const sorter=page.locator('#paletteNextRoot [data-pn-memo-sort]');
  const ids=()=>tiles.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-id')));
  const manual=['palette-sort-pinned','palette-sort-c','palette-sort-a','palette-sort-b'];
  await expect(tiles).toHaveCount(4);
  await expect(sorter).toHaveValue('manual');
  expect(await ids()).toEqual(manual);
  const gallery=page.locator('#paletteNextRoot .pn-gallery-intro');
  await expect(gallery).toBeVisible();
  await expect(gallery.locator('.pn-gallery-counts strong')).toHaveText(['4','1','4']);
  await expect(gallery.locator('.pn-gallery-colorband [data-paper-color]')).toHaveCount(4);
  await expect(tiles.filter({has:page.locator('.pn-memo-feature-caption')})).toHaveCount(1);
  await expect(tiles.first()).toHaveClass(/is-editorial-feature/);
  // Editorial layout is deliberately asymmetric on desktop and single-column
  // on phones. Validate actual rendered rectangles, not CSS text alone.
  const galleryLayout=await tiles.evaluateAll(elements=>({
    viewport:document.documentElement.clientWidth,
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    widths:elements.map(el=>el.getBoundingClientRect().width),
    ends:elements.map(el=>{
      const r=el.getBoundingClientRect();return {left:r.left,right:r.right};
    })
  }));
  expect(galleryLayout.overflow).toBeLessThanOrEqual(2);
  for(const edge of galleryLayout.ends){
    expect(edge.left).toBeGreaterThanOrEqual(-1);
    expect(edge.right).toBeLessThanOrEqual(galleryLayout.viewport+1);
  }
  if(width>780)expect(galleryLayout.widths[0]).toBeGreaterThan(galleryLayout.widths[1]*1.5);
  else expect(Math.abs(galleryLayout.widths[0]-galleryLayout.widths[1])).toBeLessThanOrEqual(2);

  // Color-coded cards must retain readable text in both light and dark modes.
  for(const mode of ['light','dark']){
    if(mode==='dark')await page.locator('#paletteNextRoot [data-pn-theme]').click();
    await expect(page.locator('#pnApp')).toHaveAttribute('data-theme',mode);
    const contrast=await tiles.evaluateAll(elements=>{
      // Computed colors can be serialized as rgb() or CSS Color 4 color(srgb).
      const luminance=value=>{
        const legacy=value.match(/^rgba?\(([^)]+)\)$/);
        const modern=value.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
        const channels=legacy?legacy[1].match(/[\d.]+/g)?.slice(0,3).map(v=>Number(v)/255):
          modern?modern.slice(1,4).map(Number):null;
        if(!channels||channels.length!==3||channels.some(v=>!Number.isFinite(v)))return NaN;
        const [r,g,b]=channels.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
        return .2126*r+.7152*g+.0722*b;
      };
      return elements.flatMap(card=>{
        const background=luminance(getComputedStyle(card).backgroundColor);
        return [card.querySelector('strong'),card.querySelector('small')].map(node=>{
          if(!node)return NaN;
          const foreground=luminance(getComputedStyle(node).color);
          return (Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);
        });
      });
    });
    expect(contrast).toHaveLength(8);
    for(const ratio of contrast){
      expect(Number.isFinite(ratio)).toBe(true);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  }
  await page.locator('#paletteNextRoot [data-pn-theme]').click();
  await sorter.selectOption('title');
  expect(await ids()).toEqual(['palette-sort-pinned','palette-sort-a','palette-sort-b','palette-sort-c']);
  await sorter.selectOption('updated');
  expect(await ids()).toEqual(['palette-sort-pinned','palette-sort-b','palette-sort-a','palette-sort-c']);
  await sorter.selectOption('manual');
  expect(await ids()).toEqual(manual);
  await page.locator('[data-pn-memo-filter="mint"]').click();
  await expect(tiles).toHaveCount(1);
  await expect(page.locator('.pn-memo-results')).toHaveText('表示 1件 ／ 全体 4件');
  await expect(gallery.locator('.pn-gallery-counts strong')).toHaveText(['1','0','1']);
  await expect(gallery.locator('.pn-gallery-colorband [data-paper-color="mint"]')).toHaveCount(1);
  await expect(tiles.first()).not.toHaveClass(/is-editorial-feature/);
  await page.locator('[data-pn-memo-clear-filter]').click();
  await expect(tiles).toHaveCount(4);
  await expect(page.locator('[data-pn-memo-filter="all"]')).toHaveAttribute('aria-pressed','true');
  // No-match feedback must explain whether search, color, or both filtered out items.
  const memoSearch=page.locator('#pnSearch');
  const emptyMemo=page.locator('#paletteNextRoot .pn-memo-empty-state');
  await memoSearch.fill('存在しない語句');
  await expect(tiles).toHaveCount(0);
  await expect(emptyMemo).toContainText('検索に一致するメモはありません');
  await page.locator('[data-pn-memo-filter="mint"]').click();
  await expect(emptyMemo).toContainText('検索語と選択した色に一致するメモはありません');
  const resetEmpty=emptyMemo.locator('[data-pn-memo-reset-empty]');
  await expect(resetEmpty).toBeVisible();
  expect(await resetEmpty.evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await resetEmpty.click();
  await expect(memoSearch).toHaveValue('');
  await expect(memoSearch).toBeFocused();
  await expect(page.locator('[data-pn-memo-filter="all"]')).toHaveAttribute('aria-pressed','true');
  await expect(tiles).toHaveCount(4);
  await page.locator('[data-pn-memo-filter="lavender"]').click();
  await expect(emptyMemo).toContainText('この色に該当するメモはありません');
  await emptyMemo.locator('[data-pn-memo-reset-empty]').click();
  await expect(tiles).toHaveCount(4);
  const before=await page.evaluate(()=>window.WorkBoardPaletteMemoBridgeV369.readSnapshot()
    .find(memo=>memo.id==='palette-sort-c')?.updatedAt);
  await tiles.filter({hasText:'ウ：手順'}).click();
  await page.locator('#pnDetail [data-pn-memo-color="lavender"]').click();
  await expect.poll(()=>page.evaluate(()=>window.WorkBoardPaletteMemoBridgeV369.readSnapshot()
    .find(memo=>memo.id==='palette-sort-c')?.paperColor)).toBe('lavender');
  const after=await page.evaluate(()=>window.WorkBoardPaletteMemoBridgeV369.readSnapshot()
    .find(memo=>memo.id==='palette-sort-c')?.updatedAt);
  expect(after).toBe(before);
  await page.locator('#pnDetail [data-pn-close]').click();
  expect(await ids()).toEqual(manual);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#paletteNextRoot .wb-pn')).toBeVisible({timeout:15000});
  await page.locator(nav+' [data-pn-route="memos"]').click();
  expect(await ids()).toEqual(manual);
  await expect(tiles.filter({hasText:'ウ：手順'})).toHaveAttribute('data-paper-color','lavender');
  expect(await page.evaluate(()=>
    document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
 });
}

for(const width of [320,390,1366]){
 test('Palette memo detail follows color-filtered title order and recovers after recoloring at '+width+'px',async({page})=>{
  test.setTimeout(90000);
  await page.addInitScript(({room})=>{
    const now=Date.now();
    const list=[
      ['inspect-memo-pin','巡回メモ・固定','peach',true,100],
      ['inspect-memo-c','巡回メモ・C','sky',false,200],
      ['inspect-memo-a','巡回メモ・A','mint',false,300],
      ['inspect-memo-b','巡回メモ・B','mint',false,400]
    ];
    const values=Object.fromEntries(list.map(([id,title,paperColor,pinned,n])=>
      [id,{id,title,body:'一覧を連続確認するための本文',category:'その他',
        tags:['巡回メモ'],paperColor,pinned,createdBy:'福冨',updatedBy:'福冨',
        createdAt:now-10000,updatedAt:now-5000+n,revision:1}]));
    localStorage.setItem('system-business-memos:'+room,JSON.stringify(values));
    localStorage.setItem('workBoardMemoOrderV531:'+room+':福冨',
      JSON.stringify(list.map(([id])=>id)));
  },{room});
  await boot(page,width);
  const nav=width<=780?'.pn-mobile-nav':'.pn-rail-nav';
  await page.locator(nav+' [data-pn-route="memos"]').click();
  await expect(page.locator('.pn-memotile')).toHaveCount(4);
  await page.locator('#pnSearch').fill('巡回メモ');
  await page.locator('[data-pn-memo-sort]').selectOption('title');
  await page.locator('[data-pn-memo-filter="mint"]').click();
  const cards=page.locator('#paletteNextRoot .pn-memotile');
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText('巡回メモ・A');
  await cards.first().click();
  const drawer=page.locator('#pnDetail');
  await expect(drawer).toHaveAttribute('data-inspector','memo');
  await expect(drawer.locator('.pn-inspect-sequence-position')).toHaveText('1 / 2');
  await expect(drawer.locator('[data-pn-inspect-step="-1"]')).toBeDisabled();
  await drawer.locator('[data-pn-inspect-step="1"]').click();
  await expect(drawer.locator('.pn-inspect-hero h2')).toHaveText('巡回メモ・B');
  await expect(drawer.locator('.pn-inspect-sequence-position')).toHaveText('2 / 2');
  await expect(drawer.locator('[data-pn-inspect-step="1"]')).toBeDisabled();
  const original=await page.evaluate(()=>window.WorkBoardPaletteMemoBridgeV369.readSnapshot()
    .find(m=>m.id==='inspect-memo-b')?.updatedAt);
  await drawer.locator('[data-pn-memo-color="lavender"]').click();
  await expect.poll(()=>page.evaluate(()=>window.WorkBoardPaletteMemoBridgeV369.readSnapshot()
    .find(m=>m.id==='inspect-memo-b')?.paperColor)).toBe('lavender');
  await expect(cards).toHaveCount(1);
  await expect(drawer.locator('.pn-inspect-hero h2')).toHaveText('巡回メモ・B');
  await expect(drawer.locator('[data-pn-memo-reveal]')).toBeVisible();
  const after=await page.evaluate(()=>window.WorkBoardPaletteMemoBridgeV369.readSnapshot()
    .find(m=>m.id==='inspect-memo-b')?.updatedAt);
  expect(after).toBe(original);
  await drawer.locator('[data-pn-memo-reveal]').click();
  await expect(page.locator('#pnSearch')).toHaveValue('');
  await expect(page.locator('[data-pn-memo-filter="all"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-pn-memo-sort]')).toHaveValue('title');
  await expect(cards).toHaveCount(4);
  await expect(drawer.locator('.pn-inspect-sequence-position')).toHaveText('3 / 4');
  await drawer.locator('[data-pn-inspect-step="-1"]').click();
  await expect(drawer.locator('.pn-inspect-hero h2')).toHaveText('巡回メモ・A');
  await drawer.locator('[data-pn-close]').click();
  await expect(drawer).toBeHidden();
  await expect(cards.filter({hasText:'巡回メモ・A'})).toBeFocused();
  expect(await page.evaluate(()=>
    document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
 });
}

for(const width of [320,390,1366]){
 test('Palette task, schedule, memo and ToDo details align action hierarchy at '+width+'px',async({page})=>{
  test.setTimeout(90000);
  await page.addInitScript(({room})=>{
    localStorage.setItem('system-business-memos:'+room,JSON.stringify({
      'palette-action-memo':{id:'palette-action-memo',title:'操作統一メモ',body:'業務メモ',
        category:'その他',tags:[],pinned:false,paperColor:'sky',revision:1,
        createdAt:Date.now()-1000,updatedAt:Date.now(),updatedBy:'福冨'}
    }));
  },{room});
  await boot(page,width);
  const created=await page.evaluate(async()=>{
    const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
    const assignee=s.assignees.includes(s.currentUser)?s.currentUser:s.assignees[0];
    const task=await bridge.dispatch({
      type:'task.create',revision:0,ownerRoom:s.roomId,ownerUser:s.currentUser,
      title:'操作統一タスク',assignee,status:s.statuses.find(x=>x!=='完了')||'未着手',
      priority:'中',category:s.categories[0]||'その他',dueDate:'2027-04-11',
      requester:'',description:'操作ボタン検査',tags:'',checklist:'',pinned:false
    });
    const schedule=await bridge.dispatch({
      type:'schedule.create',revision:0,ownerRoom:s.roomId,ownerUser:s.currentUser,
      values:{title:'操作統一予定',startAt:'2027-04-11T09:00',endAt:'2027-04-11T10:00',
        assignee,category:s.categories[0]||'その他',location:'',memo:'',relatedTaskId:''}
    });
    const todo=await bridge.dispatch({type:'todo.create',text:'操作統一ToDo',memo:'説明'});
    return [task?.ok===true,schedule?.ok===true,todo?.ok===true];
  });
  expect(created).toEqual([true,true,true]);
  const nav=width<=780?'.pn-mobile-nav':'.pn-rail-nav';
  const drawer=page.locator('#pnDetail');
  async function check(kind,secondaryCount,dangerCount,primaryText){
    await expect(drawer).toHaveAttribute('data-inspector',kind);
    const bar=drawer.locator('.pn-inspect-actionbar');
    await expect(bar).toHaveCount(1);
    await expect(bar).toHaveAttribute('role','group');
    const headerEdit=['task','schedule'].includes(kind);
    if(headerEdit){
      await expect(bar.locator('.pn-inspect-action-primary')).toHaveCount(0);
      const edit=drawer.locator('.pn-detail-nav [data-pn-inspect-edit-shortcut]');
      await expect(edit).toHaveCount(1);
      await expect(edit).toHaveAttribute('data-pn-edit',kind);
      await expect(edit).toContainText('編集');
      const box=await edit.boundingBox();
      expect(box?.height||0).toBeGreaterThanOrEqual(44);
    }else{
      await expect(bar.locator('.pn-inspect-action-primary>.pn-button')).toHaveCount(1);
      await expect(bar.locator('.pn-inspect-action-primary>.pn-button')).toContainText(primaryText);
    }
    await expect(bar.locator('.pn-inspect-action-secondary>.pn-button')).toHaveCount(secondaryCount);
    await expect(bar.locator('.pn-inspect-action-danger>.pn-button')).toHaveCount(dangerCount);
    const dims=await bar.evaluate(el=>{
      const bounds=node=>node?.getBoundingClientRect();
      const primary=bounds(el.querySelector('.pn-inspect-action-primary'));
      const secondary=bounds(el.querySelector('.pn-inspect-action-secondary'));
      const danger=bounds(el.querySelector('.pn-inspect-action-danger'));
      const outer=bounds(el);
      const buttons=[...el.querySelectorAll('.pn-button')].map(button=>{
        const b=bounds(button);return {height:b.height,left:b.left,right:b.right,top:b.top};
      });
      return {display:getComputedStyle(el).display,
        primaryBottom:primary?.bottom,secondaryTop:secondary?.top,
        secondaryBottom:secondary?.bottom,dangerTop:danger?.top,
        outerLeft:outer.left,outerRight:outer.right,buttons,
        position:getComputedStyle(el).position,
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
    });
    expect(dims.display).toBe('grid');
    for(const button of dims.buttons){
      expect(button.height).toBeGreaterThanOrEqual(42);
      expect(button.left).toBeGreaterThanOrEqual(dims.outerLeft-2);
      expect(button.right).toBeLessThanOrEqual(dims.outerRight+2);
    }
    if(dims.secondaryTop!==undefined&&dims.primaryBottom!==undefined)
      expect(dims.secondaryTop).toBeGreaterThanOrEqual(dims.primaryBottom-2);
    if(dims.dangerTop!==undefined)
      expect(dims.dangerTop).toBeGreaterThanOrEqual(
        (dims.secondaryBottom??dims.primaryBottom??dims.outerLeft)-2);
    expect(dims.overflow).toBeLessThanOrEqual(2);
    return dims;
  }
  await page.locator(nav+' [data-pn-route="tasks"]').click();
  // The visual board is the default; test this existing dense-list contract.
  await page.locator('#paletteNextRoot [data-pn-task-view="list"]').click();
  const taskRow=page.locator('#paletteNextRoot .pn-flowrow').filter({hasText:'操作統一タスク'});
  await taskRow.locator('[data-pn-detail="task"]').click();
  await check('task',3,0,'内容を編集');
  await expect(drawer.locator('[data-pn-plan-task]')).toHaveCount(1);
  await drawer.locator('[data-pn-close]').click();
  await page.locator(nav+' [data-pn-route="schedule"]').click();
  await page.locator('[data-pn-date-jump]').fill('2027-04-11');
  await page.locator('.pn-scheduleopen').filter({hasText:'操作統一予定'}).first().click();
  await check('schedule',1,1,'予定を編集');
  await expect(drawer.locator('[data-pn-copy="schedule"]')).toHaveCount(1);
  await expect(drawer.locator('[data-pn-cmd="schedule.delete"]')).toHaveAttribute('data-revision',/^\d+$/);
  await drawer.locator('[data-pn-close]').click();
  await page.locator(nav+' [data-pn-route="memos"]').click();
  await page.locator('.pn-memotile').filter({hasText:'操作統一メモ'}).click();
  const memoDims=await check('memo',1,1,'編集する');
  expect(memoDims.position).toBe('static');
  const palettePosition=await drawer.evaluate(el=>{
    const p=el.querySelector('.pn-memo-quick-swatches').getBoundingClientRect();
    const b=el.querySelector('.pn-inspect-actionbar').getBoundingClientRect();
    return {paletteBottom:p.bottom,barTop:b.top};
  });
  expect(palettePosition.barTop).toBeGreaterThanOrEqual(palettePosition.paletteBottom);
  await expect(drawer.locator('.pn-memo-quick-swatch')).toHaveCount(6);
  await drawer.locator('[data-pn-close]').click();
  await page.locator(nav+' [data-pn-route="todos"]').click();
  await page.locator('#paletteNextRoot .pn-todolist li')
    .filter({hasText:'操作統一ToDo'}).first().locator('[data-pn-detail="todo"]').click();
  await check('todo',0,1,'変更を保存');
  await expect(drawer.locator('.pn-inspect-action-primary button')).toHaveAttribute('type','submit');
  await expect(drawer.locator('[data-pn-cmd="todo.delete"]')).toHaveAttribute('type','button');
  await drawer.locator('[data-pn-close]').click();
 });
}

for(const width of [390,1366]){
 test('Ver.431 Palette follows visible ToDo and schedule rows without losing unsaved edits at '+width+'px',async({page})=>{
  test.setTimeout(90000);
  await boot(page,width);
  const created=await page.evaluate(async()=>{
    const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
    const assignee=s.assignees.includes(s.currentUser)?s.currentUser:s.assignees[0];
    const results=[];
    for(const name of ['A','B'])
      results.push(await bridge.dispatch({type:'todo.create',text:'Ver431移動ToDo '+name,memo:''}));
    for(const [name,hour] of [['A','09'],['B','10']])
      results.push(await bridge.dispatch({
        type:'schedule.create',revision:0,ownerRoom:s.roomId,ownerUser:s.currentUser,
        values:{title:'Ver431移動予定 '+name,startAt:'2027-05-19T'+hour+':00',
          endAt:'2027-05-19T'+hour+':30',assignee,
          category:s.categories[0]||'その他',location:'',memo:'',relatedTaskId:''}
      }));
    return results.map(result=>result?.ok===true);
  });
  expect(created).toEqual([true,true,true,true]);
  const nav=width<=780?'.pn-mobile-nav':'.pn-rail-nav';
  const drawer=page.locator('#pnDetail');
  await page.locator(nav+' [data-pn-route="todos"]').click();
  await page.locator('#pnSearch').fill('Ver431移動ToDo');
  const todos=page.locator('#paletteNextRoot .pn-todolist [data-pn-detail="todo"]');
  await expect(todos).toHaveCount(2);
  await todos.first().click();
  await expect(drawer.locator('.pn-inspect-sequence-position')).toHaveText('1 / 2');
  const previousTitle=await drawer.locator('.pn-inspect-hero h2').textContent();
  await drawer.locator('#pnTodoEdit [name="memo"]').fill('未保存のメモ');
  page.once('dialog',dialog=>dialog.dismiss());
  await drawer.locator('[data-pn-inspect-step="1"]').click();
  await expect(drawer.locator('.pn-inspect-hero h2')).toHaveText(previousTitle);
  await expect(drawer.locator('#pnTodoEdit [name="memo"]')).toHaveValue('未保存のメモ');
  page.once('dialog',dialog=>dialog.accept());
  await drawer.locator('[data-pn-inspect-step="1"]').click();
  await expect(drawer.locator('.pn-inspect-sequence-position')).toHaveText('2 / 2');
  await expect(drawer.locator('.pn-inspect-hero h2')).not.toHaveText(previousTitle);
  await drawer.locator('[data-pn-close]').click();
  await expect(todos.nth(1)).toBeFocused();

  await page.locator(nav+' [data-pn-route="schedule"]').click();
  await page.locator('#pnSearch').fill('Ver431移動予定');
  await page.locator('[data-pn-date-jump]').fill('2027-05-19');
  const schedules=page.locator('#paletteNextRoot .pn-scheduleopen');
  await expect(schedules).toHaveCount(2);
  await schedules.first().click();
  await expect(drawer.locator('.pn-inspect-sequence-position')).toHaveText('1 / 2');
  const firstSchedule=await drawer.locator('.pn-inspect-hero h2').textContent();
  await drawer.locator('[data-pn-inspect-step="1"]').click();
  await expect(drawer.locator('.pn-inspect-hero h2')).not.toHaveText(firstSchedule);
  await expect(drawer.locator('.pn-inspect-sequence-position')).toHaveText('2 / 2');
  await drawer.locator('[data-pn-inspect-step="-1"]').click();
  await expect(drawer.locator('.pn-inspect-hero h2')).toHaveText(firstSchedule);
  await drawer.locator('[data-pn-close]').click();
  await expect(schedules.first()).toBeFocused();
  const overflow=await page.evaluate(()=>
    document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
 });
}

for(const width of [390,1366]){
 test('Palette preserves each screen search and task filter while browsing at '+width+'px',async({page})=>{
  await boot(page,width);
  const nav=width<=780?'.pn-mobile-nav':'.pn-rail-nav';
  const search=page.locator('#pnSearch');
  await page.locator(nav+' [data-pn-route="tasks"]').click();
  await search.fill('工事');
  await page.locator('[data-pn-filter="mine"]').click();
  await expect(page.locator('[data-pn-filter="mine"]')).toHaveAttribute('aria-pressed','true');
  await page.locator(nav+' [data-pn-route="memos"]').click();
  await expect(search).toHaveValue('');
  await search.fill('申し送り');
  await page.locator(nav+' [data-pn-route="todos"]').click();
  await expect(search).toHaveValue('');
  await search.fill('確認');
  await page.locator(nav+' [data-pn-route="tasks"]').click();
  await expect(search).toHaveValue('工事');
  await expect(page.locator('[data-pn-filter="mine"]')).toHaveAttribute('aria-pressed','true');
  await page.locator(nav+' [data-pn-route="memos"]').click();
  await expect(search).toHaveValue('申し送り');
  await page.locator(nav+' [data-pn-route="todos"]').click();
  await expect(search).toHaveValue('確認');
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
 });
}
for(const width of [390,1366]){
 test('Palette keeps the selected task focused after live list redraw at '+width+'px',async({page})=>{
  test.setTimeout(90000);
  await boot(page,width);
  const nav=width<=780?'.pn-mobile-nav':'.pn-rail-nav';
  await page.locator(nav+' [data-pn-route="tasks"]').click();
  const result=await page.evaluate(async()=>{
    const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
    return bridge.dispatch({type:'task.create',revision:0,ownerRoom:s.roomId,
      ownerUser:s.currentUser,title:'描画フォーカス保持の対象',
      assignee:s.currentUser,status:s.statuses.find(x=>x!=='完了')||'未着手',
      priority:'中',category:s.categories[0]||'その他',
      dueDate:'',dueTime:'',requester:'',description:'',tags:'',checklist:'',pinned:false});
  });
  expect(result?.ok).toBe(true);
  await page.locator('#pnSearch').fill('描画フォーカス保持の対象');
  // The visual board is the default; test this existing dense-list contract.
  await page.locator('#paletteNextRoot [data-pn-task-view="list"]').click();
  const row=page.locator('.pn-flowrow [data-pn-detail="task"]');
  await expect(row).toHaveCount(1);
  await row.focus();
  await page.evaluate(()=>window.WorkBoardPaletteBridge
    .dispatch({type:'todo.create',text:'一覧同期用',memo:''}));
  await expect(row).toBeFocused();
  await row.click();
  const detail=page.locator('#pnDetail');
  await expect(detail).toBeVisible();
  await detail.locator('[data-pn-close]').click();
  await expect(row).toBeFocused();
 });
}

test('Palette clears scoped searches and task filters after another workspace switches user',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  const nav=page.locator('.pn-mobile-nav');
  const search=page.locator('#pnSearch');
  const snapshot=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot());
  const nextUser=snapshot.users.find(user=>user!==snapshot.currentUser);
  expect(nextUser).toBeTruthy();
  await nav.locator('[data-pn-route="tasks"]').click();
  await search.fill('以前の利用者に固有の検索語');
  await page.locator('[data-pn-filter="mine"]').click();
  await expect(page.locator('[data-pn-filter="mine"]')).toHaveAttribute('aria-pressed','true');
  await nav.locator('[data-pn-route="memos"]').click();
  await search.fill('申し送りの旧検索条件');
  const result=await page.evaluate(user=>window.WorkBoardPaletteBridge.selectUser(user),nextUser);
  expect(result?.ok).toBe(true);
  await expect(search).toHaveValue('');
  await expect(page.locator('#pnAccountName')).toHaveText(nextUser);
  await nav.locator('[data-pn-route="tasks"]').click();
  await expect(search).toHaveValue('');
  await expect(page.locator('[data-pn-filter="all"]')).toHaveAttribute('aria-pressed','true');
  await nav.locator('[data-pn-route="memos"]').click();
  await expect(search).toHaveValue('');
});

for(const width of [390,1366]){
 test('Palette retains each tab reading position and Quick Create opens an unfiltered ToDo at '+width+'px',async({page})=>{
  test.setTimeout(90000);
  await boot(page,width);
  const nav=page.locator('#paletteNextRoot '+(width<=780?'.pn-mobile-nav':'.pn-rail-nav'));
  // Guarantee a scrollable document without inserting test records in Firebase.
  await page.locator('#pnWorkspace').evaluate(el=>{el.style.minHeight='2400px'});
  await nav.locator('[data-pn-route="tasks"]').evaluate(button=>button.click());
  await page.evaluate(()=>window.scrollTo({top:540,behavior:'instant'}));
  await expect.poll(()=>page.evaluate(()=>Math.round(window.scrollY))).toBeGreaterThan(500);
  await nav.locator('[data-pn-route="todos"]').evaluate(button=>button.click());
  await expect.poll(()=>page.evaluate(()=>Math.round(window.scrollY))).toBe(0);
  await page.evaluate(()=>window.scrollTo({top:280,behavior:'instant'}));
  await nav.locator('[data-pn-route="tasks"]').evaluate(button=>button.click());
  await expect.poll(()=>page.evaluate(()=>Math.round(window.scrollY))).toBeGreaterThan(500);
  await nav.locator('[data-pn-route="todos"]').evaluate(button=>button.click());
  await expect.poll(()=>page.evaluate(()=>Math.round(window.scrollY))).toBeGreaterThan(240);
  // The global create action must not carry another workspace's search filter.
  await nav.locator('[data-pn-route="tasks"]').evaluate(button=>button.click());
  const search=page.locator('#pnSearch');
  await search.fill('タスクだけの検索条件');
  await page.locator('[data-pn-create]').evaluate(button=>button.click());
  await page.locator('[data-pn-quick-create="todo"]').evaluate(button=>button.click());
  await expect(search).toHaveValue('');
  await expect(page.locator('#pnTodoInput')).toBeFocused();
  await expect.poll(()=>page.evaluate(()=>Math.round(window.scrollY))).toBe(0);
  await nav.locator('[data-pn-route="tasks"]').evaluate(button=>button.click());
  await expect(search).toHaveValue('タスクだけの検索条件');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
    .toBeLessThanOrEqual(2);
 });
}


test('Palette Today reports all ToDos even when its compact preview shows only five',async({page})=>{
  await boot(page,390);
  const created=await page.evaluate(async()=>{
    const bridge=window.WorkBoardPaletteBridge;
    for(let i=1;i<=7;i++){
      const result=await bridge.dispatch({type:'todo.create',text:'今日の件数確認 '+i,memo:''});
      if(!result?.ok)return false;
    }
    return true;
  });
  expect(created).toBe(true);
  const today=page.locator('#paletteNextRoot');
  await expect(today.locator('.pn-hero .pn-chip-todo')).toHaveText('未完了ToDo 7件');
  await expect(today.locator('.pn-surface-todo [data-pn-detail="todo"]')).toHaveCount(5);
  const more=today.locator('.pn-surface-todo .pn-today-more');
  await expect(more).toContainText('残り 2件');
  await more.click();
  await expect(today.locator('.pn-todo-overview')).toBeVisible();
  await expect(today.locator('.pn-todo-columns [data-pn-detail="todo"]')).toHaveCount(7);
});


test('Palette Today keeps the next ToDo focused after completing an item',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  const ids=await page.evaluate(async()=>{
    const bridge=window.WorkBoardPaletteBridge;
    const first=await bridge.dispatch({type:'todo.create',text:'今日の次の操作A',memo:''});
    const second=await bridge.dispatch({type:'todo.create',text:'今日の次の操作B',memo:''});
    return first?.ok&&second?.ok?[first.id,second.id]:[];
  });
  expect(ids).toHaveLength(2);
  const list=page.locator('#paletteNextRoot .pn-surface-todo .pn-todolist');
  await expect(list.locator('[data-pn-cmd="todo.toggle"]')).toHaveCount(2);
  const firstId=await list.locator('[data-pn-cmd="todo.toggle"]').first().getAttribute('data-id');
  const nextId=await list.locator('[data-pn-cmd="todo.toggle"]').nth(1).getAttribute('data-id');
  await list.locator('[data-pn-cmd="todo.toggle"]').first().click();
  await expect.poll(()=>page.evaluate(id=>
    window.WorkBoardPaletteBridge.readSnapshot().todos.find(t=>t.id===id)?.completed,firstId)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>document.activeElement?.dataset.id)).toBe(nextId);
  await expect(list.locator('[data-pn-cmd="todo.toggle"]')).toHaveCount(1);
  await list.locator('[data-pn-cmd="todo.toggle"]').first().click();
  await expect(list.locator('[data-pn-cmd="todo.toggle"]')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>document.activeElement?.dataset.pnRoute)).toBe('todos');
  await expect(page.locator('#paletteNextRoot .pn-hero .pn-chip-todo')).toHaveText('未完了ToDo 0件');
});

test('Palette Today opens adjacent schedules and their related task without leaving Today',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  const ids=await page.evaluate(async()=>{
    const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
    const day=new Date().toLocaleDateString('sv-SE');
    const assignee=s.assignees.includes(s.currentUser)?s.currentUser:s.assignees[0];
    const task=await bridge.dispatch({
      type:'task.create',revision:0,ownerRoom:s.roomId,ownerUser:s.currentUser,
      title:'今日の関連タスク',assignee,status:s.statuses.find(x=>x!=='完了')||'未着手',
      priority:'中',category:s.categories[0]||'その他',
      requester:'',description:'事前確認',tags:'',checklist:'',pinned:false
    });
    if(!task?.ok)return {error:'task'};
    const scheduleIds=[];
    for(let i=0;i<2;i++){
      const plan=await bridge.dispatch({
        type:'schedule.create',revision:0,ownerRoom:s.roomId,ownerUser:s.currentUser,
        values:{title:'今日の予定'+(i+1),startAt:day+'T'+String(8+i).padStart(2,'0')+':00',
          endAt:day+'T'+String(i+9).padStart(2,'0')+':00',assignee,category:s.categories[0]||'その他',
          location:'',memo:'',relatedTaskId:task.id}
      });
      if(!plan?.ok)return {error:'schedule'};
      scheduleIds.push(plan.id);
    }
    return {scheduleIds,taskId:task.id};
  });
  expect(ids.error||'').toBe('');
  const area=page.locator('#paletteNextRoot .pn-surface-schedule');
  await expect(area.locator('[data-pn-detail="schedule"]')).toHaveCount(2);
  await expect(area.locator('[data-pn-edit="schedule"]')).toHaveCount(0);
  await expect(area.locator('[data-pn-linked-task]')).toHaveCount(2);
  await area.locator('[data-pn-detail="schedule"]').first().click();
  const inspector=page.locator('#pnDetail');
  await expect(inspector.locator('.pn-inspect-sequence-position')).toContainText('1 / 2');
  await inspector.locator('[data-pn-inspect-step="1"]').click();
  await expect(inspector.locator('.pn-inspect-sequence-position')).toContainText('2 / 2');
  await inspector.locator('[data-pn-linked-task]').click();
  await expect(inspector).toContainText('TASK DETAIL');
  await inspector.locator('[data-pn-related-back]').click();
  await expect(inspector).toContainText('SCHEDULE DETAIL');
  await inspector.locator('[data-pn-close]').click();
  await expect(page.locator('#paletteNextRoot .pn-hero')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','palette');
});


for(const width of [390,1366]){
 test('Palette returns to the last inspected task above the mobile dock at '+width+'px',async({page})=>{
  test.setTimeout(90000);
  await boot(page,width);
  const nav=width<=780?'.pn-mobile-nav':'.pn-rail-nav';
  await page.locator(nav+' [data-pn-route="tasks"]').click();
  const created=await page.evaluate(async()=>{
    const bridge=window.WorkBoardPaletteBridge,snap=bridge.readSnapshot();
    const ids=[];
    for(let i=0;i<2;i++){
      const task=await bridge.dispatch({
        type:'task.create',revision:0,ownerRoom:snap.roomId,ownerUser:snap.currentUser,
        title:'詳細復帰位置検証 '+(i+1),assignee:snap.currentUser,
        status:snap.statuses.find(value=>value!=='完了')||'未着手',
        priority:'中',dueDate:'2027-11-0'+(i+1),dueTime:'',
        category:snap.categories[0]||'その他',
        requester:'',description:'',tags:'',checklist:'',pinned:false
      });
      if(!task?.ok)return false;
      ids.push(task.id);
    }
    return ids.length===2;
  });
  expect(created).toBe(true);
  await page.locator('#pnSearch').fill('詳細復帰位置検証');
  // The visual board is the default; test this existing dense-list contract.
  await page.locator('#paletteNextRoot [data-pn-task-view="list"]').click();
  const rows=page.locator('#pnWorkspace .pn-flowrow');
  await expect(rows).toHaveCount(2);
  // Create a long list viewport without changing any record or data writer.
  await page.locator('#pnWorkspace').evaluate(el=>{el.style.minHeight='3500px'});
  await rows.first().evaluate(el=>{el.style.marginTop='750px'});
  await rows.nth(1).evaluate(el=>{el.style.marginTop='940px'});
  const first=rows.first().locator('[data-pn-detail="task"]');
  const second=rows.nth(1).locator('[data-pn-detail="task"]');
  await first.scrollIntoViewIfNeeded();
  await first.click();
  const inspector=page.locator('#pnDetail');
  await expect(inspector).toBeVisible();
  await expect(inspector.locator('.pn-inspect-sequence-position')).toHaveText('1 / 2');
  await inspector.locator('[data-pn-inspect-step="1"]').click();
  await expect(inspector.locator('.pn-inspect-sequence-position')).toHaveText('2 / 2');
  // Simulate the background viewport drifting while the fixed inspector is open.
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await expect.poll(()=>page.evaluate(()=>Math.round(window.scrollY))).toBe(0);
  await inspector.locator('[data-pn-close]').click();
  await expect(inspector).toBeHidden();
  await expect(second).toBeFocused();
  await expect(second).toHaveAttribute('data-pn-returned','');
  const bounds=await second.evaluate(el=>{
    const card=el.getBoundingClientRect();
    const header=document.querySelector('#paletteNextRoot .pn-topbar').getBoundingClientRect();
    const dock=document.querySelector('#paletteNextRoot .pn-mobile-nav').getBoundingClientRect();
    const dockVisible=dock.height>0&&dock.top<window.innerHeight&&dock.bottom>0;
    return {
      top:card.top,bottom:card.bottom,
      safeTop:Math.max(8,Math.min((dockVisible?dock.top-12:window.innerHeight-12)-45,header.bottom+10)),
      safeBottom:dockVisible?dock.top-12:window.innerHeight-12,
      scrollY:window.scrollY,
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
    };
  });
  expect(bounds.scrollY).toBeGreaterThan(500);
  expect(bounds.top).toBeGreaterThanOrEqual(bounds.safeTop-3);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.safeBottom+3);
  expect(bounds.overflow).toBeLessThanOrEqual(2);
  await expect(page.locator('#pnSearch')).toHaveValue('詳細復帰位置検証');
 });
}


for(const width of [320,390]){
 test('Palette mobile touch targets stay accessible at '+width+'px',async({page})=>{
  test.setTimeout(90000);
  await boot(page,width);
  const created=await page.evaluate(async()=>{
    const bridge=window.WorkBoardPaletteBridge,snap=bridge.readSnapshot();
    const todo=await bridge.dispatch({type:'todo.create',text:'タップ領域確認ToDo',memo:''});
    const task=await bridge.dispatch({
      type:'task.create',revision:0,ownerRoom:snap.roomId,ownerUser:snap.currentUser,
      title:'タップ領域確認タスク',assignee:snap.currentUser,
      status:snap.statuses.find(value=>value!=='完了')||'未着手',
      priority:'中',category:snap.categories[0]||'その他',
      dueDate:'',dueTime:'',requester:'',description:'',tags:'',checklist:'',pinned:false
    });
    return todo?.ok&&task?.ok;
  });
  expect(created).toBe(true);
  const nav=page.locator('#paletteNextRoot .pn-mobile-nav');
  await nav.locator('[data-pn-route="todos"]').click();
  const todo=page.locator('#paletteNextRoot .pn-todolist li').filter({hasText:'タップ領域確認ToDo'}).first();
  await expect(todo).toBeVisible();
  for(const selector of ['.pn-check','.pn-todoopen','[data-pn-cmd="todo.move"]']){
    const target=todo.locator(selector).first();
    await expect(target).toBeVisible();
    const box=await target.boundingBox();
    expect(box?.height||0,selector).toBeGreaterThanOrEqual(44);
    if(selector!=='.pn-todoopen')expect(box?.width||0,selector).toBeGreaterThanOrEqual(44);
  }
  await nav.locator('[data-pn-route="tasks"]').click();
  // The visual board is the default; test this existing dense-list contract.
  await page.locator('#paletteNextRoot [data-pn-task-view="list"]').click();
  const task=page.locator('#paletteNextRoot .pn-flowrow').filter({hasText:'タップ領域確認タスク'}).first();
  await expect(task).toBeVisible();
  for(const selector of ['.pn-flowtitle','.pn-task-star']){
    const target=task.locator(selector).first();
    const box=await target.boundingBox();
    expect(box?.height||0,selector).toBeGreaterThanOrEqual(44);
  }
  await task.locator('[data-pn-detail="task"]').click();
  const inspector=page.locator('#pnDetail');
  await expect(inspector).toBeVisible();
  for(const selector of ['[data-pn-inspect-step]','.pn-inspect-close','[data-pn-inspect-edit-shortcut]']){
    const target=inspector.locator(selector).first();
    const box=await target.boundingBox();
    expect(box?.height||0,selector).toBeGreaterThanOrEqual(44);
  }
  const footer=await inspector.locator('.pn-inspect-actions').evaluate(el=>{
    const style=getComputedStyle(el);
    return {maxHeight:parseFloat(style.maxHeight),overflow:style.overflowY};
  });
  expect(footer.overflow).toBe('auto');
  expect(footer.maxHeight).toBeLessThanOrEqual(210);
  await inspector.locator('[data-pn-close]').click();
  await expect(task.locator('.pn-flowtitle')).toBeFocused();
  const overflow=await page.evaluate(()=>
    document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
 });
}


for(const width of [320,390]){
 test('Palette schedule and repeat forms keep actions above a simulated mobile keyboard at '+width+'px',async({page})=>{
  test.setTimeout(90000);
  await boot(page,width);
  await page.locator('.pn-mobile-nav [data-pn-route="schedule"]').click();
  await page.locator('.pn-calendar-toolbar [data-pn-edit="schedule"]').click();
  const drawer=page.locator('#pnDetail');
  const form=drawer.locator('[data-pn-form="schedule-editor"]');
  await expect(form).toBeVisible();
  await expect(drawer.locator('.pn-edit-shell')).toBeVisible();
  await expect(form.locator('.pn-editor-actions [type="submit"]')).toBeVisible();
  await expect(form.locator('.pn-editor-scroll')).toBeVisible();
  await expect(form.locator('[name="title"]')).not.toBeFocused();
  const simulated=await page.evaluate(()=>{
    const original=Object.getOwnPropertyDescriptor(window,'visualViewport');
    const height=350;
    Object.defineProperty(window,'visualViewport',{
      configurable:true,value:{height,offsetTop:0}
    });
    window.dispatchEvent(new Event('resize'));
    const drawer=document.querySelector('#pnDetail');
    const body=drawer.querySelector('.pn-editor-scroll').getBoundingClientRect();
    const footer=drawer.querySelector('.pn-editor-actions').getBoundingClientRect();
    const outer=drawer.getBoundingClientRect();
    if(original)Object.defineProperty(window,'visualViewport',original);
    else delete window.visualViewport;
    window.dispatchEvent(new Event('resize'));
    return {
      outerBottom:outer.bottom,footerBottom:footer.bottom,
      bodyBottom:body.bottom,footerTop:footer.top,
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
    };
  });
  expect(simulated.outerBottom).toBeLessThanOrEqual(352);
  expect(simulated.footerBottom).toBeLessThanOrEqual(simulated.outerBottom+2);
  expect(simulated.bodyBottom).toBeLessThanOrEqual(simulated.footerTop+2);
  expect(simulated.overflow).toBeLessThanOrEqual(2);
  await form.locator('[name="title"]').fill('予定フォームキーボード検証');
  await form.locator('[data-pn-batch-new]').click();
  const copy=drawer.locator('[data-pn-form="schedule-copy"]');
  await expect(copy).toBeVisible();
  await expect(copy.locator('.pn-copy-review-stage [data-pn-copy-preview]')).toBeVisible();
  await expect(copy.locator('.pn-editor-actions [data-pn-copy-submit]')).toBeDisabled();
  await expect(copy.locator('.pn-editor-scroll')).toBeVisible();
  await drawer.locator('[data-pn-copy-back]').click();
  await expect(drawer.locator('[data-pn-form="schedule-editor"] [name="title"]'))
    .toHaveValue('予定フォームキーボード検証');
  page.once('dialog',dialog=>dialog.accept());
  await drawer.locator('[data-pn-cancel]').click();
  await expect(drawer).toBeHidden();
 });
}


test('Palette protects an unsaved task on cancel, tab and Escape, then accepts discard',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  await page.locator('.pn-mobile-nav [data-pn-route="tasks"]').click();
  await page.locator('#paletteNextRoot [data-pn-edit="task"]').first().click();
  const form=page.locator('#pnDetail [data-pn-form="task-editor"]');
  await expect(form).toBeVisible();
  await form.locator('[name="title"]').fill('保存前の下書き');
  page.once('dialog',async dialog=>{
    expect(dialog.message()).toContain('未保存の変更');
    await dialog.dismiss();
  });
  await form.locator('[data-pn-cancel]').click();
  await expect(form).toBeVisible();
  await expect(form.locator('[name="title"]')).toHaveValue('保存前の下書き');

  page.once('dialog',dialog=>dialog.dismiss());
  await page.locator('.pn-mobile-nav [data-pn-route="memos"]').evaluate(el=>el.click());
  await expect(form).toBeVisible();
  await expect(page.locator('.pn-mobile-nav [data-pn-route="tasks"]')).toHaveAttribute('aria-current','page');

  page.once('dialog',dialog=>dialog.dismiss());
  await page.keyboard.press('Escape');
  await expect(form).toBeVisible();

  page.once('dialog',dialog=>dialog.accept());
  await form.locator('[data-pn-cancel]').click();
  await expect(form).toBeHidden();
  const matching=await page.evaluate(()=>
    window.WorkBoardPaletteBridge.readSnapshot().tasks.some(task=>task.title==='保存前の下書き'));
  expect(matching).toBe(false);
});

test('Palette keeps schedule input when discarding modified recurrence settings',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  await page.locator('.pn-mobile-nav [data-pn-route="schedule"]').click();
  await page.locator('.pn-calendar-toolbar [data-pn-edit="schedule"]').click();
  const drawer=page.locator('#pnDetail');
  const form=drawer.locator('[data-pn-form="schedule-editor"]');
  await form.locator('[name="title"]').fill('予定の入力を保持');
  await form.locator('[data-pn-batch-new]').click();
  const copy=drawer.locator('[data-pn-form="schedule-copy"]');
  await expect(copy).toBeVisible();
  await copy.locator('[name="method"]').selectOption('weekly');
  page.once('dialog',dialog=>dialog.dismiss());
  await drawer.locator('[data-pn-copy-back]').click();
  await expect(copy).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());
  await drawer.locator('[data-pn-copy-back]').click();
  await expect(form).toBeVisible();
  await expect(form.locator('[name="title"]')).toHaveValue('予定の入力を保持');
  // The schedule was already edited before opening recurrence. Returning
  // must not accidentally mark the unsaved schedule as clean.
  page.once('dialog',dialog=>dialog.dismiss());
  await drawer.locator('[data-pn-cancel]').click();
  await expect(form).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());
  await drawer.locator('[data-pn-cancel]').click();
  await expect(drawer).toBeHidden();
});

test('Palette shows a required-field error without removing the editor draft',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  await page.locator('.pn-mobile-nav [data-pn-route="memos"]').click();
  await page.locator('#paletteNextRoot [data-pn-edit="memo"]').first().click();
  const form=page.locator('#pnDetail [data-pn-form="memo-editor"]');
  await form.locator('[name="title"]').fill('入力の検証');
  await form.locator('[name="body"]').fill('');
  await form.locator('[type="submit"]').click();
  await expect(form.locator('[data-pn-editor-feedback]')).toBeVisible();
  await expect(form.locator('[data-pn-editor-feedback]')).toContainText('本文');
  await expect(form.locator('[name="title"]')).toHaveValue('入力の検証');
  await form.locator('[name="body"]').fill('入力を修正しました');
  await expect(form.locator('[data-pn-editor-feedback]')).toBeHidden();
  page.once('dialog',dialog=>dialog.accept());
  await form.locator('[data-pn-cancel]').click();
  await expect(form).toBeHidden();
});



for(const width of [320,390,1366]){
  test('Palette Studio Flow Map selects work and saves one status through canonical CAS at '+width+'px',async({page})=>{
    test.setTimeout(90000);
    await boot(page,width);
    const seeded=await page.evaluate(async()=>{
      const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
      const day=(add)=>{const d=new Date();d.setDate(d.getDate()+add);return d.toLocaleDateString('sv-SE')};
      const statuses=s.statuses.filter(x=>x!=='完了');
      const initial=statuses[0];
      const next=statuses.find(x=>x!==initial&&x!=='保留');
      if(!initial||!next)return {error:'statuses'};
      const base={type:'task.create',revision:0,ownerRoom:s.roomId,ownerUser:s.currentUser,
        assignee:s.currentUser,status:initial,priority:'中',
        category:s.categories[0]||'その他',requester:'',tags:'',checklist:'',pinned:false};
      const first=await bridge.dispatch({...base,title:'Flow Map 先行仕事',dueDate:day(1),
        description:'現場の作業を確認'});
      const second=await bridge.dispatch({...base,title:'Flow Map 関連予定のある仕事',
        dueDate:day(2),description:'作業前の確認事項'});
      if(!first?.ok||!second?.ok)return {error:'task'};
      const plan=await bridge.dispatch({type:'schedule.create',revision:0,
        ownerRoom:s.roomId,ownerUser:s.currentUser,
        values:{title:'Flow Map 連携予定',startAt:day(2)+'T09:00',
          endAt:day(2)+'T10:00',assignee:s.currentUser,
          category:s.categories[0]||'その他',location:'',memo:'',relatedTaskId:second.id}});
      return plan?.ok?{first:first.id,second:second.id,plan:plan.id,initial,next}:{error:'schedule'};
    });
    expect(seeded.error||'').toBe('');
    await page.locator(width<=780?'.pn-mobile-nav [data-pn-route="tasks"]':
      '.pn-rail-nav [data-pn-route="tasks"]').click();
    await page.locator('#pnSearch').fill('Flow Map');
    const board=page.locator('#paletteNextRoot .pn-task-board');
    const workbench=page.locator('#paletteNextRoot .pn-flow-workbench');
    await expect(board.locator('.pn-board-card')).toHaveCount(2);
    await expect(workbench).toHaveAttribute('data-flow-id',seeded.first);
    if(width<=780){
      await expect(workbench).toHaveAttribute('data-flow-expanded','false');
      await expect(workbench.locator('#pnFlowBody')).toBeHidden();
    } else await expect(workbench.locator('#pnFlowBody')).toBeVisible();
    const second=board.locator('.pn-board-card').filter({hasText:'Flow Map 関連予定のある仕事'});
    await second.locator('[data-pn-flow-focus]').click();
    await expect(second).toHaveAttribute('data-flow-active','true');
    await expect(workbench).toHaveAttribute('data-flow-id',seeded.second);
    if(width<=780){
      await expect(workbench).toHaveAttribute('data-flow-expanded','true');
      await expect(workbench.locator('#pnFlowBody')).toBeVisible();
    }
    await expect(workbench.locator('.pn-flow-linked [data-pn-detail="schedule"]'))
      .toHaveAttribute('data-id',seeded.plan);
    // Status is an explicit single-task CAS command, not a duplicate writer.
    await second.locator('[data-pn-flow-status]').selectOption(seeded.next);
    await expect.poll(()=>page.evaluate(id=>window.WorkBoardPaletteBridge
      .readSnapshot().tasks.find(task=>task.id===id)?.status,seeded.second)).toBe(seeded.next);
    await expect(workbench).toHaveAttribute('data-flow-id',seeded.second);
    await expect(workbench.locator('[data-pn-flow-status]')).toHaveValue(seeded.next);
    const unchanged=await page.evaluate(id=>{
      const snapshot=window.WorkBoardPaletteBridge.readSnapshot();
      const task=snapshot.tasks.find(t=>t.id===id);
      return {description:task?.description,priority:task?.priority,
        linked:snapshot.schedules.find(s=>s.relatedTaskId===id)?.id};
    },seeded.second);
    expect(unchanged).toEqual({description:'作業前の確認事項',priority:'中',linked:seeded.plan});
    // Stale card revisions are rejected before a write. No incidental update.
    const select=second.locator('[data-pn-flow-status]');
    await select.evaluate(el=>el.dataset.revision=String(Number(el.dataset.revision)+7));
    await select.selectOption(seeded.initial);
    await expect(workbench.locator('[data-pn-flow-status]')).toHaveValue(seeded.next);
    await expect(page.locator('#pnToast')).toContainText('最新の状態');
    const metrics=await page.evaluate(()=>{
      const a=document.querySelector('#paletteNextRoot .pn-flow-board-area');
      const b=document.querySelector('#paletteNextRoot .pn-flow-workbench');
      return {overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        board:a.getBoundingClientRect().toJSON(),panel:b.getBoundingClientRect().toJSON()};
    });
    expect(metrics.overflow).toBeLessThanOrEqual(2);
    if(width>1090)expect(metrics.board.right).toBeLessThanOrEqual(metrics.panel.left+2);
    else expect(metrics.panel.bottom).toBeLessThanOrEqual(metrics.board.top+2);
    await page.locator('[data-pn-task-view="list"]').click();
    await expect(page.locator('.pn-flow-workspace')).toHaveCount(0);
    await expect(page.locator('.pn-task-rows')).toContainText('Flow Map 関連予定のある仕事');
    await page.locator('[data-pn-task-view="board"]').click();
    await expect(workbench).toHaveAttribute('data-flow-id',seeded.second);
    await workbench.locator('[data-pn-detail="task"]').click();
    await expect(page.locator('#pnDetail')).toContainText('TASK DETAIL');
  });
}

for(const width of [320,390,1366]){
 test('Palette editorial cover and visual board keep canonical tasks intact at '+width+'px',async({page})=>{
  test.setTimeout(90000);
  await boot(page,width);
  await expect(page.locator('#paletteNextRoot .pn-hero-feature')).toBeVisible();
  await expect(page.locator('#paletteNextRoot .pn-hero h1')).toContainText('次の一手');
  const nav=width<=780?'.pn-mobile-nav':'.pn-rail-nav';
  await page.locator(nav+' [data-pn-route="tasks"]').click();
  const boardToggle=page.locator('#paletteNextRoot [data-pn-task-view="board"]');
  const listToggle=page.locator('#paletteNextRoot [data-pn-task-view="list"]');
  await expect(boardToggle).toHaveAttribute('aria-pressed','true');
  const name='Palette ボード検査 '+width;
  const created=await page.evaluate(async title=>{
    const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
    return bridge.dispatch({
      type:'task.create',revision:0,ownerRoom:s.roomId,ownerUser:s.currentUser,
      title,assignee:s.currentUser,status:s.statuses.find(x=>x!=='完了')||'未着手',
      priority:'高',category:s.categories[0]||'その他',
      description:'',requester:'',tags:'',checklist:'',pinned:false
    });
  },name);
  expect(created?.ok).toBe(true);
  await page.locator('#pnSearch').fill(name);
  const card=page.locator('#paletteNextRoot .pn-board-card').filter({hasText:name});
  await expect(card).toHaveCount(1);
  await expect(page.locator('#paletteNextRoot .pn-task-board')).toBeVisible();
  if(width<=780){
    // All filters and board controls are directly visible without two
    // stacked toolbars; actual computed layout guards against mobile regressions.
    const layout=await page.evaluate(()=>{
      const bounds=selector=>document.querySelector('#paletteNextRoot '+selector)
        ?.getBoundingClientRect();
      return {
        filters:bounds('.pn-flowtabs')?.height,
        header:bounds('.pn-task-sheet>.pn-sheethead')?.height,
        laneTop:bounds('.pn-board-lane')?.top,
        dockTop:bounds('.pn-mobile-nav')?.top,
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
      };
    });
    expect(layout.filters).toBeLessThanOrEqual(56);
    expect(layout.header).toBeLessThanOrEqual(138);
    expect(layout.overflow).toBeLessThanOrEqual(2);
    if(width===390)expect(layout.laneTop).toBeLessThan(layout.dockTop);
    await expect(page.locator('#paletteNextRoot .pn-task-sheet>.pn-bulkbar[data-empty="true"]')).toBeHidden();
  }
  await expect(card.locator('[data-pn-detail="task"]')).toBeVisible();
  const categorySize=await card.locator('.pn-board-card-label')
    .evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  expect(categorySize).toBeGreaterThanOrEqual(12);
  const before=await page.evaluate(title=>{
    const task=window.WorkBoardPaletteBridge.readSnapshot().tasks.find(t=>t.title===title);
    return task&&{id:task.id,revision:task.revision,status:task.status};
  },name);
  expect(before?.id).toBeTruthy();
  await card.locator('[data-pn-bulk-id]').check();
  await expect(page.locator('#paletteNextRoot .pn-bulk-heading')).toContainText('1件選択中');
  if(width<=780)await expect(page.locator('#paletteNextRoot .pn-task-sheet>.pn-bulkbar')).toBeVisible();
  await listToggle.click();
  await expect(listToggle).toHaveAttribute('aria-pressed','true');
  const row=page.locator('#paletteNextRoot .pn-flowrow').filter({hasText:name});
  await expect(row).toHaveCount(1);
  await expect(row.locator('[data-pn-bulk-id]')).toBeChecked();
  await row.locator('[data-pn-detail="task"]').click();
  await expect(page.locator('#pnDetail .pn-inspect-hero')).toContainText(name);
  await page.locator('#pnDetail [data-pn-close]').click();
  await boardToggle.click();
  await expect(boardToggle).toHaveAttribute('aria-pressed','true');
  await expect(card).toHaveCount(1);
  await expect(page.locator('#pnSearch')).toHaveValue(name);
  const after=await page.evaluate(title=>{
    const task=window.WorkBoardPaletteBridge.readSnapshot().tasks.find(t=>t.title===title);
    return task&&{id:task.id,revision:task.revision,status:task.status};
  },name);
  expect(after).toEqual(before);
  expect(await page.evaluate(()=>
    document.documentElement.scrollWidth-document.documentElement.clientWidth
  )).toBeLessThanOrEqual(2);
 });
}


// Visual finishing gate: rendered geometry and WCAG AA text on all six paper
// colors, both themes, and the supported narrow/desktop viewports.
// The existing screenshot-on-failure policy retains visual evidence on errors.
for (const width of [320,390,1366]) {
  test('Palette finishing gate: legible cards and distinct route layouts at '+width+'px',async({page})=>{
    test.setTimeout(90000);
    await page.addInitScript(({room})=>{
      const key='system-business-memos:'+room;
      const colors=['ivory','lemon','peach','mint','sky','lavender'];
      const now=Date.now();
      const entries=Object.fromEntries(colors.map((color,index)=>{
        const id='palette-qa-'+color;
        return [id,{id,title:'Palette QA '+color,body:'色付きメモの視認性を確認します。',
          category:'その他',tags:[],paperColor:color,pinned:false,
          createdAt:now-index*1000,updatedAt:now-index*1000,
          createdBy:'福冨',updatedBy:'福冨',revision:1}];
      }));
      localStorage.setItem(key,JSON.stringify(entries));
    },{room});
    await boot(page,width);
    const root=page.locator('#paletteNextRoot');
    const nav=width<=780?'.pn-mobile-nav':'.pn-rail-nav';
    for(const mode of ['light','dark']){
      if(mode==='dark')await root.locator('[data-pn-theme]').click();
      await expect(page.locator('#pnApp')).toHaveAttribute('data-theme',mode);
      const navFontSizes=await root.locator(nav+' [data-pn-route]').evaluateAll(nodes=>
        nodes.map(el=>parseFloat(getComputedStyle(el).fontSize)));
      expect(navFontSizes).toHaveLength(5);
      for(const fontSize of navFontSizes)expect(fontSize).toBeGreaterThanOrEqual(12);
      await root.locator(nav+' [data-pn-route="today"]').click();
      const cover=await root.locator('.pn-hero').evaluate(el=>{
        const r=el.getBoundingClientRect();
        return {left:r.left,right:r.right,width:r.width,height:r.height,
          overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
      });
      expect(cover.left).toBeGreaterThanOrEqual(-1);
      expect(cover.right).toBeLessThanOrEqual(width+1);
      expect(cover.overflow).toBeLessThanOrEqual(2);
      if(width>780){
        expect(cover.width).toBeGreaterThanOrEqual(500);
        expect(cover.height).toBeGreaterThanOrEqual(160);
      }else{
        expect(cover.width).toBeGreaterThanOrEqual(width-55);
      }

      await root.locator(nav+' [data-pn-route="tasks"]').click();
      await expect(root.locator('.pn-task-sheet')).toBeVisible();
      const metricFont=await root.locator('.pn-task-metric-top small').first()
        .evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
      expect(metricFont).toBeGreaterThanOrEqual(12);
      await root.locator(nav+' [data-pn-route="schedule"]').click();
      await expect(root.locator('.pn-schedule-sheet')).toBeVisible();
      await root.locator(nav+' [data-pn-route="memos"]').click();
      await expect(root.locator('.pn-gallery-intro')).toBeVisible();
      const statSizes=await root.locator('.pn-gallery-counts span').evaluateAll(nodes=>
        nodes.map(el=>parseFloat(getComputedStyle(el).fontSize)));
      expect(statSizes).toHaveLength(3);
      for(const size of statSizes)expect(size).toBeGreaterThanOrEqual(width<=410?11:12);
      const tiles=root.locator('.pn-memotile');
      await expect(tiles).toHaveCount(6);
      const categoryFonts=await tiles.locator('.pn-chip').evaluateAll(nodes=>
        nodes.map(el=>parseFloat(getComputedStyle(el).fontSize)));
      expect(categoryFonts).toHaveLength(6);
      for(const size of categoryFonts)expect(size).toBeGreaterThanOrEqual(12);
      const result=await tiles.evaluateAll(elements=>{
        const luminance=value=>{
          const legacy=value.match(/^rgba?\(([^)]+)\)$/);
          const modern=value.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
          const channels=legacy?legacy[1].match(/[\d.]+/g)?.slice(0,3).map(v=>Number(v)/255):
            modern?modern.slice(1,4).map(Number):null;
          if(!channels||channels.length!==3||channels.some(v=>!Number.isFinite(v)))return NaN;
          const [r,g,b]=channels.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
          return .2126*r+.7152*g+.0722*b;
        };
        return elements.map(card=>{
          const box=card.getBoundingClientRect();
          const bg=luminance(getComputedStyle(card).backgroundColor);
          const text=['.pn-memo-number','strong','small'].map(selector=>{
            const el=card.querySelector(selector);
            if(!el)return {selector,contrast:NaN,fontSize:0};
            const cs=getComputedStyle(el),fg=luminance(cs.color);
            return {selector,fontSize:parseFloat(cs.fontSize),
              contrast:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)};
          });
          return {color:card.dataset.paperColor,left:box.left,right:box.right,
            width:box.width,text};
        });
      });
      expect(result.map(row=>row.color).sort()).toEqual(
        ['ivory','lemon','peach','mint','sky','lavender'].sort());
      for(const card of result){
        expect(card.left).toBeGreaterThanOrEqual(-1);
        expect(card.right).toBeLessThanOrEqual(width+1);
        expect(card.width).toBeGreaterThanOrEqual(width<=410?180:135);
        for(const item of card.text){
          expect(Number.isFinite(item.contrast),
            mode+' '+card.color+' '+item.selector+' contrast').toBe(true);
          expect(item.contrast,mode+' '+card.color+' '+item.selector).toBeGreaterThanOrEqual(4.5);
          expect(item.fontSize,mode+' '+card.color+' '+item.selector).toBeGreaterThanOrEqual(10);
        }
      }
      const overflow=await page.evaluate(()=>
        document.documentElement.scrollWidth-document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(2);
    }
  });
}


// Synthetic, local-only comparison captures for reviewing Palette against
// Origin. No production room, real tasks or Firebase credentials are used.
// Keep the evidence in CI artifacts instead of committing screenshot binaries.
for (const width of [390,1366]) {
  test('Palette and Origin visual comparison uses identical sample work at '+width+'px',async({page},testInfo)=>{
    test.setTimeout(90000);
    await page.addInitScript(({room})=>{
      const now=Date.now();
      const colors=['peach','sky','mint','lavender','lemon','ivory'];
      const titles=['端末更新の手順','共有連絡先','会議の準備','定型案内','作業メモ','確認事項'];
      const rows=Object.fromEntries(colors.map((color,i)=>{
        const id='visual-note-'+i;
        return [id,{id,title:titles[i],body:'業務内容を手早く確認するためのテスト用メモです。'+(i%2?' 進行状況と次の対応を記録します。':''),
          category:['手順','宛先・連絡先','定型情報'][i%3],
          tags:[],paperColor:color,pinned:i===0,
          createdAt:now-i*1000,updatedAt:now-i*1000,createdBy:'福冨',updatedBy:'福冨',revision:1}];
      }));
      localStorage.setItem('system-business-memos:'+room,JSON.stringify(rows));
    },{room});
    await boot(page,width);
    const seeded=await page.evaluate(async()=>{
      const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
      const status=s.statuses.filter(value=>value!=='完了');
      const category=s.categories;
      const tasks=[
        ['PC入れ替えの準備',0,'高'],
        ['定期点検の確認',1,'中'],
        ['院内サイトの校正',0,'中'],
        ['印刷機器の設定',2,'低'],
        ['端末配布の連絡',1,'高']
      ];
      const today=new Date().toLocaleDateString('sv-SE');
      for(let i=0;i<tasks.length;i++){
        const [title,index,priority]=tasks[i];
        const result=await bridge.dispatch({
          type:'task.create',revision:0,ownerRoom:s.roomId,ownerUser:s.currentUser,
          title,assignee:s.currentUser,status:status[index]||status[0]||'未着手',
          priority,category:category[i%Math.max(1,category.length)]||'その他',
          dueDate:i===0?today:'',requester:'',description:'画面比較用のサンプルです。',
          tags:'',checklist:'',pinned:false
        });
        if(!result?.ok)return 'task: '+(result?.error||title);
      }
      for(const text of ['点検表を更新する','作業連絡を確認する']){
        const result=await bridge.dispatch({type:'todo.create',text,memo:''});
        if(!result?.ok)return 'todo: '+(result?.error||text);
      }
      for(const [title,start,end] of [
        ['朝の確認','09:00','09:40'],
        ['作業準備','11:00','12:00'],
        ['情報共有','15:30','16:00']
      ]){
        const result=await bridge.dispatch({
          type:'schedule.create',revision:0,ownerRoom:s.roomId,ownerUser:s.currentUser,
          values:{title,startAt:today+'T'+start,endAt:today+'T'+end,
            assignee:s.currentUser,category:category[0]||'その他',location:'会議室',
            memo:'画面比較用',relatedTaskId:''}
        });
        if(!result?.ok)return 'schedule: '+(result?.error||title);
      }
      return '';
    });
    expect(seeded).toBe('');
    const paletteNav=width<=780?'.pn-mobile-nav':'.pn-rail-nav';
    const originNav=width<=780?'#mobileNav':'#desktopNav';
    const paths=[
      {name:'today',palette:'today',origin:'today',marker:'.pn-hero-feature'},
      {name:'tasks',palette:'tasks',origin:'tasks',marker:'.pn-task-sheet'},
      {name:'schedule',palette:'schedule',origin:'calendar',marker:'.pn-schedule-sheet'},
      {name:'memos',palette:'memos',origin:'notes',marker:'.pn-gallery-intro'}
    ];
    for(const path of paths){
      await page.locator('#paletteNextRoot '+paletteNav+' [data-pn-route="'+path.palette+'"]').click();
      await expect(page.locator('#paletteNextRoot '+path.marker)).toBeVisible();
      await page.screenshot({
        path:testInfo.outputPath('visual-compare-'+width+'-palette-'+path.name+'.png'),
        animations:'disabled',caret:'hide'
      });
      await page.locator('#pnMode').selectOption('modern');
      await expect(page.locator('html')).toHaveAttribute('data-wb-display','modern');
      await expect(page.locator('#modernOriginRoot')).toBeVisible();
      await page.locator('#modernOriginRoot '+originNav+' [data-route="'+path.origin+'"]').click();
      await expect(page.locator('#modernOriginRoot #workspace')).toBeVisible();
      await page.screenshot({
        path:testInfo.outputPath('visual-compare-'+width+'-origin-'+path.name+'.png'),
        animations:'disabled',caret:'hide'
      });
      await page.locator('[data-wb-display-choice="palette"]').evaluate(el=>el.click());
      await expect(page.locator('#paletteNextRoot .wb-pn')).toBeVisible();
    }
    const count=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks
      .filter(item=>item.title==='PC入れ替えの準備').length);
    expect(count).toBe(1);
  });
}

for(const width of [320,390,1366]){
  test('Palette Studio contextual ToDo and memo actions at '+width+'px',async({page})=>{
    test.setTimeout(90000);
    await boot(page,width);
    const nav=width<=780?'.pn-mobile-nav':'.pn-rail-nav';
    await page.locator('#paletteNextRoot '+nav+' [data-pn-route="todos"]').click();
    await page.locator('#pnTodoInput').fill('Studio focused ToDo '+width);
    await page.locator('[data-pn-form="todo"] [type="submit"]').click();
    const row=page.locator('#paletteNextRoot .pn-todolist li').filter({hasText:'Studio focused ToDo '+width}).first();
    await expect(row).toBeVisible();
    await row.locator('[data-pn-todo-focus]').click();
    const panel=page.locator('.pn-studio-insight-todo');
    await expect(panel).toContainText('Studio focused ToDo '+width);
    await panel.locator('[data-pn-cmd="todo.toggle"]').click();
    await expect.poll(()=>page.evaluate(title=>{
      return window.WorkBoardPaletteBridge.readSnapshot().todos.find(todo=>todo.text===title)?.completed;
    },'Studio focused ToDo '+width)).toBe(true);
    await page.locator('#paletteNextRoot '+nav+' [data-pn-route="memos"]').click();
    await page.locator('[data-pn-edit="memo"]').first().click();
    const form=page.locator('#pnDetail [data-pn-form="memo-editor"]');
    await form.locator('[name="title"]').fill('Studio preview memo '+width);
    await form.locator('[name="body"]').fill('Studio preview body');
    await form.locator('[type="submit"]').click();
    await expect(form).toBeHidden();
    const item=await page.evaluate(title=>window.WorkBoardPaletteMemoBridgeV369.readSnapshot().find(row=>row.title===title),
      'Studio preview memo '+width);
    expect(item).toBeTruthy();
    await page.locator('[data-pn-memo-pick]').selectOption(item.id);
    await expect(page.locator('.pn-studio-insight-memo')).toContainText('Studio preview body');
    await page.locator('.pn-studio-insight-memo [data-pn-detail="memo"]').click();
    await expect(page.locator('#pnDetail')).toHaveAttribute('data-inspector','memo');
    await page.locator('#pnDetail [data-pn-close]').click();
    const widths=await page.evaluate(()=>({
      client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client+2);
  });
}
