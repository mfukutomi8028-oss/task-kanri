import { test, expect } from '@playwright/test';

const room='test-palette-next-v369';

async function boot(page,width=1366,preview=true) {
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
  const suffix=preview?'&paletteNext=1':'';
  await page.goto('/?room='+room+suffix,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await expect(page.locator('#wbPaletteNextPreviewV369')).toHaveCount(1);
  if(preview) {
    await expect(page.locator('#paletteNextRoot .wb-pn')).toBeVisible({timeout:15000});
    await expect(page.locator('html')).toHaveAttribute('data-wb-palette-next-preview','true');
  }
}

test('Existing Classic/Modern/Palette/Journal stay available and NEXT opens only by opt-in', async({page})=>{
  await boot(page,1366,false);
  await expect(page.locator('#paletteNextRoot')).toHaveCount(0);
  await page.locator('[data-wb-display-choice="palette"]').evaluate(el=>el.click());
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','palette');
  await expect(page.locator('.app-shell')).toBeVisible();
  await page.locator('#wbPaletteNextPreviewV369').evaluate(el=>el.click());
  await expect(page).toHaveURL(/paletteNext=1/);
  await expect(page.locator('#paletteNextRoot .wb-pn')).toBeVisible({timeout:15000});
  await expect(page.locator('.app-shell')).toBeHidden();
  await page.locator('#paletteNextRoot [data-pn-exit]').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-wb-palette-next-preview','true');
  await expect(page.locator('.app-shell')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','palette');
  await expect(page).not.toHaveURL(/paletteNext=1/);
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

test('Palette NEXT switching between display modes never changes stored mode without user selection',async({page})=>{
  await boot(page);
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','classic');
  await page.locator('#pnMode').selectOption('modern');
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','modern');
  await expect(page.locator('html')).not.toHaveAttribute('data-wb-palette-next-preview','true');
  await expect(page.locator('.app-shell')).toBeVisible();
  await page.locator('#wbPaletteNextPreviewV369').evaluate(el=>el.click());
  await expect(page.locator('#paletteNextRoot .pn-hero')).toBeVisible({timeout:15000});
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','modern');
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
    await page.locator('#paletteNextRoot [data-pn-exit]').click();
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
