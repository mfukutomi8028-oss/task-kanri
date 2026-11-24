import {test,expect} from '@playwright/test';

const base='http://127.0.0.1:4173';
async function launch(page,width,height=width===320?760:844){
  await page.setViewportSize({width,height});
  await page.clock.install({time:new Date('2026-11-24T08:00:00+09:00')});
  await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
  await page.addInitScript(()=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskRoomId','origin-hallmark-polish');
    localStorage.setItem('systemTaskUser','福冨');
  });
  await page.goto('/?room=origin-hallmark-polish',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  const root=page.locator('#modernOriginRoot');
  await expect(root).toBeVisible();
  return root;
}
async function seedTask(page){
  await page.evaluate(async()=>{
    const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
    const saved=await bridge.dispatch({type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,
      revision:0,title:'通知中の操作を確認',description:'検証用',assignee:s.currentUser,status:s.statuses[0],
      category:s.categories[0],requester:'',tags:'',checklist:'',checklistDone:[],priority:'中',dueDate:'',dueTime:'',pinned:false});
    if(!saved?.ok)throw Error('Synthetic task create failed '+JSON.stringify(saved));
  });
}

for(const width of [320,390,1366]){
  test('Origin schedule notice does not cover detail actions at '+width+'px',async({page})=>{
    const root=await launch(page,width);
    await seedTask(page);
    await root.locator(width<=770?'#mobileNav':'#desktopNav').locator('[data-route="tasks"]').click();
    await root.locator('.origin-task-collection .item-name').first().click();
    const sheet=root.locator('#sheet'),toast=page.locator('#toast');
    const edit=sheet.getByRole('button',{name:'編集する'});
    await expect(edit).toBeVisible();
    const originalHeight=(await sheet.boundingBox()).height;
    await page.evaluate(async()=>{
      const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot(),startAt=new Date(Date.now()+5*60000);
      const saved=await bridge.dispatch({type:'schedule.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,
        values:{title:'少し長い件名の予定通知が詳細の操作と重ならないことを確認',startAt:startAt.toISOString(),
          endAt:new Date(+startAt+3600000).toISOString(),assignee:s.currentUser,category:s.categories[0],
          relatedTaskId:'',location:'検証用会議室',memo:''}});
      if(!saved?.ok)throw Error('Synthetic schedule create failed '+JSON.stringify(saved));
      window.dispatchEvent(new Event('focus'));
    });
    await expect(toast).toContainText('予定15分前');
    await expect(toast).toBeVisible();
    await expect.poll(async()=>{
      const [notice,panel]=await Promise.all([toast.boundingBox(),sheet.boundingBox()]);
      return notice.y-(panel.y+panel.height);
    },{timeout:1500}).toBeGreaterThanOrEqual(4);
    await expect(toast).toHaveCSS('pointer-events','none');
    await edit.click();
    await expect(root.locator('#editForm')).toBeVisible();
    await page.clock.runFor(3400);
    await expect(toast).toBeHidden();
    await expect.poll(async()=>(await sheet.boundingBox()).height).toBe(originalHeight);
  });
}

for(const width of [320,390]){
  test('Origin Memo keeps the mobile mode control focused after keyboard switching at '+width+'px',async({page})=>{
    const root=await launch(page,width);
    await root.locator('#mobileNav [data-route="notes"]').click();
    const personal=root.locator('[data-memo-header-mode="personal"]');
    const business=root.locator('[data-memo-header-mode="business"]');
    await personal.press('Enter');
    await expect(personal).toHaveAttribute('aria-pressed','true');
    await expect(personal).toBeFocused({timeout:1500});
    await page.keyboard.press('Tab');
    await expect.poll(()=>root.evaluate(host=>Boolean(host.shadowRoot.activeElement?.closest('#workspace')))).toBe(true);
    await expect(personal).not.toBeFocused();
    await expect(business).not.toBeFocused();
    await business.press('Space');
    await expect(business).toHaveAttribute('aria-pressed','true');
    await expect(business).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(personal).toBeFocused();
  });
}

for(const width of [320,390]){
  test('Origin dark Schedule keeps selected-day count contrast readable at '+width+'px',async({page})=>{
    const root=await launch(page,width);
    await root.locator('#mobileNav [data-route="calendar"]').click();
    await root.locator('#originSettingsToggle').click();
    await root.locator('#themeBtn').click();
    await root.locator('#originSettingsPanel [data-action="settings-close"]').click();
    await expect(root).toHaveAttribute('data-theme','dark');
    const date=root.locator('.origin-week-jump button[aria-pressed="true"]');
    const contrast=button=>button.evaluate(element=>{
      const channels=color=>(color.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
      const linear=value=>{const n=value/255;return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4};
      const l=color=>{const [r,g,b]=channels(color).map(linear);return .2126*r+.7152*g+.0722*b;};
      const front=l(getComputedStyle(element.querySelector('small')).color);
      const back=l(getComputedStyle(element).backgroundColor);
      return (Math.max(front,back)+.05)/(Math.min(front,back)+.05);
    });
    await expect(date.locator('small')).toBeVisible();
    expect(await contrast(date)).toBeGreaterThanOrEqual(4.5);
    const another=root.locator('.origin-week-jump button[aria-pressed="false"]').first();
    await another.click();
    expect(await contrast(date)).toBeGreaterThanOrEqual(4.5);
  });
}

test('Origin header focus indicators reach 3:1 on light and dark surfaces',async({page})=>{
  const root=await launch(page,1366,900);
  const sample=root.locator('#desktopNav [data-route="tasks"]');
  async function ratio(){
    await page.keyboard.press('Tab');
    await sample.focus();
    const paint=await sample.evaluate(el=>{
      const css=getComputedStyle(el), surface=document.createElement('span');
      surface.style.color='var(--paper)';
      el.parentNode.append(surface);
      const paper=getComputedStyle(surface).color;surface.remove();
      const l=color=>{const [r,g,b]=color.match(/\d+(?:\.\d+)?/g).slice(0,3).map(Number).map(v=>{const n=v/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
      const levels=[l(css.outlineColor),l(paper)].sort((a,b)=>b-a);
      return {ratio:(levels[0]+.05)/(levels[1]+.05),style:css.outlineStyle};
    });
    expect(paint.style).toBe('solid');
    expect(paint.ratio).toBeGreaterThanOrEqual(3);
  }
  await ratio();
  await root.locator('#originSettingsToggle').click();
  await root.locator('#themeBtn').click();
  await root.locator('#originSettingsPanel [data-action="settings-close"]').click();
  await ratio();
});
