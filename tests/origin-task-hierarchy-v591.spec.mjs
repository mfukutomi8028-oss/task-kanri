import {test,expect} from '@playwright/test';

// Test-only room and deliberately synthetic task data. No production access.
async function openOrigin(page,width,roomSuffix){
  await page.setViewportSize({width,height:width<768?820:920});
  const room='origin-hierarchy-v591-'+roomSuffix+'-'+width;
  await page.route('**/*',route=>
    new URL(route.request().url()).origin==='http://127.0.0.1:4173'
      ?route.continue():route.abort('blockedbyclient'));
  await page.addInitScript(roomName=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskRoomId',roomName);
    localStorage.setItem('systemTaskUser','OriginAuditUser');
  },room);
  await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  const host=page.locator('#modernOriginRoot');
  await expect(host).toBeVisible();
  const seeded=await page.evaluate(async()=>{
    const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
    const input=[
      {title:'電子カルテの更新手順を確認',description:'検証項目と運用手順を整理して担当部署と共有する',days:0,priority:'高',checklist:'事前確認\\n手順確認\\n結果共有'},
      {title:'端末更新の作業日程を調整',description:'現場業務に支障が出ない時間帯を調整する',days:2,priority:'中',checklist:'利用部署へ確認\\n日程確定'},
      {title:'ネットワーク機器の設定を確認',description:'機器設定と運用資料の差分を確認する',days:6,priority:'低',checklist:''}
    ];
    const created=[];
    for(const t of input){
      const d=new Date(); d.setDate(d.getDate()+t.days);
      const dueDate=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
      const response=await bridge.dispatch({type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,assignee:s.users?.[0]||s.currentUser,status:s.statuses.includes('未着手')?'未着手':s.statuses[0],category:s.categories[0],title:t.title,description:t.description,requester:'',tags:'',checklist:t.checklist,priority:t.priority,dueDate,dueTime:'15:30',pinned:false});
      if(!response?.ok)throw Error('task.create fixture: '+JSON.stringify(response));
      created.push(response.id);
    }
    return created;
  });
  await host.locator((width<768?'#mobileNav':'#desktopNav')+' [data-route="tasks"]').click();
  const rows=host.locator('.origin-task-collection .item-row');
  await expect(rows).toHaveCount(3);
  return {host,rows,seeded};
}

async function attachScreenshot(testInfo,page,title){
  await testInfo.attach(title,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
}

for(const width of [320,390,1366]){
  test('Origin compact list shows separated and scannable work rows at '+width+'px',async({page},testInfo)=>{
    test.setTimeout(90000);
    const {host,rows}=await openOrigin(page,width,'compact');
    const list=host.locator('.origin-task-layout-list.origin-tasks-compact');
    await expect(list).toBeVisible();
    await attachScreenshot(testInfo,page,'origin-tasks-compact-'+width);
    const geometry=await rows.evaluateAll(elements=>elements.map(el=>{
      const r=el.getBoundingClientRect(),title=el.querySelector('.item-name');
      return {y:r.y,height:r.height,borderRadius:parseFloat(getComputedStyle(el).borderTopLeftRadius),font:parseFloat(getComputedStyle(title).fontSize)};
    }));
    expect(geometry.every(x=>x.borderRadius>=10&&x.font>=14)).toBe(true);
    for(let i=1;i<geometry.length;i++)expect(geometry[i].y-(geometry[i-1].y+geometry[i-1].height)).toBeGreaterThanOrEqual(5);
    await expect(rows.first().locator('[data-action="open"][data-kind="tasks"]')).toBeVisible();
    await expect(rows.first().locator('[data-action="list-quick-edit"]')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
  });
}

for(const width of [390,1366]){
  test('Origin detailed list presents work briefs with labeled due and assignee at '+width+'px',async({page},testInfo)=>{
    test.setTimeout(90000);
    const {host}=await openOrigin(page,width,'expanded');
    // Mobile density settings live within the deliberately collapsed advanced filters.
    if(width<768){
      await host.locator('[data-action="task-advanced-toggle"]').click();
      await expect(host.locator('[data-action="task-density"]')).toBeVisible();
    }
    await host.locator('[data-action="task-density"]').click();
    const list=host.locator('.origin-task-layout-list:not(.origin-tasks-compact)');
    const rows=list.locator('.item-row');
    await expect(rows).toHaveCount(3);
    await attachScreenshot(testInfo,page,'origin-tasks-detailed-'+width);
    const titleSize=await rows.first().locator('.item-name').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
    expect(titleSize).toBeGreaterThanOrEqual(width>=768?16:15);
    const description=rows.first().locator('.origin-task-insight-description');
    await expect(description).toBeVisible();
    if(width>=768){
      await expect(rows.first().locator('.item-date .origin-task-fact-label')).toBeVisible();
      await expect(rows.first().locator('.item-assignee .origin-task-fact-label')).toBeVisible();
    }
    const cards=await rows.evaluateAll(elements=>elements.map(el=>({y:el.getBoundingClientRect().y,height:el.getBoundingClientRect().height,radius:parseFloat(getComputedStyle(el).borderTopLeftRadius)})));
    expect(cards.every(x=>x.radius>=12)).toBe(true);
    for(let i=1;i<cards.length;i++)expect(cards[i].y-(cards[i-1].y+cards[i-1].height)).toBeGreaterThanOrEqual(8);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
  });

  test('Origin task inspector has a clear overview and retains existing editing actions at '+width+'px',async({page},testInfo)=>{
    test.setTimeout(90000);
    const {host,rows}=await openOrigin(page,width,'detail');
    await rows.first().locator('.item-name').click();
    const sheet=host.locator('#sheet');
    await expect(sheet.locator('.origin-task-detail')).toBeVisible();
    await attachScreenshot(testInfo,page,'origin-task-inspector-'+width);
    const overview=sheet.locator('#originTaskOverview');
    await expect(overview.locator('dt')).toContainText(['期限日・時刻','担当者','依頼者','状態']);
    const section=sheet.locator('.origin-task-detail>.origin-task-section').first();
    const border=await section.evaluate(el=>parseFloat(getComputedStyle(el).borderLeftWidth));
    expect(border).toBe(0);
    await expect(sheet.locator('.origin-sheet-primary [data-action="edit"]')).toBeVisible();
    await expect(sheet.locator('[data-action="task-check"]')).toHaveCount(3);
    await sheet.locator('.sheet-close').click();
    await expect(host.locator('#overlay')).toBeHidden();
  });
}
